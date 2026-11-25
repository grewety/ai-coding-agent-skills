import path from "node:path";
import { readBounded, sha256, stableJson } from "./evidence-retention.mjs";
import { need, observed, privateRecords, same, sealedObservation, text } from "./operator-records.mjs";

const launch = 'codex --approve-for-me -C "$change_worktree" --add-dir "$change_records"';
const shellQuote = (value) => "'" + value.replaceAll("'", "'\\''") + "'";

export function checkpointObservation(input, identity, workspace, active, grant) {
  if (!input.checkpointFile) return null;
  const retained = sealedObservation(input.checkpointFile);
  const records = privateRecords(retained.records, [workspace.workspace, input.repo]);
  need(input.checkpointFile.file.startsWith(records + path.sep), "Checkpoint is outside retained records");
  need(retained.schemaVersion === 1 && retained.kind === "delivery-checkpoint" && observed(retained) &&
    same(retained.identity, { ...identity, branch: workspace.branch, head: workspace.head }) &&
    retained.attempt === (active ?? null) && retained.grantReference === (grant?.reference ?? null) &&
    retained.grantSha256 === (grant ? sha256(stableJson(grant)) : null) &&
    retained.evidence?.file?.startsWith(records + path.sep) &&
    sha256(readBounded(retained.evidence.file)) === retained.evidence.sha256,
  "Checkpoint identity or retained evidence mismatch");
  if (retained.safeBoundary === true && active) need(observed(retained.originalSettlement) &&
    retained.originalSettlement.attempt === active, "Checkpoint is missing its exact original-attempt settlement");
  return { ...retained, file: input.checkpointFile.file, sha256: input.checkpointFile.sha256 };
}

export function resumeCheckpoint(input, identity, workspace, grant) {
  const checkpoint = checkpointObservation({ ...input, checkpointFile: input.shortDecision.resumeCheckpoint }, identity, workspace,
    input.shortDecision.resumeAttempt, grant);
  need(grant && checkpoint.safeBoundary === true && observed(checkpoint.originalSettlement) &&
    input.head === workspace.head, "Resume requires a settled checkpoint, the original bounded local grant and exact candidate HEAD");
  const { budgets, restrictions } = checkpoint;
  const counts = ["minutesUsed", "correctionsUsed"];
  if (grant.mode === "goal-first" || restrictions?.group) counts.push("groupMinutesUsed");
  need(restrictions?.inspect === false && typeof restrictions.noCommits === "boolean" &&
    typeof restrictions.keepWorktree === "boolean" && (restrictions.group === null || text(restrictions.group)) &&
    counts.every((key) => Number.isFinite(budgets?.[key]) && budgets[key] >= 0 &&
      Number.isFinite(input.observed?.[key]) && input.observed[key] >= budgets[key]) &&
    Number.isSafeInteger(budgets.correctionsUsed) && Array.isArray(budgets.correctionHistory) &&
    Array.isArray(input.observed.correctionHistory) &&
    same(input.observed.correctionHistory.slice(0, budgets.correctionHistory.length), budgets.correctionHistory),
  "Resume histories or restrictions do not preserve the sealed checkpoint");
  return checkpoint;
}

