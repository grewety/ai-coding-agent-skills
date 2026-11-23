import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { chmod, mkdir, mkdtemp, readdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sha256 } from "../skills/software-development/openspec-delivery/scripts/evidence-cli.mjs";
import { deliveryCommand } from "../skills/software-development/openspec-delivery/scripts/delivery-cli.mjs";
import { createAttempt, publishResult, requestBytes } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/worker-handoff.mjs";
import { roleQualificationBinding } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/implementer-bindings.mjs";
import { claimPath } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/implementer-claims.mjs";
import { observeImplementer, runImplementers, runtimeIdentity } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/implementer-runtime.mjs";
import { readState } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/implementer-state.mjs";
import { privateCheckoutIdentity } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/worker-runtime-policy.mjs";
import { runReview } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-candidate.mjs";
import { buildExport, jsonBytes, prepareExport } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-inputs.mjs";
import { bubblewrapVersion, claudeVersion } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-runtime.mjs";

const delivery = fileURLToPath(new URL("../skills/software-development/openspec-delivery/scripts/delivery-cli.mjs", import.meta.url));
const nextRouter = fileURLToPath(new URL("../skills/software-development/openspec-next/scripts/next.mjs", import.meta.url));
const evidence = fileURLToPath(new URL("../skills/software-development/openspec-delivery/scripts/evidence-cli.mjs", import.meta.url));
const verifier = fileURLToPath(new URL("../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/worker-handoff.mjs", import.meta.url));
const containedVerifier = path.join(path.dirname(verifier), "review-candidate.mjs");
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
async function fixture(t, { integratedOptIn = true, staged = false, exclusive = false, continuous = false } = {}) {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), "delivery-runtime-")));
  t.after(async () => {
    // The contained reviewer seals export and output directories at 0500.
    async function restore(directory) {
      await chmod(directory, 0o700);
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        if (entry.isDirectory()) await restore(path.join(directory, entry.name));
      }
    }
    await restore(root);
    await rm(root, { recursive: true, force: true });
  });
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
  await write(repo, "AGENTS.md", `# Fixtures\n${integratedOptIn ? "<!-- openspec-delivery-mode: goal-first -->\n" : ""}` +
    (exclusive ? "<!-- openspec-worker-runtime: exclusive -->\n" : ""));
  await write(repo, ".gitignore", "/dist/\n/ignored-input\n");
  await write(repo, "widget.txt", "old");
  const base = commit(repo, "Integrated policy and product");
  git(repo, "update-ref", "refs/remotes/origin/main", base);
  git(repo, "remote", "add", "origin", "git@github.com:Example/Fixture.git");
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
  if (!integratedOptIn && !exclusive) await write(workspace, "AGENTS.md", "# Unintegrated opt-in\n<!-- openspec-delivery-mode: goal-first -->\n");
  let index = 0;
  const run = async (command, input, cli = delivery) => {
    const file = path.join(root, `input-${++index}.json`);
    await writeFile(file, JSON.stringify(input));
    const result = exec(process.execPath, [cli, command, "--input", file, ...(cli === delivery ? ["--json"] : [])]);
    assert.ok(result.stdout, result.stderr);
    return { status: result.status, stdout: result.stdout, value: JSON.parse(result.stdout) };
  };
  const draft = await run("policy", {
    repo: workspace, change, phase: "freeze", parent: base, target: base,
    selection: { revision: base, reference: "retained:draft-policy", preExecutionReview: false, continuousGoal: continuous },
    deliveryBoundary: { ...boundary, stagedAuthority: staged }, declaredContractPaths: integratedOptIn || exclusive ? [] : ["AGENTS.md"],
    orchestrationAvailable: continuous,
  });
  assert.equal(draft.status, 0, draft.stdout);
  assert.equal(draft.value.planDigest, null);
  assert.equal(draft.value.policy.executionAuthorized, false);
  const plan = commit(workspace, "Freeze plan");
  const selection = { revision: base, reference: "retained:integrated-policy", preExecutionReview: false, continuousGoal: continuous };
  const defaults = { repo, change, plan, target: base, workspace, selection, deliveryBoundary: { ...boundary, stagedAuthority: staged },
    declaredContractPaths: integratedOptIn || exclusive ? [] : ["AGENTS.md"], orchestrationAvailable: continuous };
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
  const route = (command, input) => run(command, input, nextRouter);
  return { root, repo, workspace, base, plan, planDigest, policy, evaluated, contract, request, git, run, route, write, commit };
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

function workerRequest(f, head, gateReference, attempt, directory, role = "reviewer") {
  return { schemaVersion: 1,
    identity: { attempt, predecessor: null, role, change, group: "1", task: "1.1", action: "1.1", workspace: f.workspace, plan: f.plan,
      planDigest: f.planDigest, candidate: role === "reviewer" ? head : null, inputs: { ...f.evaluated.context.inputs },
      implementerSession: role === "reviewer" ? "fixture-implementer" : null },
    outcome: "Review the widget", acceptance: [`gate-run:${gateReference}`], scope: ["widget.txt"], nonGoals: ["Publish"],
    authority: { orchestrator: "fixture-owner", writer: "fixture-owner", authorSession: "fixture-author",
      approvalReference: f.request.approval.reference, executionReference: f.request.grant.reference },
    restrictions: ["no Git writes", "no tasks.md writes", "no profile writes", "no subagents", "no multiplexers",
      ...(role === "reviewer" ? ["read-only"] : [])], budget: { limit: 15, unit: "minutes" },
    stop: "Scope conflict", evidenceRoots: [directory], requiredEvidence: ["native.txt", "lifecycle.jsonl"], mutablePaths: [],
  };
}

