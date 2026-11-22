import test from 'node:test';
import assert from 'node:assert/strict';
import { startConvergenceReview, convergencePacket, acceptConvergenceReview } from '../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/orchestration-core.mjs';

const change = 'example-change';
const inputs = { 'openspec/config.yaml': 'a'.repeat(64), [`openspec/changes/${change}/.openspec.yaml`]: 'b'.repeat(64), [`openspec/changes/${change}/proposal.md`]: 'c'.repeat(64), [`openspec/changes/${change}/tasks.md`]: 'd'.repeat(64) };
const charter = { clauses: ['goal', 'authority'], boundaries: ['execution'], tasks: ['1.1'], gates: ['test'] };
const binding = { route: 'terminal-adapter', qualified: true, independent: true, readOnly: true, client: 'codex', model: 'model', permissions: ['read'] };
const start = () => startConvergenceReview({ change, goal: 'goal', charter, binding, passRule: 'charter-v1', budget: 3 });
const packetHashes = { evidence: 'f'.repeat(64) };
const packet = (record, session = 'review-1') => convergencePacket({ record, inputs, packetHashes, authorSession: 'author', reviewerSession: session });
const receipt = (p, overrides = {}) => ({ identity: p.identity, readOnly: true, reference: 'receipt-' + p.identity.reviewerSession, verdict: 'Verdict: No findings', findings: [], observations: [], coverageLimitations: [], ledgerChecks: [], ...overrides });
const accept = (record, p, review = receipt(p), currentInputs = inputs) => acceptConvergenceReview({ record, packet: p, review, currentInputs, currentPacketHashes: packetHashes, recordIntegrityVerified: true });
const finding = (id, severity = 'Medium') => ({ id, severity, path: 'proposal.md', line: 1, impact: 'impact', trigger: 'trigger', remedy: 'remedy', clause: 'goal' });

test('binding is admitted before review and first record starts at zero', () => {
  for (const b of [{ ...binding, route: 'subagent' }, { ...binding, route: 'unknown' }, { ...binding, permissions: ['read', 'write'] }, { ...binding, qualified: false }, { ...binding, client: 'not-a-qualified-client' }, { ...binding, client: 'opencode' }]) assert.throws(() => startConvergenceReview({ change, goal: 'goal', charter, binding: b, passRule: 'charter-v1', budget: 3 }));
  const r = start(); assert.equal(r.cumulativeCycles, 0); assert.deepEqual(r.entries, []); assert.deepEqual(r.ledger, []);
});

test('complete identity and fresh session are required', () => {
  const r = start(), p = packet(r);
  for (const review of [receipt(p, { identity: { ...p.identity, model: 'other' } }), receipt(p, { identity: { ...p.identity, inputs: {} } }), receipt(p, { readOnly: false })]) assert.throws(() => accept(r, p, review));
  assert.throws(() => accept(r, p, receipt(p), { ...inputs, 'openspec/config.yaml': 'e'.repeat(64) }));
  const result = accept(r, p); assert.equal(result.action, 'freeze-ready'); assert.equal(result.planApproved, false); assert.equal(result.executionAuthorized, false);
  assert.throws(() => packet(result.record));
});

test('ledger preserves severity and requires explicit checks and dispositions', () => {
  let r = start(), p = packet(r);
  r = accept(r, p, receipt(p, { verdict: 'Verdict: Findings', findings: [finding('F1')] })).record;
  p = packet(r, 'review-2');
  assert.throws(() => accept(r, p));
  let out = accept(r, p, receipt(p, { ledgerChecks: [{ id: 'F1', status: 'persistent' }] }));
  assert.equal(out.action, 'blocked'); assert.equal(out.record.ledger[0].severity, 'Medium');
  assert.throws(() => accept(r, p, receipt(p, { ledgerChecks: [{ id: 'F1', status: 'resolved', disposition: 'applied', evidence: 'fixed' }] })));
  out = accept(r, p, receipt(p, { ledgerChecks: [{ id: 'F1', status: 'resolved', disposition: 'applied', evidence: 'fixed', reReviewReference: 'receipt-review-2' }] }));
  assert.equal(out.action, 'freeze-ready'); assert.equal(out.record.ledger[0].severity, 'Medium'); assert.equal(out.record.ledger[0].dispositions[0].reReviewReference, 'receipt-review-2');
});

test('severity, scope, verdict and all limitation classes are enforced', () => {
  const r = start(), p = packet(r);
  const run = (x) => accept(r, p, receipt(p, x));
  assert.equal(run({ verdict: 'Verdict: Findings', findings: [finding('L', 'Low')] }).action, 'freeze-ready');
  assert.equal(run({ verdict: 'Verdict: Findings', findings: [finding('H', 'High')] }).action, 'blocked');
  assert.equal(run({ observations: [{ ...finding('O', 'High'), clause: null, scopeDisposition: 'outside-charter' }] }).action, 'freeze-ready');
  assert.throws(() => run({ findings: [finding('L', 'Low')] }));
  for (const l of [{ class: 'declared-deferral', task: '1.1' }, { class: 'declared-deferral', gate: 'test' }, { class: 'containment-boundary', boundary: 'execution' }]) assert.equal(run({ coverageLimitations: [l] }).action, 'freeze-ready');
  for (const l of [{ class: 'declared-deferral', task: 'missing' }, { class: 'containment-boundary', boundary: 'missing' }, { class: 'unclassified' }]) assert.equal(run({ coverageLimitations: [l] }).action, 'blocked');
});

