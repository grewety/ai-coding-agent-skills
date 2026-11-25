import { pathToFileURL } from "node:url";
import path from "node:path";
import { readBounded, separate, sha256 } from "./evidence-retention.mjs";
import { need, observed, same, sealedObservation, text } from "./operator-records.mjs";
import { planningLayout } from "./planning-inventory.mjs";

function grantMatches(grant, context, workspace) {
  return observed(grant) && grant.change === context.change && grant.policyRevision === context.parent &&
    grant.workspace === workspace && grant.write === true && grant.validate === true &&
    Number.isFinite(grant.minutes) && grant.minutes > 0 && Number.isFinite(grant.minutesUsed) &&
    grant.minutesUsed >= 0 && grant.minutesUsed < grant.minutes && Number.isSafeInteger(grant.corrections) &&
    grant.corrections >= 0 && grant.corrections <= 3 && text(grant.stop) && grant.stopReached === false;
}

export function proposalInput(input, parent) {
  const request = input.proposal;
  need(observed(request) && ["short-proposal", "goal-draft"].includes(request.kind) &&
    [request.goal, request.note].filter(text).length === 1, "Expected one authorized inline goal or readable note");
  const goal = request.note ? new TextDecoder("utf-8", { fatal: true }).decode(readBounded(request.note, 128 * 1024)).trim() : request.goal.trim();
  need(text(goal), "Proposal goal is empty");
  return { goal, policyRevision: parent.parent, proposeToFreeze: parent.proposeToFreeze,
    draftOnly: request.draftOnly === true || input.restrictions?.noCommits === true,
    reviewRequested: request.kind === "goal-draft" || request.review === true };
}

export async function charterObservation(input, context, proposal, workspace) {
  const selected = input.charter;
  need(selected && [input.repo, input.workspace].filter(Boolean).every((root) => separate(root, selected.verifier)) &&
    path.basename(selected.verifier) === "orchestration-core.mjs" &&
    sha256(readBounded(selected.verifier, 1024 * 1024)) === selected.verifierSha256,
  "Selected charter package is missing, overlaps the checkout or has drifted");
  // The entire package inventory is verified by the orchestrator at P8.
  need(observed(selected.inventory) && selected.inventory.match === true &&
    selected.inventory.verifierSha256 === selected.verifierSha256, "Missing matching qualified charter package inventory");
  const core = await import(pathToFileURL(selected.verifier).href);
  const retained = sealedObservation(selected.observation);
  need(retained.record?.change === context.change && retained.record.goal === proposal.goal &&
    retained.record.budget <= input.planningGrant?.corrections &&
    grantMatches(input.planningGrant, context, workspace.workspace) && input.planningGrant.review === true &&
    same(retained.record.binding, input.planningGrant.reviewBinding) &&
    (!context.lowTouch || same(retained.planningModes, context.modes)), "Charter differs from the fixed grant, goal or qualified reviewer");
  const accepted = core.acceptConvergenceReview({ ...retained, currentInputs: context.inputs });
  if (input.proposal.phase !== "correct") return context.lowTouch ? { ...accepted, planningModes: context.modes } : accepted;
  need(accepted.action !== "freeze-ready", "Accepted charter requires no correction");
  const correction = input.correction;
  const layout = planningLayout(context.change, Boolean(context.lowTouch));
  const paths = input.planningGrant.paths;
  need(validatedDraft({ ...input, workspace: workspace.workspace }, context) && Array.isArray(paths) && paths.every((file) => layout.includes(file)) &&
    (correction?.launchFailures === 1 || accepted.record.ledger.some((finding) =>
      finding.id === correction?.finding?.id && finding.scope === "in-scope" && finding.status === "open" &&
      finding.severity !== "Low")), "Missing validated authorized draft paths or grounded open finding");
  return core.convergenceDecision({ ...correction, authority: input.planningGrant, record: accepted.record,
    currentInputs: context.inputs, authorizedPaths: paths });
}

