// Read back the independently pinned exclusive worker runtime. No worker or
// reviewer starts, recovery publication, registry creation or slot release.
import { lstat, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ancestor, changedFiles, checkoutObservation, committedOutputHashes, planning } from "./change-guard.mjs";
import { withinScope } from "./delivery-control.mjs";
import { readBounded, scopedPath, separate, sha256, stableJson } from "./evidence-retention.mjs";
import { planningLayout } from "./planning-inventory.mjs";

const need = (condition, message) => { if (!condition) throw new Error(message); };
const same = (left, right) => stableJson(left) === stableJson(right);
const digest = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const exists = async (file) => {
  try { await lstat(file); return true; }
  catch (error) { if (error.code === "ENOENT") return false; throw error; }
};

// This allowlist is local to delivery so verification never loads companion code.
const runtimeSources = [
  "bounded-worker.mjs", "bounded-worker.py", "implementer-bindings.mjs", "implementer-claims.mjs",
  "implementer-observations.mjs", "implementer-recovery.mjs", "implementer-runtime.mjs", "implementer-sandbox.mjs",
  "implementer-state.mjs", "implementer-supervisor.mjs", "implementer-supervisor.py", "orchestration-core.mjs",
  "review-admission.mjs", "review-archive.mjs", "review-candidate.mjs", "review-inputs.mjs", "review-relay.mjs",
  "review-runtime-scratch.mjs", "review-runtime.mjs", "review-sandbox-bridge.mjs", "review-stream.mjs",
  "run-implementer.mjs", "terminal-adapters.mjs", "worker-handoff.mjs", "worker-runtime-policy.mjs",
];

function verifyRuntimeInventory(selected, scripts) {
  need(digest(selected.verifierSha256) && digest(selected.runtimeSha256), "Independent implementer package pin is missing");
  const inventory = Object.fromEntries(runtimeSources.map((name) => {
    const filename = path.join(scripts, name);
    return [name, sha256(readBounded(filename, 64 * 1024))];
  }));
  need(inventory["run-implementer.mjs"] === selected.verifierSha256, "Independent implementer launcher pin changed");
  need(sha256(stableJson(inventory) + "\n") === selected.runtimeSha256, "Exclusive runtime inventory changed");
  return inventory;
}

