import path from "node:path";
import { lstatSync } from "node:fs";
import { ancestor, candidate as candidateSnapshot, committedDocument, exactTree, policyContext, proveTaskCompletion, verifyArchive } from "./change-guard.mjs";
import { retirementInventory } from "./change-workspace.mjs";
import { evidenceCommand } from "./evidence-cli.mjs";
import { readBounded, sha256, verifyGateRun, verifyRepresentation, scopedPath, separate } from "./evidence-retention.mjs";
import { verifyLocalHarness } from "./local-harness.mjs";
import { verifyHarnessSeal } from "./harness-result.mjs";
import { validateDirectHost } from "./agent-role-adapters.mjs";
import { parseStrictJson } from "./agent-configuration.mjs";
import { verifyPrFixIntegration, verifyPrFixLineage } from "./pr-fix-lineage.mjs";
import { finishReadiness } from "./finish-readiness.mjs";
import { pushTriggerDecision, standingTriggerDecision, retainedExternalReservation, uiAcceptanceDecision } from "./external-verification.mjs";
import { finishCreditDecision, finishCreditGrant, finishCreditJournal, paidFinishTrigger,
  settleFinishCredit, zeroCostRetryTrigger } from "./finish-trigger-credits.mjs";
import { need, observed, privateRecords, same, sealedObservation, text } from "./operator-records.mjs";
import { reviewProofMatches } from "./low-touch-policy.mjs";

const sha = (value) => typeof value === "string" && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value);
const digest = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const time = (value) => {
  const when = typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isFinite(when) && new Date(when).toISOString() === value ? when : NaN;
};
const maxWait = 60 * 60 * 1000;
const readbackWindow = 60_000;
const result = (action, reason = null, fields = {}) => ({ schemaVersion: 1, action, reason,
  remoteWrites: false, profileWrites: false, ...fields });
const stop = (reason, fields) => result("pause", reason, fields);

function retainedPath(records, ref) {
  need(text(ref?.file) && ref.file.startsWith(records + path.sep), "Finish evidence is outside retained records");
  return ref.file;
}
function retainedFile(records, ref) {
  retainedPath(records, ref);
  return sealedObservation(ref);
}

function bound(observation, identity, grant) {
  return observed(observation) && observation.grantReference === grant.reference && same(observation.identity, identity);
}

function prUrl(repository, url) {
  const prefix = "https://github.com/" + repository + "/pull/";
  return typeof url === "string" && url.startsWith(prefix) && /^[1-9][0-9]*$/.test(url.slice(prefix.length));
}

function checkIds(entries) {
  return Array.isArray(entries) && entries.every(text) && new Set(entries).size === entries.length;
}

// The orchestrator normalizes complete official branch protection and ruleset
// reads. Check IDs include the app/source identity where protection names it.
export function protectedCheckDecision({ pr, head, protection, checks, review, optionalDisposition, deadline, now }) {
  const fields = { pr: pr.url, head, deadline, required: [], optional: [] };
  if (pr.head !== head) return stop("PR_HEAD_CHANGED", { ...fields, observedHead: pr.head });
  if (!Number.isFinite(time(deadline)) || !Number.isFinite(now)) return stop("PROTECTED_WAIT_UNVERIFIED", fields);
  const current = (value) => observed(value) && value.pullRequest === pr.url && value.head === head &&
    time(value.observedAt) >= time(pr.observedAt) && time(value.observedAt) <= now;
  const sources = [protection?.branchProtection, protection?.rulesets];
  if (!current(protection) || protection.target !== pr.target || protection.routeVerified !== true ||
      !sources.every((source) => current(source) && source.complete === true && checkIds(source.required)) ||
      !current(checks) || checks.complete !== true || !Array.isArray(checks.entries) ||
      !checkIds(checks.entries.map((entry) => entry?.id)) ||
      checks.entries.some((entry) => entry.head !== head ||
        !["pending", "passed", "failed", "stalled"].includes(entry.state))) {
    return stop("REQUIRED_PROTECTION_OR_CHECKS_UNVERIFIED", fields);
  }
  const required = [...new Set(sources.flatMap((source) => source.required))].sort();
  const byId = new Map(checks.entries.map((entry) => [entry.id, entry]));
  fields.required = required.map((id) => ({ id, state: byId.get(id)?.state ?? "missing" }));
  fields.optional = checks.entries.filter(({ id }) => !required.includes(id)).map(({ id, state }) => ({ id, state }));
  fields.references = [pr.reference, protection.reference, ...sources.map(({ reference }) => reference), checks.reference];
  if (fields.required.some(({ state }) => state === "failed")) return stop("REQUIRED_CHECK_FAILED", fields);
  if (!current(review) || review.complete !== true || !["passed", "human-required", "failed", "pending"].includes(review.state) ||
      !["ready", "pending", "blocked"].includes(pr.mergeability)) return stop("REVIEW_OR_MERGEABILITY_UNVERIFIED", fields);
  fields.references.push(review.reference);
  if (["human-required", "failed"].includes(review.state) || pr.mergeability === "blocked") return stop("PROTECTED_HUMAN_ACTION_PENDING", fields);
  const stalled = fields.optional.filter(({ state }) => state === "stalled").map(({ id }) => id).sort();
  if (stalled.length && !(current(optionalDisposition) && optionalDisposition.decision === "proceed-without" &&
      same(optionalDisposition.ids, stalled))) return stop("OPTIONAL_CHECK_DISPOSITION_PENDING", fields);
  if (now >= time(deadline)) return stop("PROTECTED_WAIT_EXPIRED", fields);
  if (fields.required.some(({ state }) => state !== "passed") || review.state === "pending" || pr.mergeability === "pending") {
    return result("watch", "PROTECTED_CHECKS_PENDING", { ...fields,
      pollAt: new Date(Math.min(time(deadline), time(pr.observedAt) + 15_000)).toISOString() });
  }
  return result("merge-ready", null, fields);
}

export function verifyReviewHostHarness(policy, options) {
  if (!policy.directReviewer) return verifyLocalHarness(options);
  const { hostConfiguration: ref, excluded, harness, candidate, now } = options;
  need(text(ref?.file) && excluded.every((root) => separate(root, ref.file)), "Host file overlaps candidate");
  const filename = scopedPath(ref.file);
  const stat = lstatSync(filename);
  need(stat.isFile() && stat.nlink === 1 && (stat.mode & 0o022) === 0 &&
    (process.getuid === undefined || [process.getuid(), 0].includes(stat.uid)), "Host file is untrusted");
  const bytes = readBounded(filename, 64 * 1024);
  need(sha256(bytes) === ref.sha256, "Host file SHA-256 mismatch");
  const { proofLevel, ...host } = parseStrictJson(bytes);
  if (proofLevel === undefined) return verifyLocalHarness(options);
  need(proofLevel === (policy.proofLevel ?? "whole-file-read"), "Host proof level differs from the integrated parent");
  const { localHarness: binding } = validateDirectHost(host);
  if (!binding) {
    need(!harness, "Unexpected harness evidence without a host binding");
    return null;
  }
  const result = verifyHarnessSeal({ reference: harness, binding, configurationSha256: ref.sha256,
    candidate, excluded: [...excluded, ref.file], now });
  return { sha256: harness.sha256, observedAt: result.observedAt };
}

