import { lstat, mkdir, mkdtemp, readdir, realpath, rm } from "node:fs/promises";
import path from "node:path";
import { homedir, tmpdir, userInfo } from "node:os";
import { installedReviewer, invocation, reviewerAuthVariable, reviewerEnvironmentRoots, reviewerHelp,
  reviewerMetadataEnvironment, reviewerProvider } from "./review-direct-adapters.mjs";
import { classifyNativeOutputError, packetIdentity, sanitizeNative } from "./review-direct-receipt.mjs";
import { observeSupervisor, reviewBackends, superviseReview, supervisorCommand, unavailableProcess } from "./review-direct-supervisor.mjs";
import { observeWorktree } from "./review-direct-worktree.mjs";
import { checkExport, equal, fileLimit, hash, jsonBytes, need, separate } from "./review-inputs.mjs";
import { readClosed, safePath, writeClosed } from "./worker-handoff.mjs";
import { inspectPinnedFile, privatePath } from "./agent-configuration.mjs";
import { reportedVersion } from "./runtime-version.mjs";

const directDiagnostic = (proc) => {
  const message = proc.stderr.toString("utf8");
  if (/rate.limit|\b429\b/i.test(message)) return "upstream-rate-limited";
  if (/overload|\b52[39]\b/i.test(message)) return "upstream-overloaded";
  if (/\b40[13]\b|unauthenticated|authentication (?:required|failed)/i.test(message)) return "upstream-auth-failed";
  return proc.outcome === "exit" ? "client-failed" : proc.outcome;
};

async function rejectAmbientConfiguration(client, scratch, { SystemRoot }) {
  const names = {
    grok: [".grok", "AGENTS.md"],
    opencode: [".opencode", "opencode.json", "opencode.jsonc", ".agents", "AGENTS.md"],
  }[client];
  if (!names) return;
  const found = [];
  for (let parent = path.dirname(scratch); ; parent = path.dirname(parent)) {
    found.push(...names.map((name) => path.join(parent, name)));
    if (parent === path.dirname(parent)) break;
  }
  if (client === "grok" || client === "opencode") {
    const programData = SystemRoot && path.join(path.parse(SystemRoot).root, "ProgramData");
    found.push(programData ? path.join(programData, client) : path.join("/etc", client));
    if (client === "opencode" && process.platform === "darwin") {
      found.push("/Library/Application Support/opencode", "/Library/Managed Preferences/ai.opencode.managed.plist",
        path.join("/Library/Managed Preferences", userInfo().username, "ai.opencode.managed.plist"));
    }
  }
  for (const file of found) {
    try { await lstat(file); }
    catch (error) {
      if (error.code === "ENOENT") continue;
      throw new Error(`${client} cannot verify the absence of ambient review configuration`);
    }
    throw new Error(`${client} discovered an unmanaged configuration source outside the disposable review profile`);
  }
}

