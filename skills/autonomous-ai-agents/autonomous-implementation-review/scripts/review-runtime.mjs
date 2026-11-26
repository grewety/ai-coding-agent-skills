import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { lstat, mkdir, mkdtemp, open } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { runBoundedWorker } from "./bounded-worker.mjs";
import { allocateReviewScratch, checkSocketLength, defaultReviewScratchRoot } from "./review-runtime-scratch.mjs";
import { validateHarnessBinding } from "./harness-result.mjs";
import { upstreamClasses } from "./review-upstream-status.mjs";
import { safePath, writeClosed } from "./worker-handoff.mjs";
import { absolute, digest, fields, hash, jsonBytes, need, relative, separate, uuid } from "./review-inputs.mjs";
import { inspectPinnedFile, parseStrictJson } from "./agent-configuration.mjs";
import { observeVersion } from "./agent-discovery.mjs";
import { validatePilotHost } from "./agent-setup.mjs";
import { pilotDisposition, requireQualifiedPilot } from "./adapter-qualification.mjs";
import { auditVersion, reportedVersion } from "./runtime-version.mjs";
import { grokReviewerBlocker, piReviewer } from "./agent-role-adapters.mjs";
import { verifyPiRelease } from "./agent-pi-runtime.mjs";
import { verifyHermesProxySocket, validateHermesProxySocket } from "./review-relay.mjs";
import { packetConcurrency } from "./review-packet-scheduler.mjs";

