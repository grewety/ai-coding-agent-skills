import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sha256 } from "../skills/software-development/openspec-delivery/scripts/evidence-cli.mjs";
import { createAttempt, publishResult } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/worker-handoff.mjs";

const delivery = fileURLToPath(new URL("../skills/software-development/openspec-delivery/scripts/delivery-cli.mjs", import.meta.url));
const evidence = fileURLToPath(new URL("../skills/software-development/openspec-delivery/scripts/evidence-cli.mjs", import.meta.url));
const verifier = fileURLToPath(new URL("../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/worker-handoff.mjs", import.meta.url));
const change = "delivery-fixture";
const own = `openspec/changes/${change}`;
const current = "openspec/specs/widget/spec.md";
const requirement = "### Requirement: Widget works\nThe widget SHALL load.\n\n#### Scenario: Launch\n- **WHEN** the widget opens\n- **THEN** it loads\n";
const currentSpec = `---\nmetadata_version: 1\nartifact: spec\ncapability: widget\n---\n# Widget\n\n## Requirements\n\n${requirement}`;
const gateArgv = [process.execPath, "-e", "const fs=require('node:fs');if(fs.readFileSync('widget.txt','utf8')!=='new')process.exit(8);fs.writeSync(1,'widget tested')"];
const env = { PATH: process.env.PATH, GIT_CONFIG_NOSYSTEM: "1",
  GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : os.devNull };
const boundary = { reversibleLocal: true, orderedDependencies: false, stagedAuthority: false, prescribedMethod: false };

