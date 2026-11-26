import { fixtureTest as test } from "./test-shards.mjs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chmod, cp, mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sha256 } from "../skills/software-development/openspec-delivery/scripts/evidence-cli.mjs";
import { readDelegation } from "../skills/software-development/openspec-delivery/scripts/delegated-delivery.mjs";
import { createAttempt, publishResult } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/worker-handoff.mjs";
import { runtimeIdentity } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/implementer-runtime.mjs";
import { jsonBytes } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-inputs.mjs";
import { buildExclusiveFixture, containedHandover, gateFixture, workerRequest } from "./delivery-runtime-fixtures.mjs";
import { change, current, currentSpec, fixture, own, twoGroupGuidance } from "./delivery-runtime-setup.mjs";

const evidence = fileURLToPath(new URL("../skills/software-development/openspec-delivery/scripts/evidence-cli.mjs", import.meta.url));
const verifier = fileURLToPath(new URL("../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/worker-handoff.mjs", import.meta.url));

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

const exclusiveFixture = (f) => buildExclusiveFixture(f, { workerRequest, containedHandover });

test("exclusive delivery verifies the complete transitive inventory before loading code", { skip: process.platform !== "linux" }, async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "verify-worker-inventory-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = path.dirname(verifier);
  const scripts = path.join(root, "scripts");
  await cp(source, scripts, { recursive: true });
  const launcher = "run-implementer.mjs";
  const input = {
    repo: path.join(root, "repo"),
    delegation: {
      verifier: path.join(scripts, launcher), verifierSha256: sha256(await readFile(path.join(source, launcher))),
      runtimeSha256: await runtimeIdentity(),
    },
  };
  const options = { identity: { workspace: path.join(root, "workspace") } };
  // Start at both executable entry points and follow their literal package-local
  // loads, including Python and the sandbox bridge invoked as subprocesses.
  const pending = [launcher, "review-candidate.mjs"];
  const files = new Map();
  for (const name of pending) {
    if (files.has(name)) continue;
    const contents = await readFile(path.join(source, name), "utf8");
    files.set(name, contents);
    for (const match of contents.matchAll(/["'](?:\.\/)?([a-z-]+\.(?:mjs|py))["']/g)) {
      if (!files.has(match[1])) pending.push(match[1]);
    }
  }
  assert.equal(sha256(jsonBytes(Object.fromEntries([...files].map(([name, bytes]) => [name, sha256(bytes)])))),
    input.delegation.runtimeSha256, "pin covers the transitive package inventory");

  // A malformed but inert runtime would fail parsing if loaded. Removing another
  // dependency must still report the missing file from the non-executing read.
  const runtime = path.join(scripts, "implementer-runtime.mjs");
  const helper = path.join(scripts, "worker-runtime-policy.mjs");
  await writeFile(runtime, "export {");
  await rm(helper);
  await assert.rejects(readDelegation(input, options), { code: "ENOENT", path: helper });
  await writeFile(helper, files.get("worker-runtime-policy.mjs"));
  await writeFile(runtime, files.get("implementer-runtime.mjs"));

  for (const [name, bytes] of files) {
    const file = path.join(scripts, name);
    await writeFile(file, bytes + "\n# synthetic byte mismatch\n");
    await assert.rejects(readDelegation(input, options),
      name === launcher ? /launcher pin changed/ : /runtime inventory changed/, name);
    await writeFile(file, bytes);
  }
  await rm(helper);
  await symlink(path.join(source, "worker-runtime-policy.mjs"), helper);
  await assert.rejects(readDelegation(input, options), /Input is not canonical/);
});

test("exclusive delivery uses only sealed grant terms even when caller fields share its reference", { skip: process.platform !== "linux" }, async (t) => {
  const f = await fixture(t, { staged: true, exclusive: true });
  const w = await exclusiveFixture(f);
  const { input } = await w.assignment("sealed-terms", { commits: false });
  const taskGuidance = twoGroupGuidance(f.planDigest);
  const inflated = { ...input, taskGuidance, grant: { ...input.grant, commits: true, stop: "other",
    budgets: { minutes: 180, corrections: 8 }, eligibleGroups: ["2"], budget: { limit: 180, unit: "minutes" } } };
  const dispatch = await w.decide(inflated);
  assert.equal(dispatch.action, "dispatch", JSON.stringify(dispatch));
  assert.equal(dispatch.group, "1");
  assert.equal(dispatch.commits, false);
  assert.equal((await w.decide({ ...inflated, observed: { ...input.observed, minutesUsed: 4 } })).reason, "BUDGET_EXHAUSTED");
  assert.equal((await w.decide({ ...inflated, observed: { ...input.observed, authorityBudgetUsed: 4 } })).reason,
    "TASK_GUIDED_CONTINUATION_BLOCKED");
  assert.equal((await w.decide({ ...inflated, grant: { ...inflated.grant, reference: "different" } })).reason,
    "DELEGATED_RUNTIME_UNVERIFIED");
});

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
  const wrongGoal = await w.review(attempt, runtime, head, gates, "wrong-goal-review", {
    session: randomUUID(), goalDigest: "2".repeat(64),
  });
  assert.equal((await w.decide({ ...result, handover: wrongGoal, attempt: { id: "wrong-goal-review" } })).reason, "HANDOVER_UNVERIFIED");
  const wrongRole = await w.review(attempt, runtime, head, gates, "wrong-pair-review", {
    session: randomUUID(), configurationSha256: sha256("different synthetic reviewer configuration"),
  });
  assert.equal((await w.decide({ ...result, handover: wrongRole, attempt: { id: "wrong-pair-review" } })).reason, "HANDOVER_UNVERIFIED");
  async function rejectReuse(label, candidate, gateRun) {
    const reused = await w.review(attempt, runtime, candidate, gateRun, label, { bind: false });
    const rereview = { ...accepted, head: candidate, gateRun: gateRun.gateRun, handover: reused, attempt: { id: label } };
    assert.equal((await w.decide(rereview)).reason, "HANDOVER_UNVERIFIED");
    const original = handover.reviewSessionBinding;
    reused.reviewSessionBinding = original;
    assert.equal((await w.decide(rereview)).reason, "HANDOVER_UNVERIFIED");
    const record = JSON.parse(await readFile(original.path, "utf8"));
    reused.reviewSessionBinding = await w.retain(label + ".json", {
      ...record, candidate, requestFileSha256: reused.requestFileSha256, expectFileSha256: reused.expectFileSha256,
    });
    assert.equal((await w.decide(rereview)).reason, "HANDOVER_UNVERIFIED");
  }
  await rejectReuse("same-candidate-session-reuse", head, gates);
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
  await rejectReuse("changed-candidate-session-reuse", progress, fresh);
  const review = await w.review(attempt, runtime, progress, fresh, "goal-progress-review", { session: randomUUID() });
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
