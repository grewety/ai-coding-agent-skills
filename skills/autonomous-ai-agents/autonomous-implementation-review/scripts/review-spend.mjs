// Trusted host ledger. A successfully claimed entry is never released or reused.
import path from "node:path";
import { createPublicKey, verify } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, open, rmdir, readdir, link, unlink } from "node:fs/promises";
import { absolute, digest, equal, fields, hash, jsonBytes, need, parseStrictJson, readJson, separate, sha, text } from "./review-inputs.mjs";
import { reviewAuthority, usdMicros } from "./low-touch-policy.mjs";
import { trustedJson } from "./review-preflight.mjs";
import { readClosed, safePath, writeClosed } from "./worker-handoff.mjs";

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
    attempt: identity.attempt, scopeSha256: hash(jsonBytes({ authority, acceptance, scope, nonGoals, fileAcceptance: request.fileAcceptance,
      ...(expect.explicit ? { explicit: expect.explicit, generator: expect.generator } : {}) })),
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

const extensionName = (reference) => "extension-" + hash(jsonBytes(reference)) + ".json";
const capFields = ["maxReviews", "maxTotalUsd"];
const planFields = ["change", "plan", "planDigest", "policyRevision", "approvalReference", "executionReference"];
const timestamp = (value) => {
  const milliseconds = typeof value === "string" ? Date.parse(value) : NaN;
  need(Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value, "Invalid review extension timestamp");
  return milliseconds;
};

async function ledgerIdentity(directory, excluded) {
  await protectedLedger(directory, excluded);
  const { dev, ino, birthtimeNs } = await lstat(directory, { bigint: true });
  return hash(jsonBytes([directory, String(dev), String(ino), String(birthtimeNs)]));
}

function verifyExtension(envelope, publicKey) {
  fields(envelope, ["grant", "signature"], "signed review extension");
  const { grant, signature } = envelope;
  fields(grant, ["schemaVersion", "kind", "reference", ...planFields, "ledgerIdentity", "baseCaps", "caps",
    "validFrom", "expiresAt"], "review extension grant");
  need(grant.schemaVersion === 1 && grant.kind === "review-budget-extension" &&
    typeof grant.reference === "string" && /^[!-~]{1,256}$/.test(grant.reference) &&
    text(grant.change) && sha(grant.plan) && digest(grant.planDigest) && sha(grant.policyRevision) &&
    text(grant.approvalReference) && text(grant.executionReference) && digest(grant.ledgerIdentity),
  "Invalid review extension identity");
  const from = timestamp(grant.validFrom);
  const until = timestamp(grant.expiresAt);
  need(from < until, "Invalid review extension validity window");
  fields(grant.baseCaps, capFields, "review extension base caps");
  fields(grant.caps, [], "review extension caps", capFields);
  need(Object.keys(grant.caps).length > 0 && Number.isSafeInteger(grant.baseCaps.maxReviews) && grant.baseCaps.maxReviews > 0,
    "Invalid review extension caps");
  usdMicros(grant.baseCaps.maxTotalUsd);
  if (grant.caps.maxReviews !== undefined) {
    need(Number.isSafeInteger(grant.caps.maxReviews) && grant.caps.maxReviews > grant.baseCaps.maxReviews,
      "Review extension must raise the signed lower count cap");
  }
  if (grant.caps.maxTotalUsd !== undefined) {
    need(usdMicros(grant.caps.maxTotalUsd) > usdMicros(grant.baseCaps.maxTotalUsd),
      "Review extension must raise the signed lower USD cap");
  }
  need(typeof publicKey === "string" && /^[A-Za-z0-9+/]{59}=$/.test(publicKey), "Invalid operator verification key");
  const key = createPublicKey({ key: Buffer.from(publicKey, "base64"), format: "der", type: "spki" });
  need(key.asymmetricKeyType === "ed25519" && key.export({ type: "spki", format: "der" }).toString("base64") === publicKey,
    "Expected canonical Ed25519 operator verification key");
  need(typeof signature === "string" && /^[A-Za-z0-9+/]{86}==$/.test(signature) &&
    Buffer.from(signature, "base64").toString("base64") === signature &&
    verify(null, jsonBytes(grant), key, Buffer.from(signature, "base64")), "Invalid review extension signature");
  return grant;
}

