#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { writeSync } from "node:fs";
import { lstat, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { convergenceDecision } from "./orchestration-core.mjs";
import { admitReceipt, candidateResult, describeFile, receiptContext, reviewPrompt } from "./review-admission.mjs";
import { absolute, checkExport, checkSealedDirectory, digest, equal, fields, fileLimit, hash, jsonBytes, need, parseStrictJson,
  prepareExport, protectedParent, readJson, reviewPolicy, sealDirectories, separate, totalLimit, uuid, validateReviewRequest } from "./review-inputs.mjs";
import { observeDirectRuntime, runDirectPacket } from "./review-runtime.mjs";
import { reviewBackends } from "./review-direct-supervisor.mjs";
import { checkPacketTurns, reviewClock, trustedJson } from "./review-preflight.mjs";
import { checkReviewSpend, withDirectReviewSettlement } from "./review-spend.mjs";
import { verifyHarnessSeal } from "./harness-result.mjs";
import { checkRoleIndependence, validatePin } from "./role-config.mjs";
import { auditVersion } from "./runtime-version.mjs";
import { upstreamClasses } from "./review-upstream-status.mjs";
import { piReviewer } from "./agent-role-adapters.mjs";
import { auditClaudeStream, auditPiStream } from "./review-stream.mjs";
import { createAttempt, legacyReviewFields, legacyReviewIdentity, publishResult, readClosed, readHandoff, requestBytes as workerRequestBytes, writeClosed } from "./worker-handoff.mjs";
import { packetConcurrency, replayPacketSchedule, schedulePackets } from "./review-packet-scheduler.mjs";

import { directReviewSettings } from "./agent-role-adapters.mjs";
import { directReviewHost, invocation, reviewerHelp, reviewerProvider } from "./review-direct-adapters.mjs";
import { directPacketPrompt, verifyDirectPacket } from "./review-direct-receipt.mjs";
import { usdMicros } from "./low-touch-policy.mjs";

// Captures from a frozen parent have an independent status pin and retain
// their original verifier identity at delivery. This reader has no transport.
const claudeVersion = "2.1.330";
const bubblewrapVersion = "0.9.0";
const probePrompt = "Do not call any tools. Reply with exactly REVIEW_PROBE_OK.";
const supervisorFields = ["code", "signal", "outcome", "quiescent"];
const writeJson = (dir, name, value) => writeClosed(path.join(dir, name), jsonBytes(value), true);
const readSealed = (dir, name, limit) => readClosed(path.join(dir, name), limit, true);

function validateRuntime(runtime, expect) {
  fields(runtime, ["session", "model", "version", "bubblewrapVersion", "maxTurns", "maxBudgetUsd",
    "configurationSha256", "route"], "retained runtime", ["explicit", ...legacyReviewFields]);
  need(equal(legacyReviewIdentity(runtime), legacyReviewIdentity(expect)), "Retained runtime tier or driver differs");
  const pi = expect.explicit?.client === piReviewer.client;
  if (expect.explicit) {
    need(equal(runtime.explicit, expect.explicit) && runtime.version === expect.explicit.version.observedVersion &&
      runtime.bubblewrapVersion === expect.explicit.bubblewrap.observedVersion &&
      runtime.route === (pi ? piReviewer.relay : "same-uid-key") &&
      (!pi || runtime.maxTurns === expect.explicit.requestLimit), "Explicit review runtime pins or version audit differ");
  } else need(runtime.explicit === undefined && runtime.version === claudeVersion &&
    runtime.bubblewrapVersion === bubblewrapVersion && runtime.route !== piReviewer.relay, "Legacy review runtime versions differ");
  need(uuid(runtime.session) &&
    runtime.model === expect.model && runtime.configurationSha256 === expect.configurationSha256 &&
    ["same-uid-key", "dedicated-uid-broker", piReviewer.relay].includes(runtime.route) &&
    Number.isSafeInteger(runtime.maxTurns) && runtime.maxTurns >= 1 && runtime.maxTurns <= 128 &&
    Number.isFinite(runtime.maxBudgetUsd) && runtime.maxBudgetUsd > 0 && runtime.maxBudgetUsd <= 10, "Runtime binding mismatch");
}

function validateExplicit(expect, request) {
  if (expect.qualification === undefined && expect.generator === undefined && expect.explicit === undefined) return;
  validatePin(expect.qualification);
  fields(expect.generator, ["provider", "session"], "independently retained generating role");
  need(expect.generator.session === (request.worker.identity.implementerSession ?? request.worker.authority.authorSession),
    "Generating session differs from the review request");
  checkRoleIndependence(expect.generator, { provider: expect.explicit?.provider ?? (expect.model === piReviewer.model ? piReviewer.provider : "anthropic"), session: request.session });
  if (expect.explicit === undefined) return;
  const explicit = expect.explicit;
  const pins = ["executableSha256", "relaySha256", "runtimeSha256", "qualificationSha256"];
  const pi = explicit.client === piReviewer.client;
  fields(explicit, ["provider", "reasoningEffort", "version", "bubblewrap", ...pins,
    ...(pi ? ["client", "requestLimit", "timeoutMs", "piReleaseSha256"] : [])], "independent explicit runtime");
  need((pi ? explicit.provider === piReviewer.provider && explicit.reasoningEffort === piReviewer.effort &&
    explicit.version?.versionPolicy === "exact" && explicit.version.versionCheck === true &&
    explicit.version.exactVersion === piReviewer.version && explicit.requestLimit === 96 && digest(explicit.piReleaseSha256) &&
    Number.isSafeInteger(explicit.timeoutMs) && explicit.timeoutMs >= 1000 && explicit.timeoutMs <= (expect.osDriver ? 600000 : 300000) :
    explicit.provider === "anthropic" && ["low", "medium", "high", "max"].includes(explicit.reasoningEffort)) &&
    pins.every((key) => digest(explicit[key])) && explicit.qualificationSha256 === expect.qualification.sha256,
  "Invalid independently retained explicit reviewer pins");
  for (const [record, floor] of [[explicit.version, pi ? undefined : claudeVersion], [explicit.bubblewrap, bubblewrapVersion]]) {
    need(equal(record, auditVersion(record, record.observedVersion, floor)), "Explicit runtime version audit differs");
  }
}

async function loadInputs(requestFile, expectFile) {
  const request = await readJson(requestFile);
  validateReviewRequest(request);
  const expect = await readJson(expectFile);
  fields(expect, ["schemaVersion", "requestSha256", "exportSha256", "configurationSha256", "model"],
    "independent expectation", ["statusSha256", "harness", "qualification", "generator", "explicit", "packetConcurrency", ...legacyReviewFields]);
  legacyReviewIdentity(expect);
  packetConcurrency(expect.packetConcurrency);
  need(expect.schemaVersion === 1 && expect.requestSha256 === hash(jsonBytes(request)) &&
    (expect.exportSha256 === null || digest(expect.exportSha256)) && digest(expect.configurationSha256) &&
    (expect.explicit?.client === piReviewer.client ? expect.model === piReviewer.model :
      typeof expect.model === "string" && (/^claude-[a-z0-9-]{2,100}$/.test(expect.model) ||
        expect.qualification && expect.model === piReviewer.model)) &&
    (expect.statusSha256 === undefined || digest(expect.statusSha256)), "Request differs from independently retained binding");
  if (request.mode === "approach") need(expect.model === request.snapshot.record.binding.model, "Approach model differs from fixed binding");
  validateExplicit(expect, request);
  return { request, expect };
}

function attemptRuntime(runtime) {
  const client = runtime.explicit?.client ?? "claude-code";
  return { adapter: client, client, version: runtime.version,
    session: runtime.session, provider: runtime.explicit?.provider ?? "anthropic", model: runtime.model,
    ...legacyReviewIdentity(runtime), configurationSource: runtime.configurationSha256, configurationScope: "contained-review", readOnly: true };
}

function attemptNames(index) {
  return ["stdout.jsonl", "stderr.txt", "capture.json"].map((name) => `${index}-${name}`);
}

async function capture(dir, index, observation) {
  const [out, err, metadata] = attemptNames(index);
  const { runtime, proc } = observation;
  const supervisor = Object.fromEntries(supervisorFields.map((name) => [name, proc[name]]));
  const { upstreamStatus, runtimeFailure } = observation;
  need(upstreamStatus === undefined || upstreamClasses.includes(upstreamStatus), "Invalid private upstream status");
  const captures = { [out]: proc.stdout, [err]: proc.stderr, [metadata]: jsonBytes({ runtime, supervisor,
    ...(upstreamStatus ? { upstreamStatus } : {}), ...(runtimeFailure ? { runtimeFailure } : {}) }) };
  for (const [name, bytes] of Object.entries(captures)) await writeClosed(path.join(dir, name), bytes, true);
}

async function replayCapture(directory, index, expect) {
  const [out, err, metadata] = attemptNames(index);
  const files = await Promise.all([readSealed(directory, out, totalLimit), readSealed(directory, err, 128 * 1024),
    readSealed(directory, metadata, 4096)]);
  const value = await readJson(path.join(directory, metadata), 4096, true);
  need(files[2].equals(jsonBytes(value)), "Noncanonical capture metadata");
  fields(value, ["runtime", "supervisor"], "capture metadata", ["upstreamStatus", "runtimeFailure"]);
  need(value.runtimeFailure === undefined || packetConcurrency(expect.packetConcurrency) > 1 && value.runtimeFailure === true,
    "Invalid private runtime failure");
  need(value.upstreamStatus === undefined || upstreamClasses.includes(value.upstreamStatus), "Invalid private upstream status");
  fields(value.supervisor, supervisorFields, "supervisor observation");
  validateRuntime(value.runtime, expect);
  return { runtime: value.runtime, upstreamStatus: value.upstreamStatus, runtimeFailure: value.runtimeFailure,
    proc: { ...value.supervisor, stdout: files[0], stderr: files[1] },
    descriptors: [out, err, metadata].map((name, i) => describeFile(directory, name, files[i])) };
}

function audit(observation, paths, probe, files) {
  if (observation.upstreamStatus || observation.runtimeFailure) return null;
  const verifier = observation.runtime.explicit?.client === piReviewer.client ? auditPiStream : auditClaudeStream;
  try { return verifier(observation.proc, observation.runtime, paths, probe, files); }
  catch { return null; }
}

function inspectPacket(observation, request, context, prepared, index, reference) {
  const packet = prepared.manifest.packets[index - 1];
  const report = audit(observation, packet.paths, false, prepared.files);
  if (report === null) return { failure: "runtime-failed" };
  try {
    return { report, receipt: admitReceipt(request, context, report, index - 1, reference, packet,
      { framedOnly: Boolean(observation.runtime.explicit) }) };
  } catch {
    if (request.mode === "approach") return { report, failure: "invalid-receipt" };
    return { report, failure: "receipt-invalid", rejection: { packet: index, packetSha256: hash(jsonBytes(packet)),
      target: context.target, session: observation.runtime.session } };
  }
}

async function replay(directory, request, expect, prepared, count, schedule) {
  const raw = path.join(directory, "raw");
  const context = receiptContext(request, prepared);
  const packetCount = prepared.manifest.packets.length;
  const concurrency = packetConcurrency(expect.packetConcurrency);
  need(Number.isSafeInteger(count) && count >= 1 && count <= packetCount + 1, "Invalid capture count");
  const expectedNames = Array.from({ length: count }, (_, index) => attemptNames(index)).flat().sort();
  need(equal((await readdir(raw)).sort(), expectedNames), "Raw capture inventory mismatch");
  const probe = await replayCapture(raw, 0, expect);
  need(![request.session, request.worker.identity.implementerSession, request.worker.authority.authorSession,
    request.worker.authority.orchestrator].includes(probe.runtime.session), "Probe session reused");
  const { session: probeSession, ...pin } = probe.runtime;
  const captures = [...probe.descriptors];
  const upstream = probe.upstreamStatus ? [{ packet: 0, classification: probe.upstreamStatus }] : [];
  const receipts = [];
  const reports = [];
  const packets = [];
  const sessions = [probeSession];
  let rejection = null;
  let phase = audit(probe, [], true) === null ? "probe-failed" : "complete";
  for (let index = 1; index < count; index++) {
    if (concurrency === 1) need(phase === "complete", "Capture exists after a failed launch");
    const observation = await replayCapture(raw, index, expect);
    const { session, ...runPin } = observation.runtime;
    need(equal(runPin, pin) && !sessions.includes(session) &&
      (index === 1 ? session === request.session : ![request.session, request.worker.identity.implementerSession,
        request.worker.authority.authorSession, request.worker.authority.orchestrator].includes(session)), "Packet runtime identity mismatch");
    sessions.push(session);
    captures.push(...observation.descriptors);
    if (observation.upstreamStatus) upstream.push({ packet: index, classification: observation.upstreamStatus });
    const inspected = inspectPacket(observation, request, context, prepared, index, path.join(directory, "report.md"));
    packets.push(inspected);
    if (inspected.report !== undefined) reports.push({ index, report: inspected.report });
    if (inspected.receipt) receipts.push(inspected.receipt);
    if (concurrency === 1 && inspected.failure) {
      phase = inspected.failure;
      rejection = inspected.rejection ?? null;
    }
  }
  if (concurrency > 1) {
    const failure = replayPacketSchedule(schedule, concurrency, packets, phase === "complete");
    if (failure) {
      phase = failure.failure;
      rejection = failure.rejection ?? null;
    }
  }
  if (phase === "complete" && count !== packetCount + 1) phase = "incomplete-packets";
  const native = reports.length
    ? Buffer.from(reports.map(({ index, report }) => concurrency === 1 && reports.length === 1 ? report :
      `Packet ${index}\n${report}`).join("\n\n") + "\n")
    : Buffer.from("No extracted native report. See the retained raw captures.\n");
  return { phase, rejection, sessions, captures, upstream, receipts, native, schedule,
    runtime: attemptRuntime({ ...probe.runtime, session: request.session }) };
}

async function outcome(directory, request, expect, prepared, count, expected, schedule) {
  const observed = await replay(directory, request, expect, prepared, count, schedule);
  const files = {};
  const describe = (name, bytes) => describeFile(directory, name, bytes);
  if (expect.osDriver) {
    files["launch.json"] = jsonBytes({ schemaVersion: 1, ...legacyReviewIdentity(expect), runtime: observed.runtime,
      requestSha256: expect.requestSha256, exportSha256: expect.exportSha256, sessions: observed.sessions });
    if (observed.phase === "complete") files["receipt.json"] = jsonBytes({ schemaVersion: 1, ...legacyReviewIdentity(expect),
      configurationSha256: expect.configurationSha256, requestSha256: expect.requestSha256,
      exportSha256: expect.exportSha256, packets: observed.receipts });
  }
  let result;
  let handoff = null;
  if (request.mode === "candidate" && observed.phase === "complete") {
    files["native.txt"] = observed.native;
    handoff = candidateResult(expected, observed.runtime, observed.receipts, files, describe);
    result = handoff;
  } else {
    files["report.md"] = observed.native;
    result = { schemaVersion: 1, ...legacyReviewIdentity(expect), mode: request.mode, requestSha256: expect.requestSha256,
      phase: observed.phase,
      ...(request.mode === "approach" ? {
        native: observed.receipts[0]?.receipt ?? null, approachAction: observed.receipts[0]?.admission.action ?? null,
      } : { ...(observed.rejection ? { rejection: observed.rejection } : { native: null, approachAction: null }) }),
      report: describe("report.md", observed.native) };
  }
  const resultBytes = handoff ? null : jsonBytes(result);
  return { files, observed, result, handoff, resultBytes };
}

function statusFor(directory, expect, count, outcome, resultBytes, requestBytes) {
  return {
    schemaVersion: 1, ...legacyReviewIdentity(expect), requestSha256: expect.requestSha256, exportSha256: expect.exportSha256,
    configurationSha256: expect.configurationSha256, model: expect.model, phase: outcome.observed.phase, count,
    ...(packetConcurrency(expect.packetConcurrency) > 1 ?
      { packetConcurrency: expect.packetConcurrency, schedule: outcome.observed.schedule } : {}),
    ...(outcome.observed.rejection ? { rejection: outcome.observed.rejection } : {}),
    ...(outcome.observed.upstream.length ? { upstream: outcome.observed.upstream } : {}),
    sessions: outcome.observed.sessions, captures: outcome.observed.captures, deliveryAccepted: false,
    files: [...Object.entries(outcome.files), ["request.md", requestBytes], ["result.json", resultBytes]]
      .map(([name, bytes]) => describeFile(directory, name, bytes)),
  };
}

function expectedAttempt(directory, request, bytes) {
  return { directory, request: request.worker, requestSha256: hash(bytes) };
}

async function verify(directory, request, expect, prepared) {
  need(digest(expect.statusSha256) && request.worker.evidenceRoots.includes(directory), "Missing independently retained handover identity");
  await checkSealedDirectory(directory);
  await checkSealedDirectory(path.join(directory, "raw"));
  const statusBytes = await readSealed(directory, "status.json", totalLimit);
  need(hash(statusBytes) === expect.statusSha256, "Status changed after publication");
  const status = await readJson(path.join(directory, "status.json"), totalLimit, true);
  const requestBytes = await readSealed(directory, "request.md", totalLimit);
  need(requestBytes.equals(workerRequestBytes(request.worker)), "Worker request differs from independent identity");
  const expected = expectedAttempt(directory, request, requestBytes);
  const reconstructed = await outcome(directory, request, expect, prepared, status.count, expected, status.schedule);
  const resultBytes = await readSealed(directory, "result.json", totalLimit);
  if (reconstructed.handoff) {
    const handoff = await readHandoff({ expected, runtime: reconstructed.observed.runtime });
    need(equal(handoff.result, reconstructed.result), "Candidate handoff differs from replay");
  } else {
    need(resultBytes.equals(reconstructed.resultBytes), "Result differs from replay");
  }
  for (const [name, bytes] of Object.entries(reconstructed.files)) {
    need((await readSealed(directory, name, totalLimit)).equals(bytes), "Extracted report or lifecycle differs from raw capture");
  }
  need(statusBytes.equals(jsonBytes(statusFor(directory, expect, status.count, reconstructed, resultBytes, requestBytes))),
    "Status differs from verified handover");
  need(equal((await readdir(directory)).sort(), ["raw", "status.json", "request.md", "result.json",
    ...Object.keys(reconstructed.files)].sort()), "Handover inventory mismatch");
  return {
    phase: status.phase, ...(status.rejection ? { rejection: status.rejection } : {}), result: reconstructed.result, sessions: status.sessions, deliveryAccepted: false,
    ...(request.mode === "approach" && reconstructed.observed.phase === "complete"
      ? { approach: reconstructed.observed.receipts[0].admission } : {}),
  };
}

async function checkPrior(request, expect, prepared) {
  if (request.mode !== "approach" || !request.snapshot.priorLaunches.length) return;
  const [prior] = request.snapshot.priorLaunches;
  const direct = expect.schemaVersion === 2;
  const retained = await (direct ? loadDirectInputs : loadInputs)(prior.request, prior.expect);
  need(retained.request.mode === "approach" && retained.request.snapshot.priorLaunches.length === 0 &&
    retained.expect.configurationSha256 === expect.configurationSha256 && retained.expect.model === expect.model &&
    packetConcurrency(retained.expect.packetConcurrency) === packetConcurrency(expect.packetConcurrency) &&
    equal(retained.expect.explicit, expect.explicit) && equal(retained.expect.generator, expect.generator) &&
    equal(retained.expect.runtime, expect.runtime) && retained.expect.maxBudgetUsd === expect.maxBudgetUsd &&
    equal(retained.request.worker.identity.inputs, request.worker.identity.inputs) &&
    equal(retained.request.attachments, request.attachments) && equal(retained.request.limits, request.limits) &&
    equal(retained.request.snapshot.record, request.snapshot.record) &&
    equal(retained.request.snapshot.correction, request.snapshot.correction) &&
    equal(retained.request.snapshot.authority, request.snapshot.authority) &&
    retained.request.worker.authority.authorSession === request.worker.authority.authorSession &&
    retained.request.worker.identity.workspace === request.worker.identity.workspace &&
    request.worker.identity.predecessor === retained.request.worker.identity.attempt,
    "Retry binding differs from retained launch");
  const oldExport = await checkExport(prior.export, retained.expect.exportSha256, retained.request);
  need(equal(prepared.manifest.files, oldExport.manifest.files), "Retry export bytes changed");
  const readback = await (direct ? verifyDirect : verify)(prior.output, retained.request, retained.expect, oldExport);
  need(readback.phase === "invalid-receipt" && !readback.sessions.includes(request.session), "Prior launch does not authorize receipt retry");
  const decision = convergenceDecision({ record: request.snapshot.record, authority: request.snapshot.authority,
    preflight: true, launchFailures: 1, priorAttempt: { verified: true, reference: prior.output,
      binding: request.snapshot.record.binding, inputs: request.worker.identity.inputs },
    currentInputs: request.worker.identity.inputs, drift: false, repeated: false, contradictory: false, validation: "pass" });
  need(decision.action === "retry-launch", "Existing convergence decision stopped the retry");
}

export async function runReview({ request, expect, prepared, directory, excluded, run, clock }) {
  const context = receiptContext(request, prepared);
  const concurrency = packetConcurrency(expect.packetConcurrency);
  need(concurrency === 1 || clock, "Concurrent packet review needs a bounded launch clock");
  need(separate(directory, request.worker.identity.workspace) && excluded.every((root) => separate(directory, root)),
    "Output overlaps review inputs or host authority");
  await protectedParent(directory);
  const expected = await createAttempt({ directory, request: request.worker, excludedRoots: [request.worker.identity.workspace, ...excluded] });
  const raw = path.join(directory, "raw");
  await mkdir(raw, { mode: 0o700 });
  let count = 0;
  let schedule = [];
  const probeSession = randomUUID();
  const probeInput = { files: new Map(), prompt: probePrompt, session: probeSession,
    ...(clock ? { timeoutMs: clock.remaining() } : {}) };
  const probe = await run(concurrency > 1 ? { ...probeInput, begin: () => clock.remaining() } : probeInput);
  need(probe, "Review deadline expired before the automatic probe");
  validateRuntime(probe.runtime, expect);
  need(probe.runtime.session === probeSession, "Probe runtime session mismatch");
  await capture(raw, count++, probe);
  if (audit(probe, [], true) !== null) {
    const { session: unusedProbeSession, ...probePin } = probe.runtime;
    const sessions = new Set([probe.runtime.session, request.worker.identity.implementerSession,
      request.worker.authority.authorSession, request.worker.authority.orchestrator]);
    const reference = path.join(directory, "report.md");
    const packetInput = (index) => {
      const packet = prepared.manifest.packets[index];
      const session = index === 0 ? request.session : randomUUID();
      need(!sessions.has(session), "Packet session reused");
      sessions.add(session);
      return { session, files: new Map(packet.paths.map((name) => [name, prepared.files.get(name)])),
        prompt: reviewPrompt(request, context, packet, index, prepared.manifest.packets.length, reference,
          probe.runtime.explicit?.client === piReviewer.client ? { tool: "read", argument: "path" } : undefined) };
    };
    const checkPacket = (observation, session, packet) => {
      const { session: observedSession, ...pin } = observation.runtime;
      need(observedSession === session && equal(pin, probePin), "Packet runtime differs from probe");
      return inspectPacket(observation, request, context, prepared, packet, reference);
    };
    if (concurrency === 1) {
      for (const index of prepared.manifest.packets.keys()) {
        if (clock && !await clock.next(index)) break;
        const input = packetInput(index);
        const observation = await run({ ...input, ...(clock ? { timeoutMs: clock.remaining() } : {}) });
        await capture(raw, count++, observation);
        if (checkPacket(observation, input.session, index + 1).failure) break;
      }
    } else {
      schedule = await schedulePackets(prepared.manifest.packets.length, concurrency, clock, async (packet, begin, halt) => {
        const input = packetInput(packet - 1);
        let retained;
        let upstreamStatus;
        let launched = false;
        let observation;
        try {
          observation = await run({ ...input, begin: () => {
            const remaining = begin();
            launched = remaining > 0;
            return remaining;
          }, onFailure: (status) => {
            if (!upstreamClasses.includes(status)) return;
            upstreamStatus ??= status;
            halt();
          }, retain: (value) => { retained = value; } });
        } catch {
          observation = { runtime: { ...probePin, session: input.session },
            proc: { code: null, signal: null, outcome: "runtime-error", quiescent: false, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) },
            ...retained, runtimeFailure: true };
        }
        if (!launched) {
          need(!observation || observation.runtimeFailure, "Concurrent runtime did not confirm its packet launch");
          return false;
        }
        need(observation, "Missing observation for a launched packet");
        if (upstreamStatus) observation = { ...observation, upstreamStatus };
        const passed = !checkPacket(observation, input.session, packet).failure;
        if (!passed) halt();
        await capture(raw, packet, observation);
        count++;
        return passed;
      });
    }
  }
  const reconstructed = await outcome(directory, request, expect, prepared, count, expected, schedule);
  if (reconstructed.handoff) {
    await publishResult({ expected, runtime: reconstructed.observed.runtime, result: reconstructed.handoff, files: reconstructed.files });
  } else {
    for (const [name, bytes] of Object.entries(reconstructed.files)) await writeClosed(path.join(directory, name), bytes, true);
    await writeClosed(path.join(directory, "result.json"), reconstructed.resultBytes, true);
  }
  const status = jsonBytes(statusFor(directory, expect, count, reconstructed,
    await readSealed(directory, "result.json", totalLimit), await readSealed(directory, "request.md", totalLimit)));
  await writeClosed(path.join(directory, "status.json"), status, true);
  await sealDirectories(directory);
  const statusSha256 = hash(status);
  await verify(directory, request, { ...expect, statusSha256 }, prepared);
  return { phase: reconstructed.observed.phase, statusSha256, deliveryAccepted: false,
    ...(reconstructed.observed.rejection ? { rejection: reconstructed.observed.rejection } : {}) };
}

