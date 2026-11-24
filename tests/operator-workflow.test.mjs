import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sha256 } from "../skills/software-development/openspec-delivery/scripts/evidence-cli.mjs";
import { stableJson } from "../skills/software-development/openspec-delivery/scripts/evidence-retention.mjs";
import { planningWorktree } from "../skills/software-development/openspec-delivery/scripts/change-guard.mjs";
import { operatorStatus } from "../skills/software-development/openspec-delivery/scripts/operator-status.mjs";
import { startConvergenceReview, convergencePacket, acceptConvergenceReview } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/orchestration-core.mjs";
import { boundary, change, fixture, own, twoGroupGuidance } from "./delivery-runtime-setup.mjs";

const cardEpoch = Date.now() - 30 * 60_000;
const cardTime = (minutes) => new Date(cardEpoch + minutes * 60_000).toISOString();

async function sealedFixture(root, name, record) {
  const file = path.join(root, name + ".json");
  const source = JSON.stringify(record);
  await writeFile(file, source);
  return { file, sha256: sha256(source) };
}

async function operatorFixture(t, optedIn = true, inspectDraft, staged = false) {
  let freeze;
  let proposalRequest;
  const f = await fixture(t, { proposeToFreeze: optedIn, staged, beforeFreeze: async ({ root, repo, workspace, base, run, draft }) => {
    const verified = { verified: true, reference: "retained:operator-fixture" };
    const proposal = { ...verified, kind: "short-proposal", phase: "assess", goal: "Deliver the widget" };
    const validation = await sealedFixture(root, "validation", { ...verified, change, policyRevision: base,
      inputs: draft.context.inputs, nativeReady: true, strictExitCode: 0, metadataExitCode: 0,
      issueReference: verified.reference });
    const request = { repo, workspace, change, parent: base, target: base, proposal, validation,
      selection: { revision: base, reference: verified.reference, preExecutionReview: false, continuousGoal: false },
      deliveryBoundary: { ...boundary, stagedAuthority: staged },
      baseline: { ...verified, head: base, upstreamVerified: true },
      issue: { ...verified, change, bound: true },
      planningGrant: { ...verified, workspace, change, policyRevision: base, commits: true, stopReached: false,
        write: true, validate: true, minutes: 20, minutesUsed: 1, corrections: 1, stop: "Frozen plan" } };
    proposalRequest = request;
    const decision = (await run("proposal", request)).value;
    assert.equal(decision.action, optedIn ? "freeze-ready" : "stop", JSON.stringify(decision));
    if (!optedIn) assert.equal(decision.reason, "UNCOMMITTED_DRAFT_BOUNDARY");
    assert.equal((await run("proposal", { ...request, restrictions: { noCommits: true } })).value.reason, "UNCOMMITTED_DRAFT_BOUNDARY");
    if (optedIn) assert.equal((await run("proposal", { ...request, planningGrant: undefined })).value.reason, "PLAN_COMMIT_AUTHORITY_PENDING");
    assert.equal((await run("proposal", { ...request, proposal: { ...proposal, kind: "goal-draft" } })).value.reason, "APPROACH_REVIEW_PENDING");
    assert.equal((await run("proposal", { ...request, validation: { ...validation, sha256: "0".repeat(64) } })).value.reason, "PLANNING_OBSERVATIONS_UNVERIFIED");
    const note = path.join(root, "goal.md");
    await writeFile(note, proposal.goal);
    const prepared = await run("proposal", { ...request, proposal: { ...proposal, phase: "prepare", note, goal: undefined } });
    assert.equal(prepared.value.workspace.action, "reuse", prepared.stdout);
    await inspectDraft?.({ root, workspace, draft, request, run });
    freeze = await sealedFixture(root, "freeze", decision);
  } });
  const records = path.join(f.root, "operator-records");
  await mkdir(records, { mode: 0o700 });
  const roleBindings = {};
  const roles = {};
  for (const role of ["implementer", "reviewer"]) {
    const binding = { role, verified: true, reference: `qualified:${role}`, route: "terminal-adapter",
      readOnly: role === "reviewer" };
    roleBindings[role] = await sealedFixture(f.root, role, binding);
    roles[role] = { ...binding, bindingSha256: roleBindings[role].sha256 };
  }
  const repositoryObservation = { verified: true, reference: "retained:repository", repo: f.repo, repository: "example/fixture" };
  const operator = { records, thread: "fixture-thread", operator: "operator", card: "first-card",
    displayedAt: cardTime(0), expiresAt: cardTime(60) };
  const cardSummary = { outcome: f.contract.outcome, gates: f.contract.gates, exclusions: f.contract.nonGoals,
    restrictions: { ...f.request.restrictions, noCommits: true, keepWorktree: true }, local: {
      budgets: f.contract.budgets, stop: f.contract.localAuthority.stop, commits: true, roles } };
  if (staged) {
    cardSummary.restrictions.group = "1";
    cardSummary.local.eligibleGroups = ["1"];
    cardSummary.local.budget = { limit: 15, unit: "minutes" };
  }
  const request = { ...f.request, approval: undefined, grant: undefined, freeze, roleBindings,
    repositoryObservation, cardSummary, operator,
    ...(staged && { cardScope: { verified: true, reference: "retained:task-guidance", planDigest: f.planDigest, summary: cardSummary } }) };
  return { ...f, records, request, operator, proposalRequest };
}

