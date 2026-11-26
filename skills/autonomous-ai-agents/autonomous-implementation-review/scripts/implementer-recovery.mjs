import { tierIdentity } from "./containment-tier.mjs";
import { lstat } from "node:fs/promises";
import path from "node:path";
import { effectiveRole } from "./implementer-bindings.mjs";
import { slotPath } from "./implementer-claims.mjs";
import { auditCodexCapture, captureObservation, verifyPostWorker } from "./implementer-observations.mjs";
import { operationProcess, supervisorState } from "./implementer-supervisor.mjs";
import { describeFile } from "./review-admission.mjs";
import { digest, equal, hash, jsonBytes, need, parseStrictJson } from "./review-inputs.mjs";
import { publishResult, readClosed, readHandoff, requestBytes } from "./worker-handoff.mjs";
import { privateDirectory, readState, writeState } from "./implementer-state.mjs";

export function supervisorBinding(launch) {
  return { claimId: launch.claimId, attempt: launch.attempt, nonce: launch.nonce, requestSha256: launch.requestSha256 };
}

export async function currentAttempt(directory, launch) {
  const state = await supervisorState(directory, supervisorBinding(launch));
  if (state.settlement) return { phase: state.settlement.result.quiescent ? "settled" : "unknown", state };
  if (!state.supervisor || !state.worker) return { phase: "unproved-launch", state };
  const [supervisor, worker] = await Promise.all([operationProcess(state.supervisor.process), operationProcess(state.worker.process)]);
  if (supervisor !== "active" || worker === "unverified" || worker === "reused-pid") return { phase: "unknown", state };
  if (worker === "absent" || worker === "settled-process") return { phase: "settling", state };
  return { phase: state.wait && !state.resumed ? "operator-input" : state.delivered ? "running" : "armed", state };
}

// A timeout has no successful native report. Its only reusable progress comes
// from a protected pre-launch snapshot and the sealed, quiescent checkout delta.
export async function verifyTimeoutContinuation({ request, grant, roles, registry, history, previousDir,
  latest, settlement, publication, released, control }) {
  const { state } = settlement;
  need(roles.attemptPolicy === true && latest.attemptPolicy === true && latest.task === request.identity.task &&
    state.settlement.result.outcome === "timeout" && state.delivered && (!state.wait || state.resumed) &&
    publication.reason === "timeout" && publication.status === "stopped" &&
    !history.some((launch) => launch.transition === "supervisor-timeout"),
  "Original supervisor timeout is unverified or the timeout continuation was consumed");
  need(roles.goalFirstTimeoutMs === latest.hostTimeoutMs && (!grant.commits || latest.commits === true) &&
    equal(roles.physicalSlot, latest.slot) && equal(roles.profileIds.slice(0, 3), latest.reservation.profiles.map(({ id }) => id)),
  "Timeout continuation changed the held host deadline, commit authority or physical role identity");
  const usedCorrections = history.filter(({ transition }) =>
    ["review-correction", "native-turn-cap", "supervisor-timeout"].includes(transition)).length;
  need(usedCorrections < grant.limits.corrections, "Timeout continuation correction budget exhausted");
  const retired = slotPath(registry, latest.slot) + "-retired-" + latest.claimId + "-" + latest.attempt;
  need(equal(await readState(retired, "reservation.json"), latest.reservation) &&
    (await readState(retired, "released.json")).proofSha256 === released.releaseSha256 &&
    digest(released.releaseSha256), "Original physical role reservation release differs");
  const raw = await readClosed(path.join(latest.evidence, "request.md"), undefined, true);
  const original = parseStrictJson(raw.subarray(Buffer.byteLength("# Worker request\n\n```json\n"), -Buffer.byteLength("\n```\n")));
  need(raw.equals(requestBytes(original)) && hash(raw) === latest.requestSha256, "Original timeout request changed");
  const boundary = ({ identity, authority, evidenceRoots, ...body }) => ({
    ...body, identity: { ...identity, attempt: null, predecessor: null },
    authority: { ...authority, executionReference: null },
  });
  need(equal(boundary(original), boundary(request)), "Timeout continuation changed the approved outcome or scope");
  const { result } = await readHandoff({ expected: { directory: latest.evidence, request: original,
    requestSha256: latest.requestSha256 }, runtime: publication.runtime });
  need(result.status === "stopped" && equal(result.coverageLimitations, ["timeout"]) &&
    result.runtime.session === state.session?.session, "Timeout handoff does not identify the original session");
  const progress = await readState(previousDir, "timeout-progress.json");
  const baseline = await readState(previousDir, "baseline-outputs.json");
  const git = await readState(previousDir, "git-state.json");
  const outputs = await verifyPostWorker(request, grant, git, { includeModes: true });
  need(control.verifiedProgress === true && control.progressSha256 === hash(jsonBytes(progress)) &&
    progress.head === grant.head && progress.settlementSha256 === publication.settlementSha256 &&
    equal(progress.before, baseline) && !equal(progress.before, progress.after) &&
    equal(progress.after, outputs) && equal(result.outputs, outputHashes(outputs)),
  "Timeout continuation has missing, stale or out-of-scope progress");
  return { previousAttempt: latest.attempt, settlementSha256: publication.settlementSha256,
    progressSha256: control.progressSha256, priorElapsedMs: state.settlement.elapsedMs, correctionsUsed: usedCorrections + 1,
    originalSession: state.session.session, outputs };
}

const outputHashes = (entries) => Object.fromEntries(Object.entries(entries).map(([name, output]) => [name, output?.sha256 ?? null]));

