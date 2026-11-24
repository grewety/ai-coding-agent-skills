#!/usr/bin/env node
// Read-only committed OpenSpec evidence checks. Not a lock or execution attestation.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { closeSync, constants, fstatSync, lstatSync, openSync, readFileSync, opendirSync, readSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { gitEnvironment } from "./git-environment.mjs";
import { planningBudget, planningLayout, planningLimits, safePlanningPath } from "./planning-inventory.mjs";
import { readBounded, sha256, verifyGateRun } from "./evidence-retention.mjs";
import { goalContractIdentity, readGoalContract, withinScope } from "./delivery-control.mjs";

const requireThat = (condition, message) => { if (!condition) throw new Error(message); };
const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
const decode = (bytes, message) => {
  try { return decoder.decode(bytes); } catch { throw new Error(message); }
};
const text = (value) => typeof value === "string" && value.trim().length > 0;

const childEnv = () => gitEnvironment(process.env);
const MAX_EVIDENCE_BYTES = 1024 * 1024;
const MAX_CLOSURE_COMMITS = 200;

// Replacement objects are disabled and repository-configured fsmonitor commands are
// neutralized for every child process; the helper never runs repository hooks.
const runGit = (repo, maxBuffer, args) => execFileSync("git", ["--no-optional-locks", "-c", "core.fsmonitor=false", "-C", repo, ...args], { env: childEnv(), stdio: ["ignore", "pipe", "pipe"], maxBuffer });
const gitBytes = (repo, ...args) => runGit(repo, 64 * 1024 * 1024, args);
const git = (repo, ...args) => decode(gitBytes(repo, ...args), "Git output is not valid UTF-8");

