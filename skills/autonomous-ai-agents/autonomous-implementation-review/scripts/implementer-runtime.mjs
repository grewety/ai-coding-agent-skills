import { randomUUID } from "node:crypto";
import { readdir, rename } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readClosed, createAttempt, requestBytes, safePath } from "./worker-handoff.mjs";
import { digest, equal, hash, jsonBytes, need, separate, sha } from "./review-inputs.mjs";
import { bindPair } from "./implementer-bindings.mjs";
import { acquireClaim, claimPath, defaultRegistry, exclusiveOperation, openRegistry, repositoryIdentity, reserveSlot,
  retireReservation, serializedOperation, slotPath } from "./implementer-claims.mjs";
import { currentAttempt, handoffFor, supervisorBinding } from "./implementer-recovery.mjs";
import { buildCodexLaunch, smokeCheck } from "./implementer-sandbox.mjs";
import { cancelSupervisor, operationProcess, startSupervisor } from "./implementer-supervisor.mjs";
import { identifier, newDirectory, privateDirectory, readState, syncDirectory, trustedJson, writeState } from "./implementer-state.mjs";
import { checkCheckout, checkoutProtectedPaths, gitState, loadAuthority, maximumBatch, validateInvocation } from "./worker-runtime-policy.mjs";

const packageRoot = fileURLToPath(new URL("../", import.meta.url)).replace(/\/$/, "");
const runtimeSources = [
  "bounded-worker.mjs", "bounded-worker.py", "implementer-bindings.mjs", "implementer-claims.mjs",
  "implementer-observations.mjs", "implementer-recovery.mjs", "implementer-runtime.mjs", "implementer-sandbox.mjs",
  "implementer-state.mjs", "implementer-supervisor.mjs", "implementer-supervisor.py", "orchestration-core.mjs",
  "review-admission.mjs", "review-archive.mjs", "review-candidate.mjs", "review-inputs.mjs", "review-relay.mjs",
  "review-runtime-scratch.mjs", "review-runtime.mjs", "review-sandbox-bridge.mjs", "review-stream.mjs",
  "run-implementer.mjs", "terminal-adapters.mjs", "worker-handoff.mjs", "worker-runtime-policy.mjs",
];

export async function runtimeIdentity() {
  const sources = await Promise.all(runtimeSources.map(async (name) =>
    [name, hash(await readClosed(fileURLToPath(new URL(name, import.meta.url)), 64 * 1024))]));
  return hash(jsonBytes(Object.fromEntries(sources)));
}

export function retainedIdentity(entry, repository) {
  const { change, workspace, plan, planDigest } = entry.request.identity;
  return { repository, change, workspace, plan, planDigest, orchestrator: entry.request.authority.orchestrator,
    authorSession: entry.request.authority.authorSession, approvalSha256: entry.approval.sha256 };
}

async function claimOwnerFor(directory, entry, repository) {
  const owner = await readState(directory, "owner.json");
  const expected = retainedIdentity(entry, repository);
  need(Object.entries(expected).every(([field, value]) => owner[field] === value), "Claim belongs to another assignment");
  return owner;
}

const historyNames = async (directory) => {
  const names = (await readdir(directory)).filter((name) => name.startsWith("attempt-")).sort();
  need(names.length <= 128, "Attempt history exceeds the finite bound");
  return names;
};

async function readHistory(directory) {
  return Promise.all((await historyNames(directory)).map((name) => readState(path.join(directory, name), "launch.json")));
}

async function noConcurrentScope(registry, claimDirectory, repository, request) {
  const activeNames = (await readdir(registry)).filter((name) => /^claim-[a-f0-9]{64}$/.test(name));
  need(activeNames.length <= 512, "Host claim inventory exceeds the finite bound");
  for (const name of activeNames) {
    const directory = path.join(registry, name);
    if (directory === claimDirectory) continue;
    const owner = await readState(directory, "owner.json");
    if (owner.repository !== repository) continue;
    for (const launch of await readHistory(directory)) {
      need(launch.mutablePaths.every((existing) => request.mutablePaths.every((next) => separate(existing, next))),
        "Another retained assignment owns overlapping repository paths");
    }
  }
}

