import path from "node:path";
import { admitReceipt, reviewPrompt } from "./review-admission.mjs";
import { directAdapter, invocation } from "./review-direct-adapters.mjs";
import { digest, equal, fields, fileLimit, hash, jsonBytes, need, parseStrictJson, scanExport, text, utf8, uuid } from "./review-inputs.mjs";
import { auditClaudeStream } from "./review-stream.mjs";

export function packetIdentity(prepared, index, session) {
  const packet = prepared.manifest.packets[index];
  const inventory = new Map(prepared.manifest.files.map((entry) => [entry.name, entry]));
  return { session, inventorySha256: hash(jsonBytes(packet.paths.map((name) => inventory.get(name)))) };
}

function packetBytes(prepared, index) {
  return new Map(prepared.manifest.packets[index].paths.map((name) => [name, prepared.files.get(name)]));
}

export function directPacketPrompt(request, context, prepared, index, session, settings, maxBudgetUsd) {
  const adapter = directAdapter(settings, session, maxBudgetUsd);
  return reviewPrompt(request, context, prepared.manifest.packets[index], index, prepared.manifest.packets.length,
    "direct-cli:" + request.session, { binding: packetIdentity(prepared, index, session), assigned: "",
      inline: ["inline", "file", "agy"].includes(adapter.transport) });
}

function jsonl(bytes) {
  const source = utf8(bytes).replaceAll("\r\n", "\n");
  need(source.endsWith("\n"), "Truncated native JSONL");
  const lines = source.slice(0, -1).split("\n");
  need(lines.length <= 4096, "Too many native stream events");
  return lines.map((line) => parseStrictJson(Buffer.from(line)));
}

