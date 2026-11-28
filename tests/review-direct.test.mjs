import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmod, mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { directAdapter, directReviewHost, installedReviewer, invocation,
  reviewerAuthVariable, reviewerEnvironmentRoots, reviewerHelp, reviewerProvider } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-direct-adapters.mjs";
import { resolveInstalledExecutable } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/agent-discovery.mjs";
import { classifyNativeOutputError, sanitizeNative } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-direct-receipt.mjs";
import { superviseReview, supervisorCommand } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-direct-supervisor.mjs";
import { hash, jsonBytes } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-inputs.mjs";
import { spawnFixtureSync } from "./test-shards.mjs";
import { directFixture, session, windowsDescendant } from "./review-direct-fixture.mjs";

const cli = fileURLToPath(new URL("../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-candidate.mjs", import.meta.url));
const clients = { claude: "--print", codex: "exec", grok: "--single", pi: "--no-session",
  hermes: "--oneshot", opencode: "run", kilo: "run", agy: "--input-format" };
const reasoning = { claude: ["--effort", "xhigh"], codex: ["-c", 'model_reasoning_effort="high"'], grok: ["--effort", "high"],
  pi: ["--thinking", "max"], opencode: ["--model", "openai/model#high"], kilo: ["--variant", "high"], agy: ["--effort", "high"] };
const grokHelp = { args: ["--no-auto-update", "--help"],
  flags: ["--single", "--session-id", "--tools", "--allow", "--no-subagents", "--disable-web-search"] };

function runFixture(f, ...args) {
  const offlinePath = process.platform === "win32" ? f.gitDirs : f.file("empty-path");
  const env = args[0] === "--verify" ? { ...f.env, PATH: offlinePath } : f.env;
  const result = spawnFixtureSync(process.execPath, [cli, ...args], { env, encoding: "utf8", timeout: 120000 });
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
  for (const client of ["opencode", "kilo"]) {
    const settings = { client, model: "openrouter/vendor/test-model" };
    assert.equal(reviewerProvider(settings), "openrouter");
    assert.equal(reviewerAuthVariable(settings), "OPENROUTER_API_KEY");
    assert.throws(() => reviewerAuthVariable({ ...settings, model: `${client.toUpperCase()}/test-model` }), /supported environment authentication/);
    assert.throws(() => reviewerAuthVariable({ ...settings, model: "openrouter/" }), /provider\/model/);
  }
});