function gatePass(ref, records, identity, head, gates) {
  const { repo, workspace, plan, planDigest, mode, change } = identity;
  const bytes = readBounded(retainedPath(records, ref));
  need(sha256(bytes) === ref.sha256, "Gate evidence file identity mismatch");
  const run = JSON.parse(bytes);
  return { ...verifyGateRun(run, { implementation: workspace, plan, planDigest, mode, change, head,
    tree: exactTree(repo, head), gates }), observedAt: run.commands.at(-1).observedAt };
}

function closureReviewPass(review, identity, grant, closure, implementationReview) {
  return bound(review, identity, grant) && review.kind === "independent-closure-review" &&
    review.head === closure.head && review.gateSha256 === closure.gate.sha256 &&
    review.verdict === "pass" && review.factual === true && Array.isArray(review.findings) && !review.findings.length &&
    time(review.observedAt) >= time(closure.gateObservedAt) &&
    text(review.session) && review.session !== implementationReview.session && review.reference !== implementationReview.reference;
}

function eventInventory(entry, identity, grant, head, policy, events, notBefore, now, bundledTrigger) {
  return events.map(([event, target]) => standingTriggerDecision({ ...entry.eventInventories?.[event],
    candidate: head, repository: identity.repository, policy, event, target, finishReference: grant.reference,
    notBefore, now, bundledTrigger, strictInventory: !!bundledTrigger || policy.strictInventory === true }));
}

function publication(identity, grant, remote, chapter, head, retained, now, policy, credits) {
  const entry = remote?.[chapter];
  const state = (action, reason, fields) => ({ decision: result(action, reason, { chapter, head, prState: entry?.state, ...fields }) });
  if (!bound(remote, identity, grant) || !bound(entry, identity, grant) || entry.complete !== true ||
      entry.target !== identity.target || !(time(entry.observedAt) <= now && time(entry.observedAt) >= time(retained.observedAt) &&
        now - time(entry.observedAt) <= readbackWindow)) {
    return state("pause", "REMOTE_INVENTORY_UNVERIFIED");
  }
  const reservations = credits?.journal.reservations.filter((reservation) => reservation.chapter === chapter) ?? [];
  const published = reservations.find((reservation) => reservation.operation === "publish-ready");
  if (published && (entry.head !== published.head || entry.state === "ABSENT" || !(time(entry.observedAt) >= time(published.outcome?.at)))) {
    return state("pause", "FINISH_TRIGGER_PUBLICATION_READBACK_REQUIRED");
  }
  if (entry.state === "ABSENT" && entry.head === head && entry.url === null && !retained.prs[chapter]) {
    if (now >= time(retained.deadline)) return state("pause", "PROTECTED_WAIT_EXPIRED");
    const target = entry.beforePublication;
    if (!bound(target, identity, grant) || target.target !== identity.target || target.head !== head ||
        !sha(target.targetRevision) || target.complete !== true || target.routeVerified !== true ||
        target.specsReconciled !== true || !(time(target.observedAt) >= time(entry.observedAt) && time(target.observedAt) <= now)) {
      return state("pause", "PUBLICATION_TARGET_UNVERIFIED");
    }
    ancestor(identity.repo, identity.policyRevision, target.targetRevision);
    if (policy) {
      need(text(entry.sourceRef) && entry.sourceRef.startsWith("refs/heads/") &&
        target.sourceRef === entry.sourceRef && (chapter !== "implementation" || entry.sourceRef === (identity.branch.startsWith("refs/heads/") ? identity.branch : "refs/heads/" + identity.branch)),
      "Exact protected source ref is unverified");
      const matches = eventInventory(entry, identity, grant, head, policy,
        [["push", entry.sourceRef], ["pull_request", identity.target]], time(target.observedAt), now,
        credits && ((trigger, context) => paidFinishTrigger(trigger, { ...context, grant: credits.grant, chapter, candidate: head })));
      const failure = matches.find(({ action }) => action !== "proceed");
      return failure ? state("pause", failure.reason) : state("publish-ready", null, { triggerInventories: matches });
    }
    const trigger = pushTriggerDecision({ ...entry.triggers, candidate: head });
    return trigger.action === "proceed" && entry.triggers.pushGrant.target === identity.repository &&
      entry.triggers.pushGrant.finishReference === grant.reference ?
      state("publish-ready", null) : state("pause", trigger.reason ?? "PUSH_AUTHORITY_PENDING");
  }
  if (!prUrl(identity.repository, entry.url) || (retained.prs[chapter] && entry.url !== retained.prs[chapter])) {
    return state("pause", "PR_IDENTITY_UNVERIFIED");
  }
  if (entry.head !== head) return state("pause", "PR_HEAD_CHANGED", { pr: entry.url, observedHead: entry.head });
  const checkInput = { ...entry.protectionReadback, pr: entry, head, deadline: retained.deadline, now };
  const retried = reservations.find((reservation) => reservation.operation === "retry-check-ready");
  if (retried) {
    const [{ check, runId, attempt, pullRequest }] = retried.triggers;
    const current = checkInput.checks?.entries?.find(({ id }) => id === check);
    if (entry.url !== pullRequest || entry.head !== retried.head || !(time(checkInput.checks?.observedAt) >= time(retried.outcome?.at) && time(checkInput.checks.observedAt) <= now) ||
        current?.runId !== runId || !Number.isSafeInteger(current.attempt) || current.attempt !== attempt + 1) {
      return state("pause", "FINISH_TRIGGER_RETRY_READBACK_REQUIRED", { pr: entry.url });
    }
  }
  if (entry.state === "MERGED" && sha(entry.mergeCommit)) {
    if (retried) {
      const retriedCheck = checkInput.checks.entries.find(({ id }) => id === retried.triggers[0].check);
      if (!observed(checkInput.checks) || checkInput.checks.complete !== true || checkInput.checks.pullRequest !== entry.url ||
          checkInput.checks.head !== head || retriedCheck.head !== head || retriedCheck.state !== "passed") {
        return state("pause", "FINISH_TRIGGER_RETRY_READBACK_REQUIRED", { pr: entry.url });
      }
    }
    return { merged: entry };
  }
  if (entry.state !== "OPEN") return state("pause", "PR_STATE_UNVERIFIED");
  const checks = protectedCheckDecision(checkInput);
  const protectedDecision = { ...checks, chapter, prState: entry.state };
  if (checks.reason === "REQUIRED_CHECK_FAILED" && credits && !retried && now < time(retained.deadline)) {
    const [failed, ...others] = checks.required.filter(({ state }) => state === "failed");
    const failedCheck = checkInput.checks.entries.find(({ id }) => id === failed.id);
    const entries = checkInput.checks.entries.map((check) => check === failedCheck ? { ...check, state: "pending" } : check);
    if (!others.length && protectedCheckDecision({ ...checkInput, checks: { ...checkInput.checks, entries } }).action === "watch") {
      const matches = eventInventory(entry, identity, grant, head, policy, [["retry", identity.target]],
        time(checkInput.checks.observedAt), now, (trigger, context) => zeroCostRetryTrigger(trigger, {
          ...context, grant: credits.grant, chapter, candidate: head, pr: entry.url, failedCheck,
          checksReference: checkInput.checks.reference, retryEvidence: entry.retryEvidence,
        }));
      if (matches[0].action === "proceed" && matches[0].bundle?.length === 1) {
        return state("retry-check-ready", null, { pr: entry.url, triggerInventories: matches });
      }
    }
  }
  if (checks.action === "pause") return { decision: protectedDecision };
  if (chapter === "implementation" && grant.uiDeclaration !== null) {
    let preview = remote.preview;
    if (grant.uiDeclaration.deployPreview && (!retainedExternalReservation(preview?.reservation) ||
        !preview.reservation.reservation.file.startsWith(retained.records + path.sep) ||
        preview.reservation.card.kind !== "deploy-preview" || preview.reservation.card.candidate !== head ||
        preview.authorityReference !== preview.reservation.reference || preview.authorityReference === grant.reference)) {
      preview = null;
    }
    const ui = uiAcceptanceDecision({ declaration: grant.uiDeclaration, local: remote.localUI, preview,
      candidate: head, requirePreviewUrl: true });
    if (ui.action !== "accepted") return { decision: { ...protectedDecision, action: "pause",
      reason: ui.reason, previewUrl: ui.previewUrl ?? null } };
  }
  if (policy && checks.action === "merge-ready") {
    const matches = eventInventory(entry, identity, grant, head, policy, [["merge", identity.target], ["push", identity.target]],
      time(entry.observedAt), now);
    const failure = matches.find(({ action }) => action !== "proceed");
    if (failure) return state("pause", failure.reason);
    protectedDecision.triggerInventories = matches;
  }
  return { decision: protectedDecision };
}