test('one packet-only re-review per snapshot preserves cycle and inputs', () => {
  let r = start(), p = packet(r);
  let out = accept(r, p, receipt(p, { coverageLimitations: [{ class: 'packet-gap', detail: 'missing evidence' }] }));
  assert.equal(out.action, 'repair-packet'); assert.equal(out.record.cumulativeCycles, 0);
  r = out.record; p = packet(r, 'review-2');
  assert.equal(accept(r, p).action, 'freeze-ready');
  out = accept(r, p, receipt(p, { coverageLimitations: [{ class: 'packet-gap', detail: 'still missing' }] }));
  assert.equal(out.action, 'blocked'); assert.equal(out.record.cumulativeCycles, 0); assert.deepEqual(out.record.entries[1].inputs, inputs);
  assert.throws(() => packet(out.record, 'review-2'));
  assert.throws(() => packet(out.record, 'review-3'), /packet/i);
});

test('bounded loop decisions preserve authority, retry and correction boundaries', async () => {
  const { convergenceDecision } = await import('../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/orchestration-core.mjs');
  const record = start();
  const base = { record, authority: { reference: 'grant', write: true, validate: true, review: true }, preflight: true, launchFailures: 0, repeated: false, contradictory: false, drift: false, validation: 'pass', finding: { id: 'F', classification: 'routine', inputs, paths: ['proposal'], evidence: 'e', remedy: 'fix' }, currentInputs: inputs, authorizedPaths: ['proposal'] };
  assert.equal(convergenceDecision(base).action, 'apply-validate-review');
  for (const update of [{ preflight: false }, { drift: true }, { repeated: true }, { contradictory: true }, { validation: 'fail' }, { launchFailures: 2 }, { authority: { ...base.authority, review: false } }, { record: { ...record, cumulativeCycles: 3 } }]) assert.equal(convergenceDecision({ ...base, ...update }).action, 'stop');
  const attempt = { verified: true, reference: 'attempt', binding, inputs };
  assert.equal(convergenceDecision({ ...base, launchFailures: 1 }).action, 'stop');
  assert.equal(convergenceDecision({ ...base, launchFailures: 1, priorAttempt: attempt }).action, 'retry-launch');
  for (const priorAttempt of [{ ...attempt, verified: false }, { ...attempt, reference: '' }, { ...attempt, binding: { ...binding, model: 'other' } }, { ...attempt, inputs: { ...inputs, 'openspec/config.yaml': 'e'.repeat(64) } }]) assert.equal(convergenceDecision({ ...base, launchFailures: 1, priorAttempt }).action, 'stop');
  assert.deepEqual(convergenceDecision(base).authority, { freeze: false, approval: false, execution: false, remote: false });
});

test('synthetic routine corrections reach readiness without an operator relay', async () => {
  const { convergenceDecision } = await import('../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/orchestration-core.mjs');
  let record = start(), current = inputs, p = packet(record), out = accept(record, p, receipt(p, { verdict: 'Verdict: Findings', findings: [finding('F1')] }));
  record = out.record;
  for (let cycle = 1; cycle <= 3; cycle++) {
    const request = { record, authority: { reference: 'grant', write: true, validate: true, review: true }, preflight: true, launchFailures: 0, repeated: false, contradictory: false, drift: false, validation: 'pass', finding: { id: 'F1', classification: 'routine', inputs: current, paths: ['proposal'], evidence: 'e', remedy: 'fix' }, currentInputs: current, authorizedPaths: ['proposal'] };
    assert.equal(convergenceDecision(request).action, 'apply-validate-review');
    const amended = { ...current, 'openspec/config.yaml': String(cycle).repeat(64) };
    p = convergencePacket({ record, inputs: amended, packetHashes, authorSession: 'author', reviewerSession: `review-${cycle + 1}`, correction: { verified: true, reference: 'validation', beforeInputs: current, amendedInputs: amended, strictExitCode: 0, metadataExitCode: 0 } });
    const check = cycle < 3 ? { id: 'F1', status: 'persistent' } : { id: 'F1', status: 'resolved', disposition: 'applied', evidence: 'fixed', reReviewReference: `receipt-review-${cycle + 1}` };
    out = accept(record, p, receipt(p, { ledgerChecks: [check] }), amended);
    assert.equal(out.action, cycle < 3 ? 'blocked' : 'freeze-ready');
    record = out.record; current = amended;
    if (out.action === 'freeze-ready') break;
  }
  assert.equal(record.cumulativeCycles, 3); assert.equal(out.remoteAuthorized, false);
  assert.deepEqual(out.inputs, current); assert.equal(out.reference, 'receipt-review-4'); assert.equal(out.policy, 'charter-v1');
  const { resolveDeliveryPolicy } = await import('../skills/software-development/openspec-delivery/scripts/delivery-policy.mjs');
  const parent = 'e'.repeat(40);
  const request = { phase: 'freeze', context: { ok: true, change, parent, target: parent, inputs: current }, selection: { revision: parent, reference: 'parent', preExecutionReview: true, continuousGoal: false, approachConvergence: true }, contractPaths: [], orchestrationAvailable: true, reviewAcceptance: out };
  const policy = resolveDeliveryPolicy(request);
  assert.equal(policy.approachPolicy, 'charter-v1'); assert.equal(policy.planApproved, false); assert.equal(policy.executionAuthorized, false);
  assert.throws(() => resolveDeliveryPolicy({ ...request, context: { ...request.context, inputs } }), /review/);
  assert.throws(() => resolveDeliveryPolicy({ ...request, selection: { ...request.selection, approachConvergence: false } }), /review/);
});
