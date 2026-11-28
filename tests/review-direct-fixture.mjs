import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveInstalledExecutable } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/agent-discovery.mjs";
import { hash, jsonBytes } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-inputs.mjs";

export const session = "bbfc24d7-10be-4db1-9bf0-6d17803ceb6b";
const windows = process.platform === "win32";

export const windowsDescendant = `
import subprocess, sys

child = subprocess.Popen([sys.executable, "-I", "-B", "-c",
    "import time; print('child-ready', flush=True); time.sleep(15)"],
    stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
    creationflags=subprocess.CREATE_NO_WINDOW)
with child.stdout:
    ready = child.stdout.readline().strip()
if ready != b"child-ready" or child.poll() is not None:
    raise RuntimeError("Fixture descendant did not start and remain alive")
print("child-ready", flush=True)
`;

function privateWindowsRoot(root) {
  const system = process.env.SystemRoot;
  execFileSync(path.join(system, "System32", "WindowsPowerShell", "v1.0", "powershell.exe"),
    ["-NoProfile", "-NonInteractive", "-Command", String.raw`
      $ErrorActionPreference = 'Stop'
      $user = [Security.Principal.WindowsIdentity]::GetCurrent().User
      $acl = [Security.AccessControl.DirectorySecurity]::new()
      $acl.SetOwner($user)
      $acl.SetAccessRuleProtection($true, $false)
      $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($user, 'FullControl',
        'ContainerInherit, ObjectInherit', 'None', 'Allow'))
      Set-Acl -LiteralPath $env:FIXTURE_ROOT -AclObject $acl`],
    { env: { SystemRoot: system, WINDIR: system, FIXTURE_ROOT: root }, timeout: 15000 });
}