const commands = {
  "--prepare": ["request", "expect", "export"],
  "--check": ["request", "expect", "export"],
  "--mode": ["request", "expect", "export", "output", "host-config"],
  "--verify": ["request", "expect", "export", "output"],
};

function cli(argv) {
  const [command, ...arguments_] = argv;
  need(Object.hasOwn(commands, command), "Invalid CLI option");
  const budgetOptions = ["budget-extension", "operator-key", "operator-key-sha256"];
  const optional = {
    "--prepare": ["host-config"], "--check": ["host-config", "admission", ...budgetOptions],
    "--mode": ["admission", ...budgetOptions], "--verify": [],
  }[command];
  const args = arguments_.slice();
  const mode = command === "--mode" ? args.shift() : null;
  need(command !== "--mode" || ["candidate", "approach"].includes(mode), "Invalid CLI mode");
  const options = {};
  while (args.length) {
    const flag = args.shift();
    const key = flag.startsWith("--") ? flag.slice(2) : "";
    const value = args.shift();
    need([...commands[command], ...optional].includes(key) && !Object.hasOwn(options, key) &&
      (key.endsWith("-sha256") ? digest(value) : absolute(value)), "Invalid CLI option or path");
    options[key] = value;
  }
  need(commands[command].every((key) => Object.hasOwn(options, key)), "Missing CLI option");
  need(Boolean(options["operator-key"]) === Boolean(options["operator-key-sha256"]) &&
    (!options["operator-key"] || options.admission) && (!options["budget-extension"] || options["operator-key"]),
  "Review extensions require admission and an independently pinned operator key");
  return { command, mode, options };
}

