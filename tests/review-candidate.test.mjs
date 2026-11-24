import { execFile, spawnSync } from "node:child_process";
import { EventEmitter } from "node:events";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import assert from "node:assert/strict";
import { packetize, parseStrictJson } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-inputs.mjs";
import { auditClaudeStream } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-stream.mjs";
import { admitReceipt, reviewPrompt } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-admission.mjs";
import { convergencePacket, startConvergenceReview } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/orchestration-core.mjs";

const beginReceipt = "BEGIN_REVIEW_RECEIPT";
const endReceipt = "END_REVIEW_RECEIPT";

test("candidate prompt ends with the exact clean packet template", () => {
  const target = "0123456789abcdef0123456789abcdef01234567";
  const context = { target };
  const prompt = reviewPrompt({ mode: "candidate" }, context, { paths: ["base/a", "target/b"] }, 1, 3, "candidate-ref");
  const suffix = [beginReceipt, "Verdict: No findings", `Target: ${target}`,
    `{"target":"${target}","packet":2,"findings":[],"coverageLimitations":[]}`, endReceipt].join("\n");
  assert.equal(prompt.slice(-suffix.length), suffix);
  const instructions = prompt.slice(0, -suffix.length);
  assert.match(instructions, /Batch multiple whole-file Read calls in parallel per turn/);
  assert.match(instructions, /file_path as the sole argument.*Read exactly all assigned \/review paths/);
  assert.deepEqual(instructions.split("\n").filter((line) => line.startsWith("/review/")), ["/review/base/a", "/review/target/b"]);
  assert.match(instructions, /Inherent read-only, no-shell, no-network constraints and future groups are not coverageLimitations/);
  assert.match(instructions, /Use \[\] for coverageLimitations when all assigned files were read/);
  assert.match(instructions, /Verdict: Findings.*findings/);
  assert.match(instructions, /nothing after END_REVIEW_RECEIPT/);
  assert.match(instructions, /Do not use lines beginning with Verdict: outside the block, even if indented/);
  assert.ok(instructions.includes(`Packet: 2 of 3\nNative reference: candidate-ref\n${JSON.stringify(context)}\n`));
});

test("approach prompt ends with the exact clean charter template", () => {
  const identity = { change: "fixture-change", ledger: [{ id: "F1", status: "open" }] };
  const context = { identity };
  const reference = 'approach "ref"';
  const prompt = reviewPrompt({ mode: "approach" }, context, { paths: ["plan/a", "plan/b"] }, 0, 1, reference);
  const suffix = [beginReceipt, "Verdict: No findings", "Policy: charter-v1",
    `{"identity":${JSON.stringify(identity)},"readOnly":true,"reference":${JSON.stringify(reference)},"verdict":"Verdict: No findings","findings":[],"observations":[],"coverageLimitations":[],"ledgerChecks":[]}`, endReceipt].join("\n");
  assert.equal(prompt.slice(-suffix.length), suffix);
  const instructions = prompt.slice(0, -suffix.length);
  assert.match(instructions, /Batch multiple whole-file Read calls in parallel per turn/);
  assert.match(instructions, /file_path as the sole argument.*Read exactly all assigned \/review paths/);
  assert.deepEqual(instructions.split("\n").filter((line) => line.startsWith("/review/")), ["/review/plan/a", "/review/plan/b"]);
  assert.match(instructions, /one ledgerChecks entry for each open ledger item/);
  assert.match(instructions, /reReviewReference must equal the supplied native reference/);
  assert.match(instructions, /copy the verdict line/);
  assert.match(instructions, /Populate observations and coverageLimitations/);
  assert.match(instructions, /Every findings item must use scopeDisposition "in-scope" and a clause copied exactly from charter\.clauses\./);
  assert.match(instructions, /Every observations item must use scopeDisposition "outside-charter" and clause null\./);
  assert.match(instructions, /For declared-deferral, use class and exactly one of task \(copied exactly from charter\.tasks\) or gate \(copied exactly from charter\.gates\)\./);
  assert.match(instructions, /For containment-boundary, use class and boundary copied exactly from charter\.boundaries\./);
  assert.match(instructions, /For packet-gap, use class and detail\./);
  assert.ok(instructions.includes(`Packet: 1 of 1\nNative reference: ${reference}\n${JSON.stringify(context)}\n`));
});

const candidateTarget = "0123456789abcdef0123456789abcdef01234567";
const candidateValue = { target: candidateTarget, packet: 1, findings: [], coverageLimitations: [] };
const bareReceipt = ["Verdict: No findings", `Target: ${candidateTarget}`, JSON.stringify(candidateValue)].join("\n");
const block = (receipt) => [beginReceipt, receipt, endReceipt].join("\n");
const admitCandidate = (report) => admitReceipt({ mode: "candidate" }, { target: candidateTarget },
  report, 0, "candidate-ref", { paths: ["target/a"] });

test("candidate receipt admits terminal framing with prose and the legacy bare form", () => {
  const expected = { ...candidateValue, verdict: "Verdict: No findings" };
  assert.deepEqual(admitCandidate(bareReceipt), expected);
  assert.deepEqual(admitCandidate(`Reviewed the assigned files.\n\n${block(bareReceipt)}\n \t`), expected);
});

test("approach receipt admits prose before the terminal block", () => {
  const change = "fixture-change";
  const inputs = Object.fromEntries(["openspec/config.yaml", ...[".openspec.yaml", "proposal.md", "tasks.md"]
    .map((name) => `openspec/changes/${change}/${name}`)].map((name) => [name, "a".repeat(64)]));
  const record = startConvergenceReview({ change, goal: "Review the fixture", passRule: "charter-v1", budget: 2,
    charter: { clauses: ["scope"], boundaries: ["fixture"], tasks: ["1.1"], gates: ["test"] },
    binding: { route: "terminal-adapter", client: "claude-code", model: "fixture", qualified: true,
      independent: true, readOnly: true, permissions: ["read"] } });
  const context = convergencePacket({ record, inputs, packetHashes: { "packet-1": "b".repeat(64) },
    authorSession: "fixture-author", reviewerSession: "fixture-reviewer" });
  const request = { mode: "approach", snapshot: { record }, worker: { identity: { inputs } } };
  const packet = { paths: ["plan/proposal.md"] };
  const reference = "approach-ref";
  const template = reviewPrompt(request, context, packet, 0, 1, reference).split("\n").slice(-5).join("\n");
  const result = admitReceipt(request, context, `Reviewed the fixture plan.\n${template}`, 0, reference, packet);
  assert.equal(result.admission.action, "freeze-ready");
});