async function displayCard(f, turnId = "display-turn") {
  const preview = await f.run("approval-card", f.request);
  assert.equal(preview.status, 0, preview.stdout);
  const turn = { verified: true, reference: "conversation:display", id: turnId, kind: "display",
    operator: f.operator.operator, thread: f.operator.thread, card: f.operator.card,
    at: f.operator.displayedAt, displaySha256: preview.value.displaySha256 };
  const displayed = await f.run("record-approval-card", { ...f.request, operator: { ...f.operator, turn } });
  assert.equal(displayed.status, 0, displayed.stdout);
  return displayed.value;
}

function shortReply(f, card, text = "approve and run", update = {}) {
  const at = cardTime(3);
  return { ...f.request, operator: { ...f.operator, cardSha256: card.sha256, turn: {
    verified: true, reference: "conversation:reply", id: "reply-turn", kind: "reply", text, at,
    operator: f.operator.operator, thread: f.operator.thread, immediate: true,
    inReplyTo: "display-turn", ...update,
  } } };
}

test("prospective policy leaves inherited changes at the uncommitted boundary", async (t) => {
  const f = await operatorFixture(t, false, async ({ request, workspace, run }) => {
    const file = path.join(workspace, "AGENTS.md");
    const original = await readFile(file, "utf8");
    await writeFile(file, original + "\n<!-- openspec-proposal: propose-to-freeze -->\n");
    const selfAdoption = await run("proposal", { ...request, declaredContractPaths: ["AGENTS.md"] });
    assert.equal(selfAdoption.value.reason, "UNCOMMITTED_DRAFT_BOUNDARY", selfAdoption.stdout);
    await writeFile(file, original);
  });
  assert.equal(f.policy.proposeToFreeze, false);
  assert.match((await f.run("approval-card", f.request)).value.error, /Integrated plan parent/);
});

test("current operator guides name the packaged routes and the exact workspace-scoped Codex launcher", async () => {
  const guide = await readFile(new URL("../docs/openspec-workflow.md", import.meta.url), "utf8");
  const operator = await readFile(new URL("../skills/software-development/openspec-delivery/references/operator-workflow.md", import.meta.url), "utf8");
  const launch = 'codex --approve-for-me -C "$change_worktree" --add-dir "$change_records"';
  for (const source of [guide, operator]) {
    assert.ok(source.includes(launch));
    assert.match(source, /workspace-write with automatic approval review/);
    assert.match(source, /\$openspec-next inspect <full-name>/);
    assert.match(source, /HANDOFF_ACK/);
  }
  for (const command of ["proposal", "approval-card", "record-approval-card", "approval-reply", "status", "checkpoint-relay"]) {
    assert.ok(operator.includes(`node "$delivery_runtime" ${command} --input "$request" --json`));
  }
});

