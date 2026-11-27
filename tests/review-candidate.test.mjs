import { randomUUID } from "node:crypto";
import { chmod, mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { scratch } from "./item55-review-concurrency.test.mjs?fixtures";
import { hash, jsonBytes, buildExport, prepareExport, checkExport } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-inputs.mjs";
import { spawnSync } from "node:child_process";
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
  assert.match(instructions, /Batch whole-file Read calls/);
  assert.match(instructions, /file_path as the sole argument.*Read exactly these paths/);
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
  assert.match(instructions, /Batch whole-file Read calls/);
  assert.match(instructions, /file_path as the sole argument.*Read exactly these paths/);
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
  return { root, workspace, source, output, request };
}

async function gitCandidate(t, behavior = "valid", concurrency) {
  const f = await fixture(t, "candidate", behavior);
  const git = (...args) => {
    const result = spawnSync("/usr/bin/git", ["-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid",
      "-c", "core.hooksPath=/dev/null", ...args], { cwd: f.workspace, encoding: "utf8",
      env: { PATH: "/usr/bin:/bin", HOME: f.root, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null", LC_ALL: "C" } });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  };
  git("init", "-q");
  const changeFiles = concurrency ? ["one.txt", "six.txt", "ten.txt", "two.txt"] : ["one.txt", "two.txt"];
  if (concurrency) {
    await writeFile(path.join(f.workspace, "AGENTS.md"), "<!-- openspec-low-touch: {} -->\n");
    git("add", "AGENTS.md");
    git("commit", "-qm", "adopt contained review policy");
    const parent = git("rev-parse", "HEAD").trim();
    f.request.policy = { parent, target: parent };
  }
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
  const exported = path.join(f.root, "export");
  const expected = await prepareExport(exported, f.request, null);
  const verified = await checkExport(exported, expected, f.request);
  assert.equal(verified.manifest.requestSha256, hash(jsonBytes(f.request)));
  assert.deepEqual(verified.manifest, manifest);

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