function nativeClosure(validation, context, workspace) {
  const { status, instructions } = validation ?? {};
  const root = path.join(workspace, planningLayout(context.change).directory);
  if (status?.changeName !== context.change || status.changeRoot !== root || status.isPlanningComplete !== true ||
      instructions?.changeName !== context.change || instructions.changeDir !== root || instructions.state !== "ready" ||
      !Array.isArray(status.artifacts) || !status.artifacts.length || status.artifacts.length > 256 ||
      !status.artifactPaths || !instructions.contextFiles || !same(validation.modes, context.modes)) return false;
  const covered = (absolute) => typeof absolute === "string" && path.isAbsolute(absolute) &&
    path.normalize(absolute) === absolute && absolute.startsWith(root + path.sep) &&
    Object.hasOwn(context.inputs, path.relative(workspace, absolute));
  const ids = status.artifacts.map(({ id }) => id);
  const outputs = (files) => Array.isArray(files) && files.length > 0 && files.length <= 256 &&
    new Set(files).size === files.length && files.every(covered);
  const contexts = Object.entries(instructions.contextFiles);
  return new Set(ids).size === ids.length && status.artifacts.every(({ id, status: state }) =>
    typeof id === "string" && state === "done" && outputs(status.artifactPaths[id]?.existingOutputPaths)) &&
    contexts.length > 0 && contexts.every(([id, files]) => ids.includes(id) && outputs(files) &&
      same([...files].sort(), [...status.artifactPaths[id].existingOutputPaths].sort()));
}

function validatedDraft(input, context) {
  const validation = input.validation && sealedObservation(input.validation);
  return observed(validation) && validation.change === context.change && validation.policyRevision === context.parent &&
    validation.nativeReady === true && validation.strictExitCode === 0 && validation.metadataExitCode === 0 &&
    same(validation.inputs, context.inputs) && (!context.lowTouch ||
      nativeClosure(validation, context, input.workspace)) ? validation : null;
}

export function proposalFreeze({ input, context, policy, proposal, workspace, charter }) {
  const stop = (reason) => ({ action: "stop", reason, proposal, workspace, policy, planApproved: false, executionAuthorized: false });
  const validation = validatedDraft({ ...input, workspace: workspace.workspace }, context);
  if (!validation) return stop("NATIVE_VALIDATION_PENDING");
  const review = charter ?? input.reviewAcceptance;
  const matchingPolicy = policy.approachPolicy === "charter-v1" ? review?.policy === "charter-v1" :
    review?.policy === undefined || review.policy === "strict";
  if ((proposal.reviewRequested || policy.requireApproachReview) &&
      (!matchingPolicy || review?.action !== "freeze-ready" || !same(review.inputs, context.inputs) || !text(review.reference) ||
        context.lowTouch && !same(review.planningModes, context.modes))) {
    return stop("APPROACH_REVIEW_PENDING");
  }
  if (!proposal.proposeToFreeze || !policy.proposeToFreeze || proposal.draftOnly) return stop("UNCOMMITTED_DRAFT_BOUNDARY");
  if (proposal.revision && same(proposal.revision.inputs, context.inputs)) return stop("PLANNING_FEEDBACK_NOT_APPLIED");
  const grant = input.planningGrant;
  if (!grantMatches(grant, context, workspace.workspace) || grant.commits !== true ||
      (proposal.revision && (grant.refreezeFrom !== proposal.revision.plan || grant.predecessorUnpublished !== true))) {
    return stop("PLAN_COMMIT_AUTHORITY_PENDING");
  }
  const issue = input.issue;
  const issueVerified = observed(issue) && issue.change === context.change &&
    (issue.bound === true && validation.issueReference === issue.reference ||
      issue.required === false && issue.bound === false && validation.issueReference === null);
  if (!observed(input.baseline) || input.baseline.head !== context.parent || input.baseline.upstreamVerified !== true || !issueVerified) {
    return stop("PLANNING_BASELINE_OR_ISSUE_UNVERIFIED");
  }
  if (!context.changedPaths.length || !context.changedPaths.every((file) => Object.hasOwn(context.inputs, file))) {
    return stop("PLAN_ONLY_SCOPE_UNVERIFIED");
  }
  return { ...stop(null), action: "freeze-ready", change: context.change, inputs: context.inputs,
    policyRevision: context.parent, ...(context.lowTouch ? { modes: context.modes } : {}), grantReference: grant.reference,
    validationReference: validation.reference, reviewReference: review?.reference ?? null };
}