test("short proposal replays pinned charter convergence with grounded corrections and a finite ledger", async (t) => {
  await operatorFixture(t, true, async ({ root, workspace, draft, request, run }) => {
    const verifier = fileURLToPath(new URL("../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/orchestration-core.mjs", import.meta.url));
    const verifierSha256 = sha256(await readFile(verifier));
    const verified = { verified: true, reference: "retained:charter" };
    const binding = { route: "terminal-adapter", qualified: true, independent: true, readOnly: true,
      client: "codex", model: "fixture-reviewer", permissions: ["read"] };
    const record = startConvergenceReview({ change, goal: request.proposal.goal, charter: {
      clauses: ["goal"], boundaries: ["execution"], tasks: ["1.1"], gates: ["widget"],
    }, binding, passRule: "charter-v1", budget: 1 });
    const inputs = draft.context.inputs;
    const packetHashes = { fixture: "a".repeat(64) };
    const packet = convergencePacket({ record, inputs, packetHashes, authorSession: "author", reviewerSession: "review-1" });
    const finding = { id: "F1", severity: "Medium", path: `${own}/proposal.md`, line: 1,
      impact: "Missing detail", trigger: "Local load", remedy: "Clarify input", clause: "goal" };
    const review = { identity: packet.identity, readOnly: true, reference: "retained:review-1",
      verdict: "Verdict: Findings", findings: [finding], observations: [], coverageLimitations: [], ledgerChecks: [] };
    const first = { record, packet, review, currentInputs: inputs, currentPacketHashes: packetHashes, recordIntegrityVerified: true };
    const entry = { ...request, selection: { ...request.selection, preExecutionReview: true, approachConvergence: true },
      orchestrationAvailable: true, planningGrant: { ...request.planningGrant, review: true, reviewBinding: binding,
        paths: [`${own}/proposal.md`, `${own}/design.md`] },
      charter: { verifier, verifierSha256, inventory: { ...verified, match: true, verifierSha256 },
        observation: await sealedFixture(root, "blocked-charter", first) } };
    assert.equal((await run("proposal", entry)).value.reason, "APPROACH_REVIEW_PENDING");
    const correction = { preflight: true, launchFailures: 0, repeated: false, contradictory: false,
      drift: false, validation: "pass", finding: { id: finding.id, classification: "routine", inputs,
        paths: [finding.path], evidence: review.reference, remedy: finding.remedy } };
    const retry = { ...entry, proposal: { ...entry.proposal, phase: "correct" }, correction };
    const admitted = await run("proposal", retry);
    assert.equal(admitted.value.action, "apply-validate-review", admitted.stdout);
    assert.equal(admitted.value.cumulativeCycles, 1);
    assert.equal((await run("proposal", { ...retry, correction: { ...correction, launchFailures: 2 } })).value.action, "stop");
    const crossed = await run("proposal", { ...retry,
      planningGrant: { ...entry.planningGrant, reviewBinding: { ...binding, model: "crossed" } } });
    assert.match(crossed.value.detail, /fixed grant, goal or qualified reviewer/);
    await writeFile(path.join(workspace, own, "design.md"), "# Design\n\nUse local data.\n");
    assert.match((await run("proposal", entry)).value.detail, /input drift/);
    const amendedInputs = planningWorktree(workspace, change).inputs;
    const latest = acceptConvergenceReview(first).record;
    const revised = convergencePacket({ record: latest, inputs: amendedInputs, packetHashes, authorSession: "author",
      reviewerSession: "review-2", correction: { ...verified, beforeInputs: inputs, amendedInputs, strictExitCode: 0, metadataExitCode: 0 } });
    const second = { ...first, record: latest, packet: revised, currentInputs: amendedInputs,
      review: { ...review, identity: revised.identity, reference: "retained:review-2",
        ledgerChecks: [{ id: "F1", status: "persistent" }] } };
    const validation = await sealedFixture(root, "charter-validation", { ...verified, change,
      policyRevision: request.parent, inputs: amendedInputs, nativeReady: true, strictExitCode: 0,
      metadataExitCode: 0, issueReference: request.issue.reference });
    const exhausted = await run("proposal", { ...retry, validation,
      correction: { ...correction, finding: { ...correction.finding, inputs: amendedInputs } },
      charter: { ...entry.charter, observation: await sealedFixture(root, "exhausted-charter", second) } });
    assert.equal(exhausted.value.reason, "Correction budget exhausted", exhausted.stdout);
    const accepted = await run("proposal", { ...entry, validation, charter: { ...entry.charter,
      observation: await sealedFixture(root, "accepted-charter", { ...second, review: {
        ...second.review, verdict: "Verdict: No findings", findings: [], ledgerChecks: [
          { id: "F1", status: "resolved", disposition: "applied", evidence: validation.file, reReviewReference: "retained:review-2" },
        ],
      } }) } });
    assert.equal(accepted.value.action, "freeze-ready", accepted.stdout);
    await rm(path.join(workspace, own, "design.md"));
  });
});