export function commit(repo, value) {
  const length = git(repo, "rev-parse", "--show-object-format").trim() === "sha256" ? 64 : 40;
  requireThat(typeof value === "string" && new RegExp(`^[a-f0-9]{${length}}$`).test(value), "Expected a full literal commit SHA");
  requireThat(git(repo, "rev-parse", "--verify", `${value}^{commit}`).trim() === value, "Commit identity mismatch");
  return value;
}
function topology(repo) {
  requireThat(!git(repo, "for-each-ref", "--format=%(refname)", "refs/replace/").trim(), "Git replace refs are unsupported; preserve work and use an unmodified object graph");
  const grafts = path.resolve(repo, git(repo, "rev-parse", "--git-path", "info/grafts").trim());
  let bytes;
  try { bytes = readFileSync(grafts); }
  catch (error) { requireThat(error.code === "ENOENT", "Git graft file is unreadable"); }
  requireThat(!bytes || !bytes.toString("utf8").trim(), "Git graft files are unsupported; preserve work and use an unmodified object graph");
}
export function ancestor(repo, older, newer) {
  try { git(repo, "merge-base", "--is-ancestor", older, newer); }
  catch { throw new Error("Required commit ancestry is absent; preserve work"); }
}
function entries(repo, ref, paths) {
  let output;
  try {
    output = paths ? decode(runGit(repo, planningLimits.outputBytes,
      ["ls-tree", "-r", "-t", "-z", "--full-tree", ref, "--", ...paths]), "Git output is not valid UTF-8")
      : git(repo, "ls-tree", "-r", "-z", "--full-tree", ref);
  } catch (error) {
    if (paths && error.code === "ENOBUFS") throw new Error("Planning inventory output limit exceeded");
    throw error;
  }
  return new Map(output.split("\0").filter(Boolean).map((line) => {
    const separator = line.indexOf("\t");
    requireThat(separator > 0, "Malformed tree entry");
    const [mode, type, oid] = line.slice(0, separator).split(" ");
    requireThat(/^[0-7]{6}$/.test(mode ?? "") && /^[a-f0-9]{40,64}$/.test(oid ?? ""), "Malformed tree entry");
    return [line.slice(separator + 1), { mode, type, oid }];
  }));
}
function root(change) {
  return `${planningLayout(change).directory}/`;
}
function archivePattern(change) {
  return new RegExp(`^openspec/changes/archive/\\d{4}-\\d{2}-\\d{2}-${change}/`);
}
const fenceMark = /^( {0,3})(`{3,}|~{3,})(.*)$/;
const indentedCode = /^(?: {4,}|\t)/;
const bulletList = /^(?:[-*+]|\d{1,9}[.)])[ \t]+\[/;

// Strict task grammar: a list checkbox at 0-3 leading spaces, optionally blockquoted.
// Fenced blocks, indented code and HTML comments are not tasks; anything else that
// still looks like a checkbox is ambiguous, so it fails closed instead of being skipped.
function taskLines(source) {
  const bom = source.startsWith("\ufeff") ? "\ufeff" : "";
  source = source.slice(bom.length);
  const tasks = [];
  let fence = null;
  let comment = false;
  const normalized = (source.match(/[^\n]*\n|[^\n]+$/g) ?? []).map((line) => {
    const body = line.replace(/\r?\n$/, "");
    const eol = line.slice(body.length);
    const quote = /^(?: {0,3}> ?)*/.exec(body)[0];
    const content = body.slice(quote.length);
    if (fence) {
      const close = fenceMark.exec(content);
      if (close && close[2][0] === fence[0] && close[2].length >= fence.length && !close[3].trim()) fence = null;
      return line;
    }
    const mark = fenceMark.exec(content);
    if (mark && !(mark[2][0] === "`" && mark[3].includes("`"))) { fence = mark[2]; return line; }
    if (comment) { if (content.includes("-->")) comment = false; return line; }
    if (content.startsWith("<!--")) { comment = !content.slice(4).includes("-->"); return line; }
    requireThat(!(indentedCode.test(content) && bulletList.test(content.trimStart())), "Ambiguous indented task line; task items must start at no more than three spaces");
    const task = /^( {0,3})([-*+]|\d{1,9}[.)])([ \t]+)\[([^\]]*)\](.*)$/.exec(content);
    if (!task) return line;
    const state = task[4];
    const rest = task[5];
    if (!/^[ xX]$/.test(state)) {
      // Explicit Markdown links are ordinary list text, not task checkboxes.
      if (state.trim().length > 1 && /^[([]/.test(rest)) return line;
      throw new Error("Unknown task checkbox state");
    }
    requireThat(rest === "" || /^[ \t]/.test(rest), "Task text requires whitespace after the checkbox");
    const id = /^[ \t]+(\d+\.\d+)(?:[ \t]|$)/.exec(rest)?.[1] ?? null;
    tasks.push({ id, checked: state.toLowerCase() === "x" });
    return `${quote}${task[1]}${task[2]}${task[3]}[ ]${rest}${eol}`;
  }).join("");
  requireThat(!fence, "Unclosed Markdown fence in task file");
  requireThat(!comment, "Unclosed HTML comment in task file");
  requireThat(tasks.length > 0, "Expected at least one real OpenSpec task");
  return { normalized: bom + normalized, complete: tasks.every(({ checked }) => checked), count: tasks.length, states: tasks };
}
export function planning(repo, ref, change) {
  const layout = planningLayout(change);
  const taskPath = `${layout.directory}/tasks.md`;
  const tree = entries(repo, ref, [...layout.required, layout.design, layout.specs]);
  const budget = planningBudget();
  for (const file of layout.required) requireThat(tree.has(file), `Missing planning file: ${file}`);
  const sizes = new Map();
  for (const [file, entry] of tree) {
    if (file === layout.specs || (file.startsWith(`${layout.specs}/`) && entry.type === "tree")) {
      requireThat(entry.type === "tree", `Planning specs must be a directory: ${file}`);
      budget.add(file, null);
    } else if (layout.includes(file)) {
      requireThat(entry.type === "blob" && ["100644", "100755"].includes(entry.mode), `Planning inputs must be regular files: ${file}`);
      const size = Number(git(repo, "cat-file", "-s", entry.oid).trim());
      budget.add(file, size);
      sizes.set(file, size);
    }
  }
  // Preserve the original normalized Task-Guided digest framing.
  const hash = createHash("sha256");
  const inputs = {};
  let tasks;
  for (const file of [...sizes.keys()].sort()) {
    const entry = tree.get(file);
    let bytes = runGit(repo, sizes.get(file) + 1, ["cat-file", "blob", entry.oid]);
    requireThat(bytes.length === sizes.get(file), `Incomplete planning input: ${file}`);
    inputs[file] = createHash("sha256").update(bytes).digest("hex");
    const source = decode(bytes, `Planning input is not valid UTF-8: ${file}`);
    if (file === taskPath) {
      tasks = taskLines(source);
      bytes = Buffer.from(tasks.normalized, "utf8");
    }
    hash.update(JSON.stringify([file, entry.mode, bytes.length]));
    hash.update(Buffer.from([0]));
    hash.update(bytes);
    hash.update(Buffer.from([0]));
  }
  return { digest: hash.digest("hex"), complete: tasks.complete, taskCount: tasks.count, taskStates: tasks.states,
    normalizedTasksSha256: createHash("sha256").update(tasks.normalized).digest("hex"), inputs, inventory: budget.totals() };
}

export function planningWorktree(repo, change) {
  repository(repo);
  const layout = planningLayout(change);
  const prefix = `${layout.directory}/`;
  const budget = planningBudget();
  const dirs = new Map();
  const recordDirectory = (file, info) => {
    const old = dirs.get(file);
    if (old) requireThat(old.dev === info.dev && old.ino === info.ino && old.mtimeMs === info.mtimeMs &&
      old.ctimeMs === info.ctimeMs, `Planning directory changed during inventory: ${file}`);
    else dirs.set(file, info);
  };
  const inspect = (relative) => {
    let current = repo;
    const parts = relative.split("/");
    for (const [index, part] of parts.entries()) {
      current = path.join(current, part);
      const info = lstatSync(current);
      requireThat(!info.isSymbolicLink(), `Planning symlink is unsupported: ${relative}`);
      if (index < parts.length - 1) {
        requireThat(info.isDirectory(), `Planning parent must be a directory: ${relative}`);
        recordDirectory(current, info);
      } else return info;
    }
  };
  const optional = (relative) => {
    try { return inspect(relative); }
    catch (error) { if (error.code === "ENOENT") return null; throw error; }
  };
  const files = new Map();
  const add = (file, info) => {
    requireThat(info.isFile(), `Planning input must be a bounded regular file: ${file}`);
    budget.add(file, info.size);
    files.set(file, info);
  };
  for (const file of layout.required) add(file, inspect(file));
  const design = optional(layout.design);
  if (design) add(layout.design, design);
  const walk = (relative) => {
    const info = inspect(relative);
    if (!info.isDirectory()) return add(relative, info);
    budget.add(relative, null);
    recordDirectory(path.join(repo, relative), info);
    const handle = opendirSync(path.join(repo, relative), { encoding: "buffer" });
    try {
      for (let entry; (entry = handle.readSync());) walk(`${relative}/${decode(entry.name, "Planning path is not valid UTF-8")}`);
    } finally { handle.closeSync(); }
  };
  const specs = optional(layout.specs);
  if (specs) {
    requireThat(specs.isDirectory(), "Planning specs must be a directory");
    walk(layout.specs);
  }
  const inputs = {};
  let taskCount;
  for (const file of [...files.keys()].sort()) {
    const before = files.get(file);
    const descriptor = openSync(path.join(repo, file),
      constants.O_RDONLY | (constants.O_NOFOLLOW || 0) | (constants.O_NONBLOCK || 0));
    try {
      const info = fstatSync(descriptor);
      requireThat(info.isFile() && info.size === before.size && info.dev === before.dev && info.ino === before.ino &&
        info.mtimeMs === before.mtimeMs && info.ctimeMs === before.ctimeMs, `Planning input changed during open: ${file}`);
      const buffer = Buffer.alloc(info.size + 1);
      let total = 0;
      while (total < buffer.length) {
        const length = readSync(descriptor, buffer, total, buffer.length - total, null);
        if (!length) break;
        total += length;
      }
      const after = fstatSync(descriptor);
      requireThat(total === info.size && after.mtimeMs === info.mtimeMs && after.ctimeMs === info.ctimeMs, `Planning input changed during read: ${file}`);
      const bytes = buffer.subarray(0, total);
      const source = decode(bytes, `Planning input is not valid UTF-8: ${file}`);
      if (file === `${prefix}tasks.md`) taskCount = taskLines(source).count;
      inputs[file] = createHash("sha256").update(bytes).digest("hex");
    } finally { closeSync(descriptor); }
  }
  for (const [relative, before] of files) {
    const after = inspect(relative);
    requireThat(after.dev === before.dev && after.ino === before.ino && after.size === before.size &&
      after.mtimeMs === before.mtimeMs && after.ctimeMs === before.ctimeMs, `Planning input changed during inventory: ${relative}`);
  }
  for (const dir of dirs.keys()) recordDirectory(dir, lstatSync(dir));
  return { ok: true, change, inputs, inventory: budget.totals(), taskCount };
}
export function repository(repo) {
  requireThat(path.isAbsolute(repo) && realpathSync(repo) === repo &&
    repo === realpathSync(git(repo, "rev-parse", "--show-toplevel").trim()), "Expected an absolute canonical repository-root path");
  topology(repo);
}
export function checkoutObservation(repo, head, { detached = false, generated = [] } = {}) {
  repository(repo);
  commit(repo, head);
  requireThat(git(repo, "rev-parse", "HEAD").trim() === head, "Checkout HEAD changed");
  const branch = git(repo, "rev-parse", "--symbolic-full-name", "HEAD").trim();
  requireThat(detached ? branch === "HEAD" : branch.startsWith("refs/heads/"), detached ? "Expected a detached gate checkout" : "Expected an attached branch");
  requireThat(Array.isArray(generated) && generated.every(safePlanningPath), "Invalid generated output paths");
  const raw = git(repo, "status", "--porcelain=v1", "-z", "--untracked-files=all", "--ignored=matching", "--ignore-submodules=none");
  const ignoredGenerated = [];
  for (const entry of raw.split("\0").filter(Boolean)) {
    requireThat(entry.startsWith("!! "), "Dirty checkout; preserve uncommitted work");
    const relative = entry.slice(3).replace(/\/$/, "");
    requireThat(generated.some((root) => relative === root || relative.startsWith(`${root}/`)),
      `Dirty checkout; unclassified ignored input: ${relative}`);
    const file = path.join(repo, relative);
    requireThat(safePlanningPath(relative) && realpathSync(file) === file && !lstatSync(file).isSymbolicLink(),
      `Dirty checkout; unsafe generated path: ${relative}`);
    ignoredGenerated.push(relative);
  }
  // Hidden index flags can suppress tracked changes in status.
  const index = git(repo, "ls-files", "-v", "-z").split("\0").filter(Boolean);
  requireThat(index.every((entry) => entry.startsWith("H ")), "Dirty checkout; unsupported Git index entries or flags");
  return { head, tree: git(repo, "rev-parse", `${head}^{tree}`).trim(), ignoredGenerated: ignoredGenerated.sort() };
}
function clean(repo, head, requireBranch = true) {
  const detached = git(repo, "rev-parse", "--symbolic-full-name", "HEAD").trim() === "HEAD";
  checkoutObservation(repo, head, { detached: !requireBranch && detached });
}
export function goalSnapshot(repo, ref, change, policyRevision, snapshot = planning(repo, ref, change)) {
  const proposal = `${root(change)}proposal.md`;
  const contract = readGoalContract(committedDocument(repo, ref, proposal));
  const inputs = { contract, inputs: snapshot.inputs, taskCount: snapshot.taskCount };
  return { ...inputs, digest: goalContractIdentity({ change, policyRevision, ...inputs }) };
}
export function committedDocument(repo, ref, file) {
  requireThat(safePlanningPath(file), "Invalid committed document path");
  const entry = entries(repo, ref, [file]).get(file);
  requireThat(entry?.type === "blob" && ["100644", "100755"].includes(entry.mode), `Missing or non-regular committed document: ${file}`);
  const size = Number(git(repo, "cat-file", "-s", entry.oid));
  requireThat(Number.isSafeInteger(size) && size >= 0 && size <= planningLimits.fileBytes, `Committed document too large: ${file}`);
  return decode(runGit(repo, size + 1, ["cat-file", "blob", entry.oid]), `Invalid UTF-8: ${file}`);
}
export function changedFiles(repo, before, after) {
  return git(repo, "diff-tree", "--no-commit-id", "--no-renames", "--name-only", "-r", "-z", before, after).split("\0").filter(Boolean).sort();
}

export function committedOutputHashes(repo, ref, paths, maxBytes) {
  if (!paths.length) return {};
  requireThat(paths.every(safePlanningPath), "Unsafe committed output path");
  const tree = entries(repo, ref, paths);
  return Object.fromEntries(paths.map((file) => {
    const entry = tree.get(file);
    if (!entry) return [file, null];
    requireThat(entry.type === "blob" && ["100644", "100755"].includes(entry.mode), "Non-regular committed worker output");
    return [file, sha256(runGit(repo, maxBytes, ["cat-file", "blob", entry.oid]))];
  }));
}

export function candidate(o, requireCheckout = true) {
  repository(o.repo);
  const base = commit(o.repo, o.base);
  const head = commit(o.repo, o.head);
  const plan = commit(o.repo, o.plan);
  const mode = o.mode ?? "task-guided";
  requireThat(["goal-first", "task-guided"].includes(mode), "Unknown candidate mode");
  root(o.change);
  ancestor(o.repo, base, head);
  ancestor(o.repo, plan, head);
  const approved = planning(o.repo, plan, o.change);
  const current = planning(o.repo, head, o.change);
  let planDigest = current.digest;
  let gates;
  if (mode === "goal-first") {
    const context = policyContext({ repo: o.repo, change: o.change, plan, target: o.target });
    requireThat(context.goalFirstOptIn && context.parent === base, "Candidate lacks integrated Goal-First policy");
    const goal = goalSnapshot(o.repo, head, o.change, context.parent, current);
    const frozen = goalSnapshot(o.repo, plan, o.change, context.parent, approved);
    requireThat(goal.digest === frozen.digest, "Goal Contract changed after approval");
    requireThat(current.normalizedTasksSha256 === approved.normalizedTasksSha256, "Native outcome task changed after approval");
    const allowed = [...frozen.contract.scope, `${root(o.change)}tasks.md`];
    const outside = changedFiles(o.repo, plan, head).find((file) => !safePlanningPath(file) || !withinScope(file, allowed));
    requireThat(!outside, `Goal Contract scope drift: ${outside}`);
    requireThat(o["expect-plan"] !== undefined, "Goal-First requires an expected contract digest");
    planDigest = goal.digest;
    gates = frozen.contract.gates;
  } else requireThat(current.digest === approved.digest, "Planning content changed after approval");
  requireThat(Boolean(o["gate-run"]) === Boolean(o["gate-run-sha256"]), "Provide both --gate-run and --gate-run-sha256");
  if (o["expect-plan"] !== undefined) requireThat(o["expect-plan"] === planDigest, "Approved plan digest mismatch");
  if (requireCheckout) clean(o.repo, head);
  const tree = git(o.repo, "rev-parse", `${head}^{tree}`).trim();
  if (o["gate-run"]) {
    const options = { implementation: o.repo, head, tree, mode, plan, planDigest, change: o.change, gates };
    const bytes = readBounded(o["gate-run"]);
    requireThat(sha256(bytes) === o["gate-run-sha256"], "Retained gate evidence file identity mismatch");
    const attested = verifyGateRun(JSON.parse(decode(bytes, "Gate evidence is not valid UTF-8")), options);
    requireThat(attested.passed, "Failed exact-SHA disposable gate evidence");
  }
  return { base, head, plan, planDigest, tree, tasksComplete: current.complete };
}
function evidence(file) {
  const absolute = path.resolve(file);
  const before = lstatSync(absolute);
  requireThat(before.isFile() && !before.isSymbolicLink() && before.size <= MAX_EVIDENCE_BYTES, "Expected a regular bounded evidence JSON file");
  // Read through one descriptor: the path cannot be swapped for a symlink or larger
  // file between inspection and use. O_NOFOLLOW is applied where the platform has it.
  let descriptor;
  try { descriptor = openSync(absolute, constants.O_RDONLY | (constants.O_NOFOLLOW || 0) | (constants.O_NONBLOCK || 0)); }
  catch { throw new Error("Expected a regular bounded evidence JSON file"); }
  try {
    const info = fstatSync(descriptor);
    requireThat(info.isFile() && info.size <= MAX_EVIDENCE_BYTES && info.dev === before.dev && info.ino === before.ino, "Evidence file changed while it was opened");
    const buffer = Buffer.alloc(info.size + 1);
    let total = 0;
    while (total < buffer.length) {
      const read = readSync(descriptor, buffer, total, buffer.length - total, null);
      if (read === 0) break;
      total += read;
    }
    requireThat(total === info.size, "Evidence file changed while it was read");
    const bytes = buffer.subarray(0, total);
    const source = decode(bytes, "Evidence file is not valid UTF-8");
    let value;
    try { value = JSON.parse(source); } catch { throw new Error("Evidence file is not valid JSON"); }
    requireThat(value && typeof value === "object" && !Array.isArray(value) && value.schemaVersion === 1, "Unsupported evidence schema");
    return { value, bytes, sha256: createHash("sha256").update(bytes).digest("hex") };
  } finally { closeSync(descriptor); }
}
function identity(value, o) {
  requireThat(/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/issues\/[1-9][0-9]*$/.test(o.issue ?? ""), "Expected a canonical GitHub issue URL");
  requireThat(value.change === o.change && value.issueUrl === o.issue, "Evidence change/issue identity mismatch");
}
function gates(value, ref) {
  requireThat(Array.isArray(value) && value.length > 0, "Missing executed gate evidence");
  for (const gate of value) requireThat(gate && text(gate.command) && gate.commit === ref && gate.exitCode === 0 && text(gate.evidence), "Failed, missing or wrong-revision gate evidence");
}
function review(value, snapshot, o) {
  requireThat(value && typeof value === "object", "Missing review evidence");
  requireThat(value.schemaVersion === 1, "Unsupported review schema");
  identity(value, o);
  requireThat(value.head === snapshot.head && value.planDigest === snapshot.planDigest, "Review names a stale candidate or plan");
  requireThat(value.verdict === "pass" && Array.isArray(value.findings) && value.findings.length === 0, "Unresolved review findings");
  requireThat(text(value.reviewer) && text(value.reference), "Missing independent review references");
  gates(value.gates, snapshot.head);
}
const sameEntry = (a, b) => Boolean(a && b && a.oid === b.oid && a.mode === b.mode && a.type === b.type);
const isEvidence = (relative) => relative.startsWith("evidence/") && /\.(?:json|md|txt|log)$/.test(relative);
const isRegular = (entry) => entry?.mode === "100644" && entry.type === "blob";
function archivesIn(tree, change) {
  const pattern = archivePattern(change);
  return [...new Set([...tree.keys()].filter((file) => pattern.test(file)).map((file) => file.match(pattern)[0]))];
}
// One commit edge may only add new evidence or move the package into one archive.
function delta(before, after, change, label) {
  const active = root(change);
  const pattern = archivePattern(change);
  for (const file of new Set([...before.keys(), ...after.keys()])) {
    const old = before.get(file);
    const current = after.get(file);
    if (sameEntry(old, current)) continue;
    const reject = () => { throw new Error(`Unverified target content: ${file} (${label})`); };
    if (file.startsWith(active)) {
      const relative = file.slice(active.length);
      if (!current) {
        requireThat(archivesIn(after, change).some((prefix) => sameEntry(old, after.get(prefix + relative))), `Unverified target content: ${file} (${label})`);
        continue;
      }
      requireThat(!old && isRegular(current) && isEvidence(relative), `Unverified target content: ${file} (${label})`);
      continue;
    }
    const archive = pattern.test(file) ? file.match(pattern)[0] : null;
    if (!archive) reject();
    const relative = file.slice(archive.length);
    requireThat(!old, `Unverified target content: ${file} (${label})`);
    requireThat((isRegular(current) && isEvidence(relative)) || sameEntry(current, before.get(active + relative)), `Unverified target content: ${file} (${label})`);
  }
}
// Every closure commit is checked against its in-range parents, not only the net
// verified..target diff, so evidence added and later rewritten cannot disappear.
function fresh(repo, verified, target, change, limit) {
  const commits = git(repo, "rev-list", `${verified}..${target}`).trim().split("\n").filter(Boolean);
  requireThat(commits.length <= limit, `Closure history is too large to verify (${commits.length} commits > ${limit})`);
  const known = new Set([verified, ...commits]);
  const trees = new Map([[verified, entries(repo, verified)]]);
  const tree = (ref) => {
    if (!trees.has(ref)) trees.set(ref, entries(repo, ref));
    return trees.get(ref);
  };
  for (const sha of commits) {
    const [current, ...parents] = git(repo, "rev-list", "--parents", "-n", "1", sha).trim().split(/\s+/);
    requireThat(current === sha && parents.length > 0, "Closure history contains an unrelated root commit");
    for (const parent of parents.filter((value) => known.has(value))) delta(tree(parent), tree(sha), change, `commit ${sha}`);
  }
  delta(tree(verified), tree(target), change, `verified..target ${target}`);
  const after = tree(target);
  const archives = archivesIn(after, change);
  requireThat(archives.length <= 1, "Duplicate canonical change archives");
  if (archives.length) requireThat(![...after.keys()].some((file) => file.startsWith(root(change))), "Both active and archived canonical change exist");
}
function receiptPath(value, change) {
  requireThat(text(value), "Receipt path must name a committed evidence JSON file");
  requireThat(!path.isAbsolute(value) && !value.includes("\\"), "Receipt path must be a repository-relative POSIX path");
  requireThat(value.split("/").every((segment) => segment && segment !== "." && segment !== ".."), "Receipt path must not contain empty, '.' or '..' segments");
  const active = root(change);
  const owner = value.startsWith(active) ? active : (value.match(archivePattern(change)) ?? [null])[0];
  requireThat(owner, "Receipt path must be inside the selected change or its archive");
  const relative = value.slice(owner.length);
  requireThat(relative.startsWith("evidence/") && relative.endsWith(".json"), "Receipt path must name a committed evidence JSON file");
  return value;
}
function receipt(o) {
  const record = evidence(o.receipt);
  identity(record.value, o);
  const mode = record.value.mode ?? "task-guided";
  const snapshot = candidate({ ...o, mode, base: record.value.base, head: record.value.head, plan: record.value.plan,
    "expect-plan": record.value.planDigest }, false);
  requireThat(snapshot.tasksComplete, "Incomplete implementation tasks cannot complete a change");
  review(record.value.review, snapshot, o);
  const integrated = commit(o.repo, record.value.integrated);
  const verified = commit(o.repo, record.value.verified);
  const target = commit(o.repo, o.target);
  ancestor(o.repo, snapshot.head, integrated);
  ancestor(o.repo, integrated, verified);
  ancestor(o.repo, verified, target);
  const prPrefix = o.issue.split("/issues/")[0] + "/pull/";
  requireThat(typeof record.value.integrationReference === "string" && record.value.integrationReference.startsWith(prPrefix) && /^[1-9][0-9]*$/.test(record.value.integrationReference.slice(prPrefix.length)), "Missing canonical integration PR reference");
  for (const ref of [integrated, verified]) {
    const current = planning(o.repo, ref, o.change);
    const digest = mode === "goal-first" ? goalSnapshot(o.repo, ref, o.change, snapshot.base, current).digest : current.digest;
    requireThat(digest === snapshot.planDigest && current.complete, "Integrated planning content changed or tasks incomplete");
  }
  gates(record.value.gates, verified);
  fresh(o.repo, verified, target, o.change, o.limit);
  if (o["receipt-path"] !== undefined) {
    const published = receiptPath(o["receipt-path"], o.change);
    const entry = entries(o.repo, target).get(published);
    requireThat(entry && isRegular(entry), "Published receipt must be a committed regular file");
    requireThat(gitBytes(o.repo, "show", `${target}:${published}`).equals(record.bytes), "Published receipt bytes differ from the supplied evidence file");
  }
  // Integrated verification may run detached at this exact target SHA. Candidate
  // and review checks still require an attached implementation branch.
  clean(o.repo, target, false);
  return { ...snapshot, integrated, verified, target, receiptSha256: record.sha256 };
}
export function integratedPolicyContext(repo, parent, target, allowUnintegratedParent = false) {
  repository(repo);
  commit(repo, parent);
  commit(repo, target);
  let integrated = true;
  try { ancestor(repo, parent, target); }
  catch (error) {
    if (!allowUnintegratedParent) throw error;
    integrated = false;
  }
  const contractInputs = {};
  const budget = planningBudget();
  let rootContractSource = "";
  for (const [file, entry] of entries(repo, parent)) {
    if (!["AGENTS.md", "CLAUDE.md"].includes(file.split("/").at(-1))) continue;
    requireThat(entry.type === "blob" && ["100644", "100755"].includes(entry.mode), `Contributor contract must be a regular file: ${file}`);
    const size = Number(git(repo, "cat-file", "-s", entry.oid));
    budget.add(file, size);
    const bytes = runGit(repo, size + 1, ["cat-file", "blob", entry.oid]);
    contractInputs[file] = sha256(bytes);
    if (file === "AGENTS.md" || (file === "CLAUDE.md" && !contractInputs["AGENTS.md"])) {
      rootContractSource = decode(bytes, `Invalid contributor contract UTF-8: ${file}`);
    }
  }
  const source = rootContractSource.replace(/^ {0,3}(`{3,}|~{3,}).*\r?\n[\s\S]*?^ {0,3}\1[ \t]*\r?$/gm, "");
  const markers = [...source.matchAll(/^<!-- openspec-delivery-mode: ([a-z-]+) -->\r?$/gm)];
  const goalFirstOptIn = markers.length === 1 && markers[0][1] === "goal-first";
  const workers = [...source.matchAll(/^<!-- openspec-worker-runtime: ([^\r\n]*?) -->\r?$/gm)];
  requireThat(!integrated || !workers.length || workers.length === 1 && workers[0][1] === "exclusive",
    "Ambiguous or unsupported exclusive worker runtime selection");
  const delegatedRuntime = integrated && workers.length === 1;
  const proposals = [...source.matchAll(/^<!-- openspec-proposal: ([^\r\n]*?) -->\r?$/gm)];
  const proposeToFreeze = integrated && proposals.length === 1 && proposals[0][1] === "propose-to-freeze";
  return { ok: integrated, parent, target, contractInputs, goalFirstOptIn: integrated && goalFirstOptIn, delegatedRuntime, proposeToFreeze };
}