export async function readDelegation(input, { context, policy, identity, implementation, goal }, registryOverride) {
  need(process.platform === "linux", "Exclusive runtime requires a qualified Linux host");
  const selected = input.delegation;
  need(selected, "Selected exclusive runtime requires a pinned assignment and companion");
  const verifier = scopedPath(selected?.verifier);
  const scripts = path.dirname(verifier);
  need(path.basename(verifier) === "run-implementer.mjs" &&
    [input.repo, identity.workspace].every((root) => separate(root, scripts)), "Independent implementer package is outside its allowed location");
  const inventory = verifyRuntimeInventory(selected, scripts);
  const load = (name) => import(pathToFileURL(path.join(scripts, name + ".mjs")).href);
  const [runtime, state, claims, worker, bindings, handover, recovery, observations, encoding, reviewer] = await Promise.all(
    ["implementer-runtime", "implementer-state", "implementer-claims", "worker-runtime-policy", "implementer-bindings",
      "worker-handoff", "implementer-recovery", "implementer-observations", "review-inputs", "review-candidate"].map(load));
  const registry = registryOverride ?? claims.defaultRegistry();
  await handover.safePath(registry, true);
  if (await exists(registry)) await state.privateDirectory(registry);
  const entry = await state.trustedJson(selected.assignment);
  need(entry.schemaVersion === 1 && Object.keys(entry).length === 2 &&
    Array.isArray(entry.assignments) && entry.assignments.length === 1,
    "Delivery requires one independently retained assignment");
  const assignment = entry.assignments[0];
  worker.validateInvocation(assignment);
  const request = assignment.request;
  const id = request.identity;
  const repository = claims.repositoryIdentity(identity.workspace);
  need([input.repo, identity.workspace, ...request.evidenceRoots, registry].every((root) =>
    separate(root, selected.assignment.path) && separate(root, scripts)), "Runtime or assignment overlaps protected or mutable state");
  need(id.change === identity.change && id.workspace === identity.workspace && id.plan === identity.plan &&
    id.planDigest === identity.planDigest && same(id.inputs, context.inputs) &&
    assignment.approval.path === input.approval?.reference && assignment.grant.path === input.grant?.reference,
  "Worker request differs from the active plan, checkout or authority");
  const { approval, grant, inference } = await worker.loadAuthority(assignment, repository);
  need(grant.mode === policy.mode && grant.policyRevision === policy.policyRevision &&
    grant.branch === `refs/heads/${implementation.branch}` &&
    (policy.mode !== "goal-first" || goal && request.mutablePaths.every((file) => withinScope(file, goal.contract.scope))),
  "Runtime grant differs from integrated policy, branch, stop or scope");
  const noCommits = input.restrictions?.noCommits === true || request.restrictions.includes("no commits");
  const groupRestrictions = request.restrictions.filter((item) => item.startsWith("group:"));
  need(groupRestrictions.length <= 1 && (!groupRestrictions.length ||
    groupRestrictions[0] === `group:${input.restrictions?.group}`), "Retained delegated group restriction differs");
  const roles = await bindings.bindPair(assignment, grant, selected.runtimeSha256, registry);
  const directory = claims.claimPath(registry, repository, id.change);
  const owner = await exists(directory) ? await state.readState(directory, "owner.json") : null;
  const reviewerInventorySha256 = sha256(encoding.jsonBytes(roles.pair.reviewer.inventory));
  const verifiedApproval = { ...identity, schemaVersion: 1, verified: true, approved: approval.approved,
    kind: approval.kind, mode: approval.mode, policyRevision: approval.policyRevision, reference: assignment.approval.path };
  const verifiedGrant = { ...identity, schemaVersion: 1, verified: true, kind: grant.kind, mode: grant.mode,
    policyRevision: grant.policyRevision, reference: assignment.grant.path, approvalReference: assignment.approval.path,
    localOnly: grant.localOnly, stop: grant.stop, commits: grant.commits === true,
    budgets: { minutes: grant.limits.totalMs / 60000, corrections: grant.limits.corrections },
    budget: { limit: Math.ceil(grant.limits.totalMs / 60000), unit: "minutes" } };
  const data = { id, request, grant, roles, scripts, noCommits, owner, state, directory, history: [],
    repository, registry, reviewerInventorySha256, verifiedApproval, verifiedGrant,
    reviewCommand: reviewer.reviewCommand, reviewVerifierSha256: inventory["review-candidate.mjs"] };

  if (owner) {
    const expected = runtime.retainedIdentity(assignment, repository);
    need(Object.entries(expected).every(([key, value]) => owner[key] === value) &&
      !await state.readState(directory, "claim-release.json", true), "Exclusive claim belongs to another or closed assignment");
    const attempts = (await readdir(directory)).filter((name) => name.startsWith("attempt-"));
    need(attempts.length <= 128, "Retained runtime history exceeds the finite bound");
    data.history = (await Promise.all(attempts.map(async (name) => {
      const launch = await state.readState(path.join(directory, name), "launch.json");
      need(name === "attempt-" + launch.attempt && launch.claimId === owner.claimId && launch.change === id.change &&
        launch.workspace === id.workspace && Number.isSafeInteger(launch.startedAt) && launch.startedAt >= owner.createdAt,
      "Retained attempt history has a conflicting owner or launch");
      return launch;
    }))).sort((left, right) => left.sequence - right.sequence);
    need(data.history.every((launch, index) => launch.sequence === index &&
      launch.predecessor === (data.history[index - 1]?.attempt ?? null)), "Retained runtime attempt order is uncertain");
  }
  if (input.deliveryPhase === "dispatch") {
    const now = Date.now();
    const groupStartedAt = data.history.find((launch) => launch.task === id.task)?.startedAt ?? now;
    need(now + grant.limits.timeoutMs + 28000 <= Math.min(grant.expiresAt, roles.expiresAt, inference.expiresAt,
      (owner?.createdAt ?? now) + grant.limits.totalMs, groupStartedAt + grant.limits.groupMs),
      "Delegated execution window is exhausted");
    need(id.predecessor === null ? !owner && grant.continuation === null : owner && grant.continuation,
      "Original assignment must be reconciled before dispatch");
    if (owner) need(data.history.at(-1)?.attempt === id.predecessor &&
      data.history.every((launch) => launch.attempt !== id.attempt && launch.pair.reviewer.session !== roles.pair.reviewer.session),
    "Successor is stale or reuses a retained role attempt");
    await worker.checkCheckout(request, grant);
    return { ...data, phase: "dispatch", continuation: grant.continuation ? await state.trustedJson(grant.continuation) : null };
  }
  need(owner, "Exclusive assignment claim is missing");
  const attemptDirectory = path.join(directory, "attempt-" + id.attempt);
  const launch = data.history.at(-1);
  need(launch?.attempt === id.attempt, "Original launch is missing or superseded");
  const observation = await runtime.observeImplementer(assignment, { registry, action: "inspect" });
  if (observation.phase === "blocked") throw new Error(observation.reason);
  const view = await recovery.currentAttempt(attemptDirectory, launch);
  need(view.phase === observation.phase && (view.state.session?.session ?? null) === observation.session,
    "Original attempt changed during readback");
  data.phase = view.phase;
  const slot = claims.slotPath(registry, launch.slot);
  const release = await state.readState(attemptDirectory, "slot-release.json", true);
  const reservation = release ? `${slot}-retired-${launch.claimId}-${launch.attempt}` : slot;
  need(same(await state.readState(reservation, "reservation.json"), launch.reservation), "Original role reservation differs");
  const retired = await state.readState(reservation, "released.json", true);
  need(release ? view.phase === "settled" && retired?.proofSha256 === release.releaseSha256 : retired === null,
    "Role slot release is unsettled or inconsistent");
  if (["running", "operator-input"].includes(view.phase) && observation.session) {
    return { ...data, active: { identity: id, session: observation.session, state: view.phase === "running" ? "working" : "waiting" } };
  }
  if (view.phase !== "settled") return data;
  const settlementSha256 = sha256(encoding.jsonBytes(view.state.settlement));
  need(!release || release.settlementSha256 === settlementSha256, "Role slot release names a different settlement");
  const publication = await state.readState(attemptDirectory, "publication.json", true);
  if (!publication) return { ...data, phase: "recovery-pending" };
  const session = view.state.session?.session;
  need(session && ![request.authority.authorSession, request.authority.orchestrator, roles.pair.reviewer.session].includes(session),
    "Original native session is missing or conflicts with another role");
  if (id.predecessor !== null) {
    const predecessor = await state.readState(path.join(directory, "attempt-" + id.predecessor), "publication.json");
    need(predecessor.runtime.session !== session, "Successor resumed the preceding native session");
  }
  const binding = bindings.effectiveRole(roles.pair.implementer, "implementer", request, session, roles);
  const expected = { directory: request.evidenceRoots[0], request, requestSha256: launch.requestSha256 };
  const { result } = await handover.readHandoff({ expected, runtime: binding });
  const resultSha256 = sha256(await handover.readClosed(path.join(expected.directory, "result.json"), undefined, true));
  const captured = observations.captureObservation(view.state, grant.limits);
  const native = observations.auditCodexCapture(view.state, captured, grant.limits);
  const captureHashes = new Map(result.evidence.map(({ path: file, sha256: hash }) => [path.basename(file), hash]));
  const nativeBytes = native.report === null ? Buffer.alloc(0) : Buffer.from(native.report + "\n");
  need(publication.resultSha256 === resultSha256 && publication.settlementSha256 === settlementSha256 &&
    same(publication.runtime, binding) && publication.status === result.status && native.status === result.status &&
    publication.reason === native.reason && same(captured.completion, result.completion) &&
    captureHashes.get("stdout.jsonl") === sha256(captured.stdout) && captureHashes.get("stderr.log") === sha256(captured.stderr) &&
    captureHashes.get("native.txt") === sha256(nativeBytes) &&
    publication.nativeSha256 === (native.report === null ? null : sha256(nativeBytes)) &&
    captureHashes.get("launch.json") === sha256(encoding.jsonBytes({
      ...launch, worker: view.state.worker.process, supervisor: view.state.supervisor.process, session,
    })),
  "Original sealed result and supervisor settlement disagree");
  return { ...data, result, settlementSha256, resultSha256, reason: native.reason,
    progressSha256: publication.nativeSha256, launch, process: view.state.worker.process, release,
    checkWorkingOutputs: () => readWorkingOutputs(observations, state, request, grant, attemptDirectory) };
}

