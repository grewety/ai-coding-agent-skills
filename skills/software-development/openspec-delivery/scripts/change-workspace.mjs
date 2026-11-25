#!/usr/bin/env node
/** Read-only worktree previews. The authorized orchestrator executes returned argv. */
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { gitEnvironment } from "./git-environment.mjs";

const requireThat = (condition, message) => { if (!condition) throw new Error(message); };
function git(repo, ...args) {
  return execFileSync("git", ["--no-optional-locks", "-c", "core.fsmonitor=false", "-C", repo, ...args], { env: gitEnvironment(process.env), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 16 * 1024 * 1024 }).trimEnd();
}
export function hasControlCharacter(value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 32 || code === 127) return true;
  }
  return false;
}
export function normalizeWorktreePath(value, platform = process.platform) {
  return platform === "win32" ? path.win32.normalize(value) : value;
}
function canonical(file) {
  requireThat(path.isAbsolute(file) && !hasControlCharacter(file), "Expected an absolute safe workspace path");
  requireThat(path.normalize(file) === file, "Expected a normalized path");
  requireThat(file === path.join(realpathSync(path.dirname(file)), path.basename(file)), "Expected a canonical parent, not a symlink alias");
  requireThat(!lstatSync(file, { throwIfNoEntry: false })?.isSymbolicLink(), "Workspace path is a symlink");
  return file;
}
function topology(repo) {
  requireThat(!git(repo, "for-each-ref", "--format=%(refname)", "refs/replace/"), "Git replace refs are unsupported; preserve work and use an unmodified object graph");
  requireThat(!existsSync(git(repo, "rev-parse", "--path-format=absolute", "--git-path", "info/grafts")), "Git grafts are unsupported");
}
function planningPaths(repo, change) {
  let current = repo;
  for (const segment of ["openspec", "changes", change]) {
    current = path.join(current, segment);
    const entry = lstatSync(current, { throwIfNoEntry: false });
    if (!entry) break;
    requireThat(!entry.isSymbolicLink() && entry.isDirectory(), "Planning directory is a symlink or not a directory");
  }
}
function commit(repo, value) {
  requireThat(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value), "Expected a full lowercase base/head/target object ID");
  requireThat(git(repo, "rev-parse", "--verify", `${value}^{commit}`) === value, "Expected exact commit identity");
  return value;
}
function ancestor(repo, base, head) {
  try { git(repo, "merge-base", "--is-ancestor", base, head); }
  catch { throw new Error("Expected base/head ancestor reachable from the named target"); }
}
const dirty = (repo) => Boolean(git(repo, "status", "--porcelain=v1", "--untracked-files=all", "--ignore-submodules=none"));
const common = (repo) => realpathSync(git(repo, "rev-parse", "--path-format=absolute", "--git-common-dir"));
const overlaps = (a, b) => { const relative = path.relative(a, b); return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative)); };
function inventory(repo) {
  return git(repo, "worktree", "list", "--porcelain", "-z").split("\0\0").filter(Boolean).map((block) => Object.fromEntries(block.split("\0").filter(Boolean).map((line) => {
    const at = line.indexOf(" ");
    const key = line.slice(0, at);
    const value = line.slice(at + 1);
    return at < 0 ? [line, true] : [key, key === "worktree" ? normalizeWorktreePath(value) : value];
  })));
}
function locate(o, entries, branch) {
  const matches = entries.filter((entry) => entry.branch === `refs/heads/${branch}`);
  requireThat(matches.length === 1, "Expected exactly one registered change worktree; use recovery");
  const entry = matches[0];
  requireThat(!entry.locked && !entry.prunable && !entry.bare, "Worktree is locked, prunable or bare; preserve and resolve ownership");
  const workspace = canonical(entry.worktree);
  requireThat(workspace !== realpathSync(o.repo), "Primary/caller checkout cannot be adopted or retired as a dedicated worktree");
  requireThat(!o.workspace || canonical(o.workspace) === workspace, "Selected workspace differs from registered branch ownership");
  requireThat(realpathSync(git(workspace, "rev-parse", "--show-toplevel")) === workspace, "Worktree root changed");
  requireThat(common(workspace) === common(o.repo), "Worktree belongs to another repository");
  requireThat(git(workspace, "symbolic-ref", "--short", "HEAD") === branch, "Worktree branch changed");
  const head = commit(o.repo, entry.HEAD);
  requireThat(git(workspace, "rev-parse", "HEAD") === head, "Worktree HEAD changed");
  topology(workspace);
  planningPaths(workspace, o.change);
  ancestor(o.repo, o.base, head);
  return { workspace, branch, base: o.base, head, dirty: dirty(workspace) };
}
function inspectSource(repo) {
  canonical(repo);
  requireThat(realpathSync(git(repo, "rev-parse", "--show-toplevel")) === repo, "Expected the canonical repository root");
  topology(repo);
}

