import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { directAdapter, directReviewHost, installedReviewer, invocation } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-direct-adapters.mjs";
import { sanitizeNative } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-direct-receipt.mjs";
import { superviseReview, supervisorCommand } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-direct-supervisor.mjs";
import { jsonBytes } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-inputs.mjs";
import { directFixture, session, windowsDescendant } from "./review-direct-fixture.mjs";

const cli = fileURLToPath(new URL("../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-candidate.mjs", import.meta.url));
const clients = { claude: "--print", codex: "exec", grok: "--single", pi: "--no-session",
  hermes: "--oneshot", opencode: "run", kilo: "run", agy: "--input-format" };
const reasoning = { claude: ["--effort", "xhigh"], codex: ["-c", 'model_reasoning_effort="high"'], grok: ["--effort", "high"],
  pi: ["--thinking", "max"], opencode: ["--model", "openai/model#high"], kilo: ["--variant", "high"], agy: ["--effort", "high"] };

function runFixture(f, ...args) {
  const offlinePath = process.platform === "win32" ? f.gitDirs : f.file("empty-path");
  const env = args[0] === "--verify" ? { ...f.env, PATH: offlinePath } : f.env;
  const result = spawnSync(process.execPath, [cli, ...args], { env, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8", timeout: 120000 });
  if (!result.stdout && result.status === 1) return { error: result.stderr };
  assert.ok(result.stdout, result.stderr || result.error?.message);
  return JSON.parse(result.stdout);
}

async function prepareFixture(f) {
  const prep = runFixture(f, "--prepare", ...f.flags, ...f.hostFlags);
  assert.match(prep.runtime?.supervisor.executableSha256 ?? "", /^[a-f0-9]{64}$/, JSON.stringify(prep));
  Object.assign(f.expect, prep);
  await writeFile(f.file("expect.json"), jsonBytes(f.expect));
  return prep;
}

async function replayFixture(f, phase) {
  const launch = runFixture(f, "--mode", f.request.mode, ...f.flags, ...f.hostFlags, ...f.admissionFlags, ...f.evidenceFlags);
  assert.equal(launch.phase, phase, JSON.stringify(launch));
  f.expect.statusSha256 = launch.statusSha256;
  await writeFile(f.file("expect.json"), jsonBytes(f.expect));
  const verified = runFixture(f, "--verify", ...f.flags, ...f.evidenceFlags);
  assert.equal(verified.phase, phase);
  assert.equal(verified.deliveryAccepted, false);
  return { launch, verified };
}

test("Windows Git rechecks changed PATH, SystemRoot and workspace exclusions", { skip: process.platform !== "win32" }, async (t) => {
  const f = await directFixture(t);
  const helper = new URL("../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-inputs.mjs", import.meta.url);
  const result = spawnSync(process.execPath, ["--input-type=module", "--eval", `
    import assert from "node:assert/strict";
    import { copyFileSync } from "node:fs";
    import path from "node:path";
    import { git } from ${JSON.stringify(helper.href)};

    const [workspace, gitDirectory, launcher, candidate] = process.argv.slice(1);
    const searchPath = [workspace, gitDirectory].join(path.delimiter);
    const systemRoot = process.env.SystemRoot;
    const readHead = () => assert.equal(git(workspace, "rev-parse", "HEAD").toString().trim(), candidate);
    process.env.PATH = searchPath;
    readHead();
    readHead();
    assert.throws(() => git(gitDirectory, "--version"), /Git identity/);

    readHead();
    process.env.SystemRoot = path.join(workspace, "missing-system-root");
    assert.throws(readHead, /Git identity/);
    process.env.SystemRoot = systemRoot;

    readHead();
    process.env.PATH = workspace;
    assert.throws(readHead, /Git identity/);
    process.env.PATH = searchPath;

    readHead();
    copyFileSync(launcher, path.join(workspace, "git.exe"));
    assert.throws(readHead, /Git identity/);
  `, f.workspace, f.gitDirs, f.file("bin/claude.exe"), f.request.snapshot.target], {
    env: f.env, encoding: "utf8", windowsHide: true, timeout: 120000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
});

test("all native adapters bind the exact configured model and request fresh sessions", () => {
  for (const [client, flag] of Object.entries(clients)) {
    const adapter = directAdapter({ client, model: "test-provider/model" }, session, 1);
    assert.ok(adapter.args.includes(flag));
    assert.ok(adapter.args.includes("test-provider/model"));
    assert.ok(adapter.args.every((arg) => !["--resume", "--continue", "--always-approve", "--yolo"].includes(arg)));
  }
  for (const [client, [flag, value]] of Object.entries(reasoning)) {
    const reasoningEffort = ["claude", "pi"].includes(client) ? value : "high";
    const { args } = directAdapter({ client, model: "openai/model", reasoningEffort }, session, 1);
    assert.ok(args.some((arg, index) => arg === flag && args[index + 1] === value), client);
  }
  assert.throws(() => directAdapter({ client: "kilo", model: "provider/model", reasoningEffort: "invalid variant" }, session, 1), /Unsupported/);
  assert.throws(() => directAdapter({ client: "hermes", model: "provider/model", reasoningEffort: "high" }, session, 1), /Unsupported.*hermes/);
  assert.throws(() => installedReviewer({ client: "hermes" }, []), /independently owned gateway/);
  assert.equal(directReviewHost({ schemaVersion: 3, reviewer: { client: "pi", model: "model" }, maxBudgetUsd: 1 }).timeoutMs, 300000);
  assert.equal(directReviewHost({ schemaVersion: 3, reviewer: { client: "pi", model: "model", timeoutMs: 600000 }, maxBudgetUsd: 1 }).timeoutMs, 600000);
  assert.throws(() => directReviewHost({ schemaVersion: 3, reviewer: { client: "pi", model: "model", timeoutMs: 600001 }, maxBudgetUsd: 1 }), /timeoutMs/);
});

test("native process passes each adapter argument form and prompt without shell interpretation", async (t) => {
  const f = await directFixture(t);
  const python = supervisorCommand();
  const files = new Map([["target/file.txt", Buffer.from("benign fixture data")]]);
  for (const client of Object.keys(clients)) {
    const config = directReviewHost({ schemaVersion: 3, reviewer: { client, model: "openai/model" }, maxBudgetUsd: 1 });
    const prompt = 'Literal fixture prompt $HOME & "quoted" \\ é';
    const command = invocation({ config, executable: process.execPath, session, prompt,
      files, cwd: f.workspace, promptFile: f.file("prompt with spaces.txt"), env: { ...f.env, GROK_HOME: "ambient-ignored" } });
    if (command.attachment) await writeFile(f.file("prompt with spaces.txt"), command.attachment);
    for (const [name, value] of Object.entries(command.config ?? {})) {
      const file = path.join(command.home, name);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, jsonBytes(value));
    }
    const args = ["-e", `const f = require('node:fs'); const args = process.argv.slice(1);
      const fileArgument = (flag) => args.includes(flag) ? f.readFileSync(args[args.indexOf(flag) + 1], 'utf8') : null;
      f.writeSync(1, JSON.stringify({args, input: f.readFileSync(0, 'utf8'), file: fileArgument('--file'), settings: fileArgument('--settings')}));`,
      "--", ...command.args];
    const captured = await superviseReview(python, { ...command, args }, { cwd: f.workspace, timeoutMs: 3000 });
    assert.equal(captured.quiescent, true, client);
    assert.equal(captured.outcome, "exit", client);
    const actual = JSON.parse(captured.stdout);
    assert.deepEqual(actual.args, command.args, client);
    assert.equal(actual.input, command.input, client);
    assert.equal(actual.file, command.attachment ?? null, client);
    if (client === "agy") assert.equal(JSON.parse(actual.settings).toolPermission, "strict");
    if (client === "grok") assert.equal(command.args.at(-1), prompt);
    if (client === "kilo") assert.equal(command.env.KILO_NO_DAEMON, "1");
  }
});

test("native supervisor captures success, settles timeout, and rejects descendants surviving the leader", async (t) => {
  const f = await directFixture(t);
  const python = supervisorCommand();
  const run = (code, timeoutMs) => superviseReview(python, { executable: process.execPath,
    args: ["-e", code], env: f.env, input: "" }, { cwd: f.root, timeoutMs });
  const clean = await run("console.log('fixture')", 2000);
  assert.equal(clean.outcome, "exit");
  assert.equal(clean.quiescent, true);
  assert.equal(clean.stdout.toString().trim(), "fixture");
  const timeout = await run("require('node:fs').writeSync(1, Buffer.alloc(131072, 120)); setInterval(() => {}, 100)", 1000);
  assert.equal(timeout.outcome, "timeout");
  assert.equal(timeout.quiescent, true);
  assert.equal(timeout.stdout.length, 131072);
  if (process.platform === "win32") {
    assert.equal(typeof timeout.code, "number");
    const runPython = (code) => superviseReview(python, { executable: python,
      args: ["-I", "-B", "-c", code], env: f.env, input: "" }, { cwd: f.root, timeoutMs: 3000 });
    for (let i = 0; i < 12; i += 1) {
      const ordinary = await runPython("print('ordinary-exit')");
      assert.equal(ordinary.outcome, "exit", `rapid exit ${i + 1}`);
      assert.equal(ordinary.quiescent, true);
      assert.equal(ordinary.code, 0);
      assert.equal(ordinary.stdout.toString().trim(), "ordinary-exit");
    }
    const descendant = await runPython(windowsDescendant);
    assert.equal(descendant.outcome, "surviving-descendants");
    assert.equal(descendant.quiescent, true);
    assert.equal(descendant.code, 0);
    assert.equal(descendant.stdout.toString().trim(), "child-ready");
    return;
  }
  const realChild = `const {spawn} = require("node:child_process");
    const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 100)"],
      { detached: ${process.platform === "linux"}, stdio: "ignore" });
    child.unref();`;
  const descendant = await run(realChild, 2000);
  assert.equal(descendant.outcome, "surviving-descendants");
  assert.equal(descendant.quiescent, true);
});

test("native settlement waits for a late leader and drains pipes within separate bounds", () => {
  const helper = fileURLToPath(new URL("../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-direct-supervisor.py", import.meta.url));
  const result = spawnSync(supervisorCommand(), ["-I", "-B", "-c", `
import runpy, subprocess, sys
settle = runpy.run_path(sys.argv[1])["settle"]
class Worker:
    code = None
    def wait(self, timeout):
        assert timeout == 2
        raise subprocess.TimeoutExpired("fixture", timeout)
    def poll(self):
        return self.code
class Pipe:
    def __init__(self, worker, drained):
        self.worker, self.drained = worker, drained
    def join(self, timeout):
        assert 0 < timeout <= 2
        self.worker.code = 1
    def is_alive(self):
        return not self.drained
for drained in [True, False]:
    worker = Worker()
    assert settle(worker, lambda _: False, [Pipe(worker, drained)]) == (1, drained)
`, helper], { encoding: "utf8", timeout: 10000 });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
});

test("Antigravity, Pi and standalone JSON formats require a settled single answer and reject tool actions", () => {
  const cwd = path.resolve("fixture-workspace");
  const launch = { session, runtime: { model: "fixture/model" } };
  const project = (format, events) => sanitizeNative({ stdout: Buffer.concat(events.map(jsonBytes)), format, cwd, launch, redactions: [], files: new Map() });
  const agy = [
    { event: "init", conversation_id: session, init: { cwd, model: launch.runtime.model, permission_mode: "strict", tools: ["run_command"] } },
    { event: "step_update", step_update: { conversation_id: session, step_type: "agent_response", state: "DONE", text_delta: "Fixture answer" } },
    { event: "result", result: { conversation_id: session, status: "SUCCESS", num_turns: 1, response: "Fixture answer" } },
  ];
  assert.match(project("agy-json", agy).toString(), /"permission_mode":"strict"/);
  assert.throws(() => project("agy-json", [{ ...agy[0], init: { ...agy[0].init, permission_mode: "request-review" } }, ...agy.slice(1)]), /Antigravity/);
  assert.throws(() => project("agy-json", [agy[0], { ...agy[1], step_update: { ...agy[1].step_update, step_type: "tool" } }, agy[2]]), /Antigravity/);
  const pi = [
    { type: "session", id: session, cwd }, { type: "agent_start" },
    { type: "message_end", message: { role: "assistant", model: "model", provider: "fixture", stopReason: "stop", content: [{ type: "text", text: "Fixture answer" }] } },
    { type: "agent_settled", aborted: false },
  ];
  assert.match(project("pi-json", pi).toString(), /Fixture answer/);
  assert.throws(() => project("pi-json", [pi[0], { type: "tool_execution_start" }, ...pi.slice(2)]), /Pi/);
  assert.throws(() => project("pi-json", pi.slice(0, -1)), /Pi/);
  const standalone = [
    { type: "step_start", sessionID: session },
    { type: "text", sessionID: session, part: { messageID: "assistant", text: "Fixture answer" } },
    { type: "step_finish", sessionID: session, part: { messageID: "assistant", reason: "stop" } },
  ];
  assert.match(project("opencode-json", standalone).toString(), /Fixture answer/);
  assert.throws(() => project("opencode-json", [standalone[0], { type: "tool_use", sessionID: session }, ...standalone.slice(1)]), /OpenCode or Kilo/);
  assert.throws(() => project("opencode-json", [standalone[0], standalone[1], { ...standalone[2], part: { messageID: "another", reason: "stop" } }]), /OpenCode or Kilo/);
});

for (const [behavior, phase] of [["ok", "complete"], ["duplicate", "receipt-invalid"],
  ["checkout", "integrity-failed"], ["packet", "integrity-failed"], ["descendant", "surviving-descendants"],
  ["bare", "receipt-invalid"], ["partial", "invalid-native-output"], ["rate-limited", "upstream-rate-limited"]]) {
  test("native synthetic review and offline replay with " + behavior, async (t) => {
    const f = await directFixture(t, behavior);
    const prep = await prepareFixture(f);
    const check = runFixture(f, "--check", ...f.flags, ...f.hostFlags, ...f.admissionFlags);
    assert.equal(check.scope?.invocations, 1, JSON.stringify(check));
    // The macOS production boundary denies process creation before exec.
    // The separate process-group fixture exercises an actual surviving child.
    const expected = process.platform === "darwin" && behavior === "descendant" ? "client-failed" : phase;
    const { verified } = await replayFixture(f, expected);
    if (behavior === "ok") {
      assert.equal(verified.coverage, "whole-file");
      assert.equal(verified.result.verdict, "no_findings");
      const evidence = JSON.parse(await readFile(path.join(f.output, "launch.json"), "utf8")).launches[0];
      assert.equal(evidence.backend, prep.runtime.supervisor.backend);
      assert.match(evidence.invocationSha256, /^[a-f0-9]{64}$/);
      const launchFile = path.join(f.output, "launch.json");
      if (process.platform !== "win32") await chmod(f.output, 0o700);
      await chmod(launchFile, 0o600);
      const tampered = JSON.parse(await readFile(launchFile, "utf8"));
      tampered.launches[0].invocationSha256 = "0".repeat(64);
      await writeFile(launchFile, jsonBytes(tampered));
      await chmod(launchFile, 0o400);
      if (process.platform !== "win32") await chmod(f.output, 0o500);
      assert.match(runFixture(f, "--verify", ...f.flags, ...f.evidenceFlags).error ?? "", /launch|evidence|differ/i);
    }
    if (behavior === "checkout") assert.equal(await readFile(f.file("workspace/untracked.txt"), "utf8"), "changed bytes!\n");
    if (process.platform === "win32" && behavior === "descendant") {
      const { launches: [{ process: settlement }] } = JSON.parse(await readFile(path.join(f.output, "launch.json"), "utf8"));
      assert.deepEqual(settlement, { code: 0, signal: null, outcome: "surviving-descendants", quiescent: true });
    }
    if (behavior === "rate-limited") {
      const diagnostic = await readFile(path.join(f.output, "stderr.log"), "utf8");
      assert.deepEqual(JSON.parse(diagnostic), { packet: 1, classification: "upstream-rate-limited" });
    }
  });
}

for (const [behavior, phase] of [["ok", "complete"], ["wrong-second-sha", "receipt-invalid"]]) {
  test(`native multi-packet review binds candidate, file inventory and fresh sessions with ${behavior}`, async (t) => {
    const f = await directFixture(t, behavior, { count: 2, concurrency: 2 });
    await prepareFixture(f);
    const check = runFixture(f, "--check", ...f.flags, ...f.hostFlags, ...f.admissionFlags);
    assert.equal(check.scope?.invocations, 2, JSON.stringify(check));
    const manifest = JSON.parse(await readFile(f.file("export/manifest.json"), "utf8"));
    assert.ok(manifest.packets.every(({ paths }) => paths.includes("context/gate.txt")));
    assert.deepEqual(manifest.packets.flatMap(({ paths }) => paths.filter((name) => name.startsWith("target/"))),
      f.changedFiles.map((name) => "target/" + name));
    const { launch, verified } = await replayFixture(f, phase);
    assert.equal(verified.sessions.length, 2);
    assert.equal(new Set(verified.sessions).size, 2);
    if (behavior === "ok") {
      assert.equal(verified.result.identity.candidate, f.request.snapshot.target);
      assert.equal(verified.result.nativeVerdict, "Verdict: No findings");
    } else {
      assert.equal(launch.rejection.packet, 2);
      assert.equal(launch.rejection.target, f.request.snapshot.target);
      assert.equal(launch.rejection.session, verified.sessions[1]);
      assert.deepEqual(verified.rejection, launch.rejection);
      assert.deepEqual(verified.result.rejection, launch.rejection);
      assert.equal(verified.result.status, undefined);
    }
  });
}

test("native approach readback binds the charter without approving the plan", async (t) => {
  const f = await directFixture(t, "ok", { mode: "approach" });
  await prepareFixture(f);
  const { verified } = await replayFixture(f, "complete");
  assert.equal(verified.approach.action, "freeze-ready");
  assert.equal(verified.approach.record.cumulativeCycles, 0);
  assert.equal(verified.approach.planApproved, false);
  await writeFile(f.file("workspace/openspec/config.yaml"), "changed fixture plan\n");
  assert.match(runFixture(f, "--check", ...f.flags, ...f.hostFlags, ...f.admissionFlags).error ?? "", /identity mismatch/i);
});

test("synthetic Antigravity dispatch uses the sealed strict settings and admits receipt-only replay", async (t) => {
  const f = await directFixture(t, "ok", { client: "agy" });
  const prep = await prepareFixture(f);
  assert.equal(prep.runtime.client, "agy");
  const { verified } = await replayFixture(f, "complete");
  assert.equal(verified.coverage, "receipt-only");
  assert.equal(verified.result.status, "blocked");
  assert.match(await readFile(path.join(f.output, "native.txt"), "utf8"), /Verdict: No findings/);
});
