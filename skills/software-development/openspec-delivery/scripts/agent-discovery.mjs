import { spawnSync } from "node:child_process";
import { accessSync, constants, lstatSync, realpathSync } from "node:fs";
import path from "node:path";
import { absolute, clients } from "./role-config.mjs";
import { reportedVersion } from "./runtime-version.mjs";

const programs = Object.freeze({
  ...Object.fromEntries(Object.entries(clients).map(([name, item]) => [name, item.command])),
  bubblewrap: "bwrap", openspec: "openspec",
});

function findExecutable(name, searchPath) {
  for (const entry of searchPath.split(path.delimiter)) {
    if (!absolute(entry)) continue;
    const filename = path.join(entry, name);
    try {
      const file = realpathSync(filename);
      if (!lstatSync(file).isFile()) continue;
      accessSync(file, constants.X_OK);
      return file;
    } catch { /* An unreadable path does not establish executable presence. */ }
  }
  return null;
}

export function observeVersion(file, { run = spawnSync, searchPath = process.env.PATH ?? "", client } = {}) {
  const safePath = searchPath.split(path.delimiter).filter(absolute).join(path.delimiter) || "/usr/bin:/bin";
  const env = { PATH: safePath, HOME: "/nonexistent", XDG_CONFIG_HOME: "/nonexistent",
    XDG_DATA_HOME: "/nonexistent", XDG_CACHE_HOME: "/nonexistent", XDG_STATE_HOME: "/nonexistent",
    LC_ALL: "C", CI: "1", NO_COLOR: "1", DISABLE_TELEMETRY: "1", DISABLE_AUTOUPDATER: "1" };
  const result = run(file, ["--version"], { cwd: "/", env, timeout: 1800, killSignal: "SIGKILL",
    maxBuffer: 4096, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  return result.status === 0 && !result.error ? reportedVersion(result.stdout, client) : null;
}

export function detectAgents(options = {}) {
  const { searchPath = process.env.PATH ?? "" } = options;
  return Object.entries(programs).map(([client, command]) => {
    const executable = findExecutable(command, searchPath);
    const capability = executable ? "unknown" : "unavailable";
    return { client, command, status: executable ? "present" : "unavailable", executable,
      version: executable ? observeVersion(executable, { ...options, client, searchPath }) : null,
      authReadiness: capability, containment: capability, models: capability, reasoningEfforts: capability };
  });
}
