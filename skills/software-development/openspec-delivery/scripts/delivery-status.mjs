// Deterministic read-only status from verified producer observations.
const sha = (value) => typeof value === "string" && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value);
const digest = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const text = (value) => typeof value === "string" && value.trim().length > 0;
const changeName = (value) => typeof value === "string" && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value) && value !== "archive";
const attemptId = (value) => typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(value);
const retained = (value) => value?.verified === true && text(value.reference);

export function preflight({ live, auth, local, reviewer, reviewerSettings, relay, runtime, checkpoint, companions }, source, policy, delegation = null) {
  function matchInventory(actual, expected) {
    if (!actual || !expected || typeof actual !== "object" || typeof expected !== "object" ||
        Array.isArray(actual) || Array.isArray(expected)) return false;
    const wanted = Object.keys(expected).sort();
    return wanted.length > 0 && Object.keys(actual).length === wanted.length &&
      wanted.every((key) => digest(expected[key]) && actual[key] === expected[key]);
  }
  const direct = policy?.directReviewer === true;
  const entries = [
    ["P1", "live-target", live, () => text(live.remote) && text(live.branch) && text(live.repository) && sha(live.head) &&
      (!delegation || live.repository === delegation.repository)],
    ["P2", "repository-auth", auth, () => auth.authenticated === true && text(auth.repository) && auth.repository === live?.repository &&
      auth.requiredScopesPresent === true],
    ["P3", "local-baseline", local, () => sha(live?.head) && source && source.branch === `refs/heads/${live.branch}` &&
      source.head === live.head && source.targetHead === live.head && source.trackingHead === live.head && source.dirty === false && local.activeChangeInventoryVerified === true],
    ["P4", direct ? "reviewer-offline-preflight" : "reviewer-probe", reviewer, () => reviewer.outcome === "pass" &&
      (!direct || reviewer.transport === "direct-cli" && reviewer.packetFeasible === true &&
        reviewer.proofLevel === policy.proofLevel) && digest(reviewer.configurationSha256) &&
      reviewer.configurationSha256 === reviewer.expectedConfigurationSha256 && digest(reviewer.packageSha256) &&
      reviewer.packageSha256 === companions?.expected?.reviewer &&
      (!delegation || reviewer.configurationSha256 === delegation.configuration && reviewer.packageSha256 === delegation.inventory)],
    ["P5", direct ? "reviewer-settings" : "reviewer-relay", direct ? reviewerSettings : relay, () =>
      (direct ? reviewerSettings.ready === true && reviewerSettings.authentication === "normal-installed-client" &&
        reviewerSettings.configurationSha256 === reviewer?.configurationSha256 :
        relay.ready === true && relay.materialRetained === false &&
      relay.configurationSha256 === reviewer?.configurationSha256)],
    ["P6", "local-runtime", runtime, () => ["node", "openspec"].every((tool) => text(runtime[tool]) &&
      runtime[tool] === runtime.expected?.[tool]) && runtime.node === process.version],
    ["P7", "integrated-checkpoint", checkpoint, () => sha(checkpoint.head) && checkpoint.head === live?.head &&
      sha(policy?.policyRevision) && checkpoint.policyRevision === policy.policyRevision && checkpoint.prerequisitesVerified === true],
    ["P8", "companion-inventory", companions, () => matchInventory(companions.actual, companions.expected)],
  ];
  const items = entries.map(([id, name, value, test]) => ({
    id, name, state: !retained(value) ? "pending" : test() ? "pass" : "blocked",
    reference: retained(value) ? value.reference : null,
  }));
  const ready = items.every(({ state }) => state === "pass");
  const followUp = items.find(({ state }) => state !== "pass")?.id ?? null;
  return { schemaVersion: 1, ready, items, followUp,
    ...(direct ? { reviewerPreflight: items[3].state } :
      { reviewerProbeAuthority: items[3].state === "pass" ? "retained-probe" : "separate-grant-required" }) };
}

