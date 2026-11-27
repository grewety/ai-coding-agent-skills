import { constants } from "node:fs";
import { createHash } from "node:crypto";
import { lstat, open, readlink, realpath } from "node:fs/promises";
import path from "node:path";
import { absolute, git, hash, jsonBytes, need, relative, utf8, verifiedGitRoot } from "./review-inputs.mjs";
import { safePath } from "./worker-handoff.mjs";

const maximumBytes = 512 * 1024 * 1024;
const maximumFiles = 32768;

function zeroRecords(bytes) {
  const source = utf8(bytes);
  need(!source || source.endsWith("\0"), "Incomplete Git inventory");
  return source ? source.slice(0, -1).split("\0") : [];
}

async function fileState(file, budget, allowMissing) {
  let before;
  try {
    before = await lstat(file, { bigint: true });
  } catch (error) {
    if (allowMissing && ["ENOENT", "ENOTDIR"].includes(error.code)) return null;
    throw error;
  }
  const metadata = [String(before.mode), String(before.ino), String(before.dev),
    String(before.mtimeNs), String(before.ctimeNs)];
  if (before.isSymbolicLink()) return [...metadata, hash(await readlink(file, { encoding: "buffer" }))];
  need(before.isFile() && before.size <= BigInt(budget.remaining), "Worktree snapshot exceeds its file or byte bound");
  budget.remaining -= Number(before.size);
  const handle = await open(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
  try {
    const confirmed = await handle.stat({ bigint: true });
    need(confirmed.ino === before.ino && confirmed.dev === before.dev && confirmed.ctimeNs === before.ctimeNs,
      "Worktree file changed while opening");
    const sha256 = createHash("sha256");
    let bytes = 0;
    for await (const chunk of handle.createReadStream({ autoClose: false, end: Number(before.size) })) {
      bytes += chunk.length;
      need(bytes <= Number(before.size), "Worktree file grew during observation");
      sha256.update(chunk);
    }
    const after = await lstat(file, { bigint: true });
    need(bytes === Number(before.size) && after.ino === before.ino && after.dev === before.dev &&
      after.size === before.size && after.ctimeNs === before.ctimeNs && after.mtimeNs === before.mtimeNs,
      "Worktree file changed during observation");
    return [...metadata, sha256.digest("hex")];
  } finally {
    await handle.close();
  }
}

export async function observeWorktree(workspace) {
  await verifiedGitRoot(workspace);
  const controls = () => {
    const head = utf8(git(workspace, "rev-parse", "--verify", "HEAD")).trim();
    const symbolic = git(workspace, "rev-parse", "--symbolic-full-name", "HEAD");
    const status = git(workspace, "status", "--porcelain=v2", "-z", "--untracked-files=all", "--no-renames", "--ignore-submodules=all");
    const stage = zeroRecords(git(workspace, "ls-files", "--stage", "-z"));
    need(stage.every((entry) => !entry.startsWith("160000 ")), "Submodule worktree identity is unsupported");
    const untracked = zeroRecords(git(workspace, "ls-files", "--others", "--exclude-standard", "-z"));
    const tracked = zeroRecords(git(workspace, "ls-tree", "-r", "--name-only", "-z", head));
    const index = path.normalize(utf8(git(workspace, "rev-parse", "--path-format=absolute", "--git-path", "index")).trimEnd());
    need(absolute(index), "Invalid Git index location");
    return { head, symbolic: hash(symbolic), status: hash(status), stage, untracked, tracked, index };
  };
  const before = controls();
  const filenames = [...new Set([...before.stage.map((entry) => entry.slice(entry.indexOf("\t") + 1)),
    ...before.untracked, ...before.tracked])].sort();
  need(filenames.length <= maximumFiles && filenames.every(relative), "Unsafe or oversized worktree inventory");
  const budget = { remaining: maximumBytes };
  await safePath(path.dirname(before.index));
  const index = await fileState(before.index, budget, true);
  const files = [];
  for (const name of filenames) {
    const file = path.join(workspace, name);
    // A tracked file may have been replaced by a directory. Inventory every
    // untracked child separately and never follow an intermediate symlink.
    try {
      const parent = await realpath(path.dirname(file));
      need(parent === path.dirname(file), "Noncanonical worktree ancestor");
      const stat = await lstat(file).catch((error) => {
        if (error.code !== "ENOENT") throw error;
        return null;
      });
      files.push([name, stat?.isDirectory() ? "directory" : await fileState(file, budget, true)]);
    } catch (error) {
      if (!["ENOENT", "ENOTDIR"].includes(error.code)) throw error;
      files.push([name, null]);
    }
  }
  need(hash(jsonBytes(before)) === hash(jsonBytes(controls())) &&
    hash(jsonBytes(index)) === hash(jsonBytes(await fileState(before.index, { remaining: maximumBytes }, true))),
  "Git identity changed during worktree observation");
  return { head: before.head, statusSha256: before.status,
    contentSha256: hash(jsonBytes({ symbolic: before.symbolic, stage: before.stage, index, files })) };
}
