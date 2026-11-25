import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { readLowTouchPolicy, reviewAuthority } from "../skills/software-development/openspec-delivery/scripts/low-touch-policy.mjs";
import { claimReviewRun, reviewSpendScope } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-spend.mjs";
import { checkPacketTurns, reviewClock } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-preflight.mjs";
import { classifyUpstream } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-upstream-status.mjs";
import { admitReceipt, reviewPrompt } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-admission.mjs";

const optIn = (fields) => readLowTouchPolicy(`<!-- openspec-low-touch: ${JSON.stringify(fields)} -->`);
const digest = "a".repeat(64);
const sha = "b".repeat(40);
const scope = (attempt, phase = "execution", amount = 2_000_000, target = sha) => ({
  change: "fixture-low-touch", phase, purpose: "candidate", target, requestSha256: digest,
  exportSha256: digest, configurationSha256: digest, attempt, scopeSha256: digest, upperUsdMicros: amount, invocations: 2,
});
const grant = (kind, reference, binding) => ({ kind, reference, ...binding, verified: true, runs: 1 });

test("verified policy defaults, phase ceilings and explicit override stay bounded", async () => {
  const phases = ["planning", "execution", "finish"];
  const policy = optIn({});
  assert.deepEqual(policy, { mode: "auto-approved", maxReviews: 10, maxTotalUsd: 25, phases, standingTriggers: [] });
  for (const phase of phases) assert.deepEqual(reviewAuthority(policy, { phase }),
    { mode: "auto-approved", maxReviews: 10, maxTotalUsd: 25, limitMicros: 25_000_000 });
  assert.deepEqual(reviewAuthority(policy, { phase: "execution", mode: "explicit" }), { mode: "explicit" });
  assert.equal(reviewAuthority(null, { phase: "execution" }).mode, "explicit");
  assert.equal(reviewAuthority(optIn({ mode: "explicit" }), { phase: "execution" }).mode, "explicit");
  const phaseError = { message: "Review phase is outside the integrated phase allowlist" };
  assert.throws(() => reviewAuthority(optIn({ mode: "explicit", phases: ["planning"] }), { phase: "execution" }), phaseError);
  assert.throws(() => reviewAuthority(optIn({ phases: ["planning"] }), { mode: "explicit", phase: "finish" }), phaseError);
  assert.deepEqual(reviewAuthority(optIn({ phases: ["planning"] }), { mode: "explicit", phase: "planning" }), { mode: "explicit" });
  assert.throws(() => reviewAuthority(optIn({ phases: ["planning"] }), { phase: "finish" }), /phase/);
  assert.throws(() => reviewAuthority(policy, { phase: "finish", caps: { maxReviews: 11 } }), /ceiling/);
  assert.throws(() => reviewAuthority(policy, { phase: "finish", caps: { maxTotalUsd: 25.001 } }), /ceiling/);
  assert.throws(() => reviewAuthority(policy, { phase: "finish", caps: { maxTotalUsd: 0.0000001 } }), /USD/);
  assert.throws(() => reviewAuthority(policy, { phase: "finish", caps: null }), /caps/);
  assert.equal(reviewAuthority(policy, { phase: "finish", caps: { maxReviews: 3, maxTotalUsd: 1.25 } }).limitMicros, 1_250_000);
  assert.equal(reviewAuthority(optIn({ maxReviews: 20, maxTotalUsd: 50 }), { phase: "execution" }).maxReviews, 10);
  assert.throws(() => readLowTouchPolicy('<!-- openspec-low-touch: {"mode":"explicit","mode":"auto-approved"} -->'), /Duplicate/);
  assert.throws(() => optIn({ maxReviews: 0 }), /ceiling/);
  assert.equal(readLowTouchPolicy("```md\n<!-- openspec-low-touch: {} -->\n```"), null);
  for (const file of ["planning-inventory.mjs", "low-touch-policy.mjs", "harness-result.mjs"]) {
    const delivery = new URL(`../skills/software-development/openspec-delivery/scripts/${file}`, import.meta.url);
    const reviewer = new URL(`../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/${file}`, import.meta.url);
    assert.deepEqual(await readFile(delivery), await readFile(reviewer), file);
  }
});

