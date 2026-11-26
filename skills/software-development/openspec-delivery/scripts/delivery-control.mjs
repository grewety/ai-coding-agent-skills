// Local delivery admission over verified observations. No worker, Git or task mutation.
import { sha256, stableJson, verifyGateRun } from "./evidence-retention.mjs";
import { planningLayout, safePlanningPath, validatePlanningInputs } from "./planning-inventory.mjs";
import { continuationDecision } from "./delivery-policy.mjs";

const requireThat = (condition, message) => { if (!condition) throw new Error(message); };
const text = (value) => typeof value === "string" && value.trim().length > 0;
const sha = (value) => typeof value === "string" && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value);
const digest = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const elapsed = (value) => Number.isFinite(value) && value >= 0;
const nonnegative = (value) => Number.isSafeInteger(value) && value >= 0;
const keywords = ["schemaVersion", "outcome", "scope", "invariants", "nonGoals", "adaptableAssumptions", "acceptance", "gates", "localAuthority", "budgets"];
export const withinScope = (file, scope) => scope.some((root) => file === root || file.startsWith(`${root}/`));
const distinctList = (value, predicate, min = 1) => Array.isArray(value) && value.length >= min &&
  value.every(predicate) && new Set(value.map(stableJson)).size === value.length;
const exactKeys = (value, names) => value && typeof value === "object" && !Array.isArray(value) &&
  Object.keys(value).length === names.length && names.every((key) => Object.hasOwn(value, key));
const finiteBudget = (value, fractionalMinutes = false) => exactKeys(value, ["minutes", "corrections"]) &&
  (fractionalMinutes ? elapsed(value.minutes) : nonnegative(value.minutes)) &&
  value.minutes > 0 && nonnegative(value.corrections);

export function readGoalContract(proposal) {
  const blocks = [...proposal.matchAll(/^```openspec-goal-contract\r?\n([\s\S]*?)^```[ \t]*\r?$/gm)];
  requireThat(blocks.length === 1, "Expected one Goal Contract in the native proposal");
  return JSON.parse(blocks[0][1]);
}

export function goalContractIdentity({ change, policyRevision, contract, inputs, taskCount, customPlanning, modes, normalizedTasksSha256 }) {
  const layout = planningLayout(change);
  validatePlanningInputs(change, inputs, undefined, customPlanning);
  requireThat(sha(policyRevision) && taskCount === 1, "Goal-First requires an integrated policy and one native outcome task");
  requireThat(exactKeys(contract, keywords) && contract.schemaVersion === 1 && text(contract.outcome), "Incomplete Goal Contract");
  requireThat(distinctList(contract.scope, (file) => safePlanningPath(file) && !file.split("/").some((part) =>
    part.toLowerCase() === ".git") && file !== "openspec/config.yaml" &&
    !file.startsWith("openspec/changes/") && !withinScope("openspec/changes", [file])), "Invalid Goal Contract scope");
  for (const key of ["invariants", "nonGoals", "acceptance", "adaptableAssumptions"]) {
    requireThat(distinctList(contract[key], text, key === "adaptableAssumptions" ? 0 : 1), `Invalid Goal Contract ${key}`);
  }
  requireThat(distinctList(contract.gates, (argv) => Array.isArray(argv) && argv.length > 0 && text(argv[0]) &&
    argv.every((arg) => typeof arg === "string" && !arg.includes("\0"))), "Goal Contract requires executable gate argument vectors");
  requireThat(exactKeys(contract.localAuthority, ["commits", "stop"]) && typeof contract.localAuthority.commits === "boolean" &&
    text(contract.localAuthority.stop) && finiteBudget(contract.budgets), "Invalid Goal Contract local authority or budgets");
  const specs = Object.fromEntries(Object.entries(inputs).filter(([file]) => file.startsWith(`${layout.specs}/`)));
  requireThat(Object.keys(specs).some((file) => file.endsWith("/spec.md")), "Goal Contract requires a native spec delta");
  if (customPlanning) {
    const task = `${layout.directory}/tasks.md`;
    requireThat(digest(normalizedTasksSha256) && modes && Object.keys(modes).length === Object.keys(inputs).length &&
      Object.keys(inputs).every((file) => ["100644", "100755"].includes(modes[file])), "Unverified planning file modes or native task identity");
    const normalized = Object.fromEntries(Object.entries(inputs).map(([file, hash]) =>
      [file, { mode: modes[file], sha256: file === task ? normalizedTasksSha256 : hash }]));
    return sha256(stableJson({ change, policyRevision, contract, inputs: normalized }));
  }
  const boundInputs = { ...specs, "openspec/config.yaml": inputs["openspec/config.yaml"],
    [`${layout.directory}/.openspec.yaml`]: inputs[`${layout.directory}/.openspec.yaml`] };
  return sha256(stableJson({ change, policyRevision, contract, inputs: boundInputs }));
}

