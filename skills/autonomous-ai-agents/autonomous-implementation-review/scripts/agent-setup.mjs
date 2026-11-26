import { authDirectoryIdentity, defaultReviewerTimeoutMs, grokTierBlocker, maximumReviewerTimeoutMs, requireTier, tierFields } from "./containment-tier.mjs";
import { validatePiRelease } from "./agent-pi-runtime.mjs";
import { closeSync, constants, fstatSync, fsyncSync, lstatSync, openSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { disjoint, hashBytes, inspectPinnedFile, jsonBytes, trustedHostPath } from "./agent-configuration.mjs";
import { observeVersion } from "./agent-discovery.mjs";
import { grokReviewerBlocker, nativeRoleBinding, piReviewer, requirePiReviewer } from "./agent-role-adapters.mjs";
import { readRoleBindings, validateRoleBindings } from "./agent-role-config.mjs";
import { validateHarnessBinding } from "./harness-result.mjs";
import { absolute, clients, fields, need, roleConfig, token, validatePin } from "./role-config.mjs";
import { auditVersion, versionPolicy } from "./runtime-version.mjs";

const profileNames = [".agents", ".claude", ".codex", ".gemini", ".hermes", ".kilo", ".opencode", ".pi", ".ssh", ".gnupg"];
const profileRoots = ["agents", "claude", "claude-code", "codex", "gemini", "hermes", "kilo", "opencode", "openspec", "pi", "grok-build"];
const selectors = ["CODEX_HOME",
  "CLAUDE_CONFIG_DIR", "HERMES_HOME", "OPENCODE_CONFIG_DIR", "PI_CODING_AGENT_DIR", "GEMINI_CLI_HOME"];

function existingAliases(root) {
  try { return [root, realpathSync(root)]; }
  catch (error) {
    if (error.code !== "ENOENT" && error.code !== "ENOTDIR") throw error;
    return [root];
  }
}

function directoryState(directory, workspace) {
  need(process.platform === "linux" && process.getuid, "Confirmed setup requires Linux directory identity checks");
  need(absolute(directory) && realpathSync(directory) === directory && disjoint(directory, realpathSync(workspace)),
    "Setup directory aliases the repository or is not canonical");
  const home = os.homedir();
  const parents = [process.env.APPDATA, process.env.XDG_CONFIG_HOME ?? path.join(home, ".config"),
    process.env.XDG_DATA_HOME ?? path.join(home, ".local/share"),
    process.env.XDG_STATE_HOME ?? path.join(home, ".local/state")].filter(absolute);
  const profiles = [...profileNames.map((name) => path.join(home, name)),
    ...parents.flatMap((root) => profileRoots.map((name) => path.join(root, name))),
    ...selectors.map((name) => process.env[name]).filter(absolute)];
  need(profiles.flatMap(existingAliases).every((root) => disjoint(directory, root)) &&
    directory.split(path.sep).every((part) => !profileNames.includes(part)), "Setup directory aliases a live profile");
  for (let current = directory; current !== "/"; current = path.dirname(current)) {
    const metadata = path.join(current, ".git");
    const marker = lstatSync(metadata, { throwIfNoEntry: false });
    need(!marker || marker.isDirectory() &&
      !lstatSync(path.join(metadata, "HEAD"), { throwIfNoEntry: false }) &&
      !lstatSync(path.join(metadata, "config"), { throwIfNoEntry: false }), "Setup directory is inside a Git checkout");
  }
  const stat = lstatSync(directory);
  need(stat.isDirectory() && stat.uid === process.getuid() && !(stat.mode & 0o077),
    "Setup requires an existing private, user-owned host directory");
  return { device: stat.dev, inode: stat.ino };
}

export function validatePilotHost(input) {
  const tiered = input?.schemaVersion === 4;
  const dedicated = tiered && input.containmentTier === "b";
  fields(input, ["schemaVersion", "roleBinding", "bubblewrap", dedicated ? "authDirectory" : "relay",
    "maxTurns", "interPacketDelayMs", "timeoutMs", "maxBudgetUsd", ...(tiered ? tierFields : [])],
  ["runtime", "localHarness", "packetConcurrency", ...(tiered ? ["runTimeoutMs"] : [])], "reviewer pilot host");
  need(tiered || input.schemaVersion === 2, "Invalid reviewer pilot host schema");
  const roleBinding = roleConfig(input.roleBinding);
  const { relay, maxTurns, interPacketDelayMs, timeoutMs, maxBudgetUsd, packetConcurrency } = input;
  const tier = tiered ? requireTier(input, "reviewer", roleBinding.client) : {};
  if (dedicated) {
    need(absolute(input.authDirectory) && roleBinding.provider === "xai-oauth" && roleBinding.model === "grok-4.7" &&
      roleBinding.transport === "provider-https" && roleBinding.versionPolicy === "exact" &&
      roleBinding.versionCheck && roleBinding.exactVersion === "1.0.92", "Tier B requires explicit native Grok 1.0.92 xAI OAuth");
  } else {
    fields(relay, ["route", "credentialRef"], [], "named relay reference");
    need(["same-uid-key", "dedicated-uid-broker", "openrouter", "openai-compatible", "gemini", "xai-oauth", piReviewer.relay].includes(relay.route) &&
      token(relay.credentialRef) && !/^(?:sk-|ghp_|github_pat_)/i.test(relay.credentialRef), "Invalid named relay reference");
    if (relay.route === piReviewer.relay || roleBinding.client === piReviewer.client) {
      requirePiReviewer(roleBinding);
      need(relay.route === piReviewer.relay, "Pi reviewer requires the host Hermes proxy xAI OAuth relay");
    }
    if (relay.route === "xai-oauth") need(roleBinding.client === "grok-build" && roleBinding.provider === "xai-oauth" &&
      roleBinding.model === "grok-4.7" && roleBinding.transport === "unix-socket" &&
      roleBinding.versionPolicy === "exact" && roleBinding.versionCheck && roleBinding.exactVersion === "1.0.92",
    "Grok reviewer requires exact 1.0.92, grok-4.7 and host xAI OAuth over a Unix socket");
  }
  if (tiered && !dedicated) need(["same-uid-key", piReviewer.relay].includes(relay.route), "Unqualified Tier A relay");
  need(input.runTimeoutMs === undefined || Number.isSafeInteger(input.runTimeoutMs) &&
    input.runTimeoutMs >= 1000 && input.runTimeoutMs <= 3600000, "Invalid enclosing reviewer timeout");
  need(maxTurns === 96 && Number.isSafeInteger(interPacketDelayMs) && interPacketDelayMs >= 0 && interPacketDelayMs <= 30000 &&
    Number.isSafeInteger(timeoutMs) && timeoutMs >= 1000 && timeoutMs <= (tiered ? maximumReviewerTimeoutMs : defaultReviewerTimeoutMs) &&
    Number.isFinite(maxBudgetUsd) && maxBudgetUsd > 0 && maxBudgetUsd <= 10, "Invalid reviewer limits");
  need(packetConcurrency === undefined || Number.isSafeInteger(packetConcurrency) && packetConcurrency >= 1 &&
    packetConcurrency <= 3 && (packetConcurrency === 1 || ["same-uid-key", piReviewer.relay].includes(relay?.route)),
  "Invalid packetConcurrency or relay without packet isolation");
  fields(input.bubblewrap, ["executable"], ["versionPolicy", "versionCheck", "exactVersion", "minVersion", "maxVersion"],
    "Bubblewrap policy");
  let runtime;
  if (input.runtime !== undefined) {
    fields(input.runtime, ["node", "libraries", ...(!dedicated ? ["relayConfiguration"] : []),
      ...(roleBinding.client === piReviewer.client ? ["piRelease"] : [])], [], "reviewer runtime pins");
    const { node, libraries, relayConfiguration, piRelease } = input.runtime;
    need(Array.isArray(libraries) && libraries.length <= 64, "Invalid reviewer library pins");
    const targets = new Set();
    runtime = {
      node: validatePin(node), ...(!dedicated ? { relayConfiguration: validatePin(relayConfiguration) } : {}),
      ...(roleBinding.client === piReviewer.client ? { piRelease: validatePiRelease(piRelease) } : {}),
      libraries: libraries.map((entry) => {
        fields(entry, ["path", "sha256", "target"], [], "runtime library");
        const { target, ...pin } = entry;
        need(typeof target === "string" && /^\/(?:usr\/)?lib(?:64)?\/(?:[a-zA-Z0-9_-]+\/)?[a-zA-Z0-9_+-]+\.so(?:\.[\w.-]+)?$/.test(target) &&
          !targets.has(target), "Unsafe reviewer runtime library target");
        targets.add(target);
        return { ...validatePin(pin), target };
      }),
    };
  }
  if (input.localHarness != null) validateHarnessBinding(input.localHarness);
  if (tiered) need(runtime, "Tiered setup requires exact Node and runtime library pins");
  return { schemaVersion: input.schemaVersion, ...tier, roleBinding,
    bubblewrap: { executable: validatePin(input.bubblewrap.executable), ...versionPolicy(input.bubblewrap, "0.9.0") },
    ...(dedicated ? { authDirectory: input.authDirectory } : { relay }), maxTurns, interPacketDelayMs, timeoutMs, maxBudgetUsd,
    ...(input.runTimeoutMs === undefined ? {} : { runTimeoutMs: input.runTimeoutMs }),
    ...(packetConcurrency === undefined ? {} : { packetConcurrency }),
    ...(runtime === undefined ? {} : { runtime }), ...(input.localHarness === undefined ? {} : { localHarness: input.localHarness }) };
}

function worksetRootIdentity(directory) {
  need(absolute(directory) && trustedHostPath(directory) === directory, "Untrusted or noncanonical OpenSpec workset root");
  const stat = lstatSync(directory, { bigint: true });
  need(stat.isDirectory() && [0n, BigInt(process.getuid())].includes(stat.uid) && !(stat.mode & 0o022n),
    "Untrusted OpenSpec workset root");
  return { path: directory, device: String(stat.dev), inode: String(stat.ino), uid: String(stat.uid) };
}

function checkWorksetRoots(directories, approved, protectedPaths) {
  need(new Set(directories).size === directories.length, "Duplicate OpenSpec workset member");
  for (const directory of directories) {
    const expected = approved.get(directory);
    need(expected, "OpenSpec workset member is outside the approved workset roots");
    need(protectedPaths.every((file) => disjoint(directory, file)), "Pinned workset inputs overlap an attached directory");
    const actual = worksetRootIdentity(directory);
    need(actual.device === expected.device && actual.inode === expected.inode && actual.uid === expected.uid,
      "Approved OpenSpec workset root identity changed");
  }
}

export function readWorksetOpener(pin, receivedArgs, { workspace = process.cwd(), env = process.env } = {}) {
  const primary = realpathSync(workspace);
  const configuration = readRoleBindings(pin, [primary]);
  need(configuration.worksetRoots, "OpenSpec opener has no approved workset roots. Regenerate and confirm external setup");
  const binding = configuration.roles.orchestrator;
  const mapped = nativeRoleBinding(binding, "orchestrator");
  need(mapped.opener && !mapped.blocker, mapped.blocker ?? "Unsupported OpenSpec opener");
  const expected = [...mapped.openerArgs, ...mapped.args];
  need(expected.every((arg, index) => arg === receivedArgs[index]), "OpenSpec opener arguments differ from pinned role");
  const members = receivedArgs.slice(expected.length);
  need(members.length > 0 && members.length % 2 === 0 && members.every((arg, index) =>
    index % 2 === 0 ? arg === "--add-dir" : absolute(arg)),
  "Invalid OpenSpec workset members");
  const directories = members.filter((_, index) => index % 2 === 1);
  need(directories[0] === primary, "Primary OpenSpec workset member must equal the launch directory");
  const approved = new Map(configuration.worksetRoots.map((root) => [root.path, root]));
  const protectedPaths = [pin.path, configuration.reviewerHost.path, binding.executable.path];
  checkWorksetRoots(directories, approved, protectedPaths);
  const providerOverrides = binding.client === "claude-code"
    ? ["ANTHROPIC_BASE_URL", "ANTHROPIC_CUSTOM_HEADERS", "ANTHROPIC_MODEL", "CLAUDE_CODE_USE_BEDROCK", "CLAUDE_CODE_USE_VERTEX",
      "CLAUDE_CODE_USE_FOUNDRY", "CLAUDE_CODE_EFFORT_LEVEL"]
    : ["OPENAI_BASE_URL", "OPENAI_API_BASE", "CODEX_MODEL_PROVIDER"];
  need(providerOverrides.every((name) => !Object.hasOwn(env, name)), "Ambient provider, model or effort override prevents workset verification");
  inspectPinnedFile(binding.executable, { executable: true });
  const runtimeVersion = auditVersion(binding, observeVersion(binding.executable.path, { client: binding.client }), clients[binding.client].floor);
  inspectPinnedFile(binding.executable, { executable: true });
  checkWorksetRoots(directories, approved, protectedPaths);
  return { command: binding.executable.path, args: [...expected, ...members], runtimeVersion };
}

function outputState(file, bytes) {
  const st = lstatSync(file, { throwIfNoEntry: false });
  if (!st) return "absent";
  need(st.isFile() && st.nlink === 1 && st.uid === process.getuid() && !(st.mode & 0o077) &&
    st.size === bytes.length, "Setup destination conflicts: " + path.basename(file));
  const fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const opened = fstatSync(fd);
    need(opened.dev === st.dev && opened.ino === st.ino && readFileSync(fd).equals(bytes),
      "Setup destination conflicts: " + path.basename(file));
  } finally { closeSync(fd); }
  return "matching";
}