export async function handoffFor(context, state) {
  const { entry, launch, grant, roles, attemptDirectory } = context;
  const { request } = entry;
  const directory = request.evidenceRoots[0];
  await privateDirectory(directory);
  const captured = captureObservation(state, grant.limits);
  const native = auditCodexCapture(state, captured, grant.limits);
  const { session } = state.session ?? {};
  // No native session, no portable handoff. Keep raw captures in the original settlement.
  if (!session || [request.authority.authorSession, request.authority.orchestrator, roles.pair.reviewer.session,
    launch.timeoutContinuation?.originalSession].includes(session)) {
    return { phase: "blocked", reason: "missing-or-conflicting-native-session", supervisor: captured.outcome, quiescent: true };
  }
  effectiveRole(roles.pair.reviewer, "reviewer", request, { implementer: session, implementerModel: roles.pair.implementer.model }, roles);
  const runtime = effectiveRole(roles.pair.implementer, "implementer", request, session, roles);
  const expected = { directory, request, requestSha256: hash(requestBytes(request)) };
  const settlementSha256 = hash(jsonBytes(state.settlement));
  const persisted = await readState(attemptDirectory, "publication.json", true);
  if (persisted) {
    need(equal(tierIdentity(persisted), tierIdentity(runtime)) && persisted.settlementSha256 === settlementSha256 && equal(persisted.runtime, runtime), "Original publication identity differs");
    const { result } = await readHandoff({ expected, runtime });
    need(persisted.status === result.status && persisted.resultSha256 === hash(await readClosed(path.join(directory, "result.json"), undefined, true)),
      "Retained result differs from original publication");
    return { phase: result.status, reason: persisted.reason, result, settlementSha256, quiescent: true };
  }
  const git = await readState(attemptDirectory, "git-state.json");
  const outputs = await verifyPostWorker(request, grant, git);
  const { status, reason } = native;
  if (launch.attemptPolicy === true && reason === "timeout" && state.delivered && (!state.wait || state.resumed)) {
    const before = await readState(attemptDirectory, "baseline-outputs.json");
    const after = await verifyPostWorker(request, grant, git, { includeModes: true });
    need(equal(outputs, outputHashes(after)), "Checkout changed while sealing timeout progress");
    if (!equal(before, after)) {
      const progress = { head: grant.head, settlementSha256, before, after };
      const existing = await readState(attemptDirectory, "timeout-progress.json", true);
      if (existing) need(equal(existing, progress), "Original timeout progress changed");
      else await writeState(attemptDirectory, "timeout-progress.json", progress);
    }
  }
  const reportText = native.report === null ? null : Buffer.from(native.report + "\n");
  const report = status === "completed" ? reportText : Buffer.from(`Worker handover status: ${status} (${reason}).\n`);
  const event = (name, detail) => ({ schemaVersion: 1, attempt: launch.attempt, session, event: name, ...detail });
  const lifecycle = [
    event("launch", { worker: state.worker.process, supervisor: state.supervisor.process }),
    ...(state.delivered ? [event("working", { requestSha256: expected.requestSha256 })] : []),
    ...(state.wait ? [event("waiting", { promptKind: state.wait.kind })] : []),
    ...(state.wait && status === "completed" ? [event("resumed", { decision: "approved" })] : []),
    event("terminal", { status, completion: captured.completion,
      supervisor: { outcome: captured.outcome, quiescent: true, settlementSha256 }, turns: native.turns }),
  ];
  const files = {
    "report.md": report, "native.txt": reportText ?? Buffer.alloc(0), "stdout.jsonl": captured.stdout, "stderr.log": captured.stderr,
    "launch.json": jsonBytes({ ...launch, worker: state.worker.process, supervisor: state.supervisor.process, session }),
    "lifecycle.jsonl": Buffer.concat(lifecycle.map(jsonBytes)),
  };
  if (runtime.osDriver) {
    const tier = tierIdentity(runtime);
    files["status.json"] = jsonBytes({ schemaVersion: 1, ...tier, attempt: launch.attempt, status, settlementSha256 });
    files["receipt.json"] = jsonBytes({ schemaVersion: 1, ...tier, attempt: launch.attempt, session,
      requestSha256: launch.requestSha256, settlementSha256, status });
  }
  const describe = (name) => describeFile(directory, name, files[name]);
  const result = {
    schemaVersion: 1, identity: request.identity, requestSha256: expected.requestSha256, runtime, status,
    verdict: status === "completed" ? "not_applicable" : "unavailable", nativeVerdict: null, findings: [],
    coverageLimitations: reason === null ? [] : [reason], outputs, completion: captured.completion,
    report: describe("report.md"), reportKind: status === "completed" ? "native" : "adapter-diagnostic",
    nativeReport: status === "completed" ? describe("native.txt") : null,
    evidence: Object.keys(files).filter((name) => name !== "report.md").map(describe),
  };
  // A controller can die after the hard-link publication and before recording that it did so.
  let alreadyPublished = true;
  try { await lstat(path.join(directory, "result.json")); }
  catch (error) { if (error.code !== "ENOENT") throw error; alreadyPublished = false; }
  if (!alreadyPublished) await publishResult({ expected, runtime, result, files });
  const admitted = await readHandoff({ expected, runtime });
  need(equal(admitted.result, result), "Late result differs from original settlement or captured files");
  const resultSha256 = hash(await readClosed(path.join(directory, "result.json"), undefined, true));
  await writeState(attemptDirectory, "publication.json", { ...tierIdentity(runtime), runtime, settlementSha256, resultSha256, reason, status,
    nativeSha256: reportText ? hash(reportText) : null });
  return { phase: status, reason, result: admitted.result, settlementSha256, quiescent: true };
}