function matchesAuthority(record, identity) {
  return record?.schemaVersion === 1 && record.verified === true && text(record.reference) &&
    Object.entries(identity).every(([key, value]) => record[key] === value);
}

function reviewMatches(handoff, candidate, gateReference, active, group, delegated) {
  const result = handoff?.result;
  const request = handoff?.request;
  const id = result?.identity;
  return result?.status === "completed" && id?.role === "reviewer" &&
    id.candidate === candidate.head && id.change === candidate.change &&
    id.plan === candidate.plan && (id.planDigest === candidate.planDigest || handoff.goalContractDigest === candidate.planDigest) &&
    (delegated ? id.task === delegated.id.task : handoff.reviewSnapshot ? (group
      ? id.group === group.id && id.group === active?.group && group.taskIds.includes(id.task)
      : active?.group === id.group || active?.group === id.task) :
      id.workspace === candidate.workspace && (active?.group === id.group || active?.group === id.task)) &&
    candidate.taskIds?.includes(id.task) &&
    id.implementerSession === active?.implementerSession && text(active?.implementerSession) &&
    text(result.runtime?.session) && result.runtime.session !== active.implementerSession &&
    result.runtime.readOnly === true && result.coverageLimitations?.length === 0 && request?.acceptance?.includes(`gate-run:${gateReference}`);
}

export function selectTaskGroup({ groups, eligibleGroups, requested, activeGroup = null }) {
  if (!Array.isArray(groups) || !groups.length || !distinctList(eligibleGroups, text)) return { reason: "NATIVE_GROUPS_UNVERIFIED" };
  const completed = new Set();
  const seen = new Set();
  let next;
  for (const group of groups) {
    if (!text(group?.id) || seen.has(group.id) || typeof group.completed !== "boolean" ||
        !distinctList(group.requires, (id) => seen.has(id), 0) ||
        (group.completed && (next || group.requires.some((id) => !completed.has(id))))) return { reason: "NATIVE_GROUPS_UNVERIFIED" };
    seen.add(group.id);
    if (group.completed) completed.add(group.id);
    else next ??= group;
  }
  if (eligibleGroups.some((id) => !seen.has(id))) return { reason: "NATIVE_GROUPS_UNVERIFIED" };
  if (activeGroup !== null) {
    const index = groups.findIndex(({ id }) => id === activeGroup);
    if (index === -1 || groups.slice(0, index).some((entry) => !entry.completed)) return { reason: "DEPENDENCIES_PENDING" };
    next = groups[index];
  }
  if (!next) return { reason: "NATIVE_GROUPS_COMPLETE" };
  if (next.requires.some((id) => !completed.has(id))) return { reason: "DEPENDENCIES_PENDING" };
  if (!eligibleGroups.includes(next.id) || (requested !== null && requested !== next.id)) return { reason: "GROUP_AUTHORITY_PENDING" };
  if (next.authority === "external") return { reason: "EXTERNAL_AUTHORITY_PENDING" };
  if (next.authority !== "local") return { reason: "GROUP_AUTHORITY_UNVERIFIED" };
  return { group: next };
}

function correctionHistory(history, correctionCount) {
  return Array.isArray(history) && history.length === correctionCount &&
    history.every((entry) => text(entry?.reference) && sha(entry.rejectedSha) && sha(entry.successorSha) &&
      entry.rejectedSha !== entry.successorSha && text(entry.group)) &&
    new Set(history.map((entry) => entry.reference)).size === history.length;
}

