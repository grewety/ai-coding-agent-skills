#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { writeSync } from "node:fs";
import { lstat, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { convergenceDecision } from "./orchestration-core.mjs";
import { admitReceipt, candidateResult, describeFile, receiptContext, reviewPrompt } from "./review-admission.mjs";
import { absolute, checkExport, checkSealedDirectory, digest, equal, fields, fileLimit, hash, jsonBytes, need, newProtectedDirectory,
  prepareExport, protectedParent, readJson, reviewPolicy, sealDirectories, separate, totalLimit, uuid, validateReviewRequest } from "./review-inputs.mjs";
import { bubblewrapVersion, claudeVersion, requireReviewHost, runtimeBinding, verifyRuntimePins, withReviewRuntime } from "./review-runtime.mjs";
import { checkPacketTurns, offlineHostBinding, reviewClock, trustedJson } from "./review-preflight.mjs";
import { checkProbeSpend, checkReviewSpend, claimProbeRun, claimReviewRun } from "./review-spend.mjs";
import { verifyHarnessSeal } from "./harness-result.mjs";
import { runtimeIdentity } from "./implementer-runtime.mjs";
import { checkRoleIndependence, validatePin } from "./role-config.mjs";
import { auditVersion } from "./runtime-version.mjs";
import { upstreamClasses } from "./review-upstream-status.mjs";
import { auditClaudeStream } from "./review-stream.mjs";
import { createAttempt, publishResult, readClosed, readHandoff, requestBytes as workerRequestBytes, writeClosed } from "./worker-handoff.mjs";
import { packetConcurrency, replayPacketSchedule, schedulePackets } from "./review-packet-scheduler.mjs";

const probePrompt = "Do not call any tools. Reply with exactly REVIEW_PROBE_OK.";
const supervisorFields = ["code", "signal", "outcome", "quiescent"];
const writeJson = (dir, name, value) => writeClosed(path.join(dir, name), jsonBytes(value), true);
const readSealed = (dir, name, limit) => readClosed(path.join(dir, name), limit, true);

function validateRuntime(runtime, expect) {
  fields(runtime, ["session", "model", "version", "bubblewrapVersion", "maxTurns", "maxBudgetUsd",
    "configurationSha256", "route"], "retained runtime", ["explicit"]);
  if (expect.explicit) {
    need(equal(runtime.explicit, expect.explicit) && runtime.version === expect.explicit.version.observedVersion &&
      runtime.bubblewrapVersion === expect.explicit.bubblewrap.observedVersion &&
      runtime.route === "same-uid-key", "Explicit review runtime pins or version audit differ");
  } else need(runtime.explicit === undefined && runtime.version === claudeVersion &&
    runtime.bubblewrapVersion === bubblewrapVersion, "Legacy review runtime versions differ");
  need(uuid(runtime.session) &&
    runtime.model === expect.model && runtime.configurationSha256 === expect.configurationSha256 &&
    ["same-uid-key", "dedicated-uid-broker"].includes(runtime.route) &&
    Number.isSafeInteger(runtime.maxTurns) && runtime.maxTurns >= 1 && runtime.maxTurns <= 128 &&
    Number.isFinite(runtime.maxBudgetUsd) && runtime.maxBudgetUsd > 0 && runtime.maxBudgetUsd <= 10, "Runtime binding mismatch");
}

function validateExplicit(expect, request) {
  if (expect.qualification === undefined && expect.generator === undefined && expect.explicit === undefined) return;
  validatePin(expect.qualification);
  fields(expect.generator, ["provider", "session"], "independently retained generating role");
  need(expect.generator.session === (request.worker.identity.implementerSession ?? request.worker.authority.authorSession),
    "Generating session differs from the review request");
  checkRoleIndependence(expect.generator, { provider: "anthropic", session: request.session });
  if (expect.explicit === undefined) return;
  const explicit = expect.explicit;
  const pins = ["executableSha256", "relaySha256", "runtimeSha256", "qualificationSha256"];
  fields(explicit, ["provider", "reasoningEffort", "version", "bubblewrap", ...pins], "independent explicit runtime");
  need(explicit.provider === "anthropic" && ["low", "medium", "high", "max"].includes(explicit.reasoningEffort) &&
    pins.every((key) => digest(explicit[key])) && explicit.qualificationSha256 === expect.qualification.sha256,
  "Invalid independently retained explicit reviewer pins");
  for (const [record, floor] of [[explicit.version, claudeVersion], [explicit.bubblewrap, bubblewrapVersion]]) {
    need(equal(record, auditVersion(record, record.observedVersion, floor)), "Explicit runtime version audit differs");
  }
}

async function loadInputs(requestFile, expectFile) {
  const request = await readJson(requestFile);
  validateReviewRequest(request);
  const expect = await readJson(expectFile);
  fields(expect, ["schemaVersion", "requestSha256", "exportSha256", "configurationSha256", "model"],
    "independent expectation", ["statusSha256", "harness", "qualification", "generator", "explicit", "packetConcurrency"]);
  packetConcurrency(expect.packetConcurrency);
  need(expect.schemaVersion === 1 && expect.requestSha256 === hash(jsonBytes(request)) &&
    (expect.exportSha256 === null || digest(expect.exportSha256)) && digest(expect.configurationSha256) &&
    typeof expect.model === "string" && /^claude-[a-z0-9-]{2,100}$/.test(expect.model) &&
    (expect.statusSha256 === undefined || digest(expect.statusSha256)), "Request differs from independently retained binding");
  if (request.mode === "approach") need(expect.model === request.snapshot.record.binding.model, "Approach model differs from fixed binding");
  validateExplicit(expect, request);
  return { request, expect };
}

function attemptRuntime(runtime) {
  return { adapter: "claude-code", client: "claude-code", version: runtime.version,
    session: runtime.session, provider: "anthropic", model: runtime.model,
    configurationSource: runtime.configurationSha256, configurationScope: "contained-review", readOnly: true };
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
  try { return auditClaudeStream(observation.proc, observation.runtime, paths, probe, files); }
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
  let result;
  let handoff = null;
  if (request.mode === "candidate" && observed.phase === "complete") {
    files["native.txt"] = observed.native;
    handoff = candidateResult(expected, observed.runtime, observed.receipts, files, describe);
    result = handoff;
  } else {
    files["report.md"] = observed.native;
    result = { schemaVersion: 1, mode: request.mode, requestSha256: expect.requestSha256,
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
    schemaVersion: 1, requestSha256: expect.requestSha256, exportSha256: expect.exportSha256,
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
  const retained = await loadInputs(prior.request, prior.expect);
  need(retained.request.mode === "approach" && retained.request.snapshot.priorLaunches.length === 0 &&
    retained.expect.configurationSha256 === expect.configurationSha256 && retained.expect.model === expect.model &&
    packetConcurrency(retained.expect.packetConcurrency) === packetConcurrency(expect.packetConcurrency) &&
    equal(retained.expect.explicit, expect.explicit) && equal(retained.expect.generator, expect.generator) &&
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
  const readback = await verify(prior.output, retained.request, retained.expect, oldExport);
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
        prompt: reviewPrompt(request, context, packet, index, prepared.manifest.packets.length, reference) };
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
    await writeClosed(path.join(directory, "report.md"), reconstructed.files["report.md"], true);
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
  "--probe": ["host-config", "admission", "output"],
  "--mode": ["request", "expect", "export", "output", "host-config"],
  "--verify": ["request", "expect", "export", "output"],
};

function cli(argv) {
  const [command, ...arguments_] = argv;
  need(Object.hasOwn(commands, command), "Invalid CLI option");
  const budgetOptions = ["budget-extension", "operator-key", "operator-key-sha256"];
  const optional = {
    "--prepare": ["host-config"], "--check": ["host-config", "admission", ...budgetOptions],
    "--mode": ["admission", ...budgetOptions], "--verify": [], "--probe": ["qualification", "qualification-sha256"],
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
  need(Boolean(options.qualification) === Boolean(options["qualification-sha256"]), "Missing independent qualification path or pin");
  need(Boolean(options["operator-key"]) === Boolean(options["operator-key-sha256"]) &&
    (!options["operator-key"] || options.admission) && (!options["budget-extension"] || options["operator-key"]),
  "Review extensions require admission and an independently pinned operator key");
  return { command, mode, options };
}

export async function reviewCommand(argv, openRuntime = withReviewRuntime) {
  const { command, mode, options } = cli(argv);
  if (command === "--probe") {
    const directory = options.output;
    const hostFile = options["host-config"];
    const { value, configurationSha256 } = await trustedJson(hostFile, [directory]);
    need(value.schemaVersion === 2 || !options.qualification, "Legacy probe cannot select explicit qualification");
    const qualification = options.qualification && { path: options.qualification, sha256: options["qualification-sha256"] };
    const config = requireReviewHost(value, [directory, options.admission], value.schemaVersion === 2 ? {
      qualification, configurationSha256, runtimeSha256: await runtimeIdentity(), verifyRuntimeIdentity: runtimeIdentity,
      hostPin: { path: hostFile, sha256: configurationSha256 },
    } : {});
    const explicit = runtimeBinding(config, null, configurationSha256).explicit;
    if (explicit) await verifyRuntimePins(config, [directory, options.admission]);
    const excluded = [hostFile, ...hostPaths(config)];
    const spend = await checkProbeSpend({ file: options.admission, configurationSha256,
      maxBudgetUsd: config.maxBudgetUsd, excluded: [...excluded, directory],
      ...(explicit ? { explicitRuntimeSha256: hash(jsonBytes(explicit)) } : {}) });
    await protectedParent(directory);
    await newAttemptPath(directory);
    need(excluded.every((root) => separate(directory, root)), "Output overlaps protected host paths");
    await claimProbeRun(spend);
    await newProtectedDirectory(directory, [...excluded, options.admission, spend.grant.ledger]);
    let phase = "probe-failed";
    try {
      const passed = await openRuntime(config, { parent: directory, excluded: [directory, hostFile, options.admission, spend.grant.ledger],
        packetCount: 0, configurationSha256 }, async (run) => {
        const attempt = await run({ files: new Map(), prompt: probePrompt });
        await capture(directory, 0, attempt);
        return audit(attempt, [], true) !== null;
      });
      if (passed) phase = "probe-passed";
    } finally {
      await writeJson(directory, "status.json", { schemaVersion: 1, phase, deliveryAccepted: false });
      await sealDirectories(directory);
    }
    return { phase };
  }
  const { request, expect } = await loadInputs(options.request, options.expect);
  need(mode === null || request.mode === mode, "CLI mode differs from request");
  const exportDirectory = options.export;
  need([options.request, options.expect, ...request.worker.evidenceRoots]
    .every((root) => separate(exportDirectory, root)), "Export overlaps retained inputs or evidence");
  const policy = await reviewPolicy(request);
  const trustExcluded = [request.worker.identity.workspace, exportDirectory, options.request, options.expect, ...request.worker.evidenceRoots];
  const checking = ["--prepare", "--check", "--mode"].includes(command);
  if (policy && checking) need(options["host-config"], "An adopting parent requires a pinned offline host configuration");
  if (expect.qualification && command !== "--verify") {
    const { value } = await trustedJson(options.expect, trustExcluded.filter((root) => root !== options.expect), true);
    need(equal(value, expect), "Explicit review expectation changed during admission");
  }
  const host = options["host-config"] ? await offlineHostBinding(options["host-config"], expect, trustExcluded,
    Boolean(policy), { qualification: expect.qualification, runtimeSha256: expect.qualification ? await runtimeIdentity() : undefined,
      verifyRuntimeIdentity: runtimeIdentity,
      independentOf: [request.session, request.worker.authority.authorSession, request.worker.authority.orchestrator,
        request.worker.identity.implementerSession] }) : null;
  const { config } = host ?? {};
  const explicit = config && runtimeBinding(config, request.session, host.configurationSha256).explicit;
  if (explicit) {
    need(expect.generator && (!expect.explicit || equal(expect.explicit, explicit)),
      "Missing independent generating role or changed reviewer readback");
    if (command === "--mode") need(policy && expect.explicit && options.admission,
      "Explicit review requires adopting policy, independent runtime readback and durable run admission");
  } else if (command === "--verify" && expect.qualification) {
    need(expect.explicit, "Missing independently retained explicit reviewer readback");
  }
  const binding = policy && request.mode === "candidate" && config?.localHarness;
  if (binding) {
    const { value } = await trustedJson(options.expect, [...trustExcluded.filter((root) => root !== options.expect),
      options["host-config"]], true);
    need(equal(value, expect), "Host expectation changed during admission");
  }
  const preflight = (prepared) => {
    if (config && (policy || command !== "--mode")) checkPacketTurns(prepared, config.maxTurns);
    if (!policy || !config || request.mode !== "candidate") return;
    if (binding) {
      const attachment = prepared.files.get("context/" + request.snapshot.harness);
      need(request.snapshot.harness && attachment, "Missing exact local harness result before candidate review");
      verifyHarnessSeal({ reference: expect.harness, binding, configurationSha256: host.configurationSha256,
        candidate: request.snapshot.target, attachment, excluded: [...trustExcluded, options["host-config"],
          options.output, options.admission].filter(Boolean) });
    } else need(request.snapshot.harness === undefined && expect.harness === undefined,
      "Unexpected harness result without a host binding");
  };
  if (command === "--prepare") return { exportSha256: await prepareExport(exportDirectory, request, expect.exportSha256, preflight),
    ...(explicit ? { explicit } : {}) };
  const prepared = await checkExport(exportDirectory, expect.exportSha256, request);
  preflight(prepared);
  if (options.admission) need(policy && config, "Admission file requires adopting policy and pinned host.json");
  const spend = options.admission ? await checkReviewSpend({ file: options.admission, policy, request, expect, prepared,
    config, excluded: [...trustExcluded, options["host-config"], ...(options["operator-key"] ? hostPaths(config) : [])],
    extensionFiles: options["operator-key"] && { key: options["operator-key"], sha256: options["operator-key-sha256"],
      record: options["budget-extension"] } }) : null;
  receiptContext(request, prepared);
  await checkPrior(request, expect, prepared);
  if (command === "--check") return { exportSha256: expect.exportSha256, packets: prepared.manifest.packets.length,
    ...(config ? { maxTurns: config.maxTurns } : {}), ...(spend ? { admission: spend.policy.mode, scope: spend.scope } : {}),
    ...(spend?.ledgerIdentity ? { ledgerIdentity: spend.ledgerIdentity } : {}),
    ...(explicit ? { explicit } : {}) };
  const directory = options.output;
  need([exportDirectory, options.request, options.expect].every((root) => separate(directory, root)), "Output overlaps retained inputs");
  if (command === "--verify") return verify(directory, request, expect, prepared);
  need(expect.statusSha256 === undefined, "Use a fresh output for a new review");
  need(!policy || spend, "Missing trusted admission and durable reservation before review launch");
  const concurrency = packetConcurrency(config.packetConcurrency);
  need(concurrency === 1 || spend, "Concurrent review requires durable reservation of the probe and every packet");
  validateRuntime(runtimeBinding(config, request.session, expect.configurationSha256), expect);
  need(request.worker.evidenceRoots.includes(directory) &&
    [request.worker.identity.workspace, options["host-config"], ...hostPaths(config)]
      .every((root) => separate(directory, root)), "Output overlaps protected host or review paths");
  const excluded = [exportDirectory, options["host-config"], ...hostPaths(config)];
  if (binding) excluded.push(expect.harness.file);
  const parent = await protectedParent(directory);
  await newAttemptPath(directory);
  if (options.admission) excluded.push(options.admission);
  if (options["operator-key"]) excluded.push(options["operator-key"]);
  if (options["budget-extension"]) excluded.push(options["budget-extension"]);
  if (spend) await claimReviewRun(spend);
  const packetCount = prepared.manifest.packets.length;
  const clock = policy || concurrency > 1 || config.interPacketDelayMs || config.runTimeoutMs
    ? reviewClock(config, packetCount) : undefined;
  return openRuntime(config, { parent, excluded: [request.worker.identity.workspace, exportDirectory, directory],
    packetCount, configurationSha256: expect.configurationSha256 },
  (run) => runReview({ request, expect, prepared, directory, excluded, run, clock }));
}

async function newAttemptPath(directory) {
  try { await lstat(directory); }
  catch (error) { if (error.code === "ENOENT") return; throw error; }
  throw new Error("Expected an unused review output path");
}

function hostPaths(config) {
  return [config.bwrap.path, config.claude.path, config.node.path, ...config.libraries.map((pin) => pin.path),
    config.relay.keyFile ?? config.relay.socket];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.umask(0o077);
  try {
    const result = await reviewCommand(process.argv.slice(2));
    writeSync(1, JSON.stringify(result) + "\n");
    if (result.phase?.endsWith("-failed") || ["invalid-receipt", "receipt-invalid", "incomplete-packets"].includes(result.phase)) process.exitCode = 1;
  } catch (error) {
    writeSync(2, error.disposition ? JSON.stringify(error.disposition) + "\n" :
      `Review stopped: ${error.code ? "unsafe, missing or existing local artifact (" + error.code + ")" : error.message}\n`);
    process.exitCode = 1;
  }
}