function extensionCaps(policy, extension, retained, identity, reservedAt) {
  const base = { maxReviews: policy.maxReviews, maxTotalUsd: policy.maxTotalUsd };
  const caps = { ...base };
  const samePlan = (grant) => extension?.plan && planFields.every((field) => grant[field] === extension.plan[field]);
  const now = timestamp(reservedAt);
  for (const { envelope: { grant }, keySha256 } of retained) {
    if (!samePlan(grant) || policy.mode === "explicit") continue;
    need(base.maxReviews <= grant.baseCaps.maxReviews && base.maxTotalUsd <= grant.baseCaps.maxTotalUsd,
      "Review admission caps exceed the retained signed base");
    if (keySha256 !== extension.keySha256 || !equal(base, grant.baseCaps) ||
      now < timestamp(grant.validFrom) || now >= timestamp(grant.expiresAt)) continue;
    for (const field of Object.keys(grant.caps)) caps[field] = Math.max(caps[field], grant.caps[field]);
  }
  if (extension?.envelope) {
    const { grant } = extension.envelope;
    need(!retained.some((entry) => entry.envelope.grant.reference === grant.reference),
      "Review extension reference was already consumed");
    need(samePlan(grant) && grant.ledgerIdentity === identity && equal(base, grant.baseCaps),
      "Review extension differs from the exact plan, ledger or applicable base caps");
    need(now >= timestamp(grant.validFrom) && now < timestamp(grant.expiresAt), "Review extension is expired or not yet valid");
    for (const field of Object.keys(grant.caps)) {
      need(grant.caps[field] > caps[field], "Review extension is stale against the current caps");
      caps[field] = grant.caps[field];
    }
  }
  return extension?.plan && policy.mode === "auto-approved"
    ? reviewAuthority(extension.integrated, { phase: "execution", caps })
    : policy;
}

