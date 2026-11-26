import { spawnSync } from "node:child_process";
import { accessSync, constants, lstatSync, realpathSync } from "node:fs";
import path from "node:path";
import { trustedHostPath } from "./agent-configuration.mjs";
import { absolute, clients } from "./role-config.mjs";
import { reportedVersion } from "./runtime-version.mjs";

const programs = Object.freeze({
  ...clients,
  bubblewrap: { command: "bwrap" }, openspec: { command: "openspec" },
});

function findExecutable(name, searchPath) {
  for (const entry of searchPath.split(path.delimiter)) {
    if (!absolute(entry)) continue;
    const filename = path.join(entry, name);
    try {
      const file = realpathSync(filename);
      if (!lstatSync(file).isFile()) continue;
      accessSync(file, constants.X_OK);
      return { file, trusted: trustedHostPath(entry) !== null && trustedHostPath(filename) === file };
    } catch { /* An unreadable path does not establish executable presence. */ }
  }
  return null;
}

export function observeVersion(file, { run = spawnSync, searchPath = process.env.PATH ?? "", client } = {}) {
  const directories = [...searchPath.split(path.delimiter), "/usr/bin", "/bin"].flatMap((entry) => {
    const directory = trustedHostPath(entry);
    return directory && lstatSync(directory, { throwIfNoEntry: false })?.isDirectory() ? [directory] : [];
  });
  const safePath = [...new Set(directories)].join(path.delimiter) || "/nonexistent";
  const env = { PATH: safePath, HOME: "/nonexistent", XDG_CONFIG_HOME: "/nonexistent",
    XDG_DATA_HOME: "/nonexistent", XDG_CACHE_HOME: "/nonexistent", XDG_STATE_HOME: "/nonexistent",
    LC_ALL: "C", CI: "1", NO_COLOR: "1", DISABLE_TELEMETRY: "1", DISABLE_AUTOUPDATER: "1" };
  const result = run(file, ["--version"], { cwd: "/", env, timeout: 1800, killSignal: "SIGKILL",
    maxBuffer: 4096, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (result.status !== 0 || result.error) return null;
  // Grok kept its legacy configuration identity when the executable name changed.
  const stdout = client === "grok-build" && typeof result.stdout === "string" && result.stdout.length <= 4096
    ? result.stdout.trim().replace(/^grok (?=v?\d)/, "grok-build ")
    : result.stdout;
  return reportedVersion(stdout, client);
}

export function detectAgents(options = {}) {
  const { searchPath = process.env.PATH ?? "" } = options;
  return Object.entries(programs).map(([client, program]) => {
    let { command } = program;
    let match = findExecutable(command, searchPath);
    if (!match && program.fallbackCommand) {
      const fallback = findExecutable(program.fallbackCommand, searchPath);
      if (fallback) {
        command = program.fallbackCommand;
        match = fallback;
      }
    }
    const executable = match?.file ?? null;
    const capability = executable ? "unknown" : "unavailable";
    return { client, command, status: executable ? "present" : "unavailable", executable,
      version: match?.trusted ? observeVersion(executable, { ...options, client, searchPath }) : null,
      ...(match && !match.trusted ? { versionProbe: "untrusted-path" } : {}),
      authReadiness: capability, containment: capability, models: capability, reasoningEfforts: capability };
  });
}