export async function observeDirectRuntime(config, excluded, { probe = false } = {}) {
  const executable = installedReviewer(config, excluded);
  const python = supervisorCommand(excluded);
  const roots = reviewerEnvironmentRoots(executable, python);
  if (process.platform === "darwin") {
    const modes = await Promise.all([lstat(executable), lstat(python)]);
    need(modes.every(({ mode }) => (mode & 0o6000) === 0), "macOS reviewer executables must be unprivileged");
  }
  const pinFile = () => inspectPinnedFile({ path: executable }, { executable: true, excluded, discover: true });
  const executableSha256 = pinFile().sha256;
  const auth = reviewerAuthVariable(config.reviewer);
  need(!auth || process.env[auth]?.trim(), `${config.client} requires ${auth ?? "its configured environment credential"} to avoid ambient profile fallback`);
  const supervisor = await observeSupervisor(python, excluded);
  const scratch = await mkdtemp(path.join(await realpath(tmpdir()), "direct-review-probe-"));
  let settled = true;
  try {
    need(excluded.every((root) => separate(scratch, root)) && privatePath(scratch), "Native CLI help requires a private disposable directory");
    await rejectAmbientConfiguration(config.client, scratch, roots);
    const home = path.join(scratch, "home");
    await mkdir(home, { mode: 0o700 });
    const env = reviewerMetadataEnvironment(roots, scratch);
    const metadata = async (args, label) => {
      const proc = await superviseReview(python, { executable, args, env, input: "" },
        { cwd: scratch, timeoutMs: 5000, noFork: process.platform === "darwin" });
      settled = proc.quiescent;
      need(proc.outcome === "exit" && proc.quiescent && proc.code === 0,
        `${config.client} did not settle successfully while reporting native ${label}`);
      return proc.stdout.toString("utf8");
    };
    const label = ({ grok: "grok-build", claude: "claude-code" })[config.client] ?? config.client;
    const versionArgs = config.client === "grok" ? ["--no-auto-update", "--version"] : ["--version"];
    const version = reportedVersion(await metadata(versionArgs, "version"), label);
    need(version, "Unable to bind native version for " + config.client);
    const { args, flags } = reviewerHelp(config.reviewer, version, config.proofLevel);
    const help = await metadata(args, "help");
    const supported = new Set(help.match(/(?<![\w-])--[\w-]+/g));
    const required = probe ? [...flags, "--max-budget-usd", "--max-turns"] : flags;
    const missing = required.filter((flag) => !supported.has(flag));
    need(missing.length === 0, `${config.client} native help lacks required options: ${missing.join(", ")}`);
    need(pinFile().sha256 === executableSha256, "Installed reviewer changed during native capability preflight");
    return { executable, python, runtime: { ...config.reviewer, provider: reviewerProvider(config.reviewer), version, executableSha256,
      environmentRootsSha256: hash(jsonBytes(roots)),
      capabilitySha256: hash(jsonBytes({ args, flags })), supervisor } };
  } finally {
    if (settled) await rm(scratch, { recursive: true, force: true, maxRetries: 2 });
  }
}

async function packetCopyStatus(root, files) {
  const found = new Set();
  const allowedDirectories = new Set([...files.keys()].flatMap((name) => {
    const pieces = name.split("/");
    return pieces.slice(0, -1).map((_, index) => pieces.slice(0, index + 1).join("/"));
  }));
  async function walk(directory, prefix) {
    await safePath(directory);
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const name = prefix + entry.name;
      const file = path.join(directory, entry.name);
      if (entry.isDirectory() && allowedDirectories.has(name)) {
        await walk(file, name + "/");
      } else {
        need(entry.isFile() && files.has(name) &&
          (await readClosed(file, fileLimit, true)).equals(files.get(name)), "Disposable packet copy changed");
        found.add(name);
      }
    }
  }
  await walk(root, "");
  need(found.size === files.size, "Disposable packet copy is incomplete");
  return true;
}