const reasonPattern = /^[A-Z][A-Z_]+$/;
export function deliveryStatus({ change, policy, identity, candidate, decision, attempt, handoff, finish, closure, context, failure } = {}) {
  const selected = changeName(change) ? change : null;
  const mode = selected && ["goal-first", "task-guided"].includes(policy?.mode) && sha(policy.policyRevision) ? policy.mode : null;
  const pinned = candidate?.change === selected && sha(candidate?.head) ? candidate.head : null;
  const planDigest = mode && identity?.change === selected && digest(identity.planDigest) ? identity.planDigest : null;
  const reviewed = finish?.prFixLineage?.head === pinned ? finish.prFixLineage.reviewedAncestor :
    finish?.taskCompletion?.acceptanceChild === pinned ? finish.taskCompletion.reviewedParent : pinned;
  const id = handoff?.result?.identity ?? handoff?.active?.identity;
  const boundAttempt = selected && id?.change === selected && (id.planDigest === planDigest || handoff.goalContractDigest === planDigest) &&
    (id.role === "reviewer" ? reviewed && id.candidate === reviewed : id.candidate === null) ? id.attempt : null;
  const activeAttemptId = boundAttempt === attempt?.id && attemptId(boundAttempt) ? boundAttempt : null;
  const contextHint = activeAttemptId && ["same-session", "fresh-session"].includes(context) ? context : null;

  const proofLevel = policy?.proofLevel;
  const proof = finish?.reviewProof ?? decision?.reviewProof ?? handoff?.reviewProof;
  const reviewProof = proofLevel && proof?.proofLevel === proofLevel && proof.reviewedHead === reviewed &&
    digest(proof.statusSha256) && digest(proof.reference) && text(proof.session) && typeof proof.zeroWaiver === "boolean" &&
    proof.coverage === (proofLevel === "receipt-only" ? "receipt-only" : "whole-file") ? proof : null;
  let state = selected ? "draft" : "unresolved";
  let stopPredicate = null;
  let code = selected ? "ASSESS_DRAFT" : "RESOLVE_CHANGE";
  if (selected && failure) {
    state = "blocked";
    stopPredicate = "DELIVERY_OBSERVATIONS_UNVERIFIED";
    code = "RESOLVE_STOP";
  } else if (selected && (attempt?.invalid === true || (attempt?.id && !activeAttemptId))) {
    state = "blocked";
    stopPredicate = attempt?.invalid === true || !reasonPattern.test(decision?.reason ?? "") ? "HANDOVER_UNVERIFIED" : decision.reason;
    code = stopPredicate === "HANDOVER_UNVERIFIED" ? "VERIFY_HANDOVER" : "RESOLVE_STOP";
  } else if (selected && pinned && closure?.verified === true && closure.candidateSha === pinned && closure.change === selected) {
    state = "closed";
    code = null;
  } else if (mode && planDigest) {
    if (!decision || decision.reason === "EXACT_APPROVAL_PENDING") {
      state = "approval-pending";
      stopPredicate = "EXACT_APPROVAL_PENDING";
      code = "RECORD_EXACT_APPROVAL";
    } else if (decision.reason === "EXACT_REVIEW_PENDING") {
      state = "result-review-pending";
      stopPredicate = decision.reason;
      code = "VERIFY_EXACT_RESULT_REVIEW";
    } else if (activeAttemptId && ["ORIGINAL_ATTEMPT_ACTIVE", "HUMAN_INPUT_PENDING"].includes(decision.reason) && handoff?.active) {
      state = "active";
      stopPredicate = decision.reason === "HUMAN_INPUT_PENDING" ? decision.reason : null;
      code = stopPredicate ? "WAIT_FOR_ORIGINAL_OPERATOR_INPUT" : "RESUME_BOUNDED_ATTEMPT";
    } else if (decision.action === "stop" || decision.action === "queue") {
      state = "blocked";
      stopPredicate = reasonPattern.test(decision.reason ?? "") ? decision.reason : "DELIVERY_OBSERVATIONS_UNVERIFIED";
      code = decision.reason === "LOCAL_AUTHORITY_PENDING" ? "RECORD_LOCAL_EXECUTION_GRANT" : "RESOLVE_STOP";
    } else if (decision.action === "accept-result" && reviewed === decision.head && proofLevel && reviewProof?.zeroWaiver !== true) {
      state = "blocked";
      stopPredicate = "REVIEW_PROOF_UNVERIFIED";
      code = "VERIFY_EXACT_RESULT_REVIEW";
    } else if (decision.action === "accept-result" && reviewed === decision.head) {
      state = "local-verified";
      code = "ASSESS_FINISH_READINESS";
      if (finish?.ready === true && finish.head === pinned && candidate.tasksComplete) {
        state = "finish-ready";
        code = "REQUEST_FINISH_AUTHORITY";
      } else if (finish?.predicate === "NATIVE_OUTCOME_PENDING" && finish.head === pinned) {
        code = "RECORD_NATIVE_PROGRESS";
      } else if (finish?.ready === false && finish.head === pinned) {
        state = "blocked";
        stopPredicate = reasonPattern.test(finish.predicate ?? "") ? finish.predicate : "FINISH_PRECONDITIONS_UNVERIFIED";
        code = "RESOLVE_STOP";
      }
    } else if (activeAttemptId || ["continue", "correct"].includes(decision.action)) {
      state = "active";
      code = decision.action === "correct" ? "APPLY_ROUTINE_CORRECTION" : "RESUME_BOUNDED_ATTEMPT";
    } else if (decision.action === "dispatch") {
      state = "local-ready";
      code = "START_AUTHORIZED_LOCAL_RUN";
    } else {
      state = "blocked";
      stopPredicate = "DELIVERY_OBSERVATIONS_UNVERIFIED";
      code = "RESOLVE_STOP";
    }
  }
  return { schemaVersion: 1, change: selected, mode, state, candidateSha: pinned, planDigest,
    ...(proofLevel ? { proofLevel, reviewProof } : {}),
    activeAttemptId, stopPredicate, contextHint, recommendedNextAction: code ? { code, subject: selected } : null };
}
