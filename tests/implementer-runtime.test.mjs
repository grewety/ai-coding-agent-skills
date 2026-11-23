import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { chmod, lstat, mkdir, mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import { hash, jsonBytes } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-inputs.mjs";
import { roleQualificationBinding } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/implementer-bindings.mjs";
import { checkoutStatus, privateCheckoutIdentity } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/worker-runtime-policy.mjs";
import { claimPath, slotPath } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/implementer-claims.mjs";
import { observeImplementer, runImplementers, runtimeIdentity } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/implementer-runtime.mjs";
import { readState } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/implementer-state.mjs";
import { requestBytes, writeClosed } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/worker-handoff.mjs";

const probe = async () => ({ proof: [{ mode: "read-only", quiescent: true }, { mode: "workspace-write", quiescent: true }] });
const change = "synthetic-runtime-01m84dt53xh6x16nwwqebacz8m";
const prefix = "openspec/changes/" + change + "/";
const repository = "github.com/example/runtime";
const gitEnv = { PATH: "/usr/bin:/bin", HOME: "/nonexistent", GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" };
const taskGuidedSource = { "openspec/config.yaml": "schema: spec-driven\n", [prefix + ".openspec.yaml"]: "schema: spec-driven\n",
  [prefix + "proposal.md"]: "# Synthetic plan\n", [prefix + "tasks.md"]: "- [ ] 1.1 First group\n- [ ] 2.1 Dependent group\n" };
const shim = String.raw`#!/usr/bin/python3
import json, os, subprocess, sys, time, uuid
assert sys.argv[1] == "exec" and sys.argv[-1] == "-" and "--ephemeral" in sys.argv
assert "--ignore-user-config" in sys.argv and "--ignore-rules" in sys.argv
assert "--enable" in sys.argv and "skip_host_skill_discovery" in sys.argv
assert {"HOME", "XDG_CONFIG_HOME", "CODEX_HOME"} <= os.environ.keys()
assert "VIRTUAL_ENV" not in os.environ and "PYTHONHOME" not in os.environ and "OPENAI_API_KEY" not in os.environ
fence = chr(96) * 3
assignment = json.loads(sys.stdin.read().split(fence + "json\n", 1)[1].split("\n" + fence, 1)[0])
behavior = assignment["outcome"]
def emit(event_type, **fields):
    print(json.dumps({"type": event_type, **fields}), flush=True)
if behavior == "echo":
    print("done from an unrelated pane", flush=True)
    sys.exit(0)
session = str(uuid.uuid4())
emit("thread.started", thread_id=session)
emit("turn.started")
if behavior == "wait":
    emit("approval.requested", kind="credential", thread_id=session, request_id="fixture-approval")
    time.sleep(30)
if behavior == "late":
    time.sleep(0.75)
if behavior == "recover":
    time.sleep(1.5)
if behavior == "descendant":
    subprocess.Popen(["/usr/bin/python3", "-c", "import os,time; os.setsid(); time.sleep(30)"],
                     stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
if behavior == "git-touch":
    os.utime(".git/index")
if behavior == "tamper":
    with open("outside.txt", "w") as out:
        out.write("synthetic forbidden edit\n")
if behavior == "stdout-quota":
    print("fixture" * 10000, flush=True)
if behavior == "cap":
    emit("item.completed", item={"type": "agent_message", "text": "partial progress"})
    emit("turn.failed", error={"code": "turn_limit"})
    sys.exit(12)
if behavior == "auth":
    emit("error", code="authentication_required", message="synthetic auth")
    sys.exit(2)
if behavior == "false-turn":
    emit("turn.started")
emit("item.completed", item={"type": "agent_message", "text": "Synthetic native result"})
emit("turn.completed", usage={"input_tokens": 1, "output_tokens": 6})
`;

async function fixture(t, label = "first", mode = "task-guided") {
  const source = { ...taskGuidedSource };
  const contract = { schemaVersion: 1, outcome: "valid", scope: ["allowed.txt"],
    invariants: ["Fixture isolation"], nonGoals: ["Publication"], adaptableAssumptions: [],
    acceptance: ["One bounded synthetic result"], gates: [["fixture"]],
    localAuthority: { commits: false, stop: "Stop on drift" }, budgets: { minutes: 1, corrections: 0 } };
  if (mode === "goal-first") {
    const fence = String.fromCharCode(96).repeat(3);
    source[prefix + "proposal.md"] += fence + "openspec-goal-contract\n" + JSON.stringify(contract) + "\n" + fence + "\n";
    source[prefix + "tasks.md"] = "- [ ] 1.1 Fixture local outcome\n";
    source[prefix + "specs/fixture/spec.md"] = "# Fixture scope\n";
  }
  const root = await mkdtemp(path.join(tmpdir(), "worker-runtime-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const dir = (...pieces) => path.join(root, ...pieces);
  const workspace = dir(label);
  const registry = dir("registry");
  const trusted = dir("trusted");
  const evidence = dir("evidence");
  const [home, xdg, codexHome, reviewSlot] = ["worker-home", "worker-xdg", "worker-codex", "review-slot"].map((name) => dir(name));
  await Promise.all([workspace, trusted, evidence, home, xdg, codexHome, reviewSlot].map((name) => mkdir(name, { mode: 0o700 })));
  for (const [name, value] of Object.entries({ ...source, "allowed.txt": "Allowed source\n", "outside.txt": "Read-only control\n" })) {
    await mkdir(path.dirname(path.join(workspace, name)), { recursive: true });
    await writeFile(path.join(workspace, name), value);
  }
  const git = (cwd, ...args) => {
    const result = spawnSync("/usr/bin/git", ["-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", ...args],
      { cwd, env: gitEnv, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  git(workspace, "init", "-q", "-b", "change/runtime");
  git(workspace, "remote", "add", "origin", "git@github.com:Example/Runtime.git");
  git(workspace, "add", ".");
  git(workspace, "commit", "-qm", "fixture baseline");
  const plan = git(workspace, "rev-parse", "HEAD");
  const normalizedPlanDigest = hash(Object.entries(source).sort(([a], [b]) => a < b ? -1 : 1).map(([name, value]) =>
    JSON.stringify([name, "100644", Buffer.byteLength(value)]) + "\0" + value + "\0").join(""));
  const planDigest = mode === "task-guided" ? normalizedPlanDigest : hash(jsonBytes({
    change, policyRevision: plan, contract,
    inputs: Object.fromEntries(Object.entries(source).filter(([name]) =>
      name === "openspec/config.yaml" || name === prefix + ".openspec.yaml" || name.startsWith(prefix + "specs/"))
      .map(([name, value]) => [name, hash(value)])),
  }).subarray(0, -1));
  const locator = async (name, value) => {
    const bytes = jsonBytes(value);
    const location = path.join(trusted, name);
    await writeClosed(location, bytes, true);
    return { path: location, sha256: hash(bytes) };
  };
  const pin = async (name, bytes, mode = 0o400) => {
    const location = path.join(trusted, name);
    await writeFile(location, bytes, { mode });
    return { path: location, sha256: hash(bytes) };
  };
  const runtimeSha256 = await runtimeIdentity();
  // These pins and qualification records are fixtures only. They cannot qualify the candidate.
  const executable = await pin("worker", shim, 0o700);
  const reviewExecutable = await pin("review-bin", "synthetic reviewer pin", 0o700);
  const implementerInventory = [await pin("worker-skill.md", "synthetic worker skill"), await pin("worker-helper.mjs", "synthetic worker helper")];
  const reviewerInventory = [await pin("review-skill.md", "synthetic review skill"), await pin("review-helper.mjs", "synthetic reviewer helper")];
  const reviewerSettings = { schemaVersion: 1, bwrap: reviewExecutable, claude: reviewExecutable, node: reviewExecutable,
    libraries: [], model: "claude-fixture", relay: { route: "same-uid-key", keyFile: dir("synthetic-key"), keyFormat: "raw" },
    timeoutMs: 2000, maxTurns: 8, maxBudgetUsd: 1, requirePreExposureAttestation: false };
  const codexSettings = await locator("codex-settings.json", { schemaVersion: 1, role: "implementer", auth: "dedicated-file",
    disableHostDiscovery: true, permissionMode: "named-workspace-write" });
  const reviewerConfiguration = await locator("review-settings.json", reviewerSettings);
  const initialPair = {
    implementer: { client: "codex", model: "fixture-codex", provider: "openai", version: "0.171.0", route: "codex-native-named-workspace-write",
      configuration: codexSettings, inventory: implementerInventory, slot: codexHome, executable, home, xdg, codexHome },
    reviewer: { client: "claude-code", model: reviewerSettings.model, provider: "anthropic", version: "2.1.330", route: "claude-bubblewrap-read-only",
      configuration: reviewerConfiguration, inventory: reviewerInventory, slot: reviewSlot, session: randomUUID() },
  };
  for (const [name, role] of Object.entries(initialPair)) {
    const { client, route, version, model, provider } = role;
    role.qualification = await locator(name + "-qualification.json", { schemaVersion: 1, kind: "exclusive-runtime-qualification",
      status: "qualified", role: name, client, route, version, model, provider, runtimeSha256,
      bindingSha256: roleQualificationBinding(role), supervisor: name + "-fixture-supervisor",
      configurationSha256: role.configuration.sha256, inventorySha256: hash(jsonBytes(role.inventory)),
      positiveControl: true, deniedPublication: true, protectedPaths: true, settlementVerified: true, inventoryUnchanged: true });
  }
  const issuedAt = Date.now() - 1000;
  const expiresAt = issuedAt + 180000;
  const pair = initialPair;
  const hostValue = { schemaVersion: 1, runtimeSha256, pair, override: null,
    restrictions: { allowedClients: ["codex", "claude-code"], allowedModels: ["fixture-codex", "claude-fixture"],
      allowedProviders: ["openai", "anthropic"], requireDistinctModels: true } };
  const host = await locator("host.json", hostValue);
  const base = { schemaVersion: 1, workspace, change, repository, plan, planDigest, orchestrator: "fixture-owner",
    authorSession: "fixture-author", mode, policyRevision: plan, branch: "refs/heads/change/runtime" };
  const approval = await locator("approval.json", { ...base, kind: mode === "goal-first" ? "exact-goal-approval" : "exact-plan-approval",
    approved: true, approvedAt: issuedAt });
  async function assignment(attempt, outcome = "valid", options = {}) {
    const { task = "1.1", predecessor = null, grant = {}, r = {}, hostPin = host } = options;
    const authority = { orchestrator: base.orchestrator, writer: base.orchestrator, authorSession: base.authorSession,
      approvalReference: approval.path, executionReference: path.join(trusted, attempt + "-grant.json") };
    const request = { schemaVersion: 1, identity: { attempt, predecessor, role: "implementer", change, group: task.split(".")[0],
      task, action: task, workspace, plan, planDigest, candidate: null, implementerSession: null,
      inputs: Object.fromEntries(Object.entries(source).map(([name, value]) => [name, hash(value)])) },
    outcome, acceptance: ["One bounded synthetic result"], scope: ["Fixture only"], nonGoals: ["Publication"],
    authority, restrictions: ["no Git writes", "no tasks.md writes", "no profile writes", "no subagents", "no multiplexers"],
    budget: { limit: 1, unit: "minutes" }, stop: "Stop on drift", evidenceRoots: [path.join(evidence, attempt)],
    requiredEvidence: ["native.txt", "lifecycle.jsonl", "stdout.jsonl", "stderr.log", "launch.json"], mutablePaths: ["allowed.txt"],
    ...r };
    const inference = await locator(attempt + "-inference.json", { schemaVersion: 1, kind: "worker-inference-authority",
      attempt, requestSha256: hash(requestBytes(request)), hostSha256: hostPin.sha256, orchestrator: base.orchestrator,
      maxRuns: 1, expiresAt: grant.expiresAt ?? expiresAt });
    const execution = await locator(attempt + "-grant.json", {
      ...base, kind: "local-execution-grant", localOnly: true, checkoutIdentity: await privateCheckoutIdentity(workspace),
      approvalSha256: approval.sha256, hostSha256: hostPin.sha256, requestSha256: hash(requestBytes(request)),
      head: plan, eligibleTasks: mode === "goal-first" ? ["1.1"] : ["1.1", "2.1"], accepted: [], knownWorkspaces: [],
      ...(mode === "goal-first" ? { normalizedPlanDigest } : {}),
      mutablePaths: request.mutablePaths, restrictions: request.restrictions, stop: request.stop,
      limits: { timeoutMs: 3000, stdoutBytes: 16384, stderrBytes: 16384, maxTurns: 1,
        totalMs: 180000, groupMs: mode === "task-guided" ? 120000 : 60000, corrections: mode === "task-guided" ? 2 : 0,
        batchSize: 4, ...grant.limits },
      issuedAt, expiresAt, overrideSha256: null, continuation: null, inference, ...Object.fromEntries(Object.entries(grant).filter(([key]) => key !== "limits")),
    });
    return { request, approval, grant: execution, host: hostPin };
  }
  return { dir, registry, workspace, evidence, pair, hostValue, host, locator, git, plan, planDigest, assignment, expiresAt };
}

const run = (f, entries, extra = {}) => runImplementers(entries, { registry: f.registry, runProbe: probe, ...extra });
const attemptDirectory = (f, attempt) => path.join(claimPath(f.registry, repository, change), "attempt-" + attempt);
const resultPath = (f, name) => path.join(f.evidence, name, "result.json");

test("sealed completion, immutable recovery and explicit slot/claim retirement", async (t) => {
  const f = await fixture(t);
  const entry = await f.assignment("original");
  const phases = [];
  const [result] = await run(f, [entry], { emit: ({ phase }) => phases.push(phase) });
  assert.equal(result.phase, "completed", result.reason);
  assert.deepEqual(result.result.outputs, {});
  assert.equal(result.result.runtime.provider, "openai");
  assert.notEqual(result.result.runtime.session, f.pair.reviewer.session);
  assert.ok(phases.includes("supervisor-armed"));
  assert.equal((await lstat(resultPath(f, "original"))).mode & 0o777, 0o400);
  assert.equal((await observeImplementer(entry, { registry: f.registry })).phase, "settled");
  const replay = await observeImplementer(entry, { registry: f.registry, action: "recover" });
  assert.deepEqual(replay.result, result.result);
  assert.equal(checkoutStatus(f.workspace), "");
  const launch = await readState(attemptDirectory(f, "original"), "launch.json");
  const releaseFor = (action, label) => f.locator(label, { schemaVersion: 1, kind: "exclusive-runtime-release",
    action, claimId: launch.claimId, change, attempt: "original", settlementSha256: result.settlementSha256,
    orchestrator: entry.request.authority.orchestrator, quiescent: true, falloutVerified: true, assignmentClosed: true });
  const stop = (action, release) => observeImplementer(entry, { registry: f.registry, action, release });
  assert.equal((await stop("release-claim", await releaseFor("release-claim", "premature.json"))).phase, "blocked");
  const slotRelease = await stop("release-slot", await releaseFor("release-slot", "slot-release.json"));
  assert.equal(slotRelease.phase, "slot-released", slotRelease.reason);
  await assert.rejects(lstat(slotPath(f.registry, launch.slot)), { code: "ENOENT" });
  assert.equal((await stop("release-claim", await releaseFor("release-claim", "assignment-release.json"))).phase, "claim-released");
  await assert.rejects(lstat(claimPath(f.registry, repository, change)), { code: "ENOENT" });
});

test("native cap remains separate and permits at most one retained, verified same-action continuation", async (t) => {
  const f = await fixture(t);
  const initial = await f.assignment("cap1", "cap");
  const [first] = await run(f, [initial]);
  assert.equal(first.phase, "capped", first.reason);
  assert.equal(first.reason, "native-turn-cap");
  async function releaseAndContinuation(entry, result, next) {
    const name = entry.request.identity.attempt;
    const attempt = await readState(attemptDirectory(f, name), "launch.json");
    const publication = await readState(attemptDirectory(f, name), "publication.json");
    const release = await f.locator(name + "-release.json", { schemaVersion: 1, kind: "exclusive-runtime-release", action: "release-slot",
      change, attempt: name, claimId: attempt.claimId, settlementSha256: result.settlementSha256,
      orchestrator: entry.request.authority.orchestrator, quiescent: true, falloutVerified: true });
    assert.equal((await observeImplementer(entry, { registry: f.registry, action: "release-slot", release })).phase, "slot-released");
    return f.locator(name + "-continue.json", { schemaVersion: 1, kind: "exclusive-runtime-continuation", change,
      plan: f.plan, planDigest: f.planDigest, previousAttempt: name, attempt: next, task: "1.1",
      orchestrator: entry.request.authority.orchestrator, priorResultSha256: publication.resultSha256,
      priorSettlementSha256: result.settlementSha256, reason: "native-turn-cap", verifiedProgress: true, progressSha256: publication.nativeSha256 });
  }
  const nextHost = (name) => f.locator(name + "-host.json", { ...f.hostValue,
    pair: { ...f.pair, reviewer: { ...f.pair.reviewer, session: randomUUID() } } });
  const second = await f.assignment("cap2", "cap", { predecessor: "cap1", hostPin: await nextHost("cap2"),
    grant: { continuation: await releaseAndContinuation(initial, first, "cap2") } });
  const [secondResult] = await run(f, [second]);
  assert.equal(secondResult.phase, "capped", secondResult.reason);
  const third = await f.assignment("cap3", "valid", { predecessor: "cap2", hostPin: await nextHost("cap3"),
    grant: { continuation: await releaseAndContinuation(second, secondResult, "cap3") } });
  const [thirdResult] = await run(f, [third]);
  assert.equal(thirdResult.phase, "blocked");
  assert.match(thirdResult.reason, /cap allowance/);
  await assert.rejects(lstat(resultPath(f, "cap3")), { code: "ENOENT" });
});

test("recovery observes the original native wait, cancels it with the matching supervisor, and keeps the slot", async (t) => {
  const f = await fixture(t);
  const entry = await f.assignment("waiting", "wait");
  let waiter;
  const ready = new Promise((resolve) => { waiter = resolve; });
  const foreground = run(f, [entry], { emit: ({ phase }) => { if (phase === "operator-input") waiter(); } });
  await Promise.race([ready, foreground.then(([result]) => assert.fail(JSON.stringify(result)))]);
  const observed = await observeImplementer(entry, { registry: f.registry });
  assert.equal(observed.phase, "operator-input");
  assert.equal(observed.kind, "credential");
  assert.equal((await observeImplementer(entry, { registry: f.registry, action: "cancel" })).phase, "cancellation-requested");
  const [closed] = await foreground;
  assert.equal(closed.phase, "stopped", closed.reason);
  assert.equal(closed.reason, "cancelled");
  assert.equal(closed.quiescent, true);
  const launch = await readState(attemptDirectory(f, "waiting"), "launch.json");
  assert.ok((await lstat(slotPath(f.registry, launch.slot))).isDirectory());
  assert.equal((await observeImplementer(entry, { registry: f.registry, action: "cancel" })).phase, "blocked");
});

test("raw echoes, surviving descendants, native failures, quota and out-of-scope files never admit completion", async (t) => {
  for (const [behavior, phase, reason] of [
    ["echo", "blocked", /missing-or-conflicting-native-session/],
    ["descendant", "stopped", /surviving-descendants/],
    ["tamper", "blocked", /out-of-scope/],
    ["git-touch", "blocked", /protected Git metadata/],
    ["auth", "blocked", /dedicated-authentication/],
    ["stdout-quota", "stopped", /stdout-quota/],
    ["false-turn", "stopped", /supervisor-turn-limit/],
  ]) {
    const f = await fixture(t);
    const entry = await f.assignment(behavior, behavior);
    const [result] = await run(f, [entry]);
    assert.equal(result.phase, phase, JSON.stringify(result));
    assert.match(result.reason, reason);
    if (["echo", "tamper", "git-touch"].includes(behavior)) await assert.rejects(lstat(resultPath(f, behavior)), { code: "ENOENT" });
    else assert.equal(result.result.status, phase);
  }
});

test("recovery can validate a late result once and refuses a substituted result", async (t) => {
  const f = await fixture(t);
  const entry = await f.assignment("late", "late");
  const [result] = await run(f, [entry]);
  assert.equal(result.phase, "completed", result.reason);
  const attempt = attemptDirectory(f, "late");
  await unlink(path.join(attempt, "publication.json")); // Recreate the publication/readback crash boundary.
  const recovered = await observeImplementer(entry, { registry: f.registry, action: "recover" });
  assert.deepEqual(recovered.result, result.result);
  const filename = resultPath(f, "late");
  const changed = { ...result.result, requestSha256: "0".repeat(64) };
  await chmod(filename, 0o600);
  await writeFile(filename, jsonBytes(changed));
  await chmod(filename, 0o400);
  assert.equal((await observeImplementer(entry, { registry: f.registry, action: "recover" })).phase, "blocked");
});

test("wrong order, changed scope and unapproved role override stop before native preflight", async (t) => {
  for (const behavior of ["order", "scope", "override", "unsafe", "expired", "inference"]) {
    const f = await fixture(t);
    let options;
    if (behavior === "order") options = { task: "2.1" };
    if (behavior === "scope") options = { grant: { mutablePaths: ["outside.txt"] } };
    if (behavior === "expired") options = { grant: { expiresAt: Date.now() - 1 } };
    if (behavior === "inference") options = { grant: { inference: await f.locator("wrong-inference.json", {}) } };
    if (behavior === "unsafe") options = { r: { mutablePaths: ["../outside"] } };
    if (behavior === "override") {
      const hostPin = await f.locator("override.json", { ...f.hostValue, override: { attempt: "override",
        expiresAt: f.expiresAt, pair: f.pair } });
      options = { hostPin };
    }
    const entry = await f.assignment(behavior, "valid", options);
    const [result] = await run(f, [entry], { runProbe: () => assert.fail("unadmitted run reached the sandbox") });
    assert.equal(result.phase, "blocked", JSON.stringify(result));
    assert.doesNotMatch(result.reason, /unadmitted run reached/);
    await assert.rejects(lstat(resultPath(f, behavior)), { code: "ENOENT" });
  }
});

test("approved paired override and separately mapped conflicting batch entries", async (t) => {
  const f = await fixture(t);
  const override = { attempt: "override", expiresAt: f.expiresAt, pair: f.pair };
  const hostPin = await f.locator("valid-override.json", { ...f.hostValue, override });
  const entries = [await f.assignment("override", "valid", { hostPin, grant: { overrideSha256: hash(jsonBytes(override)) } }),
    await f.assignment("conflict")];
  const results = await run(f, entries);
  assert.deepEqual(results.map((item) => item.attempt), ["override", "conflict"]);
  assert.deepEqual(results.map((item) => item.phase).sort(), ["completed", "occupied"], JSON.stringify(results));
  if (results[0].result) assert.equal(results[0].result.runtime.configurationSource, "per-run-override");
});

test("bounded foreground run rejects out-of-budget turns, stream limits and ambiguous mapping", async (t) => {
  const f = await fixture(t);
  const entry = await f.assignment("over", "valid", { grant: { limits: { maxTurns: 500, stdoutBytes: 9000000 } } });
  const [result] = await run(f, [entry]);
  assert.equal(result.phase, "blocked");
  assert.match(result.reason, /finite wall-clock/);
  await assert.rejects(run(f, [entry, entry]), /mapping is ambiguous/);
});

test("a killed foreground launcher leaves an original supervisor that can publish one late handover on recovery", async (t) => {
  const f = await fixture(t);
  const entry = await f.assignment("recovery", "recover");
  const runtime = new URL("../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/implementer-runtime.mjs", import.meta.url).href;
  const childCode = `
import { writeSync } from "node:fs";
import { runImplementers } from ${JSON.stringify(runtime)};
const [serialized, registry] = process.argv.slice(1);
await runImplementers([JSON.parse(serialized)], {
  registry, runProbe: async () => ({ proof: [] }),
  emit: ({ phase }) => { if (phase === "running") writeSync(1, "ready"); },
});
`;
  const child = spawn(process.execPath, ["--input-type=module", "-e", childCode, JSON.stringify(entry), f.registry],
    { stdio: ["ignore", "pipe", "pipe"] });
  const exited = once(child, "exit");
  let timer;
  try {
    const ready = await Promise.race([once(child.stdout, "data").then(([value]) => value.toString()),
      exited.then(() => "early exit"),
      new Promise((resolve) => { timer = setTimeout(() => resolve("startup timeout"), 5000); })]);
    assert.equal(ready, "ready");
  } finally {
    clearTimeout(timer);
    child.kill("SIGKILL");
    await exited;
  }
  await assert.rejects(lstat(resultPath(f, "recovery")), { code: "ENOENT" });
  const early = await observeImplementer(entry, { registry: f.registry, action: "recover" });
  assert.equal(early.phase, "running", early.reason);
  const deadline = Date.now() + 4500;
  let value;
  do {
    value = await observeImplementer(entry, { registry: f.registry, action: "recover" });
    if (value.phase === "completed" || value.phase === "blocked") break;
    await delay(100);
  } while (Date.now() < deadline);
  assert.equal(value.phase, "completed", value.reason);
  assert.equal(value.result.runtime.session, early.session);
  const replay = await observeImplementer(entry, { registry: f.registry, action: "recover" });
  assert.deepEqual(replay.result, value.result);
});

test("independent repositories keep independent foreground batch results", async (t) => {
  const first = await fixture(t, "one");
  const second = await fixture(t, "two");
  const entryOne = await first.assignment("first");
  const entryTwo = await second.assignment("second");
  // Move the second repository and its approval to a distinct normalized origin for this fixture.
  const other = "github.com/fixture/other";
  second.git(second.workspace, "remote", "set-url", "origin", "https://" + other + ".git");
  const approvalValue = JSON.parse(await readFile(entryTwo.approval.path, "utf8"));
  entryTwo.approval = await second.locator("other-approval.json", { ...approvalValue, repository: other });
  const grantValue = JSON.parse(await readFile(entryTwo.grant.path, "utf8"));
  entryTwo.request.authority.approvalReference = entryTwo.approval.path;
  entryTwo.request.authority.executionReference = path.join(second.dir("trusted"), "other-grant.json");
  const requestSha256 = hash(requestBytes(entryTwo.request));
  const otherInference = JSON.parse(await readFile(grantValue.inference.path, "utf8"));
  const inference = await second.locator("other-inference.json", { ...otherInference, requestSha256 });
  entryTwo.grant = await second.locator("other-grant.json", {
    ...grantValue, repository: other, approvalSha256: entryTwo.approval.sha256, requestSha256, inference,
  });
  const results = await run(first, [entryOne, entryTwo]);
  assert.deepEqual(results.map(({ attempt, phase }) => [attempt, phase]), [["first", "completed"], ["second", "completed"]],
    JSON.stringify(results.map(({ phase, reason }) => ({ phase, reason }))));
  assert.notEqual(results[0].result.runtime.session, results[1].result.runtime.session);
});

test("Goal-First binds its sole native outcome and governed contract independently of the normalized Git plan", async (t) => {
  const good = await fixture(t, "goal", "goal-first");
  const [completed] = await run(good, [await good.assignment("goal")]);
  assert.equal(completed.phase, "completed", completed.reason);
  const drifted = await fixture(t, "drifted", "goal-first");
  const [blocked] = await run(drifted, [await drifted.assignment("drifted", "another outcome")]);
  assert.equal(blocked.phase, "blocked");
  assert.match(blocked.reason, /Goal Contract digest or invocation changed/);
});