async function createHandover(f, head, gateReference, attempt, role = "reviewer", active = false, identity = {}) {
  const directory = path.join(f.root, attempt);
  const request = workerRequest(f, head, gateReference, attempt, directory, role);
  if (role === "reviewer") {
    request.identity.inputs[`${own}/tasks.md`] = sha256(await readFile(path.join(f.workspace, own, "tasks.md")));
  }
  Object.assign(request.identity, identity);
  const runtime = { adapter: "synthetic", client: "synthetic", version: "1", session: role === "reviewer" ? "fixture-reviewer" : "fixture-implementer",
    provider: "synthetic", model: "fixture", configurationSource: "test", configurationScope: attempt, readOnly: role === "reviewer" };
  const expected = await createAttempt({ directory, request, excludedRoots: [f.workspace, request.identity.workspace] });
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

async function containedHandover(f, workspace, head, gates, attempt, {
  base = f.plan, identity = {}, gateReference = gates.captured.value.wrapperSha256, coverageLimitations = [], findings = [],
  authority = {}, session = randomUUID(), configurationSha256 = sha256("synthetic contained runtime"), goalDigest, work,
} = {}) {
  const root = path.join(f.root, attempt);
  await mkdir(root, { mode: 0o700 });
  const output = path.join(root, "output");
  const exportDirectory = path.join(root, "export");
  const request = path.join(root, "request.json");
  const expect = path.join(root, "expect.json");
  const evidence = "fixture-gate-evidence.json";
  const evidenceBytes = await readFile(gates.gateRun.file);
  await writeFile(path.join(workspace, evidence), evidenceBytes);
  const diff = exec("git", ["-C", workspace, "diff", "--no-color", "--no-ext-diff", "--no-textconv", "--no-relative",
    "--find-renames=50%", "--diff-algorithm=myers", "--no-indent-heuristic", "--patch", "--text", "--full-index", "--unified=3",
    "--src-prefix=a/", "--dst-prefix=b/", base, head, "--"]);
  assert.equal(diff.status, 0, diff.stderr);
  const worker = workerRequest(f, head, gateReference, attempt, output);
  if (gateReference === null) worker.acceptance = ["Widget loads"];
  if (goalDigest) worker.acceptance.push(`goal-contract:${goalDigest}`);
  if (work) {
    worker.outcome = work.outcome;
    worker.scope = work.scope;
    worker.nonGoals = work.nonGoals;
    worker.acceptance = [...new Set([...worker.acceptance, ...work.acceptance])];
  }
  Object.assign(worker.authority, authority);
  const planDigest = f.evaluated.context.planDigest;
  Object.assign(worker.identity, { workspace, planDigest, ...identity });
  const record = { schemaVersion: 1, mode: "candidate", session, worker,
    snapshot: { base, target: head, plan: f.plan, planDigest, diffSha256: sha256(diff.stdout),
      gates: [{ command: "Check widget", commit: head, exitCode: 0, evidence }] },
    attachments: { [evidence]: sha256(evidenceBytes) }, limits: { diffBytes: 65_536 } };
  const bytes = jsonBytes(record);
  await writeFile(request, bytes, { mode: 0o400 });
  const prepared = await buildExport(record);
  const binding = { schemaVersion: 1, requestSha256: sha256(bytes), exportSha256: await prepareExport(exportDirectory, record, null),
    configurationSha256, model: "claude-fixture" };
  const replay = await runReview({ request: record, expect: binding, prepared, directory: output, excluded: [exportDirectory],
    run: async ({ files, prompt, session }) => {
      const events = [];
      const emit = (event) => events.push({ ...event, session_id: session });
      const runtime = { session, model: binding.model, version: claudeVersion, bubblewrapVersion, maxTurns: 4, maxBudgetUsd: 1,
        configurationSha256: binding.configurationSha256, route: "same-uid-key" };
      emit({ type: "system", subtype: "init", model: runtime.model, claude_code_version: runtime.version, cwd: "/review",
        tools: ["Read"], permissionMode: "dontAsk", mcp_servers: [], skills: [], slash_commands: [], plugins: [] });
      for (const [name, data] of files) {
        const id = `read-${events.length}`;
        const file_path = `/review/${name}`;
        const content = data.toString("utf8");
        const numLines = content ? content.split("\n").length : 0;
        emit({ type: "assistant", message: { content: [{ type: "tool_use", id, name: "Read", input: { file_path } }] } });
        emit({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: id, content }] },
          tool_use_result: { type: "text", file: { filePath: file_path, content, startLine: 1, numLines, totalLines: numLines } } });
      }
      const packet = Number(/^Packet: (\d+) of/m.exec(prompt)?.[1]);
      const verdict = findings.length ? "Verdict: Findings" : "Verdict: No findings";
      const report = files.size ? [verdict, `Target: ${head}`, JSON.stringify({ target: head, packet,
        findings, coverageLimitations })].join("\n") : "REVIEW_PROBE_OK";
      emit({ type: "assistant", message: { content: [{ type: "text", text: report }] } });
      emit({ type: "result", subtype: "success", is_error: false, num_turns: 1, total_cost_usd: 0, permission_denials: [], result: report });
      return { runtime, proc: { code: 0, signal: null, outcome: "exit", quiescent: true,
        stdout: Buffer.from(events.map(JSON.stringify).join("\n") + "\n"), stderr: Buffer.alloc(0) } };
    },
  });
  assert.equal(replay.phase, "complete");
  const expectationBytes = jsonBytes({ ...binding, statusSha256: replay.statusSha256 });
  await writeFile(expect, expectationBytes, { mode: 0o400 });
  return { kind: "review-candidate", verifier: containedVerifier, verifierSha256: sha256(await readFile(containedVerifier)),
    request, requestFileSha256: sha256(bytes), expect, expectFileSha256: sha256(expectationBytes), exportDirectory, output };
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
  const index = path.join(f.git(f.workspace, "rev-parse", "--absolute-git-dir"), "index");
  const inspectBefore = [f.git(f.repo, "worktree", "list", "--porcelain"),
    f.git(f.workspace, "status", "--porcelain"), await readFile(index), await readFile(handover.activeFile)];
  assert.equal((await f.route("inspect", active)).stdout, status.stdout);
  assert.deepEqual([f.git(f.repo, "worktree", "list", "--porcelain"),
    f.git(f.workspace, "status", "--porcelain"), await readFile(index), await readFile(handover.activeFile)], inspectBefore);
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
  assert.deepEqual((await f.route("next", f.request)).value, await decide());
  assert.equal((await f.route("inspect", f.request)).value.mode, "goal-first");
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
  const reviewCheckout = path.join(f.root, "goal-review-checkout");
  f.git(f.repo, "worktree", "add", "--detach", reviewCheckout, repinned);
  const contained = await containedHandover(f, reviewCheckout, repinned, finalGates, "review-goal-contained");
  assert.equal((await f.run("handover", contained)).value.verified, true);
  assert.equal((await f.run("decision", { ...finalRequest, handover: contained, attempt: { id: "review-goal-contained" } })).value.reason,
    "HANDOVER_UNVERIFIED");
  const status = await f.run("status", finalRequest);
  assert.equal(status.value.state, "finish-ready", status.stdout);
  const readiness = await f.run("finish-readiness", finalRequest);
  assert.deepEqual(readiness.value.promoted, [{ capability: "widget", requirements: 1 }]);
  assert.equal(readiness.value.authority, "separate-finish-grant-required");
  assert.equal((await f.route("finish-readiness", finalRequest)).stdout, readiness.stdout);
  assert.equal((await f.route("inspect", finalRequest)).value.recommendedNextAction.code, "REQUEST_FINISH_AUTHORITY");
  assert.equal((await f.route("finish-readiness", { ...finalRequest, head })).value.ready, false);
  assert.equal(sha256(await readFile(failedGate.gateRun.file)), failedGate.gateRun.sha256);
});