function settingsFromRuntime(runtime) {
  const { version, executableSha256, capabilitySha256, supervisor, ...settings } = runtime;
  need(typeof version === "string" && /^\d+\.\d+\.\d+[0-9A-Za-z.+-]*$/.test(version) && digest(executableSha256),
    "Invalid independently retained Direct-CLI runtime identity");
  fields(supervisor, ["backend", "executableSha256"], "native supervisor identity");
  need(Object.values(reviewBackends).includes(supervisor.backend) && digest(supervisor.executableSha256),
    "Invalid independently retained native supervisor identity");
  need(equal(settings, directReviewSettings(settings)), "Direct-CLI runtime settings are incomplete");
  need(capabilitySha256 === hash(jsonBytes(reviewerHelp(settings, version))), "Native CLI capability binding differs");
  return settings;
}

async function loadDirectInputs(requestFile, expectFile) {
  const request = await readJson(requestFile);
  validateReviewRequest(request);
  const expect = await readJson(expectFile);
  fields(expect, ["schemaVersion", "requestSha256", "exportSha256", "configurationSha256", "model"],
    "independent Direct-CLI expectation", ["statusSha256", "harness", "runtime", "maxBudgetUsd"]);
  need(expect.schemaVersion === 2 && expect.requestSha256 === hash(jsonBytes(request)) &&
    (expect.exportSha256 === null || digest(expect.exportSha256)) && digest(expect.configurationSha256) &&
    typeof expect.model === "string" && (expect.statusSha256 === undefined || digest(expect.statusSha256)),
  "Direct-CLI request differs from independently retained binding");
  need((expect.runtime === undefined) === (expect.maxBudgetUsd === undefined), "Incomplete Direct-CLI runtime expectation");
  if (expect.runtime) {
    settingsFromRuntime(expect.runtime);
    usdMicros(expect.maxBudgetUsd);
    need(expect.runtime.model === expect.model, "Direct-CLI runtime model differs");
  }
  if (request.mode === "approach") {
    need(expect.model === request.snapshot.record.binding.model &&
      (!expect.runtime || expect.runtime.client === request.snapshot.record.binding.client),
    "Approach reviewer differs from the fixed charter binding");
  }
  return { request, expect };
}