test("native process passes each adapter argument form and prompt without shell interpretation", async (t) => {
  const f = await directFixture(t);
  const python = supervisorCommand();
  const roots = reviewerEnvironmentRoots(process.execPath, python);
  const credentials = { ANTHROPIC_API_KEY: "fx-claude", OPENAI_API_KEY: "fx-openai",
    XAI_API_KEY: "fx-xai", GEMINI_API_KEY: "fx-gemini", OPENCODE_API_KEY: "fx-opencode" };
  const key = { claude: "ANTHROPIC_API_KEY", codex: "OPENAI_API_KEY", grok: "XAI_API_KEY", pi: "OPENAI_API_KEY",
    opencode: "OPENAI_API_KEY", kilo: "OPENAI_API_KEY", agy: "GEMINI_API_KEY" };
  const files = new Map([["target/file.txt", Buffer.from("benign fixture data")]]);
  for (const client of Object.keys(clients)) {
    const config = directReviewHost({ schemaVersion: 3, reviewer: { client, model: "openai/model" }, maxBudgetUsd: 1 });
    const prompt = 'Literal fixture prompt $HOME & "quoted" \\ é';
    const command = invocation({ config, executable: process.execPath, session, prompt, environmentRoots: roots,
      files, cwd: f.workspace, promptFile: f.file("prompt with spaces.txt"),
      env: { ...f.env, ...credentials, GROK_HOME: "ambient-ignored" } });
    if (command.attachment) await writeFile(f.file("prompt with spaces.txt"), command.attachment);
    for (const [name, value] of Object.entries(command.config ?? {})) {
      const file = path.join(command.home, name);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, jsonBytes(value));
    }
    const args = ["-e", `const f = require('node:fs'); const args = process.argv.slice(1);
      const fileArgument = (flag) => args.includes(flag) ? f.readFileSync(args[args.indexOf(flag) + 1], 'utf8') : null;
      f.writeSync(1, JSON.stringify({args, input: f.readFileSync(0, 'utf8'), file: fileArgument('--file'), settings: fileArgument('--settings'), env: process.env}));`,
      "--", ...command.args];
    const captured = await superviseReview(python, { ...command, args }, { cwd: f.workspace, timeoutMs: 3000 });
    assert.equal(captured.quiescent, true, client);
    assert.equal(captured.outcome, "exit", client);
    const actual = JSON.parse(captured.stdout);
    assert.deepEqual(actual.args, command.args, client);
    assert.equal(actual.input, command.input, client);
    assert.equal(actual.file, command.attachment ?? null, client);
    assert.equal(actual.env.PATH, roots.PATH, client);
    for (const [name, value] of Object.entries(credentials)) {
      assert.equal(actual.env[name], key[client] === name ? value : undefined, `${client}/${name}`);
    }
    const offline = { config, session, prompt, files, cwd: "packet", promptFile: "packet-prompt.txt" };
    assert.equal(command.fingerprint, invocation({ ...offline, environmentRootsSha256: hash(jsonBytes(roots)) }).fingerprint);
    assert.notEqual(command.fingerprint, invocation({ ...offline, environmentRootsSha256: "0".repeat(64) }).fingerprint);
    if (client === "agy") assert.equal(JSON.parse(actual.settings).toolPermission, "strict");
    if (client === "grok") {
      assert.deepEqual(command.args, ["--no-auto-update", "--no-plan", "--no-subagents", "--no-memory", "--disable-web-search",
        "--model", "openai/model", "--tools", "Read", "--allow", "Read", "--session-id", session,
        "--output-format", "plain", "--single", prompt]);
      assert.equal(command.attachment, undefined);
      assert.deepEqual(invocation({ ...offline, config: { ...config, proofLevel: "whole-file-read" } }), invocation(offline));
      assert.throws(() => invocation({ ...offline, prompt: "x".repeat(14001) }), /portable Windows quoting bound/);
      for (const proofLevel of [undefined, "whole-file-read"]) {
        assert.deepEqual(reviewerHelp(config.reviewer, "0.2.0", proofLevel), grokHelp);
      }
    }
    if (client === "kilo") assert.equal(command.env.KILO_NO_DAEMON, "1");
  }
});

test("Grok receipt-only sends large distinct file bodies through a native prompt file", async (t) => {
  const f = await directFixture(t);
  const python = supervisorCommand();
  const environmentRoots = reviewerEnvironmentRoots(process.execPath, python);
  const config = directReviewHost({ schemaVersion: 3, reviewer: { client: "grok", model: "fixture-model" },
    proofLevel: "receipt-only", maxBudgetUsd: 1 });
  const prompt = "Review the assigned packet.";
  const contents = ["first é\r\n".repeat(6500), "second λ\n".repeat(6500), "third Δ\t".repeat(6500)];
  const files = new Map(contents.map((body, index) => [`target/file-${index}.txt`, Buffer.from(body)]));
  const promptFile = f.file("prompt with spaces.txt");
  const command = invocation({ config, executable: process.execPath, session, prompt, files, cwd: f.workspace,
    promptFile, environmentRoots, env: { XAI_API_KEY: "fixture-only" } });
  assert.deepEqual(command.args, ["--no-auto-update", "--no-plan", "--no-subagents", "--no-memory", "--disable-web-search",
    "--model", "fixture-model", "--tools", "Read", "--allow", "Read", "--session-id", session,
    "--output-format", "plain", "--prompt-file", promptFile]);
  assert.equal(command.input, "");
  assert.ok(Buffer.byteLength(command.attachment) > 128 * 1024);
  await writeFile(promptFile, command.attachment);
  const args = ["-e", `const fs = require('node:fs');
    const args = process.argv.slice(1);
    const attachment = fs.readFileSync(args[args.indexOf('--prompt-file') + 1]);
    fs.writeSync(1, attachment);`, "--", ...command.args];
  const captured = await superviseReview(python, { ...command, args }, { cwd: f.workspace, timeoutMs: 3000 });
  assert.equal(captured.code, 0);
  assert.equal(captured.quiescent, true);
  assert.deepEqual(captured.stdout, Buffer.from(command.attachment));
  const [instructions, serialized] = captured.stdout.toString("utf8").split("\n\nAssigned files encoded as JSON data:\n");
  assert.equal(instructions, prompt);
  assert.deepEqual(JSON.parse(serialized), [...files].map(([name, bytes]) => ({ name, text: bytes.toString() })));
  const offline = { config, session, prompt, files, cwd: "packet", promptFile: "packet-prompt.txt",
    environmentRootsSha256: hash(jsonBytes(environmentRoots)) };
  assert.equal(command.fingerprint, invocation(offline).fingerprint);
  assert.notEqual(command.fingerprint, invocation({ ...offline, files: new Map(files).set("target/file-0.txt", Buffer.from("changed")) }).fingerprint);
});

