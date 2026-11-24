import { lstat, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { need, separate } from "./review-inputs.mjs";
import { safePath } from "./worker-handoff.mjs";

export function checkSocketLength(socket) {
  need(Buffer.byteLength(socket) < 108, "Unix relay socket path exceeds Linux length limit");
}

export async function defaultReviewScratchRoot() {
  const stat = await lstat("/tmp");
  return stat.isDirectory() && stat.uid === 0 && (stat.mode & 0o7777) === 0o1777 ? "/tmp" : tmpdir();
}

export async function allocateReviewScratch(root, excluded) {
  await safePath(root);
  const parent = await lstat(root);
  const uid = process.getuid();
  const privateRoot = parent.uid === uid && (parent.mode & 0o7777) === 0o700;
  const systemTmp = root === "/tmp" && parent.uid === 0 && (parent.mode & 0o7777) === 0o1777;
  need(parent.isDirectory() && (privateRoot || systemTmp), "Unsafe Unix relay scratch root");
  checkSocketLength(path.join(root, "rv-XXXXXX", "inference.sock"));
  const directory = await mkdtemp(path.join(root, "rv-"));
  const owned = await lstat(directory);
  const verify = async () => {
    await safePath(directory);
    const current = await lstat(directory);
    need(current.isDirectory() && current.uid === uid && (current.mode & 0o7777) === 0o700 &&
      current.ino === owned.ino && current.dev === owned.dev, "Unix relay scratch identity or privacy changed");
  };
  const clean = async () => {
    await verify();
    await rm(directory, { recursive: true });
  };
  try {
    await verify();
    need(excluded.every((entry) => separate(entry, directory)), "Unix relay scratch overlaps retained data");
  } catch (error) {
    await clean();
    throw error;
  }
  return { directory, clean, verify };
}
