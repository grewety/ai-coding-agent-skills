import { piReviewer } from "./agent-role-adapters.mjs";
import { equal, fileLimit, fields, hash, need, parseStrictJson, relative, text, utf8, uuid } from "./review-inputs.mjs";

const empty = (value) => Array.isArray(value) && value.length === 0;
const builtinPlugin = (plugin) => {
  if (!plugin || typeof plugin !== "object" || Array.isArray(plugin)) return false;
  const keys = Object.keys(plugin);
  return keys.length === 3 && keys.every((key) => ["name", "path", "source"].includes(key)) &&
    text(plugin.name) && plugin.path === "builtin" && plugin.source === `${plugin.name}@builtin`;
};
const nonnegativeInteger = (value) => Number.isSafeInteger(value) && value >= 0;
const normalizedFile = (value) => value.replaceAll("\r\n", "\n").replace(/\n$/, "");
const blocks = (event) => {
  need(Array.isArray(event.message?.content) && event.message.content.length > 0 && !event.parent_tool_use_id,
    "Invalid native stream message");
  return event.message.content;
};

export function auditClaudeStream(proc, runtime, assigned, probe, files) {
  need(proc.quiescent === true && proc.outcome === "exit" && proc.code === 0 && proc.signal === null, "Native process or supervisor did not complete");
  const source = utf8(proc.stdout);
  need(source.endsWith("\n"), "Partial native stream");
  const lines = source.slice(0, -1).split("\n");
  need(lines.length >= 3 && lines.length <= 4096, "Invalid native stream size");
  const events = lines.map((line) => parseStrictJson(Buffer.from(line)));
  const init = events[0];
  const end = events.at(-1);
  need(events.every((event) => event?.session_id === runtime.session && !event.parent_tool_use_id) &&
    init.type === "system" && init.subtype === "init" && init.model === runtime.model &&
    init.claude_code_version === runtime.version && init.cwd === "/review" && init.permissionMode === "dontAsk",
    "Native stream identity mismatch");
  need(Array.isArray(init.tools) && init.tools.length === 1 && init.tools[0] === "Read" &&
    [init.mcp_servers, init.skills, init.slash_commands].every(empty) &&
    Array.isArray(init.plugins) && init.plugins.every(builtinPlugin) &&
    (init.agents === undefined || (Array.isArray(init.agents) && init.agents.every(text))), "Unexpected native startup inventory");
  need(end.type === "result" && end.subtype === "success" && end.is_error === false &&
    empty(end.permission_denials) && typeof end.result === "string" && end.result.length > 0 &&
    Buffer.byteLength(end.result) <= fileLimit &&
    Number.isSafeInteger(end.num_turns) && end.num_turns > 0 && end.num_turns <= (runtime.maxTurns ?? 128) &&
    Number.isFinite(end.total_cost_usd) && end.total_cost_usd >= 0 && end.total_cost_usd <= (runtime.maxBudgetUsd ?? 1),
    "Invalid terminal native stream result");
  const paths = new Set(assigned.map((name) => "/review/" + name));
  const pending = new Map();
  const usedIds = new Set();
  const seenPaths = new Set();
  let activeMessageId;
  let finalText = [];
  for (const event of events.slice(1, -1)) {
    if (event.type === "system" && event.subtype === "thinking_tokens") {
      fields(event, ["type", "subtype", "session_id", "estimated_tokens", "estimated_tokens_delta"],
        "native thinking advisory", ["uuid", "user_message_uuid"]);
      need(nonnegativeInteger(event.estimated_tokens) && nonnegativeInteger(event.estimated_tokens_delta) &&
        event.estimated_tokens_delta <= event.estimated_tokens &&
        [event.uuid, event.user_message_uuid].every((value) => value === undefined || text(value)),
      "Invalid native thinking advisory");
    } else if (event.type === "assistant") {
      const { id: messageId, model } = event.message ?? {};
      const sameMessage = typeof messageId === "string" && messageId.length > 0 && messageId === activeMessageId;
      need((pending.size === 0 || sameMessage) && (model === undefined || model === runtime.model),
        "Unexpected native stream assistant turn");
      if (!sameMessage) {
        activeMessageId = messageId;
        finalText = [];
      }
      for (const block of blocks(event)) {
        if (block.type === "text") {
          fields(block, ["type", "text"], "native text", ["citations"]);
          need(typeof block.text === "string" && !block.citations?.length, "Invalid native text");
          finalText.push(block.text);
          continue;
        }
        if (block.type === "thinking") {
          fields(block, ["type", "thinking", "signature"], "native thinking block");
          need(typeof block.thinking === "string" && typeof block.signature === "string", "Invalid native thinking block");
          continue;
        }
        if (block.type === "redacted_thinking") {
          fields(block, ["type", "data"], "native redacted thinking block");
          need(text(block.data), "Invalid native redacted thinking block");
          continue;
        }
        fields(block, ["type", "id", "name", "input"], "native Read", ["caller"]);
        if (block.caller !== undefined) {
          fields(block.caller, ["type"], "native Read caller");
          need(block.caller.type === "direct", "Unexpected native Read caller");
        }
        fields(block.input, ["file_path"], "whole-file Read");
        const pathname = block.input.file_path;
        need(!probe && block.type === "tool_use" && block.name === "Read" && text(block.id) &&
          !usedIds.has(block.id) && paths.has(pathname), "Unexpected native Read");
        usedIds.add(block.id);
        pending.set(block.id, pathname);
      }
    } else if (event.type === "user") {
      const results = blocks(event);
      need(results.length === 1 && !event.isSynthetic, "Unpaired native Read result");
      const [block] = results;
      fields(block, ["type", "tool_use_id", "content"], "native Read result", ["is_error"]);
      const pathname = pending.get(block.tool_use_id);
      const metadata = event.tool_use_result;
      fields(metadata, ["type", "file"], "native Read metadata");
      const { file } = metadata;
      fields(file, ["filePath", "content", "startLine", "numLines"], "native Read file metadata", ["totalLines"]);
      need(block.type === "tool_result" && pathname && [false, undefined].includes(block.is_error) &&
        typeof block.content === "string" && (block.content.length > 0 || pathname.endsWith(".patch")) &&
        metadata.type === "text" && file.filePath === pathname && typeof file.content === "string" &&
        file.startLine === 1 && nonnegativeInteger(file.numLines) &&
        (file.numLines > 0 || (file.content === "" && pathname.endsWith(".patch"))) &&
        (file.totalLines === undefined || file.numLines === file.totalLines), "Failed or partial Read result");
      if (runtime.explicit || runtime.direct) {
        const bytes = files?.get(pathname.slice("/review/".length));
        need(Buffer.isBuffer(bytes), "Missing exact exported bytes for the native Read");
        const exported = utf8(bytes);
        const content = normalizedFile(exported);
        const lines = bytes.length ? content.split("\n") : [];
        const delivered = normalizedFile(block.content);
        const numbered = delivered.split("\n");
        const forms = exported.endsWith("\n") ? [lines, [...lines, ""]] : [lines];
        const rendered = forms.some((form) => form.length === numbered.length && form.every((line, index) => {
          const match = /^ *(\d+)[\t→]([\s\S]*)$/.exec(numbered[index]);
          return match && Number(match[1]) === index + 1 && match[2] === line;
        }));
        need(normalizedFile(file.content) === content && forms.some((form) => file.numLines === form.length) &&
          (delivered === content || rendered),
          "Native Read differs from the full exported file");
      }
      seenPaths.add(pathname);
      pending.delete(block.tool_use_id);
    } else {
      throw new Error("Unexpected native stream event");
    }
  }
  need(!pending.size && paths.size === seenPaths.size && finalText.join("") === end.result, "Native Read coverage or final stream text mismatch");
  if (probe) need(end.result === "REVIEW_PROBE_OK", "Unexpected probe result");
  return end.result;
}

