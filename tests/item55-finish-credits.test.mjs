import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fixtureTest as test } from "./test-shards.mjs";
import { standingTriggerDecision } from "../skills/software-development/openspec-delivery/scripts/external-verification.mjs";
import { finishCreditDecision, finishCreditGrant, finishCreditJournal, paidFinishTrigger,
  settleFinishCredit, zeroCostRetryTrigger } from "../skills/software-development/openspec-delivery/scripts/finish-trigger-credits.mjs";

const run = promisify(execFile);
const now = Date.parse("2026-11-26T06:00:30.000Z");
const iso = (n) => new Date(n).toISOString();
const verified = (reference, fields = {}) => ({ reference, verified: true, observedAt: iso(now), ...fields });
const identity = { repository: "fixture/source", target: "main", candidate: "a".repeat(40) };
const configurationSha256 = "b".repeat(64);
const scope = (chapter, id, costUsd) => ({ chapter, id, costUsd, target: identity.target, configurationSha256, exposure: "source" });
const impl = scope("implementation", "aikido:42:deep-review", 1);
const closure = scope("closure", impl.id, 1);
const retry = scope("implementation", "github-actions:42:ci", 0);
const finish = { identity, reference: "operator:finish", startedAt: iso(now - 10_000), deadline: iso(now + 60_000) };
const grant = finishCreditGrant(verified("operator:finish-credit", {
  schemaVersion: 1, kind: "protected-finish-trigger-grant", finishReference: finish.reference, identity,
  startedAt: iso(now - 1_000), deadline: finish.deadline, maxDeepReviewCredits: 2, maxZeroCostCiRetries: 1,
  deepReview: [impl, closure], retry,
}), { identity, observedAt: iso(now) }, finish);
const grantSha = "c".repeat(64);
const readbackSha = "d".repeat(64);

function inventory(selected, event, candidate = identity.candidate) {
  const { chapter, ...fields } = selected;
  const kind = event === "retry" ? "repository-check" : "app-trigger";
  const entry = { ...fields, event, kind, repository: identity.repository, installation: "42", verified: true };
  const live = { ...selected, event, kind, repository: identity.repository, candidate };
  entry.providerProof = verified("provider", { installation: "42", scope: live, ...(event === "retry" ?
    { source: "provider-workflow-and-billing", provider: "github-actions", product: "repository-ci" } :
    { source: "provider-installation-and-billing", provider: "aikido", product: "deep-review", unit: "credits", credits: 1 }) });
  return { candidate, chapter, event, repository: identity.repository, target: identity.target, finishReference: finish.reference,
    policy: { standingTriggers: [] }, strictInventory: true, notBefore: now - 1000, now,
    observed: verified("inventory", { complete: true, candidate, repository: identity.repository, event, target: identity.target, triggers: [entry] }),
    pushGrant: verified("event-grant", { candidate, target: identity.repository, targetRef: identity.target, event, finishReference: finish.reference }),
  };
}
const checkPaid = (observed, extra = {}) => standingTriggerDecision({ ...observed, bundledTrigger: (entry, context) =>
  paidFinishTrigger(entry, { ...context, grant, chapter: observed.chapter, candidate: observed.candidate, ...extra }) });

function journalFixture(t) {
  const records = realpathSync(mkdtempSync(path.join(os.tmpdir(), "finish-credits-")));
  t.after(() => rmSync(records, { recursive: true, force: true }));
  return { records, read: (override = grant) => ({ grant: override, journal: finishCreditJournal(records, finish, grantSha) }) };
}
const decision = (observation, match, action = "publish-ready") =>
  ({ action, chapter: observation.chapter, head: observation.candidate, triggerInventories: [match] });
const selection = ({ action, chapter, head }) => ({ reference: grant.reference, chapter, operation: action, head, readbackSha256: readbackSha });
const outcome = (reservation, state) => verified("provider-outcome", { kind: "finish-trigger-outcome", state,
  grantReference: grant.reference, reservationSha256: reservation.sha256,
  scope: { chapter: reservation.chapter, operation: reservation.operation, head: reservation.head, readbackSha256: readbackSha } });

test("bundled finish inventory requires independent current exact paid provider, cost and chapter evidence", () => {
  const mutate = [
    (value) => { value.observed.complete = false; },
    (value) => { value.observed.observedAt = iso(now - 61_000); },
    (value) => { value.observed.repository = "other/source"; },
    (value) => { value.observed.target = "other"; },
    (value) => { value.observed.candidate = "f".repeat(40); },
    (value) => { value.pushGrant.targetRef = "other"; },
    (value, entry) => { entry.providerProof.scope.chapter = "closure"; },
    (value, entry) => { entry.providerProof.scope.candidate = "f".repeat(40); },
    (value, entry) => { entry.providerProof.scope.configurationSha256 = "f".repeat(64); },
    (value, entry) => { entry.providerProof.scope.exposure = "another-exposure"; },
    (value, entry) => { entry.providerProof.scope.costUsd = 2; },
    (value, entry) => { entry.providerProof.reference = value.observed.reference; },
    (value, entry) => { entry.providerProof.observedAt = iso(now - 61_000); },
    (value, entry) => { entry.providerProof.product = "pr-security"; },
    (value, entry) => { entry.providerProof.credits = 0; },
    (value, entry) => { entry.providerProof.installation = "99"; },
    (value, entry) => { entry.costUsd = null; },
    (value, entry) => { value.observed.triggers.push({ ...entry, id: "undisclosed", kind: "unknown" }); },
  ];
  assert.equal(checkPaid(inventory(impl, "pull_request")).bundle[0].credits, 1);
  for (const alter of mutate) {
    const value = inventory(impl, "pull_request");
    alter(value, value.observed.triggers[0]);
    assert.notEqual(checkPaid(value).action, "proceed", alter.toString());
  }
  assert.notEqual(checkPaid(inventory(impl, "push")).action, "proceed");
  assert.notEqual(checkPaid(inventory(impl, "pull_request"), { chapter: "closure" }).action, "proceed");
});

