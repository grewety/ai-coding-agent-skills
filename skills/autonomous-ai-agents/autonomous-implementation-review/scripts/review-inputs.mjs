import { privatePath } from "./agent-configuration.mjs";
import { resolveInstalledExecutable } from "./agent-discovery.mjs";
import { customPlanningPath, planningBudget, planningLayout, validatePlanningInputs } from "./planning-inventory.mjs";
import { directReviewAdopted, readLowTouchPolicy, readReviewProofLevel } from "./low-touch-policy.mjs";
import { relocatedPlan } from "./review-archive.mjs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { accessSync, constants, lstatSync, realpathSync } from "node:fs";
import { chmod, lstat, mkdir, opendir, readdir } from "node:fs/promises";
import path from "node:path";
import { readClosed, safePath, validateRequest, writeClosed } from "./worker-handoff.mjs";

export const need = (condition, message) => { if (!condition) throw new Error(message); };
export const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
export const digest = (s) => typeof s === "string" && /^[0-9a-f]{64}$/.test(s);
export const sha = (s) => typeof s === "string" && /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(s);
export const uuid = (s) => typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(s);
export const text = (s) => typeof s === "string" && s.trim().length > 0 && s.length <= 8192;
export const plain = (v) => v !== null && typeof v === "object" && Object.getPrototypeOf(v) === Object.prototype;
export const equal = (a, b) => canonical(a) === canonical(b);
export const canonical = (value) => JSON.stringify(value, (_, v) => plain(v)
  ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]])) : v);
export const jsonBytes = (v) => Buffer.from(canonical(v) + "\n");
export const utf8 = (bytes) => new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
export const fileLimit = 64 * 1024;
export const totalLimit = 8 * 1024 * 1024;
export const maxPackets = 32;

export function fields(value, allowed, label, optional = []) {
  need(plain(value) && allowed.every((key) => Object.hasOwn(value, key)) &&
    Object.keys(value).every((key) => allowed.includes(key) || optional.includes(key)), `Invalid ${label} schema`);
}

export function parseStrictJson(bytes) {
  const input = utf8(bytes);
  // Walk the JSON grammar before JSON.parse, comparing decoded member names.
  const token = /[\x20\t\r\n]*("(?:[^"\\\x00-\x1f]|\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))*"|[{}\[\]:,]|true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/y;
  let next;
  const advance = () => { next = token.exec(input)?.[1]; };
  const fail = () => { throw new Error("Invalid or duplicate JSON fields"); };
  function value(depth) {
    if (!next || depth > 64) fail();
    const opening = next;
    advance();
    if (opening === "{" || opening === "[") {
      const close = opening === "{" ? "}" : "]";
      const seen = new Set();
      if (next !== close) {
        for (;;) {
          if (opening === "{") {
            if (!next?.startsWith('"')) fail();
            const key = JSON.parse(next);
            if (seen.has(key)) fail();
            seen.add(key);
            advance();
            if (next !== ":") fail();
            advance();
          }
          value(depth + 1);
          if (next !== ",") break;
          advance();
        }
      }
      if (next !== close) fail();
      advance();
    } else if (/^[\]}:,]$/.test(opening)) fail();
  }
  advance();
  value(0);
  if (next !== undefined) fail();
  try { return JSON.parse(input); } catch { return fail(); }
}

export async function readJson(filename, limit = totalLimit, sealed = false) {
  return parseStrictJson(await readClosed(filename, limit, sealed));
}

export const relative = (name) => typeof name === "string" && name.length <= 768 &&
  name.split("/").every((part) => /^[a-zA-Z0-9_.@+-]+$/.test(part) && ![".", "..", ".git"].includes(part.toLowerCase()));
export const absolute = (name) => typeof name === "string" && path.isAbsolute(name) &&
  path.normalize(name) === name && !/[\x00-\x1f\x7f]/.test(name);
export const within = (root, name) => {
  const rel = path.relative(root, name);
  return rel === "" || (!path.isAbsolute(rel) && rel !== ".." && !rel.startsWith(".." + path.sep));
};
export const separate = (a, b) => !within(a, b) && !within(b, a);

