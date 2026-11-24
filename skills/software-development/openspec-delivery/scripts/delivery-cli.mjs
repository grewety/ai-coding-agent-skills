#!/usr/bin/env node
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { ancestor, candidate, commit, draftPolicyContext, goalSnapshot, integratedPolicyContext, planning, policyContext } from "./change-guard.mjs";
import { reconcileWorkspace, sourceObservation } from "./change-workspace.mjs";
import { contractChangePaths, resolveDeliveryPolicy, workerContinuationDecision } from "./delivery-policy.mjs";
import { deliveryDecision, goalContractIdentity, readGoalContract } from "./delivery-control.mjs";
import { deliveryStatus, preflight } from "./delivery-status.mjs";
import { evidenceCommand } from "./evidence-cli.mjs";
import { readBounded, readJson, scopedPath, separate, sha256, stableJson } from "./evidence-retention.mjs";
import { planningLayout } from "./planning-inventory.mjs";
import { finishReadiness } from "./finish-readiness.mjs";
import { discovery, externalVerificationDecision, pushTriggerDecision, reserveExternalRun, uiAcceptanceDecision } from "./external-verification.mjs";
import { readDelegation, verifyPairedReview, verifyWorkerScope } from "./delegated-delivery.mjs";

const need = (condition, message) => { if (!condition) throw new Error(message); };
const digest = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const utf8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
function retainedJson({ file, sha256: expected }) {
  const bytes = readBounded(file);
  need(digest(expected) && sha256(bytes) === expected, "Retained observation file identity mismatch");
  return JSON.parse(utf8.decode(bytes));
}

function inspectPolicy(input) {
  const { repo, change, plan, parent, target, selection, declaredContractPaths, deliveryBoundary,
    contractDesignations = [], phase = "execute", legacy, recovery, orchestrationAvailable, reviewAcceptance } = input;
  const draft = phase === "freeze" && !plan;
  const context = draft ? draftPolicyContext({ repo, change, parent, target }) :
    policyContext({ repo, change, plan, target }, { allowUnintegratedParent: phase === "execute" && Boolean(legacy || recovery) });
  const policy = resolveDeliveryPolicy({ phase, context, selection: { ...selection, goalFirst: context.goalFirstOptIn },
    contractPaths: contractChangePaths({ declared: [], changed: context.changedPaths, designations: contractDesignations }),
    declaredContractPaths, deliveryBoundary, legacy, recovery, orchestrationAvailable, reviewAcceptance });
  let goal = null;
  if (policy.mode === "goal-first") {
    if (draft) {
      const relative = `${planningLayout(change).directory}/proposal.md`;
      const proposal = readBounded(path.join(repo, relative), 4 * 1024 * 1024);
      need(sha256(proposal) === context.inputs[relative], "Draft proposal changed after inventory");
      const fields = { contract: readGoalContract(utf8.decode(proposal)), inputs: context.inputs, taskCount: context.taskCount };
      goal = { ...fields, digest: goalContractIdentity({ change, policyRevision: policy.policyRevision, ...fields }) };
    } else goal = goalSnapshot(repo, plan, change, policy.policyRevision);
  }
  return { policy, context, goal, planDigest: draft ? null : goal?.digest ?? context.planDigest };
}

async function companion(entry, filename) {
  const selected = scopedPath(entry.verifier);
  need(path.basename(selected) === filename && digest(entry.verifierSha256) &&
    sha256(readBounded(selected, 1024 * 1024)) === entry.verifierSha256, "Companion verifier identity mismatch");
  return import(pathToFileURL(selected).href);
}

