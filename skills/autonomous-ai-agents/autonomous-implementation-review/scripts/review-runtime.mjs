import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { lstat, mkdir, mkdtemp, open, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { runBoundedWorker } from "./bounded-worker.mjs";
import { safePath, writeClosed } from "./worker-handoff.mjs";
import { absolute, digest, fields, hash, jsonBytes, need, separate } from "./review-inputs.mjs";

export const claudeVersion = "2.1.330";
export const bubblewrapVersion = "0.9.0";
const moduleFile = (name) => fileURLToPath(new URL(name, import.meta.url));
const bridge = moduleFile("./review-sandbox-bridge.mjs");
const launcherEnv = { PATH: "/usr/bin:/bin", HOME: "/nonexistent", LC_ALL: "C" };
const pluginSettings = JSON.stringify({ enabledPlugins: {
  "cc-plugin-sec-default@builtin": false,
  "cc-plugin-agents-md@builtin": false,
  "cc-plugin-privacy@builtin": false,
  "cc-plugin-plugin-authoring@builtin": false,
} });

export function validateHostConfig(config) {
  fields(config, ["schemaVersion", "bwrap", "claude", "node", "libraries", "model", "relay",
    "timeoutMs", "maxTurns", "maxBudgetUsd", "requirePreExposureAttestation"], "trusted host configuration");
  need(config.schemaVersion === 1 && /^claude-[a-z0-9-]{2,100}$/.test(config.model) &&
    config.requirePreExposureAttestation === false, "Unsupported host configuration or required pre-exposure attestation");
  for (const [name, pin] of Object.entries({ bwrap: config.bwrap, claude: config.claude, node: config.node })) {
    fields(pin, ["path", "sha256"], name + " binary pin");
    need(absolute(pin.path) && digest(pin.sha256), "Invalid binary pin");
  }
  need(Array.isArray(config.libraries) && config.libraries.length <= 64, "Invalid runtime mount allowlist");
  const targets = new Set();
  for (const mount of config.libraries) {
    fields(mount, ["path", "sha256", "target"], "runtime library");
    need(absolute(mount.path) && digest(mount.sha256) &&
      /^\/(?:usr\/)?lib(?:64)?\/(?:[a-zA-Z0-9_-]+\/)?[a-zA-Z0-9_+-]+\.so(?:\.[\w.-]+)?$/.test(mount.target) &&
      !targets.has(mount.target), "Unsafe runtime mount target");
    targets.add(mount.target);
  }
  for (const [name, min, max] of [["timeoutMs", 1000, 300000], ["maxTurns", 1, 128]]) {
    need(Number.isSafeInteger(config[name]) && config[name] >= min && config[name] <= max, "Invalid finite runtime limit");
  }
  need(Number.isFinite(config.maxBudgetUsd) && config.maxBudgetUsd > 0 && config.maxBudgetUsd <= 10, "Invalid finite cost limit");
  const relay = config.relay;
  if (relay?.route === "same-uid-key") {
    fields(relay, ["route", "keyFile", "keyFormat"], "same-UID key route");
    need(absolute(relay.keyFile) && ["raw", "assignment"].includes(relay.keyFormat), "Invalid host key source");
  } else if (relay?.route === "dedicated-uid-broker") {
    fields(relay, ["route", "socket", "ownerUid"], "dedicated UID broker route");
    need(absolute(relay.socket) && path.basename(relay.socket) === "inference.sock" &&
      Number.isSafeInteger(relay.ownerUid) && relay.ownerUid > 0 && relay.ownerUid !== process.getuid(), "Invalid dedicated broker identity");
  } else if (relay?.route === "scoped-oauth") {
    throw new Error("Scoped OAuth is unavailable under the pinned inference and startup constraints");
  } else {
    throw new Error("Unqualified or unavailable credential route");
  }
}

export function containmentArgs(config, exportDirectory, socket, runtime) {
  return [
    "--unshare-all", "--unshare-user", "--die-with-parent", "--new-session", "--disable-userns", "--cap-drop", "ALL",
    "--clearenv", "--proc", "/proc", "--remount-ro", "/proc", "--dev", "/dev", "--remount-ro", "/dev",
    "--tmpfs", "/scratch", "--ro-bind", exportDirectory, "/review",
    "--ro-bind", socket, "/control/inference.sock", "--ro-bind", bridge, "/control/bridge.mjs",
    "--ro-bind", config.claude.path, "/control/claude", "--ro-bind", config.node.path, "/control/node",
    ...config.libraries.flatMap((mount) => ["--ro-bind", mount.path, mount.target]),
    ...Object.entries({
      PATH: "/control", HOME: "/scratch/home", TMPDIR: "/scratch/tmp",
      XDG_CONFIG_HOME: "/scratch/config", XDG_DATA_HOME: "/scratch/data", XDG_CACHE_HOME: "/scratch/cache",
      XDG_STATE_HOME: "/scratch/state", CLAUDE_CONFIG_DIR: "/scratch/config/claude",
      LANG: "C.UTF-8", CI: "1", DISABLE_AUTOUPDATER: "1", CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
      DISABLE_TELEMETRY: "1", DISABLE_ERROR_REPORTING: "1", DISABLE_BUG_COMMAND: "1",
      CLAUDE_CODE_DISABLE_BUILTIN_PLUGINS: "1", MAX_THINKING_TOKENS: "0", ANTHROPIC_API_KEY: "relay-managed",
    }).flatMap(([name, value]) => ["--setenv", name, value]),
    "--remount-ro", "/", "--chdir", "/review", "--", "/control/node", "/control/bridge.mjs",
    "--print", "--verbose", "--output-format", "stream-json", "--session-id", runtime.session,
    "--model", config.model, "--permission-mode", "dontAsk", "--tools", "Read", "--allowedTools", "Read",
    "--no-session-persistence", "--setting-sources", "", "--settings", pluginSettings,
    "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}',
    "--disable-slash-commands", "--no-chrome", "--permission-prompts", "none", "--max-turns", String(config.maxTurns), "--max-budget-usd", String(config.maxBudgetUsd),
  ];
}

async function verifyPin(pin, excluded) {
  need(excluded.every((root) => separate(root, pin.path)), "Runtime input overlaps review data or output");
  await safePath(pin.path);
  const handle = await open(pin.path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const before = await handle.stat();
    need(before.isFile() && (before.mode & 0o022) === 0 && [process.getuid(), 0].includes(before.uid) &&
      before.size > 0 && before.size <= 512 * 1024 * 1024, "Unsafe runtime pin");
    const hasher = createHash("sha256");
    for await (const chunk of handle.createReadStream({ autoClose: false, start: 0, end: before.size - 1 })) hasher.update(chunk);
    const after = await lstat(pin.path);
    need(after.ino === before.ino && after.dev === before.dev && after.size === before.size &&
      after.ctimeMs === before.ctimeMs && hasher.digest("hex") === pin.sha256, "Runtime pin changed");
  } finally { await handle.close(); }
}

export function runtimeBinding(config, session) {
  return { session, model: config.model, version: claudeVersion, bubblewrapVersion,
    maxTurns: config.maxTurns, maxBudgetUsd: config.maxBudgetUsd,
    configurationSha256: hash(jsonBytes(config)), route: config.relay.route };
}

async function brokerSocket(relay, excluded) {
  need(excluded.every((root) => separate(root, relay.socket)), "Broker socket overlaps protected roots");
  await safePath(relay.socket);
  const st = await lstat(relay.socket);
  const parent = await lstat(path.dirname(relay.socket));
  need(st.isSocket() && st.uid === relay.ownerUid && (st.mode & 0o777) === 0o660 && parent.uid === relay.ownerUid &&
    (parent.mode & 0o022) === 0, "Unverified dedicated broker socket");
  return relay.socket;
}

async function sameUidRelay(config, scratch, requestLimit) {
  const socket = path.join(scratch, "inference.sock");
  const child = spawn(process.execPath, [moduleFile("./review-relay.mjs")], {
    env: launcherEnv, stdio: ["pipe", "ignore", "ignore", "ipc"],
  });
  // Exit can precede close of the parent-side IPC and stdin handles.
  let exited = false;
  const stopped = new Promise((resolve) => {
    const done = () => { exited = true; resolve(); };
    child.once("exit", done);
    child.on("error", () => { if (child.pid === undefined) done(); });
  });
  child.stdin?.on("error", () => {});
  const start = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Host relay startup timed out")), 5000);
    child.once("message", (event) => {
      clearTimeout(timeout);
      if (event?.ready === true) resolve();
      else reject(new Error("Host relay readiness failed"));
    });
    child.once("error", () => { clearTimeout(timeout); reject(new Error("Host relay unavailable")); });
    child.once("exit", () => { clearTimeout(timeout); reject(new Error("Host relay stopped before readiness")); });
  });
  child.stdin?.end(jsonBytes({
    socket, keyFile: config.relay.keyFile, keyFormat: config.relay.keyFormat, model: config.model, requestLimit, socketMode: 0o600,
  }));
  const close = async () => {
    child.stdin?.destroy();
    if (child.connected) child.disconnect();
    if (exited) return;
    const term = setTimeout(() => { if (!exited) child.kill("SIGTERM"); }, 500);
    const kill = setTimeout(() => { if (!exited) child.kill("SIGKILL"); }, 1500);
    let deadline;
    try {
      await Promise.race([stopped, new Promise((_, reject) => {
        deadline = setTimeout(() => reject(new Error("Host relay did not exit")), 3000);
      })]);
    } finally {
      clearTimeout(term);
      clearTimeout(kill);
      clearTimeout(deadline);
    }
  };
  try { await start; } catch (error) { await close(); throw error; }
  return { socket, close };
}