async function readWorkingOutputs(observations, state, request, grant, attemptDirectory) {
  return observations.verifyPostWorker(request, grant, await state.readState(attemptDirectory, "git-state.json"));
}

export async function verifyWorkerScope(delegation, snapshot, implementation) {
  const { request, result, grant, id } = delegation;
  const files = Object.keys(result.outputs);
  need(files.every((file) => request.mutablePaths.includes(file)), "Sealed worker outputs exceed admitted paths");
  if (!snapshot) {
    need(same(await delegation.checkWorkingOutputs(), result.outputs), "Worktree differs from sealed worker outputs");
    return;
  }
  const { workspace, head } = implementation;
  need(snapshot.head === head, "Candidate is stale");
  checkoutObservation(workspace, head);
  ancestor(workspace, grant.head, head);
  const tasksFile = planningLayout(id.change).directory + "/tasks.md";
  const changed = changedFiles(workspace, grant.head, head).filter((file) => file !== tasksFile);
  need(same(changed, files.sort()) &&
    same(committedOutputHashes(workspace, head, changed, 8 * 1024 * 1024), result.outputs),
  "Candidate diff or bytes differ from sealed worker outputs");
  const launchTasks = planning(workspace, grant.head, id.change);
  const current = planning(workspace, head, id.change);
  need(launchTasks.digest === current.digest && current.taskStates.every(({ id: task, checked }, index) =>
    checked === launchTasks.taskStates[index]?.checked || task === id.task && checked),
  "Native progress exceeds the admitted action or changes planning");
}