async function syncDirectory(location) {
  const handle = await open(location, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try { await handle.sync(); } finally { await handle.close(); }
}

export async function checkProbeSpend({ file, configurationSha256, maxBudgetUsd, excluded, explicitRuntimeSha256 }) {
  const { value: grant } = await trustedJson(file, excluded);
  fields(grant, ["schemaVersion", "kind", "reference", "verified", "runs", "configurationSha256", "upperUsdMicros", "ledger"],
    "standalone probe grant", explicitRuntimeSha256 ? ["explicitRuntimeSha256"] : []);
  need(grant.schemaVersion === 1 && grant.kind === "standalone-review-probe" && grant.verified === true &&
    grant.runs === 1 && text(grant.reference) && grant.configurationSha256 === configurationSha256 &&
    grant.upperUsdMicros === usdMicros(maxBudgetUsd) && grant.explicitRuntimeSha256 === explicitRuntimeSha256,
  "Missing exact single-run standalone probe authority");
  return { grant, excluded: [...excluded, file] };
}

export async function claimProbeRun({ grant, excluded }) {
  const root = grant.ledger;
  await protectedLedger(root, excluded);
  // The leading dot keeps this namespace distinct from all per-change ledgers.
  const directory = path.join(root, ".standalone-probes");
  try { await mkdir(directory, { mode: 0o700 }); }
  catch (error) { if (error.code !== "EEXIST") throw error; }
  await protectedLedger(directory, excluded);
  await syncDirectory(root);
  const file = path.join(directory, hash(jsonBytes(grant.reference)) + ".json");
  try {
    await writeClosed(file, jsonBytes({ ...grant, reservedAt: new Date().toISOString() }), true);
  } catch (error) {
    if (error.code === "EEXIST") throw new Error("Standalone probe authority was already consumed");
    throw error;
  }
  await syncDirectory(directory);
}

export async function claimReviewRun({ root, excluded, scope, policy, explicitGrant, retryGrant, extension }) {
  await protectedLedger(root, excluded);
  need(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(scope.change) && scope.change.length <= 200, "Invalid review ledger change");
  const directory = path.join(root, scope.change);
  if (!extension?.envelope) {
    try { await mkdir(directory, { mode: 0o700 }); }
    catch (error) { if (error.code !== "EEXIST") throw error; }
  }
  await protectedLedger(directory, excluded);
  await syncDirectory(root);
  const lock = path.join(directory, "lock");
  try { await mkdir(lock, { mode: 0o700 }); }
  catch { throw new Error("Review ledger reservation is busy or unsettled"); }
  try {
    const names = (await readdir(directory)).filter((name) => name !== "lock");
    need(names.length + Number(Boolean(extension?.envelope)) < maximumEntries &&
      names.every((name) => /^(?:extension-)?[a-f0-9]{64}\.json$/.test(name)),
      "Incomplete or exhausted review ledger");
    const records = [];
    for (const name of names.filter((name) => !name.startsWith("extension-"))) {
      const record = await readJson(path.join(directory, name), 4096, true);
      fields(record, ["schemaVersion", "mode", ...scopeFields, "reservedAt", "grantReference", "retryReference"], "review reservation");
      need(reservationName(record) === name && record.change === scope.change && record.schemaVersion === 1 &&
        ["auto-approved", "explicit"].includes(record.mode) && Number.isSafeInteger(record.upperUsdMicros) &&
        record.upperUsdMicros > 0, "Invalid retained review reservation");
      records.push(record);
    }
    const retained = [];
    const extensionNames = names.filter((name) => name.startsWith("extension-"));
    const identity = extensionNames.length || extension?.envelope ? await ledgerIdentity(directory, excluded) : null;
    for (const name of extensionNames) {
      const file = path.join(directory, name);
      const bytes = await readClosed(file, 65536, true);
      const entry = parseStrictJson(bytes);
      fields(entry, ["envelope", "publicKey", "keySha256", "acceptedAt", "attempt"], "retained review extension");
      const grant = verifyExtension(entry.envelope, entry.publicKey);
      const acceptedAt = timestamp(entry.acceptedAt);
      need(bytes.equals(jsonBytes(entry)) && name === extensionName(grant.reference) &&
        grant.change === scope.change && grant.ledgerIdentity === identity &&
        entry.keySha256 === hash(jsonBytes({ publicKey: entry.publicKey })) &&
        acceptedAt >= timestamp(grant.validFrom) && acceptedAt < timestamp(grant.expiresAt) &&
        records.some((record) => record.attempt === entry.attempt && record.reservedAt === entry.acceptedAt &&
          record.mode === "auto-approved" && record.phase === "execution"),
      "Invalid retained review extension or missing reservation");
      retained.push(entry);
    }
    need(!extension?.envelope || (policy.mode === "auto-approved" && scope.phase === "execution" &&
      scope.purpose === "candidate" && records.length > 0), "Review extension requires an existing ledger and automatic candidate execution");
    if (extension?.envelope) {
      verifyExtension(extension.envelope, extension.publicKey);
      need(extension.keySha256 === hash(jsonBytes({ publicKey: extension.publicKey })), "Operator verification key pin mismatch");
    }
    const extensionReference = extension?.envelope?.grant.reference;
    need(!extensionReference ||
      !records.some(({ grantReference, retryReference }) => [grantReference, retryReference].includes(extensionReference)),
    "Review extension reference was already consumed as run authority");
    const runReferences = [explicitGrant?.reference, retryGrant?.reference];
    need(!retained.some(({ envelope }) => runReferences.includes(envelope.grant.reference)),
      "Run authority cannot reuse a retained review extension reference");
    need(!records.some(({ attempt }) => attempt === scope.attempt), "Review reservation already redeemed");
    const repeated = records.some(({ purpose, target }) => purpose === scope.purpose && target === scope.target);
    if (repeated || retryGrant !== undefined) {
      verifyGrant(retryGrant, "contained-review-retry", scope);
      need(retryGrant.reference !== explicitGrant?.reference &&
        !records.some(({ grantReference, retryReference }) => [grantReference, retryReference].includes(retryGrant.reference)),
      "Retry authority was already consumed");
    }
    const reservedAt = new Date().toISOString();
    const effective = extensionCaps(policy, extension, retained, identity, reservedAt);
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
      need(automatic.length < effective.maxReviews && total <= effective.limitMicros, "Automatic review count or cost cap exceeded");
    }
    const record = { schemaVersion: 1, mode: policy.mode, ...scope, reservedAt,
      grantReference: explicitGrant?.reference ?? null, retryReference: retryGrant?.reference ?? null };
    const file = path.join(directory, reservationName(record));
    const temporary = path.join(lock, "reservation");
    const bytes = jsonBytes(record);
    await writeClosed(temporary, bytes, true);
    if (extension?.envelope) {
      const staged = path.join(lock, "extension");
      const { envelope, publicKey, keySha256 } = extension;
      await writeClosed(staged, jsonBytes({ envelope, publicKey, keySha256, acceptedAt: reservedAt, attempt: scope.attempt }), true);
      await link(staged, path.join(directory, extensionName(envelope.grant.reference)));
      await syncDirectory(directory);
      await unlink(staged);
    }
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

export async function checkReviewSpend({ file, policy, request, expect, prepared, config, excluded, extensionFiles }) {
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
  need(!expect.explicit || authority.mode === "explicit", "Explicit reviewer binding requires an exact single-run grant");
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
  const isExecution = scope.phase === "execution" && request.mode === "candidate" && authority.mode === "auto-approved";
  need(!extensionFiles || isExecution, "Review extension requires automatic candidate execution");
  const extension = isExecution ? { integrated: policy, plan: {
    change: scope.change, plan: request.worker.identity.plan, planDigest: request.worker.identity.planDigest,
    policyRevision: request.policy.parent, approvalReference: request.worker.authority.approvalReference,
    executionReference: grant.authorityReference,
  } } : undefined;
  let identity;
  if (extensionFiles) {
    const { key, sha256, record } = extensionFiles;
    excluded = [...excluded, file, key, ...(record ? [record] : [])];
    const { value, configurationSha256 } = await trustedJson(key, excluded.filter((item) => item !== key));
    fields(value, ["publicKey"], "operator verification key");
    need(configurationSha256 === sha256 && sha256 === hash(jsonBytes(value)), "Operator verification key pin mismatch");
    identity = await ledgerIdentity(path.join(admission.ledger, scope.change), excluded);
    Object.assign(extension, { publicKey: value.publicKey, keySha256: sha256 });
    if (record) {
      const loaded = await trustedJson(record, excluded.filter((item) => item !== record), true);
      need(loaded.configurationSha256 === hash(jsonBytes(loaded.value)), "Noncanonical signed review extension");
      const signed = verifyExtension(loaded.value, value.publicKey);
      need(![grant.reference, grant.authorityReference, extension.plan.approvalReference, admission.retryGrant?.reference]
        .includes(signed.reference), "Review extension requires a separate authority reference");
      extension.envelope = loaded.value;
      extensionCaps(authority, extension, [], identity, new Date().toISOString());
    }
  }
  return { root: admission.ledger, excluded, scope, policy: authority, explicitGrant: admission.explicitGrant,
    retryGrant: admission.retryGrant, extension, ledgerIdentity: identity };
}
