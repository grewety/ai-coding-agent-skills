import path from "node:path";
import { lstat, mkdir, readdir, rmdir, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { runBoundedWorker } from "./bounded-worker.mjs";
import { preparePromptTransport } from "./terminal-adapters.mjs";
import { requestBytes, writeClosed } from "./worker-handoff.mjs";
import { equal, need } from "./review-inputs.mjs";
import { checkoutProtectedPaths, checkoutStatus } from "./worker-runtime-policy.mjs";

const bin = "/usr/bin/python3";
const executablePath = "/usr/bin:/bin";
const features = [
  "--enable", "skip_host_skill_discovery",
  "--disable", "multi_agent_v2", "--disable", "multi_agent",
  "--disable", "hooks", "--disable", "plugins", "--disable", "apps",
];

const shellProbe = `
import errno, os, sys
mode, readable, scratch, protected, secret, evidence = sys.argv[1:7]
def no_read(name):
    try:
        with open(name, "rb") as source:
            source.read(1)
    except OSError as error:
        if error.errno in (errno.EACCES, errno.EPERM, errno.ENOENT, errno.ENOTDIR):
            return
        raise
    raise RuntimeError("protected read succeeded")
def no_write(name):
    try:
        # Existing-file write access only. This never truncates or writes a byte.
        fd = os.open(name, os.O_WRONLY | os.O_NOFOLLOW)
    except OSError as error:
        if error.errno in (errno.EACCES, errno.EPERM, errno.EROFS, errno.ENOENT, errno.ENOTDIR):
            return
        raise
    os.close(fd)
    raise RuntimeError("protected write open succeeded")
with open(readable, "rb") as source:
    if not source.read(1):
        raise RuntimeError("benign read returned no data")
for name in [readable, protected, secret, evidence, *sys.argv[7:]]:
    no_write(name)
for name in (secret, evidence):
    no_read(name)
if mode == "read-only":
    no_write(scratch)
else:
    os.unlink(scratch)
    with open(scratch, "xb") as out:
        out.write(b"worker-disposable")
    with open(scratch, "rb") as source:
        if source.read() != b"worker-disposable":
            raise RuntimeError("workspace disposable readback differs")
    os.unlink(scratch)
print("WORKSPACE_PROBE_OK " + mode)
`;

export function workerEnvironment(role) {
  return {
    PATH: executablePath, HOME: role.home, XDG_CONFIG_HOME: role.xdg, XDG_RUNTIME_DIR: role.home,
    TMPDIR: role.home, CODEX_HOME: role.codexHome, LANG: "C.UTF-8", LC_ALL: "C.UTF-8",
  };
}

async function ensureDedicatedConfiguration(role, workspace) {
  // The launch fixes Codex's project marker to .git. Both a regular checkout
  // and a linked worktree stop discovery at this checkout's marker.
  const marker = await lstat(path.join(workspace, ".git"));
  need(marker.isDirectory() || marker.isFile(), "Expected a Git project marker at the worker checkout");
  const forbidden = [".codex/config.toml", ".codex/rules", ".codex/agents", ".mcp.json"];
  for (const name of forbidden) {
    try {
      await lstat(path.join(workspace, name));
      throw new Error("Worker checkout has project-local Codex settings, agents, rules or MCP");
    } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  const ambientConfiguration = "Dedicated Codex home has ambient configuration or discoverable skills";
  for (const name of ["config.toml", "rules", "AGENTS.md"]) {
    try {
      await lstat(path.join(role.codexHome, name));
      throw new Error(ambientConfiguration);
    } catch (error) { if (error.code !== "ENOENT") throw error; }
  }

  const skills = path.join(role.codexHome, "skills");
  let skillsStat;
  try { skillsStat = await lstat(skills); }
  catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  // Codex may populate .system with built-in skills in a dedicated home.
  need(skillsStat.isDirectory(), ambientConfiguration);
  const entries = await readdir(skills);
  need(entries.length === 1 && entries[0] === ".system", ambientConfiguration);
  need((await lstat(path.join(skills, ".system"))).isDirectory(), ambientConfiguration);
}

function tomlTable(settings) {
  return "{ " + Object.entries(settings).map(([key, value]) =>
    JSON.stringify(key) + " = " + JSON.stringify(value)).join(", ") + " }";
}

function commonSettings(filesystem) {
  return [...features, "-c", "default_permissions=\"worker\"",
    "-c", 'project_root_markers=[".git"]',
    "-c", "permissions.worker.filesystem=" + tomlTable(filesystem),
    "-c", "permissions.worker.network.enabled=false",
    "-c", "approval_policy=\"never\"", "-c", "model_provider=\"openai\"",
    "-c", "cli_auth_credentials_store=\"file\"", "-c", "mcp_servers={}",
    "-c", "shell_environment_policy.inherit=\"none\"", "-c", "allow_login_shell=false"];
}

async function filesystemPolicy(request, role, registry, writable) {
  const { workspace, change } = request.identity;
  const git = await checkoutProtectedPaths(workspace);
  // The Linux sandbox re-execs Codex inside Bubblewrap. Allow it to read the
  // pinned native file alongside the standard system runtime.
  const paths = { ":minimal": "read", [role.executable.path]: "read", [workspace]: "read" };
  for (const name of writable) paths[name] = "write";
  for (const name of [role.codexHome, role.home, role.xdg, registry, ...request.evidenceRoots, ...git]) paths[name] = "deny";
  paths[path.join(workspace, "openspec/changes", change, "tasks.md")] = "read";
  return paths;
}

export async function buildCodexLaunch(request, role, registry, captureDir, launchNonce) {
  await ensureDedicatedConfiguration(role, request.identity.workspace);
  const transport = preparePromptTransport({
    client: "codex", version: role.version, role: "implementer", session: launchNonce,
    workspace: request.identity.workspace, prompt: requestBytes(request).toString("utf8"),
    captureDir, preferredRoute: "stdin",
  });
  need(transport.action === "ready" && transport.argv[0] === "exec" && transport.argv[1] === "-",
    "Codex non-argv prompt adapter changed");
  const paths = request.mutablePaths.map((name) => path.join(request.identity.workspace, name));
  const filesystem = await filesystemPolicy(request, role, registry, paths);
  return {
    command: role.executable.path, input: transport.stdinBytes, cwd: request.identity.workspace,
    env: workerEnvironment(role),
    args: ["exec", "--json", "--ephemeral", "--ignore-user-config", "--ignore-rules", "--color", "never",
      "-C", request.identity.workspace, ...commonSettings(filesystem), "-m", role.model, "-"],
  };
}

export async function smokeCheck({ request, role, registry, attemptDirectory, protectedFile, controlDirectory, run = runBoundedWorker }) {
  await ensureDedicatedConfiguration(role, request.identity.workspace);
  const workspace = request.identity.workspace;
  const status = checkoutStatus(workspace);
  const env = workerEnvironment(role);
  const command = role.executable.path;
  const version = await run(command, ["--version"], { cwd: workspace, env, timeoutMs: 4000, stdoutLimit: 4096, stderrLimit: 4096 });
  need(version.quiescent && version.outcome === "exit" && version.code === 0 &&
    version.stdout.toString().trim() === "codex-cli " + role.version, "Pinned Codex executable version differs");
  const scratchDirectory = path.join(workspace, ".runtime-probe-" + randomUUID());
  const scratch = path.join(scratchDirectory, "control.txt");
  const evidence = path.join(attemptDirectory, "request.md");
  const readOnly = path.join(workspace, "openspec/config.yaml");
  const tasks = path.join(workspace, "openspec/changes", request.identity.change, "tasks.md");
  const gitPaths = await checkoutProtectedPaths(workspace);
  // Opening an existing regular Git-state file for write is a denial check with no side effect on failure.
  const head = path.join(gitPaths.at(-1), "HEAD");
  const secret = path.join(controlDirectory, "synthetic-protected.txt");
  await writeClosed(secret, Buffer.from("synthetic-protected-control\n"));
  const proof = [];
  let scratchCreated = false;
  let settled = true;
  try {
    await mkdir(scratchDirectory, { mode: 0o700 });
    scratchCreated = true;
    await writeClosed(scratch, Buffer.from("workspace-probe-seed\n"));
    for (const mode of ["read-only", "workspace-write"]) {
      const writable = mode === "read-only" ? [] : [scratchDirectory];
      const filesystem = await filesystemPolicy(request, role, registry, writable);
      // The probe may replace a disposable file. Product edits use the exact grant paths.
      const args = ["sandbox", "-P", "worker", "-C", workspace, ...commonSettings(filesystem), "--", bin, "-I", "-B",
        "-c", shellProbe, mode, readOnly, scratch, tasks, secret, evidence, head, protectedFile];
      settled = false;
      const result = await run(command, args, { cwd: workspace, env, timeoutMs: 12000, stdoutLimit: 4096, stderrLimit: 16384 });
      settled = result.quiescent;
      need(settled && result.outcome === "exit" && result.code === 0 &&
        result.stdout.toString().trim() === "WORKSPACE_PROBE_OK " + mode, "Native Codex " + mode + " smoke predicate failed");
      proof.push({ mode, code: result.code, quiescent: true });
    }
    try { await lstat(scratch); throw new Error("Workspace probe did not remove its disposable file"); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
  } finally {
    if (settled && scratchCreated) {
      await unlink(scratch).catch((error) => { if (error.code !== "ENOENT") throw error; });
      await rmdir(scratchDirectory);
    }
    if (settled) need(equal(checkoutStatus(workspace), status), "Checkout status changed during native sandbox probe");
  }
  return { proof };
}
