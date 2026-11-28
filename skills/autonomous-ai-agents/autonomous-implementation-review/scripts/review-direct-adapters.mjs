import { lstatSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { resolveInstalledExecutable } from "./agent-discovery.mjs";
import { directReviewSettings, validateDirectHost } from "./agent-role-adapters.mjs";
import { reviewProofLevels } from "./low-touch-policy.mjs";
import { hash, jsonBytes, need, utf8 } from "./review-inputs.mjs";

const noMcp = '{"mcpServers":{}}';

export function directReviewHost(value) {
  const { proofLevel, ...host } = value ?? {};
  const config = validateDirectHost(host);
  need(proofLevel === undefined || reviewProofLevels.includes(proofLevel), "Unsupported host review proof level");
  return { ...config, ...config.reviewer, ...(proofLevel ? { proofLevel } : {}) };
}

const provider = {
  claude: "anthropic", codex: "openai", grok: "xai", hermes: "hermes",
  agy: "google", pi: "pi",
};

const effort = (flag, value) => value === undefined ? [] : [flag, value];
const isolatedClients = new Set(["grok", "opencode", "kilo", "agy"]);
const denyAll = { "*": "deny" };
const agySettings = { toolPermission: "strict", agentMode: "", allowNonWorkspaceAccess: false, modelProvider: "gemini",
  permissions: { allow: [], ask: [], deny: ["read_file(*)", "write_file(*)", "command(*)", "read_url(*)", "mcp(*)"] } };
const openCodeSettings = { permissions: [{ action: "*", resource: "*", effect: "deny" }],
  policies: ["tool.use", "mcp.use", "plugin.use", "skill.use"].map((action) => ({ action, resource: "*", effect: "deny" })) };

export function directAdapter(settings, session, maxBudgetUsd) {
  const { client, model, reasoningEffort } = directReviewSettings(settings);
  switch (client) {
    case "claude":
      return { args: ["--print", "--output-format", "stream-json", "--verbose", "--session-id", session,
        "--model", model, ...effort("--effort", reasoningEffort), "--no-session-persistence", "--no-chrome", "--safe-mode", "--restricted",
        "--setting-sources", "", "--strict-mcp-config", "--mcp-config", noMcp, "--permission-mode", "dontAsk", "--permission-prompts", "none", "--disable-slash-commands",
        "--tools", "Read", "--allowedTools", "Read", "--max-turns", "128", "--max-budget-usd", String(maxBudgetUsd)],
      format: "claude-read", transport: "stdin" };
    case "codex":
      return { args: ["--ask-for-approval", "never", "--disable", "shell_tool", "-c", 'web_search="disabled"',
        "exec", "--sandbox", "read-only", "--ignore-user-config", "--ignore-rules", "--json", "--ephemeral", "--skip-git-repo-check",
        "--model", model, ...(reasoningEffort ? ["-c", "model_reasoning_effort=" + JSON.stringify(reasoningEffort)] : []), "-"],
      format: "codex-json", transport: "inline" };
    case "grok":
      return { args: ["--no-auto-update", "--no-plan", "--no-subagents", "--no-memory", "--disable-web-search",
        "--model", model, ...effort("--effort", reasoningEffort), "--tools", "Read", "--allow", "Read",
        "--session-id", session, "--output-format", "plain", "--single"], format: "text", transport: "argument",
      env: Object.fromEntries(["CURSOR", "CLAUDE"].flatMap((source) => ["SKILLS", "RULES", "AGENTS", "MCPS", "HOOKS"]
        .map((feature) => [`GROK_${source}_${feature}_ENABLED`, "0"]))) };
    case "pi":
      return { args: ["--print", "--mode", "json", "--no-session", "--session-id", session, "--no-extensions", "--no-mcp",
        "--no-skills", "--no-prompt-templates", "--no-context-files", "--no-tools", "--offline",
        "--model", model, ...effort("--thinking", reasoningEffort)], format: "pi-json", transport: "inline" };
    case "hermes":
      return { args: ["chat", "--oneshot", "--safe-mode", "--toolsets", "none", "--model", model,
        "--format", "stream-json", "--query-file", "-"], format: "hermes-json", transport: "inline" };
    case "opencode":
      return { args: ["run", "--standalone", "--format", "json", "--model", model + (reasoningEffort ? "#" + reasoningEffort : ""), "--file"],
        format: "opencode-json", transport: "file", config: { "config/opencode/opencode.json": openCodeSettings },
        env: { OPENCODE_DISABLE_CLAUDE_CODE: "1", OPENCODE_DISABLE_EXTERNAL_SKILLS: "1", OPENCODE_DISABLE_AUTOUPDATE: "1" } };
    case "kilo":
      return { args: ["run", "--format", "json", "--model", model, ...effort("--variant", reasoningEffort), "--file"],
        format: "opencode-json", transport: "file",
        env: { KILO_NO_DAEMON: "1", KILO_CONFIG_CONTENT: JSON.stringify({ permission: denyAll, share: "disabled", autoupdate: false }),
          KILO_DISABLE_DEFAULT_PLUGINS: "1", KILO_DISABLE_EXTERNAL_SKILLS: "1", KILO_DISABLE_PROJECT_CONFIG: "1",
          KILO_PURE: "1", KILO_TELEMETRY_LEVEL: "off" } };
    case "agy":
      return { args: ["--input-format", "stream-json", "--output-format", "stream-json", "--disable-slash-commands",
        "--model", model, ...effort("--effort", reasoningEffort)], format: "agy-json", transport: "agy",
      config: { ".gemini/antigravity-cli/settings.json": agySettings } };
  }
}

export function installedReviewer(config, excluded) {
  need(config.client !== "hermes", "Hermes chat --oneshot delegates to an independently owned gateway without bounded turn settlement");
  return resolveInstalledExecutable(config.client, { excluded });
}

export function reviewerHelp(settings, version) {
  const { client, reasoningEffort } = settings;
  need(client !== "hermes", "Hermes chat --oneshot delegates to an independently owned gateway without bounded turn settlement");
  if (client === "opencode") need(/^2\./.test(version), "OpenCode requires V2 standalone supervision and V2 tool policies");
  const probes = {
    claude: [[], ["--print", "--session-id", "--safe-mode", "--restricted", "--strict-mcp-config", "--permission-prompts", "--no-session-persistence", "--tools"]],
    codex: [["--ask-for-approval", "never", "exec"], ["--sandbox", "--json", "--ephemeral", "--ignore-user-config", "--ignore-rules"]],
    grok: [["--no-auto-update"], ["--single", "--session-id", "--tools", "--allow", "--no-subagents", "--disable-web-search"]],
    pi: [["--offline", "--no-extensions", "--no-mcp"], ["--mode", "--no-session", "--session-id", "--no-tools", "--no-mcp"]],
    opencode: [["run"], ["--standalone", "--model", "--format", "--file"]],
    kilo: [["run"], ["--model", "--format", "--file"]],
    agy: [[], ["--settings", "--input-format", "--output-format", "--disable-slash-commands"]],
  };
  const [args, flags] = probes[client];
  const effortFlag = { claude: "--effort", grok: "--effort", pi: "--thinking", kilo: "--variant", agy: "--effort" }[client];
  return { args: [...args, "--help"], flags: reasoningEffort && effortFlag ? [...flags, effortFlag] : flags };
}

const providerKeys = { anthropic: "ANTHROPIC_API_KEY", openai: "OPENAI_API_KEY", openrouter: "OPENROUTER_API_KEY",
  xai: "XAI_API_KEY", google: "GEMINI_API_KEY", opencode: "OPENCODE_API_KEY", "opencode-go": "OPENCODE_API_KEY" };

const providerQualified = new Set(["opencode", "kilo"]);

function modelProvider(model) {
  const slash = model.indexOf("/");
  return slash > 0 && model[slash + 1] && model[slash + 1] !== "/" ? model.slice(0, slash) : null;
}

export function reviewerProvider({ client, model }) {
  if (!providerQualified.has(client)) return provider[client];
  const prefix = modelProvider(model);
  need(Object.hasOwn(providerKeys, prefix), `${client} requires a provider/model with supported environment authentication`);
  return prefix;
}

export function reviewerAuthVariable(settings) {
  if (settings.client === "grok") return "XAI_API_KEY";
  if (settings.client === "agy") return "GEMINI_API_KEY";
  if (providerQualified.has(settings.client)) return providerKeys[reviewerProvider(settings)];
  return null;
}

function authenticationInputs(settings) {
  const required = reviewerAuthVariable(settings);
  if (required) return [required];
  if (settings.client === "claude") return ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN"];
  if (settings.client === "codex") return ["OPENAI_API_KEY", "CODEX_API_KEY"];
  const prefix = modelProvider(settings.model);
  if (settings.client === "pi" && ["anthropic", "openai", "openrouter", "xai", "google"].includes(prefix)) {
    return [providerKeys[prefix]];
  }
  return [];
}

export function reviewerEnvironmentRoots(executable, python) {
  const roots = [path.dirname(executable), path.dirname(process.execPath), path.dirname(python)];
  let system;
  if (process.platform === "win32") {
    const root = process.env.SystemRoot;
    need(root && path.isAbsolute(root), "Missing native Windows system root");
    const system32 = realpathSync(path.join(root, "System32"));
    need(path.relative(root, system32).toLowerCase() === "system32" && lstatSync(system32).isDirectory(),
      "Untrusted native Windows system path");
    system = { SystemRoot: path.dirname(system32) };
    roots.push(system32);
  } else {
    roots.push("/usr/bin", "/bin");
  }
  need(roots.every((root) => path.isAbsolute(root) && !root.includes(path.delimiter)), "Invalid native reviewer PATH root");
  return { PATH: [...new Set(roots)].join(path.delimiter), ...system };
}

function scratchProfile(home, paths = path) {
  return { HOME: home, USERPROFILE: home, APPDATA: paths.join(home, "appdata"), LOCALAPPDATA: paths.join(home, "localappdata"),
    XDG_CONFIG_HOME: paths.join(home, "config"), XDG_DATA_HOME: paths.join(home, "data"),
    XDG_STATE_HOME: paths.join(home, "state"), XDG_CACHE_HOME: paths.join(home, "cache") };
}

function commonEnvironment(scratch) {
  return { TMPDIR: scratch, TMP: scratch, TEMP: scratch, CI: "1", LC_ALL: "C", NO_COLOR: "1",
    DISABLE_AUTOUPDATER: "1", DISABLE_TELEMETRY: "1" };
}

export function reviewerMetadataEnvironment(roots, scratch) {
  return { ...roots, ...commonEnvironment(scratch), ...scratchProfile(path.join(scratch, "home")) };
}

function packetEnvironment(client, overrides, scratch, paths = path) {
  const home = paths.join(scratch, "home");
  return { ...commonEnvironment(scratch), ...overrides,
    ...(isolatedClients.has(client) ? scratchProfile(home, paths) : {}),
    ...(client === "grok" ? { GROK_HOME: paths.join(home, ".grok") } : {}),
    ...(client === "claude" ? { CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1", CLAUDE_CODE_DISABLE_BUILTIN_PLUGINS: "1",
      CLAUDE_CODE_DISABLE_AUTO_MEMORY: "1" } : {}) };
}

const settingsFile = ".gemini/antigravity-cli/settings.json";
const hostAuthClients = new Set(["claude", "codex", "pi"]);

// The platform home is a launch input only. Do not enumerate its contents
// or inherit arbitrary config, tool, provider or profile override variables.
function authHome(client, env) {
  if (!hostAuthClients.has(client)) return {};
  const location = process.platform === "win32" ? env.USERPROFILE ?? homedir() : env.HOME ?? homedir();
  need(path.isAbsolute(location) && path.normalize(location) === location && !/[\r\n\0]/.test(location),
    "Invalid native authentication home");
  return { HOME: location, ...(process.platform === "win32" ? { USERPROFILE: location } : {}) };
}

export function invocation({ config, executable, session, prompt, files, cwd, promptFile,
  environmentRoots, environmentRootsSha256, env = process.env }) {
  const adapter = directAdapter(config.reviewer, session, config.maxBudgetUsd);
  const { client } = config.reviewer;
  const args = [...adapter.args];
  const scratch = path.dirname(cwd);
  const home = path.join(scratch, "home");
  const isolated = isolatedClients.has(client);
  const authentication = authenticationInputs(config.reviewer);
  const rootsSha256 = environmentRoots ? hash(jsonBytes(environmentRoots)) : environmentRootsSha256;
  // Replay uses the retained roots digest and symbolic scratch paths. Credential values never enter the fingerprint.
  const environmentSha256 = hash(jsonBytes({ rootsSha256, authentication,
    variables: packetEnvironment(client, adapter.env, "<scratch>", path.posix),
    ...(config.proofLevel && hostAuthClients.has(client) ? { authHome: "native-host-home" } : {}) }));
  let environment;
  if (environmentRoots) {
    const credential = reviewerAuthVariable(config.reviewer);
    need(!credential || env[credential]?.trim(), `${client} requires ${credential} to avoid ambient profile fallback`);
    const auth = Object.fromEntries(authentication.filter((name) => typeof env[name] === "string").map((name) => [name, env[name]]));
    environment = { ...environmentRoots, ...packetEnvironment(client, adapter.env, scratch), ...authHome(client, env), ...auth };
  }
  const contents = () => prompt + "\n\nAssigned files encoded as JSON data:\n" +
    JSON.stringify([...files].map(([name, bytes]) => ({ name, text: utf8(bytes) })));
  let input = "";
  let attachment;
  switch (adapter.transport) {
    case "stdin":
      input = config.proofLevel === "receipt-only" ? contents() : prompt;
      break;
    case "argument":
      need(Buffer.byteLength(prompt) <= 14000, "Native reviewer argument exceeds the portable Windows quoting bound");
      args.push(prompt);
      break;
    case "inline":
      input = contents();
      break;
    case "agy":
      args.push("--settings", path.join(home, settingsFile));
      input = JSON.stringify({ event: "user", message: { content: contents() } }) + "\n";
      break;
    case "file":
      args.push(promptFile, "--", "Review the supplied packet and follow its output contract.");
      attachment = contents();
      break;
  }
  const portablePaths = new Map([[promptFile, "<packet-prompt>"], [path.join(home, settingsFile), "<agy-settings>"]]);
  const fingerprint = hash(jsonBytes({ argv: args.map((arg) => portablePaths.get(arg) ?? arg),
    format: adapter.format, stdinSha256: hash(Buffer.from(input)),
    attachmentSha256: attachment === undefined ? null : hash(Buffer.from(attachment)),
    config: adapter.config ?? null, environmentSha256 }));
  return { executable, args, env: environment, input, attachment, format: adapter.format, config: adapter.config,
    home: isolated ? home : null, fingerprint };
}
