import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { readFile, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { readLowTouchPolicy, reviewAuthority } from "../skills/software-development/openspec-delivery/scripts/low-touch-policy.mjs";
import { checkReviewSpend, claimReviewRun, reviewSpendScope } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-spend.mjs";
import { hash, jsonBytes } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-inputs.mjs";
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
  for (const [packets, fullCost] of [[6, 17_500_000], [7, 20_000_000]]) {
    assert.equal(reviewSpendScope(input, { configurationSha256: digest },
      { manifest: { packets: Array(packets).fill({}) } }, { maxBudgetUsd: 2.50 }, { phase: "execution" }).upperUsdMicros, fullCost);
  }
});

async function extensionFixture(t) {
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2030-01-01T00:01:00.000Z") });
  const root = await mkdtemp("/tmp/review-extension-");
  t.after(() => rm(root, { recursive: true, force: true }));
  const ledger = await mkdtemp(path.join(root, "ledger-"));
  const plan = { change: scope("initial").change, plan: sha, planDigest: digest, policyRevision: sha,
    approvalReference: "operator:approval", executionReference: "operator:execution" };
  const baseCaps = { maxReviews: 1, maxTotalUsd: 5 };
  const policy = optIn({});
  const lowered = reviewAuthority(policy, { phase: "planning", caps: baseCaps });
  const initial = await claimReviewRun({ root: ledger, excluded: [], policy: lowered, scope: scope("initial", "planning", 4_000_000) });
  const original = await readFile(initial.file);
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const key = path.join(root, "operator-key.json");
  const keyBytes = jsonBytes({ publicKey: publicKey.export({ format: "der", type: "spki" }).toString("base64") });
  await writeFile(key, keyBytes, { mode: 0o600 });
  const admission = path.join(root, "admission.json");
  const record = path.join(root, "extension.json");
  const check = async (attempt, options = {}) => {
    const { withGrant = false, withKey = true, caps = baseCaps, currentPlan = plan, currentLedger = ledger,
      maxBudgetUsd = 2.50 } = options;
    await writeFile(admission, jsonBytes({ schemaVersion: 1, configurationSha256: digest, ledger: currentLedger,
      phase: "execution", caps, phaseGrant: { kind: "contained-review-phase", verified: true, reference: "phase:fixture",
        change: currentPlan.change, phase: "execution", policyRevision: currentPlan.policyRevision,
        requestSha256: digest, authorityReference: currentPlan.executionReference } }), { mode: 0o600 });
    return checkReviewSpend({ file: admission, policy, request: { mode: "candidate",
      snapshot: { target: hash(attempt).slice(0, 40) }, policy: { parent: currentPlan.policyRevision },
      worker: { identity: { ...currentPlan, attempt }, authority: currentPlan, scope: [], acceptance: [], nonGoals: [] } },
    expect: { requestSha256: digest, exportSha256: digest, configurationSha256: digest },
    prepared: { manifest: { packets: [{}] } }, config: { maxBudgetUsd }, excluded: [],
    extensionFiles: withKey ? { key, sha256: options.keySha256 ?? hash(keyBytes), record: withGrant ? record : undefined } : undefined });
  };
  const { ledgerIdentity } = await check("inspect");
  const make = (fields = {}, signer = privateKey) => {
    const grant = { ...plan, schemaVersion: 1, kind: "review-budget-extension", reference: "operator:raise",
      ledgerIdentity, baseCaps, caps: { maxReviews: 3, maxTotalUsd: 14 },
      validFrom: "2030-01-01T00:00:00.000Z", expiresAt: "2030-01-01T00:02:00.000Z", ...fields };
    return { grant, signature: sign(null, jsonBytes(grant), signer).toString("base64") };
  };
  const save = (envelope) => writeFile(record, jsonBytes(envelope), { mode: 0o600 });
  const submit = async (attempt) => claimReviewRun(await check(attempt, { withGrant: true }));
  return { root, ledger, initial, original, baseCaps, plan, keyBytes, check, make, save, submit };
}

test("signed review extension is prospective, retains holds and expires without losing replay evidence", async (t) => {
  const f = await extensionFixture(t);
  await assert.rejects(claimReviewRun(await f.check("no-extension")), /cost cap exceeded/);
  await f.save(f.make());
  const accepted = await f.submit("first-extension-use");
  assert.equal(JSON.parse(await readFile(accepted.file)).upperUsdMicros, 5_000_000);
  await assert.rejects(f.submit("replay"), /already consumed/);
  await assert.rejects(claimReviewRun(await f.check("no-key", { withKey: false })), /cost cap exceeded/);
  await assert.rejects(claimReviewRun(await f.check("unsigned-increase", { caps: { maxReviews: 4, maxTotalUsd: 25 } })),
    /retained signed base/);
  await claimReviewRun(await f.check("later-with-key"));
  await assert.rejects(claimReviewRun(await f.check("over-spend")), /cost cap exceeded/);
  assert.deepEqual(await readFile(f.initial.file), f.original);

  t.mock.timers.setTime(Date.parse("2030-01-01T00:02:00.000Z"));
  await assert.rejects(claimReviewRun(await f.check("expired-retention")), /cost cap exceeded/);
  await f.save(f.make({ expiresAt: "2030-01-01T00:03:00.000Z" }));
  await assert.rejects(f.submit("renew-reference"), /already consumed/);
  await f.save(f.make({ reference: "operator:small-renewal", expiresAt: "2030-01-01T00:03:00.000Z", caps: { maxReviews: 4, maxTotalUsd: 18 } }));
  await assert.rejects(f.submit("old-holds-still-count"), /cost cap exceeded/);
  await f.save(f.make({ reference: "operator:renewal", expiresAt: "2030-01-01T00:03:00.000Z", caps: { maxReviews: 4, maxTotalUsd: 19 } }));
  await f.submit("renewed");
  assert.equal((await readdir(path.dirname(f.initial.file))).filter((name) => name.startsWith("extension-")).length, 2);
});