export async function withReviewRuntime(config, { parent, excluded, packetCount }, callback, startRelay = sameUidRelay) {
  validateHostConfig(config);
  need(process.platform === "linux", "Linux namespaces and pidfds required");
  await Promise.all([config.bwrap, config.node, config.claude, ...config.libraries].map((pin) => verifyPin(pin, excluded)));
  const bwrap = await runBoundedWorker(config.bwrap.path, ["--version"], {
    cwd: parent, env: launcherEnv, timeoutMs: 4000, stdoutLimit: 4096, stderrLimit: 4096,
  });
  need(bwrap.quiescent && bwrap.outcome === "exit" && bwrap.code === 0 &&
    bwrap.stdout.toString().trim() === "bubblewrap " + bubblewrapVersion, "Bubblewrap version pin mismatch");
  const scratch = await mkdtemp(path.join(parent, "runtime-"));
  let relay;
  try {
    if (config.relay.route === "same-uid-key") {
      need(excluded.every((root) => separate(root, config.relay.keyFile)), "Host key overlaps protected roots");
      relay = await startRelay(config, scratch, Math.min((config.maxTurns + 8) * (packetCount + 1), 4096));
    } else relay = { socket: await brokerSocket(config.relay, excluded), close: async () => {} };
    return await callback(async ({ files, session = randomUUID(), prompt }) => {
      const packet = await mkdtemp(path.join(scratch, "packet-"));
      for (const [name, bytes] of files) {
        const filename = path.join(packet, name);
        await mkdir(path.dirname(filename), { recursive: true, mode: 0o700 });
        await writeClosed(filename, bytes, true);
      }

      const runtime = runtimeBinding(config, session);
      const proc = await runBoundedWorker(config.bwrap.path, containmentArgs(config, packet, relay.socket, runtime), {
        cwd: scratch, env: launcherEnv, input: Buffer.from(prompt), timeoutMs: config.timeoutMs,
        postLeaderGraceMs: 250, // Bubblewrap's namespace reaper can outlive its status-reporting launcher.
        stdoutLimit: 8 * 1024 * 1024, stderrLimit: 128 * 1024,
      });
      return { runtime, proc };
    });
  } finally {
    try { await relay?.close(); }
    finally { await rm(scratch, { recursive: true, force: true }); }
  }
}
