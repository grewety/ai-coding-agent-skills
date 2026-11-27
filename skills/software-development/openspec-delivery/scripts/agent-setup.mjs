import { closeSync, constants, fstatSync, fsyncSync, lstatSync, openSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { disjoint, hashBytes, inspectPinnedFile, jsonBytes, privatePath, trustedHostPath } from "./agent-configuration.mjs";
import { observeVersion } from "./agent-discovery.mjs";
import { directReviewSettings, nativeRoleBinding, validateDirectHost } from "./agent-role-adapters.mjs";
import { readRoleBindings, validateRoleBindings } from "./agent-role-config.mjs";
import { validateHarnessBinding } from "./harness-result.mjs";
import { absolute, clients, fields, need, roleConfig, token, validatePin } from "./role-config.mjs";
import { auditVersion } from "./runtime-version.mjs";

const profileNames = [".agents", ".agy", ".antigravity", ".grok", ".claude", ".codex", ".gemini", ".hermes", ".kilo", ".opencode", ".pi", ".ssh", ".gnupg"];
const profileRoots = ["agents", "claude", "claude-code", "codex", "gemini", "hermes", "kilo", "opencode", "openspec", "pi", "grok-build"];
const selectors = ["AGY_HOME", "GROK_HOME", "CODEX_HOME",
  "CLAUDE_CONFIG_DIR", "HERMES_HOME", "OPENCODE_CONFIG_DIR", "PI_CODING_AGENT_DIR", "GEMINI_CLI_HOME"];

function existingAliases(root) {
  try { return [root, realpathSync(root)]; }
  catch (error) {
    if (error.code !== "ENOENT" && error.code !== "ENOTDIR") throw error;
    return [root];
  }
}

function directoryState(directory, workspace) {
  need(["linux", "darwin", "win32"].includes(process.platform), "Unsupported native setup host");
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
  for (let current = directory; ; current = path.dirname(current)) {
    const metadata = path.join(current, ".git");
    const marker = lstatSync(metadata, { throwIfNoEntry: false });
    need(!marker || marker.isDirectory() &&
      !lstatSync(path.join(metadata, "HEAD"), { throwIfNoEntry: false }) &&
      !lstatSync(path.join(metadata, "config"), { throwIfNoEntry: false }), "Setup directory is inside a Git checkout");
    if (current === path.parse(current).root) break;
  }
  const stat = lstatSync(directory);
  need(stat.isDirectory() && privatePath(directory, stat),
    "Setup requires an existing private, user-owned host directory");
  return { device: stat.dev, inode: stat.ino };
}

function worksetRootIdentity(directory) {
  need(absolute(directory) && trustedHostPath(directory) === directory, "Untrusted or noncanonical OpenSpec workset root");
  const stat = lstatSync(directory, { bigint: true });
  need(stat.isDirectory() && (process.platform === "win32" || !(stat.mode & 0o022n)),
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
  need(st.isFile() && st.nlink === 1 && privatePath(file, st) &&
    st.size === bytes.length, "Setup destination conflicts: " + path.basename(file));
  const fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const opened = fstatSync(fd);
    need(opened.dev === st.dev && opened.ino === st.ino && readFileSync(fd).equals(bytes),
      "Setup destination conflicts: " + path.basename(file));
  } finally { closeSync(fd); }
  return "matching";
}

function previewDirectSetup(input, workspace) {
  fields(input, ["schemaVersion", "directory", "reviewer"],
    ["maxBudgetUsd", "interPacketDelayMs", "runTimeoutMs", "localHarness", "roles", "worksetRoots"], "Direct-CLI setup");
  const { directory, maxBudgetUsd = 2.50, interPacketDelayMs, runTimeoutMs, localHarness } = input;
  const identity = directoryState(directory, workspace);
  const reviewer = directReviewSettings(input.reviewer);
  const host = jsonBytes(validateDirectHost({ schemaVersion: 3, reviewer, maxBudgetUsd,
    ...(interPacketDelayMs === undefined ? {} : { interPacketDelayMs }),
    ...(runTimeoutMs === undefined ? {} : { runTimeoutMs }),
    ...(localHarness === undefined ? {} : { localHarness }) }));
  const configurationSha256 = hashBytes(host);
  const files = { "host.json": host };
  if (input.roles !== undefined) {
    const roots = input.worksetRoots ?? [realpathSync(workspace)];
    need(Array.isArray(roots) && roots.length > 0, "Expected approved OpenSpec workset roots");
    const roles = validateRoleBindings({ schemaVersion: 2, roles: input.roles,
      reviewerHost: { path: path.join(directory, "host.json"), sha256: configurationSha256 },
      worksetRoots: roots.map(worksetRootIdentity) });
    const opener = nativeRoleBinding(roles.roles.orchestrator, "orchestrator");
    need(opener.opener && !opener.blocker, opener.blocker ?? "Unsupported OpenSpec opener");
    need(roots.every((root) => [directory, roles.roles.orchestrator.executable.path].every((file) => disjoint(root, file))),
      "Pinned workset inputs overlap an approved root");
    files["roles.json"] = jsonBytes(roles);
    files["openspec-openers.json"] = jsonBytes({ openers: { [opener.opener]: { style: "attach-dirs", attach_flag: "--add-dir",
      command: process.execPath, args: [fileURLToPath(new URL("./setup.mjs", import.meta.url)), "--launch-opener",
        path.join(directory, "roles.json"), hashBytes(files["roles.json"]), ...opener.openerArgs, ...opener.args] } } });
  } else need(input.worksetRoots === undefined, "Workset roots require configured roles");
  const outputs = Object.entries(files).map(([name, bytes]) => {
    const file = path.join(directory, name);
    return { name, path: file, utf8: bytes.toString("utf8"), sha256: hashBytes(bytes), state: outputState(file, bytes) };
  });
  const details = { schemaVersion: 2, directory, identity, configurationSha256, outputs,
    authentication: "Normal installed-client authentication", mappingBlockers: {} };
  return { ...details, confirmationSha256: hashBytes(jsonBytes(details)) };
}

export function previewSetup(input, { workspace = process.cwd() } = {}) {
  need(input?.schemaVersion === 2, "Expected a Direct-CLI setup request");
  return previewDirectSetup(input, workspace);
}

export function applySetup(input, confirmationSha256, options = {}) {
  const preview = previewSetup(input, options);
  need(preview.confirmationSha256 === confirmationSha256, "Setup confirmation does not match the current preview");
  const fd = process.platform === "win32" ? null : openSync(preview.directory,
    constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  const actual = fd === null ? lstatSync(preview.directory) : fstatSync(fd);
  const results = [];
  try {
    need(actual.dev === preview.identity.device && actual.ino === preview.identity.inode &&
      privatePath(preview.directory, actual), "Setup destination directory changed");
    for (const output of preview.outputs) {
      const identity = directoryState(preview.directory, options.workspace ?? process.cwd());
      need(identity.device === actual.dev && identity.inode === actual.ino, "Setup destination directory changed");
      const file = process.platform === "linux" ? path.join("/proc/self/fd", String(fd), output.name) : output.path;
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
    if (fd !== null) fsyncSync(fd);
    const final = previewSetup(input, options);
    need(final.identity.device === actual.dev && final.identity.inode === actual.ino &&
      final.outputs.every(({ state }) => state === "matching") && final.configurationSha256 === preview.configurationSha256,
    "Setup final directory, file bytes or configuration hash changed");
    return { status: "verified", configurationSha256: final.configurationSha256, outputs: results };
  } catch (error) {
    error.outputs = results;
    throw error;
  } finally { if (fd !== null) closeSync(fd); }
}
