import path from "node:path";
import { lstatSync } from "node:fs";
import { ancestor, candidate as candidateSnapshot, committedDocument, exactTree, policyContext, proveTaskCompletion, verifyArchive } from "./change-guard.mjs";
import { retirementInventory } from "./change-workspace.mjs";
import { evidenceCommand } from "./evidence-cli.mjs";
import { readBounded, scopedPath, separate, sha256, verifyGateRun, verifyRepresentation } from "./evidence-retention.mjs";
import { verifyLocalHarness } from "./local-harness.mjs";
import { finishReadiness } from "./finish-readiness.mjs";
import { pushTriggerDecision, standingTriggerDecision, retainedExternalReservation, uiAcceptanceDecision } from "./external-verification.mjs";
import { need, observed, same, sealedObservation, text } from "./operator-records.mjs";

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

function eventInventory(entry, identity, grant, head, policy, events, notBefore, now) {
  return events.map(([event, target]) => standingTriggerDecision({ ...entry.eventInventories?.[event],
    candidate: head, repository: identity.repository, policy, event, target, finishReference: grant.reference, notBefore, now }));
}

function publication(identity, grant, remote, chapter, head, retained, now, policy) {
  const entry = remote?.[chapter];
  const state = (action, reason, fields) => ({ decision: result(action, reason, { chapter, head, prState: entry?.state, ...fields }) });
  if (!bound(remote, identity, grant) || !bound(entry, identity, grant) || entry.complete !== true ||
      entry.target !== identity.target || !(time(entry.observedAt) <= now && time(entry.observedAt) >= time(retained.observedAt) &&
        now - time(entry.observedAt) <= readbackWindow)) {
    return state("pause", "REMOTE_INVENTORY_UNVERIFIED");
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
        [["push", entry.sourceRef], ["pull_request", identity.target]], time(target.observedAt), now);
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
  if (entry.state === "MERGED" && sha(entry.mergeCommit)) return { merged: entry };
  if (entry.state !== "OPEN") return state("pause", "PR_STATE_UNVERIFIED");
  const checks = protectedCheckDecision({ ...entry.protectionReadback, pr: entry, head, deadline: retained.deadline, now });
  const protectedDecision = { ...checks, chapter, prState: entry.state };
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

export async function protectedFinish(input, readiness, now = Date.now(), verifyHandover) {
  const checkpoint = sealedObservation(input.finishCheckpoint);
  const { records, identity } = checkpoint;
  const { repo, repository, change, candidate, workspace } = identity;
  const read = (ref) => retainedFile(records, ref);
  const directory = lstatSync(scopedPath(records));
  need(checkpoint.schemaVersion === 1 && checkpoint.kind === "protected-finish-checkpoint" && observed(checkpoint) &&
    directory.isDirectory() && (process.getuid === undefined || directory.uid === process.getuid() && (directory.mode & 0o077) === 0) &&
    input.finishCheckpoint.file.startsWith(records + path.sep) &&
    separate(records, workspace) && separate(records, repo) && input.repo === repo && input.change === change && input.head === candidate &&
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
  const anchor = read(checkpoint.anchor);
  need(bound(anchor, identity, grant) && anchor.kind === "finish-readiness-readback" && anchor.ready === true &&
    observed(anchor.implementationReview) && text(anchor.implementationReview.session) &&
    digest(anchor.implementationGateSha256) && typeof anchor.keepWorktree === "boolean" &&
    (!anchor.keepWorktree || checkpoint.keepWorktree), "Original finish readiness or worktree restriction is unverified");
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
  if (policy.lowTouch) {
    need(anchor.implementationReview.head === (completion?.reviewedParent ?? candidate),
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
    need(parentGate.passed && parentGate.reference === completion.reviewedGateReference &&
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
      (!readiness.keepWorktree || checkpoint.keepWorktree) &&
      (completion ? readiness.taskCompletion && same(readiness.taskCompletion, {
        reviewedParent: completion.reviewedParent, acceptanceChild: completion.acceptanceChild, taskIds: completion.taskIds,
      }) : !readiness.taskCompletion),
      "Exact candidate finish readiness is required before publication");
  }

  const remote = read(input.finishRemote);
  need(bound(remote, identity, grant) && time(remote.observedAt) >= time(checkpoint.observedAt) &&
    time(remote.observedAt) <= now && now - time(remote.observedAt) <= readbackWindow, "Fresh finish readback is unverified");
  if (reply) {
    const current = checkpoint.prs.closure ? remote.closure : remote.implementation;
    need(time(remote.observedAt) >= time(reply.observedAt) && time(current?.observedAt) >= time(reply.observedAt),
      "Continue requires a new exact remote PR readback");
  }
  const observe = (value) => ({ ...value, identity, checkpoint: input.finishCheckpoint.file, checkpointSha256: input.finishCheckpoint.sha256,
    records, grantReference: grant.reference, deadline: checkpoint.deadline,
    readback: input.finishRemote.file, keepWorktree: checkpoint.keepWorktree || input.restrictions?.keepWorktree === true });
  if (policy.lowTouch && remote.implementation?.state === "ABSENT") {
    verifyLocalHarness({ hostConfiguration: input.hostConfiguration, harness: remote.implementation.harness,
      candidate, excluded: [repo, workspace], now });
    need(input.hostConfiguration.sha256 === anchor.hostConfigurationSha256, "Finish host binding changed");
  }
  const implementation = await verifyReadyPublication(publication(identity, grant, remote, "implementation", candidate, checkpoint, now, policy.lowTouch),
    remote.implementation, records);
  if (implementation.decision) return observe(implementation.decision);
  const merged = implementation.merged;
  if (!(await protectedEvidence(merged, records))) return observe(stop("PROTECTED_MERGE_EVIDENCE_UNVERIFIED", { pr: merged.url }));
  ancestor(repo, candidate, merged.mergeCommit);
  const integrated = remote.integrated;
  if (!bound(integrated, identity, grant) || integrated.mergeCommit !== merged.mergeCommit ||
      !sha(integrated.head) || !Array.isArray(grant.integratedGates) || !integrated.gate) {
    return observe(result("verify-integrated", "INTEGRATED_GATES_PENDING", { head: merged.head, integratedHead: merged.mergeCommit,
      pr: merged.url, prState: "MERGED" }));
  }
  ancestor(repo, merged.mergeCommit, integrated.head);
  if (!gatePass(integrated.gate, records, identity, integrated.head, grant.integratedGates).passed) {
    return observe(stop("INTEGRATED_GATE_FAILED", { head: integrated.head, pr: merged.url }));
  }
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
    integrationReference: merged.url };
  need(closure.receipt.sha256 === closure.receiptSha256, "Closure receipt declaration differs");
  const receipt = verifyArchive({ ...archive, head: closure.head });
  need(receipt.integrated === merged.mergeCommit && receipt.verified === integrated.head && receipt.head === candidate &&
    receipt.planDigest === identity.planDigest && receipt.plan === identity.plan && receipt.base === identity.policyRevision &&
    receipt.receiptSha256 === closure.receiptSha256 &&
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
  if (policy.lowTouch && ["ABSENT", "OPEN"].includes(remote.closure?.state)) {
    const harness = verifyLocalHarness({ hostConfiguration: input.hostConfiguration, harness: closure.harness,
      candidate: closure.head, excluded: [repo, workspace], now });
    need(input.hostConfiguration.sha256 === anchor.hostConfigurationSha256 &&
      (!harness || remote.closureReview.harnessSha256 === harness.sha256 &&
        time(harness.observedAt) <= time(remote.closureReview.observedAt)), "Closure review host or harness binding differs");
  }
  const closed = await verifyReadyPublication(publication(identity, grant, remote, "closure", closure.head, checkpoint, now, policy.lowTouch),
    remote.closure, records);
  if (closed.decision) return observe(closed.decision);
  if (!(await protectedEvidence(closed.merged, records))) {
    return observe(stop("PROTECTED_MERGE_EVIDENCE_UNVERIFIED", { pr: closed.merged.url }));
  }
  ancestor(repo, closure.head, closed.merged.mergeCommit);
  verifyArchive({ ...archive, head: closed.merged.mergeCommit });
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
