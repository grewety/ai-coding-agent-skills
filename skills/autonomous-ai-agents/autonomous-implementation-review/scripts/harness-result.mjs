// Generic pre-PR result contract, also shipped with the contained reviewer.
import { createHash } from "node:crypto";
import { closeSync, constants, fstatSync, lstatSync, openSync, readSync, realpathSync } from "node:fs";
import path from "node:path";

const digest = (value) => createHash("sha256").update(value).digest("hex");
const need = (ok, reason) => { if (!ok) throw new Error(reason); };
const object = (value) => value && Object.getPrototypeOf(value) === Object.prototype;
const keys = (value, fields) => object(value) && Object.keys(value).length === fields.length &&
  fields.every((name) => Object.hasOwn(value, name));
const sha = (value) => typeof value === "string" && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value);
const bounded = (value) => typeof value === "string" && value.trim().length && value.length <= 4096;
const findingPath = (value) => typeof value === "string" && value.length <= 768 &&
  value.split("/").every((part) => /^[a-zA-Z0-9_.@+-]+$/.test(part) && ![".", "..", ".git"].includes(part.toLowerCase()));

export function checkHarnessResult(result, { harnessId, candidate, earliest = 0, now = Date.now() }) {
  need(keys(result, ["schemaVersion", "harnessId", "candidate", "verdict", "findings", "observedAt"]) &&
    result.schemaVersion === 1 && result.harnessId === harnessId && sha(candidate) && result.candidate === candidate &&
    ["pass", "fail"].includes(result.verdict) && Array.isArray(result.findings) && result.findings.length <= 128,
  "Harness result schema, identity or SHA mismatch");
  const observed = Date.parse(result.observedAt);
  need(Number.isFinite(observed) && new Date(observed).toISOString() === result.observedAt &&
    observed >= earliest && observed <= now, "Harness result timestamp is outside its allowed window");
  need(result.findings.every((finding) => keys(finding, ["severity", "path", "line", "message"]) &&
    ["critical", "high", "medium", "low"].includes(finding.severity) && findingPath(finding.path) &&
    Number.isSafeInteger(finding.line) && finding.line >= 1 && bounded(finding.message)), "Invalid harness finding");
  need(result.verdict !== "pass" || result.findings.length === 0, "Passing harness result has unresolved findings");
  return result;
}

function canonicalExternal(file, excluded) {
  need(typeof file === "string" && path.isAbsolute(file) && path.normalize(file) === file &&
    !/[\x00-\x1f\x7f]/.test(file) && realpathSync(file) === file &&
    excluded.every((root) => [path.relative(root, file), path.relative(file, root)].every((relative) =>
      relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative))),
  "Harness host path is unsafe or overlaps candidate or review data");
}

function readHostPin(file, sha256, excluded, limit, sealed) {
  let fd;
  let bytes;
  try {
    need(process.getuid && /^[a-f0-9]{64}$/.test(sha256), "Invalid host pin");
    canonicalExternal(file, excluded);
    const uid = process.getuid();
    const parent = lstatSync(path.dirname(file));
    need(parent.isDirectory() && (sealed ? parent.uid === uid && !(parent.mode & 0o077) :
      [0, uid].includes(parent.uid) && !(parent.mode & 0o022)), "Untrusted host directory");
    fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const before = fstatSync(fd);
    need(before.isFile() && before.nlink === 1 && before.size <= limit &&
      (sealed ? before.uid === uid && !(before.mode & 0o277) :
        [0, uid].includes(before.uid) && !(before.mode & 0o022) && (before.mode & 0o111)),
    "Untrusted host file");
    bytes = Buffer.alloc(before.size + 1);
    let count = 0;
    while (count < bytes.length) {
      const size = readSync(fd, bytes, count, bytes.length - count, null);
      if (!size) break;
      count += size;
    }
    const after = fstatSync(fd);
    need(count === before.size && after.ctimeMs === before.ctimeMs && after.mtimeMs === before.mtimeMs,
      "Host file changed during read");
    bytes = bytes.subarray(0, count);
  } catch {
    throw new Error(sealed ? "Harness requires a private host-retained seal outside candidate and review data" :
      "Harness executable is not host-owned and pinned");
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
  need(digest(bytes) === sha256, sealed ? "Host harness seal SHA-256 mismatch" : "Harness executable pin drift");
  return bytes;
}

export function checkHarnessExecutable(binding, excluded) {
  readHostPin(binding.executable, binding.executableSha256, excluded, 64 * 1024 * 1024, false);
}

export function verifyHarnessSeal({ reference, binding, configurationSha256, candidate, excluded, attachment, now = Date.now() }) {
  need(keys(reference, ["file", "sha256"]), "Missing independent host-retained harness seal reference");
  const bytes = readHostPin(reference.file, reference.sha256, excluded, 64 * 1024, true);
  checkHarnessExecutable(binding, [...excluded, reference.file]);
  need(attachment === undefined || bytes.equals(attachment), "Harness attachment differs from host-retained seal");
  let seal;
  try { seal = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw new Error("Invalid host harness seal"); }
  need(keys(seal, ["schemaVersion", "configurationSha256", "executableSha256", "harnessId", "candidate", "resultSha256", "result"]) &&
    seal.schemaVersion === 2 && /^[a-f0-9]{64}$/.test(configurationSha256) && seal.configurationSha256 === configurationSha256 &&
    seal.executableSha256 === binding.executableSha256 && seal.harnessId === binding.id && seal.candidate === candidate &&
    seal.resultSha256 === digest(JSON.stringify(seal.result)), "Harness seal provenance, configuration or candidate SHA mismatch");
  const result = checkHarnessResult(seal.result, { harnessId: binding.id, candidate, earliest: now - binding.maxAgeMs, now });
  need(result.verdict === "pass", "Configured candidate harness did not pass");
  return result;
}

export function validateHarnessBinding(binding) {
  const fields = ["id", "kind", "executable", "executableSha256", "args", "timeoutMs", "maxAgeMs", "exposure"];
  need(keys(binding, binding?.kind === "mcp" ? [...fields, "tool"] : fields) &&
    typeof binding.id === "string" && /^[a-z][a-z0-9-]{0,63}$/.test(binding.id) &&
    ["cli", "mcp"].includes(binding.kind) && typeof binding.executable === "string" &&
    binding.executable.startsWith("/") && !/[\x00-\x1f\x7f]/.test(binding.executable) &&
    /^[a-f0-9]{64}$/.test(binding.executableSha256) && Array.isArray(binding.args) && binding.args.length <= 32 &&
    binding.args.every((arg) => typeof arg === "string" && arg.length <= 4096 && !arg.includes("\0")) &&
    Number.isSafeInteger(binding.timeoutMs) && binding.timeoutMs >= 100 && binding.timeoutMs <= 300000 &&
    Number.isSafeInteger(binding.maxAgeMs) && binding.maxAgeMs >= 1000 && binding.maxAgeMs <= 7 * 86400000 &&
    ["local-only", "separate-run"].includes(binding.exposure) &&
    (binding.kind !== "mcp" || /^[A-Za-z][A-Za-z0-9_.-]{0,127}$/.test(binding.tool)), "Invalid host harness binding");
}