function pinTierInputs(input, tier, excluded) {
  const dedicated = tier === "b";
  const reviewer = input.reviewer;
  const safePin = (value, options) => {
    fields(value, ["path"], ["sha256"], "discovery pin");
    need(absolute(value.path) && !value.path.split(path.sep).some((part) => profileNames.includes(part) ||
      [".config", ".grok", "auth.json", "credentials.json"].includes(part)), "Runtime discovery path overlaps credential or profile state");
    return inspectPinnedFile(value, { discover: true, excluded, ...options });
  };
  const runtime = reviewer.runtime;
  fields(runtime, ["node", "libraries", ...(dedicated ? [] : ["relayConfiguration"])],
    input.roles.reviewer.client === piReviewer.client ? ["piRelease"] : [], "tier runtime");
  need(Array.isArray(runtime.libraries) && runtime.libraries.length <= 64, "Invalid reviewer library pins");
  const roles = Object.fromEntries(Object.entries(input.roles).map(([name, role]) => [name, role && {
    ...role, executable: safePin(role.executable, { executable: true }),
  }]));
  return { roles, reviewer: { ...reviewer, runtime: {
    ...runtime, node: safePin(runtime.node, { executable: true }),
    ...(!dedicated ? { relayConfiguration: validatePin(runtime.relayConfiguration) } : {}),
    libraries: runtime.libraries.map(({ target, ...pin }) => ({ ...safePin(pin, { runtime: true }), target })),
  }, bubblewrap: { ...reviewer.bubblewrap, executable: safePin(reviewer.bubblewrap.executable, { executable: true }) } } };
}