test("unique displayed approval yields separately retained approval and bounded execution through next", async (t) => {
  const f = await operatorFixture(t);
  const card = await displayCard(f);
  const replayDisplay = await f.run("record-approval-card", { ...f.request, operator: { ...f.operator, turn: card.entry.display } });
  assert.equal(replayDisplay.status, 1);
  const read = { ...f.request, operator: { ...f.operator, at: cardTime(2) } };
  const retainedBefore = await readFile(card.file);
  const inspect = await f.route("inspect", read);
  assert.deepEqual(inspect.value.nextInput, ["approve", "approve and run", "changes: <planning feedback>"]);
  assert.equal(inspect.value.head, f.plan);
  assert.equal(inspect.value.preflight.items.length, 8);
  assert.equal((await f.route("init", read)).stdout, inspect.stdout);
  assert.deepEqual(await readdir(f.records), [path.basename(card.file)]);
  assert.deepEqual(await readFile(card.file), retainedBefore);
  for (const update of [
    { at: cardTime(61) }, { thread: "different-thread" },
    { inReplyTo: "other-display" }, { verified: false }, { immediate: false },
  ]) assert.equal((await f.run("approval-reply", shortReply(f, card, "approve and run", update))).status, 1);
  await writeFile(path.join(f.workspace, own, "design.md"), "Uncommitted planning change");
  assert.match((await f.run("approval-reply", shortReply(f, card))).value.error, /exact plan SHA/);
  await rm(path.join(f.workspace, own, "design.md"));
  const recorded = await f.run("approval-reply", shortReply(f, card));
  assert.equal(recorded.status, 0, recorded.stdout);
  const { approval, grant } = recorded.value.entry;
  assert.equal(grant.approvalReference, approval.reference);
  assert.notEqual(grant.reference, approval.reference);
  assert.equal((await f.run("approval-reply", shortReply(f, card))).status, 1);
  const request = { ...f.request, shortDecision: { ...f.operator, replySha256: recorded.value.sha256, at: cardTime(4) } };
  const dispatch = await f.route("next", request);
  assert.equal(dispatch.value.action, "dispatch", dispatch.stdout);
  assert.equal(dispatch.value.commits, false);
  assert.equal(dispatch.value.remoteWrites, false);
  assert.equal(dispatch.value.status.restrictions.keepWorktree, true);
  const crossed = await f.route("next", { ...request, roleBindings: { ...request.roleBindings, reviewer: request.roleBindings.implementer } });
  assert.equal(crossed.value.reason, "SHORT_AUTHORITY_UNVERIFIED");
  assert.match(crossed.value.detail, /reviewer binding/);
  assert.equal((await f.route("next", { ...request, shortDecision: undefined, approval, grant })).value.reason, "SHORT_AUTHORITY_UNVERIFIED");
  const incomplete = JSON.stringify({ ...recorded.value.entry, grant: null });
  await writeFile(recorded.value.file, incomplete);
  assert.equal((await f.route("next", request)).value.reason, "SHORT_AUTHORITY_UNVERIFIED");
});