function piText(content) {
  need(Array.isArray(content) && content.length > 0, "Unexpected Pi text content");
  return content.map((part) => {
    fields(part, ["type", "text"], "Pi text part");
    need(part.type === "text" && typeof part.text === "string", "Unexpected Pi text content");
    return part.text;
  }).join("");
}

// Pi 1.5.2's bundled prompt sections and single read tool declaration at the fixed mount.
const piSystemSha256 = "717493f40f04b05d9342bce562ae8d442d4160ef4423e2efe71e7b17e9364704";

function piUsage(usage) {
  const counts = ["input", "output", "cacheRead", "cacheWrite"];
  fields(usage, [...counts, "totalTokens", "cost"], "Pi usage");
  fields(usage.cost, [...counts, "total"], "Pi cost");
  need([...counts, "totalTokens"].every((key) => nonnegativeInteger(usage[key])) &&
    [...counts, "total"].every((key) => Number.isFinite(usage.cost[key]) && usage.cost[key] >= 0), "Invalid Pi usage");
}

function piAssistant(message, runtime, starting) {
  fields(message, ["role", "content", "api", "model", "provider", "usage", "stopReason", "timestamp",
    ...(starting ? [] : ["rawStopReason", "durationMs", "thinkingLevel"])], "Pi assistant",
  starting ? [] : ["responseId"]);
  piUsage(message.usage);
  need(message.role === "assistant" && message.model === runtime.model && message.provider === runtime.explicit.provider &&
    message.api === "openai-completions" && Array.isArray(message.content) && nonnegativeInteger(message.timestamp) &&
    (starting ? message.stopReason === "pending" && !message.content.length :
      message.thinkingLevel === piReviewer.effort && nonnegativeInteger(message.durationMs) &&
      (message.responseId === undefined || typeof message.responseId === "string" && /^[\w.-]{1,128}$/.test(message.responseId)) &&
      (message.stopReason === "stop" && message.rawStopReason === "stop" ||
       message.stopReason === "toolUse" && message.rawStopReason === "tool_calls")), "Pi assistant identity or completion mismatch");
}

