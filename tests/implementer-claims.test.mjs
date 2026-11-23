import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { lstat, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { test } from "node:test";
import { normalizeRepository, openRegistry, reserveSlot, retireReservation, slotPath } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/implementer-claims.mjs";

const claimsModule = new URL("../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/implementer-claims.mjs", import.meta.url).href;
const change = "fixture-01m84dt53xh6x16nwwqebacz8m";

async function root(t) {
  const directory = await mkdtemp(path.join(tmpdir(), "claims-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

test("repository identity normalizes literal SSH and HTTPS spellings and refuses auth, local paths and traversal", () => {
  for (const remote of [
    "git@github.com:Fixture/Replay.git", "https://GITHUB.COM/fixture/replay",
    "ssh://git@github.com:22/Fixture/Replay.git", "https://github.com:443/Fixture/Replay.git/",
  ]) assert.equal(normalizeRepository(remote), "github.com/fixture/replay", remote);
  assert.notEqual(normalizeRepository("ssh://git@github.com:23/Fixture/Replay"), "github.com/fixture/replay");
  for (const remote of ["https://synthetic:fixture@github.com/a/b", "/tmp/clone", "https://github.com/a/../b",
    "https://github.com/a/%2e%2e/b", "https://github.com/a/b#c", "https://github.com/a//b", "https://github.com/a/b\nsecond"]) {
    assert.throws(() => normalizeRepository(remote), /Unsafe|Unresolved/, remote);
  }
});

test("new process, worktree and independent clone have exactly one durable host claim winner", async (t) => {
  const dir = await root(t);
  const first = path.join(dir, "first");
  const branch = path.join(dir, "branch");
  const clone = path.join(dir, "clone");
  const registry = path.join(dir, "registry");
  await mkdir(first);
  const git = (cwd, ...args) => execFileSync("/usr/bin/git", [
    "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", ...args,
  ], { cwd, env: { PATH: "/usr/bin:/bin", HOME: "/nonexistent", GIT_CONFIG_NOSYSTEM: "1" },
    stdio: ["ignore", "pipe", "pipe"] });
  git(first, "init", "-q", "-b", "main");
  git(first, "remote", "add", "origin", "git@github.com:Fixture/Replay.git");
  git(first, "commit", "--allow-empty", "-qm", "synthetic baseline");
  git(first, "worktree", "add", "-qb", "fixture", branch);
  git(dir, "clone", "-q", first, clone);
  git(clone, "remote", "set-url", "origin", "https://github.com/fixture/replay");
  const childProgram = `
import { writeSync } from "node:fs";
import { acquireClaim, openRegistry, repositoryIdentity } from ${JSON.stringify(claimsModule)};
const [registry, workspace, change] = process.argv.slice(1);
const repository = repositoryIdentity(workspace);
await openRegistry(registry);
const state = await acquireClaim(registry, { repository, change, workspace });
writeSync(1, JSON.stringify(state));
`;
  const invoke = async (workspace) => JSON.parse((await promisify(execFile)(process.execPath,
    ["--input-type=module", "-e", childProgram, registry, workspace, change], { timeout: 4000 })).stdout);
  const results = await Promise.all([first, branch, clone].map(invoke));
  assert.equal(new Set(results.map(({ directory }) => directory)).size, 1);
  assert.equal(results.filter(({ occupied }) => !occupied).length, 1);
  assert.equal((await invoke(clone)).occupied, true, "a dead launcher cannot silently release ownership");
});

test("physical slots compare persistent path and inode across different assignments", async (t) => {
  const directory = await root(t);
  const registry = await openRegistry(path.join(directory, "registry"));
  const samePhysical = { device: "11", inode: "12" };
  const separate = { device: "21", inode: "22" };
  const replaced = { device: "11", inode: "13" };
  const one = { claimId: "claim1", attempt: "attempt1", profiles: [{ path: "/worker/one", id: samePhysical }] };
  const alias = { claimId: "claim2", attempt: "attempt2", profiles: [{ path: "/worker/alias", id: samePhysical }] };
  const reuse = { claimId: "claim3", attempt: "attempt3", profiles: [{ path: "/worker/one", id: replaced }] };
  const other = { claimId: "claim4", attempt: "attempt4", profiles: [{ path: "/worker/other", id: separate }] };
  assert.equal(await reserveSlot(registry, samePhysical, one), slotPath(registry, samePhysical));
  const [aliased, replacement, independent] = await Promise.all([
    reserveSlot(registry, samePhysical, alias), reserveSlot(registry, replaced, reuse), reserveSlot(registry, separate, other),
  ]);
  assert.equal(aliased, null);
  assert.equal(replacement, null);
  assert.equal(independent, slotPath(registry, separate));
  await assert.rejects(retireReservation(slotPath(registry, samePhysical), alias, "false-proof"), /ownership differs/);
  await retireReservation(slotPath(registry, samePhysical), one, "settled-fixture-proof");
  await retireReservation(slotPath(registry, samePhysical), one, "settled-fixture-proof");
  await assert.rejects(lstat(slotPath(registry, samePhysical)), { code: "ENOENT" });
  assert.equal(await reserveSlot(registry, replaced, reuse), slotPath(registry, replaced));
});