function exec(executable, args) {
  const result = spawnSync(executable, args, { env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  assert.equal(result.error, undefined);
  return result;
}
async function fixture(t, { integratedOptIn = true, staged = false } = {}) {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), "delivery-runtime-")));
  t.after(() => rm(root, { recursive: true, force: true }));
  const repo = path.join(root, "source");
  const workspace = path.join(root, "implementation");
  await mkdir(repo);
  const git = (cwd, ...args) => {
    const result = exec("git", ["--no-optional-locks", "-C", cwd, "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", ...args]);
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  const write = async (dir, file, contents) => {
    await mkdir(path.dirname(path.join(dir, file)), { recursive: true });
    await writeFile(path.join(dir, file), contents);
  };
  const commit = (dir, message) => {
    git(dir, "add", ".");
    git(dir, "commit", "-m", message);
    return git(dir, "rev-parse", "HEAD");
  };
  git(repo, "init", "-b", "main");
  await write(repo, "AGENTS.md", `# Fixtures\n${integratedOptIn ? "<!-- openspec-delivery-mode: goal-first -->\n" : ""}`);
  await write(repo, ".gitignore", "/dist/\n/ignored-input\n");
  await write(repo, "widget.txt", "old");
  const base = commit(repo, "Integrated policy and product");
  git(repo, "update-ref", "refs/remotes/origin/main", base);
  git(repo, "worktree", "add", "-b", `change/${change}`, workspace, base);
  const contract = { schemaVersion: 1, outcome: "Deliver the widget", scope: [current, "widget.txt"],
    invariants: ["Use only local synthetic fixture data"], nonGoals: ["Publish"],
    adaptableAssumptions: ["Legacy fixture still uses its previous value"], acceptance: ["Widget loads"],
    gates: [gateArgv], localAuthority: { commits: true, stop: "Scope conflict" }, budgets: { minutes: 30, corrections: 2 } };
  await Promise.all([
    write(workspace, "openspec/config.yaml", "schema: spec-driven\n"),
    write(workspace, `${own}/.openspec.yaml`, "schema: spec-driven\n"),
    write(workspace, `${own}/proposal.md`, "# Proposal\n\n```openspec-goal-contract\n" + JSON.stringify(contract) + "\n```\n"),
    write(workspace, `${own}/specs/widget/spec.md`, `# Spec Delta\n\n## ADDED Requirements\n\n${requirement}`),
    write(workspace, `${own}/tasks.md`, "# Tasks\n\n## 1. Widget\n- [ ] 1.1 Pass the widget gate\n" +
      (staged ? "\n## 2. External\n- [ ] 2.1 Run separate preview\n" : "")),
  ]);
  if (!integratedOptIn) await write(workspace, "AGENTS.md", "# Unintegrated opt-in\n<!-- openspec-delivery-mode: goal-first -->\n");
  let index = 0;
  const run = async (command, input, cli = delivery) => {
    const file = path.join(root, `input-${++index}.json`);
    await writeFile(file, JSON.stringify(input));
    const result = exec(process.execPath, [cli, command, "--input", file, ...(cli === delivery ? ["--json"] : [])]);
    return { status: result.status, stdout: result.stdout, value: JSON.parse(result.stdout) };
  };
  const draft = await run("policy", {
    repo: workspace, change, phase: "freeze", parent: base, target: base,
    selection: { revision: base, reference: "retained:draft-policy", preExecutionReview: false, continuousGoal: false },
    deliveryBoundary: { ...boundary, stagedAuthority: staged }, declaredContractPaths: integratedOptIn ? [] : ["AGENTS.md"],
  });
  assert.equal(draft.status, 0, draft.stdout);
  assert.equal(draft.value.planDigest, null);
  assert.equal(draft.value.policy.executionAuthorized, false);
  const plan = commit(workspace, "Freeze plan");
  const selection = { revision: base, reference: "retained:integrated-policy", preExecutionReview: false, continuousGoal: false };
  const defaults = { repo, change, plan, target: base, workspace, selection, deliveryBoundary: { ...boundary, stagedAuthority: staged },
    declaredContractPaths: integratedOptIn ? [] : ["AGENTS.md"] };
  const evaluated = (await run("policy", defaults)).value;
  assert.equal(evaluated.policy.mode, integratedOptIn && !staged ? "goal-first" : "task-guided");
  const { planDigest, policy } = evaluated;
  assert.equal(draft.value.goalContractDigest, evaluated.goalContractDigest);
  const identity = { change, plan, planDigest, workspace, mode: policy.mode, policyRevision: base };
  const approval = { ...identity, schemaVersion: 1, kind: policy.mode === "goal-first" ? "exact-goal-approval" : "exact-plan-approval",
    approved: true, verified: true, reference: "retained:approval" };
  const grant = { ...identity, schemaVersion: 1, kind: "local-execution-grant", verified: true, reference: "retained:local-grant",
    approvalReference: approval.reference, localOnly: true, budgets: { minutes: 25, corrections: 1 }, commits: true, stop: "Local result",
    eligibleGroups: ["1"], budget: { limit: 25, unit: "minutes" } };
  const retained = { verified: true, reference: "retained:preflight" };
  const reviewer = sha256("synthetic reviewer");
  const config = sha256("synthetic reviewer config");
  const preflight = {
    live: { ...retained, head: base, branch: "main", remote: "origin", repository: "example/fixture" },
    auth: { ...retained, authenticated: true, requiredScopesPresent: true, repository: "example/fixture" },
    local: { ...retained, activeChangeInventoryVerified: true },
    reviewer: { ...retained, outcome: "pass", configurationSha256: config, expectedConfigurationSha256: config, packageSha256: reviewer },
    relay: { ...retained, ready: true, materialRetained: false, configurationSha256: config },
    runtime: { ...retained, node: process.version, openspec: "2.1.1", expected: { node: process.version, openspec: "2.1.1" } },
    checkpoint: { ...retained, head: base, policyRevision: base, prerequisitesVerified: true },
    companions: { ...retained, actual: { reviewer }, expected: { reviewer } },
  };
  const observed = { plan, planDigest, ownership: "exclusive", host: "ready", humanInput: "none", remoteRequired: false, stopReached: false,
    alignment: { scope: "aligned", invariants: "aligned", nonGoals: "aligned", acceptance: "aligned", localAuthority: "aligned",
      "frozen-plan": "aligned", order: "aligned" }, adaptations: [], minutesUsed: 1, groupMinutesUsed: 1, correctionsUsed: 0,
    correctionHistory: [], activeAttempt: { group: "1", implementerSession: "fixture-implementer" }, dependencies: "accepted",
    gates: "pass", review: "pass", nextChange: false, budgetUsed: 1, authorityBudgetUsed: 1, completedGroups: 0 };
  const request = { ...defaults, approval, grant, preflight, observed, restrictions: { inspect: false, group: null, noCommits: false },
    deliveryPhase: "dispatch" };
  return { root, repo, workspace, base, plan, planDigest, policy, evaluated, contract, request, git, run, write, commit };
}