function twoGroupGuidance(planDigest) {
  return { verified: true, reference: "retained:frozen-guidance", planDigest, groups: [
    { id: "1", taskIds: ["1.1"], requires: [], authority: "local", gates: [gateArgv], stop: "Stage complete",
      resultBudget: { minutes: 20, corrections: 1 } },
    { id: "2", taskIds: ["2.1"], requires: ["1"], authority: "external", gates: [gateArgv], stop: "Stage complete",
      resultBudget: { minutes: 20, corrections: 1 } },
  ] };
}

test("native Task-Guided ordering and an unintegrated mode edit keep local and external authority separate", async (t) => {
  const f = await fixture(t, { integratedOptIn: false, staged: true });
  const taskGuidance = twoGroupGuidance(f.planDigest);
  const request = { ...f.request, taskGuidance, grant: { ...f.request.grant, eligibleGroups: ["1", "2"] } };
  const dispatch = await f.route("next", request);
  assert.equal(dispatch.value.action, "dispatch");
  assert.equal(dispatch.value.group, "1");
  assert.equal((await f.route("inspect", request)).value.mode, "task-guided");
  assert.equal((await f.route("next", { ...request, restrictions: { ...request.restrictions, group: "2" } })).value.reason, "GROUP_AUTHORITY_PENDING");
  const file = `${own}/tasks.md`;
  await f.write(f.workspace, file, (await readFile(path.join(f.workspace, file), "utf8")).replace("[ ]", "[x]"));
  const updated = f.commit(f.workspace, "Tick first task only");
  assert.equal((await f.route("next", { ...request, head: updated })).value.group, "1");
  const waiting = await f.route("next", { ...request, head: updated, taskGuidance: { ...taskGuidance,
    acceptedGroups: [{ id: "1", verified: true, reviewReference: "retained:review", gateReference: sha256("fixture gate"),
      candidateSha: updated, planDigest: f.planDigest }] } });
  assert.equal(waiting.value.reason, "EXTERNAL_AUTHORITY_PENDING", waiting.stdout);
});