async function protectedEvidence(pr, records) {
  const assertion = pr.assertion;
  if (assertion?.pullRequest !== pr.url || assertion.expectedHead !== pr.head ||
      (pr.state === "OPEN" ? assertion.mergedAt !== undefined || pr.mergedAt !== null : assertion.mergedAt !== pr.mergedAt) ||
      !same(assertion.applicableCheckIds, pr.requiredCheckIds) ||
      !Object.values(assertion.readbacks ?? {}).every((ref) => typeof ref.file === "string" && ref.file.startsWith(records + path.sep)) ||
      !(await evidenceCommand("assert-closeout", assertion)).ok) return false;
  const bytes = readBounded(retainedPath(records, assertion.readbacks.pr));
  if (sha256(bytes) !== assertion.readbacks.pr.sha256) return false;
  const readback = JSON.parse(verifyRepresentation(JSON.parse(bytes)));
  return readback.state === pr.state && (pr.state === "OPEN" || readback.mergeCommit === pr.mergeCommit);
}

async function verifyReadyPublication(chapter, remote, records) {
  if (chapter.decision?.action === "merge-ready") {
    const expected = chapter.decision.required.map(({ id }) => id);
    if (!same(remote.requiredCheckIds, expected) || !(await protectedEvidence(remote, records))) {
      return { decision: { ...chapter.decision, action: "pause", reason: "PROTECTED_MERGE_EVIDENCE_UNVERIFIED" } };
    }
  }
  return chapter;
}

function readFinishCheckpoint(input, now, archiveReplay = false) {
  const checkpoint = sealedObservation(input.finishCheckpoint);
  const { records, identity } = checkpoint;
  const { repo, repository, change, candidate, workspace } = identity;
  privateRecords(records, [repo, workspace, input.repo]);
  const read = (ref) => retainedFile(records, ref);
  need(checkpoint.schemaVersion === 1 && checkpoint.kind === "protected-finish-checkpoint" && observed(checkpoint) &&
    input.finishCheckpoint.file.startsWith(records + path.sep) &&
    (archiveReplay || input.repo === repo) && input.change === change && input.head === candidate &&
    /^[a-zA-Z0-9-]+\/[a-zA-Z0-9_.-]+$/.test(repository) && !repository.split("/").some((part) => part === "." || part === "..") &&
    text(identity.target) && text(identity.branch) && sha(candidate) && sha(identity.plan) &&
    sha(identity.targetRevision) && sha(identity.policyRevision) && digest(identity.planDigest) &&
    (identity.issue === null || (typeof identity.issue === "string" &&
      identity.issue.startsWith("https://github.com/" + repository + "/issues/") &&
      /^[1-9][0-9]*$/.test(identity.issue.split("/").at(-1)) &&
      identity.issue.split("/").length === 7)),
  "Finish checkpoint identity or location mismatch");
  const grant = read(checkpoint.grant);
  need(grant.schemaVersion === 1 && grant.kind === "protected-finish" && observed(grant) && same(grant.identity, identity) &&
    typeof grant.keepWorktree === "boolean" && typeof checkpoint.keepWorktree === "boolean" &&
    (!grant.keepWorktree || checkpoint.keepWorktree) &&
    time(grant.startedAt) <= time(checkpoint.observedAt) && time(checkpoint.observedAt) <= now &&
    time(checkpoint.deadline) > time(grant.startedAt) && time(checkpoint.deadline) - time(grant.startedAt) <= maxWait &&
    checkpoint.deadline === grant.deadline && (grant.uiDeclaration === null || typeof grant.uiDeclaration === "object") &&
    checkpoint.prs && ["implementation", "closure"].every((key) =>
      checkpoint.prs[key] === null || prUrl(repository, checkpoint.prs[key])) &&
    (!checkpoint.prs.closure || checkpoint.prs.implementation && sha(checkpoint.closureHead)),
  "Finish grant, retained restrictions or finite deadline mismatch");
  if (checkpoint.keepWorktree && !grant.keepWorktree) {
    const keep = read(checkpoint.keepDecision);
    need(bound(keep, identity, grant) && keep.kind === "keep-worktree" &&
      time(keep.observedAt) >= time(grant.startedAt) && time(keep.observedAt) <= time(checkpoint.observedAt),
    "The added keep-worktree restriction is unverified");
  }
  return { checkpoint, grant, records, identity, read };
}

