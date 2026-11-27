import { fields, sha256Pattern, token, need } from "./role-config.mjs";
import { hashBytes, jsonBytes, parseStrictJson } from "./agent-configuration.mjs";
import { admitReceipt } from "./review-admission.mjs";
import { fileLimit, totalLimit, relative, utf8 } from "./review-inputs.mjs";

// Contract for a future qualified native-stream normalizer. This audit can be
// exercised offline. Its input alone cannot establish native provenance.
export function replayGrokObservation({ bytes, expected, files, probe, settlement, observationSha256, candidate }) {
  fields(expected, ["containmentTier", "osDriver", "version", "model", "provider", "session",
    "configurationSha256", "executableSha256", "adapterSha256", "packetSha256", "qualificationSha256", "maxTurns"], [],
  "independent Grok expectation");
  need(expected.containmentTier === "b" && expected.osDriver === "linux-bwrap" && expected.version === "1.0.92" &&
    expected.model === "grok-4.7" && expected.provider === "xai-oauth" && token(expected.session) &&
    Number.isSafeInteger(expected.maxTurns) && expected.maxTurns >= 1 && expected.maxTurns <= 128 &&
    Object.entries(expected).filter(([name]) => name.endsWith("Sha256")).every(([, value]) => sha256Pattern.test(value)),
  "Unexpected Grok Tier B runtime");
  fields(settlement, ["code", "signal", "outcome", "quiescent"], [], "Grok process settlement");
  need(settlement.code === 0 && settlement.signal === null && settlement.outcome === "exit" &&
    settlement.quiescent === true, "Grok process settlement failed");
  need(Buffer.isBuffer(bytes) && bytes.length <= totalLimit &&
    hashBytes(bytes) === observationSha256, "Grok observation differs from its independent pin");
  need(files instanceof Map && files.size < 128 && (!probe || files.size === 0), "Invalid Grok review file inventory");
  const inventory = [...files].sort(([a], [b]) => a.localeCompare(b, "en")).map(([name, content]) => {
    need(relative(name) && Buffer.isBuffer(content) && content.length <= fileLimit, "Invalid Grok whole-file input");
    return [name, hashBytes(content)];
  });
  need(hashBytes(jsonBytes(inventory)) === expected.packetSha256, "Grok packet file inventory changed");
  const source = utf8(bytes);
  need(source.endsWith("\n"), "Incomplete Grok observation");
  const lines = source.slice(0, -1).split("\n");
  need(lines.length >= 2 && lines.length <= 4096, "Unbounded Grok observation");
  const [start, ...events] = lines.map((line) => parseStrictJson(Buffer.from(line)));
  const end = events.pop();
  fields(start, ["type", "runtime", "cwd", "tools", "plugins", "mcp", "skills", "commands", "features"], [], "Grok startup");
  need(start.type === "startup" && start.cwd === "/review" &&
    jsonBytes(start.runtime).equals(jsonBytes(expected)) && Array.isArray(start.tools) &&
    start.tools.length === 1 && start.tools[0] === "read_file" &&
    [start.plugins, start.mcp, start.skills, start.commands, start.features].every((items) => Array.isArray(items) && !items.length),
  "Grok effective runtime or startup inventory differs");
  const used = new Set();
  const covered = new Set();
  const pending = new Map();
  for (const event of events) {
    need(!probe && event.session === expected.session && event.packetSha256 === expected.packetSha256 && token(event.id),
      "Grok event session or packet association differs");
    if (event.type === "request") {
      fields(event, ["type", "session", "packetSha256", "id", "tool", "path"], [], "Grok read request");
      const name = event.path?.startsWith("/review/") ? event.path.slice(8) : null;
      need(event.tool === "read_file" && !used.has(event.id) && files.has(name), "Unexpected Grok read request");
      used.add(event.id);
      pending.set(event.id, name);
    } else {
      fields(event, ["type", "session", "packetSha256", "id", "path", "ok", "truncated", "base64"], [], "Grok read result");
      const name = pending.get(event.id);
      need(event.type === "result" && name !== undefined && event.path === "/review/" + name &&
        event.ok === true && event.truncated === false && event.base64 === files.get(name).toString("base64"),
      "Grok result is incomplete or differs from its associated file");
      pending.delete(event.id);
      covered.add(name);
    }
  }
  fields(end, ["type", "session", "packetSha256", "ok", "turns", "report"], [], "Grok terminal result");
  need(end.type === "terminal" && end.session === expected.session && end.packetSha256 === expected.packetSha256 &&
    end.ok === true && Number.isSafeInteger(end.turns) && end.turns >= 1 && end.turns <= expected.maxTurns &&
    pending.size === 0 && covered.size === files.size && typeof end.report === "string" &&
    Buffer.byteLength(end.report) <= fileLimit, "Grok terminal result or whole-file coverage failed");
  if (probe) {
    need(end.report === "REVIEW_PROBE_OK", "Unexpected Grok probe result");
    return null;
  }
  fields(candidate, ["target", "index"], [], "independent Grok candidate");
  need(typeof candidate.target === "string" && /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(candidate.target) &&
    Number.isSafeInteger(candidate.index) && candidate.index >= 0 &&
    end.report.startsWith("BEGIN_REVIEW_RECEIPT\n") && end.report.endsWith("\nEND_REVIEW_RECEIPT"),
  "Invalid Grok receipt framing or candidate");
  const receipt = admitReceipt({ mode: "candidate" }, { target: candidate.target }, end.report, candidate.index,
    null, { paths: [...files.keys()] }, { framedOnly: true });
  return { report: end.report, receipt };
}