test("Task-Guided short approval retains its ordered group and leaves unqualified or external routes pending", async (t) => {
  const f = await operatorFixture(t, true, undefined, true);
  const card = await displayCard(f);
  assert.equal(card.entry.identity.mode, "task-guided");
  const reply = await f.run("approval-reply", shortReply(f, card));
  assert.equal(reply.value.entry.approval.kind, "exact-plan-approval");
  const request = { ...f.request, taskGuidance: twoGroupGuidance(f.planDigest),
    shortDecision: { ...f.operator, replySha256: reply.value.sha256, at: cardTime(4) } };
  const first = await f.route("next", request);
  assert.equal(first.value.action, "dispatch", first.stdout);
  assert.equal(first.value.group, "1");
  assert.equal(first.value.commits, false);
  assert.equal((await f.route("next", { ...request, restrictions: { ...request.restrictions, group: "2" } })).value.reason,
    "SHORT_AUTHORITY_UNVERIFIED");
  const companions = { ...request.preflight.companions, actual: { reviewer: "f".repeat(64) } };
  const drift = await f.route("inspect", { ...request, preflight: { ...request.preflight, companions } });
  assert.equal(drift.value.stopPredicate, "PREFLIGHT_PENDING");
  assert.equal(drift.value.preflight.followUp, "P8");
  assert.match(drift.value.footer, /P8 blocked/);
});

test("approval-only waits for independent local authority and checkpoint fresh-session is file-backed", async (t) => {
  const f = await operatorFixture(t);
  const card = await displayCard(f);
  const reply = await f.run("approval-reply", shortReply(f, card, "approve"));
  assert.equal(reply.status, 0, reply.stdout);
  assert.equal(reply.value.entry.grant, null);
  const request = { ...f.request, shortDecision: { ...f.operator, replySha256: reply.value.sha256, at: cardTime(4) } };
  const decision = await f.route("next", request);
  assert.equal(decision.value.reason, "LOCAL_AUTHORITY_PENDING", decision.stdout);
  const approval = reply.value.entry.approval;
  const localGrant = await sealedFixture(f.records, "separate-grant", { ...approval, ...f.request.cardSummary.local,
    kind: "local-execution-grant", reference: "retained:separate-grant", approvalReference: approval.reference, localOnly: true });
  assert.equal((await f.route("next", { ...request, shortDecision: { ...request.shortDecision, localGrant } })).value.action, "dispatch");
  const proof = await sealedFixture(f.records, "checkpoint-proof", { local: true });
  const identity = { ...decision.value.identity, branch: `change/${change}`, head: f.plan };
  const checkpointFile = await sealedFixture(f.records, "checkpoint", {
    kind: "delivery-checkpoint", schemaVersion: 1, verified: true, reference: "checkpoint:readback",
    identity, records: f.records, attempt: null, grantReference: null, grantSha256: null, evidence: proof, safeBoundary: true,
  });
  const inspected = await f.route("inspect", { ...request, checkpointFile });
  assert.equal(inspected.value.session.kind, "fresh-session", inspected.stdout);
  assert.match(inspected.value.session.starter, /checkpoint\.json.*verify HEAD/);
  assert.equal(inspected.value.session.launch, 'codex --approve-for-me -C "$change_worktree" --add-dir "$change_records"');
  assert.equal((await f.route("inspect", { ...request, checkpointFile: { ...checkpointFile, sha256: "a".repeat(64) } })).value.stopPredicate,
    "OPERATOR_EVIDENCE_UNVERIFIED");
  assert.equal((await f.route("checkpoint-relay", { ...request, checkpointFile })).value.action, "preserve-predecessor");
});