const directRead = (directory, name, limit = totalLimit) => readSealed(directory, name, limit);
const packetCaptureName = (index) => String(index + 1) + ".jsonl";

function failureFrom(request, index, launch) {
  return { failure: request.mode === "approach" ? "invalid-receipt" : "receipt-invalid",
    ...(request.mode === "candidate" ? { rejection: { packet: index + 1, packetSha256: launch.inventorySha256,
      target: request.snapshot.target, session: launch.session } } : {}) };
}

function directPacket(request, expect, prepared, index, launch, stdout) {
  try {
    return verifyDirectPacket({ request, context: receiptContext(request, prepared), prepared, index, launch,
      stdout, runtime: expect.runtime, maxBudgetUsd: expect.maxBudgetUsd, reference: "direct-cli:" + request.session });
  } catch {
    return failureFrom(request, index, launch);
  }
}

function directRuntime(expect, session) {
  const { client, model, version } = expect.runtime;
  return { adapter: client, client, model, version, session, provider: reviewerProvider(expect.runtime),
    configurationSource: expect.configurationSha256, configurationScope: "direct-cli", readOnly: true };
}

async function deriveDirect(directory, request, expect, prepared, launches, schedule) {
  need(expect.runtime && digest(expect.exportSha256) && Array.isArray(launches) &&
    launches.length <= prepared.manifest.packets.length, "Unbound Direct-CLI packet captures");
  const raw = path.join(directory, "raw");
  need(equal((await readdir(raw)).sort(), launches.map((_launch, index) => packetCaptureName(index)).sort()),
    "Direct-CLI capture inventory differs");
  const sessions = [];
  const nativeSessions = new Set();
  const observations = [];
  const captures = [];
  const diagnostics = [];
  for (const [index, launch] of launches.entries()) {
    const name = packetCaptureName(index);
    const stdout = await directRead(raw, name, 4 * 1024 * 1024);
    need(!sessions.includes(launch.session) && ![request.worker.identity.implementerSession,
      request.worker.authority.authorSession, request.worker.authority.orchestrator].includes(launch.session) &&
      (index === 0 ? launch.session === request.session : launch.session !== request.session),
    "Reused Direct-CLI reviewer session");
    sessions.push(launch.session);
    const reviewed = directPacket(request, expect, prepared, index, launch, stdout);
    if (!reviewed.failure) {
      need(equal(launch.before, launches[0].before), "Worktree drifted between reviewer packets");
      need(!reviewed.nativeSession || !nativeSessions.has(reviewed.nativeSession) &&
        ![request.worker.identity.implementerSession, request.worker.authority.authorSession,
          request.worker.authority.orchestrator].includes(reviewed.nativeSession), "Reused native reviewer session");
      if (reviewed.nativeSession) nativeSessions.add(reviewed.nativeSession);
    }
    observations.push(reviewed);
    captures.push({ packet: index + 1, sha256: hash(stdout), bytes: stdout.length });
    if (reviewed.failure) diagnostics.push({ packet: index + 1, classification: reviewed.failure });
  }
  const failure = replayPacketSchedule(schedule, expect.runtime.packetConcurrency, observations, true);
  const phase = failure?.failure ?? (launches.length === prepared.manifest.packets.length ? "complete" : "incomplete-packets");
  const coverage = phase === "complete" && observations.every((item) => item.coverage === "whole-file") ? "whole-file" : "receipt-only";
  const native = Buffer.from(observations.flatMap((item) => item.report ? [item.report.trimEnd()] : []).join("\n\n") +
    (observations.some((item) => item.report) ? "\n" : ""));
  const runtime = directRuntime(expect, request.session);
  const record = { schemaVersion: 2, transport: "direct-cli", requestSha256: expect.requestSha256,
    exportSha256: expect.exportSha256, configurationSha256: expect.configurationSha256, launches, schedule, captures };
  const files = { "launch.json": jsonBytes(record),
    "stdout.jsonl": Buffer.concat(captures.map(jsonBytes)), "stderr.log": Buffer.concat(diagnostics.map(jsonBytes)) };
  const requestBytes = workerRequestBytes(request.worker);
  const bound = expectedAttempt(directory, request, requestBytes);
  const describe = (name, bytes) => describeFile(directory, name, bytes);
  let handoff;
  let approach;
  let result;
  if (phase === "complete" && request.mode === "candidate") {
    files["native.txt"] = native;
    files["receipt.json"] = jsonBytes({ coverage, packets: observations.map((item) => item.receipt) });
    const review = observations.map(({ receipt, coverage: packetCoverage }) => packetCoverage === "whole-file" ? receipt :
      { ...receipt, coverageLimitations: [...receipt.coverageLimitations, "Receipt-only packet has no independent whole-file coverage"] });
    handoff = candidateResult(bound, runtime, review, files, describe);
    result = handoff;
  } else {
    files["report.md"] = native;
    if (phase === "complete") {
      const accepted = observations[0].receipt;
      // The charter's existing pass rules require verified packet coverage.
      if (coverage === "whole-file") approach = accepted.admission;
      files["receipt.json"] = jsonBytes({ coverage, packets: [accepted.receipt] });
      result = { schemaVersion: 2, mode: "approach", phase, coverage, native: accepted.receipt,
        approachAction: approach?.action ?? null, report: describe("report.md", native) };
    } else {
      result = { schemaVersion: 2, mode: request.mode, phase, ...(failure?.rejection ? { rejection: failure.rejection } : {}),
        report: describe("report.md", native) };
    }
  }
  const status = (resultBytes) => jsonBytes({ schemaVersion: 2, transport: "direct-cli", requestSha256: expect.requestSha256,
    configurationSha256: expect.configurationSha256, exportSha256: expect.exportSha256, phase, sessions, coverage,
    ...(failure?.rejection ? { rejection: failure.rejection } : {}),
    deliveryAccepted: false,
    files: [...Object.entries(files), ["request.md", requestBytes], ["result.json", resultBytes]]
      .map(([name, bytes]) => describe(name, bytes)) });
  return { phase, sessions, coverage, runtime, handoff, approach, result, files, status, failure, bound };
}