function piRead(block, allowed) {
  fields(block, ["type", "id", "name", "arguments"], "Pi Read call");
  fields(block.arguments, ["path"], "Pi whole-file Read");
  const pathname = block.arguments.path;
  const name = typeof pathname === "string" && pathname.startsWith("/review/") && pathname.slice(8);
  need(block.type === "toolCall" && block.name === "read" && typeof block.id === "string" && /^[\w.-]{1,128}$/.test(block.id) &&
    relative(name) && allowed.has(name), "Unexpected Pi Read call");
  return name;
}

function piUpdate(event, turn, allowed) {
  fields(event, ["type", "usage", "assistantMessageEvent"], "Pi message update");
  piUsage(event.usage);
  const update = event.assistantMessageEvent;
  const index = update?.contentIndex;
  need(turn?.start?.role === "assistant" && nonnegativeInteger(index) && index <= 4096, "Unexpected Pi message update");
  const previous = turn.updates.get(index);
  const kind = /^(text|toolcall)_(start|delta|end)$/.exec(update.type);
  need(kind, "Unexpected Pi update type");
  const [, type, phase] = kind;
  if (phase === "start") {
    fields(update, ["type", "contentIndex", ...(type === "toolcall" ? ["id", "toolName"] : [])], "Pi update start");
    need(!previous && (type === "text" || update.toolName === "read" &&
      typeof update.id === "string" && /^[\w.-]{1,128}$/.test(update.id)), "Unexpected Pi Read update");
    turn.updates.set(index, { type, id: update.id, delta: "" });
  } else if (phase === "delta") {
    fields(update, ["type", "contentIndex", "delta"], "Pi update delta");
    need(previous?.type === type && !previous.block && typeof update.delta === "string", "Unpaired Pi update delta");
    previous.delta += update.delta;
  } else {
    fields(update, ["type", "contentIndex", type === "text" ? "content" : "toolCall"], "Pi update end");
    need(previous?.type === type && !previous.block, "Unpaired Pi update end");
    if (type === "text") {
      need(update.content === previous.delta, "Mismatched Pi streamed text");
      previous.block = { type: "text", text: update.content };
    } else {
      piRead(update.toolCall, allowed);
      need(update.toolCall.id === previous.id && equal(parseStrictJson(Buffer.from(previous.delta)), update.toolCall.arguments),
        "Mismatched Pi streamed Read call");
      previous.block = update.toolCall;
    }
  }
}