test("a grounded changes reply refreezes the corrected native bytes and supersedes the earlier card", async (t) => {
  const f = await operatorFixture(t);
  f.request.cardSummary.restrictions.noCommits = false;
  const first = await displayCard(f);
  const feedback = await f.run("approval-reply", shortReply(f, first, "changes: Clarify the widget design", { scope: "routine-in-scope" }));
  assert.equal(feedback.status, 0, feedback.stdout);
  assert.equal(feedback.value.entry.approval, null);
  await f.write(f.workspace, `${own}/design.md`, "# Design\n\nThe widget loads from local data.\n");
  const validation = await sealedFixture(f.root, "revised-validation", {
    verified: true, reference: "retained:revised-validation", change, policyRevision: f.base,
    inputs: planningWorktree(f.workspace, change).inputs, nativeReady: true, strictExitCode: 0, metadataExitCode: 0,
    issueReference: f.proposalRequest.issue.reference,
  });
  const revision = { plan: f.plan, operator: { ...f.operator, replySha256: feedback.value.sha256 } };
  const request = { ...f.proposalRequest, validation, revision, repositoryObservation: f.request.repositoryObservation };
  assert.equal((await f.run("proposal", request)).value.reason, "PLAN_COMMIT_AUTHORITY_PENDING");
  assert.equal((await f.run("proposal", { ...request, restrictions: { noCommits: true } })).value.reason, "UNCOMMITTED_DRAFT_BOUNDARY");
  const ready = await f.run("proposal", { ...request,
    planningGrant: { ...request.planningGrant, refreezeFrom: f.plan, predecessorUnpublished: true } });
  assert.equal(ready.value.action, "freeze-ready", ready.stdout);
  const freeze = await sealedFixture(f.root, "revised-freeze", ready.value);
  f.git(f.workspace, "add", `${own}/design.md`);
  f.git(f.workspace, "commit", "--amend", "--no-edit");
  const plan = f.git(f.workspace, "rev-parse", "HEAD");
  const operator = { ...f.operator, card: "second-card", displayedAt: cardTime(10) };
  const successor = { ...f, operator, request: { ...f.request, plan, operator, freeze } };
  const second = await displayCard(successor, "second-display");
  assert.notEqual(second.entry.identity.plan, first.entry.identity.plan);
  assert.notDeepEqual(second.entry.identity.inputs, first.entry.identity.inputs);
  assert.equal(second.entry.identity.planDigest, first.entry.identity.planDigest);
  assert.equal((await f.run("approval-reply", shortReply(successor, first, "approve"))).status, 1);
  const accepted = await f.run("approval-reply", shortReply(successor, second, "approve", {
    inReplyTo: "second-display", id: "second-reply", at: cardTime(12),
  }));
  assert.equal(accepted.status, 0, accepted.stdout);
});

test("operator status keeps the next step when a safe checkpoint lacks a usable workspace", () => {
  const base = { change, recommendedNextAction: { code: "RESUME_BOUNDED_ATTEMPT" } };
  const checkpoint = { safeBoundary: true, file: "/records/checkpoint.json", sha256: "a".repeat(64),
    records: "/records", evidence: { file: "/records/proof.json" } };
  const nextInput = `$openspec-next ${change}`;
  for (const workspace of [undefined, { workspace: null }, { workspace: "" }, { workspace: " " }]) {
    const status = operatorStatus(base, { checkpoint, workspace });
    assert.deepEqual(status.nextInput, [nextInput]);
    assert.deepEqual(status.session, { kind: "same-session" });
    assert.ok(status.footer.includes(`- ${nextInput}`));
    assert.doesNotMatch(status.footer, /Fresh session:|change_worktree=|codex --approve-for-me/);
  }
  const status = operatorStatus(base, { checkpoint, workspace: { workspace: "/work/change" } });
  assert.equal(status.session.kind, "fresh-session");
  assert.match(status.session.setup, /^change_worktree='\/work\/change'/);
  assert.ok(status.footer.includes(status.session.launch));
});

