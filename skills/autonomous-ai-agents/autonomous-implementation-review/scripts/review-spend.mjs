// Trusted host ledger. A successfully claimed entry is never released or reused.
import path from "node:path";
import { constants } from "node:fs";
import { lstat, mkdir, open, rmdir, readdir, link, unlink } from "node:fs/promises";
import { absolute, digest, fields, hash, jsonBytes, need, readJson, separate, text } from "./review-inputs.mjs";
import { reviewAuthority, usdMicros } from "./low-touch-policy.mjs";
import { trustedJson } from "./review-preflight.mjs";
import { safePath, writeClosed } from "./worker-handoff.mjs";

const maximumEntries = 1024;
const scopeFields = ["change", "phase", "purpose", "target", "requestSha256", "exportSha256", "configurationSha256",
  "attempt", "scopeSha256", "upperUsdMicros", "invocations"];

export function reviewSpendScope(request, expect, prepared, config, admission) {
  const { identity, authority, acceptance, scope, nonGoals } = request.worker;
  const invocations = prepared.manifest.packets.length + 1;
  const target = request.mode === "candidate" ? request.snapshot.target :
    hash(jsonBytes({ inputs: identity.inputs, modes: request.policy?.planningModes }));
  const upperUsdMicros = invocations * usdMicros(config.maxBudgetUsd);
  need(Number.isSafeInteger(upperUsdMicros), "Unproved full review cost");
  return { change: identity.change, phase: admission.phase, purpose: request.mode, target,
    requestSha256: expect.requestSha256, exportSha256: expect.exportSha256, configurationSha256: expect.configurationSha256,
    attempt: identity.attempt, scopeSha256: hash(jsonBytes({ authority, acceptance, scope, nonGoals, fileAcceptance: request.fileAcceptance })),
    upperUsdMicros, invocations };
}

function verifyGrant(grant, kind, scope) {
  fields(grant, ["kind", "reference", "verified", "runs", ...scopeFields], "single-run review grant");
  need(grant.kind === kind && grant.verified === true && grant.runs === 1 && text(grant.reference) &&
    scopeFields.every((name) => scope[name] === grant[name]), "Missing distinct exact single-run review or retry authority");
}

async function protectedLedger(root, excluded) {
  need(absolute(root) && excluded.every((name) => separate(root, name)), "Review ledger overlaps protected inputs");
  await safePath(root);
  const st = await lstat(root);
  need(st.isDirectory() && st.uid === process.getuid() && (st.mode & 0o077) === 0, "Expected a private host-owned review ledger directory");
}