export function previewSetup(input, { workspace = process.cwd(), tier } = {}) {
  fields(input, ["schemaVersion", "directory", "roles", "reviewer"], ["worksetRoots"], "setup request");
  need(input.schemaVersion === 1, "Unsupported setup schema");
  const directory = input.directory;
  const identity = directoryState(directory, workspace);
  const dedicated = tier === "b";
  const choices = input.reviewer;
  fields(choices, ["bubblewrap", dedicated ? "authDirectory" : "relay", "interPacketDelayMs", ...(tier ? ["runtime"] : ["timeoutMs"])],
    ["maxBudgetUsd", "localHarness", "packetConcurrency", ...(tier ? ["osDriver", "timeoutMs", "runTimeoutMs"] : ["runtime"])],
    "reviewer choices");
  const tierBinding = tier ? { containmentTier: tier, osDriver: choices.osDriver ?? "linux-bwrap" } : {};
  if (tier) requireTier(tierBinding, "reviewer", input.roles?.reviewer?.client);
  const authIdentity = dedicated ? authDirectoryIdentity(choices.authDirectory, [directory, realpathSync(workspace)]) : undefined;
  const pinned = tier ? pinTierInputs(input, tier, [directory, realpathSync(workspace), ...(dedicated ? [choices.authDirectory] : [])]) : input;
  const { osDriver, ...reviewerChoices } = pinned.reviewer;
  const reviewer = validatePilotHost({ maxBudgetUsd: 2.50, timeoutMs: defaultReviewerTimeoutMs, ...reviewerChoices,
    ...tierBinding, schemaVersion: tier ? 4 : 2, maxTurns: 96, roleBinding: pinned.roles?.reviewer });
  const host = jsonBytes(reviewer);
  const configurationSha256 = hashBytes(host);
  const roots = input.worksetRoots ?? [realpathSync(workspace)];
  need(Array.isArray(roots) && roots.length > 0, "Expected approved OpenSpec workset roots");
  const roles = validateRoleBindings({ schemaVersion: 1, roles: pinned.roles,
    reviewerHost: { path: path.join(directory, "host.json"), sha256: configurationSha256 },
    worksetRoots: roots.map(worksetRootIdentity) });
  need(roots.every((root) => [directory, roles.roles.orchestrator.executable.path].every((file) => disjoint(root, file))),
    "Pinned workset inputs overlap an approved root");
  const mappings = Object.fromEntries(Object.entries(roles.roles).map(([role, binding]) =>
    [role, role === "reviewer" && dedicated ? { blocker: grokTierBlocker } : binding && nativeRoleBinding(binding, role)]));
  const opener = mappings.orchestrator;
  need(opener.opener && !opener.blocker, opener.blocker ?? "Unsupported OpenSpec opener");
  const roleBytes = jsonBytes(roles);
  const snippet = { openers: { [opener.opener]: { style: "attach-dirs", attach_flag: "--add-dir", command: process.execPath,
    args: [fileURLToPath(new URL("./setup.mjs", import.meta.url)), "--launch-opener", path.join(directory, "roles.json"),
      hashBytes(roleBytes), ...opener.openerArgs, ...opener.args] } } };
  const outputs = Object.entries({ "host.json": host, "roles.json": roleBytes, "openspec-openers.json": jsonBytes(snippet) })
    .map(([name, bytes]) => {
      const file = path.join(directory, name);
      return { name, path: file, utf8: bytes.toString("utf8"), sha256: hashBytes(bytes), state: outputState(file, bytes) };
    });
  const details = { schemaVersion: 1, directory, identity, configurationSha256, outputs, ...(tier ? {
    ...tierBinding,
    qualification: dedicated ? { status: "unqualified", reason: grokTierBlocker } :
      { status: "pending-exact-qualification", reason: "External setup does not qualify an exact runtime" },
    exposure: dedicated ? "Dedicated auth state and qualified provider HTTPS" : "Zero worker-visible credentials and host relay only",
    ...(dedicated ? { authIdentity } : {}),
  } : {}),
    mappingBlockers: { ...Object.fromEntries(Object.entries(mappings).filter(([, item]) => item?.blocker)
      .map(([name, item]) => [name, item.blocker])),
    ...(reviewer.roleBinding.client === piReviewer.client
      ? { reviewer: "Pi requires matching offline controls and separately granted bounded live proof" }
      : reviewer.roleBinding.client === "grok-build" ? { reviewer: dedicated ? grokTierBlocker : grokReviewerBlocker } : {}),
    ...(roles.roles.helper ? { helper: "No verified effective binding adapter for optional AI invocation" } : {}) } };
  return { ...details, confirmationSha256: hashBytes(jsonBytes(details)) };
}