export function auditPiStream(proc, runtime, assigned, probe, files, requireParallel = false, prompt) {
  need(runtime.explicit?.client === piReviewer.client && runtime.explicit.provider === piReviewer.provider &&
    runtime.explicit.reasoningEffort === piReviewer.effort && runtime.version === piReviewer.version &&
    runtime.model === piReviewer.model && runtime.route === piReviewer.relay && uuid(runtime.session) &&
    Number.isSafeInteger(runtime.maxTurns) && runtime.maxTurns >= 1 && runtime.maxTurns <= 128 &&
    runtime.explicit.requestLimit === runtime.maxTurns, "Pi stream binding mismatch");
  need(proc.quiescent === true && proc.outcome === "exit" && proc.code === 0 && proc.signal === null &&
    Buffer.isBuffer(proc.stderr) && proc.stderr.length === 0, "Pi process or supervisor did not complete cleanly");
  const source = utf8(proc.stdout);
  need(source.endsWith("\n"), "Partial Pi native stream");
  const lines = source.slice(0, -1).split("\n");
  need(lines.length >= 12 && lines.length <= 65536, "Invalid Pi native stream size");
  const events = lines.map((line) => parseStrictJson(Buffer.from(line)));
  const [session, start] = events;
  fields(session, ["type", "version", "id", "timestamp", "cwd"], "Pi session");
  fields(start, ["type"], "Pi startup");
  need(session.type === "session" && session.version === 3 && session.id === runtime.session && session.cwd === "/review" &&
    typeof session.timestamp === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(session.timestamp) &&
    Number.isFinite(Date.parse(session.timestamp)) && start.type === "agent_start", "Pi native session identity mismatch");

  const covered = new Set();
  const usedIds = new Set();
  const history = [];
  const allowed = new Set(assigned);
  let turns = 0;
  let turn;
  let finalText;
  let observedParallel = false;

  for (const event of events.slice(2, -2)) {
    switch (event.type) {
      case "turn_start":
        fields(event, ["type"], "Pi turn start");
        need(!turn && finalText === undefined && ++turns <= runtime.explicit.requestLimit,
          "Unexpected Pi turn or request limit exceeded");
        turn = { calls: new Map(), updates: new Map(), results: [] };
        break;
      case "message_update":
        piUpdate(event, turn, allowed);
        break;
      case "message_start": {
        fields(event, ["type", "message"], "Pi message start");
        const message = event.message;
        need(turn && !turn.start, "Unexpected Pi message start");
        if (!history.length) {
          fields(message, ["role", "content", "sections", "timestamp", "toolsAdded"], "Pi system inventory");
          need(turns === 1 && message.role === "system" && message.content === "" && nonnegativeInteger(message.timestamp) &&
            hash(JSON.stringify([message.sections, message.toolsAdded])) === piSystemSha256, "Unexpected Pi system inventory");
        } else if (history.length === 1) {
          fields(message, ["role", "content", "timestamp"], "Pi user message");
          need(message.role === "user" && nonnegativeInteger(message.timestamp) && message.content?.length === 1 &&
            (prompt === undefined ? piText(message.content).length > 0 : piText(message.content) === prompt), "Unexpected Pi user message");
        } else if (!turn.assistant) {
          piAssistant(message, runtime, true);
        } else {
          fields(message, ["role", "toolCallId", "toolName", "content", "isError", "durationMs", "timestamp"], "Pi Read message");
          const call = turn.calls.get(message.toolCallId);
          need(message.role === "toolResult" && message.toolName === "read" && message.isError === false &&
            call?.result && !call.delivered && equal(call.result.content, message.content) &&
            call.durationMs === message.durationMs && nonnegativeInteger(message.timestamp), "Unpaired or mismatched Pi Read message");
        }
        turn.start = message;
        break;
      }
      case "message_end": {
        fields(event, ["type", "message"], "Pi message end");
        const message = event.message;
        need(turn?.start && turn.start.role === message?.role, "Pi message without matching start");
        if (message.role === "assistant") {
          piAssistant(message, runtime, false);
          need(message.timestamp === turn.start.timestamp && message.content.length === turn.updates.size &&
            message.content.every((block, index) => equal(block, turn.updates.get(index)?.block)), "Pi assistant stream snapshots differ");
          turn.assistant = message;
          const output = [];
          for (const block of message.content) {
            if (block?.type === "text") { output.push(piText([block])); continue; }
            const name = piRead(block, allowed);
            need(!probe && !usedIds.has(block.id), "Unexpected Pi Read call");
            usedIds.add(block.id);
            turn.calls.set(block.id, { name, args: block.arguments });
          }
          need((message.stopReason === "toolUse") === (turn.calls.size > 0), "Unexpected Pi turn stop reason");
          if (!turn.calls.size) finalText = output.join("");
        } else {
          need(equal(message, turn.start), "Mismatched Pi message snapshots");
          if (message.role === "toolResult") {
            const call = turn.calls.get(message.toolCallId);
            call.delivered = true;
            turn.results.push(message);
            covered.add(call.name);
          }
        }
        turn.start = undefined;
        history.push(message);
        break;
      }
      case "tool_execution_start": {
        fields(event, ["type", "toolCallId", "toolName", "args"], "Pi Read start");
        const call = turn?.calls.get(event.toolCallId);
        need(call && !call.started && event.toolName === "read" && equal(call.args, event.args), "Unpaired Pi Read start");
        if ([...turn.calls.values()].some((other) => other.started && !other.result)) observedParallel = true;
        call.started = true;
        break;
      }
      case "tool_execution_end": {
        fields(event, ["type", "toolCallId", "toolName", "result", "isError", "durationMs"], "Pi Read result");
        const call = turn?.calls.get(event.toolCallId);
        need(call?.started && !call.result && event.toolName === "read" && event.isError === false &&
          nonnegativeInteger(event.durationMs), "Unpaired or rejected Pi Read result");
        fields(event.result, ["content", "structuredContent"], "Pi whole-file result");
        const bytes = files?.get(call.name);
        need(Buffer.isBuffer(bytes) && event.result.content?.length === 1 &&
          piText(event.result.content) === utf8(bytes) && event.result.structuredContent === utf8(bytes),
        "Pi Read differs from the full exported file");
        call.result = event.result;
        call.durationMs = event.durationMs;
        break;
      }
      case "turn_end":
        fields(event, ["type", "message", "toolResults"], "Pi turn end");
        need(turn?.assistant && !turn.start && equal(event.message, turn.assistant) && equal(event.toolResults, turn.results) &&
          [...turn.calls.values()].every((call) => call.delivered), "Incomplete or mismatched Pi turn");
        turn = undefined;
        break;
      default:
        throw new Error("Unexpected Pi native stream event");
    }
  }
  const [end, settled] = events.slice(-2);
  fields(end, ["type", "messages", "willRetry"], "Pi terminal result");
  fields(settled, ["type", "aborted"], "Pi settlement");
  need(end.type === "agent_end" && end.willRetry === false && settled.type === "agent_settled" && settled.aborted === false &&
    !turn && equal(end.messages, history) && (!requireParallel || observedParallel) && covered.size === allowed.size &&
    typeof finalText === "string" && finalText.length > 0 && Buffer.byteLength(finalText) <= fileLimit &&
    (!probe || finalText === "REVIEW_PROBE_OK"), "Pi Read coverage or final stream result mismatch");
  return finalText;
}