async function checkQualifiedEnvironment(f) {
  const windows = process.platform === "win32";
  const locate = (name) => resolveInstalledExecutable(name, { searchPath: f.env.PATH });
  const roots = [path.dirname(locate("claude")), path.dirname(process.execPath), path.dirname(locate(windows ? "python" : "python3"))];
  const system = windows ? await realpath(path.join(f.env.SystemRoot, "System32")) : null;
  roots.push(...(windows ? [system] : ["/usr/bin", "/bin"]));
  const expected = { PATH: [...new Set(roots)].join(path.delimiter), ...(windows ? { SystemRoot: path.dirname(system) } : {}) };
  const ambientPath = f.file("ambient-bin");
  await mkdir(ambientPath);
  f.env.PATH = [ambientPath, f.env.PATH].join(path.delimiter);
  const blocked = ["HOMEDRIVE", "HOMEPATH", "CLAUDE_CONFIG_DIR", "CODEX_HOME", "PI_CODING_AGENT_DIR",
    "SSL_CERT_FILE", "NODE_EXTRA_CA_CERTS", "OPENAI_API_KEY", "GOOGLE_APPLICATION_CREDENTIALS", "OPENCODE_CONFIG"];
  for (const name of blocked) f.env[name] = f.file("ambient-value");
  f.env.ANTHROPIC_API_KEY = "fx-review";
  const script = f.file("fixture.cjs");
  await writeFile(script, `{
    const assert = require('node:assert/strict');
    const path = require('node:path');
    const env = process.env;
    const metadata = process.argv.includes('--version') || process.argv.includes('--help');
    assert.equal(env.PATH, ${JSON.stringify(expected.PATH)});
    for (const name of ${JSON.stringify(blocked)}) assert.equal(env[name], undefined, name);
    assert.equal(env.ANTHROPIC_API_KEY, metadata ? undefined : 'fx-review');
    assert.equal(env.HOME, metadata ? path.join(process.cwd(), 'home') : ${JSON.stringify(f.env.HOME)});
    assert.equal(env.XDG_CONFIG_HOME, metadata ? path.join(process.cwd(), 'home', 'config') : undefined);
    assert.equal(env.TMPDIR, metadata ? process.cwd() : path.dirname(process.cwd()));
  }
` + await readFile(script, "utf8"));
  return hash(jsonBytes(expected));
}

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
    const expectedEnvironment = behavior === "ok" ? await checkQualifiedEnvironment(f) : null;
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
      assert.equal(evidence.runtime.environmentRootsSha256, expectedEnvironment);
      assert.match(evidence.invocationSha256, /^[a-f0-9]{64}$/);
      for (const field of ["environmentRootsSha256", "provider"]) {
        const tampered = structuredClone(f.expect);
        tampered.runtime[field] = field === "provider" ? "openai" : "0".repeat(64);
        await writeFile(f.file("expect.json"), jsonBytes(tampered));
        assert.match(runFixture(f, "--verify", ...f.flags, ...f.evidenceFlags).error ?? "", /evidence|provider|differ/i);
      }
      await writeFile(f.file("expect.json"), jsonBytes(f.expect));
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
    if (behavior === "partial") {
      const diagnostic = await readFile(path.join(f.output, "stderr.log"), "utf8");
      assert.deepEqual(JSON.parse(diagnostic), { packet: 1, classification: "invalid-native-output", reason: "unassigned-or-partial-read" });
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
  const f = await directFixture(t, "limitation", { client: "agy", proofLevel: "receipt-only" });
  const prep = await prepareFixture(f);
  assert.equal(prep.runtime.client, "agy");
  const { verified } = await replayFixture(f, "complete");
  assert.equal(verified.coverage, "receipt-only");
  assert.equal(verified.result.status, "blocked");
  assert.match(await readFile(path.join(f.output, "native.txt"), "utf8"), /Verdict: No findings/);
});