export function policyContext(o, { allowUnintegratedParent = false } = {}) {
  repository(o.repo);
  const plan = commit(o.repo, o.plan);
  const parents = git(o.repo, "rev-list", "--parents", "-n", "1", plan).trim().split(/\s+/).slice(1);
  requireThat(parents.length === 1, "Plan must have one integrated parent");
  const context = integratedPolicyContext(o.repo, parents[0], o.target, allowUnintegratedParent);
  const result = planning(o.repo, plan, o.change);
  return { ...context, change: o.change, plan, planDigest: result.digest, inputs: result.inputs,
    inventory: result.inventory, changedPaths: changedFiles(o.repo, context.parent, plan) };
}
export function draftPolicyContext(o) {
  const context = integratedPolicyContext(o.repo, o.parent, o.target);
  const draftHead = o.draftHead ?? context.parent;
  requireThat(git(o.repo, "rev-parse", "HEAD").trim() === draftHead, "Draft checkout is not at the declared integrated parent or predecessor");
  if (o.draftHead) requireThat(policyContext({ ...o, plan: draftHead }).parent === context.parent,
    "Superseded plan does not share the integrated draft parent");
  const draft = planningWorktree(o.repo, o.change);
  const changes = git(o.repo, "diff", "--name-only", "-z", "--no-renames", "--ignore-submodules=none", context.parent, "--");
  const untracked = git(o.repo, "ls-files", "--others", "--exclude-standard", "-z");
  const staged = git(o.repo, "diff", "--cached", "--name-only", "-z", "--no-renames", context.parent, "--");
  const changedPaths = [...new Set([changes, untracked, staged].flatMap((list) => list.split("\0").filter(Boolean)))].sort();
  return { ...context, ...draft, plan: null, planDigest: null, changedPaths };
}