function readFinishAnchor({ checkpoint, grant, identity, read }) {
  const anchor = read(checkpoint.anchor);
  need(bound(anchor, identity, grant) && anchor.kind === "finish-readiness-readback" && anchor.ready === true &&
    observed(anchor.implementationReview) && text(anchor.implementationReview.session) &&
    digest(anchor.implementationGateSha256) && typeof anchor.keepWorktree === "boolean" &&
    (!anchor.keepWorktree || checkpoint.keepWorktree), "Original finish readiness or worktree restriction is unverified");
  return anchor;
}

function readFinishRemote({ checkpoint, grant, identity, read }, ref, now, archiveReplay = false) {
  const remote = read(ref);
  need(bound(remote, identity, grant) && time(remote.observedAt) >= time(checkpoint.observedAt) &&
    time(remote.observedAt) <= now && (archiveReplay || now - time(remote.observedAt) <= readbackWindow),
  "Finish readback identity or observation time is unverified");
  return remote;
}

async function verifyGovernedReview({ policy, identity, records, readback, handover, head, base, gate, host, verifyHandover,
  finishReference }) {
  need(verifyHandover && handover?.kind === "review-candidate" && handover.waivers === undefined &&
    digest(handover.requestFileSha256) && digest(handover.expectFileSha256) &&
    ["request", "expect", "output", "exportDirectory"].every((key) => retainedPath(records, { file: handover[key] })),
  "Missing independently sealed finish review");
  const replay = await verifyHandover(handover);
  const proof = replay.reviewProof;
  const { result: reviewed, request, reviewSnapshot: snapshot, reviewPolicyBinding: binding } = replay;
  need(reviewProofMatches(policy, replay) && replay.phase === "complete" && proof?.zeroWaiver === true &&
    same(proof, readback.reviewProof) && digest(proof.statusSha256) &&
    proof.reviewedHead === head && proof.reviewedPlan === identity.plan && proof.reviewedPlanDigest === policy.planDigest &&
    proof.session === readback.session && proof.reference === readback.reference &&
    reviewed.identity.candidate === head && reviewed.identity.change === identity.change &&
    [identity.repo, identity.workspace].every((root) => separate(root, reviewed.identity.workspace)) &&
    same(reviewed.identity.inputs, policy.inputs) && reviewed.runtime.readOnly === true &&
    snapshot?.target === head && snapshot.base === base && snapshot.plan === identity.plan &&
    snapshot.planDigest === policy.planDigest && !snapshot.prFix &&
    binding?.parent === identity.policyRevision && binding.target === identity.targetRevision &&
    (finishReference === undefined || binding.finishReference === finishReference) &&
    replay.reviewConfigurationSha256 === host && digest(host) &&
    request.acceptance.includes(`gate-run:${gate.reference}`) &&
    (finishReference !== undefined || identity.mode !== "goal-first" ||
      request.acceptance.includes(`goal-contract:${identity.planDigest}`)),
  "Finish review lacks matching proof, zero-waiver evidence or exact retained identity");
  return proof;
}

async function verifyGovernedImplementation(state, policy, anchor, implementationGate, fix, verifyHandover) {
  const { identity, records } = state;
  if (!policy.proofLevel) return undefined;
  const readback = anchor.implementationReview;
  if (fix) {
    const proof = fix.ancestorReview.reviewProof;
    need(proof?.zeroWaiver && same(proof, readback.reviewProof) && proof.reviewedHead === fix.reviewedAncestor,
      "PR-fix proof differs from the accepted review anchor");
    return proof;
  }
  const completion = anchor.taskCompletion;
  const head = completion?.reviewedParent ?? identity.candidate;
  const gate = completion ? gatePass(completion.reviewedGate, records, identity, head, implementationGate.gateCommands) : implementationGate;
  need(gate.passed && (!completion || completion.reviewedGateReference === gate.reference),
    "Actual reviewed SHA lacks its exact original gates");
  return verifyGovernedReview({ policy, identity, records, readback, head, base: identity.plan, gate,
    handover: completion?.handover ?? anchor.implementationHandover, host: anchor.hostConfigurationSha256, verifyHandover });
}

async function verifyFinishPrFix(request, { checkpoint, records, identity }, anchor, implementationGate, verifyHandover) {
  need(checkpoint.prs.implementation && digest(anchor.hostConfigurationSha256),
    "PR-fix finish requires the retained implementation PR and host pin");
  const lineage = await verifyPrFixLineage(request, anchor.prFixLineage, verifyHandover, { workspace: identity.workspace, records,
    hostConfigurationSha256: anchor.hostConfigurationSha256, pullRequest: checkpoint.prs.implementation,
    gateAuthority: anchor.gateAuthority });
  const { proof } = lineage;
  need(implementationGate.passed && proof.finalGate === anchor.implementationGateSha256 &&
    proof.finalGate === implementationGate.reference && proof.reviewedAncestor === anchor.implementationReview.head &&
    proof.ancestorReview.session === anchor.implementationReview.session &&
    proof.ancestorReview.reference === anchor.implementationReview.reference, "PR-fix reviews or final gates differ from finish readiness");
  return lineage;
}

function integratedFinishGate(repo, state, remote, merged, taskGateAuthority, checkpointSha256) {
  const { identity, grant, records } = state;
  const integrated = remote.integrated;
  if (!bound(integrated, identity, grant) || integrated.mergeCommit !== merged.mergeCommit ||
      !sha(integrated.head) || !Array.isArray(grant.integratedGates) || !integrated.gate) return;
  if (taskGateAuthority) {
    need(remote.checkpointSha256 === checkpointSha256, "Integrated finish readback does not bind the held checkpoint");
    need(same(grant.integratedGates, taskGateAuthority.gates),
      "Integrated PR-fix gate commands differ from approved acceptance");
  }
  ancestor(repo, merged.mergeCommit, integrated.head);
  return gatePass(integrated.gate, records, { ...identity, repo }, integrated.head, grant.integratedGates);
}