test("synthetic Kilo packet and offline receipt bind the explicit model provider", async (t) => {
  const f = await directFixture(t, "ok", { client: "kilo", proofLevel: "receipt-only" });
  const hostFile = f.file("host.json");
  const host = JSON.parse(await readFile(hostFile, "utf8"));
  host.reviewer.model = f.expect.model = "openrouter/vendor/fixture-model";
  f.expect.configurationSha256 = hash(jsonBytes(host));
  await writeFile(hostFile, jsonBytes(host));
  const admissionFile = f.file("admission.json");
  const admission = JSON.parse(await readFile(admissionFile, "utf8"));
  await writeFile(admissionFile, jsonBytes({ ...admission, configurationSha256: f.expect.configurationSha256 }));
  await writeFile(f.file("expect.json"), jsonBytes(f.expect));
  Object.assign(f.env, { OPENROUTER_API_KEY: "fx-selected", OPENAI_API_KEY: "fx-unselected" });
  await writeFile(f.file("fixture.cjs"), `
    const fs = require('node:fs');
    const assert = require('node:assert/strict');
    if (process.argv.includes('--version')) { console.log('kilo 2.1.0'); process.exit(0); }
    if (process.argv.includes('--help')) { console.log('--model --format --file'); process.exit(0); }
    const arg = (name) => process.argv[process.argv.indexOf(name) + 1];
    assert.equal(arg('--model'), 'openrouter/vendor/fixture-model');
    assert.equal(process.env.OPENROUTER_API_KEY, 'fx-selected');
    assert.equal(process.env.OPENAI_API_KEY, undefined);
    const prompt = fs.readFileSync(arg('--file'), 'utf8');
    const frame = prompt.match(/BEGIN_REVIEW_RECEIPT[\\s\\S]*?END_REVIEW_RECEIPT/g).at(-1);
    const emit = (type, part) => console.log(JSON.stringify({ type, sessionID: 'fixture-kilo', part: { messageID: 'msg-kilo', ...part } }));
    emit('text', { text: frame });
    emit('step_finish', { reason: 'stop' });
  `);
  const prep = await prepareFixture(f);
  assert.equal(prep.runtime.provider, "openrouter");
  const { verified } = await replayFixture(f, "complete");
  assert.equal(verified.coverage, "receipt-only");
  assert.equal(verified.result.runtime.provider, "openrouter");
});