export function deliveryDecision({ phase, policy, identity, contract, approval, grant, restrictions, observed, taskGroups,
  candidate, gateRun, handoff, delegated }) {
  const state = (action, reason, detail = {}) => ({ action, reason, remoteWrites: false, tasksComplete: false, ...detail });
  if (restrictions?.inspect === true) return state("inspect", null);
  if (!["dispatch", "boundary", "correction", "result"].includes(phase) ||
      !["goal-first", "task-guided"].includes(policy?.mode) || !sha(policy.policyRevision) ||
      !identity || !text(identity.change) || !text(identity.workspace) || !sha(identity.plan) || !digest(identity.planDigest)) {
    return state("stop", "DELIVERY_IDENTITY_UNVERIFIED");
  }
  const binding = { ...identity, mode: policy.mode, policyRevision: policy.policyRevision };
  if (approval?.kind !== (policy.mode === "goal-first" ? "exact-goal-approval" : "exact-plan-approval") ||
      !matchesAuthority(approval, binding) || approval.approved !== true) return state("queue", "EXACT_APPROVAL_PENDING");
  if (grant?.kind !== "local-execution-grant" || !matchesAuthority(grant, binding) || grant.reference === approval.reference ||
      grant.approvalReference !== approval.reference || grant.localOnly !== true || !finiteBudget(grant.budgets, Boolean(delegated)) ||
      typeof grant.commits !== "boolean" || !text(grant.stop)) return state("queue", "LOCAL_AUTHORITY_PENDING");
  if (restrictions?.inspect !== false || typeof restrictions.noCommits !== "boolean" ||
      !(restrictions.group === null || text(restrictions.group))) return state("stop", "RESTRICTIONS_UNVERIFIED");
  if (phase === "dispatch" && observed?.preflightReady !== true) return state("stop", "PREFLIGHT_PENDING");
  if (observed?.stopReached === true) return state("stop", "DECLARED_STOP_REACHED");
  if (observed?.stopReached !== false) return state("stop", "DECLARED_STOP_UNVERIFIED");
  if (observed?.ownership !== (delegated && phase === "dispatch" ? "runtime-admission" : "exclusive")) {
    return state("stop", "OWNERSHIP_UNVERIFIED");
  }
  if (observed.host !== "ready") return state("stop", "ENVIRONMENT_BLOCKED");
  if (observed.humanInput !== "none") return state("stop", "HUMAN_INPUT_PENDING");
  if (observed.remoteRequired !== false) return state("queue", "EXTERNAL_AUTHORITY_PENDING");

  const goal = policy.mode === "goal-first";
  let group = null;
  if (goal) {
    try {
      requireThat(goalContractIdentity({ ...contract, change: identity.change, policyRevision: policy.policyRevision }) === identity.planDigest,
        "Approved Goal Contract differs");
    } catch {
      return state("stop", "DIRECTION_DRIFT_CHOICE", { clause: "goal-contract" });
    }
    if (restrictions.group !== null) return state("queue", "GROUP_AUTHORITY_PENDING");
  } else {
    const selection = selectTaskGroup({ groups: taskGroups, eligibleGroups: grant.eligibleGroups, requested: restrictions.group,
      activeGroup: phase === "dispatch" ? null : observed.activeAttempt?.group ?? null });
    if (!selection.group) return state("queue", selection.reason);
    group = selection.group;
    if (delegated && !group.taskIds.includes(delegated.id.task)) return state("stop", "DELEGATED_ACTION_MISMATCH");
  }
  if (observed.plan !== identity.plan || observed.planDigest !== identity.planDigest) {
    return state("stop", "DIRECTION_DRIFT_CHOICE", { clause: goal ? "goal-contract" : "frozen-plan" });
  }
  const clauses = goal ? ["scope", "invariants", "nonGoals", "acceptance", "localAuthority"] : ["frozen-plan", "order", "localAuthority"];
  const alignment = observed.alignment;
  if (!alignment || !clauses.every((clause) => ["aligned", "conflict"].includes(alignment[clause]))) return state("stop", "ALIGNMENT_UNVERIFIED");
  const conflict = clauses.find((clause) => alignment[clause] === "conflict");
  if (conflict) return state("stop", "DIRECTION_DRIFT_CHOICE", { clause: conflict });
  if (goal && (!Array.isArray(observed.adaptations) || observed.adaptations.some((item) =>
    !contract.contract.adaptableAssumptions.includes(item?.assumption) || !text(item.evidence)))) {
    return state("stop", "DIRECTION_DRIFT_CHOICE", { clause: "adaptableAssumptions" });
  }

  if (!goal && phase === "dispatch") {
    if (delegated && (!elapsed(observed.authorityBudgetUsed) || observed.authorityBudgetUsed >= grant.budgets.minutes ||
      (!group.budget && (!elapsed(observed.budgetUsed) || observed.budgetUsed >= grant.budgets.minutes)))) {
      return state("stop", "TASK_GUIDED_CONTINUATION_BLOCKED", { detail: "Missing or exhausted authority budget" });
    }
    const next = continuationDecision({ policy, change: identity.change, group, authority: grant, restrictions, observed,
      runtimeAdmission: Boolean(delegated) });
    if (next.action !== "advance") return state("stop", "TASK_GUIDED_CONTINUATION_BLOCKED", { detail: next.reason });
  }
  const limit = goal ? contract.contract.budgets : group.resultBudget;
  if (!finiteBudget(limit) || !elapsed(observed.minutesUsed) || !elapsed(observed.groupMinutesUsed) ||
      !nonnegative(observed.correctionsUsed) ||
      !correctionHistory(observed.correctionHistory, observed.correctionsUsed) ||
      (delegated && observed.delegatedCorrectionHistoryVerified === false) ||
      (observed.correctionsUsed > 0 && observed.correctionAncestryVerified !== true)) {
    return state("stop", "BUDGET_HISTORY_UNVERIFIED");
  }
  const inGroup = observed.correctionHistory.filter((entry) => entry.group === (group?.id ?? "goal")).length;
  const runtimeLimits = delegated?.grant.limits;
  const totalMinutes = Math.min(grant.budgets.minutes, runtimeLimits ? runtimeLimits.totalMs / 60000 : Infinity);
  const groupMinutes = Math.min(limit.minutes, runtimeLimits ? runtimeLimits.groupMs / 60000 : Infinity);
  const totalCorrections = grant.budgets.corrections;
  const groupCorrections = Math.min(limit.corrections, runtimeLimits?.corrections ?? Infinity);
  if (observed.minutesUsed >= totalMinutes || observed.groupMinutesUsed >= groupMinutes ||
      observed.correctionsUsed > totalCorrections || inGroup > groupCorrections) return state("stop", "BUDGET_EXHAUSTED");
  const commits = !restrictions.noCommits && !delegated?.noCommits && grant.commits && (!goal || contract.contract.localAuthority.commits);
  const correct = () => {
    if (observed.failure !== "routine-in-scope" || !text(observed.failureReference) || !sha(candidate?.head)) {
      return state("stop", "CORRECTION_UNVERIFIED");
    }
    if (observed.correctionsUsed >= totalCorrections || inGroup >= groupCorrections) return state("stop", "BUDGET_EXHAUSTED");
    return state("correct", null, { group: group?.id ?? null, commits, retain: observed.failureReference });
  };
  if (phase === "correction" && !delegated) return correct();
  if (phase !== "result" && phase !== "correction") {
    return state(phase === "dispatch" ? "dispatch" : "continue", null, {
      group: group?.id ?? null, commits, ...(delegated && phase === "dispatch" ? { requiresExclusiveAdmission: true } : {}),
    });
  }

  if (!candidate || candidate.change !== identity.change || candidate.plan !== identity.plan ||
      candidate.planDigest !== identity.planDigest || candidate.workspace !== identity.workspace || !sha(candidate.head)) {
    return state("stop", "CANDIDATE_IDENTITY_UNVERIFIED");
  }
  let gates;
  try {
    gates = verifyGateRun(gateRun, { head: candidate.head, tree: candidate.tree, implementation: candidate.workspace,
      mode: policy.mode, plan: identity.plan, planDigest: identity.planDigest, change: identity.change, gates: goal ? contract.contract.gates : group.gates });
  } catch {
    return state("stop", "EXACT_GATES_UNVERIFIED");
  }
  if (!gates.passed) return observed.failure === "routine-in-scope" && observed.failureReference === gates.reference ?
    correct() : state("stop", "EXACT_GATES_FAILED");
  const review = handoff?.result;
  const exactReview = reviewMatches(handoff, candidate, gates.reference, observed.activeAttempt, group, delegated);
  if (review?.status === "completed" && review.verdict === "findings" && (!handoff.reviewSnapshot || exactReview) &&
      observed.failure === "routine-in-scope" && observed.failureReference === review.report?.sha256) {
    if (delegated && !review.findings.every(({ path }) => delegated.request.mutablePaths.includes(path))) {
      return state("stop", "CORRECTION_SCOPE_UNVERIFIED");
    }
    return correct();
  }
  if (!exactReview || review.verdict !== "no_findings" || review.nativeVerdict !== "Verdict: No findings" || review.findings?.length !== 0) {
    return state("queue", "EXACT_REVIEW_PENDING");
  }
  if (phase === "correction") return state("stop", "CORRECTION_UNVERIFIED");
  return state("accept-result", null, { group: group?.id ?? null, head: candidate.head, commits, eligibleForTaskUpdate: true,
    ...(delegated || candidate.customPlanning ? { gateReference: gates.reference } : {}),
    ...(candidate.customPlanning ? { acceptedTaskIds: goal ? candidate.taskIds : group.taskIds,
      ...(group ? { approvedTaskGates: group.gates } : {}),
      independentZeroWaiver: Boolean(handoff.reviewSnapshot) && review.waivers === undefined } : {}) });
}