export async function replayTaskGuidedFinish(request, {
  finishCheckpoint, finishRemote, prFixLineage, verifyHandover, issue, pullRequest, integrated, verified,
}) {
  need(finishCheckpoint && finishRemote, "Missing independently retained Task-Guided finish checkpoint and readback");
  const now = Date.now();
  const state = readFinishCheckpoint({ ...request, finishCheckpoint }, now, true);
  const { checkpoint, identity, grant, records } = state;
  need(identity.mode === "task-guided" && identity.plan === request.plan && identity.planDigest === request["expect-plan"] &&
    identity.policyRevision === request.base && identity.targetRevision === request.target &&
    identity.issue === issue && checkpoint.prs.implementation === pullRequest, "Receipt differs from the held finish identity");
  const anchor = readFinishAnchor(state);
  need(!anchor.taskCompletion && same(anchor.prFixLineage, prFixLineage),
    "Receipt PR-fix lineage differs from the held checkpoint");
  const remote = readFinishRemote(state, finishRemote, now, true);
  need(remote.implementation?.state === "MERGED", "Held finish readback does not establish a protected merge");
  const { merged } = publication(identity, grant, remote, "implementation", request.head, checkpoint, time(remote.observedAt));
  need(merged && merged.mergeCommit === integrated && remote.integrated?.head === verified &&
    await protectedEvidence(merged, records), "Receipt merge or verified SHA differs from protected finish readback");
  const implementationGate = gatePass(anchor.implementationGate, records, { ...identity, repo: request.repo }, request.head);
  const lineage = await verifyFinishPrFix(request, state, anchor, implementationGate, verifyHandover);
  const gate = integratedFinishGate(request.repo, state, remote, merged, lineage.gateAuthority, finishCheckpoint.sha256);
  need(gate?.passed, "Missing or failed exact verified Task-Guided PR-fix gate run");
  return lineage;
}

export async function replayFinishReviewProvenance(request, { finishCheckpoint, finishRemote, prFixLineage,
  verifyHandover, issue, pullRequest, integrated, verified, archiveHead }) {
  const now = Date.now();
  const state = readFinishCheckpoint({ ...request, finishCheckpoint }, now, true);
  const { checkpoint, identity, grant, records } = state;
  need(identity.plan === request.plan && identity.planDigest === request["expect-plan"] && identity.mode === request.mode &&
    identity.policyRevision === request.base && identity.targetRevision === request.target &&
    identity.issue === issue && checkpoint.prs.implementation === pullRequest,
  "Receipt differs from its protected finish identity");
  const policy = policyContext({ repo: request.repo, change: identity.change, plan: identity.plan, target: identity.targetRevision });
  const anchor = readFinishAnchor(state);
  need(policy.proofLevel && same(anchor.prFixLineage, prFixLineage), "Receipt review lineage differs from the held checkpoint");
  const remote = readFinishRemote(state, finishRemote, now, true);
  const { merged } = publication(identity, grant, remote, "implementation", identity.candidate, checkpoint, time(remote.observedAt));
  need(merged && merged.mergeCommit === integrated && remote.integrated?.head === verified &&
    await protectedEvidence(merged, records), "Receipt does not match the protected implementation merge");
  const replayIdentity = { ...identity, repo: request.repo };
  const gate = gatePass(anchor.implementationGate, records, replayIdentity, identity.candidate);
  need(gate.passed && gate.reference === anchor.implementationGateSha256, "Receipt implementation gates differ");
  const stateForReplay = { ...state, identity: replayIdentity };
  const lineage = prFixLineage ? await verifyFinishPrFix(request, stateForReplay, anchor, gate, verifyHandover) : null;
  const fix = lineage?.proof;
  const integratedGate = integratedFinishGate(request.repo, state, remote, merged, lineage?.gateAuthority, finishCheckpoint.sha256);
  need(integratedGate?.passed, "Receipt lacks exact integrated gate evidence");
  const reviewProof = await verifyGovernedImplementation(stateForReplay, policy, anchor, gate, fix, verifyHandover);
  let closureReviewProof;
  if (remote.closure?.state === "MERGED") {
    const closure = remote.closureCandidate;
    need(bound(closure, identity, grant) && closure.integrated === verified && closure.head === checkpoint.closureHead &&
      Array.isArray(grant.closureGates) && grant.closureGates.some((argv) => same(argv, ["npm", "test"])),
    "Archived closure lacks exact candidate and declared gates");
    const { merged: closed } = publication(identity, grant, remote, "closure", closure.head, checkpoint, time(remote.observedAt));
    need(closed && await protectedEvidence(closed, records), "Archived closure lacks protected merge readback");
    ancestor(request.repo, closure.head, closed.mergeCommit);
    // A readback can verify the closure candidate while the closeout guard
    // separately compares the eventual archive at or after the merge.
    if (archiveHead !== closure.head) ancestor(request.repo, closed.mergeCommit, archiveHead);
    const closureGate = gatePass(closure.gate, records, replayIdentity, closure.head, grant.closureGates);
    need(closureGate.passed && closureReviewPass(remote.closureReview, identity, grant,
      { ...closure, gateObservedAt: closureGate.observedAt }, anchor.implementationReview) &&
      time(remote.closureReview.observedAt) <= time(remote.observedAt), "Archived closure review or gates differ");
    closureReviewProof = await verifyGovernedReview({ policy, identity: replayIdentity, records, readback: remote.closureReview,
      handover: remote.closureReview.handover, head: closure.head, base: verified, gate: closureGate,
      host: anchor.hostConfigurationSha256, finishReference: grant.reference, verifyHandover });
    need(!fix || closureReviewProof.session !== fix.deltaReview.session && closureReviewProof.reference !== fix.deltaReview.reference,
      "Archived closure review must use independent evidence from the PR-fix review");
  }
  return { reviewProof, closureReviewProof, completion: anchor.taskCompletion };
}