export async function verifyHandover(input, pinnedReviewCommand) {
  if (input.kind === "review-candidate") {
    const reviewCommand = pinnedReviewCommand ?? (await companion(input, "review-candidate.mjs")).reviewCommand;
    const { request, expect, exportDirectory, output } = input;
    const requestBytes = readBounded(request, 1024 * 1024);
    need(digest(input.requestFileSha256) && sha256(requestBytes) === input.requestFileSha256,
      "Reviewer request file identity mismatch");
    const requestRecord = JSON.parse(utf8.decode(requestBytes));
    const expectBytes = readBounded(expect, 1024 * 1024);
    if (input.expectFileSha256 !== undefined) {
      need(digest(input.expectFileSha256) && sha256(expectBytes) === input.expectFileSha256, "Reviewer expectation file identity mismatch");
    }
    const expectation = JSON.parse(utf8.decode(expectBytes));
    need(requestRecord.mode === "candidate" && expectation.requestSha256 === sha256(`${stableJson(requestRecord)}\n`),
      "Expected independently retained candidate review request");
    const verified = await reviewCommand(["--verify", "--request", request, "--expect", expect, "--export", exportDirectory, "--output", output]);
    need(verified.phase === "complete" && verified.result?.identity?.role === "reviewer" &&
      stableJson(requestRecord.worker.identity) === stableJson(verified.result.identity) &&
      verified.result.runtime?.session === requestRecord.session && verified.sessions?.[1] === requestRecord.session &&
      readBounded(request, 1024 * 1024).equals(requestBytes) && readBounded(expect, 1024 * 1024).equals(expectBytes),
    "Reviewer request or runtime identity differs from its handover");
    return { ...verified, request: requestRecord.worker, reviewSnapshot: requestRecord.snapshot };
  }
  const { readClosed, readHandoff, requestBytes, validateRequest } = await companion(input, "worker-handoff.mjs");
  const { expected, runtime } = input;
  if (input.kind === "active-attempt") {
    validateRequest(expected.request);
    const identity = expected.request.identity;
    const directory = scopedPath(expected.directory);
    need(expected.request.evidenceRoots.includes(directory) && input.activeFile === path.join(directory, "active.json"),
      "Active attempt is outside its retained evidence root");
    const req = await readClosed(path.join(directory, "request.md"), 1024 * 1024, true);
    need(sha256(req) === expected.requestSha256 && req.equals(requestBytes(expected.request)), "Active request identity mismatch");
    const bytes = await readClosed(input.activeFile, 1024 * 1024, true);
    need(sha256(bytes) === input.activeSha256, "Active observation seal mismatch");
    const active = JSON.parse(utf8.decode(bytes));
    need(active.schemaVersion === 1 && active.kind === "active-attempt-observation" &&
      ["working", "waiting"].includes(active.state) &&
      stableJson(active.identity) === stableJson(identity) && active.requestSha256 === expected.requestSha256 &&
      active.session === runtime?.session && typeof active.session === "string" && active.session.length > 0 &&
      active.session !== expected.request.authority.orchestrator &&
      (identity.role === "implementer" || (runtime.readOnly === true && active.session !== identity.implementerSession &&
        active.session !== expected.request.authority.authorSession)), "Active observation identity or provenance mismatch");
    return { request: expected.request, active, deliveryAccepted: false };
  }
  need(input.kind === "portable-role", "Unknown handover route");
  return { ...await readHandoff({ expected, runtime }), request: expected.request };
}

function nativeGroups(input, evaluation, workspace) {
  const record = input.taskGuidance;
  if (evaluation.policy.mode !== "task-guided" || !record) return undefined;
  need(record.verified === true && typeof record.reference === "string" && record.reference &&
    record.planDigest === evaluation.context.planDigest && Array.isArray(record.groups), "Unverified frozen task guidance");
  const { plan, change } = evaluation.context;
  const { taskStates } = planning(input.repo, plan, change);
  const head = workspace?.head ?? plan;
  const current = planning(workspace?.workspace ?? input.repo, head, change);
  need(current.digest === record.planDigest && stableJson(taskStates.map((task) => task.id)) ===
    stableJson(record.groups.flatMap((group) => group.taskIds)) && taskStates.every((task) => task.id) &&
    new Set(taskStates.map((task) => task.id)).size === taskStates.length, "Frozen task guidance does not cover native tasks in order");
  const states = new Map(current.taskStates.map(({ id, checked }) => [id, checked]));
  return record.groups.map((group) => {
    const { taskIds } = group;
    need(Array.isArray(taskIds) && taskIds.length > 0 && Array.isArray(group.gates) && group.gates.length > 0, "Incomplete frozen group gates or tasks");
    const acceptance = record.acceptedGroups?.find((entry) => entry.id === group.id);
    let accepted = false;
    if (acceptance) {
      const repo = workspace?.workspace ?? input.repo;
      need(acceptance.verified === true && acceptance.planDigest === record.planDigest &&
        typeof acceptance.reviewReference === "string" && !!acceptance.reviewReference && digest(acceptance.gateReference),
      "Missing exact accepted group provenance");
      const reviewed = commit(repo, acceptance.candidateSha);
      ancestor(repo, plan, reviewed);
      ancestor(repo, reviewed, head);
      const verified = planning(repo, reviewed, change);
      accepted = verified.digest === record.planDigest && taskIds.every((task) => verified.taskStates.some(({ id, checked }) => id === task && checked));
      need(accepted, "Accepted group evidence lacks reviewed native task progress");
    }
    return { ...group, completed: accepted && taskIds.every((task) => states.get(task) === true) };
  });
}