test("Task-Guided results admit a sealed isolated review of the full frozen-plan-to-candidate diff", async (t) => {
  const f = await fixture(t, { integratedOptIn: false, staged: true });
  const taskGuidance = twoGroupGuidance(f.planDigest);
  await f.write(f.workspace, "widget.txt", "new");
  const implementation = f.commit(f.workspace, "Implement widget");
  const tasks = `${own}/tasks.md`;
  const frozen = await readFile(path.join(f.workspace, tasks), "utf8");
  const ticked = frozen.replace("[ ]", "[x]");
  await f.write(f.workspace, tasks, ticked);
  const head = f.commit(f.workspace, "Tick first native task");
  const gates = await gateFixture(f, head, "contained");
  assert.equal(gates.captured.status, 0, gates.captured.stdout);
  const reviewCheckout = path.join(f.root, "isolated-review-checkout");
  f.git(f.repo, "worktree", "add", "--detach", reviewCheckout, head);
  const handover = await containedHandover(f, reviewCheckout, head, gates, "review-contained");
  const replay = await f.run("handover", handover);
  assert.equal(replay.value.verified, true, replay.stdout);
  assert.equal(replay.value.identity.workspace, reviewCheckout);
  assert.equal(replay.value.identity.inputs[tasks], sha256(frozen));
  assert.notEqual(replay.value.identity.inputs[tasks], sha256(ticked));
  assert.equal(replay.value.identity.planDigest, f.planDigest);
  const request = { ...f.request, deliveryPhase: "result", taskGuidance, head, gateRun: gates.gateRun, handover,
    attempt: { id: "review-contained" } };
  const decide = async (patch = {}) => (await f.route("next", { ...request, ...patch })).value;
  const accepted = await decide();
  assert.equal(accepted.action, "accept-result", JSON.stringify(accepted));
  assert.equal(accepted.group, "1");
  assert.equal(accepted.eligibleForTaskUpdate, true);
  assert.equal((await f.route("inspect", request)).value.state, "local-verified");

  assert.equal((await decide({ gateRun: null })).reason, "EXACT_GATES_UNVERIFIED");
  assert.equal((await decide({ grant: { ...request.grant, reference: "retained:unrelated-grant" } })).reason, "HANDOVER_UNVERIFIED");
  assert.equal((await decide({ observed: { ...request.observed, ownership: "unknown" } })).reason, "OWNERSHIP_UNVERIFIED");
  const mismatchedSession = { ...request.observed.activeAttempt, implementerSession: "other-implementer" };
  assert.equal((await decide({ observed: { ...request.observed, activeAttempt: mismatchedSession } })).reason, "EXACT_REVIEW_PENDING");

  const changedRequest = JSON.parse(await readFile(handover.request, "utf8"));
  changedRequest.worker.identity.inputs[tasks] = sha256(ticked);
  const changedBytes = jsonBytes(changedRequest);
  const changedHandover = { ...handover, request: path.join(f.root, "wrong-inputs.json"),
    expect: path.join(f.root, "wrong-inputs-expect.json"), expectFileSha256: undefined, requestFileSha256: sha256(changedBytes) };
  const expectation = JSON.parse(await readFile(handover.expect, "utf8"));
  await writeFile(changedHandover.request, changedBytes);
  await writeFile(changedHandover.expect, jsonBytes({ ...expectation, requestSha256: changedHandover.requestFileSha256 }));
  assert.match((await f.run("handover", changedHandover)).value.error, /Frozen planning byte mismatch/);
  assert.equal((await decide({ handover: changedHandover })).reason, "HANDOVER_UNVERIFIED");

  for (const [attempt, options, reason] of [
    ["review-partial-base", { base: implementation }, "HANDOVER_UNVERIFIED"],
    ["review-missing-gate-tag", { gateReference: null }, "EXACT_REVIEW_PENDING"],
    ["review-wrong-gate-tag", { gateReference: sha256("unrelated gate run") }, "EXACT_REVIEW_PENDING"],
    ["review-other-group", { identity: { group: "2", task: "2.1", action: "2.1" } }, "EXACT_REVIEW_PENDING"],
    ["review-limited", { coverageLimitations: ["Unresolved runtime behavior"] }, "EXACT_REVIEW_PENDING"],
  ]) {
    const alternate = await containedHandover(f, reviewCheckout, head, gates, attempt, options);
    assert.equal((await f.run("handover", alternate)).value.verified, true, attempt);
    assert.equal((await decide({ handover: alternate, attempt: { id: attempt } })).reason, reason, attempt);
  }

  const findings = [{ severity: "low", path: "widget.txt", line: 1, impact: "Fixture value is too short",
    trigger: "Load the widget", remedy: "Use the expected value" }];
  for (const [attempt, options, action] of [
    ["review-finding", { findings }, "correct"],
    ["review-finding-missing-tag", { findings, gateReference: null }, "queue"],
  ]) {
    const alternate = await containedHandover(f, reviewCheckout, head, gates, attempt, options);
    const report = JSON.parse(await readFile(path.join(alternate.output, "result.json"), "utf8")).report;
    const decision = await decide({ handover: alternate, attempt: { id: attempt },
      observed: { ...request.observed, failure: "routine-in-scope", failureReference: report.sha256 } });
    assert.equal(decision.action, action, JSON.stringify(decision));
  }

  const gateReference = gates.captured.value.wrapperSha256;
  const portable = await createHandover(f, head, gateReference, "review-portable");
  assert.equal((await decide({ handover: portable, attempt: { id: "review-portable" } })).action, "accept-result");
  for (const [id, identity] of [
    ["portable-isolated", { workspace: reviewCheckout }],
    ["portable-frozen", { inputs: f.evaluated.context.inputs }],
  ]) {
    const alternate = await createHandover(f, head, gateReference, id, "reviewer", false, identity);
    assert.equal((await f.run("handover", alternate)).value.verified, true, id);
    assert.equal((await decide({ handover: alternate, attempt: { id } })).reason, "HANDOVER_UNVERIFIED", id);
  }

  await f.write(reviewCheckout, "fixture-gate-evidence.json", "changed after sealing");
  assert.equal((await decide()).reason, "HANDOVER_UNVERIFIED");
  await f.write(reviewCheckout, "fixture-gate-evidence.json", await readFile(gates.gateRun.file));
  await f.write(f.workspace, "widget.txt", "new candidate");
  const stale = await decide({ head: f.commit(f.workspace, "Repin implementation") });
  assert.equal(stale.reason, "HANDOVER_UNVERIFIED");
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
  assert.equal((await f.route("finish-readiness", input)).stdout, result.stdout);
});

const fakeCodex = `#!/usr/bin/python3
import json, pathlib, sys, uuid
fence = chr(96) * 3
request = json.loads(sys.stdin.read().split(fence + "json\\n", 1)[1].split("\\n" + fence, 1)[0])
def emit(kind, **fields):
    print(json.dumps(dict(type=kind, **fields)), flush=True)
emit("thread.started", thread_id=str(uuid.uuid4()))
emit("turn.started")
if "synthetic cap" in request["acceptance"]:
    emit("item.completed", item=dict(type="agent_message", text="Partial synthetic progress"))
    emit("turn.failed", error=dict(code="turn_limit"))
    sys.exit(12)
for name in request["mutablePaths"]:
    pathlib.Path(name).write_text("new" if request["identity"]["task"] == "1.1" else "next")
emit("item.completed", item=dict(type="agent_message", text="Synthetic implementation result"))
emit("turn.completed", usage=dict(output_tokens=3))
`;