export async function runDirectPacket({ request, expect, prepared, config, executable, python, exportDirectory,
  excluded, index, session, prompt, begin, signal, probe = false }) {
  const workspace = probe ? null : request.worker.identity.workspace;
  const checkSource = () => probe ? true : checkExport(exportDirectory, expect.exportSha256, request);
  const observeSource = () => probe ? { head: request.snapshot.target, statusSha256: hash("synthetic"),
    contentSha256: expect.exportSha256 } : observeWorktree(workspace);
  const files = new Map(prepared.manifest.packets[index].paths.map((name) => [name, prepared.files.get(name)]));
  const temp = await realpath(tmpdir());
  const scratch = await mkdtemp(path.join(temp, "direct-review-"));
  const cwd = path.join(scratch, "packet");
  const promptFile = path.join(scratch, "prompt.txt");
  const launch = { schemaVersion: 1, packet: index + 1, ...packetIdentity(prepared, index, session), invocationSha256: null,
    backend: reviewBackends[process.platform], runtime: expect.runtime, timeoutMs: 0,
    before: null, after: null, exportBefore: false, exportAfter: false, copyBefore: false, copyAfter: false,
    process: { ...unavailableProcess, outcome: "not-started", quiescent: true }, diagnostic: null };
  let stdout = Buffer.alloc(0);
  let settlementUncertain = false;
  try {
    const supportFiles = new Map();
    try {
      launch.before = await observeSource();
      await checkSource();
      launch.exportBefore = true;
      need(excluded.every((root) => separate(scratch, root)) && privatePath(scratch), "Disposable workspace is not separate and private");
      await safePath(scratch);
      const environmentRoots = reviewerEnvironmentRoots(executable, python);
      need(hash(jsonBytes(environmentRoots)) === expect.runtime.environmentRootsSha256, "Native reviewer environment roots changed");
      await rejectAmbientConfiguration(config.client, scratch, environmentRoots);
      await mkdir(cwd, { mode: 0o700 });
      for (const [name, bytes] of files) {
        const file = path.join(cwd, name);
        await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
        await writeClosed(file, bytes, true);
      }
      const command = invocation({ config, executable, session, prompt, files, cwd, promptFile, environmentRoots });
      launch.invocationSha256 = command.fingerprint;
      if (command.attachment) supportFiles.set(promptFile, Buffer.from(command.attachment));
      if (command.home) await mkdir(command.home, { mode: 0o700 });
      for (const [name, value] of Object.entries(command.config ?? {})) {
        supportFiles.set(path.join(command.home, name), jsonBytes(value));
      }
      for (const [file, bytes] of supportFiles) {
        await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
        await writeClosed(file, bytes, true);
      }
      launch.copyBefore = await packetCopyStatus(cwd, files);
      const verifyExecutable = (file, sha256) => inspectPinnedFile({ path: file, sha256 }, {
        executable: true, excluded: excluded.filter((root) => root !== file), discover: true,
      });
      const noFork = process.platform === "darwin";
      if (noFork) {
        const modes = await Promise.all([lstat(executable), lstat(python)]);
        need(modes.every(({ mode }) => (mode & 0o6000) === 0), "macOS reviewer executables must be unprivileged");
      }
      verifyExecutable(executable, expect.runtime.executableSha256);
      verifyExecutable(python, expect.runtime.supervisor.executableSha256);
      need(launch.backend === expect.runtime.supervisor.backend, "Native supervisor backend changed");
      launch.timeoutMs = Math.min(config.timeoutMs, begin());
      if (launch.timeoutMs <= 0) return null;
      if (signal?.aborted) {
        launch.diagnostic = "canceled";
      } else {
        const proc = await superviseReview(python, command, { cwd, timeoutMs: launch.timeoutMs, signal, noFork });
        settlementUncertain = !proc.quiescent;
        const { code, quiescent, signal: processSignal, outcome } = proc;
        launch.process = { code, quiescent, signal: processSignal, outcome };
        if (outcome !== "exit" || code !== 0 || !quiescent) launch.diagnostic = directDiagnostic(proc);
        else {
          try {
            const redactions = [workspace, scratch, homedir(), command.env.HOME, command.env.USERPROFILE, ...Object.entries(command.env)
              .filter(([key, value]) => /KEY|TOKEN|CREDENTIAL/.test(key) && value.length >= 8).map(([, value]) => value)];
            stdout = sanitizeNative({ stdout: proc.stdout, format: command.format, cwd, files, redactions,
              launch, maxBudgetUsd: config.maxBudgetUsd, proofLevel: expect.proofLevel });
          } catch (error) {
            launch.diagnostic = "invalid-native-output";
            launch.diagnosticReason = classifyNativeOutputError(error);
          }
        }
      }
    } catch {
      if (launch.timeoutMs === 0) {
        launch.timeoutMs = Math.min(config.timeoutMs, begin());
        if (launch.timeoutMs <= 0) return null;
      }
      launch.diagnostic = "preflight-failed";
    } finally {
      try { launch.after = await observeSource(); } catch { /* Missing postflight is a stop. */ }
      try {
        await checkSource();
        launch.exportAfter = true;
      } catch { /* Preserve changed originals. */ }
      try {
        launch.copyAfter = await packetCopyStatus(cwd, files) &&
          (await Promise.all([...supportFiles].map(async ([file, bytes]) => (await readClosed(file, undefined, true)).equals(bytes))))
            .every(Boolean);
      } catch { /* Preserve the failed disposition. */ }
      if (!launch.before || !launch.after || !equal(launch.before, launch.after) || !launch.exportAfter || !launch.copyAfter) {
        launch.diagnostic = "integrity-failed";
        delete launch.diagnosticReason;
        delete launch.diagnosticDetail;
        stdout = Buffer.alloc(0);
      }
    }
    return { launch, stdout };
  } finally {
    if (!settlementUncertain) await rm(scratch, { recursive: true, force: true, maxRetries: 2 });
  }
}
