import { CANDIDATE_RECORDS, isRecordQualified } from "./terminal-adapters.mjs";
// Pure packet/evidence checks plus re-exported adapter handoff/supervision helpers.
// Pure core functions do no client launch or process control; adapter execution lives in terminal-adapters.mjs.
// No Git or task-progress writes; inputs are retained observations, not authenticated grants.
export { createAttempt, publishResult, readHandoff } from "./worker-handoff.mjs";
export {
  CANDIDATE_RECORDS,
  DESIGN_CANDIDATES,
  HERMES_PROFILE_PREPARATION_KEYS,
  bootstrapSupervisorDecision,
  cleanupInteractionView,
  executeTerminalAdapterAttempt,
  exposeOperatorInteraction,
  handleWorkerStopOrViolation,
  isRecordQualified,
  preparePromptTransport,
  qualifyCandidateAdapter,
  replacementReadiness,
  resolveLegacyRouteRequest,
  resolveRoleConfiguration,
  superviseWorkerLaunch,
  verifyHermesProfilePreparation,
  versionInRange,
} from "./terminal-adapters.mjs";
const requireThat = (condition, message) => { if (!condition) throw new Error(message); };
const text = (value) => typeof value === "string" && value.trim().length > 0;
const list = (value) => Array.isArray(value) && value.length > 0 && value.every(text);
const sha = (value) => typeof value === "string" && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value);
const digest = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);

function inventory(change, inputs) {
  requireThat(typeof change === "string" && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(change), "Invalid inventory change");
  requireThat(inputs && typeof inputs === "object" && !Array.isArray(inputs), "Missing planning inventory");
  const prefix = `openspec/changes/${change}/`;
  const required = ["openspec/config.yaml", ...[".openspec.yaml", "proposal.md", "tasks.md"].map((name) => prefix + name)];
  requireThat(required.every((name) => Object.hasOwn(inputs, name)), "Incomplete planning inventory");
  for (const [name, hash] of Object.entries(inputs)) {
    requireThat(!name.includes("\\") && name.split("/").every((part) => part && part !== "." && part !== "..") &&
      (required.includes(name) || name === `${prefix}design.md` || name.startsWith(`${prefix}specs/`)) && digest(hash), "Invalid planning inventory input");
  }
}
const sameInputs = (a, b) => a && b && JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());
const resolvedFinding = (finding) => finding?.blocking === false && (
  (finding.disposition === "unfounded" && text(finding.evidence) && text(finding.reason)) ||
  (finding.disposition === "applied" && text(finding.evidence) && text(finding.reReviewReference)) ||
  (finding.disposition === "operator-disposed" && text(finding.operatorReference) && text(finding.reason))
);
// Dispositions preserve history; they are never a substitute for a fresh verdict.
const completeNoFindings = (entry) => entry?.verdict === "Verdict: No findings" &&
  Array.isArray(entry.findings) && entry.findings.length === 0 &&
  Array.isArray(entry.coverageLimitations) && entry.coverageLimitations.length === 0;

export function approachPacket({ change, workspace, inputs, authorSession, reviewerSession }) {
  inventory(change, inputs);
  requireThat(text(workspace), "Missing review workspace");
  requireThat(text(authorSession) && text(reviewerSession) && authorSession !== reviewerSession, "Missing independent reviewer session");
  return structuredClone({ change, workspace, inputs, authorSession, reviewerSession,
    forbidden: ["edits", "shell", "git", "profiles", "persistence", "implementation", "subagents", "multiplexers"],
    report: "Severity-ordered path:line findings with impact, trigger and minimal remedy, or literal Verdict: No findings; record coverage limitations",
  });
}

