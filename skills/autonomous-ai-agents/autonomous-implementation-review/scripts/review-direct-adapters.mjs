import path from "node:path";
import { resolveInstalledExecutable } from "./agent-discovery.mjs";
import { directReviewSettings, validateDirectHost } from "./agent-role-adapters.mjs";
import { hash, jsonBytes, need, utf8 } from "./review-inputs.mjs";

const noMcp = '{"mcpServers":{}}';
const authVariables = [
  "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENAI_API_KEY", "CODEX_API_KEY", "XAI_API_KEY",
  "OPENROUTER_API_KEY", "NOUS_API_KEY", "GEMINI_API_KEY", "GOOGLE_API_KEY", "KILO_API_KEY",
  "OPENCODE_API_KEY",
  "GOOGLE_APPLICATION_CREDENTIALS", "CODEX_HOME", "CLAUDE_CONFIG_DIR", "PI_CODING_AGENT_DIR",
  "HERMES_HOME", "GROK_HOME", "AGY_HOME",
];
const hostVariables = ["PATH", "HOME", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "HOMEDRIVE", "HOMEPATH",
  "SystemRoot", "SYSTEMDRIVE", "WINDIR", "LANG", "XDG_CONFIG_HOME", "XDG_DATA_HOME", "XDG_STATE_HOME",
  "XDG_CACHE_HOME", "SSL_CERT_FILE", "SSL_CERT_DIR", "NODE_EXTRA_CA_CERTS"];

export function directReviewHost(value) {
  const config = validateDirectHost(value);
  return { ...config, ...config.reviewer };
}

const provider = {
  claude: "anthropic", codex: "openai", grok: "xai", hermes: "hermes",
  opencode: "opencode", kilo: "kilo", agy: "google", pi: "pi",
};
export const reviewerProvider = (settings) => provider[settings.client];

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

export function reviewerAuthVariable(settings) {
  if (settings.client === "grok") return "XAI_API_KEY";
  if (settings.client === "agy") return "GEMINI_API_KEY";
  if (["opencode", "kilo"].includes(settings.client)) {
    const slash = settings.model.indexOf("/");
    const provider = slash > 0 ? settings.model.slice(0, slash) : "";
    const variable = Object.hasOwn(providerKeys, provider) ? providerKeys[provider] : null;
    need(variable, `${settings.client} requires a provider/model with supported environment authentication`);
    return variable;
  }
  return null;
}

function hosts(env) {
  return Object.fromEntries([...hostVariables, ...authVariables].flatMap((key) => {
    const value = env[key];
    return typeof value === "string" ? [[key, value]] : [];
  }));
}

export function scratchProfile(home) {
  return { HOME: home, USERPROFILE: home, APPDATA: path.join(home, "appdata"), LOCALAPPDATA: path.join(home, "localappdata"),
    XDG_CONFIG_HOME: path.join(home, "config"), XDG_DATA_HOME: path.join(home, "data"),
    XDG_STATE_HOME: path.join(home, "state"), XDG_CACHE_HOME: path.join(home, "cache") };
}

const settingsFile = ".gemini/antigravity-cli/settings.json";

export function invocation({ config, executable, session, prompt, files, cwd, promptFile, env = process.env }) {
  const adapter = directAdapter(config.reviewer, session, config.maxBudgetUsd);
  const { client } = config.reviewer;
  const args = [...adapter.args];
  const scratch = path.dirname(cwd);
  const home = path.join(scratch, "home");
  const isolated = isolatedClients.has(client);
  const environment = { ...hosts(env), ...adapter.env, TMPDIR: scratch, TMP: scratch, TEMP: scratch, CI: "1",
    NO_COLOR: "1", DISABLE_TELEMETRY: "1", DISABLE_AUTOUPDATER: "1", CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
    CLAUDE_CODE_DISABLE_BUILTIN_PLUGINS: "1", CLAUDE_CODE_DISABLE_AUTO_MEMORY: "1" };
  if (isolated) {
    Object.assign(environment, scratchProfile(home));
    delete environment.HOMEDRIVE;
    delete environment.HOMEPATH;
    const credential = reviewerAuthVariable(config.reviewer);
    for (const name of authVariables) if (name !== credential) delete environment[name];
  }
  if (client === "grok") environment.GROK_HOME = path.join(home, ".grok");
  const contents = () => prompt + "\n\nAssigned files encoded as JSON data:\n" +
    JSON.stringify([...files].map(([name, bytes]) => ({ name, text: utf8(bytes) })));
  let input = "";
  let attachment;
  switch (adapter.transport) {
    case "stdin":
      input = prompt;
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
    config: adapter.config ?? null, overrides: adapter.env ?? {}, isolated }));
  return { executable, args, env: environment, input, attachment, format: adapter.format, config: adapter.config,
    home: isolated ? home : null, fingerprint };
}
