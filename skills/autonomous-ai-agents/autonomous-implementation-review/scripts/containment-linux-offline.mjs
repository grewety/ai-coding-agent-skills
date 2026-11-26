import { lstatSync } from "node:fs";
import path from "node:path";
import { disjoint, trustedHostPath } from "./agent-configuration.mjs";
import { authDirectoryIdentity, requireTier } from "./containment-tier.mjs";
import { absolute, need } from "./role-config.mjs";
import { relative } from "./review-inputs.mjs";

// Build the filesystem-only part of an offline isolation probe. No client,
// provider connection, or real auth state is required by this probe plan.
export function offlineTierBMounts({ role, client, binding, inputRoot, fixtureAuth, writable = [], protectedPaths = [] }) {
  const tier = requireTier(binding, role, client);
  need(tier.containmentTier === "b" && tier.osDriver === "linux-bwrap", "Expected offline Tier B Bubblewrap controls");
  need(absolute(inputRoot) && trustedHostPath(inputRoot) === inputRoot && lstatSync(inputRoot).isDirectory() &&
    protectedPaths.every(absolute), "Untrusted offline input root or protected path");
  authDirectoryIdentity(fixtureAuth, [inputRoot, ...protectedPaths]);
  const reviewer = role === "reviewer";
  need(!reviewer || writable.length === 0, "Reviewer mounts must be read-only");
  const destination = reviewer ? "/review" : "/workspace";
  const writes = writable.map((entry) => {
    const name = entry?.endsWith("/") ? entry.slice(0, -1) : entry;
    need(relative(name) && !name.split("/").some((part) => part === ".git" || part === "tasks.md") &&
      !("openspec/changes".startsWith(name + "/") || name === "openspec/changes" || name.startsWith("openspec/changes/")),
    "Writable scope includes protected Git or planning state");
    const source = path.join(inputRoot, name);
    need(protectedPaths.every((root) => disjoint(root, source)) && trustedHostPath(source) === source &&
      (entry.endsWith("/") ? lstatSync(source).isDirectory() :
        lstatSync(source).isFile() && lstatSync(source).nlink === 1), "Unsafe writable scope mount");
    return [source, destination + "/" + name];
  });
  need(writes.every(([source], index) => writes.slice(index + 1).every(([other]) => disjoint(source, other))),
    "Overlapping writable scope mounts");
  return ["--unshare-all", "--unshare-user", "--die-with-parent", "--new-session", "--disable-userns",
    "--cap-drop", "ALL", "--clearenv", "--tmpfs", "/scratch", "--setenv", "HOME", "/scratch/home",
    "--setenv", "XDG_CONFIG_HOME", "/scratch/config", "--setenv", "XDG_DATA_HOME", "/scratch/data",
    "--setenv", "XDG_STATE_HOME", "/scratch/state", "--setenv", "XDG_CACHE_HOME", "/scratch/cache",
    "--setenv", "TMPDIR", "/scratch/tmp", "--ro-bind", fixtureAuth, "/dedicated-auth",
    "--ro-bind", inputRoot, destination, ...writes.flatMap(([source, target]) => ["--bind", source, target]),
    "--remount-ro", "/", "--chdir", destination];
}
