import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, chmodSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fixtureTest as test } from "./test-shards.mjs";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { deliveryCommand } from "../skills/software-development/openspec-delivery/scripts/delivery-cli.mjs";
import { planning } from "../skills/software-development/openspec-delivery/scripts/change-guard.mjs";
import { createRepresentation, sha256, stableJson } from "../skills/software-development/openspec-delivery/scripts/evidence-retention.mjs";
import { protectedFinish, skillSyncDecision } from "../skills/software-development/openspec-delivery/scripts/protected-finish.mjs";

const next = fileURLToPath(new URL("../skills/software-development/openspec-next/scripts/next.mjs", import.meta.url));
const run = promisify(execFile);
const git = (cwd, ...argv) => execFileSync("git", argv, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const verified = (reference, fields = {}) => ({ verified: true, reference, ...fields });
const iso = (time) => new Date(time).toISOString();

function fixture(t, standingTriggers, localHarness) {
  const root = realpathSync(mkdtempSync(path.join(os.tmpdir(), "protected-finish-")));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const repo = path.join(root, "repo");
  const workspace = path.join(root, "implementation");
  const records = path.join(root, "records");
  mkdirSync(repo);
  mkdirSync(records, { mode: 0o700 });
  let inventoryCount = 0;
  const save = (name, value) => {
    const file = path.join(records, (inventoryCount++) + "-" + name + ".json");
    const bytes = JSON.stringify(value);
    writeFileSync(file, bytes, { flag: "wx", mode: 0o600 });
    return { file, sha256: sha256(bytes) };
  };
  git(repo, "init", "-b", "main");
  git(repo, "config", "user.name", "Fixture");
  git(repo, "config", "user.email", "fixture@example.invalid");
  writeFileSync(path.join(repo, "AGENTS.md"), "# Fixture\n" +
    (standingTriggers ? `<!-- openspec-low-touch: ${JSON.stringify({ standingTriggers })} -->\n` : ""));
  writeFileSync(path.join(repo, ".gitignore"), "*.ignored\n");
  mkdirSync(path.join(repo, "openspec"));
  writeFileSync(path.join(repo, "openspec", "config.yaml"), "schema: spec-driven\n");
  git(repo, "add", ".");
  git(repo, "commit", "-m", "base");
  const base = git(repo, "rev-parse", "HEAD");
  const change = "sample";
  const branch = "change/sample";
  git(repo, "worktree", "add", "-b", branch, workspace, base);
  const active = "openspec/changes/sample";
  const changeDir = path.join(workspace, active);
  mkdirSync(path.join(changeDir, "specs", "fixture"), { recursive: true });
  writeFileSync(path.join(changeDir, ".openspec.yaml"), "schema: spec-driven\n");
  writeFileSync(path.join(changeDir, "specs", "fixture", "spec.md"), "# Delta\n");
  writeFileSync(path.join(changeDir, "proposal.md"), "---\ngithub_issue: https://github.com/example/sample/issues/9\n---\n# Proposal\n");
  writeFileSync(path.join(changeDir, "design.md"), "# Design\n");
  const tasks = path.join(changeDir, "tasks.md");
  writeFileSync(tasks, "## 1. Test\n\n- [ ] 1.1 Prove behavior\n");
  git(workspace, "add", ".");
  git(workspace, "commit", "-m", "plan");
  const plan = git(workspace, "rev-parse", "HEAD");
  writeFileSync(tasks, "## 1. Test\n\n- [x] 1.1 Prove behavior\n");
  git(workspace, "commit", "-am", "candidate");
  const head = git(workspace, "rev-parse", "HEAD");
  const repository = "example/sample";
  const url = "https://github.com/" + repository + "/pull/";
  const issue = "https://github.com/" + repository + "/issues/9";
  const identity = { repo, workspace, repository, branch, change, candidate: head, policyRevision: base,
    mode: "task-guided", plan, planDigest: planning(repo, plan, change).digest, target: "main", targetRevision: base, issue };
  const now = Date.now();
  const startedAt = iso(now - 20_000);
  const observedAt = iso(now - 100);
  const grant = verified("finish-1", { schemaVersion: 1, kind: "protected-finish", identity, keepWorktree: false, startedAt,
    deadline: iso(now + 50_000), integratedGates: [["npm", "test"]], closureGates: [["npm", "test"]], uiDeclaration: null });
  const bound = (reference, fields) => verified(reference, { identity, grantReference: grant.reference, observedAt, ...fields });
  const representation = (source, scope, revision, value, at = observedAt, readbackType = "original-response") =>
    createRepresentation({ original: Buffer.from(JSON.stringify(value)), provenance: { source, revision, scope,
      command: ["synthetic", "read"], environmentScope: "fixture", exitStatus: 0, pagination: "complete", observedAt: at, readbackType },
    labels: { representation: readbackType, completeness: "complete", confidentiality: "publishable" } });
  const gate = (revision, label, exitStatus = 0) => {
    const checkout = path.join(root, "isolated-gate");
    const tree = git(repo, "rev-parse", revision + "^{tree}");
    const argv = ["npm", "test"];
    const observedAt = iso(now - 1_000);
    const stream = (name) => createRepresentation({ original: Buffer.from("synthetic output"),
      provenance: { source: "command-" + name, revision, scope: "gate", environmentScope: "disposable-checkout",
        command: argv, exitStatus, pagination: "complete", observedAt, readbackType: "lossless-representation" },
      labels: { representation: "lossless-representation", completeness: "complete", confidentiality: "restricted" } });
    const observation = { head: revision, tree, ignoredGenerated: [] };
    const payload = { schemaVersion: 1, kind: "disposable-gate-run", implementation: workspace, checkout,
      head: revision, tree, plan, planDigest: identity.planDigest, mode: identity.mode, change, generated: [],
      initial: observation, final: observation, bootstrapCount: 0, commands: [{ schemaVersion: 1, kind: "command-capture",
        complete: true, interruption: null, cwd: checkout, argv, revision, exitStatus, observedAt, stdout: stream("stdout"), stderr: stream("stderr") }] };
    const wrapperSha256 = sha256(stableJson(payload));
    return { ref: save(label, { ...payload, wrapperSha256 }), wrapperSha256 };
  };
  const hostConfiguration = localHarness === undefined ? undefined : save("host", { schemaVersion: 1, localHarness });
  const implementationGate = gate(head, "implementation-gate");
  const anchor = save("anchor", bound("ready", { kind: "finish-readiness-readback", ready: true, keepWorktree: false,
    implementationReview: verified("review-1", { session: "implementation-reviewer", head }),
    ...(hostConfiguration ? { hostConfigurationSha256: hostConfiguration.sha256 } : {}),
    implementationGate: implementationGate.ref, implementationGateSha256: implementationGate.wrapperSha256 }));
  const protection = (pullRequest, revision) => {
    const observation = (reference, fields) => verified(reference, { pullRequest, head: revision, observedAt, complete: true, ...fields });
    return { protection: observation("protection", { target: "main", routeVerified: true,
      branchProtection: observation("branch-protection", { required: ["ci@github"] }),
      rulesets: observation("rulesets", { required: ["contract@github"] }) }),
    review: observation("review", { state: "passed" }), checks: observation("checks", { entries: [
      { id: "ci@github", head: revision, state: "passed" },
      { id: "contract@github", head: revision, state: "passed" },
      { id: "optional-app", head: revision, state: "pending" },
    ] }) };
  };
  const pr = (number, revision, state, mergeCommit) => {
    const pullRequest = url + number;
    const isMerged = state === "MERGED";
    const mergedAt = isMerged ? iso(now - 3_000) : null;
    const readbackAt = isMerged ? iso(now - 4_000) : observedAt;
    const requiredCheckIds = ["ci@github", "contract@github"];
    const seal = (source, payload, at) => save(source, representation(source, pullRequest, revision,
      { pullRequest, head: revision, ...payload }, at));
    const checks = requiredCheckIds.map((id) => ({ id, head: revision, conclusion: "success", completedAt: iso(now - 5_000) }));
    return bound("pr-" + number, { url: pullRequest, head: revision, state, mergeCommit, mergedAt,
      requiredCheckIds, complete: true, target: "main", mergeability: "ready", protectionReadback: protection(pullRequest, revision),
      assertion: { pullRequest, expectedHead: revision, applicableCheckIds: requiredCheckIds,
        ...(isMerged ? { mergedAt } : {}), observedNotBefore: startedAt, readbacks: {
          pr: seal("github-pull-request", { state, mergedAt, mergeCommit }, observedAt),
          checks: seal("github-applicable-checks", { checks }, readbackAt),
          checkRuns: seal("github-check-runs", { checks }, readbackAt),
          threads: seal("github-review-threads", { threads: [] }, readbackAt),
        } } });
  };
  function request({ remote, prs = { implementation: url + "1", closure: null }, closureHead, grantChanges,
    reply = url + "1", skillSync, phase = {} }) {
    const finishCheckpoint = save("checkpoint", verified("checkpoint", { schemaVersion: 1, kind: "protected-finish-checkpoint",
      identity, records, grant: save("grant", { ...grant, ...grantChanges }), anchor, prs, closureHead,
      keepWorktree: grantChanges?.keepWorktree ?? grant.keepWorktree, deadline: grantChanges?.deadline ?? grant.deadline,
      observedAt: iso(now - 10_000), ...phase }));
    const finishRemote = save("remote", bound("remote", remote));
    const finishReply = save("reply", bound("continue", { kind: "finish-reply", reply: "continue",
      checkpointSha256: finishCheckpoint.sha256, pullRequest: reply, observedAt: iso(now - 500) }));
    return { repo, change, head, finishCheckpoint, finishRemote, finishReply, skillSync, hostConfiguration };
  }
  const call = (verb, args) => deliveryCommand(verb === "inspect" ? "status" : verb, request(args));
  return { root, repo, workspace, records, change, active, head, identity, request, call, pr, gate, save, bound, url, issue, now, hostConfiguration };
}

test("protected publication reserves the paid PR trigger after both event inventories pass", async (t) => {
  const f = fixture(t);
  const { repository, target } = f.identity;
  const sourceRef = "refs/heads/" + f.identity.branch;
  const scope = { chapter: "implementation", id: "aikido:7:deep-review", target,
    configurationSha256: "d".repeat(64), exposure: "source", costUsd: 4 };
  const triggerGrant = f.save("trigger-grant", verified("named-paid-grant", {
    schemaVersion: 1, kind: "protected-finish-trigger-grant", identity: f.identity, finishReference: "finish-1",
    startedAt: iso(f.now - 20_000), deadline: iso(f.now + 50_000),
    maxDeepReviewCredits: 1, maxZeroCostCiRetries: 0, deepReview: [scope], retry: null,
  }));
  const { chapter, ...entry } = scope;
  const trigger = { ...entry, kind: "app-trigger", event: "pull_request", repository, installation: "7", verified: true,
    providerProof: verified("provider-record", { observedAt: iso(f.now - 100), source: "provider-installation-and-billing",
      provider: "aikido", product: "deep-review", installation: "7", credits: 1, unit: "credits",
      scope: { ...scope, event: "pull_request", kind: "app-trigger", repository, candidate: f.head } }) };
  const inventory = (event, target, triggers) => ({
    pushGrant: verified("event-grant-" + event, { candidate: f.head, event, target: repository,
      targetRef: target, finishReference: "finish-1" }),
    observed: verified("event-inventory-" + event, { candidate: f.head, event, repository, target,
      triggers, complete: true, observedAt: iso(f.now - 100) }),
  });
  const implementation = f.bound("absent", { target, state: "ABSENT", head: f.head, url: null, complete: true, sourceRef,
    beforePublication: f.bound("target-read", { sourceRef, target, head: f.head, targetRevision: f.identity.targetRevision,
      complete: true, routeVerified: true, specsReconciled: true }),
    eventInventories: { push: inventory("push", sourceRef, []), pull_request: inventory("pull_request", target, [trigger]) },
  });
  const request = () => f.request({ prs: { implementation: null, closure: null }, remote: { implementation }, phase: { triggerGrant } });
  const readiness = { ...f.identity, ready: true, head: f.head };
  implementation.eventInventories.push.observed.complete = false;
  assert.equal((await protectedFinish(request(), readiness, f.now)).reason, "TRIGGER_INVENTORY_UNVERIFIED");
  implementation.eventInventories.push.observed.complete = true;
  const input = request();
  const preview = await protectedFinish(input, readiness, f.now);
  assert.equal(preview.reason, "FINISH_TRIGGER_RESERVATION_REQUIRED");
  const selected = { ...input, finishTriggerSelection: preview.finishTriggerSelection };
  const ready = await protectedFinish(selected, readiness, f.now, undefined, "reserve");
  assert.equal(ready.action, "publish-ready");
  assert.equal(ready.finishTriggerReservation.chapter, chapter);
  assert.equal(ready.finishTriggerReservation.triggers[0].credits, 1);
  assert.equal((await protectedFinish(selected, readiness, f.now, undefined, "reserve")).reason, "FINISH_TRIGGER_OUTCOME_PENDING");
});

test("protected finish reserves and settles one retry before requiring a fresh exact rerun", async (t) => {
  const f = fixture(t);
  const { repository, target } = f.identity;
  const pr = f.pr(1, f.head, "OPEN");
  const { checks } = pr.protectionReadback;
  const configurationSha256 = "c".repeat(64);
  const retry = { chapter: "implementation", id: "ci@github", target, configurationSha256, exposure: "repository-ci", costUsd: 0 };
  const triggerGrant = f.save("trigger-grant", verified("named-credit-grant", {
    schemaVersion: 1, kind: "protected-finish-trigger-grant", identity: f.identity, finishReference: "finish-1",
    startedAt: iso(f.now - 20_000), deadline: iso(f.now + 50_000),
    maxDeepReviewCredits: 0, maxZeroCostCiRetries: 1, deepReview: [], retry,
  }));
  const request = (phase = { triggerGrant }) => f.request({ remote: { implementation: pr }, phase });
  const checkEntry = checks.entries[0];
  Object.assign(checkEntry, { state: "failed", runId: "41", attempt: 1 });
  const { chapter, ...trigger } = retry;
  const normalized = { candidate: f.head, repository, target, event: "retry", observedAt: pr.observedAt };
  const scope = { ...trigger, ...normalized, kind: "repository-check" };
  delete scope.observedAt;
  const eventInventory = (event, triggers) => ({
    pushGrant: verified("event-grant-" + event, { event, candidate: f.head, target: repository, targetRef: target, finishReference: "finish-1" }),
    observed: verified("event-inventory-" + event, { ...normalized, event, complete: true, observedAt: pr.observedAt, triggers }),
  });
  pr.eventInventories = { retry: eventInventory("retry", [verified("ci-trigger", { ...scope, installation: "7",
    providerProof: verified("ci-installation", { observedAt: pr.observedAt, source: "provider-workflow-and-billing",
      provider: "github-actions", product: "repository-ci", installation: "7", scope: { ...scope, chapter } }),
  })]) };
  const detail = { observedAt: pr.observedAt, source: "github-actions", repository, head: f.head, id: retry.id,
    configurationSha256, workflow: "ci", executionSha256: "a".repeat(64) };
  pr.retryEvidence = {
    failure: verified("run-failure", { ...detail, event: "pull_request", pullRequest: pr.url, state: "failed", runId: "41",
      attempt: 1, classification: "runner-lost", testFailure: false }),
    push: verified("passing-push", { ...detail, event: "push", runId: "40", state: "passed", equivalent: true }),
  };
  const options = request();
  const preview = await deliveryCommand("finish", options);
  assert.equal(preview.reason, "FINISH_TRIGGER_RESERVATION_REQUIRED");
  const reserved = await deliveryCommand("reserve-finish-trigger", { ...options, finishTriggerSelection: preview.finishTriggerSelection });
  assert.equal(reserved.action, "retry-check-ready");
  assert.equal(reserved.finishTriggerReservation.triggers[0].runId, "41");
  assert.equal((await deliveryCommand("finish", request())).reason, "FINISH_TRIGGER_OUTCOME_PENDING");
  assert.equal((await deliveryCommand("finish", request({}))).reason, "FINISH_OBSERVATIONS_UNVERIFIED");
  const { sha256: reservationSha256, reference, operation, readbackSha256 } = reserved.finishTriggerReservation;
  const observedAt = iso(Date.now());
  const finishTriggerOutcome = f.save("outcome", verified("provider-retry-accepted", {
    kind: "finish-trigger-outcome", observedAt, state: "consumed", grantReference: reference, reservationSha256,
    scope: { chapter, operation, head: f.head, readbackSha256 },
  }));
  assert.equal((await deliveryCommand("settle-finish-trigger", { ...options, finishTriggerOutcome })).action, "finish-trigger-settled");
  assert.equal((await deliveryCommand("finish", request())).reason, "FINISH_TRIGGER_RETRY_READBACK_REQUIRED");
  const fresh = iso(Date.now());
  const freshRequest = () => f.request({ remote: { implementation: pr, observedAt: fresh }, phase: { triggerGrant } });
  pr.observedAt = fresh;
  for (const item of [checks, pr.protectionReadback.protection, pr.protectionReadback.protection.branchProtection,
    pr.protectionReadback.protection.rulesets, pr.protectionReadback.review]) item.observedAt = fresh;
  Object.assign(checkEntry, { state: "pending", attempt: 2 });
  assert.equal((await deliveryCommand("finish", freshRequest())).action, "watch");
  checkEntry.state = "failed";
  assert.equal((await deliveryCommand("finish", freshRequest())).reason, "REQUIRED_CHECK_FAILED");
  checkEntry.state = "passed";
  pr.eventInventories.merge = eventInventory("merge", []);
  pr.eventInventories.push = eventInventory("push", []);
  assert.equal((await deliveryCommand("finish", freshRequest())).action, "merge-ready");
});

test("protected finish checks adoption, exact current per-event inventory and standing cost before merge", async (t) => {
  const repository = "example/sample";
  const target = "main";
  const policy = { id: "app:42:main-check", repository, event: "push", target, kind: "repository-check",
    configurationSha256: "b".repeat(64), exposure: "existing public diff", costUsd: 0 };
  const f = fixture(t, [policy]);
  const pr = f.pr(1, f.head, "OPEN");
  const decision = () => f.call("finish", { remote: { implementation: pr } });
  assert.equal((await decision()).reason, "PUSH_AUTHORITY_PENDING");
  const inventory = (event, triggers) => ({
    pushGrant: verified("event-" + event, { target: repository, candidate: f.head, event,
      targetRef: target, finishReference: "finish-1" }),
    observed: verified("inventory-" + event, { complete: true, candidate: f.head, repository, event, target,
      observedAt: pr.observedAt, triggers }),
  });
  pr.eventInventories = { merge: inventory("merge", []),
    push: inventory("push", [{ ...policy, verified: true }]) };
  const result = await decision();
  assert.equal(result.action, "merge-ready", JSON.stringify(result));
  assert.deepEqual(result.triggerInventories[1].standing, [policy.id]);
  pr.eventInventories.push.observed.triggers[0].costUsd = 1;
  assert.equal((await decision()).reason, "PUSH_TRIGGER_AUTHORITY_PENDING");
  pr.eventInventories.push.observed.triggers[0].costUsd = 0;
  pr.eventInventories.push.observed.observedAt = iso(f.now - 61_000);
  assert.equal((await decision()).reason, "TRIGGER_INVENTORY_UNVERIFIED");
});

test("packaged finish status distinguishes optional suites and contextual continue preserves the exact head", async (t) => {
  const f = fixture(t);
  const implementation = f.pr(1, f.head, "OPEN");
  const remote = { implementation };
  const before = git(f.repo, "worktree", "list", "--porcelain");
  assert.equal((await f.call("finish", { remote })).action, "merge-ready");
  const status = await f.call("inspect", { remote });
  assert.equal(status.pullRequest.checks.length, 2);
  assert.deepEqual(status.pullRequest.optional, [{ id: "optional-app", state: "pending" }]);
  assert.match(status.footer, /checkpoint|Checkpoint/);
  assert.equal((await f.call("continue", { remote })).action, "merge-ready");
  assert.equal((await f.call("continue", { remote, reply: f.url + "8" })).reason, "FINISH_OBSERVATIONS_UNVERIFIED");
  assert.equal((await f.call("continue", { remote: { implementation: { ...implementation, head: "a".repeat(40) } } })).reason, "PR_HEAD_CHANGED");
  const checks = implementation.protectionReadback.checks;
  checks.entries[0].state = "pending";
  assert.equal((await f.call("finish", { remote })).action, "watch");
  assert.equal((await f.call("finish", { remote, grantChanges: { deadline: iso(f.now - 1) } })).reason, "PROTECTED_WAIT_EXPIRED");
  checks.entries[0].state = "failed";
  assert.equal((await f.call("continue", { remote })).reason, "REQUIRED_CHECK_FAILED");
  checks.entries[0].state = "passed";
  checks.entries[2].state = "stalled";
  assert.equal((await f.call("continue", { remote })).reason, "OPTIONAL_CHECK_DISPOSITION_PENDING");
  implementation.protectionReadback.optionalDisposition = verified("disposition", { pullRequest: implementation.url,
    head: f.head, observedAt: implementation.observedAt, decision: "proceed-without", ids: ["optional-app"] });
  assert.equal((await f.call("continue", { remote })).action, "merge-ready");
  implementation.protectionReadback.protection.rulesets.complete = false;
  assert.equal((await f.call("finish", { remote })).reason, "REQUIRED_PROTECTION_OR_CHECKS_UNVERIFIED");
  assert.equal(git(f.repo, "worktree", "list", "--porcelain"), before);
});

test("next CLI routes contextual resume, and a declared preview pauses for review or failed deployment", async (t) => {
  const f = fixture(t);
  const implementation = f.pr(1, f.head, "OPEN");
  const grantChanges = { uiDeclaration: { localTryOut: false, interactions: [], deployPreview: true } };
  const artifact = { root: path.join(f.root, "artifact"), sha256: sha256("synthetic build") };
  mkdirSync(artifact.root);
  const card = { kind: "deploy-preview", candidate: f.head, target: "synthetic release preview", scope: "review packaged artifact",
    data: ["built-artifact"], expectedCost: { amount: 0, unit: "credits" }, runs: 1, artifact, trigger: null, retryOf: null };
  const grant = { reference: "external-preview", kind: "external-single-run", localOnly: false, verified: true, schemaVersion: 1,
    card, reservation: path.join(f.records, sha256("external-preview") + ".json") };
  const preview = verified("preview-run", { candidate: f.head, authorityReference: "external-preview", separateGrant: true,
    artifactOnly: true, url: "https://preview.example.invalid/build", deployment: "passed" });
  assert.equal((await f.call("finish", { remote: { implementation, preview }, grantChanges })).reason, "PREVIEW_AUTHORITY_PENDING");
  preview.reservation = await deliveryCommand("reserve-external", { card, grant, history: [], observed: {
    artifact: { ...artifact, candidate: f.head, isolated: true, approvedDataOnly: true, accountActions: false, cleanupReady: true },
  } });
  const pending = await f.call("finish", { remote: { implementation, preview }, grantChanges });
  assert.equal(pending.reason, "PREVIEW_REVIEW_PENDING");
  assert.match(pending.status.footer, /https:\/\/preview\.example\.invalid\/build/);
  const reviewed = { ...preview, reviewed: true, reviewedUrl: preview.url, reviewReference: "human-preview-review" };
  const input = f.save("route", f.request({ remote: { implementation, preview: reviewed }, grantChanges }));
  const { stdout } = await run(process.execPath, [next, "continue", "--input", input.file], { encoding: "utf8" });
  assert.equal(JSON.parse(stdout).action, "merge-ready");
  assert.equal((await f.call("finish", { remote: { implementation, preview: { ...reviewed, deployment: "failed" } }, grantChanges })).reason, "PREVIEW_FAILED");
});

test("finish advances verified closure in order and reconciles partial multi-worktree retirement", (t) => closureFixture(t));

test("adopted finish requires a fresh current harness for an OPEN closure PR", (t) => closureFixture(t, true));

async function closureFixture(t, adopted = false) {
  const adapterDir = realpathSync(mkdtempSync(path.join(os.tmpdir(), "finish-adapter-")));
  t.after(() => rmSync(adapterDir, { recursive: true, force: true }));
  const executable = path.join(adapterDir, "adapter");
  const adapter = "#!/bin/sh\nexit 1\n";
  writeFileSync(executable, adapter, { mode: 0o700 });
  const binding = { id: "fixture", kind: "cli", executable, executableSha256: sha256(adapter), args: [],
    timeoutMs: 1000, maxAgeMs: 60000, exposure: "local-only" };
  const f = adopted ? fixture(t, [], binding) : fixture(t);
  const { repo, head, change, workspace, url } = f;
  const closureWorkspace = path.join(f.root, "closure");
  const detached = path.join(f.root, "old-verification");
  const ambiguous = path.join(f.root, "unassigned-detached");
  const unrelated = path.join(f.root, "unrelated");
  git(repo, "merge", "--ff-only", head);
  git(repo, "worktree", "add", "-b", "closure/sample", closureWorkspace, head);
  git(repo, "worktree", "add", "--detach", detached, head);
  git(repo, "worktree", "add", "--detach", ambiguous, head);
  git(repo, "worktree", "add", "-b", "other-work", unrelated, head);
  const archive = "openspec/changes/archive/2026-11-25-sample";
  mkdirSync(path.join(closureWorkspace, "openspec/changes/archive"));
  git(closureWorkspace, "mv", f.active, archive);
  const gates = [{ command: "npm test", commit: head, exitCode: 0, evidence: "synthetic gate" }];
  const receiptRecord = { schemaVersion: 1, change, issueUrl: f.issue, head, plan: f.identity.plan,
    planDigest: f.identity.planDigest, base: f.identity.policyRevision, integrated: head, verified: head,
    integrationReference: url + "1", gates,
    review: { schemaVersion: 1, change, issueUrl: f.issue, head, planDigest: f.identity.planDigest,
      verdict: "pass", findings: [], reviewer: "fixture", reference: "review-1", gates } };
  const receipt = JSON.stringify(receiptRecord);
  mkdirSync(path.join(closureWorkspace, archive, "evidence"));
  writeFileSync(path.join(closureWorkspace, archive, "evidence/receipt.json"), receipt);
  git(closureWorkspace, "add", ".");
  git(closureWorkspace, "commit", "-m", "archive");
  const closureHead = git(closureWorkspace, "rev-parse", "HEAD");
  const receiptSha256 = sha256(receipt);
  const acceptance = { archive, closureMerge: closureHead, receiptSha256 };
  const implementation = f.pr(1, head, "MERGED", head);
  const closureAbsent = f.bound("closure-absent", { state: "ABSENT", complete: true, url: null, target: "main" });
  const integrated = f.bound("integrated", { head, mergeCommit: head, gate: f.gate(head, "integrated-gates").ref });
  const closureCandidate = f.bound("closure-candidate", { head: closureHead, archive, integrated: head,
    receiptSha256, receipt: f.save("closure-receipt", receiptRecord), receiptPath: archive + "/evidence/receipt.json" });
  const call = (remote, args) => f.call("finish", { remote: { implementation, ...remote }, ...args });
  assert.equal((await call({})).action, "verify-integrated");
  assert.equal((await call({ integrated, closure: closureAbsent })).action, "prepare-closure");
  assert.equal((await call({ integrated, closureCandidate })).action, "verify-closure");
  closureCandidate.gate = f.gate(closureHead, "failed-closure-gates", 1).ref;
  assert.equal((await call({ integrated, closureCandidate })).reason, "CLOSURE_GATE_FAILED");
  closureCandidate.gate = f.gate(closureHead, "closure-gates").ref;
  assert.equal((await call({ integrated, closureCandidate })).action, "review-closure");
  const closureReview = f.bound("closure-review", { kind: "independent-closure-review", head: closureHead,
    gateSha256: closureCandidate.gate.sha256, session: "closure-reviewer", verdict: "pass", factual: true, findings: [] });
  if (adopted) {
    const closure = f.pr(2, closureHead, "OPEN", null);
    closure.eventInventories = Object.fromEntries(["merge", "push"].map((event) => [event, {
      pushGrant: verified("event-" + event, { target: f.identity.repository, candidate: closureHead, event,
        targetRef: "main", finishReference: "finish-1" }),
      observed: verified("inventory-" + event, { candidate: closureHead, repository: f.identity.repository,
        event, target: "main", observedAt: closure.observedAt, complete: true, triggers: [] }),
    }]));
    const pinned = { prs: { implementation: url + "1", closure: url + "2" }, closureHead };
    const check = () => call({ integrated, closureCandidate, closureReview, closure }, pinned);
    assert.match((await check()).detail, /Missing independent host-retained harness seal/);
    const harnessFor = (candidate, observedAt) => {
      const result = { schemaVersion: 1, harnessId: binding.id, candidate, verdict: "pass", findings: [], observedAt };
      const ref = f.save("harness", { schemaVersion: 2, harnessId: binding.id, candidate,
        configurationSha256: f.hostConfiguration.sha256, executableSha256: binding.executableSha256,
        resultSha256: sha256(JSON.stringify(result)), result });
      chmodSync(ref.file, 0o400);
      closureCandidate.harness = ref;
      closureReview.harnessSha256 = ref.sha256;
    };
    harnessFor(head, iso(f.now - 500));
    assert.match((await check()).detail, /candidate SHA mismatch/);
    harnessFor(closureHead, iso(f.now - 61000));
    assert.match((await check()).detail, /timestamp/);
    harnessFor(closureHead, iso(f.now - 500));
    const accepted = await check();
    assert.equal(accepted.action, "merge-ready", JSON.stringify(accepted));
    return;
  }
  const unpublished = { ...closureAbsent, head: closureHead };
  assert.equal((await call({ integrated, closureCandidate, closureReview, closure: unpublished })).reason, "PUBLICATION_TARGET_UNVERIFIED");
  unpublished.beforePublication = f.bound("target", { head: closureHead, target: "main", targetRevision: head,
    complete: true, routeVerified: true, specsReconciled: true });
  assert.equal((await call({ integrated, closureCandidate, closureReview, closure: unpublished })).reason, "PUSH_AUTHORITY_PENDING");
  unpublished.triggers = { pushGrant: verified("push", { candidate: closureHead, target: f.identity.repository, finishReference: "finish-1" }),
    observed: verified("inventory", { candidate: closureHead, triggers: [] }) };
  assert.equal((await call({ integrated, closureCandidate, closureReview, closure: unpublished })).action, "publish-ready");
  const closure = f.pr(2, closureHead, "MERGED", closureHead);
  git(repo, "merge", "--ff-only", closureHead);
  const issue = f.bound("issue", { url: f.issue, state: "OPEN", acceptance });
  const remote = { integrated, closureCandidate, closureReview, closure, issue };
  const pinned = { prs: { implementation: url + "1", closure: url + "2" }, closureHead };
  assert.equal((await call({ ...remote, closureReview: { ...closureReview, session: "implementation-reviewer" } }, pinned)).action, "review-closure");
  assert.equal((await call({ ...remote, issue: { ...issue, acceptance: { ...acceptance, closureMerge: head } } }, pinned)).reason, "ISSUE_ACCEPTANCE_READBACK_PENDING");
  assert.equal((await call(remote, pinned)).action, "close-issue");
  issue.state = "CLOSED";
  const commonDirectory = git(repo, "rev-parse", "--path-format=absolute", "--git-common-dir");
  const proof = (workspace, role, ref, head) => verified("creation:" + role,
    { change, repository: f.identity.repository, commonDirectory, workspace, role, ref, head });
  remote.worktrees = f.bound("worktrees", { complete: true,
    entries: [proof(workspace, "implementation", "refs/heads/change/sample", head),
      proof(closureWorkspace, "closure", "refs/heads/closure/sample", closureHead),
      proof(detached, "verification", null, head)],
    writers: verified("idle", { idle: [workspace, closureWorkspace, detached] }) });
  writeFileSync(path.join(detached, "retain.ignored"), "keep me");
  git(repo, "worktree", "lock", closureWorkspace);
  const first = await call(remote, pinned);
  assert.equal(first.action, "retire-worktrees", first.detail ?? first.reason);
  assert.equal(first.archiveAccepted, true);
  const state = (decision, workspace) => decision.worktrees.find((entry) => entry.workspace === workspace).state;
  assert.equal(state(first, workspace), "eligible");
  assert.equal(state(first, detached), "blocked");
  assert.equal(state(first, closureWorkspace), "blocked");
  assert.equal(state(first, unrelated), "retained");
  assert.equal(state(first, ambiguous), "blocked");
  const eligible = first.worktrees.find((entry) => entry.workspace === workspace);
  assert.deepEqual(eligible.argv, ["git", "-C", repo, "worktree", "remove", "--", workspace]);
  git(repo, "worktree", "remove", "--", workspace);
  const partial = await call(remote, pinned);
  assert.equal(partial.reason, "WORKTREE_CLEANUP_BLOCKED");
  assert.equal(partial.archiveAccepted, true);
  assert.equal(state(partial, workspace), "removed");
  assert.equal(state(partial, ambiguous), "blocked");
  git(repo, "worktree", "remove", "--", ambiguous);
  assert.equal(git(repo, "rev-parse", "refs/heads/change/sample"), head);
  const kept = await call(remote, { ...pinned, grantChanges: { keepWorktree: true } });
  assert.equal(kept.action, "closed");
  assert.equal(state(kept, closureWorkspace), "retained");
  assert.equal(state(kept, detached), "retained");
  git(repo, "worktree", "unlock", closureWorkspace);
  rmSync(path.join(detached, "retain.ignored"));
  const pending = await call(remote, pinned);
  assert.equal(state(pending, closureWorkspace), "eligible");
  assert.equal(state(pending, detached), "eligible");
  git(repo, "worktree", "remove", "--", closureWorkspace);
  git(repo, "worktree", "remove", "--", detached);
  const complete = await call(remote, pinned);
  assert.equal(complete.action, "closed");
  assert.equal(state(complete, closureWorkspace), "removed");
  assert.equal(state(complete, detached), "removed");
  assert.equal(state(complete, unrelated), "retained");
  const source = { revision: closureHead, route: "reviewed-native-copy" };
  const packages = [{ name: "openspec-delivery", sha256: sha256("complete package"), version: "1.6.0", metadataVersion: null }];
  remote.release = verified("accepted-release", { identity: f.identity, acceptance, source, packages,
    state: "deployment-inapplicable", reviewed: true, nativeUpdatePackages: packages });
  assert.equal((await call(remote, pinned)).sync.action, "select-sync");
  const selected = await f.call("sync-skills", { ...pinned, remote: { implementation, ...remote },
    skillSync: { client: "codex", profile: path.join(f.root, "fixture-codex-home"), source, packages } });
  assert.equal(selected.action, "sync-assessment");
  assert.equal(selected.sync.action, "offer-sync");
  assert.equal(selected.profileWrites, false);
}

test("post-release sync is advisory and strictly matches profile, installer scope, provenance and fresh session", (t) => {
  const f = fixture(t);
  const identity = f.identity;
  const acceptance = { archive: "opaque archive", closureMerge: f.head, receiptSha256: "a".repeat(64) };
  const packages = [{ name: "openspec-delivery", version: "1.6.0", metadataVersion: null, sha256: "b".repeat(64) }];
  const source = { revision: f.head, route: "reviewed-native-copy" };
  const release = verified("release", { identity, acceptance, source, packages, state: "deployment-inapplicable",
    reviewed: true, nativeUpdatePackages: packages });
  const scratchProfile = path.join(f.root, "selected-codex-home");
  const selection = { client: "codex", profile: scratchProfile, source, packages };
  mkdirSync(scratchProfile);
  const scratchSkill = path.join(scratchProfile, "SKILL.md");
  writeFileSync(scratchSkill, "prior complete fixture package");
  const assess = (proposal, publication = release) =>
    skillSyncDecision({ proposal, release: publication, identity, acceptance, records: f.records, finishReference: "finish-1" });
  assert.equal(assess(undefined).action, "select-sync");
  assert.equal(assess(selection).action, "offer-sync");
  assert.equal(assess(selection, { ...release, nativeUpdatePackages: [] }).reason, "NATIVE_INSTALLER_SCOPE_MISMATCH");
  const authority = f.save("sync-authority", verified("sync-grant", { identity, acceptance, selection, kind: "post-release-skill-sync" }));
  assert.equal(assess({ ...selection, profile: path.join(f.root, "another-home"), authority }).reason, "SEPARATE_SYNC_AUTHORITY_PENDING");
  const ready = assess({ ...selection, authority });
  assert.equal(ready.action, "operator-sync-ready");
  assert.equal(ready.profileWrites, false);
  assert.deepEqual(ready.command, ["npm", "run", "install:local", "--", "--update", "--client", "codex", "--user-home", scratchProfile]);
  const result = verified("readback", { selection, authorityReference: "sync-grant", backupOutsideDiscovery: true,
    collisionFree: true, provenance: "reviewed-native-copy", installedPackages: packages, freshSession: true });
  assert.equal(assess({ ...selection, authority, observation: f.save("readback", result) }).action, "sync-verified");
  assert.equal(assess({ ...selection, authority, observation: f.save("wrong-home", { ...result, freshSession: false }) }).reason, "SYNC_VERIFICATION_BLOCKED");
  for (const invalid of [{ sha256: "c".repeat(64) }, { version: "1.5.0" }, { metadataVersion: "inapplicable" }]) {
    const wrong = { ...result, installedPackages: [{ ...packages[0], ...invalid }] };
    assert.equal(assess({ ...selection, authority, observation: f.save("package-drift", wrong) }).reason, "SYNC_VERIFICATION_BLOCKED");
  }
  const hermes = { ...selection, client: "hermes", profile: "selected-hermes", source: { ...source, route: "scanner-managed" } };
  const hub = { ...release, source: hermes.source, state: "published" };
  const hubAuthority = f.save("hub-authority", verified("hub-grant", { identity, acceptance, selection: hermes, kind: "post-release-skill-sync" }));
  const scan = { ...result, selection: hermes, authorityReference: "hub-grant", scanner: "blocked" };
  assert.equal(assess({ ...hermes, authority: hubAuthority, observation: f.save("blocked-scan", scan) }, hub).reason, "SYNC_VERIFICATION_BLOCKED");
  assert.equal(readFileSync(scratchSkill, "utf8"), "prior complete fixture package");
});