function main() {
  childEnv();
  const command = process.argv[2];
  requireThat(["planning", "planning-worktree", "policy-context", "candidate", "review", "receipt"].includes(command), "Expected planning, planning-worktree, policy-context, candidate, review or receipt command");
  const args = process.argv.slice(3);
  const names = ["repo", "change", ...(command === "planning-worktree" ? [] : command === "policy-context" ? ["plan", "target"] : command === "planning" ? ["head"] : command === "receipt" ? ["target", "receipt", "issue", "receipt-path", "max-closure-commits"] : ["base", "head", "plan", "expect-plan", "gate-run", "gate-run-sha256", "mode", "target", ...(command === "review" ? ["issue", "review"] : [])])];
  const seen = new Set();
  for (const arg of args) {
    const match = /^--([A-Za-z][A-Za-z-]*)(?:=|$)/.exec(arg);
    if (!match) continue;
    requireThat(!seen.has(match[1]), `Duplicate option --${match[1]}`);
    seen.add(match[1]);
  }
  const { values: o } = parseArgs({ args, options: Object.fromEntries(names.map((key) => [key, { type: "string" }])), strict: true, allowPositionals: false });
  for (const key of names.filter((key) => !["expect-plan", "gate-run", "gate-run-sha256", "mode", "target", "receipt-path", "max-closure-commits"].includes(key))) requireThat(text(o[key]), `Missing --${key}`);
  if (o["expect-plan"] !== undefined) requireThat(/^[a-f0-9]{64}$/.test(o["expect-plan"]), "Expected a full plan digest");
  repository(o.repo);
  if (command === "planning-worktree") return writeFileSync(1, `${JSON.stringify(planningWorktree(o.repo, o.change))}\n`);
  if (command === "policy-context") return writeFileSync(1, `${JSON.stringify(policyContext(o))}\n`);
  if (command === "planning") {
    const head = commit(o.repo, o.head);
    const result = planning(o.repo, head, o.change);
    return writeFileSync(1, `${JSON.stringify({ ok: true, head, change: o.change, planDigest: result.digest, inputs: result.inputs, inventory: result.inventory })}\n`);
  }
  if (command === "candidate") return writeFileSync(1, `${JSON.stringify({ ok: true, ...candidate(o) })}\n`);
  if (command === "review") {
    requireThat(o.mode !== "goal-first", "Use the packaged delivery result decision for Goal-First review");
    const snapshot = candidate(o);
    review(evidence(o.review).value, snapshot, o);
    return writeFileSync(1, `${JSON.stringify({ ok: true, ...snapshot })}\n`);
  }
  const limit = o["max-closure-commits"] === undefined ? MAX_CLOSURE_COMMITS : Number(o["max-closure-commits"]);
  requireThat(Number.isInteger(limit) && limit > 0 && limit <= MAX_CLOSURE_COMMITS, `--max-closure-commits must be an integer from 1 to ${MAX_CLOSURE_COMMITS}`);
  writeFileSync(1, `${JSON.stringify({ ok: true, ...receipt({ ...o, limit }) })}\n`);
}
function isMain() {
  try { return realpathSync(process.argv[1]) === realpathSync(new URL(import.meta.url)); }
  catch { return false; }
}
if (isMain()) {
  try { main(); }
  catch (error) { writeFileSync(1, `${JSON.stringify({ ok: false, error: error.message })}\n`); process.exitCode = 1; }
}
