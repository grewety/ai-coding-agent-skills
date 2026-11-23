import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { link, lstat, mkdir, open, unlink } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { absolute, digest, hash, jsonBytes, need, parseStrictJson } from "./review-inputs.mjs";
import { readClosed, safePath, writeClosed } from "./worker-handoff.mjs";

export const stateLimit = 1024 * 1024;
export const identifier = (value) => typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$/.test(value);

export async function privateDirectory(directory) {
  await safePath(directory);
  const st = await lstat(directory, { bigint: true });
  need(st.isDirectory() && st.uid === BigInt(process.getuid()) && (st.mode & 0o7777n) === 0o700n,
    "Expected an owner-private directory");
  return { device: String(st.dev), inode: String(st.ino) };
}

export async function syncDirectory(directory) {
  const handle = await open(directory, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try { await handle.sync(); } finally { await handle.close(); }
}

export async function newDirectory(directory) {
  await safePath(directory, true);
  await mkdir(directory, { mode: 0o700 });
  await syncDirectory(path.dirname(directory));
  return privateDirectory(directory);
}

export async function readState(directory, name, optional = false, limit = stateLimit) {
  await privateDirectory(directory);
  for (let retry = 0; ; retry++) {
    try {
      const bytes = await readClosed(path.join(directory, name), limit, true);
      const value = parseStrictJson(bytes);
      need(bytes.equals(jsonBytes(value)), "Noncanonical retained runtime state");
      return value;
    } catch (error) {
      if (optional && error.code === "ENOENT") return null;
      // A concurrent publisher briefly has both its staging link and the sealed final link.
      if (error.message !== "Result is not sealed or still has a publication alias" || retry === 3) throw error;
      await delay(15);
    }
  }
}

export async function writeState(directory, name, value) {
  await privateDirectory(directory);
  const temporary = path.join(directory, ".new-" + randomUUID());
  await writeClosed(temporary, jsonBytes(value), true);
  await link(temporary, path.join(directory, name));
  await unlink(temporary);
  await syncDirectory(directory);
}

export async function trustedJson(locator) {
  need(absolute(locator?.path) && digest(locator.sha256), "Invalid independently retained locator");
  await privateDirectory(path.dirname(locator.path));
  const bytes = await readClosed(locator.path, stateLimit, true);
  need(hash(bytes) === locator.sha256, "Trusted locator bytes changed");
  return parseStrictJson(bytes);
}

export async function pinnedFile(pin, { executable = false, limit = 512 * 1024 * 1024 } = {}) {
  need(absolute(pin?.path) && digest(pin.sha256), "Invalid local file pin");
  await safePath(pin.path);
  const handle = await open(pin.path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const st = await handle.stat({ bigint: true });
    need(st.isFile() && st.nlink === 1n && [0n, BigInt(process.getuid())].includes(st.uid) &&
      (st.mode & 0o6022n) === 0n && (!executable || (st.mode & 0o100n) !== 0n) &&
      st.size > 0n && st.size <= BigInt(limit), "Unsafe, writable or oversized local runtime pin");
    const hasher = createHash("sha256");
    for await (const chunk of handle.createReadStream({ autoClose: false, start: 0, end: Number(st.size) - 1 })) hasher.update(chunk);
    const after = await lstat(pin.path, { bigint: true });
    need(st.ino === after.ino && st.dev === after.dev && st.size === after.size && st.ctimeNs === after.ctimeNs &&
      hasher.digest("hex") === pin.sha256, "Local runtime pin changed");
  } finally { await handle.close(); }
}
