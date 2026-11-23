#!/usr/bin/env node
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { ancestor, candidate, commit, draftPolicyContext, goalSnapshot, integratedPolicyContext, planning, policyContext } from "./change-guard.mjs";
import { reconcileWorkspace, sourceObservation } from "./change-workspace.mjs";
import { contractChangePaths, resolveDeliveryPolicy } from "./delivery-policy.mjs";
import { deliveryDecision, goalContractIdentity, readGoalContract } from "./delivery-control.mjs";
import { deliveryStatus, preflight } from "./delivery-status.mjs";
import { evidenceCommand } from "./evidence-cli.mjs";
import { readBounded, readJson, scopedPath, sha256, stableJson } from "./evidence-retention.mjs";
import { planningLayout } from "./planning-inventory.mjs";
import { finishReadiness } from "./finish-readiness.mjs";
import { discovery, externalVerificationDecision, pushTriggerDecision, reserveExternalRun, uiAcceptanceDecision } from "./external-verification.mjs";

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

export async function verifyHandover(input) {
  if (input.kind === "review-candidate") {
    const { reviewCommand } = await companion(input, "review-candidate.mjs");
    const { request, expect, exportDirectory, output } = input;
    const requestBytes = readBounded(request, 1024 * 1024);
    need(digest(input.requestFileSha256) && sha256(requestBytes) === input.requestFileSha256,
      "Reviewer request file identity mismatch");
    const requestRecord = JSON.parse(utf8.decode(requestBytes));
    const verified = await reviewCommand(["--verify", "--request", request, "--expect", expect, "--export", exportDirectory, "--output", output]);
    need(verified.result?.identity?.role === "reviewer" && stableJson(requestRecord.worker.identity) === stableJson(verified.result.identity) &&
      readBounded(request, 1024 * 1024).equals(requestBytes), "Reviewer request identity differs from its handover");
    return { request: requestRecord.worker, ...verified };
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
  return record.groups.map(({ taskIds, ...group }) => {
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

function checkedPreflight(input, policy) {
  const observations = input.preflight ?? {};
  const { branch, remote } = observations.live ?? {};
  let source;
  if (typeof branch === "string" && typeof remote === "string") {
    try { source = sourceObservation({ repo: input.repo, targetBranch: branch, remote }); } catch { /* P3 reports blocked. */ }
  }
  return preflight(observations, source, policy);
}

async function deliveryEvaluation(input) {
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
  try {
    if (input.handover) {
      handoff = await verifyHandover(input.handover);
      const id = handoff.request.identity;
      need(id.change === identity.change && id.workspace === identity.workspace && id.plan === identity.plan &&
        id.planDigest === identity.planDigest && id.attempt === input.attempt?.id &&
        handoff.request.authority.approvalReference === input.approval?.reference &&
        handoff.request.authority.executionReference === input.grant?.reference &&
        (id.role === "reviewer" ? snapshot && id.candidate === snapshot.head && stableJson(id.inputs) === stableJson(current.inputs) :
          id.role === "implementer" && id.candidate === null && stableJson(id.inputs) === stableJson(context.inputs)),
      "Handover is outside the retained active candidate or authority");
    }
  } catch {
    handoff = null;
    invalidHandover = true;
  }
  let decision;
  if (input.restrictions?.inspect === true) decision = { action: "inspect", reason: null };
  else if (!implementation) decision = { action: "queue", reason: "DEDICATED_WORKSPACE_PENDING" };
  else if (input.deliveryPhase === "dispatch" && implementation.dirty) decision = { action: "stop", reason: "WORKSPACE_DIRTY" };
  else if (invalidHandover || (input.attempt?.id && !handoff)) decision = { action: "stop", reason: "HANDOVER_UNVERIFIED" };
  else if (candidateFailure) {
    decision = /Goal Contract|Approved plan digest|Planning content|Native outcome task/.test(candidateFailure) ?
      { action: "stop", reason: "DIRECTION_DRIFT_CHOICE", clause: /scope/.test(candidateFailure) ? "scope" :
        policy.mode === "goal-first" ? "goal-contract" : "frozen-plan", detail: candidateFailure } :
      { action: "stop", reason: "CANDIDATE_IDENTITY_UNVERIFIED", detail: candidateFailure };
  } else {
    const checked = input.deliveryPhase === "dispatch" ? checkedPreflight(input, policy) : null;
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
    decision = deliveryDecision({ phase: input.deliveryPhase, policy, identity, contract: goal, approval: input.approval,
      grant: input.grant, restrictions: input.restrictions, observed: { ...input.observed, preflightReady: checked?.ready, correctionAncestryVerified,
        humanInput: handoff?.active?.state === "waiting" ? "waiting" : input.observed?.humanInput },
      taskGroups: nativeGroups(input, evaluation, implementation), candidate: snapshot,
      gateRun: input.gateRun ? retainedJson(input.gateRun) : null, handoff });
  }
  return { policy, context, identity, snapshot, decision, handoff, invalidHandover, candidateRequest };
}

export async function deliveryCommand(command, input) {
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
          { ...input, restrictions: { ...input.restrictions, inspect: false } } : input);
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
      return deliveryStatus({ ...e, change: e.identity.change, candidate: snapshot, finish, closure, context,
        attempt: { ...input.attempt, invalid: e.invalidHandover } });
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