test("candidate receipt rejects malformed blocks and outside verdict lines", () => {
  const validBlock = block(bareReceipt);
  for (const report of [
    `${validBlock}\nTrailing text`,
    `${beginReceipt}\n${validBlock}`,
    `${endReceipt}\n${validBlock}`,
    `${validBlock}\n${endReceipt}`,
    `${beginReceipt}\n${bareReceipt}`,
    `${bareReceipt}\n${endReceipt}`,
    `${endReceipt}\n${bareReceipt}\n${beginReceipt}`,
    ` ${validBlock}`,
    block(bareReceipt + "\nExtra interior line"),
    `Verdict:\n${validBlock}`,
    `Verdict: No findings\n${validBlock}`,
    ` \tVerdict: Findings\n${validBlock}`,
    `Verdict: contradictory prose\n${validBlock}`,
  ]) {
    assert.throws(() => admitCandidate(report), /Invalid native receipt framing/, report);
  }
});

test("candidate receipt validates JSON and verdict consistency inside the block", () => {
  assert.throws(() => admitCandidate(block(bareReceipt.slice(0, -1))), /JSON/);
  assert.throws(() => admitCandidate(block(bareReceipt.replace("Verdict: No findings", "Verdict: Findings"))),
    /Contradictory candidate receipt/);
});

test("strict JSON rejects decoded duplicate keys and trailing data", () => {
  assert.throws(() => parseStrictJson(Buffer.from('{"mode":1,"m\\u006fde":2}')), /JSON/);
  assert.throws(() => parseStrictJson(Buffer.from('{"mode":1} null')), /JSON/);
  assert.deepEqual(parseStrictJson(Buffer.from('{"mode": "candidate"}')), { mode: "candidate" });
});

test("oversized diff retains every hunk with file and rename/deletion context", () => {
  const header = "diff --git a/a b/b\nsimilarity index 72%\nrename from a\nrename to b\n";
  const hunks = ["@@ -1 +1 @@\n-old\n+new\n", "@@ -21 +21 @@\n-one\n+two\n"];
  const packets = packetize(header + hunks.join(""), [{ paths: ["base/a", "target/b"] }], 105);
  assert.deepEqual(packets.map((part) => part.diff), hunks.map((hunk) => header + hunk));
  assert.deepEqual(packets.map((part) => part.paths), [["base/a", "target/b"], ["base/a", "target/b"]]);
  assert.throws(() => packetize(header + hunks.join(""), [{ paths: ["base/a"] }], 12), /limit/);
});

const session = "fd844a0a-b0ce-439a-9f8b-f1e3fcee4721";
const runtime = { session, model: "claude-fixture", version: "2.1.330" };
const init = { type: "system", subtype: "init", session_id: session, model: runtime.model,
  claude_code_version: runtime.version, cwd: "/review", tools: ["Read"], permissionMode: "dontAsk",
  mcp_servers: [], skills: [], slash_commands: [], plugins: [] };
const answer = "REVIEW_PROBE_OK";
const assistant = (content, id) => ({ type: "assistant", session_id: session, message: { id, content } });
const end = { type: "result", subtype: "success", session_id: session, is_error: false,
  num_turns: 1, total_cost_usd: 0.01, permission_denials: [], result: answer };
const proc = (events) => ({ code: 0, signal: null, outcome: "exit", quiescent: true,
  stdout: Buffer.from(events.map(JSON.stringify).join("\n") + "\n") });

test("probe requires matching native runtime, empty tool activity and terminal result", () => {
  assert.equal(auditClaudeStream(proc([init, assistant([{ type: "text", text: answer }]), end]), runtime, [], true), answer);
  assert.throws(() => auditClaudeStream(proc([{ ...init, skills: ["extra"] }, assistant([{ type: "text", text: answer }]), end]), runtime, [], true), /inventory/);
  assert.throws(() => auditClaudeStream(proc([init, end, end]), runtime, [], true), /stream/);
});

test("real stream requires a successful full-file Read for every assignment", () => {
  const use = { type: "tool_use", id: "r1", name: "Read", input: { file_path: "/review/a" }, caller: { type: "direct" } };
  const file = { filePath: "/review/a", content: "truncated is legitimate source text", startLine: 1, numLines: 1, totalLines: 1 };
  const toolResult = { type: "tool_result", tool_use_id: "r1", content: "1\t" + file.content };
  const reply = { type: "user", session_id: session, parent_tool_use_id: null,
    message: { role: "user", content: [toolResult] }, tool_use_result: { type: "text", file } };
  const output = assistant([{ type: "text", text: answer }]);
  const thinking = { type: "thinking", thinking: "fixture", signature: "fixture-signature" };
  const advisory = { type: "system", subtype: "thinking_tokens", session_id: session, estimated_tokens: 12, estimated_tokens_delta: 5 };
  const readRequest = assistant([thinking, use]);
  assert.equal(auditClaudeStream(proc([init, advisory, readRequest, reply, output, end]), runtime, ["a"], false), answer);
  const syntheticReply = { ...reply, isSynthetic: true };
  assert.throws(() => auditClaudeStream(proc([init, advisory, readRequest, syntheticReply, output, end]), runtime, ["a"], false),
    /Unpaired native Read result/);
  const metadata = (patch) => ({ ...reply, tool_use_result: { type: "text", file: { ...file, ...patch } } });
  assert.equal(auditClaudeStream(proc([init, { ...advisory, uuid: session, user_message_uuid: session },
    assistant([{ type: "redacted_thinking", data: "Zml4dHVyZQ==" }, use]), metadata({ totalLines: undefined }), output, end]),
  runtime, ["a"], false), answer);
  for (const events of [
    [init, output, end],
    [init, reply, output, end],
    [init, assistant([use]), { ...reply, tool_use_result: undefined }, output, end],
    [init, assistant([use]), { ...reply, tool_use_result: { ...reply.tool_use_result, type: "image" } }, output, end],
    [init, assistant([use]), { ...reply, message: { content: [toolResult, toolResult] } }, output, end],
    ...[{ filePath: "/review/b" }, { startLine: 2 }, { totalLines: 2 }, { numLines: "1" },
      { truncatedByTokenCap: true }].map((patch) => [init, assistant([use]), metadata(patch), output, end]),
    [init, assistant([{ ...use, caller: { type: "server_tool" } }]), reply, output, end],
    [init, assistant([{ ...thinking, signature: 42 }, use]), reply, output, end],
    [init, { ...advisory, subtype: "unknown" }, assistant([use]), reply, output, end],
    [init, { ...advisory, estimated_tokens_delta: -1 }, assistant([use]), reply, output, end],
    [init, { ...advisory, payload: "extra" }, assistant([use]), reply, output, end],
    [init, assistant([{ ...use, input: { ...use.input, limit: 1 } }]), reply, output, end],
    [init, assistant([use]), { ...reply, message: { content: [{ ...reply.message.content[0], is_error: true }] } }, output, end],
  ]) assert.throws(() => auditClaudeStream(proc(events), runtime, ["a"], false), /Read|coverage|stream|thinking/);
});