test("explicit receipt-only proof admits fresh full planning and candidate results for supported clients",
  { skip: process.platform === "win32" }, async (t) => {
    for (const client of ["grok", "codex", "agy", "pi", "claude"]) {
      for (const mode of ["approach", "candidate"]) {
        const f = await directFixture(t, "ok", { mode, client, proofLevel: "receipt-only" });
        if (client === "grok") await writeFile(f.file("fixture.cjs"), String.raw`
          const fs = require('node:fs');
          const path = require('node:path');
          const assert = require('node:assert/strict');
          const args = process.argv.slice(2);
          if (args.includes('--version')) { console.log('grok-build 1.0.92'); process.exit(0); }
          if (args.includes('--help')) {
            console.log('--single --session-id --tools --allow --no-subagents --disable-web-search --prompt-file');
            process.exit(0);
          }
          assert.ok(!args.includes('--single'), '--single conflicts with --prompt-file');
          assert.equal(args.filter((arg) => arg === '--prompt-file').length, 1);
          assert.equal(args.at(-2), '--prompt-file');
          assert.equal(args.at(-1), path.join(path.dirname(process.cwd()), 'prompt.txt'));
          assert.equal(fs.readFileSync(0, 'utf8'), '');
          const stat = fs.lstatSync(args.at(-1));
          assert.ok(stat.isFile());
          assert.equal(stat.mode & 0o777, 0o400);
          const [prompt, payload] = fs.readFileSync(args.at(-1), 'utf8').split('\n\nAssigned files encoded as JSON data:\n');
          assert.match(prompt, /Review exactly the assigned file bodies supplied as JSON data\. Do not call tools\./);
          const files = JSON.parse(payload);
          assert.ok(new Set(files.map(({ text }) => text)).size > 1);
          const assigned = prompt.split('\n').filter((line) => /^(?:target|base|plan|diff|context)\//.test(line) || line === 'review-context.json');
          assert.deepEqual(files, assigned.map((name) => ({ name, text: fs.readFileSync(name, 'utf8') })));
          const frame = prompt.match(/BEGIN_REVIEW_RECEIPT[\s\S]*?END_REVIEW_RECEIPT/g).at(-1);
          fs.writeSync(1, frame);
        `);
        const prep = await prepareFixture(f);
        assert.equal(prep.proofLevel, "receipt-only");
        const { verified } = await replayFixture(f, "complete");
        assert.equal(verified.proofComplete, true);
        assert.equal(verified.coverage, "receipt-only");
        assert.equal(verified.proofLevel, "receipt-only");
        if (mode === "approach") assert.equal(verified.approach.action, "freeze-ready");
        else assert.equal(verified.result.verdict, "no_findings");
        const launch = await readFile(path.join(f.output, "launch.json"), "utf8");
        assert.ok(!launch.includes(f.env.HOME) && !launch.includes("fixture-host-login"));
        const legacyRuntime = client === "grok" ? { ...prep.runtime, capabilitySha256: hash(jsonBytes(grokHelp)) } : prep.runtime;
        if (client === "grok") {
          const capabilitySha256 = hash(jsonBytes({ ...grokHelp, flags: [...grokHelp.flags, "--prompt-file"] }));
          assert.equal(prep.runtime.capabilitySha256, capabilitySha256);
          assert.equal(JSON.parse(launch).launches[0].runtime.capabilitySha256, capabilitySha256);
          await writeFile(f.file("expect.json"), jsonBytes({ ...f.expect, runtime: legacyRuntime }));
          assert.match(runFixture(f, "--verify", ...f.flags, ...f.evidenceFlags).error, /Native CLI capability binding differs/);
        }
        for (const proofLevel of [undefined, "whole-file-read"]) {
          await writeFile(f.file("expect.json"), jsonBytes({ ...f.expect, runtime: legacyRuntime, proofLevel }));
          assert.match(runFixture(f, "--verify", ...f.flags, ...f.evidenceFlags).error, /proof level differs/);
        }
      }
    }
  });

test("Grok receipt-only rejects native help without --prompt-file before inference",
  { skip: process.platform === "win32" }, async (t) => {
    const f = await directFixture(t, "ok", { client: "grok", proofLevel: "receipt-only" });
    const script = f.file("fixture.cjs");
    const started = f.file("inference-started");
    const legacyMock = await readFile(script, "utf8");
    await writeFile(script, "if (!process.argv.includes('--version') && !process.argv.includes('--help')) {\n" +
      "  require('node:fs').writeFileSync(" + JSON.stringify(started) + ", 'started');\n}\n" + legacyMock);
    assert.match(runFixture(f, "--prepare", ...f.flags, ...f.hostFlags).error ?? "",
      /grok native help lacks required options: --prompt-file/);
    await assert.rejects(readFile(started), { code: "ENOENT" });
    await assert.rejects(readFile(f.file("export/manifest.json")), { code: "ENOENT" });
  });

