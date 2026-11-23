// Verification boundary decisions. No vendor calls, tunnel process or automation trigger.
import { existsSync, lstatSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { captureCommand } from "./evidence-cli.mjs";
import { readBounded, scopedPath, sha256, stableJson, verifyCapture } from "./evidence-retention.mjs";

const text = (value) => typeof value === "string" && value.trim().length > 0;
const digest = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const sha = (value) => typeof value === "string" && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value);
const allowedData = new Set(["built-artifact", "synthetic-fixtures", "public-test-metadata"]);
const kinds = new Set(["external-check", "paid-check", "tunnel", "app-trigger", "deploy-preview"]);
const contains = (root, entry) => {
  const relative = path.relative(root, entry);
  return relative === "" || (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`));
};
const same = (a, b) => stableJson(a) === stableJson(b);
const requireThat = (condition, message) => { if (!condition) throw new Error(message); };
const declarationFields = ["candidate", "target", "scope", "data", "expectedCost", "kind", "runs", "artifact", "trigger", "retryOf"];
function canonicalDirectory(file) {
  try { return lstatSync(scopedPath(file)).isDirectory(); }
  catch { return false; }
}
const canonicalFileIdentity = (file) => {
  requireThat(path.isAbsolute(file) && path.normalize(file) === file, "Invalid external reservation path");
  return scopedPath(file, true);
};

function validateCard(card) {
  if (!card || Object.keys(card).length !== declarationFields.length ||
      !declarationFields.every((field) => Object.hasOwn(card, field)) || !sha(card.candidate) ||
      !text(card.target) || !text(card.scope) || !kinds.has(card.kind) || card.runs !== 1 ||
      !Array.isArray(card.data) || card.data.length === 0 || !card.data.every((field) => allowedData.has(field)) ||
      new Set(card.data).size !== card.data.length ||
      !Number.isFinite(card.expectedCost?.amount) || card.expectedCost.amount < 0 || !text(card.expectedCost?.unit) ||
      !(card.retryOf === null || text(card.retryOf))) return false;
  if (card.kind === "app-trigger" ? !text(card.trigger) : card.trigger !== null) return false;
  if (card.kind === "tunnel" || card.kind === "deploy-preview") {
    return card.data.includes("built-artifact") && typeof card.artifact?.root === "string" &&
      path.isAbsolute(card.artifact.root) && path.normalize(card.artifact.root) === card.artifact.root && digest(card.artifact.sha256);
  }
  return card.artifact === null;
}

function checkExternalRun({ card, grant, observed, history }) {
  const stop = (reason) => ({ action: "queue", reason, automaticRetry: false });
  if (!validateCard(card)) return stop("EXTERNAL_SCOPE_UNVERIFIED");
  if (grant?.kind !== "external-single-run" || grant.schemaVersion !== 1 || grant.verified !== true ||
      !text(grant.reference) || grant.localOnly !== false || !same(grant.card, card) ||
      typeof grant.reservation !== "string" || !path.isAbsolute(grant.reservation) ||
      path.basename(grant.reservation) !== `${sha256(grant.reference)}.json`) return stop("EXTERNAL_AUTHORITY_PENDING");
  if (!Array.isArray(history) || history.some((entry) => !text(entry?.reference) || entry.verified !== true ||
    !["reserved", "consumed", "finished", "failed"].includes(entry.state)) ||
    new Set(history.map((entry) => entry.reference)).size !== history.length) return stop("EXTERNAL_HISTORY_UNVERIFIED");
  if (history.some((entry) => entry.reference === grant.reference)) return stop("EXTERNAL_GRANT_CONSUMED");
  const priorFailure = history.findLast((entry) => entry.state === "failed" && entry.candidate === card.candidate &&
    entry.target === card.target && entry.kind === card.kind && entry.scope === card.scope);
  if (priorFailure ? priorFailure.reference !== card.retryOf || priorFailure.cleanup !== "complete" :
      card.retryOf !== null) return stop("PRIOR_RUN_CLEANUP_UNVERIFIED");
  if (card.kind === "app-trigger" && !(observed?.pushGrant?.verified === true &&
    text(observed.pushGrant.reference) && observed.pushGrant.reference !== grant.reference &&
    observed.pushGrant.candidate === card.candidate && observed.pushGrant.target === card.target &&
    Array.isArray(observed.triggers) && observed.triggers.includes(card.trigger) &&
    observed.triggerInventoryVerified === true)) return stop("PUSH_TRIGGER_AUTHORITY_PENDING");
  if (card.artifact !== null && !(canonicalDirectory(card.artifact.root) && observed?.artifact?.root === card.artifact.root &&
    observed.artifact.sha256 === card.artifact.sha256 && observed.artifact.candidate === card.candidate &&
    observed.artifact.isolated === true && observed.artifact.approvedDataOnly === true &&
    observed.artifact.accountActions === false && observed.artifact.cleanupReady === true)) {
    return stop("ARTIFACT_BOUNDARY_UNVERIFIED");
  }
  return { action: "reserve", reason: null, automaticRetry: false, reference: grant.reference };
}

export function externalVerificationDecision(request) {
  const decision = checkExternalRun(request);
  if (decision.action === "reserve" && existsSync(canonicalFileIdentity(request.grant.reservation))) {
    return { action: "queue", reason: "EXTERNAL_GRANT_CONSUMED", automaticRetry: false };
  }
  return decision;
}

export function reserveExternalRun(request) {
  const decision = externalVerificationDecision(request);
  if (decision.action !== "reserve") return { ok: false, ...decision };
  const { grant, card } = request;
  const file = canonicalFileIdentity(grant.reservation);
  const reservation = { schemaVersion: 1, reference: grant.reference, cardSha256: sha256(stableJson(card)), file, state: "reserved" };
  try { writeFileSync(file, `${JSON.stringify(reservation)}\n`, { flag: "wx", mode: 0o600 }); }
  catch (error) {
    if (error.code === "EEXIST") return { ok: false, action: "queue", reason: "EXTERNAL_GRANT_CONSUMED", automaticRetry: false };
    throw error;
  }
  // The exclusive reservation is an attempt, including abandonment or startup
  // failure. An existing file may be read for audit but never redeemed again.
  return { ok: true, action: "run-once", reason: null, automaticRetry: false, reference: grant.reference, card, reservation,
    pushReference: card.kind === "app-trigger" ? request.observed.pushGrant.reference : null,
    serveOnly: card.artifact?.root ?? null, cleanup: card.artifact === null ? null : "immediate-on-success-or-failure" };
}

export function pushTriggerDecision({ candidate, pushGrant, observed, external }) {
  if (!sha(candidate) || pushGrant?.verified !== true || pushGrant.candidate !== candidate || !text(pushGrant.reference)) {
    return { action: "queue", reason: "PUSH_AUTHORITY_PENDING" };
  }
  if (observed?.candidate !== candidate || observed.verified !== true ||
      !Array.isArray(observed.triggers) || !observed.triggers.every(text) ||
      new Set(observed.triggers).size !== observed.triggers.length) return { action: "stop", reason: "TRIGGER_INVENTORY_UNVERIFIED" };
  if (observed.triggers.some((trigger) => !Array.isArray(external) || !external.some((entry) =>
      entry?.ok === true && entry.action === "run-once" && entry.card?.kind === "app-trigger" &&
      entry.card.candidate === candidate && entry.card.target === pushGrant.target && entry.card.trigger === trigger &&
      entry.reference !== pushGrant.reference && entry.pushReference === pushGrant.reference && entry.reservation?.cardSha256 === sha256(stableJson(entry.card))))) {
    return { action: "queue", reason: "PUSH_TRIGGER_AUTHORITY_PENDING" };
  }
  return { action: "proceed", reason: null };
}

const localUrl = (value) => {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && ["127.0.0.1", "[::1]", "localhost"].includes(url.hostname) &&
      !url.username && !url.password;
  } catch { return false; }
};
export function uiAcceptanceDecision({ declaration, local, preview, candidate }) {
  if (declaration === null) return { action: "not-declared", reason: null };
  if (!sha(candidate) || typeof declaration?.localTryOut !== "boolean" || typeof declaration.deployPreview !== "boolean" ||
      !Array.isArray(declaration.interactions) || !declaration.interactions.every((item) => text(item?.role) && text(item?.name)) ||
      new Set(declaration.interactions.map(stableJson)).size !== declaration.interactions.length) {
    return { action: "stop", reason: "UI_DECLARATION_INVALID" };
  }
  if (declaration.localTryOut || declaration.interactions.length) {
    if (local?.candidate !== candidate || !localUrl(local.url) || local.localOnly !== true ||
        (declaration.localTryOut && local.tryOutPassed !== true) || !Array.isArray(local.interactions) ||
        !declaration.interactions.every(({ role, name }) => local.interactions.some((item) =>
          item.role === role && item.name === name && item.matchedBy === "accessible-name" && item.passed === true))) {
      return { action: "queue", reason: "LOCAL_UI_ACCEPTANCE_PENDING" };
    }
  }
  if (declaration.deployPreview) {
    if (!text(preview?.authorityReference) || preview.candidate !== candidate || preview.verified !== true ||
        preview.separateGrant !== true || preview.artifactOnly !== true) return { action: "queue", reason: "PREVIEW_AUTHORITY_PENDING" };
    if (preview.reviewed !== true || !text(preview.reviewReference) || preview.reviewReference === preview.authorityReference) {
      return { action: "pause", reason: "PREVIEW_REVIEW_PENDING" };
    }
  }
  return { action: "accepted", reason: null };
}

const maxProbeCommands = 8;
const maxProbeTime = 120_000;
export async function discovery(request) {
  const { grant, target, repository, output, commands, limitMs } = request;
  requireThat(text(target) && grant?.schemaVersion === 1 && grant.kind === "local-planning-probe" && grant.verified === true &&
    text(grant.reference) && grant.target === target && grant.scope === "scratch-only" && grant.external === false &&
    same(grant.commands, commands) && grant.limitMs === limitMs && request.planLocked === false,
  "Bounded scratch-only planning authority is required before contract lock");
  requireThat(Array.isArray(commands) && commands.length > 0 && commands.length <= maxProbeCommands &&
    Number.isSafeInteger(limitMs) && limitMs > 0 && limitMs <= maxProbeTime &&
    commands.every((command) => Number.isSafeInteger(command?.timeoutMs) && command.timeoutMs > 0) &&
    commands.reduce((sum, command) => sum + command.timeoutMs, 0) <= limitMs, "Discovery limits exceeded");
  const trustedRepo = scopedPath(repository);
  requireThat(canonicalDirectory(trustedRepo), "Expected a canonical repository directory");
  scopedPath(output, true);
  const scratchParent = realpathSync(os.tmpdir());
  requireThat(!contains(trustedRepo, scratchParent) && !contains(trustedRepo, output) && !existsSync(output), "Discovery paths must be disposable and outside the repository");
  const scratch = mkdtempSync(path.join(scratchParent, "openspec-discovery-"));
  const env = { PATH: process.env.PATH ?? "", HOME: path.join(scratch, "home"), USERPROFILE: path.join(scratch, "home"),
    XDG_CONFIG_HOME: path.join(scratch, "config"), XDG_CACHE_HOME: path.join(scratch, "cache"),
    XDG_DATA_HOME: path.join(scratch, "data"), XDG_STATE_HOME: path.join(scratch, "state"),
    APPDATA: path.join(scratch, "config"), LOCALAPPDATA: path.join(scratch, "cache"),
    TMPDIR: path.join(scratch, "tmp"), TEMP: path.join(scratch, "tmp"), TMP: path.join(scratch, "tmp"),
    npm_config_userconfig: path.join(scratch, "config", "npmrc"), npm_config_cache: path.join(scratch, "cache", "npm"),
    GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : os.devNull,
    ...(process.platform === "win32" ? { SystemRoot: process.env.SystemRoot, PATHEXT: process.env.PATHEXT } : {}) };
  const records = [];
  const started = performance.now();
  try {
    for (const directory of new Set(Object.values(env).filter((value) => typeof value === "string" && path.dirname(value) === scratch))) {
      mkdirSync(directory, { mode: 0o700 });
    }
    for (const { argv, timeoutMs } of commands) {
      const remaining = Math.floor(limitMs - (performance.now() - started));
      if (remaining <= 0) break;
      const record = await captureCommand({ argv, timeoutMs: Math.min(timeoutMs, remaining), cwd: scratch, env, revision: null, scope: target, environmentScope: "scratch-only" });
      records.push(record);
      if (!verifyCapture(record)) break;
    }
  } finally { rmSync(scratch, { recursive: true, force: true }); }
  const ok = records.length === commands.length && records.every(verifyCapture);
  const record = { schemaVersion: 1, kind: "scratch-discovery", target, limitMs, reference: grant.reference,
    records, cleanup: "complete", eligibleAsAcceptance: false };
  writeFileSync(output, `${JSON.stringify(record)}\n`, { flag: "wx", mode: 0o600 });
  return { ok, output, sha256: sha256(readBounded(output)), cleanup: record.cleanup, eligibleAsAcceptance: false };
}