export async function protectedFinish(input, readiness, now = Date.now(), verifyHandover, triggerCommand) {
  const state = readFinishCheckpoint(input, now);
  const { checkpoint, grant, records, identity, read } = state;
  const { repo, repository, change, candidate, workspace } = identity;
  const creditRef = checkpoint.triggerGrant;
  const journal = finishCreditJournal(records, grant, creditRef?.sha256 ?? null);
  const credits = creditRef && {
    grant: finishCreditGrant(read(creditRef), checkpoint, grant),
    journal,
  };
  const triggerStatus = { identity, grantReference: grant.reference, checkpoint: input.finishCheckpoint.file,
    deadline: checkpoint.deadline, records, keepWorktree: checkpoint.keepWorktree || input.restrictions?.keepWorktree === true };
  if (triggerCommand === "settle") {
    return result("pause", null, { ...triggerStatus,
      ...settleFinishCredit(credits, read(input.finishTriggerOutcome), input.finishTriggerOutcome.sha256, now) });
  }
  if (credits?.journal.pending) {
    const { chapter, head, outcome } = credits.journal.pending;
    return stop(outcome ? "FINISH_TRIGGER_OUTCOME_UNCERTAIN" : "FINISH_TRIGGER_OUTCOME_PENDING", { ...triggerStatus, chapter, head });
  }
  const anchor = readFinishAnchor(state);
  const policy = policyContext({ repo, change, plan: identity.plan, target: identity.targetRevision });
  need(policy.ok && policy.parent === identity.policyRevision, "The original integrated policy identity differs");
  const approved = candidateSnapshot({ repo, change, head: candidate, base: identity.policyRevision,
    plan: identity.plan, target: identity.targetRevision, mode: identity.mode, "expect-plan": identity.planDigest }, false);
  need(approved.tasksComplete, "The immutable implementation candidate has incomplete native tasks");
  const proposal = committedDocument(repo, identity.plan, "openspec/changes/" + change + "/proposal.md");
  const metadata = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(proposal)?.[1];
  const issueFields = [...(metadata ?? "").matchAll(/^github_issue:[ \t]*(\S+)[ \t]*\r?$/gm)];
  if (issueFields.length) {
    need(issueFields.length === 1 && (issueFields[0][1] === "null" ? null : issueFields[0][1]) === identity.issue,
      "The finish issue differs from the frozen proposal");
  }
  const implementationGate = gatePass(anchor.implementationGate, records, identity, candidate);
  need(implementationGate.passed && implementationGate.reference === anchor.implementationGateSha256,
    "Original implementation gate evidence mismatch");
  const completion = anchor.taskCompletion;
  const fixRef = anchor.prFixLineage;
  need(!(completion && fixRef) && (!input.prFixLineage || same(input.prFixLineage, fixRef)),
    "Protected finish lineage differs from the retained checkpoint");
  const fixRequest = fixRef && { repo, change, head: candidate, base: identity.policyRevision,
    plan: identity.plan, mode: identity.mode, target: identity.targetRevision, "expect-plan": identity.planDigest };
  let fix;
  let taskGateAuthority;
  if (fixRef) {
    ({ proof: fix, gateAuthority: taskGateAuthority } = await verifyFinishPrFix(fixRequest, state, anchor, implementationGate, verifyHandover));
    need(finishReadiness(fixRequest, { action: "accept-result", head: candidate }, undefined, false).ready,
      "PR-fix final head has unverified current-spec promotion");
  }
  if (policy.lowTouch) {
    need(anchor.implementationReview.head === (completion?.reviewedParent ?? fix?.reviewedAncestor ?? candidate),
      "Readiness anchor does not identify the actual reviewed SHA");
  }
  if (completion) {
    need(policy.lowTouch && verifyHandover && completion.acceptanceChild === candidate &&
      completion.handover?.kind === "review-candidate" && digest(completion.handover.expectFileSha256) &&
      completion.handover.waivers === undefined &&
      ["request", "expect", "output", "exportDirectory"].every((key) => retainedPath(records, { file: completion.handover[key] })),
    "Missing independently sealed task-completion provenance");
    const request = { repo, change, base: identity.policyRevision, head: candidate, plan: identity.plan,
      target: identity.targetRevision, mode: identity.mode, "expect-plan": identity.planDigest };
    const proof = proveTaskCompletion(request, completion.reviewedParent, completion.acceptedTaskIds);
    need(same(proof.taskIds, completion.taskIds), "Task-completion IDs differ from Git");
    const parentGate = gatePass(completion.reviewedGate, records, identity, proof.reviewedParent, implementationGate.gateCommands);
    const parent = await verifyHandover(completion.handover);
    const reviewed = parent.result;
    need((!policy.directReviewer || reviewProofMatches(policy, { transport: parent.reviewTransport, coverage: parent.reviewCoverage,
      proofLevel: parent.proofLevel, proofComplete: parent.proofComplete })) &&
      parentGate.passed && parentGate.reference === completion.reviewedGateReference &&
      parent.reviewPolicyBinding?.parent === identity.policyRevision && parent.reviewPolicyBinding.target === identity.targetRevision &&
      parent.reviewSnapshot?.base === identity.plan && parent.reviewSnapshot.plan === identity.plan &&
      parent.reviewSnapshot.planDigest === policy.planDigest && same(parent.request.identity.inputs, policy.inputs) &&
      parent.reviewConfigurationSha256 === anchor.hostConfigurationSha256 &&
      reviewed.identity.candidate === proof.reviewedParent && reviewed.identity.change === change &&
      completion.acceptedTaskIds.includes(reviewed.identity.task) && reviewed.runtime.readOnly === true &&
      reviewed.runtime.session === anchor.implementationReview.session && reviewed.report.sha256 === anchor.implementationReview.reference &&
      reviewed.status === "completed" && reviewed.verdict === "no_findings" && reviewed.nativeVerdict === "Verdict: No findings" &&
      reviewed.findings.length === 0 && reviewed.coverageLimitations.length === 0 &&
      parent.request.acceptance.includes(`gate-run:${parentGate.reference}`) &&
      (identity.mode !== "goal-first" || parent.request.acceptance.includes(`goal-contract:${identity.planDigest}`)),
    "Reviewed parent, original gates or zero-waiver result differ");
    if (!checkpoint.prs.implementation) {
      const readback = finishReadiness({ ...request, repo: workspace }, { action: "accept-result", head: candidate });
      need(readback.ready, "Promoted current specs or exact child checkout are unverified");
    }
  }
  const reviewProof = await verifyGovernedImplementation(state, policy, anchor, implementationGate, fix, verifyHandover);
  const reply = input.resume === "continue" ? read(input.finishReply) : null;
  if (input.resume === "continue") {
    need(bound(reply, identity, grant) && reply.kind === "finish-reply" && reply.reply === "continue" &&
      reply.checkpointSha256 === input.finishCheckpoint.sha256 &&
      time(reply.observedAt) >= time(checkpoint.observedAt) && time(reply.observedAt) <= now &&
      reply.pullRequest && reply.pullRequest === (checkpoint.prs.closure ?? checkpoint.prs.implementation),
    "Continue does not match the retained finish grant and PR checkpoint");
  } else if (!checkpoint.prs.implementation) {
    need(readiness?.ready === true && readiness.head === candidate && readiness.change === change &&
      ["plan", "planDigest", "mode", "policyRevision", "workspace", "branch", "targetRevision"].every((key) => readiness[key] === identity[key]) &&
      (!readiness.gateReference || readiness.gateReference === implementationGate.reference) &&
      (!readiness.reviewReference || readiness.reviewReference === anchor.implementationReview.reference) &&
      (!policy.proofLevel || same(readiness.reviewProof, reviewProof)) &&
      (!readiness.keepWorktree || checkpoint.keepWorktree) &&
      (completion ? readiness.taskCompletion && same(readiness.taskCompletion, {
        reviewedParent: completion.reviewedParent, acceptanceChild: completion.acceptanceChild, taskIds: completion.taskIds,
      }) : !readiness.taskCompletion),
      "Exact candidate finish readiness is required before publication");
  }

  const remote = readFinishRemote(state, input.finishRemote, now);
  if (reply) {
    const current = checkpoint.prs.closure ? remote.closure : remote.implementation;
    need(time(remote.observedAt) >= time(reply.observedAt) && time(current?.observedAt) >= time(reply.observedAt),
      "Continue requires a new exact remote PR readback");
  }
  let closureReviewProof;
  const observe = (value) => ({ ...value, identity,
    ...(policy.proofLevel ? { proofLevel: policy.proofLevel, reviewProof, ...(closureReviewProof ? { closureReviewProof } : {}) } : {}), checkpoint: input.finishCheckpoint.file, checkpointSha256: input.finishCheckpoint.sha256,
    records, grantReference: grant.reference, deadline: checkpoint.deadline,
    readback: input.finishRemote.file, ...(fix ? { prFixLineage: fix } : {}), keepWorktree: checkpoint.keepWorktree || input.restrictions?.keepWorktree === true });
  const triggerPolicy = credits ? { standingTriggers: [], ...policy.lowTouch, strictInventory: true } : policy.lowTouch;
  const checkedDecision = (decision) => {
    if (triggerCommand === "reserve" && !["publish-ready", "retry-check-ready"].includes(decision.action)) {
      return observe(stop(decision.reason ?? "FINISH_TRIGGER_SELECTION_UNVERIFIED", { chapter: decision.chapter, head: decision.head }));
    }
    if (!["publish-ready", "retry-check-ready"].includes(decision.action)) return observe(decision);
    const selection = triggerCommand === "reserve" ? input.finishTriggerSelection ?? {} : null;
    return observe({ ...decision, ...finishCreditDecision(credits, decision, input.finishRemote.sha256, selection, now) });
  };
  if (policy.lowTouch && remote.implementation?.state === "ABSENT") {
    verifyReviewHostHarness(policy, { hostConfiguration: input.hostConfiguration, harness: remote.implementation.harness,
      candidate, excluded: [repo, workspace], now });
    need(input.hostConfiguration.sha256 === anchor.hostConfigurationSha256, "Finish host binding changed");
  }
  const implementation = await verifyReadyPublication(publication(identity, grant, remote, "implementation", candidate, checkpoint, now, triggerPolicy, credits),
    remote.implementation, records);
  if (implementation.decision) return checkedDecision(implementation.decision);
  const merged = implementation.merged;
  if (!(await protectedEvidence(merged, records))) return observe(stop("PROTECTED_MERGE_EVIDENCE_UNVERIFIED", { pr: merged.url }));
  ancestor(repo, candidate, merged.mergeCommit);
  const integrated = remote.integrated;
  const integratedGate = integratedFinishGate(repo, state, remote, merged, taskGateAuthority, input.finishCheckpoint.sha256);
  if (!integratedGate) {
    return observe(result("verify-integrated", "INTEGRATED_GATES_PENDING", { head: merged.head, integratedHead: merged.mergeCommit,
      pr: merged.url, prState: "MERGED" }));
  }
  if (!integratedGate.passed) {
    return observe(stop("INTEGRATED_GATE_FAILED", { head: integrated.head, pr: merged.url }));
  }
  if (fix) verifyPrFixIntegration(fixRequest, fix, merged.mergeCommit, integrated.head);
  const closure = remote.closureCandidate;
  if (!closure && remote.closure?.state === "ABSENT" && bound(remote.closure, identity, grant) &&
      remote.closure.complete === true && remote.closure.target === identity.target &&
      remote.closure.url === null && time(remote.closure.observedAt) >= time(checkpoint.observedAt) &&
      time(remote.closure.observedAt) <= now && !checkpoint.prs.closure) {
    return observe(result("prepare-closure", "RECORD_ONLY_CLOSURE_PENDING", { head: integrated.head }));
  }
  if (!bound(closure, identity, grant) || closure.integrated !== integrated.head || !sha(closure.head) ||
      !digest(closure.receiptSha256)) return observe(stop("CLOSURE_CANDIDATE_UNVERIFIED"));
  if (checkpoint.prs.closure && checkpoint.closureHead !== closure.head) {
    return observe(stop("PR_HEAD_CHANGED", { pr: checkpoint.prs.closure, head: checkpoint.closureHead, observedHead: closure.head }));
  }
  const archive = { repo, change, verified: integrated.head, archive: closure.archive, receiptSha256: closure.receiptSha256,
    receiptFile: retainedPath(records, closure.receipt), committedReceiptPath: closure.receiptPath,
    issue: identity.issue, policyTarget: identity.targetRevision,
    integrationReference: merged.url, prFixLineage: fixRef, verifyHandover,
    ...(taskGateAuthority || policy.proofLevel ? { finishCheckpoint: input.finishCheckpoint, finishRemote: input.finishRemote } : {}) };
  need(closure.receipt.sha256 === closure.receiptSha256, "Closure receipt declaration differs");
  const receipt = await verifyArchive({ ...archive, head: closure.head });
  need(receipt.integrated === merged.mergeCommit && receipt.verified === integrated.head && receipt.head === candidate &&
    receipt.planDigest === identity.planDigest && receipt.plan === identity.plan && receipt.base === identity.policyRevision &&
    receipt.receiptSha256 === closure.receiptSha256 && same(receipt.prFixLineage, fix) && same(receipt.reviewProof, reviewProof) &&
    (completion ? same(receipt.taskCompletion, { reviewedParent: completion.reviewedParent,
      acceptanceChild: completion.acceptanceChild, taskIds: completion.taskIds }) : !receipt.taskCompletion), "Closure receipt does not bind the accepted implementation and integrated gates");
  if (!closure.gate) return observe(result("verify-closure", "FULL_ARCHIVE_TEST_PENDING", { head: closure.head }));
  const gates = grant.closureGates;
  need(Array.isArray(gates) && gates.some((argv) => same(argv, ["npm", "test"])), "Full archive npm test must be a declared closure gate");
  const closureGate = gatePass(closure.gate, records, identity, closure.head, gates);
  if (!closureGate.passed) {
    return observe(stop("CLOSURE_GATE_FAILED", { head: closure.head }));
  }
  if (!closureReviewPass(remote.closureReview, identity, grant, { ...closure, gateObservedAt: closureGate.observedAt }, anchor.implementationReview) ||
      !(time(remote.closureReview.observedAt) <= now)) {
    return observe(result("review-closure", "EXACT_CLOSURE_REVIEW_PENDING", { head: closure.head }));
  }
  if (policy.proofLevel) {
    closureReviewProof = await verifyGovernedReview({ policy, identity, records, readback: remote.closureReview,
      handover: remote.closureReview.handover, head: closure.head, base: integrated.head, gate: closureGate,
      host: anchor.hostConfigurationSha256, finishReference: grant.reference, verifyHandover });
    need(!fix || closureReviewProof.session !== fix.deltaReview.session && closureReviewProof.reference !== fix.deltaReview.reference,
      "Closure review must use independent evidence from the PR-fix review");
  }
  if (policy.lowTouch && ["ABSENT", "OPEN"].includes(remote.closure?.state)) {
    const harness = verifyReviewHostHarness(policy, { hostConfiguration: input.hostConfiguration, harness: closure.harness,
      candidate: closure.head, excluded: [repo, workspace], now });
    need(input.hostConfiguration.sha256 === anchor.hostConfigurationSha256 &&
      (!harness || remote.closureReview.harnessSha256 === harness.sha256 &&
        time(harness.observedAt) <= time(remote.closureReview.observedAt)), "Closure review host or harness binding differs");
  }
  const closed = await verifyReadyPublication(publication(identity, grant, remote, "closure", closure.head, checkpoint, now, triggerPolicy, credits),
    remote.closure, records);
  if (closed.decision) return checkedDecision(closed.decision);
  if (!(await protectedEvidence(closed.merged, records))) {
    return observe(stop("PROTECTED_MERGE_EVIDENCE_UNVERIFIED", { pr: closed.merged.url }));
  }
  ancestor(repo, closure.head, closed.merged.mergeCommit);
  await verifyArchive({ ...archive, head: closed.merged.mergeCommit });
  const issue = remote.issue;
  const acceptance = { archive: closure.archive, closureMerge: closed.merged.mergeCommit, receiptSha256: closure.receiptSha256 };
  const archived = { ...acceptance, archiveAccepted: true, pr: closed.merged.url, prState: "MERGED", head: closure.head,
    required: closed.merged.requiredCheckIds.map((id) => ({ id, state: "passed" })) };
  if (identity.issue !== null) {
    if (!bound(issue, identity, grant) || issue.url !== identity.issue || !same(issue.acceptance, acceptance) ||
        !["OPEN", "CLOSED"].includes(issue.state)) return observe(stop("ISSUE_ACCEPTANCE_READBACK_PENDING", archived));
    if (issue.state === "OPEN") return observe(result("close-issue", null, { ...archived, issue: issue.url, issueState: "OPEN" }));
  }
  const settled = { ...archived, issueState: identity.issue === null ? "not-applicable" : issue.state };
  if (!bound(remote.worktrees, identity, grant) || remote.worktrees.complete !== true) {
    return observe(stop("WORKTREE_OWNERSHIP_PENDING", settled));
  }
  if (input.restrictions?.keepWorktree === true && !checkpoint.keepWorktree) {
    return observe(stop("KEEP_WORKTREE_CHECKPOINT_PENDING", settled));
  }
  let worktrees;
  try {
    worktrees = retirementInventory({ repo, repository, change, target: closed.merged.mergeCommit,
      ownership: remote.worktrees.entries, writers: remote.worktrees.writers,
      keepWorktree: checkpoint.keepWorktree });
  } catch (error) {
    return observe(stop("WORKTREE_OWNERSHIP_UNVERIFIED", { ...settled, detail: error.message }));
  }
  const sync = skillSyncDecision({ proposal: input.skillSync, release: remote.release, identity, acceptance, records,
    finishReference: grant.reference });
  const fields = { ...settled, worktrees, sync };
  if (worktrees.some(({ state }) => state === "eligible")) return observe(result("retire-worktrees", null, fields));
  if (worktrees.some(({ state }) => state === "blocked")) return observe(stop("WORKTREE_CLEANUP_BLOCKED", fields));
  return observe(result("closed", null, fields));
}