function checkRemaining(request, grant, owner, history, expiresAt) {
  const now = Date.now();
  const { timeoutMs, totalMs, groupMs } = grant.limits;
  const previous = history.toSorted((a, b) => a.sequence - b.sequence).at(-1);
  need(!previous || (Object.entries(grant.limits).every(([name, limit]) => limit <= previous.limits[name]) &&
    grant.expiresAt <= previous.grantExpiresAt), "A successor cannot widen retained limits");
  const priorGroup = history.filter((launch) => launch.task === request.identity.task);
  const groupStart = Math.min(now, ...priorGroup.map((launch) => launch.startedAt));
  need(now + timeoutMs <= Math.min(grant.expiresAt, expiresAt, owner.createdAt + totalMs, groupStart + groupMs),
    "Finite grant, assignment or group deadline cannot admit the worker");
  return Math.min(grant.expiresAt, expiresAt, owner.createdAt + totalMs, groupStart + groupMs);
}

function pinnedPair(pair) {
  const { session, ...reviewer } = pair.reviewer;
  return { implementer: pair.implementer, reviewer };
}

async function predecessorCheck(entry, grant, roles, claimDirectory, history) {
  const { predecessor, task, attempt, change, plan, planDigest } = entry.request.identity;
  const latest = history.toSorted((a, b) => a.sequence - b.sequence).at(-1);
  if (predecessor === null) {
    need(!latest && grant.continuation === null, "Original attempt exists or continuation lacks its original predecessor");
    return "initial";
  }
  need(latest?.attempt === predecessor && predecessor !== attempt && grant.continuation, "Attempt predecessor or fresh continuation authority differs");
  const previousDir = path.join(claimDirectory, "attempt-" + predecessor);
  const settlement = await currentAttempt(previousDir, latest);
  const released = await readState(previousDir, "slot-release.json");
  const publication = await readState(previousDir, "publication.json");
  const resultFile = path.join(latest.evidence, "result.json");
  need(hash(await readClosed(resultFile, undefined, true)) === publication.resultSha256, "Original predecessor handoff bytes changed");
  const control = await trustedJson(grant.continuation);
  need(settlement.phase === "settled" && released.settlementSha256 === publication.settlementSha256 &&
    hash(jsonBytes(settlement.state.settlement)) === publication.settlementSha256 &&
    control.schemaVersion === 1 && control.kind === "exclusive-runtime-continuation" &&
    control.change === change && control.plan === plan && control.planDigest === planDigest &&
    control.previousAttempt === predecessor && control.attempt === attempt && control.task === task &&
    control.orchestrator === entry.request.authority.orchestrator &&
    control.priorResultSha256 === publication.resultSha256 && control.priorSettlementSha256 === publication.settlementSha256 &&
    equal(pinnedPair(roles.pair), pinnedPair(latest.pair)) &&
    !history.some((launch) => launch.pair.reviewer.session === roles.pair.reviewer.session),
  "Continuation is not bound to the original settled role pair or a fresh reviewer session");
  if (control.reason === "native-turn-cap") {
    need(latest.task === task && publication.reason === "native-turn-cap" &&
      !history.some((launch) => launch.task === task && launch.transition === "native-turn-cap") &&
      control.verifiedProgress === true && digest(control.progressSha256) &&
      control.progressSha256 === publication.nativeSha256 &&
      hash(await readClosed(path.join(latest.evidence, "native.txt"), undefined, true)) === control.progressSha256, "Native cap allowance or progress is unverified");
  } else if (control.reason === "review-correction") {
    need(latest.task === task && publication.status === "completed" &&
      history.filter((launch) => launch.task === task && launch.transition === "review-correction").length < grant.limits.corrections &&
      sha(control.rejectedCandidate) && control.rejectedCandidate === grant.head && digest(control.reviewSha256) &&
      control.inScopeFinding === true, "Correction history or allowance differs");
  } else {
    need(control.reason === "ordered-successor" && publication.status === "completed" && latest.task !== task &&
      grant.accepted.some((prior) =>
      prior.task === latest.task && prior.candidate === control.acceptedCandidate), "Ordered accepted dependency is missing");
  }
  return control.reason;
}

async function dimensions(context) {
  const { entry, roles, registry, grant } = context;
  const workspace = entry.request.identity.workspace;
  const { codexHome, home, xdg } = roles.pair.implementer;
  const roots = [workspace, registry, entry.request.evidenceRoots[0], codexHome, home, xdg, roles.pair.reviewer.slot,
    ...await checkoutProtectedPaths(workspace)];
  const locations = [entry.approval.path, entry.grant.path, entry.host.path, grant.inference.path,
    ...[grant.continuation?.path, ...grant.accepted.map(({ receipt }) => receipt?.path)].filter(Boolean), ...[roles.pair.implementer, roles.pair.reviewer]
    .flatMap((role) => [role.configuration.path, role.qualification.path, ...role.inventory.map((pin) => pin.path)])];
  for (const loc of locations) need(roots.every((root) => separate(root, loc)), "Trusted runtime/authority locator overlaps protected state");
}