async function exclusiveFixture(f) {
  const registry = path.join(f.root, "exclusive-registry");
  const trusted = path.join(f.root, "trusted-worker-inputs");
  const evidence = path.join(f.root, "worker-evidence");
  const paths = ["worker-home", "worker-xdg", "worker-codex", "review-slot"].map((name) => path.join(f.root, name));
  const [home, xdg, codexHome, reviewSlot] = paths;
  await Promise.all([trusted, evidence, ...paths].map((dir) => mkdir(dir, { mode: 0o700 })));
  const pin = async (name, bytes, mode = 0o400) => {
    const file = path.join(trusted, name);
    await writeFile(file, bytes, { mode, flag: "wx" });
    return { path: file, sha256: sha256(bytes) };
  };
  const retain = (name, value) => pin(name, jsonBytes(value));
  const runtimeSha256 = await runtimeIdentity();
  const binary = await pin("synthetic-native", fakeCodex, 0o700);
  const codexConfiguration = await retain("codex-configuration.json", {
    schemaVersion: 1, role: "implementer", auth: "dedicated-file", disableHostDiscovery: true, permissionMode: "named-workspace-write",
  });
  const reviewerConfiguration = await retain("review-configuration.json", {
    schemaVersion: 1, bwrap: binary, claude: binary, node: binary, libraries: [], model: "claude-fixture",
    relay: { route: "same-uid-key", keyFile: path.join(f.root, "synthetic-relay-pin"), keyFormat: "raw" },
    timeoutMs: 2000, maxTurns: 4, maxBudgetUsd: 1, requirePreExposureAttestation: false,
  });
  const inventory = async (name) => [await pin(name + "-skill.md", "Synthetic skill"), await pin(name + "-helper.mjs", "Synthetic helper")];
  const pair = {
    implementer: { client: "codex", provider: "openai", model: "fixture-codex", version: "0.171.0", route: "codex-native-named-workspace-write",
      configuration: codexConfiguration, inventory: await inventory("implementer"), slot: codexHome, home, xdg, codexHome, executable: binary },
    reviewer: { client: "claude-code", provider: "anthropic", model: "claude-fixture", version: claudeVersion, route: "claude-bubblewrap-read-only",
      configuration: reviewerConfiguration, inventory: await inventory("reviewer"), slot: reviewSlot, session: randomUUID() },
  };
  for (const [name, role] of Object.entries(pair)) {
    const { client, provider, version, model, route, configuration } = role;
    role.qualification = await retain(name + "-qualification.json", {
      schemaVersion: 1, kind: "exclusive-runtime-qualification", status: "qualified", role: name, client, provider, version, model,
      route, configurationSha256: configuration.sha256, inventorySha256: sha256(jsonBytes(role.inventory)), runtimeSha256,
      bindingSha256: roleQualificationBinding(role), supervisor: name + "-synthetic-controller", positiveControl: true,
      deniedPublication: true, protectedPaths: true, settlementVerified: true, inventoryUnchanged: true,
    });
  }
  const repository = "github.com/example/fixture";
  const { change, plan, planDigest, mode, policyRevision, workspace } = f.request.approval;
  const base = { schemaVersion: 1, change, plan, planDigest, mode, policyRevision, workspace, repository,
    branch: `refs/heads/change/${change}`, orchestrator: "fixture-owner", authorSession: "fixture-author" };
  const issuedAt = Date.now() - 1000;
  const expiresAt = issuedAt + 240000;
  const approval = await retain("approval.json", { ...base, kind: f.request.approval.kind, approved: true, approvedAt: issuedAt });
  const implementer = path.join(path.dirname(verifier), "run-implementer.mjs");
  const verifierSha256 = sha256(await readFile(implementer));
  const decide = (input) => deliveryCommand("decision", input, { registry });
  const status = (input) => deliveryCommand("status", input, { registry });
  const readClaim = (attempt) => path.join(claimPath(registry, repository, change), "attempt-" + attempt);

  async function assignment(attempt, {
    task = "1.1", predecessor = null, continuation = null, accepted = [], initialHead = plan, reviewSession = pair.reviewer.session,
    noCommits = false, behavior,
  } = {}) {
    const host = await retain(attempt + "-host.json", {
      schemaVersion: 1, runtimeSha256, pair: { ...pair, reviewer: { ...pair.reviewer, session: reviewSession } }, override: null,
      restrictions: { allowedClients: ["codex", "claude-code"], allowedModels: ["fixture-codex", "claude-fixture"],
        allowedProviders: ["openai", "anthropic"], requireDistinctModels: true },
    });
    const grantFile = path.join(trusted, attempt + "-grant.json");
    const group = task.split(".")[0];
    const request = workerRequest(f, null, "", attempt, path.join(evidence, attempt), "implementer");
    Object.assign(request, { outcome: mode === "goal-first" ? f.contract.outcome : "Deliver the fixture group",
      scope: mode === "goal-first" ? f.contract.scope : ["widget.txt"], acceptance: mode === "goal-first" ? f.contract.acceptance :
        ["Widget loads", ...(behavior ? [behavior] : [])], stop: "Scope conflict", budget: { limit: 1, unit: "minutes" },
      mutablePaths: ["widget.txt"], requiredEvidence: ["native.txt", "lifecycle.jsonl", "stdout.jsonl", "stderr.log", "launch.json"],
    });
    Object.assign(request.identity, { group, task, action: task, predecessor });
    Object.assign(request.authority, { approvalReference: approval.path, executionReference: grantFile });
    if (noCommits) request.restrictions.push("no commits");
    const requestSha256 = sha256(requestBytes(request));
    const inference = await retain(attempt + "-inference.json", { schemaVersion: 1, kind: "worker-inference-authority", attempt,
      requestSha256, hostSha256: host.sha256, orchestrator: base.orchestrator, maxRuns: 1, expiresAt });
    const grant = await retain(attempt + "-grant.json", {
      ...base, kind: "local-execution-grant", localOnly: true, requestSha256, hostSha256: host.sha256, approvalSha256: approval.sha256,
      checkoutIdentity: await privateCheckoutIdentity(workspace), head: initialHead, eligibleTasks: [task], accepted, knownWorkspaces: [],
      mutablePaths: request.mutablePaths, restrictions: request.restrictions, stop: request.stop, issuedAt, expiresAt, overrideSha256: null,
      limits: { timeoutMs: 3500, stdoutBytes: 16384, stderrBytes: 16384, maxTurns: 1, totalMs: 240000, groupMs: 180000,
        corrections: 1, batchSize: 1 }, continuation, inference,
      ...(mode === "goal-first" ? { normalizedPlanDigest: f.evaluated.context.planDigest } : {}),
    });
    const entry = { request, host, approval, grant };
    const reviewerInventory = sha256(jsonBytes(pair.reviewer.inventory));
    const preflight = { ...f.request.preflight,
      live: { ...f.request.preflight.live, repository }, auth: { ...f.request.preflight.auth, repository },
      reviewer: { ...f.request.preflight.reviewer, configurationSha256: reviewerConfiguration.sha256,
        expectedConfigurationSha256: reviewerConfiguration.sha256, packageSha256: reviewerInventory },
      relay: { ...f.request.preflight.relay, configurationSha256: reviewerConfiguration.sha256 },
      companions: { ...f.request.preflight.companions, actual: { reviewer: reviewerInventory }, expected: { reviewer: reviewerInventory } },
    };
    const input = { ...f.request, approval: { ...f.request.approval, reference: approval.path },
      grant: { ...f.request.grant, reference: grant.path, approvalReference: approval.path, stop: request.stop, eligibleGroups: ["1", "2"] },
      preflight, delegation: { verifier: implementer, verifierSha256, runtimeSha256, assignment: await retain(attempt + "-input.json",
        { schemaVersion: 1, assignments: [entry] }) } };
    return { entry, input, reviewSession };
  }

  async function settled(attempt, options = {}) {
    const [outcome] = await runImplementers([attempt.entry], { registry, runProbe: async () => ({ proof: [] }), ...options });
    return outcome;
  }

  async function release(attempt, result) {
    const id = attempt.entry.request.identity.attempt;
    const { claimId } = await readState(readClaim(id), "launch.json");
    const proof = await retain(id + "-release.json", {
      schemaVersion: 1, kind: "exclusive-runtime-release", action: "release-slot", claimId, change, attempt: id,
      orchestrator: base.orchestrator, settlementSha256: result.settlementSha256, quiescent: true, falloutVerified: true,
    });
    const released = await observeImplementer(attempt.entry, { registry, action: "release-slot", release: proof });
    assert.equal(released.phase, "slot-released", released.reason);
    return readState(readClaim(id), "publication.json");
  }

  async function review(attempt, runtime, head, gates, label, overrides = {}) {
    const checkout = path.join(f.root, label + "-checkout");
    f.git(f.repo, "worktree", "add", "--detach", checkout, head);
    const { task, group, action, attempt: predecessor } = attempt.entry.request.identity;
    return containedHandover(f, checkout, head, gates, label, {
      identity: { task, group, action, predecessor, implementerSession: runtime.result.runtime.session },
      authority: attempt.entry.request.authority, work: attempt.entry.request, session: attempt.reviewSession, configurationSha256: reviewerConfiguration.sha256,
      ...(mode === "goal-first" ? { goalDigest: f.planDigest } : {}), ...overrides,
    });
  }
  return { registry, assignment, settled, decide, status, retain, release, review, readClaim, pair };
}