export function acceptApproachReview({ packet, review, currentInputs }) {
  approachPacket(packet);
  inventory(packet.change, currentInputs);
  requireThat(review?.reviewerSession === packet.reviewerSession, "Wrong reviewer session");
  requireThat(review.readOnly === true, "Review must remain read-only");
  requireThat(text(review.reference), "Missing retained review reference");
  requireThat(sameInputs(packet.inputs, review.inputs) && sameInputs(packet.inputs, currentInputs), "Planning input drift or incomplete review inputs");
  requireThat(completeNoFindings(review), "Missing complete literal no-findings approach review");
  return { readyForFreeze: true, planApproved: false, executionAuthorized: false, entry: structuredClone(review) };
}

export function reviewReadiness({ change, inputs, record, recordIntegrityVerified, recovery }) {
  inventory(change, inputs);
  const count = (value) => Number.isSafeInteger(value) && value >= 0;
  const latest = Array.isArray(record?.entries) ? record.entries.at(-1) : undefined;
  const perCycle = record?.cumulativeCycles === null && record.countDisposition?.mode === "per-cycle" && text(record.countDisposition.reference);
  const validEntry = (entry) => {
    if (!entry || !text(entry.reference) || !text(entry.authorSession) || !text(entry.reviewerSession) ||
        entry.authorSession === entry.reviewerSession || entry.readOnly !== true ||
        typeof entry.automaticCycle !== "boolean" || !Array.isArray(entry.findings)) return false;
    try { inventory(change, entry.inputs); } catch { return false; }
    if (!entry.automaticCycle) return true;
    const correction = entry.correction;
    if (!correction || !text(correction.finding?.id) || correction.finding.classification !== "routine" ||
        !text(correction.finding.evidence) || !text(correction.finding.remedy) ||
        !sameInputs(correction.finding.inputs, correction.beforeInputs) ||
        !sameInputs(correction.amendedInputs, entry.inputs) || correction.reReviewReference !== entry.reference) return false;
    try { inventory(change, correction.beforeInputs); } catch { return false; }
    return !perCycle || (text(entry.cycleAuthorization?.reference) &&
      entry.cycleAuthorization.findingId === correction.finding.id && sameInputs(entry.cycleAuthorization.inputs, correction.beforeInputs));
  };
  const intact = recordIntegrityVerified === true && record?.schemaVersion === 1 && record.change === change &&
    text(record.goal) && ((count(record.cumulativeCycles) && text(record.countReference)) || perCycle) &&
    latest && sameInputs(latest.inputs, inputs) && record.entries.every(validEntry);
  if (!intact) {
    if (recovery?.verified === true && text(recovery.reference)) {
      if (count(recovery.cumulativeCycles)) return { action: "validate-and-review", cumulativeCycles: recovery.cumulativeCycles, requireCycleAuthorization: false, reference: recovery.reference };
      if (recovery.mode === "per-cycle") return { action: "validate-and-review", cumulativeCycles: null, requireCycleAuthorization: true, reference: recovery.reference };
    }
    return { action: "operator-disposition", cumulativeCycles: null, reason: "Review acceptance invalid; recover cumulative count from retained external reports or retain an operator disposition" };
  }
  const findings = new Map();
  for (const entry of record.entries) {
    for (const finding of [...(entry.correction?.finding ? [entry.correction.finding] : []), ...entry.findings]) {
      // Anonymous findings cannot be silently matched to a later disposition.
      findings.set(text(finding?.id) ? finding.id : Symbol(), finding);
    }
  }
  const ready = latest.automaticCycle === false && completeNoFindings(latest) && [...findings.values()].every(resolvedFinding);
  return { action: ready ? "freeze-ready" : "resolve-findings", cumulativeCycles: record.cumulativeCycles,
    requireCycleAuthorization: Boolean(perCycle), reference: latest.reference, inputs: structuredClone(inputs) };
}

