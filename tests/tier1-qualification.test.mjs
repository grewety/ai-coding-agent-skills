import assert from "node:assert/strict";
import { chmod, mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { piReleaseInventory, verifyPiRelease } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/agent-pi-runtime.mjs";
import { jsonBytes as settingsBytes } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/agent-configuration.mjs";
import { runtimeIdentity } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/implementer-runtime.mjs";
import { reviewCommand } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-candidate.mjs";
import { hash, jsonBytes } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-inputs.mjs";
import { containmentArgs, requireReviewHost, runtimeBinding } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-runtime.mjs";
import { eventsFor, files, processFor } from "./review-tier1-fixture.mjs";

test("Pi requires exact qualification and its single-run synthetic trial is independently replayable", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "tier1-"));
  t.after(async () => {
    await chmod(path.join(root, "output"), 0o700).catch(() => {});
    await rm(root, { recursive: true, force: true });
  });
  const pin = async (name, bytes, mode = 0o600) => {
    const filename = path.join(root, name);
    await writeFile(filename, bytes, { mode });
    return { path: filename, sha256: hash(bytes) };
  };
  const versionFixture = (version) => "#!/bin/sh\nprintf '%s\\n' '" + version + "'\n";
  const pi = await pin("pi", versionFixture("pi 1.5.2"), 0o700);
  const bwrap = await pin("bwrap", versionFixture("bubblewrap 0.9.0"), 0o700);
  const releasePath = path.join(root, "release");
  const pkg = path.join(releasePath, "node_modules/@earendil-works/pi-coding-agent");
  await mkdir(path.join(pkg, "dist/bundle"), { recursive: true, mode: 0o700 });
  await writeFile(path.join(pkg, "package.json"), '{"name":"@earendil-works/pi-coding-agent","version":"1.5.2"}');
  const entry = path.join(pkg, "dist/bundle/cli.js");
  await writeFile(entry, "// Synthetic release entry\n");
  const piRelease = { path: releasePath, ...await piReleaseInventory(releasePath) };
  const upstreamSocket = { path: path.join(root, "hermes-xai.sock"), device: "1", inode: "2" };
  const relay = await pin("relay.json", settingsBytes({
    schemaVersion: 1, route: "hermes-proxy-xai-oauth", credentialRef: "fixture", upstreamSocket,
  }));
  const role = { client: "pi", provider: "xai-oauth", model: "grok-4.7", reasoningEffort: "off",
    versionPolicy: "exact", versionCheck: true, exactVersion: "1.5.2", executable: pi, transport: "unix-socket" };
  const host = { schemaVersion: 2, roleBinding: role,
    bubblewrap: { executable: bwrap, versionPolicy: "exact", versionCheck: true, exactVersion: "0.9.0" },
    relay: { route: "hermes-proxy-xai-oauth", credentialRef: "fixture" }, maxTurns: 96,
    interPacketDelayMs: 0, timeoutMs: 1000, maxBudgetUsd: 1, runtime: { node: bwrap, libraries: [], relayConfiguration: relay, piRelease } };
  const hostPin = await pin("host.json", settingsBytes(host));
  const shared = { runtimeSha256: await runtimeIdentity(), configurationSha256: hostPin.sha256 };
  const subject = { ...shared, relaySha256: relay.sha256,
    constraintsSha256: hash(jsonBytes({ runtime: host.runtime, bubblewrapAudit: {
      versionPolicy: "exact", versionCheck: true, exactVersion: "0.9.0", observedVersion: "0.9.0", comparison: "passed",
    } })),
    roleBindingSha256: hash(settingsBytes(role)),
  };
  const { client, provider, model, reasoningEffort, transport } = role;
  const controls = Object.fromEntries(("effectiveSettings minimalRootfs readOnly directNetworkDenied unixSocketInference " +
    "credentialsAndDiagnosticsHostOnly unauthorizedToolsDenied wholeFileStreamCoverage nativeTerminalResult strictReceipt " +
    "offlineReplay originalProcessTreeSettled finiteRelayRequestsAndDeadline parallelWholeFileResults")
    .split(" ").map((name) => [name, true]));
  const offlineProof = { schemaVersion: 1, kind: "offline", supervisor: "fixture-supervisor", subject,
    effective: { client, provider, model, reasoningEffort, transport, version: "1.5.2", executableSha256: pi.sha256 }, controls };
  const offline = await pin("offline.json", settingsBytes(offlineProof));
  assert.throws(() => requireReviewHost(host, [], shared), /bounded live proof/);
  assert.throws(() => requireReviewHost(host, [], { ...shared, trialOffline: { ...offline, sha256: "0".repeat(64) } }), /pin mismatch/);
  assert.throws(() => requireReviewHost({ ...host, runtime: undefined, roleBinding: { ...role, client: "grok-build", exactVersion: "1.0.92" },
    relay: { ...host.relay, route: "xai-oauth" } }, [], shared), /no verified host-only xAI OAuth/);
  const config = requireReviewHost(host, [], { ...shared, trialOffline: offline });
  const explicit = runtimeBinding(config, null, hostPin.sha256).explicit;
  const snapshot = path.join(root, "release-copy");
  await verifyPiRelease(piRelease, [], snapshot);
  const session = "12121212-3434-4b4b-b5b5-565656565656";
  const args = containmentArgs(config, "/tmp/packet", "/tmp/socket", { session }, snapshot);
  assert.deepEqual(args.slice(args.indexOf("--session-id"), args.indexOf("--session-id") + 2), ["--session-id", session]);
  assert.ok(args.includes("/control/node_modules") && !args.includes(pi.path) && !args.includes(upstreamSocket.path));
  assert.equal(explicit.piReleaseSha256, piRelease.inventorySha256);
  assert.ok(args.includes("--unshare-all") && args.includes("--clearenv") && args.includes("--no-context-files"));
  assert.deepEqual(args.slice(args.indexOf("PI_TELEMETRY") - 1, args.indexOf("PI_TELEMETRY") + 2),
    ["--setenv", "PI_TELEMETRY", "0"]);
  assert.ok(args.includes("--no-approve"));
  assert.deepEqual(args.slice(args.indexOf("/tmp/packet") - 1, args.indexOf("/tmp/packet") + 2),
    ["--ro-bind", "/tmp/packet", "/review"]);
  assert.ok(args.includes("/control/inference.sock") && !args.includes(relay.path));
  assert.deepEqual(args.slice(args.indexOf("--tools"), args.indexOf("--tools") + 2), ["--tools", "read"]);
  const output = path.join(root, "output");
  const ledger = path.join(root, "ledger");
  await mkdir(ledger, { mode: 0o700 });
  const grant = await pin("grant.json", settingsBytes({ schemaVersion: 1, kind: "standalone-review-probe",
    reference: "synthetic-grant", verified: true, runs: 1, configurationSha256: hostPin.sha256,
    upperUsdMicros: 1000000, ledger, explicitRuntimeSha256: hash(jsonBytes(explicit)) }));
  const flags = ["--host-config", hostPin.path, "--output", output, "--tier1-offline", offline.path,
    "--tier1-offline-sha256", offline.sha256];
  const open = async (actual, options, callback) => callback(async ({ session, files: assigned, prompt }) => {
    assert.deepEqual(assigned, files);
    const report = prompt.slice(prompt.lastIndexOf("\nBEGIN_REVIEW_RECEIPT\n") + 1);
    return { runtime: runtimeBinding(actual, session, options.configurationSha256), proc: processFor(eventsFor(report, assigned, session, prompt)) };
  });
  const result = await reviewCommand(["--probe", ...flags, "--admission", grant.path], open);
  assert.equal(result.phase, "trial-passed");
  const replay = ["--verify-tier1-trial", ...flags, "--status-sha256"];
  assert.deepEqual(await reviewCommand([...replay, result.statusSha256], () => assert.fail("replay started runtime")), result);
  await assert.rejects(reviewCommand([...replay, "0".repeat(64)], open), /status pin mismatch/);
  await writeFile(entry, "// Drifted release entry\n");
  await assert.rejects(verifyPiRelease(piRelease, []), /inventory pin mismatch/);
});