test("qualified checkpoint relay checks timer cancellation, exact successor and retained HANDOFF_ACK", async (t) => {
  const f = await operatorFixture(t);
  const card = await displayCard(f);
  const reply = await f.run("approval-reply", shortReply(f, card));
  const grant = reply.value.entry.grant;
  const request = { ...f.request, shortDecision: { ...f.operator, replySha256: reply.value.sha256, at: cardTime(4) } };
  const initial = await f.route("next", request);
  const identity = { ...initial.value.identity, branch: `change/${change}`, head: f.plan };
  const verified = { verified: true, reference: "retained:relay-observation" };
  const grantSha256 = sha256(stableJson(grant));
  const checkpointFile = await sealedFixture(f.records, "handoff-checkpoint", { ...verified,
    schemaVersion: 1, kind: "delivery-checkpoint", records: f.records, identity, attempt: null,
    grantReference: grant.reference, grantSha256, safeBoundary: true, originalSettlement: verified, evidence: {
      ...await sealedFixture(f.records, "continuation-proof", { settlement: "verified" }),
    } });
  const qualification = { ...verified, route: "herdr", checkpointRotation: true };
  const authority = { ...verified, reference: "retained:separate-relay-grant", kind: "checkpoint-only-rotation", oneRotation: true,
    qualificationReference: qualification.reference, checkpointSha256: checkpointFile.sha256, predecessor: "pane-old" };
  const predecessor = { ...verified, pane: "pane-old", checkpointSha256: checkpointFile.sha256, claimPreserved: true, processPreserved: true };
  const read = async (checkpointRelay) => (await f.route("checkpoint-relay", { ...request, checkpointFile, checkpointRelay })).value;
  assert.equal((await read({ predecessor, qualification })).reason, "CHECKPOINT_RELAY_AUTHORITY_PENDING");
  assert.equal((await read({ predecessor, qualification, authority })).action, "cancel-predecessor-timer");
  predecessor.timerCancelled = true;
  predecessor.timerReference = "retained:cancelled-timer";
  assert.equal((await read({ predecessor, qualification, authority })).action, "preserve-predecessor");
  const successorInventory = { ...verified, absent: true, authorityReference: authority.reference };
  assert.equal((await read({ predecessor, qualification, authority, successorInventory })).action, "open-checkpoint-successor");
  const successor = { ...verified, pane: "pane-new", identity, grantReference: grant.reference, ownership: { ...verified, workspace: f.workspace } };
  assert.equal((await read({ predecessor, qualification, authority, successor: { ...successor, pane: "pane-old" } })).reason, "RELAY_SUCCESSOR_UNVERIFIED");
  assert.equal((await read({ predecessor, qualification, authority, successor })).reason, "HANDOFF_ACK_PENDING");
  const ackRecord = { ...verified, kind: "HANDOFF_ACK", pane: successor.pane, predecessor: predecessor.pane, identity,
    checkpointSha256: checkpointFile.sha256, authorityReference: authority.reference, ownershipReference: successor.ownership.reference,
    grantReference: grant.reference, grantSha256 };
  const wrong = await sealedFixture(f.records, "wrong-ack", { ...ackRecord, grantSha256: "a".repeat(64) });
  assert.equal((await read({ predecessor, qualification, authority, successor, ack: wrong })).reason, "HANDOFF_ACK_UNVERIFIED");
  const ack = await sealedFixture(f.records, "ack", ackRecord);
  assert.equal((await read({ predecessor, qualification, authority, successor, ack })).action, "predecessor-close-ready");
  const closure = { ...verified, absent: true, predecessor: predecessor.pane, successor: successor.pane,
    ackSha256: ack.sha256, authorityReference: authority.reference };
  assert.equal((await read({ predecessor, qualification, authority, successor, ack, closure })).action, "rotation-complete");
});