async function gateFixture(f, head, label, gates = [gateArgv]) {
  const checkout = path.join(f.root, `gate-${label}`);
  const output = path.join(f.root, `capture-${label}.json`);
  f.git(f.repo, "worktree", "add", "--detach", checkout, head);
  const request = { output, checkout, implementation: f.workspace, head, base: f.base, plan: f.plan, change,
    mode: f.policy.mode, target: f.base, planDigest: f.planDigest, generated: ["dist"],
    bootstrap: [{ argv: [process.execPath, "-e", "require('node:fs').mkdirSync('dist')"], timeoutMs: 5_000 }],
    gates: gates.map((argv) => ({ argv, timeoutMs: 5_000 })) };
  const captured = await f.run("gate-capture", request, evidence);
  return { captured, checkout, request, gateRun: { file: output, sha256: captured.value.fileSha256 } };
}

async function createHandover(f, head, gateReference, attempt, role = "reviewer", active = false) {
  const context = (await f.run("policy", f.request)).value.context;
  const directory = path.join(f.root, attempt);
  const request = { schemaVersion: 1,
    identity: { attempt, predecessor: null, role, change, group: "1", task: "1.1", action: "1.1", workspace: f.workspace, plan: f.plan,
      planDigest: f.planDigest, candidate: role === "reviewer" ? head : null, inputs: { ...context.inputs },
      implementerSession: role === "reviewer" ? "fixture-implementer" : null },
    outcome: "Review the widget", acceptance: [`gate-run:${gateReference}`], scope: ["widget.txt"], nonGoals: ["Publish"],
    authority: { orchestrator: "fixture-owner", writer: "fixture-owner", authorSession: "fixture-author",
      approvalReference: f.request.approval.reference, executionReference: f.request.grant.reference },
    restrictions: ["no Git writes", "no tasks.md writes", "no profile writes", "no subagents", "no multiplexers",
      ...(role === "reviewer" ? ["read-only"] : [])], budget: { limit: 15, unit: "minutes" },
    stop: "Scope conflict", evidenceRoots: [directory], requiredEvidence: ["native.txt", "lifecycle.jsonl"], mutablePaths: [],
  };
  if (role === "reviewer") {
    request.identity.inputs[`${own}/tasks.md`] = sha256(await readFile(path.join(f.workspace, own, "tasks.md")));
  }
  const runtime = { adapter: "synthetic", client: "synthetic", version: "1", session: role === "reviewer" ? "fixture-reviewer" : "fixture-implementer",
    provider: "synthetic", model: "fixture", configurationSource: "test", configurationScope: attempt, readOnly: role === "reviewer" };
  const expected = await createAttempt({ directory, request, excludedRoots: [f.workspace] });
  const verifierSha256 = sha256(await readFile(verifier));
  if (active) {
    const activeFile = path.join(directory, "active.json");
    const bytes = Buffer.from(JSON.stringify({ schemaVersion: 1, kind: "active-attempt-observation", state: "working", identity: request.identity,
      requestSha256: expected.requestSha256, session: runtime.session }));
    await writeFile(activeFile, bytes, { mode: 0o400 });
    return { kind: "active-attempt", verifier, verifierSha256, expected, runtime, activeFile, activeSha256: sha256(bytes) };
  }
  const completion = { kind: "exit", code: 0, signal: null };
  const report = Buffer.from("Verdict: No findings\n");
  const lifecycle = Buffer.from(JSON.stringify({ schemaVersion: 1, attempt, session: runtime.session,
    event: "terminal", status: "completed", completion }) + "\n");
  const files = { "report.md": report, "native.txt": report, "lifecycle.jsonl": lifecycle };
  const descriptor = (name) => ({ path: path.join(directory, name), sha256: sha256(files[name]), bytes: files[name].length });
  const result = { schemaVersion: 1, identity: request.identity, requestSha256: expected.requestSha256, runtime, status: "completed",
    verdict: "no_findings", nativeVerdict: "Verdict: No findings", findings: [], coverageLimitations: [], report: descriptor("report.md"),
    reportKind: "native", evidence: [descriptor("native.txt"), descriptor("lifecycle.jsonl")], outputs: {}, completion, nativeReport: descriptor("native.txt") };
  await publishResult({ expected, runtime, result, files });
  return { kind: "portable-role", verifier, verifierSha256, expected, runtime };
}