export function skillSyncDecision({ proposal, release, identity, acceptance, records, finishReference }) {
  if (!proposal) return observed(release) && same(release.identity, identity) && same(release.acceptance, acceptance) &&
    ["published", "deployment-inapplicable"].includes(release.state) && sha(release.source?.revision) ?
    result("select-sync", "SYNC_SELECTION_PENDING", { source: release.source }) : null;
  const { client, profile, source, packages } = proposal;
  const pause = (reason) => result("sync-pending", reason);
  if (!observed(release) || !same(release.identity, identity) || !same(release.acceptance, acceptance) ||
      !sha(source?.revision) || !same(release.source, source) || !["published", "deployment-inapplicable"].includes(release.state) ||
      !["codex", "hermes"].includes(client) || !text(profile) || !Array.isArray(packages) || !packages.length ||
      (client === "codex" ? !path.isAbsolute(profile) || path.normalize(profile) !== profile || /[\u0000-\u001f\u007f]/.test(profile) :
        !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(profile)) ||
      !packages.every((pkg) => /^[a-z][a-z0-9-]*$/.test(pkg?.name) && digest(pkg.sha256) &&
        text(pkg.version) && (pkg.metadataVersion === null || text(pkg.metadataVersion))) ||
      new Set(packages.map(({ name }) => name)).size !== packages.length ||
      (client === "hermes" ? release.state !== "published" || source.route !== "scanner-managed" :
        source.route !== "reviewed-native-copy" || release.reviewed !== true) ||
      !same(release.packages, packages)) return pause("SYNC_PROVENANCE_UNVERIFIED");
  const selection = { client, profile, source, packages };
  if (client === "codex" && !same(release.nativeUpdatePackages, packages)) return pause("NATIVE_INSTALLER_SCOPE_MISMATCH");
  const offer = { ...selection, command: client === "codex" ?
    ["npm", "run", "install:local", "--", "--update", "--client", "codex", "--user-home", profile] : null,
    execution: "operator-controlled-outside-project-session", verification: ["complete-package-bytes", "skill-versions", "fresh-session"] };
  if (!proposal.authority) return result("offer-sync", "SEPARATE_SYNC_AUTHORITY_PENDING", offer);
  let authority;
  try { authority = retainedFile(records, proposal.authority); }
  catch { return pause("SEPARATE_SYNC_AUTHORITY_PENDING"); }
  if (!observed(authority) || authority.kind !== "post-release-skill-sync" || [release.reference, finishReference].includes(authority.reference) ||
      !same(authority.selection, selection) || !same(authority.identity, identity) || !same(authority.acceptance, acceptance)) {
    return pause("SEPARATE_SYNC_AUTHORITY_PENDING");
  }
  if (proposal.observation) {
    let readback;
    try { readback = retainedFile(records, proposal.observation); }
    catch { return pause("SYNC_VERIFICATION_BLOCKED"); }
    if (!observed(readback) || !same(readback.selection, selection) || readback.authorityReference !== authority.reference ||
        readback.collisionFree !== true || readback.backupOutsideDiscovery !== true ||
        (client === "hermes" ? readback.scanner !== "accepted" : readback.provenance !== "reviewed-native-copy") ||
        !same(readback.installedPackages, packages) || readback.freshSession !== true) return pause("SYNC_VERIFICATION_BLOCKED");
    return result("sync-verified", null, offer);
  }
  return result("operator-sync-ready", null, offer);
}