test("native stream allows parallel Reads only within the same identified message", () => {
  const read = (id, name) => {
    const filePath = "/review/" + name;
    const file = { filePath, content: "fixture", startLine: 1, numLines: 1, totalLines: 1 };
    return {
      use: { type: "tool_use", id, name: "Read", input: { file_path: filePath } },
      reply: { type: "user", session_id: session,
        message: { content: [{ type: "tool_result", tool_use_id: id, content: "1\tfixture" }] },
        tool_use_result: { type: "text", file } },
    };
  };
  const a = read("read-a", "a");
  const b = read("read-b", "b");
  const readMessageId = "message-reads";
  const request = assistant([a.use], readMessageId);
  const parallel = assistant([b.use], readMessageId);
  const finalBlock = { type: "text", text: answer };
  const output = assistant([finalBlock], "message-final");
  const audit = (events) => auditClaudeStream(proc([init, ...events, end]), runtime, ["a", "b"], false);
  assert.equal(audit([request, parallel, b.reply, a.reply, output]), answer);

  for (const [firstId, nextId] of [[readMessageId, "message-other"], [readMessageId, undefined],
    [readMessageId, ""], [undefined, undefined], ["", ""], [undefined, readMessageId], ["", readMessageId]]) {
    assert.throws(() => audit([assistant([a.use], firstId), assistant([b.use], nextId), b.reply, a.reply, output]),
      /Unexpected native stream assistant turn/);
  }
  assert.throws(() => audit([request, parallel, b.reply, output, a.reply]), /Unexpected native stream assistant turn/);
  const wrongModel = { ...parallel, message: { ...parallel.message, model: "other-model" } };
  assert.throws(() => audit([request, wrongModel, b.reply, a.reply, output]), /Unexpected native stream assistant turn/);

  const reread = assistant([finalBlock, { ...a.use, id: "read-again" }], readMessageId);
  assert.throws(() => audit([request, parallel, b.reply, a.reply, reread]), /Native Read coverage or final stream text mismatch/);
  const duplicate = { ...b.use, id: a.use.id };
  assert.throws(() => audit([request, assistant([duplicate], readMessageId)]), /Unexpected native Read/);
  assert.throws(() => audit([request, a.reply, assistant([duplicate], "message-other")]), /Unexpected native Read/);
  const unassigned = read("read-c", "c");
  assert.throws(() => audit([request, assistant([unassigned.use], readMessageId)]), /Unexpected native Read/);

  const mismatched = { ...b.reply, tool_use_result: a.reply.tool_use_result };
  const partial = { ...b.reply, tool_use_result: { ...b.reply.tool_use_result,
    file: { ...b.reply.tool_use_result.file, totalLines: 2 } } };
  for (const reply of [mismatched, partial]) {
    assert.throws(() => audit([request, parallel, reply, a.reply, output]), /Failed or partial Read result/);
  }
});

test("native stream compares only the final message text in fragment order", () => {
  const earlier = assistant([{ type: "text", text: "Earlier turn" }], "message-earlier");
  const prefix = assistant([{ type: "text", text: "REVIEW_" }, { type: "text", text: "PROBE_" }], "message-final");
  const suffix = assistant([{ type: "text", text: "OK" }], "message-final");
  const audit = (events, result = answer) => auditClaudeStream(proc([init, ...events, { ...end, result }]), runtime, [], true);
  assert.equal(audit([earlier, prefix, suffix]), answer);
  assert.throws(() => audit([earlier, suffix, prefix]), /final stream text mismatch/);
  assert.throws(() => audit([earlier, prefix, suffix], answer + "\n"), /final stream text mismatch/);
  assert.throws(() => audit([earlier, prefix, assistant(suffix.message.content, "message-other")]), /final stream text mismatch/);
});