function checkedPreflight(input, policy, delegation) {
  const observations = input.preflight ?? {};
  const { branch, remote } = observations.live ?? {};
  let source;
  if (typeof branch === "string" && typeof remote === "string") {
    try { source = sourceObservation({ repo: input.repo, targetBranch: branch, remote }); } catch { /* P3 reports blocked. */ }
  }
  return preflight(observations, source, policy, delegation ? {
    repository: delegation.repository, configuration: delegation.roles.pair.reviewer.configuration.sha256,
    inventory: delegation.reviewerInventorySha256,
  } : null);
}

async function inspectPredecessor(input, delegation, implementation, taskGroups, options) {
  const { continuation: control, id, owner, directory, state, grant, request } = delegation;
  if (id.predecessor === null) return;
  need(control.schemaVersion === 1 && control.kind === "exclusive-runtime-continuation" &&
    control.change === id.change && control.plan === id.plan && control.planDigest === id.planDigest &&
    control.orchestrator === request.authority.orchestrator && control.previousAttempt === id.predecessor &&
    control.attempt === id.attempt && control.task === id.task, "Delegated continuation identity differs");
  const pin = input.delegation.predecessor;
  need([input.repo, id.workspace, directory, ...request.evidenceRoots].every((root) => separate(root, pin?.path)),
    "Predecessor observations must be independently retained");
  const prior = await state.trustedJson(pin);
  const cap = control.reason === "native-turn-cap";
  need(prior.deliveryPhase === (cap ? "boundary" : "result") && prior.repo === input.repo && prior.plan === id.plan &&
    prior.target === input.target && prior.change === id.change && prior.workspace === id.workspace &&
    prior.approval?.reference === input.approval?.reference &&
    prior.delegation?.runtimeSha256 === input.delegation.runtimeSha256 &&
    prior.delegation?.verifier === input.delegation.verifier &&
    stableJson(prior.taskGuidance?.groups) === stableJson(input.taskGuidance?.groups) &&
    (!prior.restrictions?.noCommits || input.restrictions?.noCommits) &&
    (prior.restrictions?.group === null || prior.restrictions?.group === input.restrictions?.group) &&
    (cap || prior.head === implementation.head),
  "Predecessor request differs from the retained delivery boundary");
  const evaluated = await deliveryEvaluation(prior, options);
  const previous = evaluated.delegation;
  need(previous?.result && previous.id.attempt === id.predecessor && previous.owner.claimId === owner.claimId &&
    previous.resultSha256 === control.priorResultSha256 && previous.settlementSha256 === control.priorSettlementSha256,
  "Predecessor has no exact verified settlement and result");
  need(previous.release?.settlementSha256 === previous.settlementSha256 && digest(previous.release?.releaseSha256),
    "Original role slot has no verified release");
  const previousReviewer = previous.roles.pair.reviewer;
  const newReviewer = delegation.roles.pair.reviewer;
  const { session: originalSession, ...originalReviewer } = previousReviewer;
  const { session: nextSession, ...nextReviewer } = newReviewer;
  need(originalSession !== nextSession && stableJson(originalReviewer) === stableJson(nextReviewer) &&
    stableJson(previous.roles.pair.implementer) === stableJson(delegation.roles.pair.implementer) &&
    Object.entries(grant.limits).every(([key, value]) => value <= previous.grant.limits[key]) &&
    grant.expiresAt <= previous.grant.expiresAt &&
    evaluated.policy.mode === grant.mode &&
    ["minutesUsed", "correctionsUsed"].every((key) => input.observed?.[key] >= prior.observed?.[key]) &&
    (previous.id.task !== id.task || input.observed?.groupMinutesUsed >= prior.observed?.groupMinutesUsed) &&
    (!previous.verifiedGrant.commits ? !delegation.verifiedGrant.commits : true) &&
    (previous.noCommits !== true || delegation.noCommits === true), "Successor widened its retained role, limits or restrictions");
  if (control.reason === "ordered-successor") {
    const predecessor = taskGroups?.find((group) => group.taskIds.includes(previous.id.task));
    const acceptance = input.taskGuidance?.acceptedGroups?.find((entry) => entry.id === predecessor?.id);
    need(predecessor?.completed && evaluated.decision.action === "accept-result" && previous.id.task !== id.task &&
      evaluated.decision.head === control.acceptedCandidate && acceptance?.candidateSha === control.acceptedCandidate &&
      acceptance.gateReference === evaluated.decision.gateReference &&
      acceptance.reviewReference === evaluated.handoff?.result.report.sha256 &&
      grant.accepted.some((entry) => entry.task === previous.id.task && entry.candidate === control.acceptedCandidate),
    "Accepted predecessor gates and exact independent review are required");
  } else if (control.reason === "review-correction") {
    const original = previous.request;
    need(evaluated.decision.action === "correct" && previous.id.task === id.task &&
      control.rejectedCandidate === implementation.head && control.reviewSha256 === evaluated.decision.retain &&
      delegation.history.filter((launch) => launch.task === id.task && launch.transition === "review-correction").length < grant.limits.corrections &&
      ["outcome", "scope", "acceptance", "stop"].every((key) => stableJson(request[key]) === stableJson(original[key])) &&
      request.mutablePaths.every((file) => original.mutablePaths.includes(file)) &&
      ["nonGoals", "restrictions"].every((key) => original[key].every((value) => request[key].includes(value))) &&
      request.budget.unit === original.budget.unit && request.budget.limit <= original.budget.limit &&
      control.inScopeFinding === true, "Exact in-scope correction evidence is missing");
  } else {
    need(cap && evaluated.decision.reason === "NATIVE_TURN_CAP" && previous.id.task === id.task &&
      control.verifiedProgress === true && control.progressSha256 === previous.progressSha256 &&
      digest(previous.progressSha256), "Original native cap and progress are unverified");
    verifyCapContinuation(input, delegation, previous, implementation);
  }
}