export function planningCorrection({ goal, frozen, finding, currentInputs, authorizedPaths, cumulativeCycles, repeated, contradictory, cycleAuthorization }) {
  const result = { action: "operator-disposition", goal, cumulativeCycles, finding: { ...structuredClone(finding), blocking: true } };
  if (!text(goal) || frozen !== false || finding?.classification !== "routine" || !text(finding.id) ||
      !sameInputs(finding.inputs, currentInputs) || !text(finding.evidence)) return result;
  if (repeated !== false || contradictory !== false ||
      (cumulativeCycles !== null && (!Number.isSafeInteger(cumulativeCycles) || cumulativeCycles < 0 || cumulativeCycles >= 8))) return result;
  if (finding.disposition === "unfounded" && text(finding.reason)) {
    return { ...result, action: "retain-unfounded", finding: { ...result.finding, blocking: false } };
  }
  if (!text(finding.remedy) || !list(finding.paths) || !Array.isArray(authorizedPaths) ||
      !finding.paths.every((name) => authorizedPaths.includes(name)) || repeated !== false || contradictory !== false) return result;
  if (cumulativeCycles === null) {
    if (cycleAuthorization?.verified !== true || !text(cycleAuthorization.reference) ||
        cycleAuthorization.findingId !== finding.id || !sameInputs(cycleAuthorization.inputs, currentInputs)) return result;
  } else if (!Number.isSafeInteger(cumulativeCycles) || cumulativeCycles < 0 || cumulativeCycles >= 8) return result;
  return { ...result, action: "apply-validate-review", cumulativeCycles: cumulativeCycles === null ? null : cumulativeCycles + 1,
    cycleAuthorization: cumulativeCycles === null ? structuredClone(cycleAuthorization) : null };
}

export function outcomePacket({ group, authority, workerSession }) {
  requireThat(group && authority, "Missing outcome authority");
  requireThat(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(group.change ?? "") && text(group.group), "Missing outcome identity");
  for (const field of ["outcome", "workspace", "stop"]) requireThat(text(group[field]), `Missing outcome ${field}`);
  for (const field of ["acceptance", "scope", "nonGoals"]) requireThat(list(group[field]), `Missing outcome ${field}`);
  const budget = group.budget ?? authority.budget;
  requireThat(budget && Number.isSafeInteger(budget.limit) && budget.limit > 0 && text(budget.unit), "Missing finite outcome budget");
  requireThat(authority.change === group.change && authority.group === group.group, "Outcome authority scope mismatch");
  requireThat(sha(authority.plan) && digest(authority.planDigest), "Missing approved plan identity");
  requireThat(text(authority.approvalReference) && text(authority.executionReference), "Missing approval or execution authority");
  requireThat(text(authority.orchestrator) && authority.writer === authority.orchestrator, "Conflicting progress/Git writer");
  requireThat(authority.ownershipVerified === true, "Unverified ownership");
  requireThat(text(workerSession) && workerSession !== authority.orchestrator, "Worker must be a distinct session");
  return structuredClone({
    outcome: { ...group, budget }, authority, workerSession,
    taskAuthority: `openspec/changes/${group.change}/tasks.md`,
    progressWriter: authority.orchestrator,
    forbidden: ["tasks", "git", "profiles", "remote", "subagents", "multiplexers"],
  });
}

export function correctionDecision(request) {
  const { actor, orchestrator, kind, frozen, grant, qualifiedImplementer } = request;
  const stop = { action: "operator-disposition", goal: request.goal, cumulativeCycles: request.cumulativeCycles,
    executionAuthorized: false, finding: { ...structuredClone(request.finding), blocking: true } };
  if (!text(orchestrator) || actor !== orchestrator || !["planning", "source", "test", "implementation-documentation"].includes(kind) ||
      typeof frozen !== "boolean" || request.nativeInput !== false || request.identityVerified !== true ||
      ![request.groupBudgetRemaining, request.authorityBudgetRemaining].every((n) => Number.isFinite(n) && n > 0) ||
      !["write", "validate", "review"].every((p) => grant?.[p] === true)) return stop;
  if (kind === "planning" && frozen && (grant.planningAmendment !== true || grant.successorFreeze !== true)) return stop;
  if (kind !== "planning" && (!text(qualifiedImplementer) || qualifiedImplementer === orchestrator || grant.launch !== true)) return stop;
  const decision = planningCorrection({ ...request, frozen: false });
  if (decision.action === "operator-disposition") return stop;
  return { ...decision, writer: kind === "planning" ? orchestrator : qualifiedImplementer,
    action: decision.action === "retain-unfounded" ? decision.action : kind === "planning" ?
      (frozen ? "amend-validate-freeze-review" : "apply-validate-review") : "dispatch-implementer",
    requiresExactPlanApproval: kind === "planning", executionAuthorized: false };
}

