import { spawnSync } from "node:child_process";
import { accessSync, constants, lstatSync, realpathSync } from "node:fs";
import path from "node:path";
import { disjoint, trustedHostPath } from "./agent-configuration.mjs";
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

export function resolveInstalledExecutable(name, { searchPath = process.env.PATH ?? "", excluded = [] } = {}) {
  if (!/^[a-z0-9-]+$/.test(name)) throw new Error("Invalid installed program name");
  const filename = process.platform === "win32" ? name + ".exe" : name;
  const match = findExecutable(filename, searchPath);
  if (!match?.trusted ||
      !excluded.every((root) => disjoint(root, match.file))) {
    throw new Error("Trusted native executable unavailable for " + name);
  }
  return match.file;
}

export function observeVersion(file, { run = spawnSync, searchPath = process.env.PATH ?? "", client } = {}) {
  const directories = (process.platform === "win32" ? searchPath.split(path.delimiter) :
    [...searchPath.split(path.delimiter), "/usr/bin", "/bin"]).flatMap((entry) => {
    const directory = trustedHostPath(entry);
    return directory && lstatSync(directory, { throwIfNoEntry: false })?.isDirectory() ? [directory] : [];
  });
  const safePath = [...new Set(directories)].join(path.delimiter) || "/nonexistent";
  const env = { PATH: safePath, HOME: "/nonexistent", XDG_CONFIG_HOME: "/nonexistent",
    XDG_DATA_HOME: "/nonexistent", XDG_CACHE_HOME: "/nonexistent", XDG_STATE_HOME: "/nonexistent",
    LC_ALL: "C", CI: "1", NO_COLOR: "1", DISABLE_TELEMETRY: "1", DISABLE_AUTOUPDATER: "1" };
  const windows = process.platform === "win32";
  if (windows) Object.assign(env, { SystemRoot: process.env.SystemRoot, USERPROFILE: path.join(path.parse(file).root, "Nonexistent"),
    APPDATA: path.join(path.parse(file).root, "Nonexistent"), LOCALAPPDATA: path.join(path.parse(file).root, "Nonexistent") });
  const result = run(file, ["--version"], { cwd: path.parse(file).root, env, windowsHide: windows, timeout: 1800, killSignal: "SIGKILL",
    maxBuffer: 4096, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (result.status !== 0 || result.error) return null;
  return reportedVersion(result.stdout, client);
}

export function detectAgents(options = {}) {
  const { searchPath = process.env.PATH ?? "" } = options;
  return Object.entries(programs).map(([client, program]) => {
    let { command } = program;
    const nativeName = (name) => process.platform === "win32" ? name + ".exe" : name;
    let match = findExecutable(nativeName(command), searchPath);
    if (!match && program.fallbackCommand) {
      const fallback = findExecutable(nativeName(program.fallbackCommand), searchPath);
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