function verifyCapContinuation(input, delegated, prior, implementation) {
  const boundary = ({ request }) => ({
    change: request.identity.change, group: request.identity.group, task: request.identity.task,
    action: request.identity.action, workspace: request.identity.workspace, plan: request.identity.plan,
    planDigest: request.identity.planDigest, role: request.identity.role, outcome: request.outcome,
    stop: request.stop, authorityReference: request.authority.approvalReference, acceptance: request.acceptance,
    scope: request.scope, restrictions: request.restrictions, budget: request.budget,
    mutablePaths: request.mutablePaths, nonGoals: request.nonGoals,
  });
  const before = boundary(prior);
  const process = { pid: prior.process.pid, startIdentity: `${prior.process.boot}/${prior.process.namespace}/${prior.process.start}`,
    treeIdentity: prior.launch.nonce, session: prior.result.runtime.session };
  const quiescence = { process, reference: prior.settlementSha256, method: "terminated", terminationVerified: true,
    identityReadback: { verified: true, immediate: true, process, reference: prior.settlementSha256 } };
  const { observed } = input;
  const alreadyContinued = delegated.history.some((launch) => launch.task === delegated.id.task && launch.transition === "native-turn-cap");
  need(!alreadyContinued, "Native action continuation already consumed");
  const decision = workerContinuationDecision({
    actor: delegated.request.authority.orchestrator, orchestrator: prior.request.authority.orchestrator,
    before, after: boundary(delegated),
    nativeTasks: planning(implementation.workspace, implementation.head, delegated.id.change).taskStates
      .map(({ id, checked }) => ({ id, group: id?.split(".")[0], completed: checked })),
    history: [], historyVerified: true,
    previousSession: process.session, nextAttempt: delegated.id.attempt, cappedProcess: process,
    observed: { status: "capped", identityVerified: true, session: process.session,
      onTrack: observed?.onTrack, unfinishedAction: delegated.id.task, nativePrompt: false, failedGate: observed?.failedGate,
      drift: false, contradictory: false, stopReached: observed?.stopReached, progressReference: prior.progressSha256,
      acceptance: delegated.request.acceptance, qualifiedRoute: prior.roles.pair.implementer.route,
      nextQualifiedRoute: delegated.roles.pair.implementer.route, readOnly: false, quiescence,
      groupBudgetRemaining: delegated.grant.limits.groupMs / 60000 - observed?.groupMinutesUsed,
      authorityBudgetRemaining: delegated.grant.limits.totalMs / 60000 - observed?.minutesUsed },
  });
  need(decision.action === "continue-worker", decision.reason);
}