export function acceptSuccessorReview({ change, identity, receipt, currentInputs, currentPackageHashes, chain, validation }) {
  inventory(change, identity?.inputs);
  requireThat(sha(identity.plan) && sha(identity.tree) && digest(identity.planDigest), "Missing successor identity");
  const hashes = (v) => v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length > 0 && Object.values(v).every(digest);
  requireThat(chain?.verified === true && chain.preservationVerified === true && text(chain.reference) && hashes(chain.superseded), "Missing verified append-only preservation chain");
  requireThat(receipt && ["plan", "tree", "planDigest"].every((k) => receipt[k] === identity[k]) &&
    sameInputs(receipt.inputs, identity.inputs) && sameInputs(currentInputs, identity.inputs), "Successor review identity/input drift");
  requireThat(hashes(receipt.packageHashes) && sameInputs(receipt.packageHashes, currentPackageHashes), "Review package hash drift");
  requireThat(text(receipt.model) && text(receipt.reference) && text(receipt.authorSession) && text(receipt.reviewerSession) &&
    receipt.authorSession !== receipt.reviewerSession && receipt.readOnly === true && completeNoFindings(receipt), "Missing complete independent successor verdict");
  requireThat(validation?.plan === identity.plan && validation.exitCode === 0 && text(validation.reference) &&
    sameInputs(validation.inputs, identity.inputs), "Missing retained successful successor validation");
  return { action: "freeze-ready", inputs: structuredClone(identity.inputs), reference: receipt.reference,
    plan: identity.plan, planDigest: identity.planDigest, planApproved: false, executionAuthorized: false };
}

export function candidateReviewPacket({ group, authority, implementerSession, reviewerSession, head, base, gates }) {
  requireThat(text(implementerSession) && text(reviewerSession) && implementerSession !== reviewerSession, "Missing independent reviewer session");
  const packet = outcomePacket({ group, authority, workerSession: reviewerSession });
  requireThat(sha(head) && sha(base), "Missing frozen candidate/base identity");
  requireThat(Array.isArray(gates) && gates.length > 0 && gates.every((gate) =>
    gate && text(gate.command) && gate.commit === head && gate.exitCode === 0 && text(gate.evidence)), "Missing, failed or wrong-candidate gate evidence");
  return { ...packet, head, base, implementerSession, reviewerSession, gates: structuredClone(gates), forbidden: [...packet.forbidden, "edits", "persistence"] };
}

export function acceptCandidateReview({ packet, review, currentHead, currentPlanDigest }) {
  candidateReviewPacket({ ...packet, group: packet.outcome });
  requireThat(review?.reviewerSession === packet.reviewerSession && review.readOnly === true && text(review.reference), "Missing independent read-only review evidence");
  requireThat(currentHead === packet.head && review.head === packet.head && currentPlanDigest === packet.authority.planDigest &&
    review.planDigest === packet.authority.planDigest, "Candidate or plan changed after review");
  requireThat(completeNoFindings(review), "Missing complete literal no-findings candidate review");
  return { accepted: true, head: packet.head, planDigest: packet.authority.planDigest, reference: review.reference, publicationAuthorized: false };
}

