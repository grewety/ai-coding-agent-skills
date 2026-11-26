import { randomUUID } from "node:crypto";
import { closeSync, fsyncSync, linkSync, openSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { readBounded, sha256, stableJson } from "./evidence-retention.mjs";
import { need, observed, same, text } from "./operator-records.mjs";

const chapters = ["implementation", "closure"];
const digest = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const instant = (value) => {
  const parsed = typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value ? parsed : NaN;
};
const upper = 128;
const transient = new Set(["runner-provisioning-failure", "runner-lost", "github-actions-service-interruption"]);

const selector = ({ chapter, id, target, configurationSha256, exposure, costUsd }) =>
  ({ chapter, id, target, configurationSha256, exposure, costUsd });
const exactSelector = (entry, target) => chapters.includes(entry?.chapter) && text(entry.id) &&
  entry.target === target && digest(entry.configurationSha256) && text(entry.exposure) && Number.isFinite(entry.costUsd);

export function finishCreditGrant(grant, checkpoint, finish) {
  const { identity } = checkpoint;
  need(grant.schemaVersion === 1 && grant.kind === "protected-finish-trigger-grant" && observed(grant) &&
    grant.reference !== finish.reference && grant.finishReference === finish.reference &&
    same(grant.identity, identity) && instant(grant.startedAt) >= instant(finish.startedAt) &&
    instant(grant.startedAt) <= instant(checkpoint.observedAt) &&
    instant(grant.deadline) > instant(grant.startedAt) && instant(grant.deadline) <= instant(finish.deadline) &&
    Number.isSafeInteger(grant.maxDeepReviewCredits) && grant.maxDeepReviewCredits >= 0 && grant.maxDeepReviewCredits <= upper &&
    [0, 1].includes(grant.maxZeroCostCiRetries) && Array.isArray(grant.deepReview) && grant.deepReview.length <= upper &&
    grant.deepReview.every((entry) => exactSelector(entry, identity.target) && entry.costUsd > 0 && same(entry, selector(entry))) &&
    new Set(grant.deepReview.map(({ chapter, id }) => stableJson([chapter, id]))).size === grant.deepReview.length &&
    (grant.maxDeepReviewCredits > 0) === (grant.deepReview.length > 0) &&
    (grant.maxZeroCostCiRetries === 1 ?
      exactSelector(grant.retry, identity.target) && grant.retry.costUsd === 0 && same(grant.retry, selector(grant.retry)) :
      grant.retry === null) && grant.maxDeepReviewCredits + grant.maxZeroCostCiRetries > 0,
  "Separate finish trigger grant does not match the protected finish");
  return grant;
}

function current(observation, notBefore, now) {
  const time = instant(observation?.observedAt);
  return observed(observation) && time >= notBefore && time <= now && now - time <= 60_000;
}

function providerProof(proof, scope, expected, context) {
  return current(proof, context.notBefore, context.now) && proof.source === expected.source &&
    proof.provider === expected.provider && proof.product === expected.product &&
    text(proof.installation) && proof.installation === expected.installation &&
    proof.reference !== context.inventoryReference && same(proof.scope, scope);
}

export function paidFinishTrigger(entry, context) {
  const { grant, chapter, candidate } = context;
  const scope = { ...selector({ ...entry, chapter }), repository: entry.repository, candidate, event: entry.event, kind: entry.kind };
  const proof = entry.providerProof;
  if (entry.kind !== "app-trigger" || entry.event !== "pull_request" || !(entry.costUsd > 0) ||
      !grant.deepReview.some((allowed) => same(allowed, selector(scope))) ||
      !providerProof(proof, scope, { source: "provider-installation-and-billing",
        provider: "aikido", product: "deep-review", installation: entry.installation }, context) ||
      proof.unit !== "credits" || !Number.isSafeInteger(proof.credits) || proof.credits <= 0 ||
      proof.credits > grant.maxDeepReviewCredits) return null;
  return { scope, credits: proof.credits, providerReference: proof.reference, inventoryReference: context.inventoryReference };
}

export function zeroCostRetryTrigger(entry, context) {
  const { grant, chapter, candidate, pr, failedCheck, checksReference } = context;
  const scope = { ...selector({ ...entry, chapter }), repository: entry.repository, candidate, event: entry.event, kind: entry.kind };
  const proof = entry.providerProof;
  const { failure, push } = context.retryEvidence ?? {};
  if (grant.maxZeroCostCiRetries !== 1 || entry.kind !== "repository-check" || entry.event !== "retry" ||
      entry.costUsd !== 0 || !same(grant.retry, selector(scope)) || failedCheck?.id !== entry.id ||
      !providerProof(proof, scope, { source: "provider-workflow-and-billing",
        provider: "github-actions", product: "repository-ci", installation: entry.installation }, context) ||
      ![failure, push].every((item) => current(item, context.notBefore, context.now) &&
        item.source === "github-actions" && item.repository === scope.repository && item.head === candidate &&
        item.id === entry.id && item.configurationSha256 === entry.configurationSha256 && text(item.workflow) && text(item.runId)) ||
      new Set([failure.reference, push.reference, proof.reference, context.inventoryReference, checksReference]).size !== 5 ||
      failure.event !== "pull_request" || failure.pullRequest !== pr || failure.runId !== failedCheck.runId ||
      failure.attempt !== failedCheck.attempt || !Number.isSafeInteger(failure.attempt) || failure.attempt !== 1 ||
      failure.state !== "failed" || !transient.has(failure.classification) || failure.testFailure !== false ||
      push.event !== "push" || push.state !== "passed" || push.runId === failure.runId || push.workflow !== failure.workflow ||
      push.equivalent !== true || !digest(failure.executionSha256) || failure.executionSha256 !== push.executionSha256) return null;
  return { scope, check: entry.id, runId: failure.runId, attempt: failure.attempt, pullRequest: pr,
    providerReference: proof.reference, failureReference: failure.reference, pushReference: push.reference,
    inventoryReference: context.inventoryReference };
}

const pause = (reason) => ({ action: "pause", reason });

// One journal per protected finish, shared by both chapters and all callers.
// Link a fully synced entry into the next sequence slot without replacing it.
export function finishCreditJournal(records, finish, grantSha256) {
  const prefix = "finish-triggers-" + sha256(stableJson([finish.identity, finish.reference])) + "-";
  const entryPath = (number) => path.join(records, prefix + String(number).padStart(3, "0") + ".json");
  const files = readdirSync(records).filter((name) => name.startsWith(prefix)).sort();
  need(files.length <= 2 * (upper + 1), "Finish trigger journal exceeds its bound");
  const entries = [];
  const reservations = [];
  let previous = null;
  let pending = null;
  for (const [index, file] of files.entries()) {
    const location = entryPath(index + 1);
    need(file === path.basename(location), "Finish trigger journal sequence is incomplete");
    const bytes = readBounded(location, 256 * 1024);
    const entry = JSON.parse(bytes);
    need(entry.schemaVersion === 1 && entry.previous === previous && entry.grantSha256 === grantSha256 &&
      Number.isFinite(instant(entry.at)), "Finish trigger journal identity changed");
    previous = sha256(bytes);
    entries.push(entry);
    if (entry.state === "reserved") {
      need(!pending && chapters.includes(entry.chapter) && ["publish-ready", "retry-check-ready"].includes(entry.operation) &&
        !reservations.some((prior) => prior.operation === entry.operation && prior.chapter === entry.chapter),
      "Finish trigger reservation conflicts with retained history");
      pending = { ...entry, sha256: previous };
      reservations.push(pending);
    } else {
      need(pending && !pending.outcome && ["consumed", "uncertain"].includes(entry.state) &&
        entry.reservationSha256 === pending.sha256 && instant(entry.at) >= instant(pending.at), "Invalid finish trigger outcome");
      pending.outcome = entry;
      if (entry.state === "consumed") pending = null;
    }
  }
  return { reservations, pending, append(fields) {
    const entry = { schemaVersion: 1, previous, grantSha256, ...fields };
    const bytes = Buffer.from(stableJson(entry) + "\n");
    need(bytes.length <= 256 * 1024, "Finish trigger reservation exceeds its bound");
    const temp = path.join(records, ".finish-trigger-" + randomUUID());
    const fd = openSync(temp, "wx", 0o600);
    try {
      try {
        writeFileSync(fd, bytes);
        fsyncSync(fd);
      } finally { closeSync(fd); }
      try { linkSync(temp, entryPath(entries.length + 1)); }
      catch (error) {
        if (error.code === "EEXIST") return null;
        throw error;
      }
      const directory = openSync(records, "r");
      try { fsyncSync(directory); } finally { closeSync(directory); }
      return { ...entry, sha256: sha256(bytes) };
    } finally { unlinkSync(temp); }
  } };
}

export function finishCreditDecision(credits, decision, readbackSha256, selection, now) {
  if (!credits) return selection ? pause("FINISH_TRIGGER_AUTHORITY_PENDING") : {};
  const { grant, journal } = credits;
  if (journal.pending) return pause(journal.pending.outcome ? "FINISH_TRIGGER_OUTCOME_UNCERTAIN" : "FINISH_TRIGGER_OUTCOME_PENDING");
  const prior = journal.reservations.find((entry) => entry.chapter === decision.chapter && entry.operation === decision.action);
  if (prior) return pause("FINISH_TRIGGER_ALREADY_RESERVED");
  const triggers = decision.triggerInventories?.flatMap((inventory) => inventory.bundle ?? []) ?? [];
  if (!triggers.length) return selection ? pause("FINISH_TRIGGER_SELECTION_UNVERIFIED") : {};
  const amount = (entries) => entries.reduce((total, trigger) => total + (trigger.credits ?? 0), 0);
  const reserved = journal.reservations.flatMap((entry) => entry.triggers);
  const paidReferences = new Set(reserved.filter((trigger) => trigger.credits > 0).map((trigger) => trigger.providerReference));
  for (const trigger of triggers.filter((trigger) => trigger.credits > 0)) {
    if (paidReferences.has(trigger.providerReference)) return pause("FINISH_TRIGGER_PROVIDER_REFERENCE_REUSED");
    paidReferences.add(trigger.providerReference);
  }
  if (!(now < instant(grant.deadline)) || amount(reserved) + amount(triggers) > grant.maxDeepReviewCredits ||
      (triggers.some((trigger) => trigger.check) && reserved.some((trigger) => trigger.check))) return pause("FINISH_TRIGGER_CAP_OR_DEADLINE");
  const expected = { reference: grant.reference, chapter: decision.chapter, operation: decision.action,
    head: decision.head, readbackSha256 };
  if (!selection) return { ...pause("FINISH_TRIGGER_RESERVATION_REQUIRED"), finishTriggerSelection: expected };
  if (!same(selection, expected)) return pause("FINISH_TRIGGER_SELECTION_UNVERIFIED");
  const reservation = journal.append({ ...expected, triggers, state: "reserved", at: new Date(now).toISOString() });
  return reservation ? { finishTriggerReservation: reservation } : pause("FINISH_TRIGGER_RESERVATION_RACE");
}

export function settleFinishCredit(credits, outcome, outcomeSha256, now) {
  const pending = credits?.journal.pending;
  if (!pending || pending.outcome || !observed(outcome) || outcome.kind !== "finish-trigger-outcome" ||
      outcome.grantReference !== pending.reference || outcome.reservationSha256 !== pending.sha256 ||
      !same(outcome.scope, { chapter: pending.chapter, operation: pending.operation, head: pending.head,
        readbackSha256: pending.readbackSha256 }) || !["consumed", "uncertain"].includes(outcome.state) ||
      !(instant(outcome.observedAt) >= instant(pending.at) && instant(outcome.observedAt) <= now)) {
    return pause("FINISH_TRIGGER_OUTCOME_UNVERIFIED");
  }
  const retained = credits.journal.append({ state: outcome.state, at: outcome.observedAt,
    reservationSha256: pending.sha256, outcomeReference: outcome.reference, outcomeSha256 });
  return retained ? { action: "finish-trigger-settled", reason: null, finishTriggerOutcome: retained } :
    pause("FINISH_TRIGGER_RESERVATION_RACE");
}