export function applySetup(input, confirmationSha256, options = {}) {
  const preview = previewSetup(input, options);
  need(preview.confirmationSha256 === confirmationSha256, "Setup confirmation does not match the current preview");
  const fd = openSync(preview.directory, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  const actual = fstatSync(fd);
  const results = [];
  try {
    need(actual.dev === preview.identity.device && actual.ino === preview.identity.inode &&
      actual.uid === process.getuid() && !(actual.mode & 0o077), "Setup destination directory changed");
    for (const output of preview.outputs) {
      const file = path.join("/proc/self/fd", String(fd), output.name);
      const bytes = Buffer.from(output.utf8, "utf8");
      need(outputState(file, bytes) === output.state, "Setup destination changed: " + output.name);
      if (output.state === "absent") {
        const writer = openSync(file, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
        results.push({ path: output.path, status: "created-unverified" });
        try { writeFileSync(writer, bytes); fsyncSync(writer); }
        finally { closeSync(writer); }
      } else results.push({ path: output.path, status: "existing-unverified" });
      need(outputState(file, bytes) === "matching", "Setup readback failed");
      results.at(-1).status = "verified";
    }
    fsyncSync(fd);
    const final = previewSetup(input, options);
    need(JSON.stringify(final.authIdentity) === JSON.stringify(preview.authIdentity) &&
      final.identity.device === actual.dev && final.identity.inode === actual.ino &&
      final.outputs.every(({ state }) => state === "matching") && final.configurationSha256 === preview.configurationSha256,
    "Setup final directory, file bytes or configuration hash changed");
    return { status: "verified", configurationSha256: final.configurationSha256, outputs: results };
  } catch (error) {
    error.outputs = results;
    throw error;
  } finally { closeSync(fd); }
}
