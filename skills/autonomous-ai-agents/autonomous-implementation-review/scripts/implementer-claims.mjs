import { randomUUID } from "node:crypto";
import { userInfo } from "node:os";
import { lstat, readdir, rename, rmdir } from "node:fs/promises";
import path from "node:path";
import { git, hash, jsonBytes, need, separate, utf8 } from "./review-inputs.mjs";
import { newDirectory, privateDirectory, readState, syncDirectory, writeState } from "./implementer-state.mjs";

export const defaultRegistry = () => path.join(userInfo().homedir, ".exclusive-worker-runtime-v1");
const key = (identity) => hash(jsonBytes(identity));

export function normalizeRepository(remote) {
  need(typeof remote === "string" && remote.length <= 1024, "Invalid repository remote");
  const scp = remote.includes("://") ? null : /^(?:git@)?([a-zA-Z0-9.-]+):([a-zA-Z0-9_.\/-]+)$/.exec(remote);
  const source = scp ? `ssh://${scp[1]}/${scp[2]}` : remote;
  need(/^(?:https|ssh):\/\/(?:git@)?[a-zA-Z0-9.-]+(?::\d+)?\/[a-zA-Z0-9_.\/-]+$/.test(source), "Unresolved repository remote");
  const url = new URL(source);
  const spelling = source.slice(source.indexOf("/", source.indexOf("://") + 3) + 1).replace(/\/$/, "");
  let repository = spelling.replace(/\.git$/i, "");
  const port = url.protocol === "ssh:" && url.port === "22" ? "" : url.port;
  need((url.protocol === "ssh:" || !url.username) && !url.password &&
    repository.split("/").length >= 2 && repository.split("/").every((part) =>
      /^[a-zA-Z0-9_.-]+$/.test(part) && ![".", "..", ".git"].includes(part.toLowerCase())),
  "Unsafe repository remote identity");
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (["github.com", "gitlab.com", "bitbucket.org"].includes(host)) repository = repository.toLowerCase();
  return host + (port ? ":" + port : "") + "/" + repository;
}

export function repositoryIdentity(workspace) {
  need(utf8(git(workspace, "rev-parse", "--show-toplevel")).trimEnd() === workspace, "Checkout root identity changed");
  return normalizeRepository(utf8(git(workspace, "config", "--local", "--no-includes", "--get-all", "remote.origin.url")).trimEnd());
}

export const claimPath = (registry, repository, change) => path.join(registry, "claim-" + key([repository, change]));
export const slotPath = (registry, slot) => path.join(registry, "slot-" + key(slot));

export async function openRegistry(registry) {
  try { await newDirectory(registry); }
  catch (error) { if (error.code !== "EEXIST") throw error; }
  await privateDirectory(registry);
  return registry;
}

export async function acquireClaim(registry, assignment) {
  const directory = claimPath(registry, assignment.repository, assignment.change);
  try { await newDirectory(directory); }
  catch (error) {
    if (error.code === "EEXIST") return { directory, occupied: true };
    throw error;
  }
  const owner = { ...assignment, claimId: randomUUID(), createdAt: Date.now() };
  await writeState(directory, "owner.json", owner);
  return { directory, owner, occupied: false };
}

export async function reserveSlot(registry, slot, binding) {
  const directory = slotPath(registry, slot);
  return serializedOperation(registry, async () => {
    const active = (await readdir(registry)).filter((name) => /^slot-[a-f0-9]{64}$/.test(name));
    need(active.length <= 128, "Physical slot inventory exceeds the finite bound");
    for (const name of active) {
      const other = await readState(path.join(registry, name), "reservation.json");
      if (other.profiles.some((previous) => binding.profiles.some((requested) =>
        !separate(previous.path, requested.path) || key(previous.id) === key(requested.id)))) return null;
    }
    try { await newDirectory(directory); }
    catch (error) {
      if (error.code === "EEXIST") return null;
      throw error;
    }
    await writeState(directory, "reservation.json", binding);
    return directory;
  });
}

export async function exclusiveOperation(directory, callback) {
  const lock = path.join(directory, "operation");
  try { await newDirectory(lock); }
  catch (error) {
    if (error.code === "EEXIST") throw Object.assign(new Error("Concurrent or interrupted runtime operation; retain the assignment"),
      { runtimeLock: directory });
    throw error;
  }
  try { return await callback(); }
  finally {
    await rmdir(lock);
    await syncDirectory(directory);
  }
}

export async function serializedOperation(directory, callback) {
  const deadline = Date.now() + 3000;
  do {
    try { return await exclusiveOperation(directory, callback); }
    catch (error) {
      if (error.runtimeLock !== directory || Date.now() >= deadline) throw error;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  } while (true);
}

// Move a settled generation out of the active namespace atomically, retaining its identity.
export async function retireReservation(directory, expected, proofSha256) {
  const retired = directory + "-retired-" + expected.claimId + "-" + expected.attempt;
  let alreadyRetired = false;
  try { alreadyRetired = (await lstat(retired)).isDirectory(); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  const state = alreadyRetired ? retired : directory;
  const current = await readState(state, "reservation.json");
  need(key(current) === key(expected), "Physical slot ownership differs");
  const proof = await readState(state, "released.json", true);
  if (proof || alreadyRetired) need(proof?.proofSha256 === proofSha256, "Physical slot release proof differs");
  else await writeState(directory, "released.json", { proofSha256 });
  if (!alreadyRetired) {
    await rename(directory, retired);
    await syncDirectory(path.dirname(directory));
  }
}
