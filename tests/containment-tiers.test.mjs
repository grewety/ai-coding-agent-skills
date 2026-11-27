import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { hashBytes, jsonBytes } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/agent-configuration.mjs";
import { validatePilotHost } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/agent-setup.mjs";
import { driverDisposition, requireTier, tierIdentity } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/containment-tier.mjs";
import { replayGrokObservation } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-grok-offline.mjs";
import { windowsPrerequisites } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/windows-containment-preflight.mjs";
import { harnessConfiguration } from "../skills/software-development/openspec-delivery/scripts/local-harness.mjs";

test("tiered hosts retain role-specific driver and timeout boundaries", (t) => {
  const pin = { path: "/fixture/binary", sha256: "a".repeat(64) };
  const tier = { containmentTier: "a", osDriver: "linux-bwrap" };
  const host = { schemaVersion: 4, ...tier, roleBinding: { client: "claude-code", provider: "anthropic",
    model: "claude-sonnet-4-6", reasoningEffort: "high", executable: pin },
  bubblewrap: { executable: pin }, relay: { route: "same-uid-key", credentialRef: "fixture" },
  maxTurns: 96, interPacketDelayMs: 0, timeoutMs: 600000, maxBudgetUsd: 2.5,
  runtime: { node: pin, libraries: [], relayConfiguration: pin } };
  assert.deepEqual(tierIdentity(validatePilotHost(host)), tier);
  assert.throws(() => validatePilotHost({ ...host, timeoutMs: 600001 }), /limits/);
  assert.throws(() => validatePilotHost({ ...host, osDriver: "linux-codex-native" }), /do not match/);
  assert.throws(() => tierIdentity({ containmentTier: "a" }), /incomplete/);
  assert.deepEqual(requireTier({ containmentTier: "b", osDriver: "linux-codex-native" }, "implementer", "codex"),
    { containmentTier: "b", osDriver: "linux-codex-native" });
  assert.throws(() => requireTier({ containmentTier: "b", osDriver: "linux-bwrap" }, "implementer", "codex"), /do not match/);
  assert.equal(driverDisposition("macos-seatbelt", "linux"), "unsupported-on-host");
  assert.equal(driverDisposition("macos-seatbelt", "darwin"), "unqualified");

  const scratch = mkdtempSync(path.join(os.tmpdir(), "tiered-harness-"));
  t.after(() => rmSync(scratch, { recursive: true, force: true }));
  const file = path.join(scratch, "host.json");
  const localHarness = { id: "fixture", kind: "cli", executable: pin.path, executableSha256: pin.sha256,
    args: [], timeoutMs: 3000, maxAgeMs: 60000, exposure: "local-only" };
  const readHarness = (config) => {
    const bytes = jsonBytes(config);
    writeFileSync(file, bytes, { mode: 0o600 });
    return harnessConfiguration({ file, sha256: hashBytes(bytes) }, []);
  };
  assert.deepEqual(readHarness({ ...host, localHarness }), localHarness);
  assert.throws(() => readHarness({ ...host, osDriver: "linux-codex-native", localHarness }), /do not match/);
});

test("Windows prerequisites stop before clients or native controls are proved", () => {
  const observe = () => ({ nativeWindows: true, executables: { "codex.exe": false },
    container: false, job: false, filesystem: false });
  const options = { enabled: true, clients: ["codex"], platform: "linux", release: "6.6-microsoft-standard-WSL2",
    interop: "/fixture/interop", observe };
  assert.deepEqual(windowsPrerequisites({ ...options, interop: "" }), { status: "unsupported-on-host" });
  assert.deepEqual(windowsPrerequisites(options), { status: "missing-windows-client", missing: ["codex"] });
  assert.deepEqual(windowsPrerequisites({ ...options, observe: () => ({ ...observe(), executables: { "codex.exe": true } }) }),
    { status: "unqualified", pending: ["container", "job", "filesystem", "exact-native-qualification"] });
});

test("offline Grok replay checks parallel whole-file association, strict receipt and settlement", () => {
  const files = new Map([["target/a", Buffer.from("a\r\n")], ["target/b", Buffer.from("b\n")]]);
  const candidate = { target: "a".repeat(40), index: 0 };
  const expected = { containmentTier: "b", osDriver: "linux-bwrap", version: "1.0.92", model: "grok-4.7",
    provider: "xai-oauth", session: "synthetic-session", configurationSha256: "a".repeat(64),
    executableSha256: "b".repeat(64), adapterSha256: "c".repeat(64), qualificationSha256: "d".repeat(64), maxTurns: 10,
    packetSha256: hashBytes(jsonBytes([...files].map(([name, content]) => [name, hashBytes(content)]))) };
  const start = { type: "startup", runtime: expected, cwd: "/review", tools: ["read_file"],
    plugins: [], mcp: [], skills: [], commands: [], features: [] };
  const ids = [...files.keys()].map((name, index) => ({ id: "call-" + index, path: "/review/" + name,
    session: expected.session, packetSha256: expected.packetSha256 }));
  const requests = ids.map((request) => ({ type: "request", ...request, tool: "read_file" }));
  const results = ids.map((item) => ({ type: "result", ...item, ok: true, truncated: false,
    base64: files.get(item.path.slice(8)).toString("base64") })).reverse();
  const end = { type: "terminal", session: expected.session, packetSha256: expected.packetSha256, turns: 3, ok: true,
    report: ["BEGIN_REVIEW_RECEIPT", "Verdict: No findings", "Target: " + candidate.target,
      JSON.stringify({ target: candidate.target, packet: 1, findings: [], coverageLimitations: [] }), "END_REVIEW_RECEIPT"].join("\n") };
  const replay = (events, settlement = { code: 0, signal: null, outcome: "exit", quiescent: true }) => {
    const bytes = Buffer.from(events.map((event) => JSON.stringify(event)).join("\n") + "\n");
    return replayGrokObservation({ bytes, expected, candidate, files, settlement, observationSha256: hashBytes(bytes) });
  };
  assert.equal(replay([start, ...requests, ...results, end]).receipt.verdict, "Verdict: No findings");
  assert.throws(() => replay([start, ...requests, { ...results[0], id: results[1].id }, results[1], end]), /associated file/);
  assert.throws(() => replay([start, ...requests, { ...results[0], truncated: true }, results[1], end]), /incomplete/);
  assert.throws(() => replay([start, ...requests, results[0], end]), /coverage failed/);
  assert.throws(() => replay([start, ...requests, ...results, { ...end, report: end.report + "\nextra" }]), /framing/);
  assert.throws(() => replay([start, ...requests, ...results, end], { code: 0, signal: null, outcome: "exit", quiescent: false }),
    /settlement failed/);
});
