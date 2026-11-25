import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { candidate, draftPolicyContext, planning, policyContext, proveTaskCompletion } from
  "../skills/software-development/openspec-delivery/scripts/change-guard.mjs";
import { proposalFreeze } from "../skills/software-development/openspec-delivery/scripts/operator-planning.mjs";
import { finishReadiness } from "../skills/software-development/openspec-delivery/scripts/finish-readiness.mjs";
import { evidenceCommand } from "../skills/software-development/openspec-delivery/scripts/evidence-cli.mjs";
import { deliveryCommand } from "../skills/software-development/openspec-delivery/scripts/delivery-cli.mjs";
import { verifyLocalHarness } from "../skills/software-development/openspec-delivery/scripts/local-harness.mjs";
import { sha256 } from "../skills/software-development/openspec-delivery/scripts/evidence-retention.mjs";
import { standingTriggerDecision } from "../skills/software-development/openspec-delivery/scripts/external-verification.mjs";
import { buildExport, changedEntries, git as reviewGit, jsonBytes, tree } from
  "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-inputs.mjs";

import { reviewCommand } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-candidate.mjs";
const change = "sample-low-touch";
const dir = `openspec/changes/${change}`;
const delta = "## ADDED Requirements\n\n### Requirement: Result\nThe result SHALL pass.\n\n#### Scenario: Pass\n- **WHEN** the result is read\n- **THEN** it passes\n";
const current = "---\nmetadata_version: 1\nartifact: spec\ncapability: result\n---\n# Result\n\n## Requirements\n\n" + delta.slice(delta.indexOf("### "));
const tasks = "# Tasks\r\n\r\n- [ ] 1.1 Réal outcome\r\n\r\n```md\r\n- [ ] 1.2 example\r\n```\r\n";
const gateArgv = ["/usr/bin/true"];