test("signed review extension rejects bad keys, tampering, mismatched identity, stale and over-ceiling grants", async (t) => {
  const f = await extensionFixture(t);
  const other = generateKeyPairSync("ed25519");
  await f.save(f.make({}, other.privateKey));
  await assert.rejects(f.submit("wrong-key"), /signature/);
  await assert.rejects(f.check("wrong-pin", { withGrant: true, keySha256: digest }), /key pin mismatch/);
  const tampered = f.make();
  tampered.grant.caps.maxTotalUsd = 25;
  await f.save(tampered);
  await assert.rejects(f.submit("tampered"), /signature/);
  for (const mismatch of [{ plan: "c".repeat(40) }, { planDigest: "c".repeat(64) }, { ledgerIdentity: digest },
    { change: "different-change" }, { approvalReference: "different-approval" }, { executionReference: "different-execution" },
    { policyRevision: "c".repeat(40) }, { baseCaps: { ...f.baseCaps, maxTotalUsd: 4 } }]) {
    await f.save(f.make(mismatch));
    await assert.rejects(f.submit("mismatch"), /exact plan, ledger or applicable base caps/);
  }
  const emptyLedger = await mkdtemp(path.join(f.root, "empty-"));
  await f.save(f.make());
  await assert.rejects(f.check("other-ledger", { withGrant: true, currentLedger: emptyLedger }), /ENOENT/);
  await claimReviewRun({ root: emptyLedger, excluded: [], policy: { mode: "auto-approved", maxReviews: 1, limitMicros: 5_000_000 },
    scope: scope("other-ledger-seed") });
  await assert.rejects(f.check("other-existing-ledger", { withGrant: true, currentLedger: emptyLedger }),
    /exact plan, ledger or applicable base caps/);
  for (const fields of [{ caps: { maxReviews: 11 } }, { caps: { maxTotalUsd: 25.000001 } }]) {
    await f.save(f.make(fields));
    await assert.rejects(f.submit("over-ceiling"), /integrated ceilings/);
  }
  await f.save(f.make({ validFrom: "2030-01-01T00:01:30.000Z" }));
  await assert.rejects(f.submit("future"), /not yet valid/);
  await f.save(f.make({ expiresAt: "2030-01-01T00:01:00.000Z" }));
  await assert.rejects(f.submit("expired"), /expired/);
  assert.equal((await readdir(path.dirname(f.initial.file))).length, 1);
  await f.save(f.make());
  await f.submit("valid");
  await f.save(f.make({ reference: "operator:stale", caps: { maxReviews: 2, maxTotalUsd: 13 } }));
  await assert.rejects(f.submit("stale"), /stale/);
  await assert.rejects(claimReviewRun(await f.check("cross-plan-readback", { currentPlan: { ...f.plan, plan: "c".repeat(40) } })),
    /cost cap exceeded/);
});

test("a count-only extension leaves the original USD cap in force", async (t) => {
  const f = await extensionFixture(t);
  await f.save(f.make({ caps: { maxReviews: 2 } }));
  await assert.rejects(f.submit("price-exceeded"), /cost cap exceeded/);
  const admitted = await claimReviewRun(await f.check("count-only", { withGrant: true, maxBudgetUsd: 0.5 }));
  assert.equal(JSON.parse(await readFile(admitted.file)).upperUsdMicros, 1_000_000);
});

test("competing extension and reservation claims serialize without releasing the prior charge", async (t) => {
  const f = await extensionFixture(t);
  await f.save(f.make({ caps: { maxReviews: 2, maxTotalUsd: 9 } }));
  const first = await f.check("first", { withGrant: true });
  const second = await f.check("second", { withGrant: true });
  const ordinary = await f.check("ordinary");
  const competing = await Promise.allSettled([first, second, ordinary].map(claimReviewRun));
  const admitted = competing.filter(({ status }) => status === "fulfilled").length;
  assert.ok(admitted <= 1);
  assert.ok(competing.filter(({ status }) => status === "rejected")
    .every(({ reason }) => /busy or unsettled|cost cap exceeded|already consumed/.test(reason.message)));
  // A plain claim may acquire the lock first and fail against the lower cap.
  if (!admitted) await claimReviewRun(first);
  await assert.rejects(claimReviewRun(second), /already redeemed|already consumed/);
  await assert.rejects(claimReviewRun(ordinary), /cost cap exceeded/);
  assert.equal((await readdir(path.dirname(f.initial.file))).length, 3);
  assert.deepEqual(await readFile(f.initial.file), f.original);
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
