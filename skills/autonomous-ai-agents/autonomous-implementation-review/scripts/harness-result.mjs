// Generic pre-PR result contract, also shipped with the contained reviewer.
import { createHash } from "node:crypto";

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

export function checkHarnessSeal(bytes, { configurationSha256, harnessId, candidate, maxAgeMs, now = Date.now() }) {
  const seal = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  need(keys(seal, ["schemaVersion", "configurationSha256", "resultSha256", "result"]) && seal.schemaVersion === 1 &&
    /^[a-f0-9]{64}$/.test(configurationSha256) && seal.configurationSha256 === configurationSha256 &&
    seal.resultSha256 === digest(JSON.stringify(seal.result)), "Harness seal or host configuration differs");
  const result = checkHarnessResult(seal.result, { harnessId, candidate, earliest: now - maxAgeMs, now });
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