export function retirementInventory({ repo, repository, change, target, ownership, writers, keepWorktree }) {
  inspectSource(repo);
  commit(repo, target);
  requireThat(Array.isArray(ownership) && new Set(ownership.map(({ workspace }) => workspace)).size === ownership.length,
    "Duplicate or missing retained worktree ownership inventory");
  const entries = inventory(repo);
  const proofs = new Map(ownership.map((proof) => [proof.workspace, proof]));
  const byPath = new Map(entries.map((entry) => [entry.worktree, entry]));
  const result = [];
  for (const workspace of new Set([...byPath.keys(), ...proofs.keys()])) {
    const entry = byPath.get(workspace);
    const proof = proofs.get(workspace);
    const report = (state, reason, extras) => result.push({ workspace, state, reason, ...extras });
    if (workspace === entries[0]?.worktree || workspace === repo) {
      report("retained", "PRIMARY_OR_CALLER");
      continue;
    }
    if (!proof && ![ `refs/heads/change/${change}`, `refs/heads/closure/${change}` ].includes(entry?.branch)) {
      report(entry?.detached ? "blocked" : "retained", "OWNERSHIP_UNVERIFIED");
      continue;
    }
    try {
      canonical(workspace);
      requireThat(proof?.verified === true && typeof proof.reference === "string" && proof.reference.trim() &&
        proof.repository === repository && proof.change === change && proof.commonDirectory === common(repo),
      "Ownership provenance differs");
      const { role, ref, head } = proof;
      const attached = ["implementation", "closure"].includes(role);
      requireThat(attached ? typeof ref === "string" && ref.startsWith("refs/heads/") &&
        git(repo, "check-ref-format", ref) === "" && git(repo, "rev-parse", "--verify", ref) === head :
        role === "verification" && ref === null, "Role, ref or retained branch head differs");
      commit(repo, head);
      ancestor(repo, head, target);
      if (!entry) {
        requireThat(!lstatSync(workspace, { throwIfNoEntry: false }), "Unregistered path still exists");
        report("removed", null, { ref, head });
        continue;
      }
      if (keepWorktree) {
        report("retained", "OPERATOR_KEEP_WORKTREE");
        continue;
      }
      requireThat(!entry.locked && !entry.prunable && !entry.bare && entry.HEAD === head &&
        (attached ? entry.branch === ref : entry.detached === true), "Registration, lock or HEAD differs");
      requireThat(writers?.verified === true && typeof writers.reference === "string" && writers.reference.trim() &&
        Array.isArray(writers.idle) && writers.idle.includes(workspace), "Writer settlement is unverified");
      inspectSource(workspace);
      requireThat(common(workspace) === common(repo) && git(workspace, "rev-parse", "HEAD") === head &&
        git(workspace, "rev-parse", "--symbolic-full-name", "HEAD") === (ref ?? "HEAD"), "Live checkout identity differs");
      requireThat(!dirty(repo) && !dirty(workspace) && !git(workspace, "ls-files", "--others", "--ignored", "--exclude-standard", "-z") &&
        !git(workspace, "ls-files", "--stage").split("\n").some((line) => line.startsWith("160000 ")),
      "Tracked, untracked, ignored or submodule content requires preservation");
      report("eligible", null, { ref, head, argv: ["git", "-C", repo, "worktree", "remove", "--", workspace] });
    } catch (error) { report("blocked", error.message); }
  }
  return result;
}
export function sourceObservation({ repo, targetBranch, remote }) {
  inspectSource(repo);
  requireThat(typeof targetBranch === "string" && !targetBranch.startsWith("-") &&
    git(repo, "check-ref-format", "--branch", targetBranch) === targetBranch, "Invalid target branch");
  requireThat(typeof remote === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(remote), "Invalid tracking remote");
  const tracking = git(repo, "for-each-ref", "--format=%(objectname)", `refs/remotes/${remote}/${targetBranch}`);
  return { branch: git(repo, "rev-parse", "--symbolic-full-name", "HEAD"), head: git(repo, "rev-parse", "HEAD"),
    targetHead: git(repo, "rev-parse", "--verify", `refs/heads/${targetBranch}^{commit}`),
    trackingHead: tracking || null, dirty: dirty(repo), registeredWorktrees: inventory(repo).length };
}
export function reconcileWorkspace(o) {
  inspectSource(o.repo);
  requireThat(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(o.change) && o.change.length <= 200 && o.change !== "archive", "Malformed full change name");
  commit(o.repo, o.base);
  const branch = o.branch ?? `change/${o.change}`;
  const closureBranch = o.closureBranch ?? `closure/${o.change}`;
  for (const value of [branch, closureBranch]) {
    requireThat(!value.startsWith("-") && git(o.repo, "check-ref-format", "--branch", value) === value, "Invalid branch");
  }
  requireThat(branch !== closureBranch, "Implementation and closure branches must be distinct");
  const entries = inventory(o.repo);
  const registered = (name) => {
    if (entries.some((entry) => entry.branch === `refs/heads/${name}`)) return locate(o, entries, name);
    requireThat(!git(o.repo, "for-each-ref", "--format=%(refname)", `refs/heads/${name}`), "Branch exists without a registered worktree; preserve and resolve ownership");
    return null;
  };
  const implementation = registered(branch);
  requireThat(!o.workspace || implementation, "Selected dedicated implementation workspace is missing");
  const closure = entries.some((entry) => entry.branch === `refs/heads/${closureBranch}`)
    ? locate({ ...o, workspace: undefined }, entries, closureBranch) : null;
  const detached = [];
  for (const entry of entries.filter((value) => value.detached)) {
    requireThat(!entry.locked && !entry.prunable && !entry.bare, "Detached worktree ownership is unresolved");
    const workspace = canonical(entry.worktree);
    requireThat(realpathSync(git(workspace, "rev-parse", "--show-toplevel")) === workspace &&
      common(workspace) === common(o.repo) && git(workspace, "rev-parse", "--symbolic-full-name", "HEAD") === "HEAD",
    "Detached worktree ownership changed");
    const head = commit(o.repo, entry.HEAD);
    requireThat(git(workspace, "rev-parse", "HEAD") === head, "Detached worktree HEAD changed");
    topology(workspace);
    detached.push({ workspace, head, dirty: dirty(workspace) });
  }
  detached.sort((a, b) => a.workspace < b.workspace ? -1 : a.workspace > b.workspace ? 1 : 0);
  let verification = null;
  if (o.verificationWorkspace) {
    const workspace = canonical(o.verificationWorkspace);
    verification = detached.find((entry) => entry.workspace === workspace) ?? null;
    requireThat(verification?.head === commit(o.repo, o.verificationSha), "Verification checkout is missing or repinned");
  }
  return { schemaVersion: 1, change: o.change, implementation, closure, verification, detached,
    action: implementation ? "reuse" : "workspace-pending" };
}
function main() {
  const command = process.argv[2];
  requireThat(["prepare", "locate", "retire", "reconcile"].includes(command), "Expected prepare, locate, retire or reconcile");
  const args = process.argv.slice(3);
  const seen = new Set();
  for (const arg of args) {
    const key = /^--([^=]+)/.exec(arg)?.[1];
    if (key) { requireThat(!seen.has(key), `Duplicate option --${key}`); seen.add(key); }
  }
  const names = ["repo", "change", "base", "workspace", "branch", ...(command === "retire" ? ["head", "target"] : command === "reconcile" ?
    ["closure-branch", "verification-workspace", "verification-sha"] : [])];
  const { values: o } = parseArgs({ args, options: Object.fromEntries(names.map((key) => [key, { type: "string" }])), strict: true, allowPositionals: false });
  for (const key of ["repo", "change", "base", ...(command === "retire" ? ["head", "target"] : [])]) requireThat(o[key], `Missing --${key}`);
  if (command === "reconcile") return reconcileWorkspace({ ...o, closureBranch: o["closure-branch"],
    verificationWorkspace: o["verification-workspace"], verificationSha: o["verification-sha"] });
  return workspacePreview(command, o);
}

