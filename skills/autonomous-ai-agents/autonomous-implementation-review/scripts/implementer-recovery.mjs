import { lstat } from "node:fs/promises";
import path from "node:path";
import { effectiveRole } from "./implementer-bindings.mjs";
import { auditCodexCapture, captureObservation, verifyPostWorker } from "./implementer-observations.mjs";
import { operationProcess, supervisorState } from "./implementer-supervisor.mjs";
import { describeFile } from "./review-admission.mjs";
import { equal, hash, jsonBytes, need } from "./review-inputs.mjs";
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

export async function handoffFor(context, state) {
  const { entry, launch, grant, roles, attemptDirectory } = context;
  const { request } = entry;
  const directory = request.evidenceRoots[0];
  await privateDirectory(directory);
  const captured = captureObservation(state, grant.limits);
  const native = auditCodexCapture(state, captured, grant.limits);
  const { session } = state.session ?? {};
  // No native session, no portable handoff. Keep raw captures in the original settlement.
  if (!session || [request.authority.authorSession, request.authority.orchestrator, roles.pair.reviewer.session].includes(session)) {
    return { phase: "blocked", reason: "missing-or-conflicting-native-session", supervisor: captured.outcome, quiescent: true };
  }
  effectiveRole(roles.pair.reviewer, "reviewer", request, { implementer: session, implementerModel: roles.pair.implementer.model }, roles);
  const runtime = effectiveRole(roles.pair.implementer, "implementer", request, session, roles);
  const expected = { directory, request, requestSha256: hash(requestBytes(request)) };
  const settlementSha256 = hash(jsonBytes(state.settlement));
  const persisted = await readState(attemptDirectory, "publication.json", true);
  if (persisted) {
    need(persisted.settlementSha256 === settlementSha256 && equal(persisted.runtime, runtime), "Original publication identity differs");
    const { result } = await readHandoff({ expected, runtime });
    need(persisted.status === result.status && persisted.resultSha256 === hash(await readClosed(path.join(directory, "result.json"), undefined, true)),
      "Retained result differs from original publication");
    return { phase: result.status, reason: persisted.reason, result, settlementSha256, quiescent: true };
  }
  const outputs = await verifyPostWorker(request, grant, await readState(attemptDirectory, "git-state.json"));
  const { status, reason } = native;
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
  await writeState(attemptDirectory, "publication.json", { runtime, settlementSha256, resultSha256, reason, status,
    nativeSha256: reportText ? hash(reportText) : null });
  return { phase: status, reason, result: admitted.result, settlementSha256, quiescent: true };
}