export function relayCheckpoint(input, checkpoint, active, grant) {
  const stop = (reason) => ({ action: "preserve-predecessor", reason, remoteWrites: false });
  const relay = input.checkpointRelay;
  if (!checkpoint || checkpoint.safeBoundary !== true || active || !grant ||
      checkpoint.originalSettlement?.verified !== true || !text(checkpoint.originalSettlement.reference)) {
    return stop("ORIGINAL_SETTLEMENT_UNVERIFIED");
  }
  const approval = relay?.authority;
  const qualified = relay?.qualification;
  if (!observed(approval) || approval.kind !== "checkpoint-only-rotation" || approval.oneRotation !== true ||
      approval.checkpointSha256 !== checkpoint.sha256 || approval.reference === grant.reference ||
      approval.predecessor !== relay.predecessor?.pane || approval.qualificationReference !== qualified?.reference ||
      !observed(qualified) || qualified.route !== "herdr" || qualified.checkpointRotation !== true) {
    return stop("CHECKPOINT_RELAY_AUTHORITY_PENDING");
  }
  const { predecessor } = relay;
  if (!observed(predecessor) || !text(predecessor.pane) || predecessor.checkpointSha256 !== checkpoint.sha256 ||
      predecessor.claimPreserved !== true || predecessor.processPreserved !== true) return stop("RELAY_PREDECESSOR_UNVERIFIED");
  if (predecessor.timerCancelled !== true || !text(predecessor.timerReference)) {
    return { ...stop("PREDECESSOR_TIMER_PENDING"), action: "cancel-predecessor-timer" };
  }
  if (!relay.successor) {
    if (!observed(relay.successorInventory) || relay.successorInventory.absent !== true ||
        relay.successorInventory.authorityReference !== approval.reference) return stop("RELAY_SUCCESSOR_INVENTORY_UNVERIFIED");
    return { ...stop("SUCCESSOR_PENDING"), action: "open-checkpoint-successor", checkpoint: checkpoint.file };
  }
  const successor = relay.successor;
  if (!observed(successor) || !text(successor.pane) || successor.pane === predecessor.pane ||
      !observed(successor.ownership) || successor.ownership.workspace !== checkpoint.identity.workspace ||
      successor.grantReference !== grant.reference || !same(successor.identity, checkpoint.identity)) {
    return stop("RELAY_SUCCESSOR_UNVERIFIED");
  }
  if (!relay.ack) return stop("HANDOFF_ACK_PENDING");
  need(relay.ack.file.startsWith(checkpoint.records + path.sep), "Handoff ACK is outside retained change records");
  const ack = sealedObservation(relay.ack);
  if (!observed(ack) || ack.kind !== "HANDOFF_ACK" || ack.pane !== successor.pane ||
      ack.predecessor !== predecessor.pane || ack.checkpointSha256 !== checkpoint.sha256 ||
      ack.authorityReference !== approval.reference || ack.ownershipReference !== successor.ownership.reference ||
      ack.grantReference !== grant.reference || ack.grantSha256 !== checkpoint.grantSha256 ||
      !same(ack.identity, checkpoint.identity)) return stop("HANDOFF_ACK_UNVERIFIED");
  if (relay.closure) {
    const closed = relay.closure;
    if (!observed(closed) || closed.absent !== true || closed.predecessor !== predecessor.pane ||
        closed.successor !== successor.pane || closed.ackSha256 !== relay.ack.sha256 ||
        closed.authorityReference !== approval.reference) return stop("RELAY_CLOSURE_UNVERIFIED");
    return { ...stop(null), action: "rotation-complete", ack: relay.ack.file };
  }
  return { ...stop(null), action: "predecessor-close-ready", ack: relay.ack.file };
}

function singleLine(value) {
  return String(value ?? "pending").replaceAll(/[\u0000-\u001f\u007f]/g, " ");
}

function finishInputs(closeout, change, inspect) {
  const next = {
    "publish-ready": "Publish the named exact candidate through the retained protected finish grant and verify remote readback",
    "merge-ready": "Use the verified protected merge route for the displayed PR and exact head",
    watch: "Read the same PR head and protection again at " + closeout.pollAt,
    "verify-integrated": "Run the declared gates on the isolated containing revision",
    "prepare-closure": "Prepare the receipt and record-only archive candidate under the retained finish grant",
    "verify-closure": "Run the complete declared gates including npm test on the exact archived tree",
    "review-closure": "Obtain the separately authorized fresh factual closure review on the exact archived tree",
    "close-issue": "Close the bound issue against the verified archive acceptance and read it back",
    "retire-worktrees": "Recheck eligible dedicated worktrees, remove without force and verify registrations, paths and retained refs",
  }[closeout.action];
  if (next) return [next];
  if (closeout.reason === "PREVIEW_REVIEW_PENDING") return [
    "Review the exact-candidate preview at " + closeout.previewUrl + ", then reply continue",
  ];
  if (closeout.reason === "OPTIONAL_CHECK_DISPOSITION_PENDING") return [
    "Record a proceed-without decision for the stalled optional checks, then reply continue",
    "Request a separately authorized single-run retry",
  ];
  if (closeout.sync?.action === "operator-sync-ready") {
    return ["Use the authorized " + closeout.sync.client + " update in the selected profile from " +
      closeout.sync.source.revision + ", then record complete bytes, versions and fresh-session readback"];
  }
  if (["closed", "sync-assessment"].includes(closeout.action) && closeout.sync) {
    return ["$openspec-delivery sync-skills " + change + " (name client or profile, immutable source and update scope)",
      "Keep the current installed packages"];
  }
  return [inspect, "Resolve " + closeout.reason + " using the retained readback"];
}