export async function verifyPairedReview(delegation, handoff, input) {
  const { result, request, roles } = delegation;
  const reviewed = handoff?.result;
  const role = roles.pair.reviewer;
  const session = reviewed.runtime.session;
  const pin = input.handover.reviewSessionBinding;
  need(typeof session === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(session),
    "Invalid reviewer session identity");
  const bindingPath = path.join(path.dirname(delegation.verifiedGrant.reference), `review-session-${session}.json`);
  const locations = [input.repo, request.identity.workspace, reviewed.identity.workspace, delegation.registry,
    input.handover.output, input.handover.exportDirectory, role.slot, ...request.evidenceRoots];
  need(pin?.path === bindingPath && locations.every((root) => separate(root, pin.path)),
    "Review session authority is missing or outside its unique retained location");
  const record = await delegation.state.trustedJson(pin);
  const identity = {
    schemaVersion: 1, kind: "exclusive-review-session", claimId: delegation.owner.claimId,
    change: request.identity.change, plan: request.identity.plan, planDigest: request.identity.planDigest,
    attempt: request.identity.attempt, candidate: reviewed.identity.candidate, orchestrator: request.authority.orchestrator,
    originalSession: role.session, session, maxRuns: 1,
    configurationSha256: role.configuration.sha256, inventorySha256: delegation.reviewerInventorySha256,
    requestFileSha256: input.handover.requestFileSha256, expectFileSha256: input.handover.expectFileSha256,
  };
  need(Object.entries(identity).every(([key, value]) => record[key] === value) &&
    typeof record.reviewAuthority === "string" && record.reviewAuthority.trim() &&
    delegation.history.every((launch) => launch.attempt === identity.attempt || launch.pair.reviewer.session !== session) &&
    ![request.authority.authorSession, request.authority.orchestrator, result.runtime.session].includes(session),
  "Reviewer session lacks exact single-run authority or reuses a retained session");
  need(handoff?.reviewSnapshot && reviewed.identity.predecessor === request.identity.attempt &&
    reviewed.identity.implementerSession === result.runtime.session &&
    reviewed.identity.group === request.identity.group && reviewed.identity.task === request.identity.task &&
    handoff.request.authority.orchestrator === request.authority.orchestrator &&
    handoff.request.authority.authorSession === request.authority.authorSession &&
    handoff.request.outcome === request.outcome &&
    request.acceptance.every((criterion) => handoff.request.acceptance.includes(criterion)) &&
    request.nonGoals.every((excluded) => handoff.request.nonGoals.includes(excluded)) &&
    same(handoff.request.scope, request.scope) &&
    reviewed.runtime.client === role.client &&
    reviewed.runtime.version === role.version && reviewed.runtime.provider === role.provider &&
    reviewed.runtime.model === role.model && reviewed.runtime.configurationSource === role.configuration.sha256 &&
    reviewed.runtime.configurationScope === "contained-review" && reviewed.runtime.readOnly === true,
  "Review does not match the pinned independent role or original implementer");
}