export function workspacePreview(command, o) {
  requireThat(["prepare", "locate", "retire"].includes(command), "Unknown workspace preview");
  requireThat(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(o.change) && o.change.length <= 200 && o.change !== "archive", "Malformed full change name");
  canonical(o.repo);
  requireThat(realpathSync(git(o.repo, "rev-parse", "--show-toplevel")) === o.repo, "Expected the canonical repository root");
  topology(o.repo);
  planningPaths(o.repo, o.change);
  commit(o.repo, o.base);
  const branch = o.branch ?? `change/${o.change}`;
  requireThat(!branch.startsWith("-") && git(o.repo, "check-ref-format", "--branch", branch) === branch, "Invalid branch");
  const entries = inventory(o.repo);
  if (command === "locate" || command === "retire" || entries.some((entry) => entry.branch === `refs/heads/${branch}`)) {
    const found = locate(o, entries, branch);
    if (command === "retire") {
      requireThat(found.head === commit(o.repo, o.head), "Worktree head changed since closure readback");
      requireThat(!found.dirty && !dirty(o.repo), "Both checkouts must be clean before retirement");
      ancestor(o.repo, found.head, commit(o.repo, o.target));
      return { ...found, action: "retire", target: o.target, argv: ["git", "-C", o.repo, "worktree", "remove", "--", found.workspace] };
    }
    return { ...found, action: command === "prepare" ? "reuse" : "located" };
  }
  requireThat(git(o.repo, "rev-parse", "HEAD") === o.base, "Source HEAD differs from captured base");
  requireThat(!dirty(o.repo), "Source checkout must be clean; preserve drafts and resolve ownership");
  requireThat(!git(o.repo, "for-each-ref", "--format=%(refname)", `refs/heads/${branch}`, `refs/remotes/*/${branch}`), "Branch already exists without a reusable registered worktree; use recovery");
  const workspace = canonical(o.workspace ?? path.join(path.dirname(o.repo), `${path.basename(o.repo)}--${o.change}`));
  requireThat(!lstatSync(workspace, { throwIfNoEntry: false }), "Workspace destination already exists");
  for (const entry of entries) requireThat(!overlaps(entry.worktree, workspace) && !overlaps(workspace, entry.worktree), "Workspace overlaps or is inside an existing checkout");
  return { action: "create", workspace, branch, base: o.base, argv: ["git", "-C", o.repo, "worktree", "add", "-b", branch, "--", workspace, o.base] };
}
const isMain = () => {
  try { return realpathSync(process.argv[1]) === realpathSync(new URL(import.meta.url)); }
  catch { return false; }
};
if (isMain()) {
  try { writeFileSync(1, `${JSON.stringify({ ok: true, ...main() })}\n`); }
  catch (error) { writeFileSync(1, `${JSON.stringify({ ok: false, error: error.message })}\n`); process.exitCode = 1; }
}