async function verifyDirect(directory, request, expect, prepared) {
  need(digest(expect.statusSha256) && request.worker.evidenceRoots.includes(directory), "Missing independent Direct-CLI status pin");
  await checkSealedDirectory(directory);
  await checkSealedDirectory(path.join(directory, "raw"));
  const statusBytes = await directRead(directory, "status.json");
  need(hash(statusBytes) === expect.statusSha256, "Direct-CLI status changed after publication");
  const launchBytes = await directRead(directory, "launch.json");
  const launch = parseStrictJson(launchBytes);
  const replay = await deriveDirect(directory, request, expect, prepared, launch.launches, launch.schedule);
  need((await directRead(directory, "request.md")).equals(workerRequestBytes(request.worker)), "Changed Direct-CLI worker request");
  for (const [name, bytes] of Object.entries(replay.files)) {
    need((await directRead(directory, name)).equals(bytes), "Direct-CLI reconstructed evidence differs");
  }
  const resultBytes = await directRead(directory, "result.json");
  if (replay.handoff) {
    const handoff = await readHandoff({ expected: replay.bound, runtime: replay.runtime });
    need(equal(handoff.result, replay.handoff), "Direct-CLI handoff differs from offline replay");
  } else need(resultBytes.equals(jsonBytes(replay.result)), "Direct-CLI result differs from offline replay");
  need(statusBytes.equals(replay.status(resultBytes)) &&
    equal((await readdir(directory)).sort(), ["request.md", "result.json", "status.json", "raw", ...Object.keys(replay.files)].sort()),
    "Direct-CLI evidence inventory or disposition differs");
  return { phase: replay.phase, transport: "direct-cli", coverage: replay.coverage, sessions: replay.sessions,
    ...(replay.failure?.rejection ? { rejection: replay.failure.rejection } : {}),
    result: replay.result, ...(replay.approach ? { approach: replay.approach } : {}), deliveryAccepted: false };
}