test("exclusive Goal-First reads the original worker, checks output scope and binds exact gates and paired review", { skip: process.platform !== "linux" }, async (t) => {
  const f = await fixture(t, { exclusive: true });
  const w = await exclusiveFixture(f);
  const attempt = await w.assignment("goal-first", { noCommits: true });
  const { input } = attempt;
  assert.equal((await f.route("next", f.request)).value.reason, "DELEGATED_RUNTIME_UNVERIFIED");
  assert.equal((await f.route("inspect", f.request)).value.stopPredicate, "DELEGATED_RUNTIME_UNVERIFIED");
  const dispatch = await w.decide(input);
  assert.equal(dispatch.action, "dispatch", JSON.stringify(dispatch));
  assert.equal(dispatch.requiresExclusiveAdmission, true);
  assert.equal(dispatch.commits, false);
  const unrelated = { ...input, preflight: { ...input.preflight, reviewer: { ...input.preflight.reviewer,
    configurationSha256: "1".repeat(64), expectedConfigurationSha256: "1".repeat(64) },
    relay: { ...input.preflight.relay, configurationSha256: "1".repeat(64) } } };
  assert.equal((await w.decide(unrelated)).reason, "PREFLIGHT_PENDING");
  await assert.rejects(readFile(path.join(w.registry, "owner.json")), { code: "ENOENT" });
  const runtime = await w.settled(attempt);
  assert.equal(runtime.phase, "completed", runtime.reason);
  const boundary = { ...input, deliveryPhase: "boundary" };
  assert.equal((await w.decide(input)).reason, "WORKSPACE_DIRTY");
  let verdict = await w.decide(boundary);
  assert.equal(verdict.action, "continue", JSON.stringify(verdict));
  assert.equal(verdict.commits, false);
  assert.equal((await w.status(boundary)).activeAttemptId, attempt.entry.request.identity.attempt);

  await f.write(f.workspace, "outside.txt", "out-of-scope fixture");
  assert.equal((await w.decide(boundary)).reason, "POST_WORKER_SCOPE_UNVERIFIED");
  await rm(path.join(f.workspace, "outside.txt"));
  const head = f.commit(f.workspace, "Synthetic orchestrator candidate");
  const gates = await gateFixture(f, head, "exclusive-goal");
  assert.equal(gates.captured.status, 0, gates.captured.stdout);
  const result = { ...input, deliveryPhase: "result", head, gateRun: gates.gateRun };
  assert.equal((await w.decide(result)).reason, "EXACT_REVIEW_PENDING");
  assert.equal((await w.decide({ ...result, gateRun: { ...gates.gateRun, sha256: "1".repeat(64) } })).reason, "EXACT_GATES_UNVERIFIED");

  const handover = await w.review(attempt, runtime, head, gates, "exclusive-goal-review");
  const accepted = { ...result, handover, attempt: { id: "exclusive-goal-review" } };
  verdict = await w.decide(accepted);
  assert.equal(verdict.action, "accept-result", JSON.stringify(verdict));
  assert.equal(verdict.head, head);
  assert.equal(verdict.commits, false);
  assert.equal((await w.status(accepted)).state, "local-verified");
  const wrongGoal = await w.review(attempt, runtime, head, gates, "wrong-goal-review", { goalDigest: "2".repeat(64) });
  assert.equal((await w.decide({ ...result, handover: wrongGoal, attempt: { id: "wrong-goal-review" } })).reason, "HANDOVER_UNVERIFIED");
  const wrongRole = await w.review(attempt, runtime, head, gates, "wrong-pair-review", { session: randomUUID() });
  assert.equal((await w.decide({ ...result, handover: wrongRole, attempt: { id: "wrong-pair-review" } })).reason, "HANDOVER_UNVERIFIED");
  const priorDir = w.readClaim("goal-first");
  const file = path.join(priorDir, "publication.json");
  const unpublished = file + ".held";
  await rename(file, unpublished);
  try {
    assert.equal((await w.status({ ...result, restrictions: { ...input.restrictions, inspect: true } })).stopPredicate, "ORIGINAL_RECOVERY_PENDING");
    await assert.rejects(readFile(file), { code: "ENOENT" }, "inspection must not publish");
  } finally { await rename(unpublished, file); }

  await f.write(f.workspace, `${own}/tasks.md`,
    (await readFile(path.join(f.workspace, own, "tasks.md"), "utf8")).replace("[ ]", "[x]"));
  const progress = f.commit(f.workspace, "Synthetic orchestrator records accepted outcome");
  const fresh = await gateFixture(f, progress, "goal-progress");
  const session = randomUUID();
  const review = await w.review(attempt, runtime, progress, fresh, "goal-progress-review", { session });
  const { claimId } = await readState(priorDir, "launch.json");
  review.reviewSessionBinding = await w.retain("goal-progress-authority.json", {
    schemaVersion: 1, kind: "exclusive-review-session", claimId, change, plan: f.plan, planDigest: f.planDigest,
    attempt: "goal-first", candidate: progress, orchestrator: "fixture-owner", originalSession: attempt.reviewSession, session,
    configurationSha256: w.pair.reviewer.configuration.sha256, inventorySha256: sha256(jsonBytes(w.pair.reviewer.inventory)),
    requestFileSha256: review.requestFileSha256, reviewAuthority: "synthetic single-run approval", maxRuns: 1,
  });
  assert.equal((await w.decide({ ...accepted, head: progress, gateRun: fresh.gateRun, handover: review,
    attempt: { id: "goal-progress-review" } })).action, "accept-result");
});