test("read-only runtime preflights P1–P8, reconciles dedicated worktrees and checks sealed handover", async (t) => {
  const f = await fixture(t);
  const before = f.git(f.repo, "worktree", "list", "--porcelain");
  const result = await f.run("preflight", f.request);
  assert.equal(result.value.ready, true, result.stdout);
  assert.deepEqual(result.value.items.map((item) => item.id), ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"]);
  assert.equal((await f.run("preflight", f.request)).stdout, result.stdout);
  assert.equal((await f.run("preflight", { repo: f.repo, preflight: f.request.preflight })).value.ready, true);
  const missing = await f.run("preflight", { ...f.request, preflight: { ...f.request.preflight, reviewer: undefined,
    companions: { ...f.request.preflight.companions, actual: { reviewer: sha256("drift") } } } });
  assert.equal(missing.value.items[3].state, "pending");
  assert.equal(missing.value.items[7].state, "blocked");
  assert.equal(missing.value.reviewerProbeAuthority, "separate-grant-required");
  const divergent = await f.run("preflight", { ...f.request, preflight: { ...f.request.preflight,
    live: { ...f.request.preflight.live, head: "a".repeat(40) } } });
  assert.equal(divergent.value.items[2].state, "blocked");

  const first = await f.run("workspace", { ...f.request, base: f.base });
  assert.equal(first.value.action, "reuse", first.stdout);
  assert.equal(first.value.implementation.workspace, f.workspace);
  assert.equal(f.git(f.repo, "worktree", "list", "--porcelain"), before);
  const closure = path.join(f.root, "closure");
  const detached = path.join(f.root, "verification");
  f.git(f.repo, "worktree", "add", "-b", `closure/${change}`, closure, f.base);
  f.git(f.repo, "worktree", "add", "--detach", detached, f.plan);
  const roles = await f.run("workspace", { ...f.request, base: f.base, verificationWorkspace: detached, verificationSha: f.plan });
  assert.equal(roles.value.closure.workspace, closure);
  assert.equal(roles.value.verification.workspace, detached);
  assert.equal((await f.run("workspace", { ...f.request, base: f.base, verificationWorkspace: detached, verificationSha: f.base })).status, 1);

  const handover = await createHandover(f, null, "pending", "impl-active", "implementer", true);
  const verified = await f.run("handover", handover);
  assert.equal(verified.value.verified, true, verified.stdout);
  const active = { ...f.request, deliveryPhase: "boundary", handover, attempt: { id: "impl-active" },
    restrictions: { ...f.request.restrictions, inspect: true },
    phaseBoundary: { verified: true, attempt: "impl-active", contextHint: "same-session" } };
  const status = await f.run("status", active);
  assert.equal(status.value.state, "active", status.stdout);
  assert.equal(status.value.activeAttemptId, "impl-active");
  assert.equal(status.value.contextHint, "same-session");
  assert.equal((await f.run("status", active)).stdout, status.stdout);
  await chmod(handover.activeFile, 0o600);
  const failed = await f.run("status", active);
  assert.equal(failed.value.stopPredicate, "HANDOVER_UNVERIFIED");
  assert.equal(failed.value.activeAttemptId, null);
});

test("Goal-First local dispatch, correction and acceptance require separate authority and exact disposable gates and review", async (t) => {
  const f = await fixture(t);
  const decide = async (patch = {}) => (await f.run("decision", { ...f.request, ...patch })).value;
  assert.equal((await decide({ approval: null })).reason, "EXACT_APPROVAL_PENDING");
  assert.equal((await decide({ grant: { ...f.request.grant, reference: f.request.approval.reference } })).reason, "LOCAL_AUTHORITY_PENDING");
  assert.equal((await decide({ grant: { ...f.request.grant, localOnly: false } })).reason, "LOCAL_AUTHORITY_PENDING");
  assert.equal((await decide({ preflight: {} })).reason, "PREFLIGHT_PENDING");
  assert.equal((await decide()).action, "dispatch");
  assert.equal((await decide({ observed: { ...f.request.observed, stopReached: undefined } })).reason, "DECLARED_STOP_UNVERIFIED");
  await f.write(f.workspace, "owner-draft.txt", "preserve external draft");
  assert.equal((await decide()).reason, "WORKSPACE_DIRTY");
  await rm(path.join(f.workspace, "owner-draft.txt"));
  assert.equal((await decide({ restrictions: { ...f.request.restrictions, noCommits: true } })).commits, false);
  assert.equal((await decide({ restrictions: { ...f.request.restrictions, inspect: true } })).action, "inspect");
  assert.equal((await decide({ observed: { ...f.request.observed, remoteRequired: true } })).reason, "EXTERNAL_AUTHORITY_PENDING");
  const drift = await decide({ observed: { ...f.request.observed, alignment: { ...f.request.observed.alignment, invariants: "conflict" } } });
  assert.deepEqual([drift.action, drift.reason, drift.clause], ["stop", "DIRECTION_DRIFT_CHOICE", "invariants"]);
  assert.equal((await decide({ observed: { ...f.request.observed, ownership: "unknown" } })).reason, "OWNERSHIP_UNVERIFIED");

  await f.write(f.workspace, "widget.txt", "broken");
  const broken = f.commit(f.workspace, "Candidate with correctable failure");
  const failedGate = await gateFixture(f, broken, "failed");
  assert.equal(failedGate.captured.status, 1, failedGate.captured.stdout);
  const defect = { ...f.request.observed, failure: "routine-in-scope", failureReference: failedGate.captured.value.wrapperSha256 };
  const correction = await decide({ head: broken, deliveryPhase: "result", observed: defect, gateRun: failedGate.gateRun });
  assert.equal(correction.action, "correct", JSON.stringify(correction));
  assert.equal(correction.retain, failedGate.captured.value.wrapperSha256);

  await f.write(f.workspace, "widget.txt", "new");
  await f.write(f.workspace, current, currentSpec);
  const head = f.commit(f.workspace, "Corrected implementation and promoted spec");
  const checked = await gateFixture(f, head, "checked");
  assert.equal(checked.captured.status, 0, checked.captured.stdout);
  const observed = { ...f.request.observed, adaptations: [{ assumption: f.contract.adaptableAssumptions[0], evidence: "fixture:breaking observation" }],
    correctionsUsed: 1, correctionHistory: [{ group: "goal", rejectedSha: broken, successorSha: head, reference: correction.retain }] };
  assert.equal((await decide({ head, deliveryPhase: "correction", observed: { ...observed, ...{ failure: "routine-in-scope", failureReference: "again" } } })).reason,
    "BUDGET_EXHAUSTED");
  const next = { head, deliveryPhase: "result", observed, gateRun: checked.gateRun };
  assert.equal((await decide(next)).reason, "EXACT_REVIEW_PENDING");
  const handover = await createHandover(f, head, checked.captured.value.wrapperSha256, "review-first");
  const accepted = await decide({ ...next, handover, attempt: { id: "review-first" } });
  assert.equal(accepted.action, "accept-result", JSON.stringify(accepted));
  assert.equal(accepted.eligibleForTaskUpdate, true);
  assert.equal(accepted.tasksComplete, false);
  const incomplete = await f.run("finish-readiness", { ...f.request, ...next, handover, attempt: { id: "review-first" } });
  assert.equal(incomplete.value.predicate, "NATIVE_OUTCOME_PENDING");
  const unrecorded = await f.run("status", { ...f.request, ...next, handover, attempt: { id: "review-first" } });
  assert.equal(unrecorded.value.state, "local-verified", unrecorded.stdout);
  assert.equal(unrecorded.value.recommendedNextAction.code, "RECORD_NATIVE_PROGRESS");

  const tasks = await readFile(path.join(f.workspace, own, "tasks.md"), "utf8");
  await f.write(f.workspace, `${own}/tasks.md`, tasks.replace("[ ]", "[x]"));
  const repinned = f.commit(f.workspace, "Mark the accepted native outcome");
  // Correction history keeps the corrected successor when a later native
  // progress commit requires the final verification to use a fresh SHA.
  const nextRequest = { ...next, head: repinned };
  assert.equal((await decide(nextRequest)).reason, "EXACT_GATES_UNVERIFIED");
  const finalGates = await gateFixture(f, repinned, "final");
  assert.equal(finalGates.captured.status, 0, finalGates.captured.stdout);
  assert.equal((await decide({ ...nextRequest, gateRun: finalGates.gateRun, handover, attempt: { id: "review-first" } })).reason, "HANDOVER_UNVERIFIED");
  const finalHandover = await createHandover(f, repinned, finalGates.captured.value.wrapperSha256, "review-final");
  const finalRequest = { ...f.request, ...nextRequest, gateRun: finalGates.gateRun, handover: finalHandover, attempt: { id: "review-final" } };
  const status = await f.run("status", finalRequest);
  assert.equal(status.value.state, "finish-ready", status.stdout);
  const readiness = await f.run("finish-readiness", finalRequest);
  assert.deepEqual(readiness.value.promoted, [{ capability: "widget", requirements: 1 }]);
  assert.equal(readiness.value.authority, "separate-finish-grant-required");
  assert.equal(sha256(await readFile(failedGate.gateRun.file)), failedGate.gateRun.sha256);
});

test("native Task-Guided ordering and an unintegrated mode edit keep local and external authority separate", async (t) => {
  const f = await fixture(t, { integratedOptIn: false, staged: true });
  const taskGuidance = { verified: true, reference: "retained:frozen-guidance", planDigest: f.planDigest, groups: [
    { id: "1", taskIds: ["1.1"], requires: [], authority: "local", gates: [gateArgv], stop: "Stage complete",
      resultBudget: { minutes: 20, corrections: 1 } },
    { id: "2", taskIds: ["2.1"], requires: ["1"], authority: "external", gates: [gateArgv], stop: "Stage complete",
      resultBudget: { minutes: 20, corrections: 1 } },
  ] };
  const request = { ...f.request, taskGuidance, grant: { ...f.request.grant, eligibleGroups: ["1", "2"] } };
  assert.equal((await f.run("decision", request)).value.group, "1");
  assert.equal((await f.run("decision", { ...request, restrictions: { ...request.restrictions, group: "2" } })).value.reason, "GROUP_AUTHORITY_PENDING");
  const file = `${own}/tasks.md`;
  await f.write(f.workspace, file, (await readFile(path.join(f.workspace, file), "utf8")).replace("[ ]", "[x]"));
  const updated = f.commit(f.workspace, "Tick first task only");
  const waiting = await f.run("decision", { ...request, head: updated, taskGuidance: { ...taskGuidance,
    acceptedGroups: [{ id: "1", verified: true, reviewReference: "retained:review", gateReference: sha256("fixture gate"),
      candidateSha: updated, planDigest: f.planDigest }] } });
  assert.equal(waiting.value.reason, "EXTERNAL_AUTHORITY_PENDING", waiting.stdout);
});

test("finish checks current-spec promotion in the exact accepted candidate", async (t) => {
  const f = await fixture(t);
  await f.write(f.workspace, "widget.txt", "new");
  const tasks = await readFile(path.join(f.workspace, own, "tasks.md"), "utf8");
  await f.write(f.workspace, `${own}/tasks.md`, tasks.replace("[ ]", "[x]"));
  const head = f.commit(f.workspace, "Local result without current-spec promotion");
  const gates = await gateFixture(f, head, "missing-current");
  assert.equal(gates.captured.status, 0, gates.captured.stdout);
  const handover = await createHandover(f, head, gates.captured.value.wrapperSha256, "review-missing-spec");
  const input = { ...f.request, deliveryPhase: "result", head, gateRun: gates.gateRun, handover, attempt: { id: "review-missing-spec" } };
  const result = await f.run("finish-readiness", input);
  assert.equal(result.value.predicate, "CURRENT_SPEC_PROMOTION_UNVERIFIED", result.stdout);
  assert.equal(result.value.issue.path, current);
  assert.equal((await f.run("status", input)).value.state, "blocked");
});