async function directLaunch({ directory, request, expect, prepared, config, executable, python, exportDirectory, excluded }) {
  await protectedParent(directory);
  await createAttempt({ directory, request: request.worker, excludedRoots: excluded });
  const raw = path.join(directory, "raw");
  await mkdir(raw, { mode: 0o700 });
  const cancellation = new AbortController();
  const cancel = () => cancellation.abort();
  const signalNames = ["SIGINT", "SIGTERM"];
  for (const name of signalNames) process.on(name, cancel);
  const count = prepared.manifest.packets.length;
  const { budget } = request.worker;
  const heldLimit = budget.unit === "minutes" ? budget.limit * 60_000 : Infinity;
  const defaultLimit = count * config.timeoutMs + Math.max(0, count - 1) * (config.interPacketDelayMs ?? 0);
  const clock = reviewClock({ ...config, runTimeoutMs: Math.min(config.runTimeoutMs ?? defaultLimit, heldLimit) },
    count, { signal: cancellation.signal });
  const launches = [];
  const context = receiptContext(request, prepared);
  let baseline;
  try {
    const schedule = await schedulePackets(count, config.packetConcurrency, clock, async (packet, begin, halt, stop) => {
      const index = packet - 1;
      const session = index === 0 ? request.session : randomUUID();
      const prompt = directPacketPrompt(request, context, prepared, index, session, config.reviewer, config.maxBudgetUsd);
      const observation = await runDirectPacket({ request, expect, prepared, config, executable, python, exportDirectory,
        excluded: [...excluded, directory], index, session, prompt, begin,
        signal: AbortSignal.any([cancellation.signal, stop]) });
      if (!observation) return false;
      const { launch } = observation;
      let { stdout } = observation;
      baseline ??= launch.before;
      if (launch.diagnostic === null && !equal(baseline, launch.before)) {
        launch.diagnostic = "integrity-failed";
        stdout = Buffer.alloc(0);
      }
      launches[index] = launch;
      const reviewed = directPacket(request, expect, prepared, index, launch, stdout);
      if (reviewed.failure) halt();
      await writeClosed(path.join(raw, packetCaptureName(index)), stdout, true);
      return !reviewed.failure;
    });
    const replay = await deriveDirect(directory, request, expect, prepared, launches, schedule);
    if (replay.handoff) {
      await publishResult({ expected: replay.bound, runtime: replay.runtime, result: replay.handoff, files: replay.files });
    } else {
      for (const [name, bytes] of Object.entries(replay.files)) await writeClosed(path.join(directory, name), bytes, true);
      await writeJson(directory, "result.json", replay.result);
    }
    const status = replay.status(await directRead(directory, "result.json"));
    await writeClosed(path.join(directory, "status.json"), status, true);
    await sealDirectories(directory);
    const statusSha256 = hash(status);
    const verified = await verifyDirect(directory, request, { ...expect, statusSha256 }, prepared);
    return { phase: verified.phase, transport: verified.transport, coverage: verified.coverage, statusSha256,
      ...(verified.rejection ? { rejection: verified.rejection } : {}),
      settled: launches.every(({ process }) => process.quiescent === true), deliveryAccepted: false };
  } finally {
    for (const name of signalNames) process.off(name, cancel);
  }
}

