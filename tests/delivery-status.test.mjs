import { test } from "node:test";
import assert from "node:assert/strict";
import { deliveryStatus } from "../skills/software-development/openspec-delivery/scripts/delivery-status.mjs";
import { checkPromotion } from "../skills/software-development/openspec-delivery/scripts/finish-readiness.mjs";

const change = "status-fixture";
const head = "a".repeat(40);
const planDigest = "b".repeat(64);
const policy = { mode: "goal-first", policyRevision: "c".repeat(40) };
const identity = { change, planDigest };
const candidate = { change, head, tasksComplete: true };
const fields = ["schemaVersion", "change", "mode", "state", "candidateSha", "planDigest", "activeAttemptId",
  "stopPredicate", "contextHint", "recommendedNextAction"];

test("status is deterministic and leaves unavailable identity fields explicit", () => {
  const unresolved = deliveryStatus({ change: "Ambiguous?" });
  assert.deepEqual(Object.keys(unresolved), fields);
  assert.deepEqual(unresolved, { schemaVersion: 1, change: null, mode: null, state: "unresolved", candidateSha: null,
    planDigest: null, activeAttemptId: null, stopPredicate: null, contextHint: null, recommendedNextAction: { code: "RESOLVE_CHANGE", subject: null } });
  assert.equal(deliveryStatus({ change }).state, "draft");
  const base = { change, policy, identity, candidate };
  for (const [decision, state, reason] of [
    [null, "approval-pending", "EXACT_APPROVAL_PENDING"],
    [{ action: "queue", reason: "LOCAL_AUTHORITY_PENDING" }, "blocked", "LOCAL_AUTHORITY_PENDING"],
    [{ action: "dispatch" }, "local-ready", null],
    [{ action: "continue" }, "active", null],
    [{ action: "queue", reason: "EXACT_REVIEW_PENDING" }, "result-review-pending", "EXACT_REVIEW_PENDING"],
    [{ action: "stop", reason: "DIRECTION_DRIFT_CHOICE" }, "blocked", "DIRECTION_DRIFT_CHOICE"],
    [{ action: "accept-result", head }, "local-verified", null],
  ]) {
    const input = { ...base, decision };
    const value = deliveryStatus(input);
    assert.equal(value.state, state);
    assert.equal(value.stopPredicate, reason);
    assert.equal(JSON.stringify(value), JSON.stringify(deliveryStatus(structuredClone(input))));
  }
  const accepted = { ...base, decision: { action: "accept-result", head } };
  assert.equal(deliveryStatus({ ...accepted, finish: { head, ready: true } }).state, "finish-ready");
  assert.equal(deliveryStatus({ ...accepted, finish: { head: "8".repeat(40), ready: true } }).state, "local-verified");
  assert.equal(deliveryStatus({ ...accepted, closure: { change, candidateSha: head, verified: true } }).state, "closed");
  assert.equal(deliveryStatus({ ...accepted, closure: { change, candidateSha: head, verified: false } }).state, "local-verified");
  assert.equal(deliveryStatus({ ...accepted, attempt: { id: "unproved" } }).stopPredicate, "HANDOVER_UNVERIFIED");
  const id = { change, planDigest, role: "reviewer", candidate: head, attempt: "review-second" };
  const active = deliveryStatus({ ...base, attempt: { id: id.attempt }, context: "fresh-session",
    handoff: { result: { identity: id } }, decision: { action: "continue" } });
  assert.deepEqual([active.activeAttemptId, active.contextHint], [id.attempt, "fresh-session"]);
});

test("status distinguishes receipt-only coverage, zero waiver and missing proof at the actual reviewed parent", () => {
  const reviewedHead = "d".repeat(40);
  const proofLevel = "receipt-only";
  const reviewProof = { proofLevel, coverage: "receipt-only", reviewedHead, statusSha256: "e".repeat(64),
    reference: "f".repeat(64), session: "fixture-reviewer", zeroWaiver: true };
  const base = { change, identity, candidate, policy: { ...policy, proofLevel },
    decision: { action: "accept-result", head: reviewedHead, reviewProof },
    finish: { head, ready: true, taskCompletion: { acceptanceChild: head, reviewedParent: reviewedHead }, reviewProof } };
  assert.equal(deliveryStatus(base).state, "finish-ready");
  assert.deepEqual(deliveryStatus(base).reviewProof, reviewProof);
  const status = (value) => deliveryStatus({ ...base, decision: { ...base.decision, reviewProof: value },
    finish: { ...base.finish, reviewProof: value } });
  assert.equal(status(undefined).reviewProof, null);
  assert.equal(status(undefined).stopPredicate, "REVIEW_PROOF_UNVERIFIED");
  assert.equal(status({ ...reviewProof, zeroWaiver: false }).reviewProof.zeroWaiver, false);
  assert.equal(status({ ...reviewProof, coverage: "whole-file" }).reviewProof, null);
  assert.equal(status({ ...reviewProof, reviewedHead: head }).reviewProof, null);
  const adverse = { ...reviewProof, reviewedHead: head, zeroWaiver: false };
  assert.deepEqual(deliveryStatus({ ...base, finish: null, decision: { action: "queue", reason: "EXACT_REVIEW_PENDING" },
    handoff: { reviewProof: adverse } }).reviewProof, adverse);
});

const spec = (body, capability = "fixture") => `---\nmetadata_version: 1\nartifact: spec\ncapability: ${capability}\n---\n# Fixture\n\n## Requirements\n\n${body}\n`;
test("finish promotion matches native add, modify, remove and rename and validates current spec identity", () => {
  const delta = "# Delta\n\n## RENAMED Requirements\n\n- FROM: `### Requirement: Before`\n- TO: `### Requirement: After`\n" +
    "\n## ADDED Requirements\n\n### Requirement: New\nIt SHALL be new.\n" +
    "\n## MODIFIED Requirements\n\n### Requirement: Retained\nIt SHALL change.\n" +
    "\n## REMOVED Requirements\n\n### Requirement: Obsolete\n**Reason**: No longer used.\n";
  const previous = spec("### Requirement: Before\nIt SHALL work.\n\n### Requirement: Obsolete\nLegacy.\n");
  const current = spec("### Requirement: After\nIt SHALL work.\n\n### Requirement: New\nIt SHALL be new.\n\n### Requirement: Retained\nIt SHALL change.");
  const request = { capability: "fixture", delta, current, previous };
  assert.equal(checkPromotion(request), 4);
  assert.throws(() => checkPromotion({ ...request, current: current.replace("capability: fixture", "capability: other") }), /identity metadata/);
  assert.throws(() => checkPromotion({ ...request, current: current.replace("It SHALL change.", "It MAY change.") }), /Retained.*differs/);
  assert.throws(() => checkPromotion({ ...request, current: current + "\n### Requirement: Obsolete\nStill exists." }), /Obsolete still exists/);
  assert.throws(() => checkPromotion({ ...request, current: current.replace("It SHALL work.", "It MAY work.") }), /After differs/);
  assert.throws(() => checkPromotion({ ...request, current: current.replace("## Requirements", "```md\n### Requirement: New\nIt SHALL be new.\n```\n\n## Requirements")
    .replace("### Requirement: New\nIt SHALL be new.\n\n### Requirement: Retained", "### Requirement: Retained") }),
    /New is missing/);
});