test("exclusive Task-Guided dispatch replays exact predecessor gates and review before advising group two", { skip: process.platform !== "linux" }, async (t) => {
  const f = await fixture(t, { staged: true, exclusive: true, continuous: true });
  const w = await exclusiveFixture(f);
  const taskGuidance = twoGroupGuidance(f.planDigest);
  taskGuidance.groups[1].authority = "local";
  taskGuidance.groups[1].gates = [[process.execPath, "-e", "process.exit(0)"]];
  const first = await w.assignment("group-one");
  const firstInput = { ...first.input, taskGuidance };
  assert.equal((await w.decide(firstInput)).group, "1");
  const observed = await w.settled(first);
  assert.equal(observed.phase, "completed", observed.reason);
  const tasksFile = `${own}/tasks.md`;
  await f.write(f.workspace, tasksFile, (await readFile(path.join(f.workspace, tasksFile), "utf8")).replace("[ ]", "[x]"));
  const head = f.commit(f.workspace, "Synthetic orchestrator accepts first native candidate");
  const gates = await gateFixture(f, head, "exclusive-task");
  const handover = await w.review(first, observed, head, gates, "exclusive-task-review");
  const result = { ...firstInput, deliveryPhase: "result", head, gateRun: gates.gateRun, handover, attempt: { id: "exclusive-task-review" } };
  const verdict = await w.decide(result);
  assert.equal(verdict.action, "accept-result", JSON.stringify(verdict));

  const firstResult = await w.release(first, observed);
  const continuation = await w.retain("ordered-continuation.json", { schemaVersion: 1, kind: "exclusive-runtime-continuation",
    change, plan: f.plan, planDigest: f.planDigest, orchestrator: "fixture-owner", previousAttempt: "group-one", attempt: "group-two",
    priorResultSha256: firstResult.resultSha256, priorSettlementSha256: firstResult.settlementSha256, reason: "ordered-successor",
    task: "2.1", acceptedCandidate: head });
  const acceptedDependency = { task: "1.1", candidate: head, receipt: await w.retain("accepted-first.json", {
    kind: "accepted-dependency", task: "1.1", candidate: head, change, plan: f.plan, planDigest: f.planDigest, verdict: "pass",
  }) };
  const second = await w.assignment("group-two", { task: "2.1", predecessor: "group-one", continuation, initialHead: head,
    accepted: [acceptedDependency], reviewSession: randomUUID() });
  const report = JSON.parse(await readFile(path.join(handover.output, "result.json"), "utf8")).report;
  const successor = { ...second.input, taskGuidance: { ...taskGuidance, acceptedGroups: [{ id: "1", verified: true,
    candidateSha: head, planDigest: f.planDigest, reviewReference: report.sha256, gateReference: verdict.gateReference }] },
    observed: { ...second.input.observed, completedGroups: 1 } };
  async function next(prior, changes = {}) {
    const locator = await w.retain(randomUUID() + ".json", prior);
    return w.decide({ ...successor, ...changes, delegation: { ...successor.delegation, predecessor: locator } });
  }
  assert.equal((await next({ ...result, handover: null, attempt: null })).reason, "DELEGATED_RUNTIME_UNVERIFIED");
  assert.equal((await next({ ...result, head: f.plan })).reason, "DELEGATED_RUNTIME_UNVERIFIED");
  assert.equal((await next(result, { restrictions: { ...successor.restrictions, group: "1" } })).reason, "GROUP_AUTHORITY_PENDING");
  await assert.rejects(readFile(path.join(w.readClaim("group-two"), "launch.json")), { code: "ENOENT" });
  const dispatch = await next(result);
  assert.equal(dispatch.action, "dispatch", JSON.stringify(dispatch));
  assert.equal(dispatch.group, "2");
  assert.equal(dispatch.requiresExclusiveAdmission, true);
  const secondResult = await w.settled(second);
  assert.equal(secondResult.phase, "completed", secondResult.reason);
  assert.equal(await readFile(path.join(f.workspace, "widget.txt"), "utf8"), "next");
});