async function readDeliveryHandover(input, { context, policy, identity, snapshot, current, delegation }) {
  const delegated = Boolean(delegation);
  if (delegated) need(input.handover.kind === "review-candidate" && digest(input.handover.expectFileSha256) &&
    input.handover.verifier === path.join(delegation.scripts, "review-candidate.mjs") &&
    input.handover.verifierSha256 === delegation.reviewVerifierSha256 && input.handover.reviewSessionBinding,
  "Delegated delivery requires its pinned contained reviewer");
  const handoff = await verifyHandover(input.handover, delegation?.reviewCommand);
  const id = handoff.request.identity;
  need(id.change === identity.change && id.plan === identity.plan &&
    id.planDigest === (delegated && policy.mode === "goal-first" ? context.planDigest : identity.planDigest) &&
    id.attempt === input.attempt?.id &&
    handoff.request.authority.approvalReference === input.approval?.reference &&
    handoff.request.authority.executionReference === input.grant?.reference,
  "Handover is outside the retained active candidate or authority");
  if (handoff.reviewSnapshot) {
    const review = handoff.reviewSnapshot;
    need((input.deliveryPhase === "result" || delegated && input.deliveryPhase === "correction") &&
      (policy.mode === "task-guided" || delegated) && snapshot &&
      id.candidate === snapshot.head && review.target === snapshot.head && review.base === context.plan &&
      review.plan === context.plan && review.planDigest === context.planDigest &&
      stableJson(id.inputs) === stableJson(context.inputs) &&
      separate(id.workspace, identity.workspace) && separate(id.workspace, input.repo),
    "Contained review does not cover the full approved candidate from an isolated checkout");
    if (delegated) {
      need([input.handover.request, input.handover.expect, input.handover.exportDirectory, input.handover.output]
        .every((location) => [input.repo, identity.workspace, id.workspace, delegation.directory,
          ...delegation.request.evidenceRoots].every((root) => separate(root, location))),
      "Reviewer evidence overlaps mutable or protected assignment state");
      await verifyPairedReview(delegation, handoff, input);
      if (policy.mode === "goal-first") {
        need(handoff.request.acceptance.includes(`goal-contract:${identity.planDigest}`),
          "Contained review is missing the exact Goal Contract binding");
        handoff.goalContractDigest = identity.planDigest;
      }
    }
  } else {
    need(id.workspace === identity.workspace &&
      (id.role === "reviewer" ? snapshot && id.candidate === snapshot.head && stableJson(id.inputs) === stableJson(current.inputs) :
        id.role === "implementer" && id.candidate === null && stableJson(id.inputs) === stableJson(context.inputs)),
    "Portable handover does not match the active checkout or inputs");
  }
  return handoff;
}