test("strict proof requires exact structured bytes and rejects weaker adapter and host pin",
  { skip: process.platform === "win32" }, async (t) => {
    const proofLevel = "whole-file-read";
    for (const behavior of ["ok", "missing-byte", "preamble", "epilogue"]) {
      const f = await directFixture(t, behavior, { proofLevel });
      await prepareFixture(f);
      const phase = behavior === "ok" ? "complete" : behavior === "missing-byte" ? "invalid-native-output" : "receipt-invalid";
      const { verified } = await replayFixture(f, phase);
      assert.equal(verified.proofLevel, proofLevel);
      assert.equal(verified.proofComplete, behavior === "ok");
      assert.equal(verified.coverage, behavior === "ok" ? "whole-file" : null);
    }
    for (const client of ["agy", "grok"]) {
      const strict = await directFixture(t, "ok", { client, proofLevel });
      assert.match(runFixture(strict, "--prepare", ...strict.flags, ...strict.hostFlags).error, /structured whole-file/);
      const unmarked = await directFixture(t, "ok", { client });
      assert.match(runFixture(unmarked, "--prepare", ...unmarked.flags, ...unmarked.hostFlags).error, /structured whole-file/);
    }
    const mismatch = await directFixture(t, "ok", { proofLevel, hostProofLevel: "receipt-only" });
    assert.match(runFixture(mismatch, "--prepare", ...mismatch.flags, ...mismatch.hostFlags).error, /Host review proof level differs/);
  });

test("single authorized smoke probe reserves finite cost and seals only synthetic compatibility",
  { skip: process.platform === "win32" }, async (t) => {
    const f = await directFixture(t, "ok", { proofLevel: "receipt-only" });
    const host = JSON.parse(await readFile(f.file("host.json"), "utf8"));
    const probeHost = { ...host, maxBudgetUsd: 0.01, runTimeoutMs: 3000 };
    await writeFile(f.file("host.json"), jsonBytes(probeHost));
    const { explicitRuntimeSha256, ...pin } = runFixture(f, "--probe-check", ...f.hostFlags);
    assert.match(explicitRuntimeSha256, /^[a-f0-9]{64}$/);
    await writeFile(f.file("expect.json"), jsonBytes(pin));
    const args = ["--probe", ...f.hostFlags, "--expect", f.file("expect.json"), ...f.admissionFlags, ...f.evidenceFlags];
    assert.match(runFixture(f, ...args).error, /probe grant/);
    const grant = { schemaVersion: 1, kind: "standalone-review-probe", reference: "fixture standalone grant", verified: true,
      runs: 1, configurationSha256: pin.configurationSha256, upperUsdMicros: 10000, explicitRuntimeSha256, ledger: f.file("ledger") };
    await writeFile(f.file("admission.json"), jsonBytes(grant));
    const result = runFixture(f, ...args);
    assert.equal(result.compatible, true, JSON.stringify(result));
    assert.equal(result.settled, true);
    assert.equal(result.qualification, false);
    assert.equal(result.deliveryAccepted, false);
    assert.equal(hash(await readFile(f.file("output/result.json"))), result.resultSha256);
    const retry = [...args.slice(0, -1), f.file("retry")];
    assert.match(runFixture(f, ...retry).error, /already consumed/);
    const unsafeHost = { ...probeHost, maxBudgetUsd: 0.02 };
    await writeFile(f.file("host.json"), jsonBytes(unsafeHost));
    assert.match(runFixture(f, "--probe-check", ...f.hostFlags).error, /bounds/);
  });