test("exclusive correction requires a verified exact finding and carries the consumed cycle to the successor", { skip: process.platform !== "linux" }, async (t) => {
  const f = await fixture(t, { staged: true, exclusive: true, continuous: true });
  const w = await exclusiveFixture(f);
  const taskGuidance = twoGroupGuidance(f.planDigest);
  const first = await w.assignment("finding-work");
  const firstInput = { ...first.input, taskGuidance };
  const firstRuntime = await w.settled(first);
  assert.equal(firstRuntime.phase, "completed", firstRuntime.reason);
  const head = f.commit(f.workspace, "Candidate with synthetic finding");
  const gates = await gateFixture(f, head, "exclusive-finding");
  const handover = await w.review(first, firstRuntime, head, gates, "exclusive-scope-finding", {
    findings: [{ severity: "low", path: "widget.txt", line: 1, impact: "Synthetic", trigger: "Read", remedy: "Revise fixture" }],
  });
  const report = JSON.parse(await readFile(path.join(handover.output, "result.json"), "utf8")).report;
  const observed = { ...firstInput.observed, failure: "routine-in-scope", failureReference: report.sha256 };
  const rejected = { ...firstInput, deliveryPhase: "result", head, gateRun: gates.gateRun, handover, observed,
    attempt: { id: "exclusive-scope-finding" } };
  const reviewFailed = await w.decide(rejected);
  assert.equal(reviewFailed.action, "correct", JSON.stringify(reviewFailed));
  assert.equal((await w.decide({ ...rejected, deliveryPhase: "correction", handover: null, attempt: null })).reason, "EXACT_REVIEW_PENDING");
  assert.equal((await w.decide({ ...rejected, observed: { ...observed, correctionHistory: [{ group: "1", reference: "invalid" }] } })).reason,
    "BUDGET_HISTORY_UNVERIFIED");

  const publication = await w.release(first, firstRuntime);
  const continuation = await w.retain("finding-control.json", {
    schemaVersion: 1, kind: "exclusive-runtime-continuation", change, plan: f.plan, planDigest: f.planDigest,
    orchestrator: "fixture-owner", previousAttempt: "finding-work", attempt: "finding-correction", task: "1.1",
    priorResultSha256: publication.resultSha256, priorSettlementSha256: publication.settlementSha256,
    reason: "review-correction", rejectedCandidate: head, reviewSha256: report.sha256, inScopeFinding: true,
  });
  const second = await w.assignment("finding-correction", { predecessor: "finding-work", continuation, initialHead: head, reviewSession: randomUUID() });
  const correction = { ...second.input, taskGuidance, delegation: { ...second.input.delegation,
    predecessor: await w.retain("rejected-input.json", rejected) } };
  const dispatch = await w.decide(correction);
  assert.equal(dispatch.action, "dispatch", JSON.stringify(dispatch));
  const settled = await w.settled(second);
  assert.equal(settled.phase, "completed", settled.reason);
  const tasksFile = `${own}/tasks.md`;
  await f.write(f.workspace, tasksFile, (await readFile(path.join(f.workspace, tasksFile), "utf8")).replace("[ ]", "[x]"));
  const successor = f.commit(f.workspace, "Record corrected fixture result");
  const fresh = await gateFixture(f, successor, "exclusive-corrected");
  const review = await w.review(second, settled, successor, fresh, "exclusive-re-reviewed");
  const input = { ...correction, head: successor, deliveryPhase: "result", gateRun: fresh.gateRun, handover: review,
    attempt: { id: "exclusive-re-reviewed" } };
  assert.equal((await w.decide(input)).reason, "BUDGET_HISTORY_UNVERIFIED");
  const accepted = await w.decide({ ...input, observed: { ...input.observed, correctionsUsed: 1,
    correctionHistory: [{ group: "1", rejectedSha: head, successorSha: successor, reference: report.sha256 }] } });
  assert.equal(accepted.action, "accept-result", JSON.stringify(accepted));
});

test("exclusive native cap uses the verified original occurrence and advises at most one same-action successor", { skip: process.platform !== "linux" }, async (t) => {
  const f = await fixture(t, { staged: true, exclusive: true, continuous: true });
  const w = await exclusiveFixture(f);
  const taskGuidance = twoGroupGuidance(f.planDigest);
  const observed = { ...f.request.observed, onTrack: true, failedGate: false };
  let previous = null;
  for (const id of ["cap-original", "cap-successor", "cap-repeated"]) {
    const attempt = await w.assignment(id, { behavior: "synthetic cap", ...previous?.options });
    const input = { ...attempt.input, taskGuidance, observed,
      delegation: { ...attempt.input.delegation, ...(previous ? { predecessor: previous.pin } : {}) } };
    const decision = await w.decide(input);
    if (id === "cap-repeated") {
      assert.equal(decision.reason, "DELEGATED_RUNTIME_UNVERIFIED");
      assert.match(decision.detail, /already consumed/);
      break;
    }
    assert.equal(decision.action, "dispatch", JSON.stringify(decision));
    const runtime = await w.settled(attempt);
    assert.equal(runtime.phase, "capped", runtime.reason);
    const prior = { ...input, deliveryPhase: "boundary" };
    assert.equal((await w.decide(prior)).reason, "NATIVE_TURN_CAP");
    const publication = await w.release(attempt, runtime);
    previous = {
      pin: await w.retain(id + "-boundary.json", prior),
      options: { predecessor: id, reviewSession: randomUUID(), continuation: await w.retain(id + "-continuation.json", {
        schemaVersion: 1, kind: "exclusive-runtime-continuation", change, plan: f.plan, planDigest: f.planDigest,
        orchestrator: "fixture-owner", previousAttempt: id, attempt: id === "cap-original" ? "cap-successor" : "cap-repeated",
        task: "1.1", priorResultSha256: publication.resultSha256, priorSettlementSha256: publication.settlementSha256,
        reason: "native-turn-cap", verifiedProgress: true, progressSha256: publication.nativeSha256,
      }) },
    };
  }
});