async function deliveryEvaluation(input, options) {
  const evaluation = inspectPolicy({ ...input, phase: "execute" });
  const { policy, context, goal, planDigest } = evaluation;
  const workspace = reconcileWorkspace({ ...input, base: context.parent });
  const implementation = workspace.implementation;
  if (implementation) ancestor(implementation.workspace, context.plan, implementation.head);
  const identity = { change: context.change, plan: context.plan, planDigest, workspace: implementation?.workspace ?? null };
  const candidateRequest = implementation && input.head ? { repo: implementation.workspace, base: context.parent,
    head: input.head, plan: context.plan, change: context.change, mode: policy.mode, target: context.target, "expect-plan": planDigest } : null;
  let snapshot = null;
  let current = null;
  let candidateFailure = null;
  try {
    if (candidateRequest) {
      const verified = candidate(candidateRequest);
      current = planning(implementation.workspace, verified.head, context.change);
      snapshot = { ...verified, change: context.change, workspace: implementation.workspace, taskIds: current.taskStates.map(({ id }) => id) };
    }
  } catch (error) { candidateFailure = error.message; }
  let handoff = null;
  let invalidHandover = false;
  let delegation = null;
  let delegationFailure = null;
  const delegated = context.delegatedRuntime || input.selection?.delegatedRuntime === true ||
    input.grant?.delegatedRuntime === true || input.delegation !== undefined;
  const groups = implementation && nativeGroups(input, evaluation, implementation);
  if (delegated && implementation && input.restrictions?.inspect !== true) {
    try {
      delegation = await readDelegation(input, { context, policy, identity, implementation, goal }, options?.registry);
      if (input.deliveryPhase === "dispatch") await inspectPredecessor(input, delegation, implementation, groups, options);
    } catch (error) { delegationFailure = { action: "stop", reason: "DELEGATED_RUNTIME_UNVERIFIED", detail: error.message }; }
    if (delegation && !delegationFailure && input.deliveryPhase !== "dispatch") {
      if (!delegation.result) {
        const reasons = { "operator-input": "HUMAN_INPUT_PENDING", running: "ORIGINAL_ATTEMPT_ACTIVE",
          settling: "ORIGINAL_SETTLEMENT_PENDING", "recovery-pending": "ORIGINAL_RECOVERY_PENDING" };
        delegationFailure = { action: "stop", reason: reasons[delegation.phase] ?? "OWNERSHIP_UNVERIFIED" };
      } else {
        try {
          await verifyWorkerScope(delegation, snapshot, implementation);
        } catch (error) { delegationFailure = { action: "stop", reason: "POST_WORKER_SCOPE_UNVERIFIED", detail: error.message }; }
        if (!delegationFailure && delegation.result.status !== "completed") delegationFailure = { action: "stop",
          reason: delegation.reason === "native-turn-cap" ? "NATIVE_TURN_CAP" : "DELEGATED_WORKER_STOPPED", detail: delegation.reason };
      }
    }
  }
  const reviewContext = { context, policy, identity, snapshot, current, delegation };
  if (!delegated && input.handover && input.restrictions?.inspect !== true) {
    try { handoff = await readDeliveryHandover(input, reviewContext); }
    catch { invalidHandover = true; }
  }
  let decision;
  if (input.restrictions?.inspect === true) decision = { action: "inspect", reason: null };
  else if (!implementation) decision = { action: "queue", reason: "DEDICATED_WORKSPACE_PENDING" };
  else if (input.deliveryPhase === "dispatch" && implementation.dirty) decision = { action: "stop", reason: "WORKSPACE_DIRTY" };
  else if (candidateFailure) {
    decision = /Goal Contract|Approved plan digest|Planning content|Native outcome task/.test(candidateFailure) ?
      { action: "stop", reason: "DIRECTION_DRIFT_CHOICE", clause: /scope/.test(candidateFailure) ? "scope" :
        policy.mode === "goal-first" ? "goal-contract" : "frozen-plan", detail: candidateFailure } :
      { action: "stop", reason: "CANDIDATE_IDENTITY_UNVERIFIED", detail: candidateFailure };
  } else if (delegationFailure) decision = { ...delegationFailure, commits: false, remoteWrites: false, tasksComplete: false };
  else if (invalidHandover || (input.attempt?.id && !handoff && !(delegated && input.handover) && input.attempt.id !== delegation?.id.attempt)) {
    decision = { action: "stop", reason: "HANDOVER_UNVERIFIED" };
  } else {
    const checked = input.deliveryPhase === "dispatch" ? checkedPreflight(input, policy, delegation) : null;
    let correctionAncestryVerified = false;
    try {
      const history = input.observed?.correctionHistory;
      if (Array.isArray(history) && history.length <= 200) {
        let previous = context.plan;
        for (const entry of history) {
          const rejected = commit(implementation.workspace, entry.rejectedSha);
          const successor = commit(implementation.workspace, entry.successorSha);
          ancestor(implementation.workspace, previous, rejected);
          ancestor(implementation.workspace, rejected, successor);
          ancestor(implementation.workspace, successor, snapshot?.head ?? implementation.head);
          previous = successor;
        }
        correctionAncestryVerified = true;
      }
    } catch { /* A missing or repinned correction boundary fails closed. */ }
    const active = delegation?.result?.runtime;
    const observations = { ...input.observed, preflightReady: checked?.ready, correctionAncestryVerified,
      humanInput: handoff?.active?.state === "waiting" ? "waiting" : input.observed?.humanInput };
    if (delegation) {
      observations.ownership = delegation.phase === "dispatch" ? "runtime-admission" : "exclusive";
      if (active) observations.activeAttempt = {
        group: groups?.find((group) => group.taskIds.includes(delegation.id.task))?.id ?? null,
        implementerSession: active.session,
      };
      if (snapshot) {
        const corrections = delegation.history.filter(({ transition }) => transition === "review-correction");
        const history = observations.correctionHistory;
        observations.delegatedCorrectionHistoryVerified = correctionAncestryVerified && history.length >= corrections.length &&
          (delegation.launch?.transition !== "review-correction" || history.some(({ rejectedSha, successorSha }) =>
            rejectedSha === delegation.grant.head && successorSha === snapshot.head));
      }
    }
    let gateRun;
    try { gateRun = input.gateRun ? retainedJson(input.gateRun) : null; }
    catch (error) { if (!delegated) throw error; }
    const grant = delegation ? { ...delegation.verifiedGrant,
      eligibleGroups: groups?.filter(({ taskIds }) => taskIds.some((task) => delegation.grant.eligibleTasks.includes(task)))
        .map(({ id }) => id) } : input.grant;
    const decisionInput = { phase: input.deliveryPhase, policy, identity, contract: goal,
      approval: delegation?.verifiedApproval ?? input.approval, grant,
      restrictions: input.restrictions, observed: observations, taskGroups: groups, candidate: snapshot,
      gateRun, handoff, delegated: delegation };
    decision = deliveryDecision(decisionInput);
    if (delegated && input.handover && decision.reason === "EXACT_REVIEW_PENDING") {
      try {
        handoff = await readDeliveryHandover(input, reviewContext);
        await verifyWorkerScope(delegation, snapshot, implementation);
        decision = deliveryDecision({ ...decisionInput, handoff });
      } catch {
        invalidHandover = true;
        decision = { action: "stop", reason: "HANDOVER_UNVERIFIED", commits: false, remoteWrites: false, tasksComplete: false };
      }
    }
  }
  return { policy, context, identity, snapshot, decision, handoff, invalidHandover, candidateRequest, delegation };
}