function fixture(t, adopt = true) {
  const root = mkdtempSync(path.join(os.tmpdir(), "lt-"));
  t.after(() => {
    const entries = (dir) => {
      chmodSync(dir, 0o700);
      for (const entry of readdirSync(dir, { withFileTypes: true })) if (entry.isDirectory()) entries(path.join(dir, entry.name));
    };
    entries(root);
    rmSync(root, { recursive: true, force: true });
  });
  const repo = path.join(root, "repo");
  mkdirSync(repo);
  const git = (...args) => execFileSync("/usr/bin/git", ["-C", repo, ...args],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  const write = (file, value) => {
    mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
    writeFileSync(path.join(repo, file), value);
  };
  const head = () => git("rev-parse", "HEAD");
  const save = (title) => { git("add", "--all"); git("commit", "-m", title); return head(); };
  git("init", "-b", "main");
  git("config", "core.autocrlf", "false");
  git("config", "user.name", "Synthetic Fixture");
  git("config", "user.email", "fixture@example.invalid");
  write("AGENTS.md", adopt ? "<!-- openspec-low-touch: {} -->\n" : "# Legacy baseline\n");
  write("openspec/config.yaml", "schema: spec-driven\n");
  const parent = save("Integrated baseline");
  git("switch", "-c", "change/sample-low-touch");
  write(dir + "/.openspec.yaml", "schema: spec-driven\n");
  write(dir + "/proposal.md", "# Proposal\n");
  write(dir + "/tasks.md", tasks);
  write(dir + "/specs/result/spec.md", delta);
  write(dir + "/adr/0001-decision.md", "Intent-driven decision\n");
  write(dir + "/schema/data.json", '{"reviewed":true}\n');
  write(dir + "/evidence/private.md", "External readback vault\n");
  write(dir + "/vault/.private", "Reserved planning file\n");
  return { root, repo, git, write, head, save, parent, target: parent, change };
}

function candidateInput(f, plan, head) {
  const context = policyContext({ repo: f.repo, plan, target: f.target, change });
  return { repo: f.repo, change, head, base: f.parent, plan, target: f.target, "expect-plan": context.planDigest };
}

test("draft and committed inventories share custom coverage and exclusions under verified integrated policy", (t) => {
  const f = fixture(t);
  const draft = draftPolicyContext(f);
  const plan = f.save("Freeze exact plan");
  const committed = policyContext({ ...f, plan });
  assert.deepEqual(committed.inputs, draft.inputs);
  assert.deepEqual(committed.modes, draft.modes);
  assert.deepEqual(committed.inventory, draft.inventory);
  assert.ok(Object.hasOwn(committed.inputs, dir + "/adr/0001-decision.md"));
  assert.ok(Object.hasOwn(committed.inputs, dir + "/schema/data.json"));
  assert.ok(!Object.hasOwn(committed.inputs, dir + "/evidence/private.md"));
  assert.ok(!Object.hasOwn(committed.inputs, dir + "/vault/.private"));
  f.write(dir + "/adr/0001-decision.md", "Changed after freeze\n");
  const changed = f.save("Planning drift");
  assert.throws(() => candidate(candidateInput(f, plan, changed)), /frozen planning package/);
});

test("native freeze requires the observed custom schema artifact closure and exact file modes", (t) => {
  const f = fixture(t);
  for (const excluded of ["evidence", "vault"]) rmSync(path.join(f.repo, dir, excluded), { recursive: true });
  const context = draftPolicyContext(f);
  const root = path.join(f.repo, dir);
  const outputs = { proposal: ["proposal.md"], tasks: ["tasks.md"], specs: ["specs/result/spec.md"],
    architecture: ["adr/0001-decision.md", "schema/data.json"] };
  const absolute = Object.fromEntries(Object.entries(outputs).map(([id, files]) => [id, files.map((file) => path.join(root, file))]));
  const status = { changeName: change, changeRoot: root, isPlanningComplete: true,
    artifacts: Object.keys(outputs).map((id) => ({ id, status: "done" })),
    artifactPaths: Object.fromEntries(Object.entries(absolute).map(([id, files]) => [id, { existingOutputPaths: files }])) };
  const instructions = { changeName: change, changeDir: root, state: "ready", contextFiles: absolute };
  const validation = { verified: true, reference: "native-checks", change, policyRevision: f.parent, nativeReady: true,
    strictExitCode: 0, metadataExitCode: 0, issueReference: null, inputs: context.inputs, modes: context.modes, status, instructions };
  const workspace = { workspace: f.repo };
  const policy = { proposeToFreeze: true, requireApproachReview: false };
  const proposal = { proposeToFreeze: true, draftOnly: false };
  const input = { planningGrant: { verified: true, reference: "planning", change, policyRevision: f.parent,
    workspace: f.repo, write: true, validate: true, minutes: 10, minutesUsed: 1, corrections: 1,
    stop: "Freeze", stopReached: false, commits: true },
    baseline: { verified: true, reference: "baseline", head: f.parent, upstreamVerified: true },
    issue: { verified: true, reference: "issue", change, required: false, bound: false } };
  let check = 0;
  const assess = (value) => {
    const file = path.join(f.root, `native-check-${++check}.json`);
    const bytes = JSON.stringify(value);
    writeFileSync(file, bytes, { mode: 0o600 });
    return proposalFreeze({ input: { ...input, validation: { file, sha256: sha256(bytes) } }, context, workspace, policy, proposal });
  };
  assert.equal(assess(validation).action, "freeze-ready");
  const missing = structuredClone(validation);
  missing.status.artifactPaths.architecture.existingOutputPaths.push(path.join(root, "adr", "missing.md"));
  assert.equal(assess(missing).reason, "NATIVE_VALIDATION_PENDING");
  const drift = structuredClone(validation);
  drift.modes[dir + "/adr/0001-decision.md"] = "100755";
  assert.equal(assess(drift).reason, "NATIVE_VALIDATION_PENDING");
});

test("a pre-adoption parent preserves plan identity even when the candidate selects the policy", (t) => {
  const f = fixture(t, false);
  const plan = f.save("Freeze old plan");
  const old = planning(f.repo, plan, change);
  f.write("AGENTS.md", "<!-- openspec-low-touch: {} -->\n");
  f.write(dir + "/adr/0001-decision.md", "Not an input to the original schema\n");
  const head = f.save("Implement prospective policy");
  const context = policyContext({ ...f, plan });
  assert.equal(context.lowTouch, undefined);
  assert.equal(context.planDigest, old.digest);
  assert.equal(candidate(candidateInput(f, plan, head)).planDigest, old.digest);
});

test("unsafe, aliased and over-budget planning entries refuse complete inventory", (t) => {
  const f = fixture(t);
  const alias = dir + "/ADR/0001-decision.md";
  f.write(alias, "Alias\n");
  assert.throws(() => draftPolicyContext(f), /alias|duplicate/);
  rmSync(path.join(f.repo, "openspec/changes/sample-low-touch/ADR"), { recursive: true });
  const link = path.join(f.repo, dir, "adr/alias.md");
  symlinkSync("0001-decision.md", link);
  assert.throws(() => draftPolicyContext(f), /symlink/);
  const unsafe = f.save("Commit unsafe planning input");
  assert.throws(() => policyContext({ ...f, plan: unsafe }), /regular/);
  rmSync(link);
  for (let i = 0; i < 257; i++) f.write(dir + "/fixture/" + i, "x");
  assert.throws(() => draftPolicyContext({ ...f, draftHead: unsafe }), /regular/);
  f.git("reset", "--soft", f.parent);
  assert.throws(() => draftPolicyContext(f), /file limit/);
});

test("exact task child proves only lowercase accepted changes and requires different disposable evidence", async (t) => {
  const f = fixture(t);
  const plan = f.save("Freeze plan");
  f.write("openspec/specs/result/spec.md", current);
  const reviewedParent = f.save("Promote capability");
  f.write(dir + "/tasks.md", tasks.replace("[ ] 1.1", "[x] 1.1"));
  const head = f.save("Record accepted checkbox");
  const input = candidateInput(f, plan, head);
  const capture = async (revision, label) => {
    const checkout = path.join(f.root, `gate-${label}`);
    const output = path.join(f.root, `gate-${label}.json`);
    f.git("worktree", "add", "--detach", checkout, revision);
    const captured = await evidenceCommand("gate-capture", {
      output, checkout, implementation: f.repo, head: revision, base: f.parent, plan, change,
      target: f.target, mode: "task-guided", planDigest: input["expect-plan"], generated: [],
      bootstrap: [], gates: [{ argv: gateArgv, timeoutMs: 2000 }],
    });
    return { "gate-run": output, "gate-run-sha256": captured.fileSha256 };
  };
  f.git("reset", "--hard", reviewedParent);
  const parentGate = await capture(reviewedParent, "parent");
  f.git("reset", "--hard", head);
  const childGate = await capture(head, "child");
  const result = { action: "accept-result", head: reviewedParent, acceptedTaskIds: ["1.1"], independentZeroWaiver: true };
  assert.equal(finishReadiness(input, result).ready, false);
  assert.equal(finishReadiness({ ...input, ...parentGate }, result, { reviewedParent }).ready, false);
  assert.equal(finishReadiness({ ...input, ...childGate }, { ...result, independentZeroWaiver: false }, { reviewedParent }).ready, false);
  assert.deepEqual(finishReadiness({ ...input, ...childGate }, result, { reviewedParent }).taskCompletion,
    { reviewedParent, acceptanceChild: head, taskIds: ["1.1"] });
  assert.throws(() => proveTaskCompletion(input, reviewedParent, ["1.2"]), /unknown native task/);
  for (const [extra, expected] of [
    [() => f.write(dir + "/tasks.md", tasks.replace("[ ] 1.1", "[X] 1.1")), /lowercase/],
    [() => f.write(dir + "/tasks.md", tasks.replaceAll("[ ]", "[x]")), /other byte|Planning content/],
    [() => chmodSync(path.join(f.repo, dir, "tasks.md"), 0o755), /Planning content|file mode/],
    [() => f.write("extra.txt", "Extra source change"), /only the native/],
  ]) {
    f.git("reset", "--hard", reviewedParent);
    f.write(dir + "/tasks.md", tasks.replace("[ ] 1.1", "[x] 1.1"));
    extra();
    const bad = f.save("Invalid task completion");
    assert.throws(() => proveTaskCompletion(candidateInput(f, plan, bad), reviewedParent, ["1.1"]), expected);
  }
  assert.throws(() => proveTaskCompletion(input, plan, ["1.1"]), /reviewed direct parent/);
});

test("standing authority matches exact repository event, target, cost, configuration and exposure", () => {
  const now = Date.now();
  const candidate = "a".repeat(40);
  const repository = "owner/project";
  const event = "pull_request";
  const target = "main";
  const live = { id: "app:42:checks:pr", kind: "repository-check", configurationSha256: "b".repeat(64), repository,
    event, target, exposure: "existing-public-pr-diff", costUsd: 0 };
  const request = { candidate, repository, event, target, now, notBefore: now - 1000, finishReference: "finish",
    pushGrant: { verified: true, candidate, target: repository, reference: "push", finishReference: "finish", event, targetRef: target },
    observed: { verified: true, complete: true, candidate, repository, event, target, reference: "inventory",
      observedAt: new Date(now).toISOString(), triggers: [{ ...live, verified: true }] }, policy: { standingTriggers: [live] } };
  assert.deepEqual(standingTriggerDecision(request).standing, [live.id]);
  for (const fields of [{ costUsd: null }, { costUsd: 2 }, { configurationSha256: "c".repeat(64) },
    { kind: "deploy-preview" }, { kind: "tunnel" }, { exposure: "new-private-data" }]) {
    assert.equal(standingTriggerDecision({ ...request, observed: { ...request.observed, triggers: [{ ...live, verified: true, ...fields }] } }).action, "queue");
  }
  assert.equal(standingTriggerDecision({ ...request, now: now + 61000 }).reason, "TRIGGER_INVENTORY_UNVERIFIED");
  assert.equal(standingTriggerDecision({ ...request, observed: { ...request.observed, complete: false } }).action, "stop");
});

function harnessBinding(root) {
  const executable = path.join(root, "adapter");
  const bytes = "#!/bin/sh\nexit 1\n";
  writeFileSync(executable, bytes, { mode: 0o700 });
  return { id: "fixture", kind: "cli", executable, executableSha256: sha256(bytes), args: [],
    timeoutMs: 1000, maxAgeMs: 60000, exposure: "local-only" };
}

function harnessSeal(root, binding, configurationSha256, candidate, overrides = {}) {
  const file = path.join(root, "retained-harness.json");
  const result = { schemaVersion: 1, harnessId: binding.id, candidate, verdict: "pass", findings: [],
    observedAt: new Date().toISOString() };
  const bytes = Buffer.from(JSON.stringify({ schemaVersion: 2, harnessId: binding.id, candidate, configurationSha256,
    executableSha256: binding.executableSha256, resultSha256: sha256(JSON.stringify(result)), result, ...overrides }) + "\n");
  writeFileSync(file, bytes, { mode: 0o400 });
  return { file, sha256: sha256(bytes) };
}

test("host-owned CLI and MCP harnesses both seal the committed SHA and fail closed on mismatch", async (t) => {
  const f = fixture(t);
  const plan = f.save("Freeze plan");
  const checkout = path.join(f.root, "harness-checkout");
  f.git("worktree", "add", "--detach", checkout, plan);
  for (const kind of ["cli", "mcp"]) {
    const adapter = path.join(f.root, kind + "-adapter");
    const output = path.join(f.root, kind + "-result.json");
    const id = "fixture-" + kind;
    writeFileSync(adapter, `#!/usr/bin/python3
import json
import sys
from datetime import datetime, timezone
def result(candidate):
    return {"schemaVersion": 1, "harnessId": ${JSON.stringify(id)}, "candidate": candidate,
        "verdict": "pass", "findings": [], "observedAt": datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")}
def send(value):
    print(json.dumps(value), flush=True)
` + (kind === "cli" ?
      "send(result(sys.argv[-1]))\n" :
      `for line in sys.stdin:
    request = json.loads(line)
    if request.get("id") == 1:
        send({"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2024-11-05","capabilities":{"tools":{}}}})
    if request.get("id") == 2:
        send({"jsonrpc":"2.0","id":2,"result":{"structuredContent":result(request["params"]["arguments"]["candidate"])}})
`), { mode: 0o700 });
    const binding = { id, kind, executable: adapter, executableSha256: sha256(readFileSync(adapter)), args: [],
      timeoutMs: 3000, maxAgeMs: 60000, exposure: "local-only", ...(kind === "mcp" ? { tool: "fixture_review" } : {}) };
    const host = JSON.stringify({ schemaVersion: 1, localHarness: binding });
    const file = path.join(f.root, kind + "-host.json");
    writeFileSync(file, host, { mode: 0o600 });
    const hostConfiguration = { file, sha256: sha256(host) };
    const grant = { verified: true, reference: "grant", kind: "local-candidate-harness", policyRevision: f.parent,
      change, candidate: plan, harnessId: id, checkout, exposure: "local-only", exposureVerified: true, configurationSha256: hostConfiguration.sha256 };
    const params = { ...f, plan, checkout, candidate: plan, hostConfiguration, output, grant };
    const retained = await deliveryCommand("run-harness", params);
    assert.equal(retained.verdict, "pass");
    const sealed = JSON.parse(readFileSync(retained.harness.file));
    assert.deepEqual([sealed.schemaVersion, sealed.harnessId, sealed.candidate, sealed.configurationSha256, sealed.executableSha256],
      [2, id, plan, hostConfiguration.sha256, binding.executableSha256]);
    const readback = { hostConfiguration, harness: retained.harness, candidate: plan, excluded: [f.repo, checkout] };
    assert.equal(verifyLocalHarness(readback).sha256, retained.harness.sha256);
    assert.throws(() => verifyLocalHarness({ ...readback, candidate: f.parent }), /SHA mismatch/);
    assert.throws(() => verifyLocalHarness({ ...readback, harness: { ...retained.harness, sha256: "0".repeat(64) } }), /SHA-256 mismatch/);
    assert.throws(() => verifyLocalHarness({ ...readback, now: Date.now() + 61000 }), /timestamp/);
    await assert.rejects(deliveryCommand("run-harness", params), /EEXIST/);
    writeFileSync(adapter, "#!/bin/sh\nexit 0\n");
    assert.throws(() => verifyLocalHarness(readback), /executable pin drift/);
    await assert.rejects(deliveryCommand("run-harness", params), /executable pin drift/);
  }
});

test("candidate export includes custom artifacts and omits reserved vault preimages and postimages", async (t) => {
  const f = fixture(t);
  const plan = f.save("Freeze plan");
  f.write("source.txt", "Candidate\n");
  const target = f.save("Source");
  f.write("gate.json", '{"passed":true}\n');
  const context = policyContext({ ...f, plan });
  const receipt = path.join(f.root, "output");
  const worker = { schemaVersion: 1,
    identity: { attempt: "attempt-1", predecessor: null, role: "reviewer", change, group: "1", task: "1.1", action: "1.1",
      workspace: f.repo, plan, planDigest: context.planDigest, candidate: target, inputs: context.inputs, implementerSession: "implementer" },
    outcome: "Review the candidate", acceptance: ["All gates passed"], scope: ["source.txt"], nonGoals: ["Publish"],
    authority: { orchestrator: "owner", writer: "owner", authorSession: "owner", approvalReference: "plan", executionReference: "execution" },
    restrictions: ["no Git writes", "no tasks.md writes", "no profile writes", "no subagents", "no multiplexers", "read-only"],
    budget: { limit: 20, unit: "minutes" }, stop: "Out of scope", evidenceRoots: [receipt],
    requiredEvidence: ["native.txt", "lifecycle.jsonl"], mutablePaths: [] };
  const diff = changedEntries(f.repo, f.parent, target, tree(f.repo, f.parent), tree(f.repo, target), change).diff;
  assert.doesNotMatch(diff, /External readback vault|Reserved planning file/);
  const request = { schemaVersion: 1, mode: "candidate", session: "10000000-2000-4000-8000-000000000000", worker,
    policy: { parent: f.parent, target: f.parent },
    snapshot: { base: f.parent, target, plan, planDigest: context.planDigest, diffSha256: sha256(diff),
      gates: [{ command: "gate", commit: target, exitCode: 0, evidence: "gate.json" }] },
    attachments: { "gate.json": sha256(readFileSync(path.join(f.repo, "gate.json"))) }, limits: { diffBytes: 16384 } };
  const prepared = await buildExport(request);
  assert.ok(prepared.files.has("plan/" + dir + "/adr/0001-decision.md"));
  assert.ok([...prepared.files.keys()].every((name) => !name.includes("/evidence/") && !name.endsWith("/.private")));
  const approved = { ...request, fileAcceptance: [{ packet: 1, path: "source.txt", criterion: "Candidate text is checked" }] };
  await buildExport(approved);
  await assert.rejects(buildExport({ ...approved, fileAcceptance: [{ ...approved.fileAcceptance[0], packet: 2 }] }), /outside its packet/);
  await assert.rejects(buildExport({ ...request, policy: undefined }), /inventory|binding/i);
  assert.equal(reviewGit(f.repo, "rev-parse", "HEAD").toString().trim(), target);
  const paths = Object.fromEntries(["request", "expect", "host", "export", "output"].map((name) => [name, path.join(f.root, name)]));
  const bytes = jsonBytes(request);
  writeFileSync(paths.request, bytes);
  const pin = { path: "/missing/fixture-tool", sha256: "a".repeat(64) };
  const largest = Math.max(...prepared.manifest.packets.map(({ paths }) => paths.length));
  const config = { schemaVersion: 1, bwrap: pin, claude: pin, node: pin, libraries: [], model: "claude-fixture",
    timeoutMs: 1000, maxTurns: largest + 10, maxBudgetUsd: 0.25, requirePreExposureAttestation: false,
    relay: { route: "same-uid-key", keyFile: "/missing/fixture-key", keyFormat: "raw" } };
  const checkArguments = ["--request", paths.request, "--expect", paths.expect, "--export", paths.export, "--host-config", paths.host];
  const binding = { schemaVersion: 1, requestSha256: sha256(bytes), exportSha256: null, model: config.model };
  const writeHost = (maxTurns) => {
    const data = jsonBytes({ ...config, maxTurns });
    writeFileSync(paths.host, data, { mode: 0o600 });
    binding.configurationSha256 = sha256(data);
    writeFileSync(paths.expect, jsonBytes(binding));
  };
  const neverRuntime = () => assert.fail("Offline command reached the reviewer runtime");
  writeHost(largest + 9);
  await assert.rejects(reviewCommand(["--prepare", ...checkArguments], neverRuntime), /Packet 1 requires/);
  writeHost(largest + 10);
  const preflight = await reviewCommand(["--prepare", ...checkArguments], neverRuntime);
  binding.exportSha256 = preflight.exportSha256;
  writeFileSync(paths.expect, jsonBytes(binding));
  assert.equal((await reviewCommand(["--check", ...checkArguments], neverRuntime)).maxTurns, largest + 10);
  const ledger = path.join(f.root, "ledger");
  mkdirSync(ledger, { mode: 0o700 });
  const admissionFile = path.join(f.root, "admission.json");
  const admission = { schemaVersion: 1, phase: "execution", ledger, configurationSha256: binding.configurationSha256,
    phaseGrant: { kind: "contained-review-phase", verified: true, reference: "phase-grant", change,
      policyRevision: f.parent, phase: "execution", requestSha256: binding.requestSha256, authorityReference: "execution" } };
  const admissionArgs = [...checkArguments, "--admission", admissionFile];
  const liveArgs = ["--mode", "candidate", ...admissionArgs, "--output", paths.output];
  const writeAdmission = (value) => writeFileSync(admissionFile, jsonBytes(value), { mode: 0o600 });
  writeAdmission({ ...admission, configurationSha256: "0".repeat(64) });
  await assert.rejects(reviewCommand(liveArgs, neverRuntime), /Trusted host.json configuration pin/);
  writeAdmission(admission);
  const offline = await reviewCommand(["--check", ...admissionArgs], neverRuntime);
  assert.equal(offline.admission, "auto-approved");
  assert.equal(offline.scope.upperUsdMicros, (offline.packets + 1) * 250_000);
  assert.equal(readdirSync(ledger).length, 0);
  writeAdmission({ ...admission, caps: { maxTotalUsd: 0.000001 } });
  await assert.rejects(reviewCommand(liveArgs, neverRuntime), /cost cap/);
  writeAdmission(admission);
  await assert.rejects(reviewCommand(liveArgs, () => {
    assert.match(readdirSync(path.join(ledger, change))[0], /^[a-f0-9]{64}\.json$/);
    throw new Error("Synthetic boundary stops before opening the runtime");
  }), /Synthetic boundary/);
  await assert.rejects(reviewCommand(liveArgs, neverRuntime), /redeemed/);
  binding.configurationSha256 = "0".repeat(64);
  writeFileSync(paths.expect, jsonBytes(binding));
  await assert.rejects(reviewCommand(["--check", ...checkArguments], neverRuntime), /pin or model mismatch/);

  await t.test("configured reviewer requires an independent seal before offline or live admission", async (t) => {
    const adapter = harnessBinding(f.root);
    const hostBytes = jsonBytes({ ...config, maxTurns: largest + 11, localHarness: adapter });
    const configurationSha256 = sha256(hostBytes);
    writeFileSync(paths.host, hostBytes);
    const seal = harnessSeal(f.root, adapter, configurationSha256, target);
    const attached = readFileSync(seal.file);
    const name = "fixture-harness.json";
    t.after(() => rmSync(path.join(f.repo, name), { force: true }));
    const reviewed = { ...request, snapshot: { ...request.snapshot, harness: name },
      attachments: { ...request.attachments, [name]: sha256(attached) } };
    const exportPath = path.join(f.root, "harness-export");
    const args = ["--request", paths.request, "--expect", paths.expect, "--export", exportPath, "--host-config", paths.host];
    const live = ["--mode", "candidate", ...args, "--output", paths.output, "--admission", admissionFile];
    const expect = { ...binding, configurationSha256, requestSha256: sha256(jsonBytes(reviewed)), exportSha256: null };
    const retain = (harness) => writeFileSync(paths.expect, jsonBytes({ ...expect, harness }));
    chmodSync(paths.expect, 0o600);
    writeFileSync(paths.request, jsonBytes(reviewed));
    f.write(name, attached);
    retain(undefined);
    await assert.rejects(reviewCommand(["--prepare", ...args], neverRuntime), /Missing independent host-retained/);

    const copied = { file: path.join(f.repo, name), sha256: seal.sha256 };
    retain(copied);
    await assert.rejects(reviewCommand(["--prepare", ...args], neverRuntime), /private host-retained seal outside/);
    retain(seal);
    chmodSync(paths.expect, 0o644);
    await assert.rejects(reviewCommand(["--prepare", ...args], neverRuntime), /Untrusted configuration ownership/);
    chmodSync(paths.expect, 0o600);

    retain({ ...seal, sha256: "0".repeat(64) });
    await assert.rejects(reviewCommand(["--prepare", ...args], neverRuntime), /seal SHA-256 mismatch/);

    const mismatched = harnessSeal(ledger, adapter, configurationSha256, target, { executableSha256: "0".repeat(64) });
    retain(mismatched);
    await assert.rejects(reviewCommand(["--prepare", ...args], neverRuntime), /attachment differs/);
    const wrongBytes = readFileSync(mismatched.file);
    const wrongRequest = { ...reviewed, attachments: { ...reviewed.attachments, [name]: sha256(wrongBytes) } };
    f.write(name, wrongBytes);
    writeFileSync(paths.request, jsonBytes(wrongRequest));
    expect.requestSha256 = sha256(jsonBytes(wrongRequest));
    retain(mismatched);
    await assert.rejects(reviewCommand(["--prepare", ...args], neverRuntime), /seal provenance/);

    f.write(name, attached);
    writeFileSync(paths.request, jsonBytes(reviewed));
    expect.requestSha256 = sha256(jsonBytes(reviewed));
    retain(seal);
    const prepared = await reviewCommand(["--prepare", ...args], neverRuntime);
    expect.exportSha256 = prepared.exportSha256;
    retain(seal);
    assert.equal((await reviewCommand(["--check", ...args], neverRuntime)).exportSha256, prepared.exportSha256);
    assert.ok(!readFileSync(path.join(exportPath, "files/context", name)).includes(seal.file));
    retain(undefined);
    await assert.rejects(reviewCommand(live, neverRuntime), /Missing independent host-retained/);
    retain(seal);
    const executableBytes = readFileSync(adapter.executable);
    writeFileSync(adapter.executable, "#!/bin/sh\nexit 0\n");
    await assert.rejects(reviewCommand(live, neverRuntime), /executable pin drift/);
    writeFileSync(adapter.executable, executableBytes);
    const configuredLedger = path.join(f.root, "configured-ledger");
    mkdirSync(configuredLedger, { mode: 0o700 });
    writeAdmission({ ...admission, ledger: configuredLedger, configurationSha256,
      phaseGrant: { ...admission.phaseGrant, requestSha256: expect.requestSha256 } });
    await assert.rejects(reviewCommand(live, () => {
      throw new Error("Synthetic configured boundary before reviewer runtime");
    }), /Synthetic configured boundary/);
  });

  const archive = `openspec/changes/archive/2026-11-25-${change}`;
  mkdirSync(path.join(f.repo, "openspec/changes/archive"));
  renameSync(path.join(f.repo, dir), path.join(f.repo, archive));
  const archiveReceipt = archive + "/evidence/record.json";
  const receiptBytes = '{"verified":"synthetic retained receipt"}\n';
  f.write(archiveReceipt, receiptBytes);
  rmSync(path.join(f.repo, "gate.json"));
  const closure = f.save("Record-only archive");
  f.write("gate.json", '{"passed":true}\n');
  const closureDiff = changedEntries(f.repo, target, closure, tree(f.repo, target), tree(f.repo, closure), change).diff;
  const closureRequest = { ...request, worker: { ...worker, identity: { ...worker.identity, candidate: closure } },
    snapshot: { base: target, target: closure, plan, planDigest: context.planDigest, diffSha256: sha256(closureDiff),
      archiveEvidence: { [archiveReceipt]: sha256(receiptBytes) },
      gates: [{ command: "archive gate", commit: closure, exitCode: 0, evidence: "gate.json" }] } };
  const archived = await buildExport(closureRequest);
  assert.ok(archived.files.has("target/" + archive + "/adr/0001-decision.md"));
  assert.ok(!archived.files.has("target/" + archiveReceipt));
  await assert.rejects(buildExport({ ...closureRequest, snapshot: { ...closureRequest.snapshot, archiveEvidence: {} } }),
    /Unexpected archive addition/);

});


test("normal finish-readiness replays the original contained result and gates the change child", (t) => finishReadinessFixture(t));

test("delivery admission requires the independent expectation to match the configured harness", (t) => finishReadinessFixture(t, true));

async function finishReadinessFixture(t, configured = false) {
  const { fixture, own, current, currentSpec } = await import("./delivery-runtime-setup.mjs");
  const { gateFixture, containedHandover } = await import("./delivery-runtime-fixtures.mjs");
  const f = await fixture(t, { lowTouch: true });
  await f.write(f.workspace, "widget.txt", "new");
  await f.write(f.workspace, current, currentSpec);
  const reviewedParent = f.commit(f.workspace, "Implement and promote specs");
  const parentGates = await gateFixture(f, reviewedParent, "reviewed-parent");
  const reviewer = path.join(f.root, "isolated-review");
  f.git(f.repo, "worktree", "add", "--detach", reviewer, reviewedParent);
  const file = path.join(f.root, "host.json");
  const localHarness = configured ? harnessBinding(f.root) : null;
  const config = JSON.stringify({ schemaVersion: 1, localHarness });
  writeFileSync(file, config, { mode: 0o600 });
  const hostConfiguration = { file, sha256: sha256(config) };
  const harness = configured ? harnessSeal(f.root, localHarness, hostConfiguration.sha256, reviewedParent) : undefined;
  const handover = await containedHandover(f, reviewer, reviewedParent, parentGates, "parent-review", {
    configurationSha256: hostConfiguration.sha256, goalDigest: f.planDigest, harness,
  });
  const tasksFile = path.join(f.workspace, own, "tasks.md");
  writeFileSync(tasksFile, readFileSync(tasksFile, "utf8").replace("[ ] 1.1", "[x] 1.1"));
  const head = f.commit(f.workspace, "Record accepted native task");
  const childGates = await gateFixture(f, head, "acceptance-child");
  const run = { ...f.request, deliveryPhase: "result", head, handover, hostConfiguration, harness,
    gateRun: parentGates.gateRun, attempt: { id: "parent-review" },
    taskCompletion: { reviewedParent, childGate: childGates.gateRun } };
  const accepted = (await f.run("finish-readiness", run)).value;
  assert.equal(accepted.ready, true, JSON.stringify(accepted));
  assert.deepEqual(accepted.taskCompletion, { reviewedParent, acceptanceChild: head, taskIds: ["1.1"] });
  assert.equal(accepted.gateReference, childGates.captured.value.wrapperSha256);
  assert.equal(accepted.reviewedGateReference, parentGates.captured.value.wrapperSha256);
  const status = (await f.run("status", run)).value;
  assert.equal(status.state, "finish-ready", JSON.stringify(status));
  assert.equal(status.candidateSha, head);
  const wrong = (await f.run("finish-readiness", { ...run, taskCompletion: { ...run.taskCompletion, childGate: parentGates.gateRun } })).value;
  assert.equal(wrong.ready, false);
  const stale = (await f.run("finish-readiness", { ...run, taskCompletion: undefined })).value;
  assert.equal(stale.ready, false);
  if (configured) {
    const missing = (await f.run("finish-readiness", { ...run, harness: undefined })).value;
    assert.equal(missing.ready, false);
    const expect = JSON.parse(readFileSync(handover.expect));
    delete expect.harness;
    const bytes = jsonBytes(expect);
    chmodSync(handover.expect, 0o600);
    writeFileSync(handover.expect, bytes);
    const unbound = (await f.run("finish-readiness", { ...run, handover: { ...handover, expectFileSha256: sha256(bytes) } })).value;
    assert.equal(unbound.ready, false);
  }
}
