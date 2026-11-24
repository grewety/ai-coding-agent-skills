// Local operator observations. Authentication stays with the hosting orchestrator.
import { randomUUID } from "node:crypto";
import { closeSync, fsyncSync, linkSync, lstatSync, openSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { readBounded, scopedPath, separate, sha256, stableJson } from "./evidence-retention.mjs";

export const need = (condition, message) => { if (!condition) throw new Error(message); };
export const text = (value) => typeof value === "string" && value.trim().length > 0;
export const same = (a, b) => stableJson(a) === stableJson(b);
export const observed = (value) => value?.verified === true && text(value.reference);
const id = (value) => typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(value);
const instant = (value) => {
  const time = typeof value === "string" ? Date.parse(value) : NaN;
  need(Number.isFinite(time) && new Date(time).toISOString() === value, "Expected canonical UTC observation time");
  return time;
};
const bytes = (value) => `${stableJson(value)}\n`;
const hour = 60 * 60 * 1000;
const maxEntries = 500;
const utf8 = new TextDecoder("utf-8", { fatal: true });

export function sealedObservation({ file, sha256: expected }) {
  const raw = readBounded(file, 1024 * 1024);
  need(sha256(raw) === expected, "Retained observation file identity mismatch");
  return JSON.parse(utf8.decode(raw));
}

function privateRecords(directory, roots) {
  const dir = scopedPath(directory);
  const info = lstatSync(dir);
  need(info.isDirectory() && (process.getuid === undefined || info.uid === process.getuid() && (info.mode & 0o077) === 0) &&
    roots.every((root) => separate(root, dir)), "Operator records must be owner-private and outside the source and change checkouts");
  return dir;
}

function journal(control, identity) {
  need(id(control.thread) && id(control.operator), "Missing verified operator and conversation identity");
  const dir = privateRecords(control.records, [identity.repo, identity.workspace]);
  const pattern = /^decision-[0-9]{6}\.json$/;
  const files = readdirSync(dir).filter((file) => file.startsWith("decision-")).sort();
  need(files.length <= maxEntries && files.every((file) => pattern.test(file)), "Operator journal is ambiguous or exceeds its finite bound");
  const filename = (number) => path.join(dir, `decision-${String(number).padStart(6, "0")}.json`);
  let previous = null;
  let current = null;
  let reply = null;
  const cards = new Set();
  const turns = new Set();
  const revisions = new Set();
  const byChange = new Map();
  for (const [index, file] of files.entries()) {
    const location = filename(index + 1);
    need(path.join(dir, file) === location, "Operator journal has a missing record");
    const raw = readBounded(location, 1024 * 1024);
    const entry = JSON.parse(utf8.decode(raw));
    need(raw.toString("utf8") === bytes(entry) && entry.schemaVersion === 1 && entry.previous === previous &&
      entry.thread === control.thread && entry.operator === control.operator, "Operator journal chain or conversation mismatch");
    previous = sha256(raw);
    const record = { ...entry, file: location, sha256: previous };
    if (entry.kind === "approval-card") {
      need(!cards.has(entry.card) && !turns.has(entry.turn), "Repeated card or display context");
      const expected = cardDisplay(entry, entry.identity, entry.summary);
      need(observed(entry.display) && id(entry.turn) && entry.display.kind === "display" &&
        entry.display.thread === entry.thread && entry.display.operator === entry.operator &&
        entry.display.card === entry.card && entry.display.id === entry.turn && entry.display.at === entry.displayedAt &&
        entry.display.displaySha256 === expected.displaySha256 && entry.markdown === expected.markdown &&
        same(entry.restrictions, expected.summary.restrictions) && same(entry.local, expected.summary.local),
      "Incomplete or inconsistent approval-card display record");
      cards.add(entry.card);
      turns.add(entry.turn);
      const revision = stableJson([entry.identity.repo, entry.identity.change, entry.identity.plan]);
      need(!revisions.has(revision), "Repeated frozen revision");
      revisions.add(revision);
      current = record;
      byChange.set(stableJson([entry.identity.repo, entry.identity.change]), record);
      reply = null;
    } else {
      need(entry.kind === "operator-reply" && current && !reply && entry.card === current.card &&
        entry.cardSha256 === current.sha256 && !turns.has(entry.turn), "Ambiguous or replayed operator reply");
      turns.add(entry.turn);
      reply = record;
    }
  }
  return { dir, previous, current, reply, cards, turns, revisions, byChange, next: files.length < maxEntries ? filename(files.length + 1) : null };
}

function append(log, control, fields) {
  need(log.next, "Operator journal has reached its finite bound");
  const entry = { schemaVersion: 1, previous: log.previous, thread: control.thread, operator: control.operator, ...fields };
  const content = bytes(entry);
  need(Buffer.byteLength(content) <= 1024 * 1024, "Operator record exceeds the size limit");
  const pending = path.join(log.dir, `.pending-${randomUUID()}`);
  const fd = openSync(pending, "wx", 0o600);
  try {
    try {
      writeFileSync(fd, content);
      fsyncSync(fd);
    } finally { closeSync(fd); }
    // A competing append can win the sequence number, but cannot replace it.
    linkSync(pending, log.next);
    if (process.platform !== "win32") {
      const parent = openSync(log.dir, "r");
      try { fsyncSync(parent); } finally { closeSync(parent); }
    }
  } finally { unlinkSync(pending); }
  return { file: log.next, sha256: sha256(content), entry };
}

function turn(control, log) {
  const evidence = control.turn;
  need(observed(evidence) && id(evidence.id) && !log.turns.has(evidence.id) &&
    evidence.thread === control.thread && evidence.operator === control.operator, "Unverified, crossed or replayed conversation turn");
  return evidence;
}

function restrictions(value) {
  need(value?.inspect === false && typeof value.noCommits === "boolean" &&
    (value.group === null || text(value.group)) && typeof value.keepWorktree === "boolean",
  "Missing retained card restrictions");
  return { inspect: false, noCommits: value.noCommits, group: value.group, keepWorktree: value.keepWorktree };
}

export function narrowRestrictions(held, requested = {}) {
  need(!held.group || !requested.group || held.group === requested.group, "Requested group conflicts with retained restriction");
  return { ...held, ...requested, group: held.group ?? requested.group ?? null,
    noCommits: held.noCommits || requested.noCommits === true, keepWorktree: held.keepWorktree || requested.keepWorktree === true };
}

function executionTerms(value, identity, held) {
  const { budgets, stop, commits, eligibleGroups, roles } = value ?? {};
  const budget = value?.budget;
  need(Number.isFinite(budgets?.minutes) && budgets.minutes > 0 &&
    Number.isSafeInteger(budgets.corrections) && budgets.corrections >= 0 && text(stop) && typeof commits === "boolean" &&
    (identity.mode === "goal-first" || Array.isArray(eligibleGroups) && eligibleGroups.length > 0 &&
      eligibleGroups.every(text) && new Set(eligibleGroups).size === eligibleGroups.length &&
      (!held.group || eligibleGroups.includes(held.group)) && budget?.unit === "minutes" &&
      Number.isSafeInteger(budget.limit) && budget.limit > 0 && budget.limit <= budgets.minutes),
  "Unverified bounded local execution terms");
  const qualified = (role) => observed(role) && text(role.route) && /^[a-f0-9]{64}$/.test(role.bindingSha256);
  need(qualified(roles?.implementer) && qualified(roles?.reviewer) && roles.reviewer.readOnly === true &&
    roles.implementer.bindingSha256 !== roles.reviewer.bindingSha256, "Missing qualified independent role pair");
  return { budgets, stop, commits: commits && !held.noCommits, eligibleGroups, budget, roles };
}

function fresh(card, time, live = false) {
  need(instant(time) >= instant(card.displayedAt) && instant(time) <= instant(card.expiresAt), "Approval card is stale or has a crossed observation time");
  if (live) {
    const now = Date.now();
    need(instant(time) <= now && now <= instant(card.expiresAt), "Approval card or conversation turn falls outside the current display window");
  }
}

function authority(card, turnId, action) {
  const { repo, repository, branch, inputs, ...binding } = card.identity;
  const reference = `operator:${card.sha256}:${turnId}`;
  const approval = { ...binding, schemaVersion: 1, approved: true, verified: true, reference: `${reference}:approval`,
    kind: binding.mode === "goal-first" ? "exact-goal-approval" : "exact-plan-approval" };
  const grant = action === "approve and run" ? { ...binding, ...card.local, schemaVersion: 1, verified: true,
    kind: "local-execution-grant", localOnly: true, reference: `${reference}:grant`, approvalReference: approval.reference } : null;
  return { approval, grant };
}

export function recordCard(control, identity, summary, head, predecessor) {
  const log = journal(control, identity);
  const display = turn(control, log);
  const { displayedAt, expiresAt } = control;
  const card = cardDisplay(control, identity, summary);
  need(head === identity.plan && id(control.card) && !log.cards.has(control.card) && display.kind === "display" &&
    display.card === control.card && display.displaySha256 === card.displaySha256 &&
    display.at === displayedAt && !log.revisions.has(stableJson([identity.repo, identity.change, identity.plan])),
  "Approval card was not displayed for the exact frozen plan");
  fresh(control, displayedAt, true);
  const held = card.summary.restrictions;
  const previous = log.byChange.get(stableJson([identity.repo, identity.change]));
  if (previous) {
    need(previous.identity.plan === predecessor && previous === log.current &&
      log.reply?.feedback && instant(displayedAt) > instant(log.reply.evidence.at), "Successor card lacks current retained feedback and refreeze provenance");
    need(same(narrowRestrictions(previous.restrictions, held), held), "Successor card drops retained restrictions");
  }
  return append(log, control, { kind: "approval-card", card: control.card, identity, summary: card.summary, restrictions: held,
    local: card.summary.local, displayedAt, expiresAt, turn: display.id, display, markdown: card.markdown });
}

export function cardDisplay(control, identity, summary) {
  const { card, displayedAt, expiresAt, thread, operator } = control;
  const life = instant(expiresAt) - instant(displayedAt);
  need(id(card) && id(thread) && id(operator) && life > 0 && life <= 24 * hour,
    "Approval card requires a unique context and a finite display lifetime of at most 24 hours");
  need(text(summary?.outcome) && Array.isArray(summary.gates) && summary.gates.length && Array.isArray(summary.exclusions),
    "Incomplete displayed planning scope");
  const held = restrictions(summary.restrictions);
  need(identity.mode !== "goal-first" || held.group === null, "A fixed group restriction requires Task-Guided delivery");
  const local = summary.local == null ? null : executionTerms(summary.local, identity, held);
  const lines = [
    `### Approval card ${card}`,
    `${identity.repository} · ${identity.change} · ${identity.mode}`,
    `Policy ${identity.policyRevision} · ${identity.branch} · ${identity.workspace}`,
    `Frozen SHA ${identity.plan} · digest ${identity.planDigest}`,
    `Outcome ${summary.outcome}`,
    `Gates ${stableJson(summary.gates)} · exclusions ${stableJson(summary.exclusions)}`,
    `Restrictions ${stableJson(held)}`,
    ...(local ? [`Local terms ${stableJson(local)}`] : []),
    `Expires ${expiresAt}`,
    "- `approve` records exact approval.",
    ...(local ? ["- `approve and run` also records the separate bounded local grant."] : []),
    "- `changes: <feedback>` returns to planning.",
  ];
  const display = { card, identity, summary: { ...summary, restrictions: held, local }, displayedAt, expiresAt, thread, operator,
    markdown: lines.join("\n") };
  return { ...display, displaySha256: sha256(stableJson(display)) };
}

export function recordReply(control, identity, head) {
  const log = journal(control, identity);
  const { current: card, reply } = log;
  const evidence = turn(control, log);
  need(card && !reply && card.sha256 === control.cardSha256 && evidence.kind === "reply" &&
    evidence.inReplyTo === card.turn && evidence.immediate === true && same(card.identity, identity) &&
    head === identity.plan, "Reply is not bound to the unique current displayed card, exact HEAD and planning bytes");
  fresh(card, evidence.at, true);
  const replyText = typeof evidence.text === "string" ? evidence.text.trim() : "";
  if (replyText.startsWith("changes:")) {
    const feedback = replyText.slice("changes:".length).trim();
    need(text(feedback) && evidence.scope === "routine-in-scope", "Planning feedback requires an operator scope decision");
    return append(log, control, { kind: "operator-reply", card: card.card, cardSha256: card.sha256,
      turn: evidence.id, evidence, feedback, approval: null, grant: null });
  }
  need(["approve", "approve and run"].includes(replyText) && (replyText === "approve" || card.local),
    "Expected approval or a combined reply with separately displayed bounded execution terms");
  return append(log, control, { kind: "operator-reply", card: card.card, cardSha256: card.sha256,
    turn: evidence.id, evidence, ...authority(card, evidence.id, replyText) });
}

export function readShortAuthority(control, identity, head, phase, live) {
  const { current: card, reply } = journal(control, identity);
  need(card && reply && reply.sha256 === control.replySha256 && same(card.identity, identity) &&
    observed(reply.evidence) && reply.evidence.thread === control.thread && reply.evidence.operator === control.operator &&
    reply.evidence.id === reply.turn && reply.evidence.inReplyTo === card.turn && reply.evidence.immediate === true,
  "Short decision is superseded, missing or bound to another context");
  fresh(card, reply.evidence.at);
  const action = reply.evidence.text.trim();
  need(["approve", "approve and run"].includes(action) && (action === "approve" || card.local),
    "Reply does not carry exact approval");
  const expected = authority(card, reply.turn, action);
  need(same(reply.approval, expected.approval) && same(reply.grant, expected.grant), "Partial or inconsistent short approval transaction");
  if (phase === "dispatch") {
    need(head === identity.plan, "Initial short-approved dispatch requires the exact frozen HEAD");
    fresh(card, control.at, live);
    need(instant(control.at) >= instant(reply.evidence.at), "Dispatch observation precedes the approval reply");
  }
  return { ...expected, restrictions: card.restrictions, roles: card.local?.roles, replyFile: reply.file };
}

export function readSeparateGrant(entry, authority, identity) {
  const raw = sealedObservation(entry);
  const { approval, restrictions: held } = authority;
  const keys = ["change", "mode", "policyRevision", "workspace", "plan", "planDigest"];
  need(observed(raw) && raw.kind === "local-execution-grant" && raw.localOnly === true &&
    raw.approvalReference === approval.reference && raw.reference !== approval.reference &&
    !raw.reference.startsWith("operator:") && keys.every((key) => raw[key] === identity[key]),
  "Separate execution grant does not bind the retained exact approval");
  const terms = executionTerms(raw, identity, held);
  if (authority.roles) need(same(terms.roles, authority.roles), "Separate grant changes the retained qualified role pair");
  return { ...raw, ...terms };
}

export function currentCard(control, identity, head) {
  const { current: card, reply } = journal(control, identity);
  if (!card || reply || head !== identity.plan || !same(card.identity, identity) ||
      !control.at || instant(control.at) < instant(card.displayedAt) || instant(control.at) > instant(card.expiresAt)) return null;
  return { live: true, combined: Boolean(card.local), file: card.file, sha256: card.sha256 };
}

export function readPlanningFeedback(control, identity, head) {
  const { current: card, reply } = journal(control, identity);
  need(card && reply && reply.sha256 === control.replySha256 && head === card.identity.plan &&
    same(card.identity, identity) && observed(reply.evidence) && reply.evidence.inReplyTo === card.turn &&
    reply.evidence.immediate === true && reply.evidence.scope === "routine-in-scope" &&
    reply.evidence.text.trim().startsWith("changes:") &&
    reply.feedback === reply.evidence.text.trim().slice("changes:".length).trim() &&
    text(reply.feedback) && reply.approval === null && reply.grant === null,
  "Planning revision lacks exact retained in-scope feedback");
  fresh(card, reply.evidence.at);
  return { feedback: reply.feedback, reference: reply.file, restrictions: card.restrictions, plan: card.identity.plan };
}

export function verifyShortRoles(expected, entries) {
  return Object.fromEntries(["implementer", "reviewer"].map((role) => {
    const entry = entries?.[role];
    const bound = expected?.[role];
    need(entry && entry.sha256 === bound?.bindingSha256, `Missing or mismatched qualified ${role} binding`);
    const record = sealedObservation(entry);
    need(observed(record) && record.reference === bound.reference && record.role === role &&
      record.route === bound.route && (role !== "reviewer" || record.readOnly === true),
    `Qualified ${role} no longer matches the retained role and route`);
    return [role, record];
  }));
}