async function directCommand(command, mode, options) {
  const { request, expect } = await loadDirectInputs(options.request, options.expect);
  need(mode === null || request.mode === mode, "CLI mode differs from Direct-CLI request");
  const exportDirectory = options.export;
  const workspace = request.worker.identity.workspace;
  const policy = await reviewPolicy(request);
  need(policy?.directReviewer, "The exact integrated parent has not adopted Direct-CLI review");
  const protectedRoots = [workspace, options.request, options.expect, ...request.worker.evidenceRoots];
  need(protectedRoots.every((root) => separate(exportDirectory, root)), "Export overlaps retained review inputs or evidence");
  const excluded = [...protectedRoots, exportDirectory];
  const directory = options.output;
  if (command === "--verify") {
    need([exportDirectory, options.request, options.expect].every((root) => separate(directory, root)),
      "Output overlaps retained inputs");
    const prepared = await checkExport(exportDirectory, expect.exportSha256, request);
    await checkPrior(request, expect, prepared);
    return verifyDirect(directory, request, expect, prepared);
  }
  const hostFile = options["host-config"];
  need(hostFile, "Direct-CLI preflight requires a pinned external host.json");
  const host = await trustedJson(hostFile, excluded);
  need(host.configurationSha256 === expect.configurationSha256, "Direct-CLI host configuration pin differs");
  const config = directReviewHost(host.value);
  need(config.model === expect.model && (!expect.runtime || equal(settingsFromRuntime(expect.runtime), config.reviewer) &&
    config.maxBudgetUsd === expect.maxBudgetUsd), "Direct-CLI configuration differs from independent expectation");
  if (request.mode === "approach") need(config.client === request.snapshot.record.binding.client,
    "Direct-CLI client differs from the approach binding");
  if (config.localHarness !== undefined) {
    const retained = await trustedJson(options.expect, excluded.filter((root) => root !== options.expect), true);
    need(equal(retained.value, expect), "Host expectation changed during admission");
  }
  const preflight = (prepared) => {
    if (config.client === "claude") checkPacketTurns(prepared, 128);
    const context = receiptContext(request, prepared);
    for (const [index, packet] of prepared.manifest.packets.entries()) {
      const files = new Map(packet.paths.map((name) => [name, prepared.files.get(name)]));
      const session = request.session;
      const prompt = directPacketPrompt(request, context, prepared, index, session, config.reviewer, config.maxBudgetUsd);
      invocation({ config, session, prompt, files, cwd: "packet", promptFile: "packet-prompt.txt", env: {} });
    }
    if (request.mode !== "candidate") return;
    if (config.localHarness) {
      const attachment = prepared.files.get("context/" + request.snapshot.harness);
      need(request.snapshot.harness && attachment, "Missing exact local harness result before candidate review");
      verifyHarnessSeal({ reference: expect.harness, binding: config.localHarness, configurationSha256: host.configurationSha256,
        candidate: request.snapshot.target, attachment, excluded: [...excluded, hostFile, directory, options.admission].filter(Boolean) });
    } else need(request.snapshot.harness === undefined && expect.harness === undefined, "Unexpected harness result without a host binding");
  };
  const observed = await observeDirectRuntime(config, [...excluded, hostFile]);
  const { python } = observed;
  if (expect.runtime) need(equal(expect.runtime, observed.runtime), "Installed Direct-CLI runtime differs from independent expectation");
  const runtimeReadback = { runtime: observed.runtime, maxBudgetUsd: config.maxBudgetUsd };
  if (command === "--prepare") return { exportSha256: await prepareExport(exportDirectory, request, expect.exportSha256, preflight),
    ...runtimeReadback };
  const prepared = await checkExport(exportDirectory, expect.exportSha256, request);
  preflight(prepared);
  receiptContext(request, prepared);
  await checkPrior(request, expect, prepared);
  const spend = options.admission ? await checkReviewSpend({ file: options.admission, policy, request,
    expect: { ...expect, ...runtimeReadback }, prepared, config, excluded: [...excluded, hostFile, observed.executable, python],
    extensionFiles: options["operator-key"] && { key: options["operator-key"], sha256: options["operator-key-sha256"],
      record: options["budget-extension"] } }) : null;
  if (command === "--check") return { exportSha256: expect.exportSha256, packets: prepared.manifest.packets.length,
    ...runtimeReadback, ...(spend ? { admission: spend.policy.mode, scope: spend.scope } : {}),
    ...(spend?.ledgerIdentity ? { ledgerIdentity: spend.ledgerIdentity } : {}) };
  need(expect.runtime && expect.statusSha256 === undefined && spend, "Missing runtime expectation or durable review reservation");
  need(request.worker.evidenceRoots.includes(directory) &&
    [workspace, hostFile, exportDirectory, options.request, options.expect, options.admission, observed.executable, python]
      .every((root) => separate(directory, root)), "Direct-CLI output overlaps protected host or review paths");
  await protectedParent(directory);
  await newAttemptPath(directory);
  return withDirectReviewSettlement(spend, () => directLaunch({ directory, request, expect, prepared, config, python, executable: observed.executable, exportDirectory,
    excluded: [workspace, hostFile, exportDirectory, options.request, options.expect, options.admission, spend.root,
      options["operator-key"], options["budget-extension"], observed.executable, python].filter(Boolean) }));
}