function safeReport(value, redactions = []) {
  need(typeof value === "string" && value.length > 0 && Buffer.byteLength(value) <= fileLimit, "Invalid native review report length");
  const report = value.replaceAll("\r\n", "\n");
  scanExport("native.txt", Buffer.from(report));
  need(redactions.every((sensitive) => !sensitive || !report.includes(sensitive)) &&
    !/(?:\b[A-Za-z]:[\\/]|(?:^|[\s"'(=])\/(?:home|Users|private|tmp|var|mnt|root)\/)/m.test(report),
  "Native review report exposed a host path or environment value");
  return report;
}

function reviewAnswer(events, format, { cwd, session } = {}) {
  const first = events[0];
  const last = events.at(-1);
  if (format === "codex-json") {
    const threads = events.filter((event) => event.type === "thread.started");
    const answers = events.filter((event) => event.type === "item.completed" && event.item?.type === "agent_message");
    need(threads.length === 1 && events[0] === threads[0] && text(threads[0].thread_id) && answers.length === 1 &&
      last.type === "turn.completed" && events.every((event) =>
        ["thread.started", "turn.started", "turn.completed", "item.started", "item.updated", "item.completed"].includes(event.type) &&
        (!event.item || ["agent_message", "reasoning"].includes(event.item.type))), "Unexpected Codex session, tool, or output");
    return { answer: answers[0].item.text, nativeSession: threads[0].thread_id };
  }
  if (format === "hermes-json") {
    need(first.type === "system" && first.subtype === "init" && text(first.session_id) &&
      last.type === "result" && last.exit_code === 0 && last.session_id === first.session_id &&
      !last.error && !last.replay_gap && events.slice(1, -1).every((event) => event.type === "text"),
    "Unexpected Hermes session, tool, or output");
    return { answer: last.text, nativeSession: first.session_id, model: first.model };
  }
  if (format === "agy-json") {
    const updates = events.slice(1, -1).map((event) => event.event === "step_update" && event.step_update);
    need(first.event === "init" && text(first.conversation_id) && last.event === "result" &&
      last.result?.status === "SUCCESS" && last.result.conversation_id === first.conversation_id &&
      last.result.num_turns === 1 && path.normalize(first.init?.cwd ?? "") === path.normalize(cwd) &&
      first.init.permission_mode === "strict" && text(first.init.model) &&
      updates.every((step) => step && step.conversation_id === first.conversation_id &&
        ["user_input", "agent_response", "checkpoint"].includes(step.step_type) && ["ACTIVE", "DONE"].includes(step.state) &&
        !Object.hasOwn(step, "tool_name") && !Object.hasOwn(step, "tool_info") && !Object.hasOwn(step, "subagent_info")) &&
      updates.filter((step) => step.step_type === "agent_response").map((step) => step.text_delta ?? "").join("") === last.result.response,
    "Unexpected Antigravity session, tool, or output");
    return { answer: last.result.response, nativeSession: first.conversation_id, model: first.init.model };
  }
  if (format === "pi-json") {
    const answers = events.filter((event) => event.type === "message_end" && event.message?.role === "assistant");
    const message = answers[0]?.message;
    const parts = (content) => Array.isArray(content) && content.every((part) => ["text", "thinking"].includes(part.type));
    need(first.type === "session" && first.id === session && path.normalize(first.cwd) === path.normalize(cwd) &&
      last.type === "agent_settled" && last.aborted === false && answers.length === 1 && message.stopReason === "stop" &&
      text(message.model) && text(message.provider) && parts(message.content) && events.slice(1, -1).every((event) =>
        ["agent_start", "turn_start", "message_start", "message_update", "message_end", "turn_end", "agent_end"].includes(event.type) &&
        (event.type !== "turn_end" || Array.isArray(event.toolResults) && event.toolResults.length === 0) &&
        (event.type !== "agent_end" || event.willRetry === false && Array.isArray(event.messages) &&
          event.messages.every((entry) => entry.role === "user" || entry.role === "assistant" && parts(entry.content))) &&
        (event.type !== "message_update" || /^(?:text|thinking)_(?:start|delta|end)$/.test(event.assistantMessageEvent?.type)) &&
        (!event.message || event.message.role === "user" || event.message.role === "assistant" && parts(event.message.content))),
    "Unexpected Pi session, model, tool, or output");
    return { answer: message.content.filter((part) => part.type === "text").map((part) => part.text).join(""),
      nativeSession: first.id, model: message.model, provider: message.provider };
  }
  const answer = events.filter((event) => event.type === "text");
  need(answer.length > 0 && text(last.sessionID) && last.type === "step_finish" && last.part?.reason === "stop" &&
    /^[a-zA-Z0-9_.-]{1,128}$/.test(last.part.messageID ?? "") &&
    answer.every((event) => event.part?.messageID === last.part.messageID) &&
    events.every((event) => ["step_start", "step_finish", "text"].includes(event.type) && event.sessionID === last.sessionID &&
      (event.type !== "text" || typeof event.part?.text === "string") &&
      (event.part?.sessionID === undefined || event.part.sessionID === last.sessionID)), "Unexpected OpenCode or Kilo session, tool, or output");
  return { answer: answer.map((event) => event.part.text).join(""), nativeSession: last.sessionID, messageId: last.part.messageID };
}

function evidenceForReport(format, { nativeSession, model, provider, messageId, answer }) {
  switch (format) {
    case "text":
      return [{ report: answer }];
    case "codex-json":
      return [{ type: "thread.started", thread_id: nativeSession },
        { type: "item.completed", item: { type: "agent_message", text: answer } }, { type: "turn.completed" }];
    case "hermes-json":
      return [{ type: "system", subtype: "init", session_id: nativeSession, model },
        { type: "result", session_id: nativeSession, exit_code: 0, text: answer }];
    case "agy-json":
      return [{ event: "init", conversation_id: nativeSession, init: { cwd: "/review", permission_mode: "strict", model } },
        { event: "step_update", step_update: { conversation_id: nativeSession, step_type: "agent_response", state: "DONE", text_delta: answer } },
        { event: "result", result: { conversation_id: nativeSession, status: "SUCCESS", num_turns: 1, response: answer } }];
    case "pi-json":
      return [{ type: "session", id: nativeSession, cwd: "/review" },
        { type: "message_end", message: { role: "assistant", stopReason: "stop", model, provider, content: [{ type: "text", text: answer }] } },
        { type: "agent_settled", aborted: false }];
    case "opencode-json":
      return [{ type: "text", sessionID: nativeSession, part: { messageID: messageId, text: answer } },
        { type: "step_finish", sessionID: nativeSession, part: { messageID: messageId, reason: "stop" } }];
  }
}

function boundModel(observed, model) {
  return observed.model === undefined || observed.model === model ||
    (observed.provider !== undefined && `${observed.provider}/${observed.model}` === model);
}

function exactPacketPath(value, cwd, paths) {
  for (const name of paths) if (value === path.join(cwd, name) || value === name || value === "./" + name) {
    return "/review/" + name;
  }
  throw new Error("Native Read targeted an unassigned path");
}

const claudeAdvisorySystemSubtypes = new Set(["api_retry", "status", "compact_boundary"]);

function sanitizeClaude(events, cwd, paths, redactions) {
  const projected = [];
  for (const event of events) {
    const { type, subtype, session_id, parent_tool_use_id } = event;
    const common = { type, subtype, session_id, parent_tool_use_id };
    if (type === "system" && subtype === "init") {
      need(event.cwd === cwd, "Native reviewer ran in an unexpected directory");
      const { tools, mcp_servers, skills, slash_commands, plugins, permissionMode, claude_code_version, model } = event;
      projected.push({ ...common, cwd: "/review", tools, mcp_servers, skills, slash_commands, plugins,
        permissionMode, claude_code_version, model });
    } else if (type === "assistant") {
      const { id, model, content } = event.message;
      need(Array.isArray(content), "Missing Claude assistant content");
      projected.push({ ...common, message: { id, model, content: content.map((block) => {
        if (block.type === "thinking") return { type: block.type, thinking: "", signature: "" };
        if (block.type === "redacted_thinking") return { type: block.type, data: "redacted" };
        if (block.type === "text") return { ...block, text: safeReport(block.text, redactions) };
        fields(block.input, ["file_path"], "whole-file Read");
        return { ...block, input: { file_path: exactPacketPath(block.input.file_path, cwd, paths) } };
      }) } });
    } else if (type === "user") {
      const { type: resultType, file } = event.tool_use_result ?? {};
      need(file, "Missing Read evidence");
      projected.push({ ...common, isSynthetic: event.isSynthetic, message: { content: event.message?.content },
        tool_use_result: { type: resultType, file: { ...file, filePath: exactPacketPath(file.filePath, cwd, paths) } } });
    } else if (type === "result") {
      const { is_error, permission_denials, num_turns, total_cost_usd } = event;
      projected.push({ ...common, is_error, permission_denials, num_turns, total_cost_usd,
        result: safeReport(event.result, redactions) });
    } else if (type === "system" && subtype === "thinking_tokens") {
      const { estimated_tokens, estimated_tokens_delta } = event;
      projected.push({ ...common, estimated_tokens, estimated_tokens_delta });
    } else if ((type === "rate_limit_event" || (type === "system" && claudeAdvisorySystemSubtypes.has(subtype))) && !parent_tool_use_id) {
      need(session_id === undefined || session_id === events[0]?.session_id, "Unexpected Claude advisory session");
      continue;
    } else {
      throw new Error("Unexpected Claude stream event");
    }
  }
  return projected;
}

export function sanitizeNative({ stdout, format, cwd, files, redactions, launch, maxBudgetUsd }) {
  if (format === "claude-read") {
    const events = sanitizeClaude(jsonl(stdout), cwd, [...files.keys()], redactions);
    const normalized = Buffer.concat(events.map(jsonBytes));
    auditClaudeStream({ ...launch.process, stdout: normalized }, {
      ...launch.runtime, session: launch.session, direct: true, maxBudgetUsd,
    }, [...files.keys()], false, files);
    return normalized;
  }
  const observed = format === "text" ? { answer: utf8(stdout), nativeSession: null } :
    reviewAnswer(jsonl(stdout), format, { cwd, session: launch.session });
  need(observed.nativeSession === null || /^[a-zA-Z0-9_.-]{1,128}$/.test(observed.nativeSession), "Invalid native session identifier");
  need(boundModel(observed, launch.runtime.model), "Native reviewer model differs");
  return Buffer.concat(evidenceForReport(format, { ...observed, answer: safeReport(observed.answer, redactions) }).map(jsonBytes));
}

export const nativeOutputReasons = Object.freeze([
  "host-path-redaction",
  "startup-inventory",
  "unexpected-event",
  "unassigned-or-partial-read",
  "read-coverage-or-text",
  "terminal-result",
  "stream-schema",
]);

export function classifyNativeOutputError(error) {
  const message = String(error?.message ?? "");
  if (/exposed a host path|secret|disallowed/i.test(message)) return "host-path-redaction";
  if (/startup inventory|stream identity mismatch/i.test(message)) return "startup-inventory";
  if (/Unexpected (?:Claude|native) stream event/i.test(message)) return "unexpected-event";
  if (/whole-file Read|unassigned path|partial Read|Unexpected native Read|Read differs/i.test(message)) return "unassigned-or-partial-read";
  if (/Read coverage or final stream text mismatch/i.test(message)) return "read-coverage-or-text";
  if (/Invalid terminal native stream result/i.test(message)) return "terminal-result";
  return "stream-schema";
}

const passProcess = (process) => process.quiescent === true && process.code === 0 && process.signal === null && process.outcome === "exit";

export function verifyDirectPacket({ request, context, prepared, index, launch, stdout, runtime, maxBudgetUsd, reference }) {
  fields(launch, ["schemaVersion", "packet", "session", "runtime", "inventorySha256", "invocationSha256", "backend", "timeoutMs",
    "before", "after", "exportBefore", "exportAfter", "copyBefore", "copyAfter", "process", "diagnostic"],
  "Direct-CLI launch", ["diagnosticReason"]);
  fields(launch.process, ["code", "signal", "outcome", "quiescent"], "Direct-CLI process settlement");
  need(launch.schemaVersion === 1 && launch.packet === index + 1 && uuid(launch.session) &&
    equal(launch.runtime, runtime) && launch.backend === runtime.supervisor.backend &&
    Number.isSafeInteger(launch.timeoutMs) && launch.timeoutMs >= 1 && launch.timeoutMs <= runtime.timeoutMs &&
    launch.inventorySha256 === packetIdentity(prepared, index, launch.session).inventorySha256 &&
    [true, false].includes(launch.process.quiescent) && text(launch.process.outcome), "Direct-CLI launch identity differs");
  const settings = Object.fromEntries(["client", "model", "reasoningEffort", "timeoutMs", "packetConcurrency"]
    .filter((field) => Object.hasOwn(runtime, field)).map((field) => [field, runtime[field]]));
  const files = packetBytes(prepared, index);
  const prompt = directPacketPrompt(request, context, prepared, index, launch.session, settings, maxBudgetUsd);
  const { format, fingerprint } = invocation({ config: { reviewer: settings, maxBudgetUsd }, session: launch.session,
    prompt, files, cwd: "packet", promptFile: "packet-prompt.txt", environmentRootsSha256: runtime.environmentRootsSha256 });
  need(digest(runtime.environmentRootsSha256) && (launch.invocationSha256 === fingerprint ||
    launch.invocationSha256 === null && launch.diagnostic !== null && launch.process.outcome === "not-started"),
  "Retained native reviewer invocation differs");
  if (launch.diagnostic !== null) {
    need(["integrity-failed", "preflight-failed", "invalid-native-output", "client-failed", "timeout",
      "canceled", "control-failed", "surviving-descendants", "supervisor-failed", "stdout-quota", "stderr-quota",
      "capture-quota", "upstream-rate-limited", "upstream-overloaded", "upstream-auth-failed"].includes(launch.diagnostic) &&
      (launch.diagnosticReason === undefined ||
        (launch.diagnostic === "invalid-native-output" && nativeOutputReasons.includes(launch.diagnosticReason))) &&
      stdout.length === 0, "Invalid Direct-CLI failure evidence");
    return { failure: launch.diagnostic, ...(launch.diagnosticReason ? { reason: launch.diagnosticReason } : {}) };
  }
  need(launch.diagnosticReason === undefined, "Unexpected Direct-CLI diagnostic reason");
  for (const observation of [launch.before, launch.after]) {
    fields(observation, ["head", "statusSha256", "contentSha256"], "worktree observation");
    need(/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(observation.head) &&
      digest(observation.statusSha256) && digest(observation.contentSha256), "Invalid worktree identity");
  }
  need(equal(launch.before, launch.after) && launch.exportBefore === true && launch.exportAfter === true &&
    launch.copyBefore === true && launch.copyAfter === true && passProcess(launch.process),
  "Unproved worktree, export, packet copy, or process settlement");
  let coverage = "receipt-only";
  let nativeSession;
  let report;
  if (format === "claude-read") {
    report = auditClaudeStream({ ...launch.process, stdout }, { ...runtime, session: launch.session, direct: true, maxBudgetUsd },
      [...files.keys()], false, files);
    nativeSession = launch.session;
    coverage = "whole-file";
  } else {
    const events = jsonl(stdout);
    let observed;
    if (format === "text") {
      need(events.length === 1, "Ambiguous retained native report");
      fields(events[0], ["report"], "retained native report");
      observed = { answer: events[0].report, nativeSession: null };
    } else {
      observed = reviewAnswer(events, format, { cwd: "/review", session: launch.session });
      need(/^[a-zA-Z0-9_.-]{1,128}$/.test(observed.nativeSession) &&
        boundModel(observed, runtime.model), "Retained native session or model differs");
    }
    nativeSession = observed.nativeSession;
    report = safeReport(observed.answer);
    need(stdout.equals(Buffer.concat(evidenceForReport(format, { ...observed, answer: report }).map(jsonBytes))),
      "Retained native evidence differs from selected adapter");
  }
  const receipt = admitReceipt(request, context, report, index, reference, prepared.manifest.packets[index], {
    framedOnly: true, binding: packetIdentity(prepared, index, launch.session),
  });
  return { coverage, nativeSession, report, receipt };
}