test("one named finish cap covers two chapter heads and persists consumption across reopens", (t) => {
  const { read, records } = journalFixture(t);
  const a = inventory(impl, "pull_request");
  const b = inventory(closure, "pull_request", "e".repeat(40));
  const first = decision(a, checkPaid(a));
  const second = decision(b, checkPaid(b));
  assert.equal(finishCreditDecision(read(), first, readbackSha, null, now).reason, "FINISH_TRIGGER_RESERVATION_REQUIRED");
  assert.equal(finishCreditDecision(read(), first, readbackSha, selection(second), now).reason, "FINISH_TRIGGER_SELECTION_UNVERIFIED");
  const { finishTriggerReservation: reservation } = finishCreditDecision(read(), first, readbackSha, selection(first), now);
  assert.equal(read().journal.pending.sha256, reservation.sha256);
  assert.equal(settleFinishCredit(read(), { ...outcome(reservation, "consumed"), grantReference: "different" }, readbackSha, now).reason,
    "FINISH_TRIGGER_OUTCOME_UNVERIFIED");
  assert.equal(settleFinishCredit(read(), outcome(reservation, "consumed"), readbackSha, now).action, "finish-trigger-settled");
  assert.equal(finishCreditDecision(read(), first, readbackSha, selection(first), now).reason, "FINISH_TRIGGER_ALREADY_RESERVED");
  assert.throws(() => finishCreditJournal(records, finish, null), /journal identity changed/);
  assert.equal(finishCreditDecision(read({ ...grant, maxDeepReviewCredits: 1 }), second, readbackSha, selection(second), now).reason,
    "FINISH_TRIGGER_CAP_OR_DEADLINE");
  const next = finishCreditDecision(read(), second, readbackSha, selection(second), now).finishTriggerReservation;
  assert.equal(next.head, b.candidate);
  assert.equal(settleFinishCredit(read(), outcome(next, "uncertain"), readbackSha, now).finishTriggerOutcome.state, "uncertain");
  assert.equal(read().journal.pending.outcome.state, "uncertain");
});

test("competing finish journal writers cannot reserve the same sequence slot", async (t) => {
  const { records, read } = journalFixture(t);
  const module = new URL("../skills/software-development/openspec-delivery/scripts/finish-trigger-credits.mjs", import.meta.url).href;
  const code = `import { finishCreditJournal } from ${JSON.stringify(module)};
    const [records, finish, grant, reservation] = JSON.parse(process.argv[1]);
    const journal = finishCreditJournal(records, finish, grant);
    process.exitCode = !journal.pending && journal.append(reservation) ? 0 : 42;`;
  const payload = JSON.stringify([records, finish, grantSha,
    { ...selection({ action: "publish-ready", chapter: "implementation", head: identity.candidate }), state: "reserved", at: iso(now), triggers: [] }]);
  const results = await Promise.allSettled(Array.from({ length: 6 }, () =>
    run(process.execPath, ["--input-type=module", "-e", code, payload], { env: { PATH: "/usr/bin:/bin", LC_ALL: "C" } })));
  assert.equal(results.filter(({ status }) => status === "fulfilled").length, 1, JSON.stringify(results));
  assert.ok(results.filter(({ status }) => status === "rejected").every(({ reason }) => reason.code === 42));
  assert.equal(read().journal.reservations.length, 1);
  assert.equal(read().journal.pending.state, "reserved");
});

test("zero-cost retry requires matching infrastructure failure and passed equivalent identical-SHA push", () => {
  const observation = inventory(retry, "retry");
  const pr = "https://github.com/fixture/source/pull/1";
  const common = { source: "github-actions", repository: identity.repository, head: identity.candidate, id: retry.id,
    configurationSha256, workflow: "ci.yml", executionSha256: "9".repeat(64) };
  const failure = verified("pr-run", { ...common, event: "pull_request", pullRequest: pr, runId: "101",
    attempt: 1, state: "failed", classification: "runner-lost", testFailure: false });
  const push = verified("push-run", { ...common, event: "push", runId: "102", equivalent: true, state: "passed" });
  const check = (f, p, failedCheck = { id: retry.id, runId: "101", attempt: 1 }) => standingTriggerDecision({
    ...observation, bundledTrigger: (entry, context) => zeroCostRetryTrigger(entry, {
      ...context, grant, chapter: observation.chapter, candidate: observation.candidate, pr, failedCheck,
      checksReference: "checks", retryEvidence: { failure: f, push: p },
    }),
  });
  assert.equal(check(failure, push).bundle[0].runId, "101");
  for (const change of [{ classification: "test-failed" }, { testFailure: true }, { attempt: 2 },
    { pullRequest: pr + "0" }, { reference: "checks" }, { observedAt: iso(now - 61_000) }]) {
    assert.notEqual(check({ ...failure, ...change }, push).action, "proceed");
  }
  for (const change of [{ head: "e".repeat(40) }, { state: "failed" }, { executionSha256: "8".repeat(64) },
    { event: "pull_request" }, { workflow: "other.yml" }, { equivalent: false }]) {
    assert.notEqual(check(failure, { ...push, ...change }).action, "proceed");
  }
  assert.notEqual(check(failure, push, { id: retry.id, runId: "other", attempt: 1 }).action, "proceed");
});