export async function reviewCommand(argv) {
  const { command, mode, options } = cli(argv);
  const schemaVersion = (await readJson(options.expect)).schemaVersion;
  if (schemaVersion === 2) return directCommand(command, mode, options);
  const { request, expect } = await loadInputs(options.request, options.expect);
  need(!(await reviewPolicy(request))?.directReviewer, "The integrated parent requires Direct-CLI evidence");
  need(command === "--verify", "Use the original independently pinned reviewer for an earlier integrated parent");
  need([options.export, options.request, options.expect]
    .every((root) => separate(options.output, root)), "Output overlaps retained inputs");
  const prepared = await checkExport(options.export, expect.exportSha256, request);
  await checkPrior(request, expect, prepared);
  return verify(options.output, request, expect, prepared);
}

async function newAttemptPath(directory) {
  try { await lstat(directory); }
  catch (error) { if (error.code === "ENOENT") return; throw error; }
  throw new Error("Expected an unused review output path");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.umask(0o077);
  try {
    const result = await reviewCommand(process.argv.slice(2));
    writeSync(1, JSON.stringify(result) + "\n");
    if (result.phase !== undefined && result.phase !== "complete") process.exitCode = 1;
  } catch (error) {
    writeSync(2, error.disposition ? JSON.stringify(error.disposition) + "\n" :
      `Review stopped: ${error.code ? "unsafe, missing or existing local artifact (" + error.code + ")" : error.message}\n`);
    process.exitCode = 1;
  }
}