function physicalReservation(claimId, attempt, roles) {
  const { codexHome, home, xdg } = roles.pair.implementer;
  return { claimId, attempt, role: "implementer", slot: roles.physicalSlot,
    profiles: [codexHome, home, xdg].map((name, i) => ({ path: name, id: roles.profileIds[i] })) };
}

const delay = (time) => new Promise((resolve) => setTimeout(resolve, time));
const milestone = (emit, request, phase, detail = {}) => emit({ attempt: request.identity.attempt, change: request.identity.change, phase, ...detail });

function repositoryLock(registry, repository) {
  return path.join(registry, "repo-" + hash(repository));
}

async function withRepositoryLock(registry, repository, callback) {
  const dir = repositoryLock(registry, repository);
  try { await newDirectory(dir); }
  catch (error) { if (error.code !== "EEXIST") throw error; }
  await privateDirectory(dir);
  return serializedOperation(dir, callback);
}

async function prepareAttempt(entry, registry, runtimeSha256, batchSize, emit, runProbe) {
  validateInvocation(entry);
  const { request } = entry;
  const { workspace, change, attempt, predecessor, task } = request.identity;
  need([workspace, ...request.evidenceRoots, registry].every((root) => separate(packageRoot, root)),
    "Packaged launcher overlaps mutable checkout or protected state; use an independently pinned installation");
  await safePath(workspace);
  const repository = repositoryIdentity(workspace);
  const claimDirectory = claimPath(registry, repository, change);
  let owner;
  if (predecessor === null) {
    const claim = await acquireClaim(registry, retainedIdentity(entry, repository));
    if (claim.occupied) return { phase: "occupied", resource: "repository-change" };
    owner = claim.owner;
  } else owner = await claimOwnerFor(claimDirectory, entry, repository);
  milestone(emit, request, "claim-held", { claimId: owner.claimId });
  const { grant, inference } = await loadAuthority(entry, repository);
  need(batchSize <= grant.limits.batchSize && (batchSize === 1 || (predecessor === null && grant.accepted.length === 0)),
    "Batch must contain independently admitted initial assignments");
  const roles = await bindPair(entry, grant, runtimeSha256, registry);
  const context = { entry, grant, roles, registry, repository, claimDirectory, owner, runtimeSha256 };
  await dimensions(context);
  await checkCheckout(request, grant);
  const prepared = await withRepositoryLock(registry, repository, () => exclusiveOperation(claimDirectory, async () => {
    need(await readState(claimDirectory, "claim-release.json", true) === null, "Original assignment has closed");
    const history = await readHistory(claimDirectory);
    const transition = await predecessorCheck(entry, grant, roles, claimDirectory, history);
    await noConcurrentScope(registry, claimDirectory, repository, request);
    const deadline = checkRemaining(request, grant, owner, history, Math.min(roles.expiresAt, inference.expiresAt));
    const binding = physicalReservation(owner.claimId, attempt, roles);
    const nonce = randomUUID();
    const launch = { schemaVersion: 1, repository, workspace, change, task, attempt, predecessor, transition,
      claimId: owner.claimId, nonce, startedAt: Date.now(), sequence: history.length, deadline,
      limits: grant.limits, grantExpiresAt: grant.expiresAt,
      requestSha256: hash(requestBytes(request)), invocationSha256: hash(jsonBytes(entry)), runtimeSha256,
      pair: roles.pair, mutablePaths: request.mutablePaths, reservation: binding, slot: roles.physicalSlot, evidence: request.evidenceRoots[0] };
    const attemptDirectory = path.join(claimDirectory, "attempt-" + attempt);
    await newDirectory(attemptDirectory);
    await writeState(attemptDirectory, "launch.json", launch);
    const slotDirectory = await reserveSlot(registry, roles.physicalSlot, binding);
    if (!slotDirectory) return { phase: "occupied", resource: "physical-role-slot", claimId: owner.claimId };
    const evidence = request.evidenceRoots[0];
    await createAttempt({ directory: evidence, request, excludedRoots: [workspace, registry,
      roles.pair.implementer.home, roles.pair.implementer.xdg, roles.pair.implementer.codexHome, roles.pair.reviewer.slot] });
    return { launch, attemptDirectory, slotDirectory, binding, evidence };
  }));
  if (prepared.phase === "occupied") return prepared;
  const { launch, attemptDirectory, evidence } = prepared;
  milestone(emit, request, "slot-held", { claimId: owner.claimId });
  const smokeDeadline = launch.deadline - grant.limits.timeoutMs;
  need(Date.now() + 28000 <= smokeDeadline, "Finite preflight budget cannot admit native sandbox checks");
  const smoke = await runProbe({ request, role: roles.pair.implementer, registry, attemptDirectory: evidence,
    protectedFile: entry.grant.path, controlDirectory: attemptDirectory });
  await writeState(attemptDirectory, "smoke.json", smoke);
  await checkCheckout(request, grant);
  const refreshed = await loadAuthority(entry, repository);
  need(equal(refreshed.grant, grant) && equal(refreshed.inference, inference), "Execution authority changed after preflight");
  const checkedRoles = await bindPair(entry, grant, runtimeSha256, registry);
  need(equal(checkedRoles, roles), "Paired role runtime changed after native preflight");
  await writeState(attemptDirectory, "git-state.json", await gitState(workspace));
  const native = await buildCodexLaunch(request, roles.pair.implementer, registry, attemptDirectory, launch.nonce);
  need(Date.now() + grant.limits.timeoutMs <= launch.deadline &&
    await runtimeIdentity() === runtimeSha256, "Dispatch deadline or packaged runtime changed before prompt delivery");
  milestone(emit, request, "supervisor-armed", { claimId: owner.claimId });
  const supervisor = await startSupervisor(attemptDirectory, native, supervisorBinding(launch), grant.limits);
  return { ...context, ...prepared, supervisor };
}

