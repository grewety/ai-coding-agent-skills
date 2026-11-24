import { fileLimit, fields, need, parseStrictJson, text, utf8 } from "./review-inputs.mjs";

const empty = (value) => Array.isArray(value) && value.length === 0;
const nonnegativeInteger = (value) => Number.isSafeInteger(value) && value >= 0;
const blocks = (event) => {
  need(Array.isArray(event.message?.content) && event.message.content.length > 0 && !event.parent_tool_use_id,
    "Invalid native stream message");
  return event.message.content;
};

export function auditClaudeStream(proc, runtime, assigned, probe) {
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
    [init.mcp_servers, init.skills, init.slash_commands, init.plugins].every(empty) &&
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