export function scanExport(name, bytes) {
  need(relative(name) && !/(?:^|\/)(?:\.env(?:\.|$)|\.npmrc$|\.netrc$|\.aws$|\.ssh$|\.claude$|(?:credentials|secrets)(?:\.|$)|id_(?:rsa|ed25519))/i.test(name),
    "Suspect export path");
  need(bytes.length <= fileLimit, "Whole-file export limit exceeded");
  const source = utf8(bytes);
  need(!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(source) &&
    !/-----BEGIN [A-Z ]*PRIVATE KEY-----|sk-ant-[\w-]{12,}|gh[pousr]_[\w]{16,}|AKIA[A-Z0-9]{16}|(?:password|secret|api[_-]?key|token)\s*[:=]\s*["']?[A-Za-z0-9_+/=-]{16,}/i.test(source),
    "Suspect export content");
}

export function packetize(diff, entries, limit, fits = () => true) {
  const sections = diff.split(/(?=^diff --git )/m).filter(Boolean);
  need(sections.length === entries.length && sections.every((section) => section.startsWith("diff --git ")), "Unmatched diff entry");
  const result = [];
  let current = { diff: "", paths: [], units: [] };
  for (const [file, section] of sections.entries()) {
    const [header, ...hunks] = section.split(/(?=^@@ )/m);
    need(!section.includes("\nBinary files ") && !section.includes("\nGIT binary patch"), "Unsupported binary diff");
    const units = Buffer.byteLength(section) <= limit || !hunks.length ? [section] : hunks.map((hunk) => header + hunk);
    for (const [part, unit] of units.entries()) {
      need(Buffer.byteLength(unit) <= limit, "Diff hunk exceeds packet limit");
      if (current.units.length && (Buffer.byteLength(current.diff) + Buffer.byteLength(unit) > limit ||
        !fits([...new Set([...current.paths, ...entries[file].paths])], current.diff + unit))) {
        result.push(current);
        current = { diff: "", paths: [], units: [] };
      }
      need(fits([...new Set([...current.paths, ...entries[file].paths])], current.diff + unit), "Whole packet Read budget exceeded");
      current.diff += unit;
      current.paths = [...new Set([...current.paths, ...entries[file].paths])].sort();
      current.units.push({ file, part, parts: units.length, sha256: hash(unit) });
    }
  }
  result.push(current);
  need(result.length <= maxPackets, "Diff packet count limit exceeded");
  return result;
}

const windowsGitVerificationMs = 10_000;
let windowsGitVerification;

function windowsGitIdentity(searchPath) {
  for (const entry of searchPath.split(path.delimiter)) {
    if (!absolute(entry)) continue;
    let file;
    try {
      file = realpathSync(path.join(entry, "git.exe"));
      if (!lstatSync(file).isFile()) continue;
      accessSync(file, constants.X_OK);
    } catch { continue; }

    // Include every canonical location covered by the resolver's ACL checks.
    // Recheck the first PATH match so a newly appearing executable invalidates reuse.
    try {
      const directory = realpathSync(entry);
      const locations = new Set([file, path.dirname(file), directory, path.dirname(directory)]);
      const identity = [...locations].map((location) => {
        const stat = lstatSync(location, { bigint: true });
        need((location === file ? stat.isFile() : stat.isDirectory()) && stat.ino !== 0n && stat.ctimeNs > 0n,
          "Unverifiable Git executable or directory identity");
        return [location, stat.dev, stat.ino, stat.mode, stat.size, stat.birthtimeNs, stat.mtimeNs, stat.ctimeNs].map(String);
      });
      return { file, identity: JSON.stringify([entry, identity]) };
    } catch { return null; }
  }
  return null;
}

function windowsGitExecutable(workspace, systemRoot) {
  const searchPath = process.env.PATH ?? "";
  const root = realpathSync(workspace);
  const observed = windowsGitIdentity(searchPath);
  const verified = windowsGitVerification;
  if (verified && observed?.identity === verified.identity && searchPath === verified.searchPath &&
      systemRoot === verified.systemRoot && workspace === verified.workspace && root === verified.root &&
      performance.now() < verified.expires &&
      separate(workspace, observed.file) && separate(root, observed.file)) {
    return observed.file;
  }

  windowsGitVerification = undefined;
  const file = resolveInstalledExecutable("git", { searchPath, excluded: [workspace, root] });
  need(realpathSync(workspace) === root, "Git workspace changed during safety resolution");
  if (observed) {
    const confirmed = windowsGitIdentity(searchPath);
    need(confirmed?.identity === observed.identity && confirmed.file === file, "Git executable changed during safety resolution");
    windowsGitVerification = { identity: confirmed.identity, searchPath, systemRoot, workspace, root,
      expires: performance.now() + windowsGitVerificationMs };
  }
  return file;
}

export function git(workspace, ...args) {
  try {
    const windows = process.platform === "win32";
    const systemRoot = windows ? process.env.SystemRoot : undefined;
    const executable = windows ? windowsGitExecutable(workspace, systemRoot) : "/usr/bin/git";
    const disabled = windows ? "NUL" : "/dev/null";
    return execFileSync(executable, [
      "--no-pager", "-c", "core.hooksPath=" + disabled, "-c", "core.quotePath=true",
      "-c", "core.fsmonitor=false", "-c", "core.untrackedCache=false",
      "-c", "diff.external=", "-c", "core.attributesFile=" + disabled, ...args,
    ], {
      cwd: workspace, windowsHide: windows, env: {
        ...(windows ? { SystemRoot: systemRoot, PATH: path.dirname(executable),
          USERPROFILE: path.join(path.parse(workspace).root, "Nonexistent"),
          GIT_CONFIG_GLOBAL: disabled } : { PATH: "/usr/bin:/bin" }),
        HOME: "/nonexistent", XDG_CONFIG_HOME: "/nonexistent",
        GIT_CONFIG_NOSYSTEM: "1", GIT_OPTIONAL_LOCKS: "0", GIT_NO_REPLACE_OBJECTS: "1", GIT_NO_LAZY_FETCH: "1", LC_ALL: "C" },
      maxBuffer: totalLimit, timeout: 10000, stdio: ["ignore", "pipe", "pipe"],
    });
  } catch { throw new Error("Git identity or bounded object read failed"); }
}

export async function verifiedGitRoot(workspace) {
  await safePath(workspace);
  await safePath(path.join(workspace, ".git"));
  need(path.normalize(utf8(git(workspace, "rev-parse", "--show-toplevel")).trimEnd()) === workspace, "Git workspace identity mismatch");
  need(!utf8(git(workspace, "for-each-ref", "--format=%(refname)", "refs/replace/")).trim(), "Unsupported Git replace references");
  for (const local of ["info/grafts", "objects/info/alternates"]) {
    const file = path.normalize(utf8(git(workspace, "rev-parse", "--path-format=absolute", "--git-path", local)).trimEnd());
    need(absolute(file), "Malformed Git object topology locator");
    try { await lstat(file); throw new Error("Unsupported Git graft or alternate object store"); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
  }
}

export const planningPrefix = (change) => `openspec/changes/${change}/`;


export function tree(workspace, ref, paths = []) {
  const entries = utf8(git(workspace, "ls-tree", "-r", "-z", "--full-tree", ref, "--", ...paths)).split("\0").filter(Boolean);
  const result = new Map();
  for (const entry of entries) {
    const match = /^(\d{6}) (blob|commit) ([a-f0-9]+)\t([^\n]+)$/.exec(entry);
    need(match && sha(match[3]), "Invalid Git tree entry");
    need(!result.has(match[4]), "Duplicate Git review path");
    result.set(match[4], { mode: match[1], oid: match[3] });
  }
  return result;
}

function blob(workspace, entry, name) {
  need(entry && ["100644", "100755"].includes(entry.mode), "Expected regular Git export file");
  const size = Number(utf8(git(workspace, "cat-file", "-s", entry.oid)).trim());
  need(Number.isSafeInteger(size) && size >= 0 && size <= fileLimit, "Whole-file export limit exceeded");
  const bytes = git(workspace, "cat-file", "blob", entry.oid);
  need(bytes.length === size, "Git blob size mismatch");
  scanExport(name, bytes);
  return bytes;
}

function exportable(name, change) {
  if (name.startsWith(planningPrefix(change))) return customPlanningPath(name.slice(planningPrefix(change).length));
  const archive = /^openspec\/changes\/archive\/\d{4}-\d{2}-\d{2}-([^/]+)\/(.+)$/.exec(name);
  return !archive || archive[1] !== change || customPlanningPath(archive[2]);
}

export function changedEntries(workspace, base, target, oldTree, newTree, change) {
  const options = ["--no-color", "--no-ext-diff", "--no-textconv", "--no-relative", "--find-renames=50%", "--diff-algorithm=myers", "--no-indent-heuristic"];
  const excluded = change ? [...new Set([...oldTree.keys(), ...newTree.keys()])].filter((name) => {
    const left = oldTree.get(name);
    const right = newTree.get(name);
    return (left?.oid !== right?.oid || left?.mode !== right?.mode) && !exportable(name, change);
  }) : [];
  need(excluded.length <= 512 && excluded.reduce((n, name) => n + Buffer.byteLength(name) + 20, 0) <= 64 * 1024,
    "Excluded review diff inventory exceeds the bound");
  const filters = excluded.length ? [".", ...excluded.map((name) => ":(exclude,literal)" + name)] : [];
  const raw = utf8(git(workspace, "diff", ...options, "--raw", "-z", base, target, "--", ...filters)).split("\0");
  const entries = [];
  for (let i = 0; i < raw.length - 1;) {
    const header = /^:[0-7]{6} [0-7]{6} [a-f0-9]+ [a-f0-9]+ ([AMDRT])\d*$/.exec(raw[i++]);
    need(header, "Unsupported diff entry");
    const status = header[1];
    const before = raw[i++];
    const after = status === "R" ? raw[i++] : before;
    need(relative(before) && relative(after), "Unsafe changed path");
    entries.push({ status, before, after, paths: [
      ...(status === "A" ? [] : [`base/${before}`]),
      ...(status === "D" ? [] : [`target/${after}`]),
    ] });
    need((status === "A" || oldTree.has(before)) && (status === "D" || newTree.has(after)), "Diff tree mismatch");
  }
  const diff = utf8(git(workspace, "diff", ...options, "--patch", "--text", "--full-index", "--unified=3",
    "--src-prefix=a/", "--dst-prefix=b/", base, target, "--", ...filters));
  return { diff, entries };
}

function inventory(value) {
  need(plain(value) && Object.keys(value).length <= 256 &&
    Object.entries(value).every(([name, sha256]) => relative(name) && digest(sha256)), "Invalid approved file inventory");
}

export function validateReviewRequest(request) {
  fields(request, ["schemaVersion", "mode", "session", "worker", "snapshot", "attachments", "limits"], "review request", ["policy", "fileAcceptance"]);
  need(request.schemaVersion === 1 && ["candidate", "approach"].includes(request.mode) && uuid(request.session), "Invalid review request version, mode or session");
  const w = request.worker;
  validateRequest(w);
  need(plain(w?.identity) && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(w.identity.change) &&
    absolute(w.identity.workspace) && plain(w.authority) && w.identity.role === (request.mode === "candidate" ? "reviewer" : "approach-reviewer") &&
    ![w.identity.implementerSession, w.authority.authorSession, w.authority.orchestrator].includes(request.session), "Invalid independent worker binding");
  inventory(w.identity.inputs);
  validatePlanningInputs(w.identity.change, w.identity.inputs, undefined, Boolean(request.policy));
  if (request.policy !== undefined) {
    fields(request.policy, ["parent", "target"], "integrated policy binding", ["planningModes", "finishReference"]);
    need(sha(request.policy.parent) && sha(request.policy.target) &&
      (request.policy.finishReference === undefined || request.mode === "candidate" && text(request.policy.finishReference)),
    "Invalid integrated policy binding");
  }
  if (request.fileAcceptance !== undefined) {
    need(Array.isArray(request.fileAcceptance) && request.fileAcceptance.length > 0 && request.fileAcceptance.length <= 256,
      "Invalid file-specific acceptance list");
    for (const entry of request.fileAcceptance) {
      fields(entry, ["packet", "path", "criterion"], "file-specific acceptance");
      need(Number.isSafeInteger(entry.packet) && entry.packet > 0 && relative(entry.path) && text(entry.criterion) &&
        !w.acceptance.includes(entry.criterion), "File-specific acceptance requires a packet and canonical path");
    }
    need(new Set(request.fileAcceptance.map(canonical)).size === request.fileAcceptance.length, "Duplicate file-specific acceptance");
  }
  inventory(request.attachments);
  fields(request.limits, ["diffBytes"], "packet limits");
  need(Number.isSafeInteger(request.limits.diffBytes) && request.limits.diffBytes >= 256 &&
    request.limits.diffBytes <= fileLimit, "Invalid diff packet limit");
  const s = request.snapshot;
  if (request.mode === "candidate") {
    fields(s, ["base", "target", "plan", "planDigest", "diffSha256", "gates"], "candidate snapshot", ["archiveEvidence", "harness", "prFix"]);
    if (s.archiveEvidence !== undefined) inventory(s.archiveEvidence);
    if (s.prFix !== undefined) {
      fields(s.prFix, ["declaration", "source", "impacted"], "PR-fix review scope");
      need(request.policy && s.base !== s.plan && !s.archiveEvidence && relative(s.prFix.declaration) &&
        relative(s.prFix.source) && s.prFix.source !== s.prFix.declaration &&
        [s.prFix.declaration, s.prFix.source].every((file) => Object.hasOwn(request.attachments, file)) && Array.isArray(s.prFix.impacted) &&
        s.prFix.impacted.length <= 256 && s.prFix.impacted.every(relative) &&
        equal(s.prFix.impacted, [...new Set(s.prFix.impacted)].sort()), "Invalid PR-fix review scope");
    }
    if (s.harness !== undefined) need(relative(s.harness) && Object.hasOwn(request.attachments, s.harness), "Missing harness attachment");
    need([s.base, s.target, s.plan].every(sha) && [s.planDigest, s.diffSha256].every(digest) &&
      s.target === w.identity.candidate && s.plan === w.identity.plan && s.planDigest === w.identity.planDigest, "Candidate identity mismatch");
    need(Array.isArray(s.gates) && s.gates.length > 0, "Missing retained gates");
    for (const gate of s.gates) {
      fields(gate, ["command", "commit", "exitCode", "evidence"], "gate");
      need(text(gate.command) && gate.commit === s.target && gate.exitCode === 0 &&
        Object.hasOwn(request.attachments, gate.evidence), "Invalid or unexported candidate gate evidence");
    }
  } else {
    fields(s, ["record", "correction", "authority", "priorLaunches"], "approach snapshot");
    fields(s.record, ["schemaVersion", "change", "goal", "charter", "binding", "passRule", "budget",
      "cumulativeCycles", "entries", "ledger"], "convergence record");
    fields(s.record.charter, ["clauses", "boundaries", "tasks", "gates"], "review charter");
    if (s.correction !== null) fields(s.correction, ["verified", "reference", "strictExitCode", "metadataExitCode",
      "beforeInputs", "amendedInputs"], "planning correction");
    need(s.record?.change === w.identity.change && (s.record.binding?.client === "claude-code" || s.record.binding?.route === "direct-cli") &&
      Array.isArray(s.priorLaunches) && s.priorLaunches.length <= 1 &&
      (s.correction === null || plain(s.correction)), "Invalid approach identity");
    for (const prior of s.priorLaunches) {
      fields(prior, ["request", "expect", "export", "output"], "prior launch");
      need(Object.values(prior).every(absolute), "Invalid retained launch references");
    }
    fields(s.authority, ["reference", "write", "validate", "review"], "approach authority");
    need(text(s.authority.reference) && s.authority.review === true &&
      [s.authority.write, s.authority.validate].every((v) => typeof v === "boolean"), "Invalid approach authority");
  }
}

async function walk(root, prefix = "", sealed = false) {
  const directory = path.join(root, prefix);
  await safePath(directory);
  if (sealed) await checkSealedDirectory(directory);
  const paths = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = prefix ? prefix + "/" + entry.name : entry.name;
    need(relative(name), "Unsafe export entry");
    if (entry.isDirectory()) {
      const nested = await walk(root, name, sealed);
      need(nested.length > 0, "Unexpected empty directory");
      paths.push(...nested);
    } else {
      need(entry.isFile(), "Unsafe export entry");
      paths.push(name);
    }
    need(paths.length <= 8192, "Export inventory limit exceeded");
  }
  return paths.sort();
}

async function readApproved(root, name, sha256) {
  const file = path.join(root, name);
  const bytes = await readClosed(file, fileLimit);
  need(hash(bytes) === sha256 && (await lstat(file)).nlink === 1, "Approved file identity mismatch");
  scanExport(name, bytes);
  return bytes;
}

// Canonical frozen plan digest uses the same length framing as change-guard.
// Once frozen, task progress may change only real task checkboxes.
export function normalizeTasks(source, onTask = () => {}) {
  let fence = null;
  let comment = false;
  let count = 0;
  const bom = source.startsWith("\ufeff") ? "\ufeff" : "";
  const normalized = (source.slice(bom.length).match(/[^\n]*\n|[^\n]+$/g) ?? []).map((line) => {
    const body = line.replace(/\r?\n$/, "");
    const quote = /^(?: {0,3}> ?)*/.exec(body)[0];
    const content = body.slice(quote.length);
    const marker = /^( {0,3})(`{3,}|~{3,})(.*)$/.exec(content);
    if (fence) {
      if (marker && marker[2][0] === fence[0] && marker[2].length >= fence.length && !marker[3].trim()) fence = null;
      return line;
    }
    if (marker && !(marker[2][0] === "`" && marker[3].includes("`"))) { fence = marker[2]; return line; }
    if (comment) { if (content.includes("-->")) comment = false; return line; }
    if (content.startsWith("<!--")) { comment = !content.slice(4).includes("-->"); return line; }
    need(!/^(?: {4,}|\t)/.test(content) || !/^(?:[-*+]|\d{1,9}[.)])[ \t]+\[/.test(content.trimStart()), "Ambiguous task line");
    const task = /^( {0,3})([-*+]|\d{1,9}[.)])([ \t]+)\[([^\]]*)\](.*)$/.exec(content);
    if (!task) return line;
    if (!/^[ xX]$/.test(task[4]) && task[4].trim().length > 1 && /^[([]/.test(task[5])) return line;
    need(/^[ xX]$/.test(task[4]) && (!task[5] || /^[ \t]/.test(task[5])), "Invalid task checkbox");
    count++;
    onTask(/^[ \t]+(\d+\.\d+)(?=\s|$)/.exec(task[5])?.[1] ?? null, task[4].toLowerCase() === "x");
    return `${quote}${task[1]}${task[2]}${task[3]}[ ]${task[5]}${line.slice(body.length)}`;
  }).join("");
  need(!fence && !comment && count > 0, "Invalid frozen task file");
  return Buffer.from(bom + normalized);
}

// Re-read committed policy from the single frozen plan parent. A draft must
// supply its independent integrated target binding and exact draft predecessor.
export async function reviewPolicy(request) {
  const { workspace } = request.worker.identity;
  const binding = request.policy;
  if (request.mode === "approach" && !binding) return null;
  await verifiedGitRoot(workspace);
  const ref = request.mode === "candidate" ? request.snapshot.plan : binding.parent;
  if (request.mode === "candidate") need(sha(ref) &&
    utf8(git(workspace, "rev-parse", "--verify", ref + "^{commit}")).trim() === ref, "Expected exact plan commit");
  const [head, ...parents] = utf8(git(workspace, "rev-list", "-n", "1", "--parents", ref)).trim().split(" ");
  need(head === ref, "Invalid policy commit");
  if (request.mode === "candidate" && parents.length !== 1) {
    need(!binding, "Expected one integrated plan parent");
    return null;
  }
  const parent = request.mode === "candidate" ? parents[0] : binding.parent;
  const contracts = tree(workspace, parent, ["AGENTS.md", "CLAUDE.md"]);
  const name = contracts.has("AGENTS.md") ? "AGENTS.md" : "CLAUDE.md";
  const entry = contracts.get(name);
  if (!entry) { need(!binding, "Missing integrated root policy"); return null; }
  need(["100644", "100755"].includes(entry.mode), "Expected regular root policy");
  const size = Number(utf8(git(workspace, "cat-file", "-s", entry.oid)).trim());
  need(Number.isSafeInteger(size) && size <= 4 * 1024 * 1024, "Root policy exceeds planning bounds");
  const rootContract = utf8(git(workspace, "cat-file", "blob", entry.oid));
  const policy = readLowTouchPolicy(rootContract);
  const directReviewer = Boolean(policy && directReviewAdopted(rootContract));
  const proofLevel = readReviewProofLevel(rootContract, directReviewer);
  if (!policy) { need(!binding, "Integrated parent has not adopted low-touch policy"); return null; }
  need(binding?.parent === parent && utf8(git(workspace, "rev-parse", "--verify", binding.target + "^{commit}")).trim() === binding.target,
    "Missing exact integrated policy binding");
  git(workspace, "merge-base", "--is-ancestor", parent, binding.target);
  if (request.mode === "approach") {
    const [draft, ...draftParents] = utf8(git(workspace, "rev-list", "--parents", "-n", "1", "HEAD")).trim().split(" ");
    need(draft === parent || draftParents.length === 1 && draftParents[0] === parent,
      "Draft is not at the integrated parent or its frozen predecessor");
  }
  return directReviewer ? { ...policy, directReviewer: true, ...(proofLevel ? { proofLevel } : {}) } : policy;
}

function chargePlan(budget, file, size, directories) {
  const parts = file.split("/");
  for (let i = file.startsWith("openspec/changes/") ? 3 : parts.length; i < parts.length; i++) {
    const directory = parts.slice(0, i).join("/");
    if (directories.has(directory)) continue;
    budget.add(directory, null);
    directories.add(directory);
  }
  budget.add(file, size);
}

async function customDraftFiles(workspace, layout) {
  const budget = planningBudget(true);
  const paths = [];
  const directories = new Set();
  const add = async (name) => {
    await safePath(path.join(workspace, name));
    const info = await lstat(path.join(workspace, name));
    need(info.isFile(), "Expected a regular planning input");
    chargePlan(budget, name, info.size, directories);
    paths.push(name);
  };
  const walk = async (directory) => {
    const location = path.join(workspace, directory);
    await safePath(location);
    budget.add(directory, null);
    directories.add(directory);
    const handle = await opendir(location, { encoding: "buffer" });
    try {
      for (let entry; (entry = await handle.read());) {
        budget.visit();
        const name = directory + "/" + utf8(entry.name);
        if (!layout.includes(name)) {
          need(utf8(entry.name) !== ".git", "Nested Git repository in planning inventory");
          continue;
        }
        if (entry.isDirectory() && !layout.required.includes(name)) await walk(name);
        else await add(name);
      }
    } finally { await handle.close(); }
  };
  await add("openspec/config.yaml");
  await walk(layout.directory);
  return paths;
}

export function planFiles(w, entries, frozen, expectedDigest = w.identity.planDigest, custom = false) {
  const layout = planningLayout(w.identity.change, custom);
  const planning = [...entries.keys()].filter(layout.includes).sort();
  need(equal(planning, Object.keys(w.identity.inputs).sort()), "Git planning inventory mismatch");
  const hasher = createHash("sha256");
  const files = new Map();
  const budget = planningBudget(custom);
  const directories = new Set();
  for (const name of planning) {
    const entry = entries.get(name);
    const raw = blob(w.identity.workspace, entry, name);
    if (custom) chargePlan(budget, name, raw.length, directories);
    if (frozen) need(hash(raw) === w.identity.inputs[name], "Frozen planning byte mismatch");
    files.set(name, raw);
    const bytes = name === planningPrefix(w.identity.change) + "tasks.md" ? normalizeTasks(utf8(raw)) : raw;
    hasher.update(JSON.stringify([name, entry.mode, bytes.length]) + "\0").update(bytes).update("\0");
  }
  need(hasher.digest("hex") === expectedDigest, "Frozen Git plan digest mismatch");
  return files;
}

export async function buildExport(request) {
  validateReviewRequest(request);
  const w = request.worker;
  const { workspace, change, inputs } = w.identity;
  await safePath(workspace);
  const custom = Boolean(await reviewPolicy(request));
  const layout = planningLayout(change, custom);
  validatePlanningInputs(change, inputs, undefined, custom);
  if (custom) need(Object.keys(request.attachments).every((name) => exportable(name, change)),
    "Excluded planning paths cannot be attached to reviewer exports");
  const files = new Map();
  const common = [];
  const remember = (name, bytes) => {
    scanExport(name, bytes);
    files.set(name, bytes);
    need(files.size <= 512 && [...files.values()].reduce((n, b) => n + b.length, 0) <= totalLimit, "Export byte or file limit exceeded");
    return name;
  };
  for (const name of Object.keys(request.attachments).sort()) {
    common.push(remember("context/" + name, await readApproved(workspace, name, request.attachments[name])));
  }
  let packets;
  if (request.mode === "candidate") {
    const s = request.snapshot;
    await verifiedGitRoot(workspace);
    for (const commit of [s.base, s.target, s.plan]) {
      need(utf8(git(workspace, "rev-parse", "--verify", commit + "^{commit}")).trimEnd() === commit, "Expected exact Git commit");
    }
    git(workspace, "merge-base", "--is-ancestor", s.base, s.target);
    git(workspace, "merge-base", "--is-ancestor", s.plan, s.target);
    const oldTree = tree(workspace, s.base);
    const newTree = tree(workspace, s.target);
    const frozenTree = tree(workspace, s.plan);
    for (const [name, bytes] of planFiles(w, frozenTree, true, undefined, custom)) common.push(remember("plan/" + name, bytes));
    const logicalTree = relocatedPlan({ change, targetTree: newTree, baseTree: oldTree, frozenTree,
      predecessor: () => {
        const [target, ...parents] = utf8(git(workspace, "rev-list", "--parents", "-n", "1", s.target)).trim().split(" ");
        need(target === s.target && parents.length === 1 && sha(parents[0]), "Archive requires one verified immediate parent");
        git(workspace, "merge-base", "--is-ancestor", s.plan, parents[0]);
        git(workspace, "merge-base", "--is-ancestor", s.base, parents[0]);
        const parentTree = tree(workspace, parents[0]);
        planFiles(w, parentTree, false, undefined, custom);
        return parentTree;
      },
      additions: (name, entry) => {
        const expected = custom ? s.archiveEvidence : request.attachments;
        return expected && Object.hasOwn(expected, name) && expected[name] === hash(blob(workspace, entry, name));
      },
    });
    planFiles(w, logicalTree, false, undefined, custom);
    const { diff, entries } = changedEntries(workspace, s.base, s.target, oldTree, newTree, custom ? change : undefined);
    need(hash(diff) === s.diffSha256, "Approved diff hash mismatch");
    for (const entry of entries) for (const name of entry.paths) {
      const file = name.slice(name.indexOf("/") + 1);
      remember(name, blob(workspace, (name.startsWith("base/") ? oldTree : newTree).get(file), file));
    }
    for (const name of s.prFix?.impacted ?? []) {
      need(exportable(name, change), "Excluded PR-fix impacted path");
      common.push(remember("target/" + name, blob(workspace, newTree.get(name), name)));
    }
    common.push(remember("review-context.json", jsonBytes({
      base: s.base, target: s.target, plan: s.plan, planDigest: s.planDigest,
      acceptance: w.acceptance, outcome: w.outcome, scope: w.scope, nonGoals: w.nonGoals, gates: s.gates,
    })));
    packets = packetize(diff, entries, request.limits.diffBytes, (paths, patch) => {
      const assigned = [...new Set([...common, ...paths])];
      return assigned.length < 96 &&
        assigned.reduce((n, name) => n + files.get(name).length, Buffer.byteLength(patch)) <= 512 * 1024;
    }).map((part, index) => ({
      paths: [...new Set([...common, ...part.paths, remember(`diff/packet-${index + 1}.patch`, Buffer.from(part.diff))])].sort(), units: part.units,
    }));
  } else {
    const prefix = planningPrefix(change);
    const planning = custom ? await customDraftFiles(workspace, layout) : [...layout.required];
    for (const optional of custom ? [] : [prefix + "design.md", prefix + "specs"]) {
      try {
        await safePath(path.join(workspace, optional));
        if (optional.endsWith("/specs")) planning.push(...await walk(workspace, optional));
        else planning.push(optional);
      } catch (error) { if (error.code !== "ENOENT") throw error; }
    }
    need(equal(Object.keys(inputs).sort(), planning.sort()), "Planning worktree inventory drift");
    const modes = {};
    for (const name of planning) {
      common.push(remember("plan/" + name, await readApproved(workspace, name, inputs[name])));
      if (custom) modes[name] = (await lstat(path.join(workspace, name))).mode & 0o100 ? "100755" : "100644";
    }
    if (custom) need(equal(modes, request.policy.planningModes), "Planning worktree file mode drift");
    const { charter, ledger, goal, binding, budget, cumulativeCycles } = request.snapshot.record;
    common.push(remember("review-context.json", jsonBytes({ charter, ledger, goal, binding, budget, cumulativeCycles })));
    packets = [{ paths: common.sort(), units: [] }];
  }
  for (const entry of request.fileAcceptance ?? []) {
    need(packets[entry.packet - 1]?.paths.some((name) =>
      ["base/", "target/", "plan/"].some((prefix) => name === prefix + entry.path)),
    "File-specific acceptance is outside its packet");
  }
  if (packets.length > 1 && (custom || request.fileAcceptance)) {
    const reviewedPaths = new Set(packets.flatMap(({ paths }) => paths.filter((name) => /^(?:base|target|plan)\//.test(name))
      .map((name) => name.slice(name.indexOf("/") + 1))));
    need(w.acceptance.every((criterion) => criterion.split(/[^a-zA-Z0-9_./@+-]+/).every((token) => !reviewedPaths.has(token))),
      "File-specific acceptance must name an applicable packet, not global acceptance");
  }
  const manifest = { schemaVersion: 1, mode: request.mode, requestSha256: hash(jsonBytes(request)),
    files: [...files].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([name, bytes]) => ({ name, bytes: bytes.length, sha256: hash(bytes) })), packets };
  for (const packet of packets) {
    need(packet.paths.length <= 96 && packet.paths.reduce((n, name) => n + files.get(name).length, 0) <= 512 * 1024,
      "Whole packet Read budget exceeded");
  }
  return { manifest, files };
}

export async function protectedParent(directory) {
  await safePath(directory, true);
  const parent = await lstat(path.dirname(directory));
  need((process.platform === "win32" ? privatePath(path.dirname(directory), parent) : parent.uid === process.getuid() && (parent.mode & 0o022) === 0), "Protected directory parent must be owned and non-writable by other users");
  return path.dirname(directory);
}

export async function newProtectedDirectory(directory, excluded) {
  need(absolute(directory) && excluded.every((root) => separate(root, directory)), "Protected directory overlaps another authority");
  await protectedParent(directory);
  await mkdir(directory, { mode: 0o700 });
}

export async function checkSealedDirectory(directory) {
  await safePath(directory);
  const st = await lstat(directory);
  need(st.isDirectory() && (process.platform === "win32" ? privatePath(directory, st) : st.uid === process.getuid() && (st.mode & 0o7777) === 0o500), "Directory is not sealed");
}

export async function prepareExport(directory, request, expectedExport, inspect = () => {}) {
  const prepared = await buildExport(request);
  inspect(prepared);
  const manifestHash = hash(jsonBytes(prepared.manifest));
  if (expectedExport !== null) need(expectedExport === manifestHash, "Prepared manifest differs from retained identity");
  await newProtectedDirectory(directory, [request.worker.identity.workspace, ...request.worker.evidenceRoots]);
  for (const [name, bytes] of prepared.files) {
    const filename = path.join(directory, "files", name);
    await mkdir(path.dirname(filename), { recursive: true, mode: 0o700 });
    await writeClosed(filename, bytes, true);
  }
  await writeClosed(path.join(directory, "manifest.json"), jsonBytes(prepared.manifest), true);
  await sealDirectories(directory);
  await checkExport(directory, manifestHash, request);
  return manifestHash;
}

export async function sealDirectories(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) await sealDirectories(path.join(directory, entry.name));
  }
  if (process.platform !== "win32") await chmod(directory, 0o500);
}

export async function checkExport(directory, expected, request) {
  need(absolute(directory) && digest(expected) && separate(directory, request.worker.identity.workspace), "Missing independently retained export identity");
  const bytes = await readClosed(path.join(directory, "manifest.json"), totalLimit, true);
  const manifest = parseStrictJson(bytes);
  need(bytes.equals(jsonBytes(manifest)) && hash(bytes) === expected, "Export manifest drift");
  const rebuilt = await buildExport(request);
  need(equal(manifest, rebuilt.manifest), "Current approved inputs differ from export");
  const paths = await walk(directory, "", true);
  need(equal(paths, ["manifest.json", ...manifest.files.map((entry) => "files/" + entry.name)].sort()), "Export inventory mismatch");
  for (const entry of manifest.files) {
    const observed = await readClosed(path.join(directory, "files", entry.name), fileLimit, true);
    need(hash(observed) === entry.sha256 && observed.length === entry.bytes, "Changed export bytes");
  }
  return rebuilt;
}