test("CLI usage rejects a request-selected host override before filesystem reads", () => {
  const executable = new URL("../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-candidate.mjs", import.meta.url);
  const run = spawnSync(process.execPath, [fileURLToPath(executable), "--check", "--command", "fixture"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /CLI option/);
});

import { randomUUID } from "node:crypto";
import { chmod, mkdir, mkdtemp, readFile, realpath, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { hash, jsonBytes, buildExport } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-inputs.mjs";
import { reviewCommand } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-candidate.mjs";
import { containmentArgs, withReviewRuntime } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-runtime.mjs";
import * as relay from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-relay.mjs";

const { readHostKey, credentialValue, relayRequest } = relay;

const startupLabels = ["claude", "Explore", "general-purpose", "Plan", "statusline-setup"];

test("containment retains the exact namespace, mount and Claude controls", () => {
  const argv = containmentArgs({ bwrap: { path: "/host/bwrap" }, node: { path: "/host/node" },
    claude: { path: "/host/claude" }, libraries: [{ path: "/host/library", target: "/lib/libc.so.6" }],
    model: runtime.model, maxTurns: 2, maxBudgetUsd: 1 }, "/export", "/host/inference.sock", runtime);
  const value = (flag) => argv[argv.indexOf(flag) + 1];
  for (const flag of ["--unshare-all", "--unshare-user", "--disable-userns", "--die-with-parent", "--new-session",
    "--clearenv", "--no-session-persistence", "--strict-mcp-config", "--disable-slash-commands", "--no-chrome"]) {
    assert.ok(argv.includes(flag), flag);
  }
  assert.equal(value("--cap-drop"), "ALL");
  assert.ok(!argv.some((flag, i) => flag === "--setenv" && argv[i + 1] === "MAX_THINKING_TOKENS"),
    "containmentArgs must not set MAX_THINKING_TOKENS");
  assert.equal(value("--tmpfs"), "/scratch");
  assert.equal(value("--tools"), "Read");
  assert.equal(value("--allowedTools"), "Read");
  assert.equal(value("--mcp-config"), '{"mcpServers":{}}');
  assert.deepEqual(JSON.parse(value("--settings")), { enabledPlugins: {
    "cc-plugin-sec-default@builtin": false, "cc-plugin-agents-md@builtin": false,
    "cc-plugin-privacy@builtin": false, "cc-plugin-plugin-authoring@builtin": false,
  } });
  assert.deepEqual(argv.flatMap((flag, i) => flag === "--ro-bind" ? [argv.slice(i + 1, i + 3)] : []), [
    ["/export", "/review"], ["/host/inference.sock", "/control/inference.sock"],
    [fileURLToPath(new URL("../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-sandbox-bridge.mjs", import.meta.url)),
      "/control/bridge.mjs"], ["/host/claude", "/control/claude"], ["/host/node", "/control/node"], ["/host/library", "/lib/libc.so.6"],
  ]);
});

test("relay policy admits only the bounded pinned inference request and filtered headers", () => {
  const req = { method: "POST", url: "/v1/messages?beta=true", headers: { "content-type": "application/json",
    "anthropic-beta": "fixture-feature-2026-01-01", "anthropic-version": "ignored", authorization: "ignored", "x-api-key": "ignored" } };
  const base = { model: runtime.model, messages: [], max_tokens: 32000 };
  const body = jsonBytes(base);
  assert.deepEqual(relayRequest(req, body, runtime.model, 1), { "content-type": "application/json",
    "content-length": body.length, "anthropic-version": "2023-06-01", "anthropic-beta": "fixture-feature-2026-01-01" });
  for (const patch of [{ model: "wrong" }, { mcp_servers: [] }, { max_tokens: 64000 }]) {
    assert.throws(() => relayRequest(req, jsonBytes({ ...base, ...patch }), runtime.model, 1), /payload denied/);
  }
  assert.throws(() => relayRequest({ ...req, url: "/v1/models" }, body, runtime.model, 1), /route or quota denied/);
  assert.throws(() => relayRequest({ ...req, headers: { ...req.headers, "anthropic-beta": "invalid;value" } },
    body, runtime.model, 1), /feature header/);
});

test("relay timeout configuration requires a bounded safe integer", () => {
  const config = { socket: "/fixture/inference.sock", keyFile: "/fixture/key", keyFormat: "raw",
    model: runtime.model, requestLimit: 1, socketMode: 0o600 };
  assert.throws(() => relay.validateRelayConfig(config), /configuration schema/);
  for (const timeoutMs of [undefined, null, "1000", 999, 1000.5, 300001, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => relay.validateRelayConfig({ ...config, timeoutMs }), /Invalid host relay configuration/);
  }
  for (const timeoutMs of [1000, 300000]) {
    assert.doesNotThrow(() => relay.validateRelayConfig({ ...config, timeoutMs }));
  }
});

function relayStreams(t, timeoutMs = 240000, blocked = false) {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const upstream = Object.assign(new EventEmitter(), { end() {},
    destroy() { this.destroyed = true; this.emit("close"); } });
  const response = Object.assign(new EventEmitter(), { statusCode: 200, headers: { "content-type": "text/event-stream" },
    destroy() { this.destroyed = true; this.emit("close"); },
    pause() { this.paused = true; }, resume() { this.paused = false; } });
  const chunks = [];
  const res = Object.assign(new EventEmitter(), {
    writeHead(status) { this.status = status; this.headersSent = true; return this; },
    write(chunk) { chunks.push(chunk.toString()); return !blocked; },
    end() { this.ended = true; },
    destroy() { this.destroyed = true; this.emit("close"); },
  });
  relay.forwardInference(upstream, res, Buffer.from("{}"), timeoutMs);
  return { upstream, response, res, chunks, accept: () => upstream.emit("response", response),
    send: (chunk) => response.emit("data", Buffer.from(chunk)), tick: (ms) => t.mock.timers.tick(ms) };
}

test("relay timeout allows healthy streaming past 90 seconds and cleans up after end", (t) => {
  const { upstream, response, res, chunks, accept, send, tick } = relayStreams(t, 240000, true);
  accept();
  tick(80000);
  send("first");
  assert.equal(response.paused, true);
  res.emit("drain");
  assert.equal(response.paused, false);
  tick(80000);
  send("second");
  assert.equal(upstream.destroyed, undefined);
  const [activeErrorHandler] = upstream.listeners("error");
  response.emit("end");
  assert.equal(upstream.listenerCount("error", activeErrorHandler), 0);
  assert.equal(response.listenerCount("error", activeErrorHandler), 0);
  upstream.emit("error", new Error("late request error"));
  response.emit("error", new Error("late response error"));
  tick(240000);
  assert.deepEqual(chunks, ["first", "second"]);
  assert.equal(res.ended, true);
  assert.equal(res.listenerCount("drain"), 0);
  assert.equal(upstream.destroyed, undefined);
  assert.equal(res.destroyed, undefined);
});

test("relay timeout aborts a stalled accepted response after 90 seconds of inactivity", (t) => {
  const { upstream, response, res, accept, send, tick } = relayStreams(t, 240000, true);
  tick(20000);
  accept();
  tick(80000);
  send("first");
  tick(89999);
  assert.equal(res.destroyed, undefined);
  tick(1);
  assert.equal(res.destroyed, true);
  assert.equal(upstream.destroyed, true);
  assert.equal(response.destroyed, true);
  assert.equal(res.listenerCount("drain"), 0);
});

test("relay timeout hard cap starts before response and wins despite continued chunks", (t) => {
  const { upstream, response, res, accept, send, tick } = relayStreams(t, 200000);
  tick(60000);
  accept();
  send("first");
  tick(70000);
  send("second");
  tick(69999);
  send("third");
  assert.equal(res.destroyed, undefined);
  tick(1);
  assert.equal(res.destroyed, true);
  assert.equal(upstream.destroyed, true);
  assert.equal(response.destroyed, true);
});

test("relay timeout watches an accepted response before its first chunk", (t) => {
  const { upstream, response, res, accept, tick } = relayStreams(t);
  accept();
  tick(89999);
  assert.equal(upstream.destroyed, undefined);
  tick(1);
  assert.equal(upstream.destroyed, true);
  assert.equal(response.destroyed, true);
  assert.equal(res.destroyed, true);
});

test("relay timeout caps a request waiting for response headers", (t) => {
  const { upstream, response, res, accept, tick } = relayStreams(t, 1000);
  tick(999);
  assert.equal(upstream.destroyed, undefined);
  tick(1);
  assert.equal(upstream.destroyed, true);
  assert.equal(res.status, 403);
  assert.equal(res.ended, true);
  accept();
  assert.equal(response.destroyed, true);
  upstream.emit("error", new Error("late request error"));
  response.emit("error", new Error("late response error"));
});

test("relay refuses a response that cumulatively exceeds the byte limit", (t) => {
  const { upstream, response, res, chunks, accept, send } = relayStreams(t);
  const halfLimit = 4 * 1024 * 1024;
  accept();
  send(Buffer.alloc(halfLimit, "a"));
  send(Buffer.alloc(halfLimit, "b"));
  assert.deepEqual(chunks.map((chunk) => chunk.length), [halfLimit, halfLimit]);
  assert.equal(res.destroyed, undefined);
  send("c");
  assert.equal(chunks.length, 2);
  assert.equal(res.destroyed, true);
  assert.equal(res.ended, undefined);
  assert.equal(upstream.destroyed, true);
  assert.equal(response.destroyed, true);
});

for (const event of ["downstream close", "upstream error", "response error", "response close"]) {
  test(`relay timeout cleans up a paused response on ${event}`, (t) => {
    const { upstream, response, res, accept, send, tick } = relayStreams(t, 240000, true);
    accept();
    send("first");
    assert.equal(response.paused, true);
    if (event === "downstream close") res.destroy();
    if (event === "upstream error") upstream.emit("error", new Error("fixture"));
    if (event === "response error") response.emit("error", new Error("fixture"));
    if (event === "response close") response.destroy();
    assert.equal(upstream.destroyed, true);
    assert.equal(response.destroyed, true);
    assert.equal(res.destroyed, true);
    assert.equal(res.listenerCount("drain"), 0);
    assert.equal(response.listenerCount("data"), 0);
    tick(240000);
  });
}

test("built-in agent labels are metadata while agent invocation and child turns are denied", () => {
  const startup = { ...init, agents: startupLabels };
  const output = assistant([{ type: "text", text: answer }]);
  assert.equal(auditClaudeStream(proc([startup, output, end]), runtime, [], true), answer);
  const invoke = assistant([{ type: "tool_use", id: "fixture", name: "Agent", input: { file_path: "/review/a" } }]);
  assert.throws(() => auditClaudeStream(proc([startup, invoke, output, end]), runtime, ["a"], false), /Unexpected native Read/);
  assert.throws(() => auditClaudeStream(proc([startup, { ...output, parent_tool_use_id: "fixture" }, end]), runtime, [], true), /identity/);
});

async function scratch(t) {
  const root = await mkdtemp(path.join(tmpdir(), "contained-review-test-"));
  t.after(async () => {
    async function restore(dir) {
      await chmod(dir, 0o700);
      for (const entry of await readdir(dir, { withFileTypes: true })) if (entry.isDirectory()) await restore(path.join(dir, entry.name));
    }
    await restore(root);
    await rm(root, { recursive: true, force: true });
  });
  return root;
}

test("only an explicit literal assignment or dedicated raw key passes the host file contract", async (t) => {
  const root = await scratch(t);
  const key = "sk-" + "ant-" + "fixture".repeat(3);
  const filename = path.join(root, "fixture-assignments");
  const literal = `UNRELATED="fixture"\nexport ANTHROPIC_API_KEY='${key}'\nOTHER=fixture\n`;
  await writeFile(filename, literal, { mode: 0o600 });
  assert.equal(await readHostKey(filename, "assignment"), key);
  await assert.rejects(readHostKey(filename, "raw"), /Unsafe/);
  for (const content of [literal + `ANTHROPIC_API_KEY=${key}\n`, `ANTHROPIC_API_KEY=\$OTHER\n`,
    `ANTHROPIC_API_KEY="${key}"; fixture\n`, `FOO=fixture\\\nANTHROPIC_API_KEY=${key}\n`, key]) {
    assert.throws(() => credentialValue(Buffer.from(content), "assignment"), /Invalid explicit/);
  }
  await writeFile(filename, key);
  await chmod(filename, 0o400);
  assert.equal(await readHostKey(filename, "raw"), key);
  await assert.rejects(readHostKey(filename, "assignment"), /Unsafe/);
});

// This executable only emits synthetic stream events. It cannot invoke Claude or call a relay.
async function fakeHost(root, behavior = "valid") {
  const node = await realpath(process.execPath);
  const launcher = path.join(root, "fixture-launcher-" + behavior);
  await writeFile(launcher, `#!${node}
const fs = require("node:fs");
const args = process.argv.slice(2);
if (args[0] === "--version") { fs.writeSync(1, "bubblewrap 0.9.0\\n"); process.exit(0); }
const arg = (flag) => args[args.indexOf(flag) + 1];
const policy = ["--unshare-all", "--unshare-user", "--disable-userns", "--clearenv", "--remount-ro", "--no-chrome", "--strict-mcp-config",
  "--no-session-persistence", "--disable-slash-commands", "--die-with-parent"];
if (!policy.every((flag) => args.includes(flag)) || arg("--permission-prompts") !== "none" ||
    arg("--tools") !== "Read" || arg("--allowedTools") !== "Read" ||
    args[args.indexOf("CLAUDE_CODE_DISABLE_BUILTIN_PLUGINS") + 1] !== "1") process.exit(31);
const prompt = fs.readFileSync(0, "utf8");
const probe = prompt.includes("REVIEW_PROBE_OK");
const model = arg("--model");
const session_id = arg("--session-id");
const emit = (event) => fs.writeSync(1, JSON.stringify({ ...event, session_id }) + "\\n");
const message = (type, content) => emit({ type, message: { content } });
const behavior = ${JSON.stringify(behavior)};
emit({ type: "system", subtype: "init", model: behavior === "probe-fails" && probe ? "wrong-model" : model,
  claude_code_version: "2.1.330", cwd: "/review", tools: ["Read"], permissionMode: "dontAsk",
  mcp_servers: [], skills: [], slash_commands: [], plugins: [], agents: ${JSON.stringify(startupLabels)} });
const lines = prompt.split("\\n");
const assigned = lines.filter((line) => line.startsWith("/review/"));
if (behavior !== "no-coverage") assigned.forEach((file_path, index) => {
  const id = String(index);
  const root = args[args.indexOf("/review") - 1];
  const content = fs.readFileSync(root + file_path.slice("/review".length), "utf8");
  message("assistant", [{ type: "tool_use", id, name: "Read", input: { file_path } }]);
  const numLines = content ? content.split("\\n").length : 0;
  emit({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: id, content }] },
    tool_use_result: { type: "text", file: { filePath: file_path, content, numLines, startLine: 1, totalLines: numLines } } });
});
const verdict = "Verdict: No findings";
if (!probe && (lines.at(-5) !== "BEGIN_REVIEW_RECEIPT" || lines.at(-1) !== "END_REVIEW_RECEIPT")) process.exit(32);
const input = probe ? null : JSON.parse(lines.at(-2));
const reference = lines.find((line) => line.startsWith("Native reference: "))?.slice(18);
const candidate = input?.target;
const value = candidate
  ? { target: candidate, packet: Number(lines.find((line) => line.startsWith("Packet: ")).split(" ")[1]),
      findings: [], coverageLimitations: [] }
  : { identity: input?.identity, readOnly: true, reference, verdict, findings: [], observations: [],
      coverageLimitations: behavior === "packet-gap" ? [{ class: "packet-gap", detail: "fixture gap" }] : [], ledgerChecks: [] };
if (behavior === "wrong-second-sha" && candidate && value.packet === 2) value.target = "f".repeat(40);
const result = probe ? "REVIEW_PROBE_OK" : behavior === "bad-receipt" || (behavior === "retry" && !reference.includes("retried"))
  ? "malformed fixture receipt" : ["Reviewed the assigned fixture files.", "BEGIN_REVIEW_RECEIPT", verdict,
    candidate ? "Target: " + candidate : "Policy: charter-v1", JSON.stringify(value), "END_REVIEW_RECEIPT"].join("\\n");
message("assistant", [{ type: "text", text: result }]);
emit({ type: "result", subtype: "success", is_error: false, num_turns: 1, total_cost_usd: 0, permission_denials: [], result });
`, { mode: 0o700 });
  const keyFile = path.join(root, "fixture-key");
  await writeFile(keyFile, "EXAMPLE=true\nANTHROPIC_API_KEY=sk-" + "ant-" + "synthetic".repeat(3) + "\n", { mode: 0o600 });
  const pin = async (file) => ({ path: file, sha256: hash(await readFile(file)) });
  const config = { schemaVersion: 1, bwrap: await pin(launcher), node: await pin(launcher), claude: await pin(launcher),
    libraries: [], model: "claude-fixture", relay: { route: "same-uid-key", keyFile, keyFormat: "assignment" },
    timeoutMs: 4000, maxTurns: 16, maxBudgetUsd: 1, requirePreExposureAttestation: false };
  const filename = path.join(root, "fixture-host-" + behavior + ".json");
  await writeFile(filename, jsonBytes(config));
  return { filename, config };
}

test("runtime rejects a group-writable Node pin", async (t) => {
  const root = await scratch(t);
  const { config } = await fakeHost(root);
  const node = path.join(root, "fixture-group-writable-node");
  await writeFile(node, "synthetic Node fixture\n");
  await chmod(node, 0o775);
  assert.equal((await stat(node)).mode & 0o777, 0o775);
  config.node = { path: node, sha256: hash(await readFile(node)) };
  await assert.rejects(withReviewRuntime(config, { parent: root, excluded: [], packetCount: 1 },
    () => assert.fail("Group-writable Node pin reached the runtime callback")), /Unsafe runtime pin/);
});

const cliPath = fileURLToPath(new URL("../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-candidate.mjs", import.meta.url));

test("real same-UID relay child leaves a sealed failed probe and no runtime scratch", async (t) => {
  const root = await scratch(t);
  const host = await fakeHost(root, "probe-fails");
  const output = path.join(root, "failed-probe");
  const run = await new Promise((resolve) => {
    execFile(process.execPath, [cliPath, "--probe", "--host-config", host.filename, "--output", output],
      { timeout: 12000 }, (error, stdout, stderr) => resolve({ error, stdout, stderr }));
  });
  assert.equal(run.error?.code, 1, run.stderr || run.stdout);
  assert.doesNotMatch(run.stderr, /unsettled top-level await/i);
  if (run.stdout) assert.equal(JSON.parse(run.stdout).phase, "probe-failed");
  else assert.match(run.stderr, /Host relay stopped before readiness/);
  const status = path.join(output, "status.json");
  assert.deepEqual(JSON.parse(await readFile(status, "utf8")),
    { schemaVersion: 1, phase: "probe-failed", deliveryAccepted: false });
  assert.equal((await stat(status)).mode & 0o777, 0o400);
  assert.equal((await stat(output)).mode & 0o777, 0o500);
  assert.ok((await readdir(output)).every((name) => !name.startsWith("runtime-")));
});

function invoke(flags, status = 0) {
  const run = spawnSync(process.execPath, [cliPath, ...flags], { encoding: "utf8", timeout: 20000, stdio: ["ignore", "pipe", "pipe"] });
  assert.equal(run.error, undefined);
  assert.equal(run.status, status, run.stderr || run.stdout);
  return run.stdout ? JSON.parse(run.stdout) : run.stderr;
}

// Substitute just the socket boundary in managed sandboxes that disallow local bind.
const launchFixture = (args) => reviewCommand(args, (config, options, callback) =>
  withReviewRuntime(config, options, callback, async (host, runtimeDir) => {
    await readHostKey(host.relay.keyFile, host.relay.keyFormat);
    return { socket: path.join(runtimeDir, "fixture-inference.sock"), close: async () => {} };
  }));

async function fixture(t, mode = "approach", behavior = "valid") {
  const root = await scratch(t);
  const workspace = path.join(root, "workspace");
  const change = "fixture-change";
  const prefix = "openspec/changes/" + change + "/";
  const source = { "openspec/config.yaml": "schema: spec-driven\n", [prefix + ".openspec.yaml"]: "schema: spec-driven\n",
    [prefix + "proposal.md"]: "# Synthetic proposal\n", [prefix + "tasks.md"]: "- [ ] 1.1 Synthetic task\n" };
  for (const [name, value] of Object.entries(source)) {
    const location = path.join(workspace, name);
    await mkdir(path.dirname(location), { recursive: true });
    await writeFile(location, value);
  }
  const host = await fakeHost(root, behavior);
  const output = path.join(root, "output");
  const worker = {
    schemaVersion: 1, identity: { attempt: "attempt-1", predecessor: null, role: mode === "approach" ? "approach-reviewer" : "reviewer",
      change, group: "1", task: "1.1", action: "1.1", workspace, candidate: null, plan: null, planDigest: null,
      inputs: Object.fromEntries(Object.entries(source).map(([name, value]) => [name, hash(value)])),
      implementerSession: mode === "approach" ? null : "fixture-implementer" },
    outcome: "Synthetic review", acceptance: ["Complete review"], scope: ["Fixture"], nonGoals: ["Remote work"],
    authority: { orchestrator: "owner", writer: "owner", authorSession: "author", approvalReference: "fixture-approval", executionReference: "fixture-grant" },
    restrictions: ["no Git writes", "no tasks.md writes", "no profile writes", "no subagents", "no multiplexers", "read-only"],
    budget: { limit: 1, unit: "attempt" }, stop: "Stop on drift", evidenceRoots: [output], requiredEvidence: ["native.txt", "lifecycle.jsonl"], mutablePaths: [],
  };
  const request = { schemaVersion: 1, mode, session: randomUUID(), worker, attachments: {}, limits: { diffBytes: 256 } };
  if (mode === "approach") request.snapshot = { record: { schemaVersion: 1, change, goal: "Synthetic review", passRule: "charter-v1",
    binding: { route: "terminal-adapter", client: "claude-code", model: host.config.model, qualified: true, independent: true, readOnly: true, permissions: ["read"] },
    charter: { clauses: ["scope"], boundaries: ["fixture"], tasks: ["1.1"], gates: ["test"] },
    budget: 2, cumulativeCycles: 0, entries: [], ledger: [] }, correction: null,
    authority: { reference: "fixture-grant", write: true, validate: true, review: true }, priorLaunches: [] };
  return { root, workspace, source, output, host, request };
}

async function prepareFixture(f, name = "first", write = true) {
  const request = path.join(f.root, name + "-request.json");
  const expect = path.join(f.root, name + "-expect.json");
  const directory = path.join(f.root, name + "-export");
  const approval = { schemaVersion: 1, requestSha256: hash(jsonBytes(f.request)), exportSha256: null,
    configurationSha256: hash(jsonBytes(f.host.config)), model: f.host.config.model };
  await writeFile(request, jsonBytes(f.request));
  await writeFile(expect, jsonBytes(approval));
  const flags = ["--request", request, "--expect", expect, "--export", directory];
  if (write) {
    approval.exportSha256 = invoke(["--prepare", ...flags]).exportSha256;
    await writeFile(expect, jsonBytes(approval));
  }
  return { request, expect, export: directory, output: f.output, approval, flags,
    launch: ["--mode", f.request.mode, ...flags, "--output", f.output, "--host-config", f.host.filename] };
}

async function retain(f, launched) {
  f.approval.statusSha256 = launched.statusSha256;
  await writeFile(f.expect, jsonBytes(f.approval));
}

test("probe, approach launch and offline replay exercise every CLI control path with fake processes", async (t) => {
  const f = await fixture(t);
  const standalone = path.join(f.root, "standalone-probe");
  assert.equal((await launchFixture(["--probe", "--host-config", f.host.filename, "--output", standalone])).phase, "probe-passed");
  const a = await prepareFixture(f);
  assert.equal(invoke(["--check", ...a.flags]).packets, 1);
  const launched = await launchFixture(a.launch);
  assert.equal(launched.phase, "complete");
  await retain(a, launched);
  const verify = ["--verify", ...a.flags, "--output", f.output];
  const result = invoke(verify);
  assert.equal(result.approach.action, "freeze-ready");
  assert.equal(result.approach.record.cumulativeCycles, 0);
  assert.equal(result.deliveryAccepted, false);
  assert.equal(result.approach.planApproved, false);
  const raw = path.join(f.output, "raw", "1-stdout.jsonl");
  await chmod(raw, 0o600);
  await writeFile(raw, "mutated synthetic capture");
  await chmod(raw, 0o400);
  assert.match(invoke(verify, 1), /Review stopped/);
  await writeFile(path.join(f.workspace, Object.keys(f.source)[0]), "changed fixture plan");
  assert.match(invoke(["--check", ...a.flags], 1), /identity mismatch/);
});

test("failed probe and incomplete Read coverage never admit a handover", async (t) => {
  for (const [behavior, phase, count] of [["probe-fails", "probe-failed", 3], ["no-coverage", "runtime-failed", 6]]) {
    const f = await fixture(t, "approach", behavior);
    const a = await prepareFixture(f);
    const launched = await launchFixture(a.launch);
    assert.equal(launched.phase, phase);
    assert.equal((await readdir(path.join(f.output, "raw"))).length, count);
    await retain(a, launched);
    assert.equal(invoke(["--verify", ...a.flags, "--output", f.output], 1).result.native, null);
  }
});

test("malformed approach receipt permits one exact zero-cycle retry and a packet gap stays separate", async (t) => {
  const f = await fixture(t, "approach", "retry");
  const a = await prepareFixture(f);
  const invalid = await launchFixture(a.launch);
  assert.equal(invalid.phase, "invalid-receipt");
  await retain(a, invalid);
  f.output = path.join(f.root, "retried");
  f.request.worker.evidenceRoots = [f.output];
  f.request.worker.identity.predecessor = f.request.worker.identity.attempt;
  f.request.worker.identity.attempt = "attempt-2";
  f.request.session = randomUUID();
  const prior = ({ request, expect, export: exported, output }) => ({ request, expect, export: exported, output });
  f.request.snapshot.priorLaunches = [prior(a)];
  const b = await prepareFixture(f, "retry");
  assert.equal(invoke(["--check", ...b.flags]).packets, 1);
  await retain(b, await launchFixture(b.launch));
  assert.equal(invoke(["--verify", ...b.flags, "--output", b.output]).approach.record.cumulativeCycles, 0);
  f.output = path.join(f.root, "third");
  f.request.worker.evidenceRoots = [f.output];
  f.request.worker.identity.predecessor = "attempt-2";
  f.request.worker.identity.attempt = "attempt-3";
  f.request.session = randomUUID();
  f.request.snapshot.priorLaunches = [prior(b)];
  const c = await prepareFixture(f, "third");
  assert.match(invoke(["--check", ...c.flags], 1), /Retry binding/);

  const g = await fixture(t, "approach", "packet-gap");
  const gap = await prepareFixture(g);
  await retain(gap, await launchFixture(gap.launch));
  const observed = invoke(["--verify", ...gap.flags, "--output", gap.output]);
  assert.equal(observed.approach.action, "repair-packet");
  assert.equal(observed.approach.record.cumulativeCycles, 0);
});

async function gitCandidate(t, behavior = "valid") {
  const f = await fixture(t, "candidate", behavior);
  const git = (...args) => {
    const result = spawnSync("/usr/bin/git", ["-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid",
      "-c", "core.hooksPath=/dev/null", ...args], { cwd: f.workspace, encoding: "utf8",
      env: { PATH: "/usr/bin:/bin", HOME: f.root, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null", LC_ALL: "C" } });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  };
  git("init", "-q");
  const changeFiles = ["one.txt", "two.txt"];
  for (const name of changeFiles) await writeFile(path.join(f.workspace, name), "old " + name.repeat(14) + "\n");
  git("add", ".");
  git("commit", "-qm", "fixture planning and baseline");
  const base = git("rev-parse", "HEAD").trim();
  for (const name of changeFiles) await writeFile(path.join(f.workspace, name), "new " + name.repeat(14) + "\n");
  git("add", ".");
  git("commit", "-qm", "fixture implementation");
  const target = git("rev-parse", "HEAD").trim();
  const planBytes = Object.entries(f.source).sort(([a], [b]) => a < b ? -1 : 1).map(([name, value]) =>
    JSON.stringify([name, "100644", Buffer.byteLength(value)]) + "\0" + value + "\0").join("");
  const planDigest = hash(planBytes);
  const diff = (before, after) => git("diff", "--no-color", "--no-ext-diff", "--no-textconv", "--no-relative", "--find-renames=50%",
    "--diff-algorithm=myers", "--no-indent-heuristic", "--patch", "--text", "--full-index", "--unified=3",
    "--src-prefix=a/", "--dst-prefix=b/", before, after, "--");
  await writeFile(path.join(f.workspace, "gate.txt"), "synthetic test passed\n");
  f.request.attachments["gate.txt"] = hash("synthetic test passed\n");
  f.request.limits.diffBytes = 400;
  Object.assign(f.request.worker.identity, { candidate: target, plan: base, planDigest });
  f.request.snapshot = { base, target, plan: base, planDigest, diffSha256: hash(diff(base, target)),
    gates: [{ command: "synthetic test", commit: target, exitCode: 0, evidence: "gate.txt" }] };
  return { ...f, git, diff, base, target, changeFiles };
}

test("candidate subprocess fixtures seal a complete multi-packet run against exact Git objects", async (t) => {
  const f = await gitCandidate(t);
  const { target, changeFiles } = f;
  const packed = await buildExport(f.request);
  assert.equal(packed.manifest.packets.length, 2);
  assert.ok(packed.manifest.packets.every((p) => p.paths.includes("context/gate.txt")));
  assert.deepEqual(packed.manifest.packets.flatMap((p) => p.paths.filter((name) => name.startsWith("target/"))),
    changeFiles.map((name) => "target/" + name));
  const a = await prepareFixture(f);
  await retain(a, await launchFixture(a.launch));
  const verified = invoke(["--verify", ...a.flags, "--output", f.output]);
  assert.equal(verified.result.nativeVerdict, "Verdict: No findings");
  assert.equal(verified.result.identity.candidate, target);
  assert.equal(verified.sessions.length, 3);
  assert.equal(verified.deliveryAccepted, false);
  f.request.snapshot.diffSha256 = "a".repeat(64);
  const wrong = await prepareFixture(f, "wrong", false);
  assert.match(invoke(["--prepare", ...wrong.flags], 1), /diff hash mismatch/);
});

test("candidate seals exact second-packet SHA rejection and replays it without a handover", async (t) => {
  const f = await gitCandidate(t, "wrong-second-sha");
  const a = await prepareFixture(f);
  const packed = await buildExport(f.request);
  const launched = await launchFixture(a.launch);
  assert.equal(launched.phase, "receipt-invalid");
  assert.deepEqual(launched.rejection, { packet: 2, target: f.target,
    packetSha256: hash(jsonBytes(packed.manifest.packets[1])), session: launched.rejection.session });
  assert.notEqual(launched.rejection.session, f.request.session);
  await retain(a, launched);
  const verified = invoke(["--verify", ...a.flags, "--output", f.output], 1);
  assert.deepEqual(verified.rejection, launched.rejection);
  assert.deepEqual(verified.result.rejection, launched.rejection);
  assert.equal(verified.result.mode, "candidate");
  assert.equal(verified.result.status, undefined);
  assert.equal(verified.deliveryAccepted, false);
  const status = JSON.parse(await readFile(path.join(f.output, "status.json"), "utf8"));
  assert.equal(status.count, 3);
  assert.equal(status.captures.length, 9);
  assert.deepEqual(status.rejection, launched.rejection);
  assert.match(await readFile(path.join(f.output, "report.md"), "utf8"), /f{40}/);
  assert.equal((await stat(path.join(f.output, "status.json"))).mode & 0o777, 0o400);
});

async function archivedCandidate(t, variant) {
  const f = await gitCandidate(t);
  const change = f.request.worker.identity.change;
  const active = "openspec/changes/" + change;
  const archive = "openspec/changes/archive/2026-11-23-" + change;
  const file = (p) => path.join(f.workspace, p);
  await writeFile(file(active + "/tasks.md"), "- [x] 1.1 Synthetic task\n");
  await mkdir(file(active + "/evidence"), { recursive: true });
  await writeFile(file(active + "/evidence/verified.txt"), "verified fixture record\n");
  f.git("add", active);
  f.git("commit", "-qm", "fixture verified predecessor with native tick");
  const parent = f.git("rev-parse", "HEAD").trim();
  await mkdir(file("openspec/changes/archive"));
  await rename(file(active), file(archive));
  if (variant === "bytes") await writeFile(file(archive + "/tasks.md"), "- [X] 1.1 Synthetic task\n");
  if (variant === "mode") await chmod(file(archive + "/proposal.md"), 0o755);
  if (variant === "missing") await rm(file(archive + "/evidence/verified.txt"));
  if (variant === "addition") await writeFile(file(archive + "/evidence/extra.json"), "{}\n");
  if (variant === "duplicate") {
    await mkdir(file(active));
    await writeFile(file(active + "/tasks.md"), "- [x] 1.1 Synthetic task\n");
  }
  if (variant === "code") await writeFile(file("one.txt"), "unrelated change\n");
  if (variant === "bad-date") await rename(file(archive), file(archive.replace("11-23", "02-30")));
  if (variant === "authorized-receipt") {
    const relative = archive + "/evidence/closure.json";
    await writeFile(file(relative), "{}\n");
    f.request.attachments[relative] = hash("{}\n");
  }
  f.git("add", "-A", "openspec", "one.txt");
  f.git("commit", "-qm", "fixture record-only closure");
  const target = f.git("rev-parse", "HEAD").trim();
  f.request.worker.identity.candidate = target;
  f.request.snapshot = { ...f.request.snapshot, base: parent, target, diffSha256: hash(f.diff(parent, target)),
    gates: f.request.snapshot.gates.map((gate) => ({ ...gate, commit: target })) };
  f.request.limits.diffBytes = 8192;
  return { ...f, active, archive, target };
}

test("archive closure checks and replays identical bytes and modes in logical planning coordinates", async (t) => {
  const f = await archivedCandidate(t, "authorized-receipt");
  const { manifest, files } = await buildExport(f.request);
  assert.equal(manifest.packets.length, 1);
  assert.equal(files.get("plan/" + f.active + "/tasks.md").toString(), "- [ ] 1.1 Synthetic task\n");
  assert.equal(files.get("target/" + f.archive + "/tasks.md").toString(), "- [x] 1.1 Synthetic task\n");
  const a = await prepareFixture(f);
  assert.equal(invoke(["--check", ...a.flags]).packets, 1);
  await retain(a, await launchFixture(a.launch));
  const verified = invoke(["--verify", ...a.flags, "--output", f.output]);
  assert.equal(verified.result.identity.candidate, f.target);
  assert.equal(verified.result.identity.planDigest, f.request.snapshot.planDigest);
});

test("archive rejects changed bytes or modes, additions, omissions, unsafe dates and out-of-scope changes", async (t) => {
  for (const [variant, message] of [
    ["bytes", /changed or omitted/], ["mode", /changed or omitted/], ["missing", /changed or omitted/],
    ["addition", /Unexpected archive addition/], ["duplicate", /Ambiguous active\/archive/],
    ["code", /record-only diff/], ["bad-date", /Noncanonical archive/],
  ]) {
    const f = await archivedCandidate(t, variant);
    await assert.rejects(buildExport(f.request), message, variant);
  }
});