test("Claude Direct-CLI stream audit accepts builtin-only plugins and rejects non-builtin plugins", () => {
  const cwd = path.resolve("fixture-workspace");
  const rel = "sample.txt";
  const body = Buffer.from("hello\n");
  const files = new Map([[rel, body]]);
  const launch = {
    session,
    process: { code: 0, signal: null, outcome: "exit", quiescent: true },
    runtime: { client: "claude", model: "claude-sonnet-4-6", version: "2.1.332", maxTurns: 128 },
  };
  const runWithPlugins = (plugins) => {
    const events = [
      { type: "system", subtype: "init", session_id: session, cwd, tools: ["Read"], mcp_servers: [],
        skills: [], slash_commands: [], plugins, permissionMode: "dontAsk",
        claude_code_version: "2.1.332", model: "claude-sonnet-4-6" },
      { type: "assistant", session_id: session, message: { id: "m1", model: "claude-sonnet-4-6",
        content: [{ type: "tool_use", id: "t1", name: "Read", input: { file_path: path.join(cwd, rel) }, caller: { type: "direct" } }] } },
      { type: "user", session_id: session, message: { content: [{ type: "tool_result", tool_use_id: "t1", content: "1\thello" }] },
        tool_use_result: { type: "text", file: { filePath: path.join(cwd, rel), content: "hello", startLine: 1, numLines: 1, totalLines: 1 } } },
      { type: "assistant", session_id: session, message: { id: "m2", model: "claude-sonnet-4-6", content: [{ type: "text", text: "OK" }] } },
      { type: "result", subtype: "success", session_id: session, is_error: false, permission_denials: [],
        num_turns: 2, total_cost_usd: 0.02, result: "OK" },
    ];
    return sanitizeNative({ stdout: Buffer.concat(events.map(jsonBytes)), format: "claude-read",
      cwd, files, redactions: [], launch, maxBudgetUsd: 2.5 });
  };
  const builtins = [
    { name: "cc-plugin-agents-md", path: "builtin", source: "cc-plugin-agents-md@builtin" },
    { name: "cc-plugin-privacy", path: "builtin", source: "cc-plugin-privacy@builtin" },
  ];
  assert.match(runWithPlugins(builtins).toString(), /cc-plugin-agents-md@builtin/);
  assert.match(runWithPlugins([]).toString(), /"plugins":\[\]/);
  for (const bad of [
    [{ name: "user-plugin", path: "/home/u/.claude/p", source: "user-plugin@local" }],
    [{ name: "cc-plugin-agents-md", path: "builtin", source: "other@builtin" }],
    [{ name: "cc-plugin-agents-md", path: "builtin", source: "cc-plugin-agents-md@builtin", extra: true }],
    ["cc-plugin-agents-md"],
  ]) {
    assert.throws(() => runWithPlugins(bad), /Unexpected native startup inventory/);
  }
  const withAdvisories = [
    { type: "system", subtype: "init", session_id: session, cwd, tools: ["Read"], mcp_servers: [],
      skills: [], slash_commands: [], plugins: builtins, permissionMode: "dontAsk",
      claude_code_version: "2.1.332", model: "claude-sonnet-4-6" },
    { type: "rate_limit_event", session_id: session, rate_limit_info: { status: "allowed" } },
    { type: "tool_progress", session_id: session, tool_name: "Read" },
    { type: "system", subtype: "api_retry", session_id: session, attempt: 1 },
    { type: "system", subtype: "session_state_changed", session_id: session, state: "running" },
    { type: "system", subtype: "post_turn_summary", session_id: session },
    { type: "system", subtype: "ui_invalidate", session_id: session },
    { type: "system", subtype: "turn_duration", session_id: session, duration_ms: 1200 },
    { type: "system", subtype: "status", session_id: session, status: "compacting" },
    { type: "assistant", session_id: session, message: { id: "m1", model: "claude-sonnet-4-6",
      content: [{ type: "tool_use", id: "t1", name: "Read", input: { file_path: path.join(cwd, rel) }, caller: { type: "direct" } }] } },
    { type: "user", session_id: session, message: { content: [{ type: "tool_result", tool_use_id: "t1", content: "1\thello" }] },
      tool_use_result: { type: "text", file: { filePath: path.join(cwd, rel), content: "hello", startLine: 1, numLines: 1, totalLines: 1 } } },
    { type: "assistant", session_id: session, message: { id: "m2", model: "claude-sonnet-4-6", content: [{ type: "text", text: "OK" }] } },
    { type: "result", subtype: "success", session_id: session, is_error: false, permission_denials: [],
      num_turns: 2, total_cost_usd: 0.02, result: "OK" },
  ];
  const sanitized = sanitizeNative({ stdout: Buffer.concat(withAdvisories.map(jsonBytes)), format: "claude-read",
    cwd, files, redactions: [], launch, maxBudgetUsd: 2.5 }).toString();
  assert.doesNotMatch(sanitized, /rate_limit_event|tool_progress|api_retry|session_state_changed|post_turn_summary|ui_invalidate|turn_duration|"subtype":"status"/);
  assert.throws(() => sanitizeNative({
    stdout: Buffer.concat([withAdvisories[0], { type: "system", subtype: "hook_started", session_id: session }, ...withAdvisories.slice(9)].map(jsonBytes)),
    format: "claude-read", cwd, files, redactions: [], launch, maxBudgetUsd: 2.5,
  }), (err) => /Unexpected Claude stream event/.test(err.message) && classifyNativeOutputError(err) === "unexpected-event");
});