// Structural checks over retained observations; never launches or authenticates a reviewer.
const need = (ok, message) => { if (!ok) throw new Error(message); };
const strings = (v) => Array.isArray(v) && v.every(text) && new Set(v).size === v.length;
const equal = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
function canonical(v) {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical(v[k])]));
  return v;
}
function validateFixed(r) {
  need(r?.schemaVersion === 1 && text(r.goal) && text(r.change) && r.passRule === 'charter-v1' && Number.isSafeInteger(r.budget) && r.budget > 0 && r.budget <= 3, 'Invalid fixed terms');
  need(r.charter && ['clauses', 'boundaries', 'tasks', 'gates'].every((k) => strings(r.charter[k])) && r.charter.clauses.length > 0, 'Invalid charter');
  const b = r.binding;
  need(b && equal(Object.keys(b).sort(), ['client', 'independent', 'model', 'permissions', 'qualified', 'readOnly', 'route']) && b.route === 'terminal-adapter' && b.qualified === true && b.independent === true && b.readOnly === true && text(b.client) && isRecordQualified(CANDIDATE_RECORDS[b.client], b.client) && CANDIDATE_RECORDS[b.client].roles.includes('approach-reviewer') && text(b.model) && equal(b.permissions, ['read']), 'Unqualified review binding');
  need(Number.isSafeInteger(r.cumulativeCycles) && r.cumulativeCycles >= 0 && r.cumulativeCycles <= r.budget && Array.isArray(r.entries) && Array.isArray(r.ledger), 'Invalid continuity record');
}
export function startConvergenceReview({ change, goal, charter, binding, passRule, budget }) {
  const record = { schemaVersion: 1, change, goal, charter, binding, passRule, budget, cumulativeCycles: 0, entries: [], ledger: [] };
  validateFixed(record);
  need(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(change), 'Invalid change');
  return structuredClone(record);
}
export function convergencePacket({ record, inputs, packetHashes, authorSession, reviewerSession, correction }) {
  validateFixed(record); inventory(record.change, inputs);
  need(packetHashes && typeof packetHashes === 'object' && !Array.isArray(packetHashes) && Object.keys(packetHashes).length > 0 && Object.entries(packetHashes).every(([k, v]) => text(k) && /^[a-f0-9]{64}$/.test(v)), 'Missing packet hashes');
  need(text(authorSession) && text(reviewerSession) && authorSession !== reviewerSession && !record.entries.some((e) => e.reviewerSession === reviewerSession), 'Reviewer session must be fresh and independent');
  need(record.entries.filter((e) => equal(e.inputs, inputs) && e.coverageLimitations.some((l) => l.class === 'packet-gap')).length < 2, 'Packet-gap retry exhausted for planning snapshot');
  const latest = record.entries.at(-1);
  if (latest && !equal(latest.inputs, inputs)) {
    need(correction?.verified === true && text(correction.reference) && correction.strictExitCode === 0 && correction.metadataExitCode === 0 && equal(correction.beforeInputs, latest.inputs) && equal(correction.amendedInputs, inputs) && record.cumulativeCycles < record.budget, 'Missing validated plan correction');
  } else need(correction === undefined, 'Unexpected plan correction');
  const identity = { change: record.change, goal: record.goal, charter: record.charter, binding: record.binding, passRule: record.passRule, budget: record.budget, cumulativeCycles: record.cumulativeCycles, inputs, packetHashes, authorSession, reviewerSession, model: record.binding.model, ledger: record.ledger, correction: correction ?? null };
  return structuredClone({ identity });
}
function validFinding(f, charter, outside) {
  return f && text(f.id) && ['High', 'Medium', 'Low'].includes(f.severity) && text(f.path) && Number.isSafeInteger(f.line) && f.line > 0 && text(f.impact) && text(f.trigger) && text(f.remedy) &&
    (outside ? f.scopeDisposition === 'outside-charter' && f.clause === null : charter.clauses.includes(f.clause));
}
export function acceptConvergenceReview({ record, packet, review, currentInputs, currentPacketHashes, recordIntegrityVerified }) {
  need(recordIntegrityVerified === true, 'Unverified retained record');
  const i = packet?.identity;
  need(i, 'Missing packet');
  const expected = convergencePacket({ record, inputs: i.inputs, packetHashes: i.packetHashes, authorSession: i.authorSession, reviewerSession: i.reviewerSession, ...(i.correction ? { correction: i.correction } : {}) });
  need(equal(packet, expected) && equal(review?.identity, i) && equal(currentInputs, i.inputs) && equal(currentPacketHashes, i.packetHashes), 'Review identity or input drift');
  need(review.readOnly === true && text(review.reference) && Array.isArray(review.findings) && Array.isArray(review.observations) && Array.isArray(review.coverageLimitations) && Array.isArray(review.ledgerChecks), 'Incomplete receipt');
  need(['Verdict: No findings', 'Verdict: Findings'].includes(review.verdict) && (review.verdict === 'Verdict: No findings') === (review.findings.length === 0), 'Contradictory verdict');
  const all = [...review.findings, ...review.observations];
  need(review.findings.every((f) => validFinding(f, record.charter, false)) && review.observations.every((f) => validFinding(f, record.charter, true)) && new Set(all.map((f) => f.id)).size === all.length, 'Invalid findings');
  const next = structuredClone(record);
  const open = next.ledger.filter((f) => f.status === 'open');
  need(review.ledgerChecks.length === open.length && new Set(review.ledgerChecks.map((c) => c.id)).size === open.length && open.every((f) => review.ledgerChecks.some((c) => c.id === f.id)), 'Incomplete ledger checks');
  for (const c of review.ledgerChecks) {
    const f = open.find((x) => x.id === c.id);
    need(f && ['persistent', 'regression', 'resolved'].includes(c.status), 'Invalid ledger check');
    if (c.status === 'resolved') {
      need((c.disposition === 'applied' && text(c.evidence) && c.reReviewReference === review.reference) || (c.disposition === 'unfounded' && text(c.evidence) && text(c.reason)), 'Invalid disposition');
      f.status = 'resolved'; f.dispositions.push(structuredClone(c));
    } else f.dispositions.push(structuredClone(c));
  }
  for (const f of all) {
    const old = next.ledger.find((x) => x.id === f.id);
    if (old) {
      need(old.severity === f.severity && old.scope === (review.findings.includes(f) ? 'in-scope' : 'outside-charter') && (old.status === 'open' || f.regression === true), 'Finding identity or severity changed');
      if (old.status === 'resolved') { old.status = 'open'; old.dispositions.push({ status: 'regression', reference: review.reference }); }
    } else next.ledger.push({ ...structuredClone(f), scope: review.findings.includes(f) ? 'in-scope' : 'outside-charter', status: 'open', dispositions: [] });
  }
  let gap = false, bad = false;
  for (const l of review.coverageLimitations) {
    need(l && text(l.class), 'Invalid limitation');
    if (l.class === 'packet-gap') { need(text(l.detail), 'Missing packet gap detail'); gap = true; }
    else if (l.class === 'declared-deferral') { if (!((text(l.task) && record.charter.tasks.includes(l.task)) || (text(l.gate) && record.charter.gates.includes(l.gate)))) bad = true; }
    else if (l.class === 'containment-boundary') { if (!record.charter.boundaries.includes(l.boundary)) bad = true; }
    else bad = true;
  }
  const priorGap = record.entries.some((e) => equal(e.inputs, i.inputs) && e.coverageLimitations.some((l) => l.class === 'packet-gap'));
  if (i.correction) next.cumulativeCycles++;
  next.entries.push({ inputs: structuredClone(i.inputs), authorSession: i.authorSession, reviewerSession: i.reviewerSession, reference: review.reference, coverageLimitations: structuredClone(review.coverageLimitations), receipt: structuredClone(review) });
  const blockers = next.ledger.some((f) => f.status === 'open' && f.scope === 'in-scope' && f.severity !== 'Low');
  const action = gap && !priorGap && !bad ? 'repair-packet' : gap || bad || blockers ? 'blocked' : 'freeze-ready';
  return { action, record: next, planApproved: false, executionAuthorized: false, remoteAuthorized: false };
}