function summarize(view) {
  return {
    phase: view.phase, quiescent: view.phase === "settled", session: view.state.session?.session ?? null,
    ...(view.phase === "operator-input" ? { kind: view.state.wait.kind } : {}),
  };
}

async function finish(context) {
  const { attemptDirectory, launch, roles, entry, grant, runtimeSha256, registry } = context;
  const view = await currentAttempt(attemptDirectory, launch);
  if (view.phase !== "settled") return summarize(view);
  const currentRoles = await bindPair(entry, grant, runtimeSha256, registry);
  need(equal(currentRoles, roles), "Role settings, package inventory or profile drifted during the attempt");
  return exclusiveOperation(context.claimDirectory, async () => handoffFor(context, view.state));
}

async function foreground(context, emit) {
  let finished = false;
  const completion = context.supervisor.wait.then((ok) => { finished = true; return ok; });
  const { attemptDirectory, launch, entry, grant } = context;
  let lastPhase;
  let lastUpdate = 0;
  // A foreground failure never starts another process. The original supervisor owns its deadline.
  const until = Math.min(launch.deadline, Date.now() + grant.limits.timeoutMs) + 4000;
  while (!finished && Date.now() <= until) {
    const view = await currentAttempt(attemptDirectory, launch);
    if (view.phase !== lastPhase || Date.now() - lastUpdate >= 15000) {
      milestone(emit, entry.request, view.phase, { session: view.state.session?.session ?? null });
      lastPhase = view.phase;
      lastUpdate = Date.now();
    }
    await Promise.race([completion, delay(100)]);
  }
  return finish(context);
}

function stopped(error) {
  return { phase: "blocked", reason: error instanceof Error ? error.message : "Runtime predicate failed" };
}

export async function runImplementers(entries, {
  registry = defaultRegistry(), emit = () => {}, runProbe = smokeCheck,
} = {}) {
  need(process.platform === "linux" && Array.isArray(entries) && entries.length > 0 && entries.length <= maximumBatch,
    "Unsupported host or invalid foreground batch bound");
  const identifiers = entries.map((entry) => entry?.request?.identity?.attempt);
  need(identifiers.every(identifier) && new Set(identifiers).size === identifiers.length, "Batch attempt mapping is ambiguous");
  const runtimeSha256 = await runtimeIdentity();
  await openRegistry(registry);
  return Promise.all(entries.map(async (entry) => {
    const { change, task, attempt } = entry.request.identity;
    let result;
    try {
      const prepared = await prepareAttempt(entry, registry, runtimeSha256, entries.length, emit, runProbe);
      result = prepared.supervisor ? await foreground(prepared, emit) : prepared;
    } catch (error) { result = stopped(error); }
    milestone(emit, entry.request, result.phase, { reason: result.reason ?? null });
    return { change, task, attempt, ...result };
  }));
}