export const claudeVersion = "2.1.330";
export const bubblewrapVersion = "0.9.0";
const admittedPilots = new WeakMap();
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
  const pi = config?.schemaVersion === 3;
  fields(config, ["schemaVersion", "bwrap", pi ? "pi" : "claude", "node", "libraries", "model", "relay",
    "timeoutMs", "maxTurns", "maxBudgetUsd", "requirePreExposureAttestation"], "trusted host configuration",
  ["interPacketDelayMs", "runTimeoutMs", "localHarness", "packetConcurrency", ...(pi ? ["piRelease"] : [])]);
  const concurrency = packetConcurrency(config.packetConcurrency);
  if (config.localHarness !== undefined && config.localHarness !== null) validateHarnessBinding(config.localHarness);
  for (const [name, min, max] of [["interPacketDelayMs", 0, 30000], ["runTimeoutMs", 1000, 3600000]]) {
    need(config[name] === undefined || Number.isSafeInteger(config[name]) && config[name] >= min && config[name] <= max,
      "Invalid host pacing or run deadline");
  }
  need((pi ? config.model === piReviewer.model && admittedPilots.has(config) :
    config.schemaVersion === 1 && /^claude-[a-z0-9-]{2,100}$/.test(config.model)) &&
    config.requirePreExposureAttestation === false, "Unsupported host configuration or required pre-exposure attestation");
  for (const [name, pin] of Object.entries({ bwrap: config.bwrap, client: config.pi ?? config.claude, node: config.node })) {
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
  need(concurrency === 1 || ["same-uid-key", piReviewer.relay].includes(relay?.route), "Review relay has no verified packet isolation");
  if (pi) {
    fields(relay, ["route", "upstreamSocket"], "host Hermes proxy relay");
    need(relay.route === piReviewer.relay, "Invalid host-only Hermes proxy route");
    validateHermesProxySocket(relay.upstreamSocket);
    need(config.piRelease, "Missing pinned Pi release runtime");
  } else if (relay?.route === "same-uid-key") {
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

export function requireReviewHost(config, excluded, options = {}) {
  if (config?.schemaVersion !== 2) {
    validateHostConfig(config);
    return config;
  }
  const pilot = validatePilotHost(config);
  const { executable, ...policy } = pilot.bubblewrap;
  const pi = pilot.roleBinding.client === piReviewer.client;
  try {
    need(pilot.roleBinding.client !== "grok-build", grokReviewerBlocker);
    need(pi ? pilot.relay.route === piReviewer.relay : pilot.relay.route === "same-uid-key", pilot.relay.route === "dedicated-uid-broker"
      ? "Dedicated UID broker has no verified explicit effort and relay identity readback" : "Selected inference relay is contract-only");
    inspectPinnedFile(executable, { executable: true, excluded });
    const bubblewrapAudit = auditVersion(policy, observeVersion(executable.path, { client: "bubblewrap" }), bubblewrapVersion);
    inspectPinnedFile(executable, { executable: true, excluded });
    if (options.qualification || options.trialOffline) need(pilot.runtime, "Missing explicit Node, runtime library and relay configuration pins");
    const roleOptions = { ...options, excluded };
    if (pi) {
      need(pilot.runtime?.piRelease, "Missing pinned Pi release runtime");
      // Cross-check the executable version before verifying the closed release inventory.
      roleOptions.piReleaseVersion = pilot.runtime.piRelease.version;
    }
    if (pilot.runtime) roleOptions.context = {
      runtimeSha256: options.runtimeSha256, configurationSha256: options.configurationSha256,
      constraintsSha256: hash(jsonBytes({ runtime: pilot.runtime, bubblewrapAudit })),
      relaySha256: pilot.runtime.relayConfiguration.sha256,
    };
    const getBinding = () => {
      if (!options.trialOffline) return requireQualifiedPilot("reviewer", pilot.roleBinding, roleOptions);
      need(pi && !options.qualification, "Offline-only qualification is confined to the Pi trial");
      const result = pilotDisposition("reviewer", pilot.roleBinding, roleOptions);
      need(result.status === "trial-only", result.reason ?? "Missing pinned offline trial controls");
      return result;
    };
    const binding = getBinding();
    need(pilot.runtime, "Missing explicit Node, runtime library and relay configuration pins");
    const { node, libraries, relayConfiguration, piRelease } = pilot.runtime;
    const relayFile = parseStrictJson(inspectPinnedFile(relayConfiguration, { excluded, read: true }));
    const { schemaVersion, credentialRef, ...relay } = relayFile;
    need(schemaVersion === 1 && credentialRef === pilot.relay.credentialRef &&
      relay.route === pilot.relay.route, "Pinned relay does not resolve the selected route and credential reference");
    const runtime = {
      schemaVersion: pi ? 3 : 1, bwrap: executable, [pi ? "pi" : "claude"]: pilot.roleBinding.executable,
      node, libraries, relay, ...(piRelease ? { piRelease } : {}),
      model: pilot.roleBinding.model, maxTurns: pilot.maxTurns, timeoutMs: pilot.timeoutMs,
      interPacketDelayMs: pilot.interPacketDelayMs, maxBudgetUsd: pilot.maxBudgetUsd, requirePreExposureAttestation: false,
      ...(pilot.packetConcurrency === undefined ? {} : { packetConcurrency: pilot.packetConcurrency }),
      ...(pilot.localHarness === undefined ? {} : { localHarness: pilot.localHarness }),
    };
    admittedPilots.set(runtime, { args: binding.args, role: binding.binding, bubblewrapAudit, relayConfiguration,
      configurationSha256: options.configurationSha256, runtimeSha256: options.runtimeSha256,
      qualificationSha256: binding.qualificationSha256, offlineSha256: binding.offlineSha256,
      recheck: async () => {
        need(typeof options.verifyRuntimeIdentity === "function" && await options.verifyRuntimeIdentity() === options.runtimeSha256,
          "Qualified reviewer package bytes changed before launch");
        if (options.hostPin) inspectPinnedFile(options.hostPin, { excluded });
        inspectPinnedFile(relayConfiguration, { excluded });
        inspectPinnedFile(executable, { executable: true, excluded });
        getBinding();
      } });
    validateHostConfig(runtime);
    return runtime;
  } catch (cause) {
    if (cause.disposition) throw cause;
    const reason = cause.code ?? cause.message;
    const error = new Error("unsupported reviewer: " + reason);
    error.disposition = { status: "unsupported", role: "reviewer", client: pilot.roleBinding.client, reason };
    throw error;
  }
}

export function containmentArgs(config, exportDirectory, socket, runtime, piSnapshot) {
  const pi = config.schemaVersion === 3;
  if (pi) need(absolute(piSnapshot) && uuid(runtime.session), "Missing verified Pi release snapshot or session");
  return [
    "--unshare-all", "--unshare-user", "--die-with-parent", "--new-session", "--disable-userns", "--cap-drop", "ALL",
    "--clearenv", "--proc", "/proc", "--remount-ro", "/proc", "--dev", "/dev", "--remount-ro", "/dev",
    "--tmpfs", "/scratch", "--ro-bind", exportDirectory, "/review",
    "--ro-bind", socket, "/control/inference.sock", "--ro-bind", bridge, "/control/bridge.mjs",
    ...(pi ? ["--ro-bind", path.join(piSnapshot, "node_modules"), "/control/node_modules"] :
      ["--ro-bind", config.claude.path, "/control/claude"]),
    "--ro-bind", config.node.path, "/control/node",
    ...config.libraries.flatMap((mount) => ["--ro-bind", mount.path, mount.target]),
    ...Object.entries({
      PATH: "/control", HOME: "/scratch/home", TMPDIR: "/scratch/tmp",
      XDG_CONFIG_HOME: "/scratch/config", XDG_DATA_HOME: "/scratch/data", XDG_CACHE_HOME: "/scratch/cache",
      XDG_STATE_HOME: "/scratch/state", LANG: "C.UTF-8", CI: "1",
      ...(pi ? { PI_OFFLINE: "1", PI_TELEMETRY: "0", PI_CODING_AGENT_DIR: "/scratch/config/pi" } : {
      CLAUDE_CONFIG_DIR: "/scratch/config/claude", DISABLE_AUTOUPDATER: "1", CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
      DISABLE_TELEMETRY: "1", DISABLE_ERROR_REPORTING: "1", DISABLE_BUG_COMMAND: "1",
      CLAUDE_CODE_DISABLE_BUILTIN_PLUGINS: "1", ANTHROPIC_API_KEY: "relay-managed",
      }),
    }).flatMap(([name, value]) => ["--setenv", name, value]),
    "--remount-ro", "/", "--chdir", "/review", "--", "/control/node", "/control/bridge.mjs",
    ...(pi ? ["--pi-review", "--mode", "json", "--offline", "--no-session", "--session-id", runtime.session, "--no-context-files",
      "--no-approve", "--no-extensions", "--no-skills", "--no-prompt-templates", "--no-themes", "--no-mcp", "--tools", "read",
      ...admittedPilots.get(config).args] : [
    "--print", "--verbose", "--output-format", "stream-json", "--session-id", runtime.session,
    ...(admittedPilots.get(config)?.args ?? ["--model", config.model]),
    "--permission-mode", "dontAsk", "--tools", "Read", "--allowedTools", "Read",
    "--no-session-persistence", "--setting-sources", "", "--settings", pluginSettings,
    "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}',
    "--disable-slash-commands", "--no-chrome", "--permission-prompts", "none", "--max-turns", String(config.maxTurns), "--max-budget-usd", String(config.maxBudgetUsd),
    ]),
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

export async function verifyRuntimePins(config, excluded) {
  await Promise.all([...[config.bwrap, config.node, config.pi ?? config.claude, ...config.libraries]
    .map((pin) => verifyPin(pin, excluded)), ...(config.pi ? [verifyPiRelease(config.piRelease, excluded)] : [])]);
}

export function reviewRelaySource(config) {
  return config.relay.keyFile ?? config.relay.socket ?? config.relay.upstreamSocket?.path ?? admittedPilots.get(config)?.relayConfiguration.path;
}

export function runtimeBinding(config, session, configurationSha256 = hash(jsonBytes(config))) {
  const pilot = admittedPilots.get(config);
  if (pilot) need(pilot.configurationSha256 === configurationSha256, "Explicit reviewer configuration pin mismatch");
  return { session, model: config.model, version: pilot?.role.runtimeVersion.observedVersion ?? claudeVersion,
    bubblewrapVersion: pilot?.bubblewrapAudit.observedVersion ?? bubblewrapVersion,
    maxTurns: config.maxTurns, maxBudgetUsd: config.maxBudgetUsd,
    configurationSha256, route: config.relay.route,
    ...(pilot ? { explicit: { provider: pilot.role.provider, reasoningEffort: pilot.role.reasoningEffort,
      executableSha256: pilot.role.executable.sha256, version: pilot.role.runtimeVersion, bubblewrap: pilot.bubblewrapAudit,
      relaySha256: pilot.relayConfiguration.sha256, runtimeSha256: pilot.runtimeSha256,
      ...(pilot.offlineSha256 ? { offlineSha256: pilot.offlineSha256 } : { qualificationSha256: pilot.qualificationSha256 }),
      ...(config.pi ? { client: piReviewer.client, timeoutMs: config.timeoutMs, requestLimit: config.maxTurns,
        piReleaseSha256: config.piRelease.inventorySha256 } : {}) } } : {}) };
}

async function brokerSocket(relay, excluded) {
  need(excluded.every((root) => separate(root, relay.socket)), "Broker socket overlaps protected roots");
  checkSocketLength(relay.socket);
  await safePath(relay.socket);
  const st = await lstat(relay.socket);
  const parent = await lstat(path.dirname(relay.socket));
  need(st.isSocket() && st.uid === relay.ownerUid && (st.mode & 0o777) === 0o660 && parent.uid === relay.ownerUid &&
    (parent.mode & 0o022) === 0, "Unverified dedicated broker socket");
  return relay.socket;
}

async function sameUidRelay(config, scratch, requestLimit, onFailure, allowedPaths) {
  const socket = path.join(scratch, "inference.sock");
  checkSocketLength(socket);
  const child = spawn(admittedPilots.has(config) ? config.node.path : process.execPath, [moduleFile("./review-relay.mjs")], {
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
    socket, ...(config.pi ? { route: config.relay.route, upstreamSocket: config.relay.upstreamSocket, allowedPaths } :
      { keyFile: config.relay.keyFile, keyFormat: config.relay.keyFormat }),
    model: config.model, requestLimit, socketMode: 0o600,
    timeoutMs: config.timeoutMs,
    ...(admittedPilots.has(config) ? { reasoningEffort: admittedPilots.get(config).role.reasoningEffort } : {}),
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
  try {
    await start;
    const entry = await lstat(socket);
    need(entry.isSocket() && entry.uid === process.getuid() && (entry.mode & 0o7777) === 0o600,
      "Unsafe same-UID relay socket");
  } catch (error) {
    try { await close(); } catch (closeError) { closeError.relayUnsettled = true; throw closeError; }
    throw error;
  }
  return { socket, close, diagnostic: relayDiagnostics(child, onFailure) };
}

export function relayDiagnostics(child, onFailure) {
  let classification;
  let sequence = 0;
  child.on("message", (event) => {
    if (classification === undefined && upstreamClasses.includes(event?.upstreamStatus)) {
      classification = event.upstreamStatus;
      onFailure?.(classification);
    }
  });
  return () => new Promise((resolve, reject) => {
    const token = ++sequence;
    need(Number.isSafeInteger(token), "Host relay diagnostic sequence exhausted");
    const expected = Buffer.alloc(8);
    expected.writeBigUInt64BE(BigInt(token));
    const done = () => { child.off("message", received); clearTimeout(timeout); };
    const received = (event) => {
      const barrier = event?.barrier;
      if (!Number.isSafeInteger(barrier) || barrier <= 0) return;
      const actual = Buffer.alloc(8);
      actual.writeBigUInt64BE(BigInt(barrier));
      if (!timingSafeEqual(actual, expected)) return;
      done();
      const status = classification;
      classification = undefined;
      resolve(status);
    };
    const timeout = setTimeout(() => { done(); reject(new Error("Host relay diagnostic settlement failed")); }, 1000);
    child.on("message", received);
    child.send({ barrier: token }, (error) => { if (error) { done(); reject(new Error("Host relay unavailable")); } });
  });
}

export async function withReviewRuntime(config, { parent, excluded, packetCount, scratchRoot, configurationSha256 }, callback, startRelay = sameUidRelay) {
  validateHostConfig(config);
  const pilot = admittedPilots.get(config);
  const recheck = async () => {
    if (pilot) {
      await pilot.recheck();
      await verifyRuntimePins(config, excluded);
    }
  };
  need(process.platform === "linux", "Linux namespaces and pidfds required");
  await verifyRuntimePins(config, excluded);
  const bwrap = await runBoundedWorker(config.bwrap.path, ["--version"], {
    cwd: parent, env: launcherEnv, timeoutMs: 4000, stdoutLimit: 4096, stderrLimit: 4096,
  });
  need(bwrap.quiescent && bwrap.outcome === "exit" && bwrap.code === 0 &&
    (pilot ? reportedVersion(bwrap.stdout.toString(), "bubblewrap") === pilot.bubblewrapAudit.observedVersion :
      bwrap.stdout.toString().trim() === "bubblewrap " + bubblewrapVersion), "Bubblewrap version pin mismatch");
  await recheck();
  if (config.relay.route === "same-uid-key") {
    need(excluded.every((root) => separate(root, config.relay.keyFile)), "Host key overlaps protected roots");
  }
  if (config.pi) {
    need(excluded.every((root) => separate(root, config.relay.upstreamSocket.path)), "Hermes proxy socket overlaps protected roots");
    await verifyHermesProxySocket(config.relay.upstreamSocket);
  }
  const root = scratchRoot ?? await defaultReviewScratchRoot();
  const withScratch = async (invocations, onFailure, use) => {
    const owned = await allocateReviewScratch(root, [parent, ...excluded]);
    const scratch = owned.directory;
    let relay;
    let workersSettled = true;
    const run = async ({ files, session = randomUUID(), prompt, timeoutMs = config.timeoutMs, begin, retain }) => {
      need(workersSettled, "Previous reviewer process has no quiescence proof");
      await recheck();
      await owned.verify();
      const piSnapshot = config.pi ? path.join(scratch, "pi-release") : undefined;
      if (piSnapshot) await verifyPiRelease(config.piRelease, excluded, piSnapshot);
      const packet = await mkdtemp(path.join(scratch, "packet-"));
      for (const [name, bytes] of files) {
        need(relative(name), "Unsafe runtime packet path");
        const filename = path.join(packet, name);
        await mkdir(path.dirname(filename), { recursive: true, mode: 0o700 });
        await writeClosed(filename, bytes, true);
      }

      if (config.pi) relay = await startRelay(config, scratch, config.maxTurns, onFailure, [...files.keys()]);
      const runtime = runtimeBinding(config, session, configurationSha256);
      const args = containmentArgs(config, packet, relay.socket, runtime, piSnapshot);
      const input = Buffer.from(prompt);
      if (begin) {
        timeoutMs = begin();
        if (timeoutMs === 0) return null;
      }
      need(timeoutMs > 0, "Review deadline expired before launch");
      workersSettled = false;
      const proc = await runBoundedWorker(config.bwrap.path, args, {
        cwd: scratch, env: launcherEnv, input, timeoutMs: Math.min(timeoutMs, config.timeoutMs),
        postLeaderGraceMs: 250, // Bubblewrap's namespace reaper can outlive its status-reporting launcher.
        stdoutLimit: 8 * 1024 * 1024, stderrLimit: 128 * 1024,
      });
      workersSettled = proc.quiescent;
      retain?.({ runtime, proc });
      const upstreamStatus = await relay.diagnostic?.();
      const observation = { runtime, proc, ...(upstreamStatus ? { upstreamStatus } : {}) };
      retain?.(observation);
      return observation;
    };
    try {
      if (!config.pi) {
        relay = config.relay.route === "same-uid-key"
          ? await startRelay(config, scratch, Math.min((config.maxTurns + 8) * invocations, 4096), onFailure)
          : { socket: await brokerSocket(config.relay, excluded), close: async () => {} };
        checkSocketLength(relay.socket);
      }
      return await use(run);
    } catch (error) {
      if (error.relayUnsettled) workersSettled = false;
      throw error;
    } finally {
      await relay?.close();
      if (workersSettled) await owned.clean();
      else throw new Error("Reviewer process has no quiescence proof; private scratch retained");
    }
  };
  if (!config.pi && packetConcurrency(config.packetConcurrency) === 1) return withScratch(packetCount + 1, undefined, callback);
  return callback((input) => withScratch(1, input.onFailure, (run) => run(input)));
}
