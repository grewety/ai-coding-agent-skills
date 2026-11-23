#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync, lstatSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { createRepresentation, verifyRepresentation, assertCloseoutReadbacks, maxInput, maxCommands, maxStream,
  readBounded, readJson, scopedPath, separate, sha256, stableJson, verifyCapture, verifyGateRun } from "./evidence-retention.mjs";
export { sha256 } from "./evidence-retention.mjs";
import { safePlanningPath } from "./planning-inventory.mjs";

const requireThat = (condition, message) => { if (!condition) throw new Error(message); };
const sha = (value) => typeof value === "string" && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value);
const digest = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const text = (value) => typeof value === "string" && value.trim().length > 0;
const noNul = (value) => typeof value === "string" && !value.includes("\0");
const utf8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

function retain(file, value) {
  scopedPath(file, true);
  const bytes = Buffer.from(`${JSON.stringify(value)}\n`);
  requireThat(bytes.length <= maxInput, "Evidence output exceeds the retention bound");
  writeFileSync(file, bytes, { flag: "wx", mode: 0o600 });
  return { output: file, fileSha256: sha256(bytes) };
}
function commandSpec(spec) {
  requireThat(spec && Array.isArray(spec.argv) && spec.argv.length > 0 && spec.argv.length <= 64 &&
    text(spec.argv[0]) && spec.argv.every((arg) => noNul(arg) && Buffer.byteLength(arg) <= 4096), "Expected a bounded argument vector");
  requireThat(Number.isSafeInteger(spec.timeoutMs) && spec.timeoutMs > 0 && spec.timeoutMs <= 3_600_000, "Expected a finite command timeout");
}
export async function captureCommand({ argv, cwd, revision, scope, environmentScope, timeoutMs, env = process.env }) {
  commandSpec({ argv, timeoutMs });
  scopedPath(cwd);
  requireThat(lstatSync(cwd).isDirectory() && (revision === null || sha(revision)) &&
    text(scope) && text(environmentScope), "Missing checkout or capture provenance");
  const result = await new Promise((resolve) => {
    const child = spawn(argv[0], argv.slice(1), { cwd, env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    const captured = { stdout: [], stderr: [] };
    let interruption = null;
    const interrupt = (reason) => {
      interruption ??= reason;
      child.kill("SIGKILL");
      child.stdout?.destroy();
      child.stderr?.destroy();
    };
    const timer = setTimeout(() => interrupt("TIMEOUT"), timeoutMs);
    for (const name of ["stdout", "stderr"]) {
      let size = 0;
      child[name].on("data", (chunk) => {
        const remaining = maxStream - size;
        captured[name].push(chunk.subarray(0, remaining));
        size += Math.min(remaining, chunk.length);
        if (chunk.length > remaining) interrupt("OUTPUT_LIMIT");
      });
      child[name].on("error", (error) => interrupt(error.code ?? "STREAM_ERROR"));
    }
    child.on("error", (error) => { interruption ??= error.code ?? "SPAWN_ERROR"; });
    child.once("close", (status, signal) => {
      clearTimeout(timer);
      resolve({ status, interruption: interruption ?? signal,
        stdout: Buffer.concat(captured.stdout), stderr: Buffer.concat(captured.stderr) });
    });
  });
  const complete = !result.interruption && Number.isInteger(result.status);
  const exitStatus = complete ? result.status : -1;
  const observedAt = new Date().toISOString();
  const provenance = { command: argv, environmentScope, exitStatus, observedAt,
    revision: revision ?? "not-applicable", scope, pagination: complete ? "complete" : "partial", readbackType: "lossless-representation" };
  const stream = (source, original) => createRepresentation({ original: original ?? Buffer.alloc(0),
    provenance: { source, ...provenance }, labels: { representation: provenance.readbackType,
      completeness: provenance.pagination, confidentiality: "restricted" } });
  return { schemaVersion: 1, kind: "command-capture", argv, cwd, revision, exitStatus, observedAt, complete,
    interruption: complete ? null : (result.interruption ?? "UNKNOWN"),
    stdout: stream("command-stdout", result.stdout), stderr: stream("command-stderr", result.stderr) };
}

export async function captureGates(request) {
  const { candidate, checkoutObservation } = await import("./change-guard.mjs");
  const { checkout, implementation, head, base, plan, change, mode, target, planDigest, generated = [], bootstrap = [], gates, output } = request;
  requireThat(!existsSync(output), "Evidence output already exists");
  requireThat(separate(scopedPath(checkout), scopedPath(implementation)) &&
    separate(scopedPath(output, true), checkout) && separate(output, implementation), "Gate and evidence paths must be isolated from the implementation");
  requireThat(Array.isArray(generated) && generated.every(safePlanningPath) && new Set(generated).size === generated.length &&
    Array.isArray(bootstrap) && Array.isArray(gates) && gates.length > 0 &&
    bootstrap.length + gates.length <= maxCommands, "Invalid gate run request");
  [...bootstrap, ...gates].forEach(commandSpec);
  const snapshot = candidate({ repo: implementation, base, head, plan, change, mode, target, "expect-plan": planDigest });
  const initial = checkoutObservation(checkout, head, { detached: true });
  requireThat(initial.tree === snapshot.tree, "Gate checkout tree does not match the candidate");
  const commands = [];
  let final = initial;
  for (const [index, spec] of [...bootstrap, ...gates].entries()) {
    const record = await captureCommand({ argv: spec.argv, timeoutMs: spec.timeoutMs, cwd: checkout, revision: head, environmentScope: "disposable-checkout",
      scope: index < bootstrap.length ? "bootstrap" : "gate" });
    commands.push(record);
    try { final = checkoutObservation(checkout, head, { detached: true, generated }); }
    catch (error) {
      // Keep the failed observations and captured bytes, even when a command contaminated the checkout.
      const saved = retain(output, { schemaVersion: 1, kind: "rejected-gate-run", head, initial, commands, reason: error.message });
      return { ok: false, ...saved, error: error.message };
    }
    if (!record.complete || record.exitStatus !== 0) break;
  }
  const payload = { schemaVersion: 1, kind: "disposable-gate-run", implementation, checkout, head,
    change, plan, planDigest: snapshot.planDigest, mode: mode ?? "task-guided", tree: snapshot.tree, generated, initial, final, bootstrapCount: Math.min(bootstrap.length, commands.length), commands };
  if (commands.length <= bootstrap.length) return { ok: false, ...retain(output,
    { ...payload, kind: "rejected-gate-run", reason: "Bootstrap failed before any gate ran" }) };
  const run = { ...payload, wrapperSha256: sha256(stableJson(payload)) };
  const saved = retain(output, run);
  const verified = verifyGateRun(run, { head, implementation, change, plan, planDigest: snapshot.planDigest,
    mode: mode ?? "task-guided", tree: snapshot.tree });
  return { ok: verified.passed, ...saved, wrapperSha256: run.wrapperSha256, head };
}

export async function evidenceCommand(command, input) {
  if (command === "gate-capture") return captureGates(input);
  if (command === "capture") {
    const { cwd, revision = null, output, argv, timeoutMs, scope, environmentScope } = input;
    requireThat(separate(scopedPath(output, true), scopedPath(cwd)) && !existsSync(output),
      "Capture evidence needs a fresh destination outside its checkout");
    const check = revision === null ? null : (await import("./change-guard.mjs")).checkoutObservation;
    const observation = () => check?.(cwd, revision, { detached: input.detached === true });
    observation();
    const record = await captureCommand({ cwd, revision, argv, timeoutMs, scope, environmentScope });
    try { observation(); }
    catch (error) {
      return { ok: false, ...retain(output, { schemaVersion: 1, kind: "rejected-command-capture", reason: error.message, record }),
        error: error.message, exitStatus: record.exitStatus };
    }
    return { ok: verifyCapture(record), ...retain(output, record), exitStatus: record.exitStatus };
  }
  if (command === "seal") {
    const { original, provenance, labels, output } = input;
    const record = createRepresentation({ original: readBounded(original), provenance, labels });
    return { ok: true, ...retain(output, record), wrapperSha256: record.wrapperSha256 };
  }
  if (command === "verify") {
    const bytes = readBounded(input.file);
    requireThat(digest(input.sha256) && sha256(bytes) === input.sha256, "Retained evidence file identity mismatch");
    const record = JSON.parse(utf8.decode(bytes));
    if (record.kind === "command-capture") return { ok: record.complete, passed: verifyCapture(record), fileSha256: input.sha256, revision: record.revision };
    if (record.kind === "disposable-gate-run") {
      const verified = verifyGateRun(record, input.expected);
      return { ok: record.commands.every(({ complete }) => complete), ...verified, fileSha256: input.sha256 };
    }
    verifyRepresentation(record);
    return { ok: record.labels.completeness !== "partial", fileSha256: input.sha256, wrapperSha256: record.wrapperSha256,
      originalSha256: record.decodedOriginalSha256, revision: record.provenance.revision };
  }
  if (command === "assert-closeout") {
    const readbacks = Object.fromEntries(Object.entries(input.readbacks ?? {}).map(([key, ref]) => {
      requireThat(["pr", "checks", "checkRuns", "threads", "closure"].includes(key), "Unknown closeout readback");
      const bytes = readBounded(ref.file);
      requireThat(digest(ref.sha256) && sha256(bytes) === ref.sha256, `Retained ${key} file identity mismatch`);
      return [key, JSON.parse(utf8.decode(bytes))];
    }));
    return assertCloseoutReadbacks({ ...input, readbacks });
  }
  throw new Error("Expected capture, gate-capture, seal, verify or assert-closeout");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [command, ...args] = process.argv.slice(2);
    const { values } = parseArgs({ args, options: { input: { type: "string", multiple: true } } });
    requireThat(values.input?.length === 1, "Expected one --input JSON file");
    const result = await evidenceCommand(command, readJson(values.input[0]));
    writeFileSync(1, `${JSON.stringify(result)}\n`);
    if (!result.ok) process.exitCode = 1;
  } catch (error) {
    writeFileSync(1, `${JSON.stringify({ ok: false, error: error.message })}\n`);
    process.exitCode = 1;
  }
}