export async function deliveryCommand(command, input, options) {
  switch (command) {
    case "policy": {
      const { context, policy, planDigest, goal } = inspectPolicy(input);
      return { schemaVersion: 1, context, policy, planDigest, goalContractDigest: goal?.digest ?? null };
    }
    case "workspace": return reconcileWorkspace(input);
    case "preflight": {
      let policy;
      try {
        if (input.plan) policy = inspectPolicy(input).policy;
        else if (input.preflight?.live?.verified === true) {
          const context = integratedPolicyContext(input.repo, input.preflight.checkpoint?.policyRevision, input.preflight.live.head);
          policy = { policyRevision: context.parent };
        }
      } catch { /* P7 reports blocked. */ }
      return checkedPreflight(input, policy);
    }
    case "handover": {
      const verified = await verifyHandover(input);
      return { schemaVersion: 1, verified: true, identity: verified.request.identity, state: verified.active?.state ?? verified.result.status,
        verdict: verified.result?.verdict ?? null, deliveryAccepted: false };
    }
    case "discovery": return discovery(input);
    case "external": return externalVerificationDecision(input);
    case "reserve-external": return reserveExternalRun(input);
    case "push-triggers": return pushTriggerDecision(input);
    case "ui": return uiAcceptanceDecision(input);
    case "decision":
    case "finish-readiness":
    case "status": {
      if (command === "status" && !input.plan) return deliveryStatus({ change: input.change });
      let e;
      try {
        e = await deliveryEvaluation(command === "status" && input.restrictions?.inspect === true ?
          { ...input, restrictions: { ...input.restrictions, inspect: false } } : input, options);
      } catch (error) {
        if (command === "status") return deliveryStatus({ change: input.change, failure: true });
        throw error;
      }
      if (command === "decision") return { schemaVersion: 1, identity: e.identity, ...e.decision };
      const finish = e.candidateRequest && (command === "finish-readiness" || e.decision.action === "accept-result") ?
        finishReadiness(e.candidateRequest, e.decision) : null;
      if (command === "finish-readiness") return finish ?? { schemaVersion: 1, change: e.identity.change, head: null,
        ready: false, predicate: "CANDIDATE_IDENTITY_UNVERIFIED", issue: null, promoted: [] };
      let closure;
      let snapshot = e.snapshot;
      const closeout = input.closeout;
      if (closeout && closeout.expectedHead === input.head &&
          closeout.closureExpected?.archive?.endsWith(`-${e.identity.change}`)) {
        try {
          const checked = await evidenceCommand("assert-closeout", closeout);
          if (checked.ok && checked.assertions.some(({ predicate }) => predicate === "CLOSURE_PREDICATES_MET")) {
            const { context, policy } = e;
            // After retirement the immutable candidate can still be read by ID
            // from the primary checkout's shared object history.
            snapshot ??= { ...candidate({ repo: input.repo, base: context.parent, plan: context.plan, mode: policy.mode,
              target: context.target, head: input.head, change: context.change, "expect-plan": e.identity.planDigest }, false), change: context.change };
            if (snapshot.tasksComplete) closure = { verified: true, change: e.identity.change, candidateSha: snapshot.head };
          }
        } catch { /* Incomplete retained readback cannot prove closure. */ }
      }
      const context = input.phaseBoundary?.verified === true && input.phaseBoundary.attempt === input.attempt?.id ?
        input.phaseBoundary.contextHint : null;
      const attempt = input.attempt ?? (e.delegation?.id ? { id: e.delegation.id.attempt } : null);
      return deliveryStatus({ ...e, change: e.identity.change, candidate: snapshot, finish, closure, context,
        handoff: e.handoff ?? e.delegation, attempt: { ...attempt, invalid: e.invalidHandover } });
    }
    default: throw new Error("Unknown delivery command");
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [command, ...args] = process.argv.slice(2);
    const { values } = parseArgs({ args, options: { input: { type: "string", multiple: true }, json: { type: "boolean" } } });
    need(values.input?.length === 1, "Expected one --input JSON file");
    const result = await deliveryCommand(command, readJson(values.input[0]));
    writeFileSync(1, `${JSON.stringify(result)}\n`);
    if (result.ok === false) process.exitCode = 1;
  } catch (error) {
    writeFileSync(1, `${JSON.stringify({ schemaVersion: 1, ok: false, error: error.message })}\n`);
    process.exitCode = 1;
  }
}