export async function directFixture(t, behavior = "ok", { mode = "candidate", count = 1, concurrency = 1, client = "claude", proofLevel, hostProofLevel = proofLevel } = {}) {
  const root = await mkdtemp(path.join(await realpath(tmpdir()), "direct-fixture-"));
  t.after(async () => {
    async function unlock(directory) {
      await chmod(directory, 0o700);
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        if (entry.isDirectory()) await unlock(path.join(directory, entry.name));
        else if (windows && entry.isFile()) await chmod(path.join(directory, entry.name), 0o600);
      }
    }
    await unlock(root);
    await rm(root, { recursive: true, force: true });
  });
  if (windows) privateWindowsRoot(root);
  await Promise.all(["home", "bin", "workspace", "ledger"].map((name) => mkdir(path.join(root, name), { mode: 0o700 })));
  const workspace = path.join(root, "workspace");
  const nullDevice = windows ? "NUL" : "/dev/null";
  const file = (name) => path.join(root, name);
  const gitPath = resolveInstalledExecutable("git");
  const pythonPath = resolveInstalledExecutable(windows ? "python" : "python3");
  const gitDirs = path.dirname(gitPath);
  const dirs = [file("bin"), gitDirs, path.dirname(pythonPath), path.dirname(process.execPath)];
  const env = { PATH: [...new Set(dirs)].join(path.delimiter), HOME: file("home"), USERPROFILE: file("home"),
    APPDATA: file("home"), LOCALAPPDATA: file("home"), ...(windows ? { SystemRoot: process.env.SystemRoot } : {}),
    TMPDIR: root, TEMP: root, TMP: root, XDG_CONFIG_HOME: file("home"), XDG_DATA_HOME: file("home"),
    XDG_CACHE_HOME: file("home"), XDG_STATE_HOME: file("home") };
  if (client === "agy") env.GEMINI_API_KEY = "fixture-only";
  if (client === "grok") env.XAI_API_KEY = "fixture-only";
  if (["claude", "codex", "pi"].includes(client)) await writeFile(file("home/review-login"), "fixture-host-login");
  const git = (...args) => execFileSync(gitPath, ["-c", "core.hooksPath=" + nullDevice, "-c", "core.autocrlf=false",
    "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", ...args], {
    cwd: workspace, stdio: ["ignore", "pipe", "pipe"],
    env: { ...env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: nullDevice },
  }).toString();
  git("init", "-q");
  await writeFile(path.join(workspace, "AGENTS.md"), "<!-- openspec-low-touch: {} -->\n<!-- openspec-reviewer: direct-cli-v1 -->\n" +
    (proofLevel ? `<!-- openspec-review-proof: ${proofLevel} -->\n` : ""));
  git("add", ".");
  git("commit", "-qm", "adopt direct review");
  const parent = git("rev-parse", "HEAD").trim();
  const change = "review-fixture";
  const prefix = "openspec/changes/" + change + "/";
  await mkdir(path.join(workspace, prefix), { recursive: true });
  const sources = {
    "openspec/config.yaml": "schema: spec-driven\n",
    [prefix + ".openspec.yaml"]: "schema: spec-driven\n",
    [prefix + "proposal.md"]: "# Proposal\n",
    [prefix + "tasks.md"]: "## 1. Work\n\n- [ ] 1.1 Implement\n",
  };
  for (const [name, bytes] of Object.entries(sources)) await writeFile(path.join(workspace, name), bytes);
  const changedFiles = Array.from({ length: count }, (_item, index) => `file-${index + 1}.txt`);
  for (const name of changedFiles) await writeFile(path.join(workspace, name), "old " + name.repeat(12) + "\n");
  git("add", ".");
  git("commit", "-qm", "freeze synthetic plan");
  const plan = git("rev-parse", "HEAD").trim();
  if (mode === "candidate") {
    for (const name of changedFiles) await writeFile(path.join(workspace, name), "new " + name.repeat(12) + "\n");
    git("add", ".");
    git("commit", "-qm", "implement synthetic change");
  }
  const target = git("rev-parse", "HEAD").trim();
  const diff = git("diff", "--no-color", "--no-ext-diff", "--no-textconv", "--no-relative", "--find-renames=50%",
    "--diff-algorithm=myers", "--no-indent-heuristic", "--patch", "--text", "--full-index", "--unified=3",
    "--src-prefix=a/", "--dst-prefix=b/", plan, target, "--");
  const planDigest = hash(Object.entries(sources).sort(([a], [b]) => a < b ? -1 : 1).map(([name, value]) =>
    JSON.stringify([name, "100644", Buffer.byteLength(value)]) + "\0" + value + "\0").join(""));
  await writeFile(path.join(workspace, "gate.txt"), "fixture passed\n");
  await writeFile(path.join(workspace, "untracked.txt"), "original bytes\n");
  const output = path.join(root, "output");
  const request = { schemaVersion: 1, mode, session, policy: { parent, target: parent },
    worker: { schemaVersion: 1, identity: { attempt: "review-1", predecessor: null, role: "reviewer", change,
      group: "1", task: "1.1", action: "1.1", workspace, plan, planDigest, candidate: target,
      inputs: Object.fromEntries(Object.entries(sources).map(([name, content]) => [name, hash(content)])),
      implementerSession: randomUUID() },
    outcome: "Review the synthetic implementation", acceptance: ["Inspect every assigned file"], scope: changedFiles,
    nonGoals: ["Other files"], authority: { orchestrator: "orch", writer: "orch", authorSession: "draft",
      approvalReference: "approval", executionReference: "execution" },
    restrictions: ["no Git writes", "no tasks.md writes", "no profile writes", "no subagents", "no multiplexers", "read-only"],
    budget: { limit: 2, unit: "minutes" }, stop: "after one review", evidenceRoots: [output],
    requiredEvidence: ["native.txt", "lifecycle.jsonl", "stdout.jsonl", "stderr.log", "launch.json"], mutablePaths: [] },
    attachments: { "gate.txt": hash("fixture passed\n") }, limits: { diffBytes: count === 1 ? 4096 : 490 },
    snapshot: { base: plan, target, plan, planDigest, diffSha256: hash(diff),
      gates: [{ command: "fixture", commit: target, exitCode: 0, evidence: "gate.txt" }] } };
  const model = client === "agy" ? "fixture-gemini-model" : "claude-review-fixture";
  if (mode === "approach") {
    request.policy.planningModes = Object.fromEntries(Object.keys(sources).map((name) => [name, "100644"]));
    Object.assign(request.worker.identity, { role: "approach-reviewer", plan: null, planDigest: null, candidate: null, implementerSession: null });
    request.worker.authority.approvalReference = null;
    request.attachments = {};
    request.snapshot = { record: { schemaVersion: 1, change, goal: "Review the synthetic implementation", passRule: "charter-v1",
      binding: { route: "direct-cli", client, model, qualified: true, independent: true, readOnly: true, permissions: ["read"] },
      charter: { clauses: ["scope"], boundaries: ["fixture"], tasks: ["1.1"], gates: ["fixture"] },
      budget: 2, cumulativeCycles: 0, entries: [], ledger: [] }, correction: null,
    authority: { reference: "execution", write: true, validate: true, review: true }, priorLaunches: [] };
  }
  const host = jsonBytes({ schemaVersion: 3, reviewer: { client, model, timeoutMs: 5000, packetConcurrency: concurrency },
    runTimeoutMs: 120000, maxBudgetUsd: 1, ...(hostProofLevel ? { proofLevel: hostProofLevel } : {}) });
  const expect = { schemaVersion: 2, requestSha256: hash(jsonBytes(request)), exportSha256: null, configurationSha256: hash(host),
    model };
  await writeFile(file("request.json"), jsonBytes(request), { mode: 0o600 });
  await writeFile(file("expect.json"), jsonBytes(expect), { mode: 0o600 });
  await writeFile(file("host.json"), host, { mode: 0o600 });
  const phase = mode === "approach" ? "planning" : "execution";
  const admission = { schemaVersion: 1, configurationSha256: expect.configurationSha256, ledger: file("ledger"), phase,
    phaseGrant: { kind: "contained-review-phase", verified: true, reference: "single-phase", change, phase,
      policyRevision: parent, requestSha256: expect.requestSha256, authorityReference: "execution" } };
  await writeFile(file("admission.json"), jsonBytes(admission), { mode: 0o600 });
  const script = file("fixture.cjs");
  await writeFile(script, `
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const arg = (name) => process.argv[process.argv.indexOf(name) + 1];
const client = ${JSON.stringify(client)};
const proofLevel = ${JSON.stringify(proofLevel ?? null)};
if (process.argv.includes("--version")) {
  fs.writeSync(1, ({ agy: "agy 1.6.0", codex: "codex-cli 0.130.0", grok: "grok-build 0.2.0", pi: "pi 1.5.2" }[client] ?? "2.1.330 (Claude Code)") + "\\n");
  process.exit(0);
}
if (process.argv.includes("--help")) {
  fs.writeSync(1, ({ agy: "--settings --input-format --output-format --disable-slash-commands --effort\\n",
     codex: "--sandbox --json --ephemeral --ignore-user-config --ignore-rules\\n",
     grok: "--single --session-id --tools --allow --no-subagents --disable-web-search\\n",
     pi: "--mode --no-session --session-id --no-tools --no-mcp\\n" }[client]) ??
    "--print --session-id --safe-mode --restricted --strict-mcp-config --permission-prompts --no-session-persistence --tools --effort --max-budget-usd --max-turns\\n");
  process.exit(0);
}
const sid = arg("--session-id");
const model = arg("--model");
const cwd = process.cwd();
const raw = fs.readFileSync(0, "utf8");
const prompt = client === "agy" ? JSON.parse(raw).message.content : client === "grok" ? process.argv.at(-1) : raw;
const begin = prompt.lastIndexOf("BEGIN_REVIEW_RECEIPT");
const end = prompt.indexOf("END_REVIEW_RECEIPT", begin) + "END_REVIEW_RECEIPT".length;
let frame = prompt.slice(begin, end);
const files = prompt.split("\\n").filter((line) => /^(?:target|base|plan|diff|context)\\//.test(line) || line === "review-context.json");
const behavior = ${JSON.stringify(behavior)};
if (behavior === "preamble") frame = "Extra prose\\n" + frame;
if (behavior === "epilogue") frame += "\\nExtra prose";
if (behavior === "limitation") {
  const rows = frame.split("\\n");
  const data = JSON.parse(rows[3]);
  data.coverageLimitations = ["An assigned file was unavailable"];
  rows[3] = JSON.stringify(data);
  frame = rows.join("\\n");
}
if (["claude", "codex", "pi"].includes(client) &&
    fs.readFileSync(path.join(process.env.HOME, "review-login"), "utf8") !== "fixture-host-login") process.exit(32);
if (client === "grok") { fs.writeSync(1, frame); process.exit(0); }
if (client === "codex" || client === "pi") {
  const id = require("node:crypto").randomUUID();
  const events = client === "codex" ? [{ type: "thread.started", thread_id: id },
    { type: "item.completed", item: { type: "agent_message", text: frame } }, { type: "turn.completed" }] :
    [{ type: "session", id: sid, cwd },
      { type: "message_end", message: { role: "assistant", model, provider: "fixture", stopReason: "stop",
        content: [{ type: "text", text: frame }] } }, { type: "agent_settled", aborted: false }];
  for (const event of events) fs.writeSync(1, JSON.stringify(event) + "\\n");
  process.exit(0);
}
if (client === "agy") {
  const config = JSON.parse(fs.readFileSync(arg("--settings"), "utf8"));
  if (process.env.HOME !== path.join(path.dirname(cwd), "home") || config.toolPermission !== "strict" ||
      config.permissions.allow.length !== 0 || !process.env.GEMINI_API_KEY) process.exit(30);
  const conversation_id = require("node:crypto").randomUUID();
  const emit = (event) => fs.writeSync(1, JSON.stringify(event) + "\\n");
  emit({ event: "init", conversation_id, init: { cwd, model, permission_mode: "strict", tools: ["run_command"] } });
  emit({ event: "step_update", step_update: { conversation_id, step_type: "agent_response", state: "DONE", text_delta: frame } });
  emit({ event: "result", result: { conversation_id, status: "SUCCESS", num_turns: 1, response: frame } });
  process.exit(0);
}
if (behavior === "rate-limited") {
  fs.writeSync(2, "429 upstream refused synthetic-secret-and-body\\n");
  process.exit(23);
}
if (behavior === "wrong-second-sha" && prompt.includes("Packet: 2 of")) frame = frame.replace(${JSON.stringify(target)}, "f".repeat(40));
if (behavior === "bare") frame = frame.split("\\n").filter((line) => !/^(?:BEGIN|END)_REVIEW_RECEIPT$/.test(line)).join("\\n");
if (behavior === "checkout") fs.writeFileSync(${JSON.stringify(path.join(workspace, "untracked.txt"))}, "changed bytes!\\n");
if (behavior === "packet") fs.writeFileSync(path.join(cwd, "unexpected.txt"), "unexpected");
if (behavior === "descendant" && process.platform !== "win32") {
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { detached: process.platform === "linux", stdio: "ignore" });
  if (process.platform === "darwin") child.once("error", (error) => process.exit(error.code === "EAGAIN" ? 31 : 32));
  child.unref();
}
const emit = (event) => console.log(JSON.stringify({ session_id: sid, ...event }));
emit({ type: "system", subtype: "init", model, cwd, permissionMode: "dontAsk", claude_code_version: "2.1.330",
  tools: ["Read"], mcp_servers: [], skills: [], slash_commands: [], plugins: [] });
for (const [n, file] of (proofLevel === "receipt-only" ? [] : files).entries()) {
  const file_path = path.join(cwd, file);
  const content = behavior === "partial" && n === 0 ? "Incomplete fixture bytes" : fs.readFileSync(file_path, "utf8").replace(proofLevel === "whole-file-read" && behavior !== "missing-byte" ? /(?!) / : /\\n$/, "");
  const id = "call-" + n;
  emit({ type: "assistant", message: { id, content: [{ type: "tool_use", id, name: "Read", input: { file_path } }] } });
  emit({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: id, content }] },
    tool_use_result: { type: "text", file: { filePath: file_path, content, startLine: 1, numLines: content.split("\\n").length } } });
}
const answer = behavior === "duplicate" ? frame + "\\n" + frame : frame;
emit({ type: "assistant", message: { id: "answer", content: [{ type: "text", text: answer }] } });
emit({ type: "result", subtype: "success", is_error: false, permission_denials: [], num_turns: 1, total_cost_usd: 0, result: answer });
`);
  if (windows) {
    const compiler = path.join(env.SystemRoot, "Microsoft.NET", "Framework", "v4.0.30319", "csc.exe");
    const source = fileURLToPath(new URL("./review-direct-windows-fixture.cs", import.meta.url));
    await writeFile(file("bin/node-path.txt"), process.execPath);
    if (behavior === "descendant") {
      await writeFile(file("bin/python-path.txt"), pythonPath);
      await writeFile(file("descendant.py"), windowsDescendant);
    }
    execFileSync(compiler, ["/nologo", "/target:exe", "/out:" + file("bin/" + client + ".exe"), source],
      { env, stdio: ["ignore", "pipe", "pipe"], timeout: 30000 });
  } else {
    const launcher = file("bin/" + client);
    await writeFile(launcher, `#!/bin/sh\nexec "${process.execPath}" "${script}" "$@"\n`, { mode: 0o700 });
  }
  // Scratch packet roots are siblings of the real checkout, exported files and evidence.
  const flags = ["--request", file("request.json"), "--expect", file("expect.json"), "--export", file("export")];
  const hostFlags = ["--host-config", file("host.json")];
  const evidenceFlags = ["--output", output];
  return { root, file, env, workspace, expect, flags, hostFlags, evidenceFlags, output, gitDirs, request, changedFiles,
    admissionFlags: ["--admission", file("admission.json")] };
}