test("review cost includes all packets and probe, and a durable per-change claim rejects replay and excess", async (t) => {
  const root = await mkdtemp("/tmp/ls-");
  t.after(() => rm(root, { recursive: true, force: true }));
  const policy = reviewAuthority(optIn({ maxReviews: 2, maxTotalUsd: 5 }), { phase: "execution" });
  const one = scope("first", "planning", 3_000_000);
  const two = scope("second", "execution", 2_000_000, "c".repeat(40));
  const req = { root, excluded: [], policy };
  const concurrent = await Promise.allSettled([
    claimReviewRun({ ...req, scope: one }), claimReviewRun({ ...req, scope: one }),
  ]);
  assert.equal(concurrent.filter(({ status }) => status === "fulfilled").length, 1);
  const first = concurrent.find(({ status }) => status === "fulfilled").value;
  assert.equal(JSON.parse(await readFile(first.file)).upperUsdMicros, 3_000_000);
  await assert.rejects(claimReviewRun({ ...req, scope: one }), /redeemed/);
  await assert.rejects(claimReviewRun({ ...req, scope: { ...one, attempt: "retry", phase: "finish" } }), /grant/);
  await assert.rejects(claimReviewRun({ ...req, scope: { ...two, upperUsdMicros: 2_000_001 } }), /cost cap/);
  const later = await claimReviewRun({ ...req, scope: two });
  assert.equal(later.mode, "auto-approved");
  await assert.rejects(claimReviewRun({ ...req, scope: scope("over-count", "finish", 1, "d".repeat(40)) }), /count or cost/);
  const explicit = scope("explicit", "finish", 8_000_000, "e".repeat(40));
  const explicitPolicy = { mode: "explicit" };
  await assert.rejects(claimReviewRun({ ...req, scope: explicit, policy: explicitPolicy }), /grant/);
  const approved = grant("contained-review-single-run", "operator:explicit", explicit);
  assert.equal((await claimReviewRun({ ...req, scope: explicit, policy: explicitPolicy, explicitGrant: approved })).mode, "explicit");
  const retry = { ...explicit, attempt: "explicit-retry" };
  await assert.rejects(claimReviewRun({ ...req, scope: retry, policy: explicitPolicy }), /grant/);
  assert.equal((await claimReviewRun({ ...req, scope: retry, policy: explicitPolicy,
    explicitGrant: grant("contained-review-single-run", "operator:explicit-2", retry),
    retryGrant: grant("contained-review-retry", "operator:retry", retry) })).mode, "explicit");

  const input = { mode: "candidate", snapshot: { target: sha }, worker: { identity: { change: "fixture-low-touch", attempt: "new" },
    authority: {}, scope: ["code"], acceptance: ["Pass"], nonGoals: [] } };
  const calculated = reviewSpendScope(input, { requestSha256: digest, exportSha256: digest, configurationSha256: digest },
    { manifest: { packets: [{}, {}, {}] } }, { maxBudgetUsd: 0.65 }, { phase: "execution" });
  assert.equal(calculated.upperUsdMicros, 2_600_000);
  assert.equal(calculated.invocations, 4);
});

test("pacing uses the same run deadline and cancellation, and upstream diagnostics expose status classes only", async () => {
  const config = { timeoutMs: 1000, runTimeoutMs: 1000, interPacketDelayMs: 100 };
  let now = 10;
  const timers = [];
  const signal = new AbortController();
  const clock = reviewClock(config, 3, { signal: signal.signal, now: () => now, wait: async (ms) => { timers.push(ms); now += ms; } });
  assert.equal(await clock.next(0), true);
  assert.deepEqual(timers, []);
  assert.equal(await clock.next(1), true);
  assert.deepEqual(timers, [100]);
  now = 950;
  assert.equal(await clock.next(2), false);
  assert.deepEqual(timers, [100]);
  signal.abort();
  await assert.rejects(clock.next(2), /abort/i);
  assert.deepEqual([429, 529, 401, 403, 500, "429"].map(classifyUpstream),
    ["upstream-rate-limited", "upstream-overloaded", "upstream-auth-failed", "upstream-auth-failed", null, null]);
  const prepared = { manifest: { packets: [{ paths: ["a", "b", "c"] }, { paths: ["a", "b", "c", "d"] }] } };
  assert.doesNotThrow(() => checkPacketTurns(prepared, 14));
  assert.throws(() => checkPacketTurns(prepared, 13), /Packet 2.*maxTurns 13/);
  const oneFile = { manifest: { packets: [{ paths: ["a"] }] } };
  assert.throws(() => checkPacketTurns(oneFile, 10), {
    message: "maxTurns must be at least 11 to leave a 10-turn reserve for at least 1 whole-file read",
  });
  assert.doesNotThrow(() => checkPacketTurns(oneFile, 11));
  assert.throws(() => checkPacketTurns(prepared, undefined), /maxTurns/);
});

test("only criteria and canonical finding paths belonging to a packet are admitted", () => {
  const request = { mode: "candidate", fileAcceptance: [
    { packet: 1, path: "src/a.js", criterion: "Confirm criterion Alpha" },
    { packet: 2, path: "src/b.js", criterion: "Confirm criterion Beta" },
  ] };
  const context = { target: sha };
  const packet = { paths: ["target/src/a.js"] };
  const prompt = reviewPrompt(request, context, packet, 0, 2, "report");
  assert.match(prompt, /canonical repository-relative/);
  assert.match(prompt, /criterion Alpha/);
  assert.doesNotMatch(prompt, /criterion Beta/);
  const finding = (path) => `Verdict: Findings\nTarget: ${sha}\n` + JSON.stringify({ target: sha, packet: 1, coverageLimitations: [],
    findings: [{ path, line: 1, severity: "high", impact: "fixture", trigger: "fixture", remedy: "fixture" }] });
  assert.equal(admitReceipt(request, context, finding("src/a.js"), 0, "report", packet).findings[0].path, "src/a.js");
  for (const invalid of ["/review/target/src/a.js", "src/../src/a.js", "src/b.js", "target/src/a.js"]) {
    assert.throws(() => admitReceipt(request, context, finding(invalid), 0, "report", packet), /finding/i);
  }
});