async function syncDirectory(location) {
  const handle = await open(location, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try { await handle.sync(); } finally { await handle.close(); }
}

export async function claimReviewRun({ root, excluded, scope, policy, explicitGrant, retryGrant }) {
  await protectedLedger(root, excluded);
  need(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(scope.change) && scope.change.length <= 200, "Invalid review ledger change");
  const directory = path.join(root, scope.change);
  try { await mkdir(directory, { mode: 0o700 }); }
  catch (error) { if (error.code !== "EEXIST") throw error; }
  await protectedLedger(directory, excluded);
  await syncDirectory(root);
  const lock = path.join(directory, "lock");
  try { await mkdir(lock, { mode: 0o700 }); }
  catch { throw new Error("Review ledger reservation is busy or unsettled"); }
  try {
    const names = (await readdir(directory)).filter((name) => name !== "lock");
    need(names.length < maximumEntries && names.every((name) => /^[a-f0-9]{64}\.json$/.test(name)),
      "Incomplete or exhausted review ledger");
    const records = [];
    for (const name of names) {
      const record = await readJson(path.join(directory, name), 4096, true);
      fields(record, ["schemaVersion", "mode", ...scopeFields, "reservedAt", "grantReference", "retryReference"], "review reservation");
      need(reservationName(record) === name && record.change === scope.change && record.schemaVersion === 1 &&
        ["auto-approved", "explicit"].includes(record.mode) && Number.isSafeInteger(record.upperUsdMicros) &&
        record.upperUsdMicros > 0, "Invalid retained review reservation");
      records.push(record);
    }
    need(!records.some(({ attempt }) => attempt === scope.attempt), "Review reservation already redeemed");
    const repeated = records.some(({ purpose, target }) => purpose === scope.purpose && target === scope.target);
    if (repeated || retryGrant !== undefined) {
      verifyGrant(retryGrant, "contained-review-retry", scope);
      need(retryGrant.reference !== explicitGrant?.reference &&
        !records.some(({ grantReference, retryReference }) => [grantReference, retryReference].includes(retryGrant.reference)),
      "Retry authority was already consumed");
    }
    if (policy.mode === "explicit") {
      verifyGrant(explicitGrant, "contained-review-single-run", scope);
      need(!records.some(({ grantReference, retryReference }) => [grantReference, retryReference].includes(explicitGrant.reference)),
        "Single-run authority was already consumed");
    } else {
      const automatic = records.filter(({ mode }) => mode === "auto-approved");
      let total = scope.upperUsdMicros;
      for (const entry of automatic) {
        total += entry.upperUsdMicros;
        need(Number.isSafeInteger(total), "Review ledger cost overflow");
      }
      need(automatic.length < policy.maxReviews && total <= policy.limitMicros, "Automatic review count or cost cap exceeded");
    }
    const record = { schemaVersion: 1, mode: policy.mode, ...scope, reservedAt: new Date().toISOString(),
      grantReference: explicitGrant?.reference ?? null, retryReference: retryGrant?.reference ?? null };
    const file = path.join(directory, reservationName(record));
    const temporary = path.join(lock, "reservation");
    const bytes = jsonBytes(record);
    await writeClosed(temporary, bytes, true);
    await link(temporary, file); // No replacement or replay.
    await unlink(temporary);
    await syncDirectory(directory);
    return { file, sha256: hash(bytes), scope, mode: policy.mode };
  } finally {
    // A partial reservation or crash deliberately retains the lock and blocks resume.
    await rmdir(lock);
    await syncDirectory(directory);
  }
}

const reservationName = (record) => hash(jsonBytes([record.change, record.attempt])) + ".json";

export async function checkReviewSpend({ file, policy, request, expect, prepared, config, excluded }) {
  const { value: admission } = await trustedJson(file, excluded);
  fields(admission, ["schemaVersion", "configurationSha256", "ledger", "phase", "phaseGrant"],
    "trusted review admission", ["mode", "caps", "explicitGrant", "retryGrant"]);
  need(admission.schemaVersion === 1 && digest(admission.configurationSha256) &&
    admission.configurationSha256 === expect.configurationSha256, "Trusted host.json configuration pin mismatch");
  need(request.mode === "approach" ? admission.phase === "planning" : ["execution", "finish"].includes(admission.phase),
    "Review purpose differs from its authorized phase");
  await protectedLedger(admission.ledger, excluded);
  const scope = reviewSpendScope(request, expect, prepared, config, admission);
  const authority = reviewAuthority(policy, admission);
  const grant = admission.phaseGrant;
  fields(grant, ["kind", "verified", "reference", "change", "phase", "policyRevision", "requestSha256", "authorityReference"],
    "review phase grant");
  need(grant.kind === "contained-review-phase" && grant.verified === true && text(grant.reference) &&
    grant.change === scope.change && grant.phase === scope.phase && grant.policyRevision === request.policy.parent &&
    grant.requestSha256 === scope.requestSha256 &&
    grant.authorityReference === (request.mode === "approach" ? request.snapshot.authority.reference :
      admission.phase === "execution" ? request.worker.authority.executionReference : request.policy.finishReference) &&
    text(grant.authorityReference) && grant.reference !== grant.authorityReference,
  "Review is outside the authorized phase or its exact scope");
  if (authority.mode === "explicit") {
    verifyGrant(admission.explicitGrant, "contained-review-single-run", scope);
    need(admission.explicitGrant.reference !== grant.reference && admission.explicitGrant.reference !== grant.authorityReference,
      "Single-run authority must be separate from phase authority");
  } else need(admission.explicitGrant === undefined, "Use the explicit per-run mode for a single-run grant");
  if (admission.retryGrant !== undefined) {
    verifyGrant(admission.retryGrant, "contained-review-retry", scope);
    need(![grant.reference, grant.authorityReference, admission.explicitGrant?.reference].includes(admission.retryGrant.reference),
      "Retry authority must be separate");
  }
  return { root: admission.ledger, excluded, scope, policy: authority, explicitGrant: admission.explicitGrant,
    retryGrant: admission.retryGrant };
}
