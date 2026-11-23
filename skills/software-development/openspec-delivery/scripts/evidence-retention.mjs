import { createHash } from "node:crypto";
import { closeSync, constants, fstatSync, lstatSync, openSync, readSync, realpathSync } from "node:fs";
import path from "node:path";
import { safePlanningPath } from "./planning-inventory.mjs";

export const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
export const storedArtifactSha256 = (content) => sha256(Buffer.from(requireString(content, "content"), "utf8"));
const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  return value;
};
export const stableJson = (value) => JSON.stringify(canonicalize(value));
const canonicalBytes = (value) => Buffer.from(stableJson(value), "utf8");
export const maxInput = 64 * 1024 * 1024;
export const maxCommands = 12;
export const maxStream = 1024 * 1024;
const utf8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
const requireThat = (condition, message) => { if (!condition) throw new Error(message); };
const sha = (value) => typeof value === "string" && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value);
const digest = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const text = (value) => typeof value === "string" && value.trim().length > 0;
export const separate = (a, b) => ![path.relative(a, b), path.relative(b, a)].some((relative) =>
  relative === "" || (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`)));

export function scopedPath(file, absent = false) {
  requireThat(typeof file === "string" && path.isAbsolute(file) && path.normalize(file) === file && !/[\x00-\x1f\x7f]/.test(file), "Expected an absolute normalized path");
  if (absent) requireThat(realpathSync(path.dirname(file)) === path.dirname(file), "Output parent is not canonical");
  else requireThat(realpathSync(file) === file, "Input is not canonical");
  return file;
}

export function readBounded(file, limit = maxInput) {
  scopedPath(file);
  const before = lstatSync(file);
  requireThat(before.isFile() && before.size <= limit, "Expected a bounded regular input file");
  const fd = openSync(file, constants.O_RDONLY | (constants.O_NOFOLLOW || 0) | (constants.O_NONBLOCK || 0));
  try {
    const info = fstatSync(fd);
    requireThat(info.isFile() && info.ino === before.ino && info.dev === before.dev && info.size === before.size, "Input changed during open");
    const bytes = Buffer.alloc(info.size + 1);
    let total = 0;
    while (total < bytes.length) {
      const size = readSync(fd, bytes, total, bytes.length - total, null);
      if (!size) break;
      total += size;
    }
    const after = fstatSync(fd);
    requireThat(total === info.size && after.mtimeMs === info.mtimeMs && after.ctimeMs === info.ctimeMs, "Input changed during read");
    return bytes.subarray(0, total);
  } finally { closeSync(fd); }
}
export const readJson = (file, limit) => JSON.parse(utf8.decode(readBounded(file, limit)));


function requireString(value, field) {
  if (typeof value !== "string") throw new Error(`${field} must be a string`);
  return value;
}

function requireText(value, field) {
  if (requireString(value, field).trim().length === 0) throw new Error(`${field} must be a non-empty string`);
  return value;
}

function parseUtcInstant(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) {
    return Number.NaN;
  }
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return Number.NaN;
  const expected = value.includes(".") ? value : value.replace("Z", ".000Z");
  return new Date(timestamp).toISOString() === expected ? timestamp : Number.NaN;
}

function requireUtcInstant(value, field) {
  requireText(value, field);
  if (Number.isNaN(parseUtcInstant(value))) throw new Error(`${field} must be a strict UTC instant`);
  return value;
}

function requireSha256(value, field) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) {
    throw new Error(`${field} must be a lowercase SHA-256 hex digest`);
  }
  return value;
}

function validateProvenance(provenance) {
  if (!provenance || typeof provenance !== "object" || Array.isArray(provenance)) {
    throw new Error("provenance must be an object");
  }
  const allowed = new Set(["source", "command", "environmentScope", "exitStatus", "observedAt", "extractedAt", "revision", "scope", "pagination", "readbackType"]);
  if (Object.keys(provenance).some((field) => !allowed.has(field))) throw new Error("unknown provenance field");
  for (const field of ["source", "environmentScope", "revision", "scope"]) {
    requireText(provenance[field], `provenance.${field}`);
  }
  if (provenance.readbackType !== "historical-extract" || Object.hasOwn(provenance, "observedAt")) {
    requireUtcInstant(provenance.observedAt, "provenance.observedAt");
  }
  if (!new Set(["original-response", "lossless-representation", "redacted-transformed", "historical-extract", "fresh-corroboration", "merge-snapshot"]).has(provenance.readbackType)) {
    throw new Error("provenance.readbackType must identify the readback type");
  }
  if (provenance.readbackType === "historical-extract") {
    requireUtcInstant(provenance.extractedAt, "provenance.extractedAt");
  } else if (Object.hasOwn(provenance, "extractedAt")) {
    throw new Error("provenance.extractedAt is only valid for historical-extract evidence");
  }
  if (!Array.isArray(provenance.command) || provenance.command.length === 0 || !provenance.command[0] || provenance.command.some((part) => typeof part !== "string" || part.includes("\0"))) {
    throw new Error("provenance.command must be a non-empty string array");
  }
  if (!Number.isInteger(provenance.exitStatus)) throw new Error("provenance.exitStatus must be an integer");
  if (!new Set(["complete", "partial", "not-applicable"]).has(provenance.pagination)) {
    throw new Error("provenance.pagination must be complete, partial, or not-applicable");
  }
  return provenance;
}

function validateLabels(labels) {
  if (!labels || typeof labels !== "object" || Array.isArray(labels)) {
    throw new Error("labels must be an object");
  }
  const allowed = new Set(["representation", "completeness", "confidentiality"]);
  if (Object.keys(labels).some((field) => !allowed.has(field))) throw new Error("unknown labels field");
  if (!new Set(["original-response", "lossless-representation", "redacted-transformed", "historical-extract", "fresh-corroboration", "merge-snapshot"]).has(labels.representation)) {
    throw new Error("labels.representation must identify the readback type");
  }
  if (!new Set(["complete", "partial", "not-applicable"]).has(labels.completeness)) {
    throw new Error("labels.completeness must be complete, partial, or not-applicable");
  }
  if (!new Set(["publishable", "restricted", "redacted"]).has(labels.confidentiality)) {
    throw new Error("labels.confidentiality must be publishable, restricted, or redacted");
  }
  return labels;
}

function validateCoherence(provenance, labels) {
  if (provenance.readbackType !== labels.representation) {
    throw new Error("readback type must match labels.representation");
  }
  if (provenance.pagination !== labels.completeness) {
    throw new Error("provenance.pagination must match labels.completeness");
  }
  if (provenance.readbackType === "redacted-transformed" && labels.confidentiality !== "redacted") {
    throw new Error("redacted-transformed evidence must be labeled redacted");
  }
  if (labels.confidentiality === "redacted" && provenance.readbackType !== "redacted-transformed") {
    throw new Error("redacted evidence must use redacted-transformed provenance");
  }
}

function wrapperPayload(representation) {
  return {
    schemaVersion: representation.schemaVersion,
    kind: representation.kind,
    encoding: representation.encoding,
    content: representation.content,
    storedArtifactSha256: representation.storedArtifactSha256,
    decodedOriginalSha256: representation.decodedOriginalSha256,
    provenance: representation.provenance,
    labels: representation.labels,
  };
}

export function sealRepresentation(representation) {
  return sha256(canonicalBytes(wrapperPayload(representation)));
}

function decodedBytes(representation) {
  requireText(representation.encoding, "encoding");
  requireString(representation.content, "content");
  if (representation.encoding === "utf8") {
    const bytes = Buffer.from(representation.content, "utf8");
    if (bytes.toString("utf8") !== representation.content) {
      throw new Error("utf8 content does not round-trip exactly");
    }
    return bytes;
  }
  if (representation.encoding === "base64") {
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(representation.content)) {
      throw new Error("base64 content is invalid");
    }
    const bytes = Buffer.from(representation.content, "base64");
    if (bytes.toString("base64") !== representation.content) throw new Error("base64 content is noncanonical");
    return bytes;
  }
  throw new Error(`unsupported encoding: ${representation.encoding}`);
}

export function createRepresentation({ original, provenance, labels }) {
  if (!Buffer.isBuffer(original)) throw new Error("original must be a Buffer");
  validateProvenance(provenance);
  validateLabels(labels);
  validateCoherence(provenance, labels);

  const asUtf8 = original.toString("utf8");
  const utf8Bytes = Buffer.from(asUtf8, "utf8");
  const encoding = utf8Bytes.equals(original) ? "utf8" : "base64";
  const content = encoding === "utf8" ? asUtf8 : original.toString("base64");
  const storedBytes = Buffer.from(content, "utf8");

  const representation = {
    schemaVersion: 1,
    kind: "lossless-evidence-representation",
    encoding,
    content,
    storedArtifactSha256: sha256(storedBytes),
    decodedOriginalSha256: sha256(original),
    provenance: { ...provenance },
    labels: { ...labels },
  };
  return { ...representation, wrapperSha256: sealRepresentation(representation) };
}

export function verifyRepresentation(representation) {
  if (!representation || typeof representation !== "object" || Array.isArray(representation)) {
    throw new Error("representation must be an object");
  }
  const allowedFields = new Set(["schemaVersion", "kind", "encoding", "content", "storedArtifactSha256", "decodedOriginalSha256", "provenance", "labels", "wrapperSha256"]);
  if (Object.keys(representation).some((field) => !allowedFields.has(field))) throw new Error("unknown representation field");
  if (representation.schemaVersion !== 1) throw new Error("schemaVersion must be 1");
  if (representation.kind !== "lossless-evidence-representation") {
    throw new Error("kind must be lossless-evidence-representation");
  }
  validateProvenance(representation.provenance);
  validateLabels(representation.labels);
  validateCoherence(representation.provenance, representation.labels);
  requireSha256(representation.storedArtifactSha256, "storedArtifactSha256");
  requireSha256(representation.decodedOriginalSha256, "decodedOriginalSha256");
  requireSha256(representation.wrapperSha256, "wrapperSha256");
  if (sealRepresentation(representation) !== representation.wrapperSha256) {
    throw new Error("wrapper SHA-256 mismatch");
  }

  const storedBytes = Buffer.from(requireString(representation.content, "content"), "utf8");
  if (sha256(storedBytes) !== representation.storedArtifactSha256) {
    throw new Error("stored artifact SHA-256 mismatch");
  }
  const original = decodedBytes(representation);
  if (sha256(original) !== representation.decodedOriginalSha256) {
    throw new Error("decoded original SHA-256 mismatch");
  }
  return original;
}

function parsePrCheckPayload(original) {
  let payload;
  try {
    payload = JSON.parse(original.toString("utf8"));
  } catch {
    return null;
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload) || typeof payload.head !== "string" || !Array.isArray(payload.checks)) return null;
  if (payload.checks.some((check) => !check || typeof check !== "object" || Array.isArray(check) || typeof check.id !== "string" || typeof check.conclusion !== "string" || typeof check.completedAt !== "string")) return null;
  return payload;
}

function hasSupportedChecks(payload, expectedHead, applicableCheckIds, mergeTime) {
  if (typeof expectedHead !== "string" || expectedHead.length === 0 || !Array.isArray(applicableCheckIds) || applicableCheckIds.length === 0 || applicableCheckIds.some((id) => typeof id !== "string" || id.length === 0)) return false;
  if (payload.head !== expectedHead || new Set(applicableCheckIds).size !== applicableCheckIds.length) return false;
  const checksById = new Map();
  for (const check of payload.checks) {
    if (checksById.has(check.id)) return false;
    checksById.set(check.id, check);
  }
  return applicableCheckIds.every((id) => {
    const check = checksById.get(id);
    const completedAt = check && parseUtcInstant(check.completedAt);
    return check && check.conclusion === "success" && !Number.isNaN(completedAt) && completedAt < mergeTime;
  });
}

export function assessClaimSupport({ representation, mergedAt, expectedHead, applicableCheckIds }) {
  const original = verifyRepresentation(representation);
  const { readbackType: kind, pagination, exitStatus } = representation.provenance;
  if (exitStatus !== 0 || representation.labels.confidentiality !== "publishable") return "blocked";
  if (!new Set(["original-response", "historical-extract", "fresh-corroboration", "merge-snapshot"]).has(kind)) {
    throw new Error("kind must identify the readback type");
  }
  if (!new Set(["complete", "partial"]).has(pagination)) throw new Error("pagination must be complete or partial");
  const mergeTime = parseUtcInstant(mergedAt);
  if (Number.isNaN(mergeTime)) return "blocked";
  const payload = parsePrCheckPayload(original);
  const observedTime = parseUtcInstant(representation.provenance.observedAt);
  if (!payload || !hasSupportedChecks(payload, expectedHead, applicableCheckIds, mergeTime)) return "blocked";
  if (pagination === "partial") {
    return kind === "original-response" && !Number.isNaN(observedTime) && observedTime < mergeTime ? "narrowed" : "blocked";
  }
  if (kind === "fresh-corroboration" || kind === "merge-snapshot") {
    return "narrowed";
  }
  if (Number.isNaN(observedTime) || observedTime >= mergeTime) return "blocked";
  return "supported";
}

// These are retained readback schemas, with explicit provenance for each source.
// They assert observed facts and reuse historical claim eligibility when a merge is claimed.
export function assertCloseoutReadbacks({ pullRequest, expectedHead, applicableCheckIds, mergedAt, observedNotBefore,
  closureExpected, readbacks }) {
  const assertions = [];
  const fail = (predicate) => ({ ok: false, schemaVersion: 1, assertions, predicate });
  const strictSha = (value) => typeof value === "string" && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value);
  const canonicalPr = /^https:\/\/github\.com\/[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\/([a-zA-Z0-9_.-]+)\/pull\/[1-9][0-9]*$/;
  if (typeof pullRequest !== "string" || !canonicalPr.test(pullRequest) || [".", ".."].includes(pullRequest.split("/")[4]) ||
      !strictSha(expectedHead) || !Array.isArray(applicableCheckIds) || applicableCheckIds.length === 0 ||
      !applicableCheckIds.every((id) => typeof id === "string" && id.trim()) ||
      new Set(applicableCheckIds).size !== applicableCheckIds.length ||
      Number.isNaN(parseUtcInstant(observedNotBefore))) return fail("READBACK_EXPECTATION_INVALID");

  const observed = new Map();
  function source(key, name) {
    const representation = readbacks?.[key];
    let value;
    try {
      value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(verifyRepresentation(representation)));
    } catch {
      return null;
    }
    const p = representation.provenance;
    if (p.source !== name || p.revision !== expectedHead || p.scope !== pullRequest || p.exitStatus !== 0 ||
        p.pagination !== "complete" || representation.labels.confidentiality !== "publishable" ||
        !["original-response", "fresh-corroboration", "merge-snapshot", "historical-extract"].includes(p.readbackType) ||
        !(parseUtcInstant(p.observedAt) >= parseUtcInstant(observedNotBefore)) ||
        value?.pullRequest !== pullRequest || value.head !== expectedHead) return null;
    observed.set(key, { representation, time: parseUtcInstant(p.observedAt) });
    return value;
  }
  const record = (predicate, ...keys) => assertions.push({ predicate,
    sources: keys.map((key) => ({ readback: key, wrapperSha256: observed.get(key).representation.wrapperSha256 })) });
  const pr = source("pr", "github-pull-request");
  if (!pr || !["OPEN", "MERGED"].includes(pr.state) ||
      (pr.state === "OPEN" ? pr.mergedAt !== null || mergedAt !== undefined : Number.isNaN(parseUtcInstant(mergedAt)) ||
        pr.mergedAt !== mergedAt || !strictSha(pr.mergeCommit) || parseUtcInstant(mergedAt) > observed.get("pr").time)) return fail("PR_IDENTITY_OR_STATE");
  record("EXACT_PR_HEAD", "pr");

  function passing(key, readback, entries) {
    if (!readback || !Array.isArray(entries) || entries.some((entry) => !entry || typeof entry.id !== "string" || !entry.id.trim())) return false;
    const index = new Map(entries.map((entry) => [entry.id, entry]));
    return index.size === entries.length && applicableCheckIds.every((id) => {
      const check = index.get(id);
      return check?.conclusion === "success" && parseUtcInstant(check.completedAt) <= observed.get(key).time;
    });
  }
  const checks = source("checks", "github-applicable-checks");
  if (!passing("checks", checks, checks?.checks) || (pr.state === "OPEN" && observed.get("checks").representation.provenance.readbackType === "historical-extract")) {
    return fail("APPLICABLE_CHECKS_INCOMPLETE_OR_FAILED");
  }
  const runs = source("checkRuns", "github-check-runs");
  if (!passing("checkRuns", runs, runs?.checks) || runs.checks.some((run) => run.head !== expectedHead) ||
      (pr.state === "OPEN" && observed.get("checkRuns").representation.provenance.readbackType === "historical-extract")) return fail("CHECK_RUNS_INCOMPLETE_OR_STALE");
  if (pr.state === "MERGED" && ["checks", "checkRuns"].some((key) => assessClaimSupport({
    representation: observed.get(key).representation, mergedAt, expectedHead, applicableCheckIds,
  }) !== "supported")) return fail("HISTORICAL_CHECK_CLAIM_UNSUPPORTED");
  record("APPLICABLE_CHECKS_PASSED", "checks", "checkRuns");

  const threads = source("threads", "github-review-threads");
  if (!threads || !Array.isArray(threads.threads) || threads.threads.some((thread) => !thread?.id ||
    typeof thread.id !== "string" || thread.resolved !== true) ||
    new Set(threads.threads.map((thread) => thread.id)).size !== threads.threads.length ||
    (pr.state === "MERGED" ? observed.get("threads").time >= parseUtcInstant(mergedAt) :
      observed.get("threads").representation.provenance.readbackType === "historical-extract") ||
    ["fresh-corroboration", "merge-snapshot"].includes(observed.get("threads").representation.provenance.readbackType) &&
      pr.state === "MERGED") return fail("REVIEW_THREADS_INCOMPLETE_OR_UNRESOLVED");
  record("REVIEW_THREADS_RESOLVED", "threads");

  const pending = [];
  if (pr.state === "OPEN") pending.push("PROTECTED_MERGE_PENDING");
  if (!closureExpected) pending.push("CLOSURE_PREDICATES_PENDING");
  else {
    const closure = source("closure", "github-closure-readback");
    const issuePrefix = pullRequest.replace(/\/pull\/[0-9]+$/, "/issues/");
    if (pr.state !== "MERGED" || !closure || !strictSha(closureExpected.verifiedRevision) ||
        typeof closureExpected.issue !== "string" || !closureExpected.issue.startsWith(issuePrefix) ||
        !/^[1-9][0-9]*$/.test(closureExpected.issue.slice(issuePrefix.length)) ||
        !/^openspec\/changes\/archive\/\d{4}-\d{2}-\d{2}-[a-z][a-z0-9-]+$/.test(closureExpected.archive ?? "") ||
        !/^[a-f0-9]{64}$/.test(closureExpected.receiptSha256 ?? "") ||
        closure.integrated !== pr.mergeCommit || closure.verifiedRevision !== closureExpected.verifiedRevision ||
        closure.issue !== closureExpected.issue || closure.issueState !== "CLOSED" || closure.archive !== closureExpected.archive ||
        closure.receiptSha256 !== closureExpected.receiptSha256 || closure.recordOnly !== true ||
        observed.get("closure").time < parseUtcInstant(mergedAt) ||
        observed.get("closure").representation.provenance.readbackType === "historical-extract") return fail("CLOSURE_PREDICATES_UNVERIFIED");
    record("CLOSURE_PREDICATES_MET", "pr", "closure");
  }
  return { ok: true, schemaVersion: 1, assertions, pending };
}

export function verifyCapture(record) {
  requireThat(record?.schemaVersion === 1 && record.kind === "command-capture" &&
    typeof record.cwd === "string" && path.isAbsolute(record.cwd) &&
    (record.revision === null || sha(record.revision)) && Number.isInteger(record.exitStatus) &&
    typeof record.complete === "boolean" && (record.complete ? record.exitStatus >= 0 && record.interruption === null :
      record.exitStatus === -1 && text(record.interruption)), "Invalid command capture");
  requireThat(Array.isArray(record.argv) && record.argv.length > 0 && record.argv.length <= 64 &&
    text(record.argv[0]) && record.argv.every((arg) => typeof arg === "string" && !arg.includes("\0") &&
      Buffer.byteLength(arg) <= 4096), "Invalid capture argument vector");
  for (const name of ["stdout", "stderr"]) {
    const bytes = verifyRepresentation(record[name]);
    const p = record[name].provenance;
    requireThat(bytes.length <= maxStream && p.source === `command-${name}` &&
      stableJson(p.command) === stableJson(record.argv) && p.revision === (record.revision ?? "not-applicable") &&
      p.observedAt === record.observedAt && p.exitStatus === record.exitStatus &&
      p.pagination === (record.complete ? "complete" : "partial") &&
      p.readbackType === "lossless-representation" && record[name].labels.confidentiality === "restricted",
    "Command capture stream provenance mismatch or overflow");
  }
  requireThat(record.stdout.provenance.scope === record.stderr.provenance.scope &&
    record.stdout.provenance.environmentScope === record.stderr.provenance.environmentScope, "Command capture scope mismatch");
  return record.complete && record.exitStatus === 0;
}

function gatePayload({ wrapperSha256, ...value }) { return value; }
export function verifyGateRun(run, expected) {
  requireThat(run?.kind === "disposable-gate-run" && run.schemaVersion === 1 && digest(run.wrapperSha256) &&
    sha256(stableJson(gatePayload(run))) === run.wrapperSha256, "Gate evidence seal mismatch");
  requireThat(expected && sha(run.plan) && digest(run.planDigest) &&
    ["goal-first", "task-guided"].includes(run.mode) && typeof run.change === "string" &&
    ["plan", "planDigest", "mode", "change"].every((key) => expected[key] === undefined || expected[key] === run[key]) &&
    run.head === expected.head && run.tree === expected.tree && run.implementation === expected.implementation &&
    typeof run.checkout === "string" && path.isAbsolute(run.checkout) && separate(run.checkout, run.implementation),
  "Gate evidence is misplaced or names a different revision/tree");
  requireThat(Array.isArray(run.generated) && run.generated.every(safePlanningPath) &&
    run.initial?.head === run.head && run.initial.tree === run.tree &&
    Array.isArray(run.initial.ignoredGenerated) && run.initial.ignoredGenerated.length === 0,
  "Missing clean disposable checkout observation");
  requireThat(Array.isArray(run.commands) && run.commands.length > 0 && run.commands.length <= maxCommands &&
    Number.isSafeInteger(run.bootstrapCount) && run.bootstrapCount >= 0 && run.bootstrapCount < run.commands.length,
  "Missing disposable gate commands");
  requireThat(run.final?.head === run.head && run.final.tree === run.tree && Array.isArray(run.final.ignoredGenerated) &&
    run.final.ignoredGenerated.every((file) => safePlanningPath(file) && run.generated.some((root) => file === root || file.startsWith(`${root}/`))),
  "Invalid final disposable checkout observation");
  const outcomes = run.commands.map((record, index) => {
    requireThat(record.cwd === run.checkout && record.revision === run.head &&
      record.stdout?.provenance.scope === (index < run.bootstrapCount ? "bootstrap" : "gate") &&
      record.stdout?.provenance.environmentScope === "disposable-checkout", "Gate command provenance mismatch");
    return verifyCapture(record);
  });
  const gateCommands = run.commands.slice(run.bootstrapCount).map((record) => record.argv);
  if (expected.gates) requireThat(stableJson(gateCommands) === stableJson(expected.gates), "Gate commands differ from approved acceptance");
  return { passed: outcomes.every(Boolean), reference: run.wrapperSha256, gateCommands };
}