export function operatorStatus(base, { policy, workspace, identity, preflight, checkpoint, restrictions, alignment, pullRequest,
  detail, evidence, shortCard, proposal, closeout } = {}) {
  const result = {
    ...base, operatorSchemaVersion: 1, policyRevision: policy?.policyRevision ?? null,
    plan: identity?.plan ?? null, workspace: workspace?.workspace ?? null, branch: workspace?.branch ?? null,
    head: workspace?.head ?? null, checkpoint: checkpoint?.file ?? closeout?.checkpoint ?? null, evidence: evidence ?? null,
    pullRequest: observed(pullRequest) && pullRequest.change === base.change && pullRequest.head === workspace?.head && workspace?.head ? {
      reference: pullRequest.reference, state: pullRequest.state ?? null, checks: pullRequest.checks ?? null,
    } : null,
    preflight: preflight ?? null, restrictions: restrictions ?? null,
    invariantState: alignment ?? null, detail: detail ?? null,
  };
  if (closeout) {
    result.closeout = closeout;
    result.pullRequest = closeout.pr ? { reference: closeout.pr, head: closeout.head ?? null,
      state: closeout.prState ?? closeout.action, checks: closeout.required ?? null, optional: closeout.optional ?? null } : null;
  }
  const change = base.change;
  const inspect = change ? `$openspec-next inspect ${change}` : "$openspec-next inspect";
  const code = base.recommendedNextAction?.code;
  const proposalFreeze = proposal?.action === "freeze-ready";
  let next = [inspect];
  if (closeout) next = finishInputs(closeout, change, inspect);
  else if (proposalFreeze) next = ["Freeze the validated native planning files under the retained local grant"];
  else if (proposal?.action === "prepare-native-draft") next = ["Prepare the verified workspace, then scaffold the native proposal"];
  else if (proposal?.action === "apply-validate-review") next = ["Apply the retained correction, revalidate and review the complete native artifact set"];
  else if (proposal?.action === "retry-launch") next = ["Obtain the separately authorized review retry for the retained route"];
  else if (proposal?.reason === "UNCOMMITTED_DRAFT_BOUNDARY") next = ["Review the uncommitted native draft"];
  else if (proposal?.reason === "APPROACH_REVIEW_PENDING") next = ["Verify the selected approach review for the complete draft"];
  else if (proposal?.reason === "NATIVE_VALIDATION_PENDING") next = ["Run native strict validation and project metadata validation in the change workspace"];
  else if (proposal?.reason) next = [inspect, `Supply verified evidence for ${base.stopPredicate}`];
  else if (code === "RESOLVE_CHANGE") next = ["Select the full change name from the verified native inventory"];
  else if (code === "RECORD_EXACT_APPROVAL") next = shortCard?.live ?
    ["approve", ...(shortCard.combined ? ["approve and run"] : []), "changes: <planning feedback>"] :
    [`Review the frozen plan and give explicit exact approval for ${result.plan} / ${base.planDigest}`];
  else if (code === "RECORD_LOCAL_EXECUTION_GRANT") next = [`$openspec-next ${change} (supply the bounded local grant)`];
  else if (code === "START_AUTHORIZED_LOCAL_RUN" || code === "RESUME_BOUNDED_ATTEMPT") next = [`$openspec-next ${change}`];
  else if (code === "REQUEST_FINISH_AUTHORITY") next = [`$openspec-delivery finish ${change}`];
  else if (code === "APPLY_ROUTINE_CORRECTION") next = ["Resume the retained in-scope correction"];
  else if (code === "VERIFY_EXACT_RESULT_REVIEW") next = ["Verify the independent review bound to the exact candidate and local gates"];
  else if (code === "ASSESS_FINISH_READINESS") next = ["Assess finish readiness for the exact accepted candidate"];
  else if (code === "RECORD_NATIVE_PROGRESS") next = ["Record the verified native progress under the retained local grant"];
  else if (code === "WAIT_FOR_ORIGINAL_OPERATOR_INPUT") next = ["Answer the pending input in the original session"];
  else if (code === "RESOLVE_STOP") next = [inspect, `Supply verified evidence for ${base.stopPredicate ?? "the unresolved predicate"}`];
  const finishHandoff = Boolean(closeout?.records && closeout?.checkpoint && closeout?.readback);
  const canSwitch = checkpoint?.safeBoundary === true && text(result.workspace) || finishHandoff;
  result.nextInput = code ? next : null;
  result.session = canSwitch && code ? {
    kind: "fresh-session",
    starter: finishHandoff ?
      `${inspect}. Read finish checkpoint ${closeout.checkpoint} (SHA-256 ${closeout.checkpointSha256}) and ${closeout.readback}; verify candidate ${result.head}, plan digest ${base.planDigest}, deadline ${closeout.deadline}, PR and grant ${closeout.grantReference}. Serialize the handoff and read the current remote state before continuing.` :
      `${inspect}. Read checkpoint ${checkpoint.file} (SHA-256 ${checkpoint.sha256}) and evidence ${checkpoint.evidence.file}; verify HEAD ${result.head}, digest ${base.planDigest}, ownership and retained authority before continuing.`,
    launch,
    setup: `change_worktree=${shellQuote(finishHandoff ? closeout.identity.repo : result.workspace)}\nchange_records=${shellQuote(finishHandoff ? closeout.records : checkpoint.records)}`,
  } : code ? { kind: "same-session" } : null;
  const show = singleLine;
  result.footer = code ? [
    `### Next step`,
    `${show(change)} · ${show(base.mode)} · ${show(base.state)} · ${show(result.branch)} @ ${show(result.head)}`,
    `Plan ${show(result.plan)} / ${show(base.planDigest)} · policy ${show(result.policyRevision)} · attempt ${show(base.activeAttemptId)}`,
    `Checkpoint ${show(result.checkpoint)} · evidence ${show(result.evidence)} · PR/checks ${result.pullRequest ? show(JSON.stringify(result.pullRequest)) : "pending"}`,
    `P1–P8 ${preflight?.items?.map(({ id, state }) => `${id} ${state}`).join(", ") ?? "pending"} · first unresolved ${show(preflight?.followUp ?? (preflight?.ready ? "none" : null))}`,
    `Stop ${show(base.stopPredicate ?? (proposalFreeze ? "none" : null))}${detail ? ` (${show(detail)})` : ""}`,
    `Restrictions ${show(restrictions ? JSON.stringify(restrictions) : null)} · invariants ${show(alignment ? JSON.stringify(alignment) : null)}`,
    ...(closeout?.archiveAccepted ? [`Archive accepted · issue ${show(closeout.issueState)} · worktrees ${show(closeout.worktrees?.map(({ workspace, state }) => workspace + " " + state).join(", "))}`] : []),
    ...next.map((item) => `- ${show(item)}`),
    ...(canSwitch ? [`\nFresh session: ${show(result.session.starter)}`, `\n\`\`\`sh\n${result.session.setup}\n${launch}\n\`\`\``] : []),
  ].join("\n") : null;
  return result;
}