async function retainedContext(entry, registry) {
  validateInvocation(entry);
  const { workspace, change, attempt } = entry.request.identity;
  await safePath(workspace);
  await privateDirectory(registry);
  const repository = repositoryIdentity(workspace);
  const claimDirectory = claimPath(registry, repository, change);
  const owner = await claimOwnerFor(claimDirectory, entry, repository);
  const attemptDirectory = path.join(claimDirectory, "attempt-" + attempt);
  const launch = await readState(attemptDirectory, "launch.json");
  const runtimeSha256 = await runtimeIdentity();
  need(launch.repository === repository && launch.claimId === owner.claimId && launch.attempt === attempt &&
    launch.requestSha256 === hash(requestBytes(entry.request)) && launch.invocationSha256 === hash(jsonBytes(entry)) &&
    launch.runtimeSha256 === runtimeSha256, "Original retained attempt, runtime or request differs");
  const { grant } = await loadAuthority(entry, repository);
  const roles = await bindPair(entry, grant, runtimeSha256, registry);
  need(equal(roles.pair, launch.pair) && equal(roles.physicalSlot, launch.slot) &&
    equal(physicalReservation(launch.claimId, attempt, roles), launch.reservation), "Original pinned role or physical slot differs");
  return { entry, registry, repository, claimDirectory, attemptDirectory, owner, launch, grant, roles, runtimeSha256 };
}

export async function observeImplementer(entry, { registry = defaultRegistry(), action = "inspect", release = null } = {}) {
  try {
    need(["inspect", "recover", "cancel", "release-slot", "release-claim"].includes(action), "Unknown original-attempt action");
    const context = await retainedContext(entry, registry);
    const { claimDirectory, attemptDirectory, launch } = context;
    const view = await currentAttempt(attemptDirectory, launch);
    if (action === "inspect") return summarize(view);
    if (action === "recover") return await finish(context);
    if (action === "cancel") {
      await cancelSupervisor(attemptDirectory, view.state);
      return { phase: "cancellation-requested", attempt: launch.attempt };
    }
    return await exclusiveOperation(claimDirectory, async () => {
      const receipt = await trustedJson(release);
      const settlementSha256 = view.state.settlement && hash(jsonBytes(view.state.settlement));
      need(view.phase === "settled" && settlementSha256 && receipt.schemaVersion === 1 &&
        receipt.kind === "exclusive-runtime-release" && receipt.action === action && receipt.claimId === launch.claimId &&
        receipt.change === launch.change && receipt.attempt === launch.attempt && receipt.settlementSha256 === settlementSha256 &&
        receipt.orchestrator === entry.request.authority.orchestrator && receipt.quiescent === true &&
        receipt.falloutVerified === true, "Release lacks verified settlement, fallout or exact authority");
      const controller = await operationProcess(view.state.supervisor.process);
      const worker = await operationProcess(view.state.worker.process);
      need(["absent", "settled-process", "reused-pid"].includes(controller) &&
        ["absent", "settled-process", "reused-pid"].includes(worker), "Original process identity has not settled");
      const history = await readHistory(claimDirectory);
      need(history.toSorted((a, b) => a.sequence - b.sequence).at(-1)?.attempt === launch.attempt,
        "Only the latest retained attempt may release ownership");
      if (action === "release-slot") {
        await serializedOperation(registry, () => retireReservation(slotPath(registry, launch.slot), launch.reservation, release.sha256));
        const proof = { settlementSha256, releaseSha256: release.sha256 };
        const retained = await readState(attemptDirectory, "slot-release.json", true);
        if (retained) need(equal(retained, proof), "Slot has another retained release proof");
        else await writeState(attemptDirectory, "slot-release.json", proof);
      } else {
        const released = await readState(attemptDirectory, "slot-release.json");
        need(released.settlementSha256 === settlementSha256 && receipt.assignmentClosed === true,
          "Assignment remains open or the role slot release was not proved");
        const proof = { settlementSha256, releaseSha256: release.sha256 };
        const retained = await readState(claimDirectory, "claim-release.json", true);
        if (retained) need(equal(retained, proof), "Claim has another retained release proof");
        else await writeState(claimDirectory, "claim-release.json", proof);
      }
      return { phase: action === "release-slot" ? "slot-released" : "claim-release-recorded", quiescent: true };
    }).then(async (result) => {
      if (action !== "release-claim") return result;
      await withRepositoryLock(registry, context.repository, async () => {
        need((await claimOwnerFor(claimDirectory, entry, context.repository)).claimId === launch.claimId, "Claim owner changed during closure");
        await rename(claimDirectory, claimDirectory + "-retired-" + launch.claimId);
        await syncDirectory(registry);
      });
      return { ...result, phase: "claim-released" };
    });
  } catch (error) { return stopped(error); }
}
