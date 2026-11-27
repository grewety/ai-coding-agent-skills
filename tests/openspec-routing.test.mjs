import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const skills = new URL("../skills/", import.meta.url);
const read = async (relative) => readFile(new URL(relative, skills), "utf8");
const router = fileURLToPath(new URL("software-development/openspec-next/scripts/next.mjs", skills));
const runtime = fileURLToPath(new URL("software-development/openspec-delivery/scripts/delivery-cli.mjs", skills));
const entry = {
  commit: "software-development/git-commit-message/",
  wireframes: "software-development/capability-wireframes/",
  orchestration: "autonomous-ai-agents/autonomous-implementation-review/",
  integration: "software-development/openspec-delivery/",
};

test("companion skills route OpenSpec work before generic procedure", async () => {
  for (const [name, directory] of Object.entries(entry)) {
    if (name === "integration") continue;
    const source = await read(`${directory}SKILL.md`);
    assert.match(source, /references\/openspec\.md/, `${name} does not route to its OpenSpec reference`);
    const route = source.indexOf("references/openspec.md");
    const procedure = source.indexOf("## Procedure");
    assert.ok(route > 0 && route < procedure, `${name} must route before its procedure`);
    assert.doesNotMatch(source, /phased-plan-|application-records/);
  }
});

test("git-commit-message keeps its preview and uses the integration skill for change batches", async () => {
  const source = await read(`${entry.commit}SKILL.md`);
  assert.match(source, /^version: 4\.9\.0$/m);
  assert.match(source, /closeout trailer/);
  assert.match(source, /closing keyword/);
  assert.match(source, /openspec-delivery/);
  assert.match(source, /In normal operation, present a preview and stop/i);
  assert.match(source, /Outside\s+explicitly enabled autonomous mode, a preview is not permission to commit/i);
  assert.doesNotMatch(source, /phased-plan-closeout/);
  const reference = await read(`${entry.commit}references/openspec.md`);
  assert.ok(reference.length > 900, "OpenSpec commit reference must stay substantive");
  for (const expected of [
    /openspec-delivery/,
    /sole Git and `openspec\/changes\/<name>\/tasks\.md` writer/,
    /path allowlists/,
    /preview, its single-turn stop, explicit acceptance/,
    /push, pull-request creation, merge/,
    /documentation or review/,
    /closing keyword/,
    /next\s+push does/,
    /Fixes #<issue>/,
    /read back as merged/,
  ]) assert.match(reference, expected);
  assert.doesNotMatch(reference, /~(?:[A-Za-z0-9._-]+)?\/\.hermes|\/home\//);
});

test("capability-wireframes uses stable keys and change-owned proposals", async () => {
  const source = await read(`${entry.wireframes}SKILL.md`);
  assert.match(source, /^version: 1\.5\.1$/m);
  assert.match(source, /docs\/product\/wireframes\//);
  assert.match(source, /within their change package/);
  assert.doesNotMatch(source, /CAP-NNNN|application-records/);
  const reference = await read(`${entry.wireframes}references/openspec.md`);
  assert.ok(reference.length > 900, "OpenSpec wireframe reference must stay substantive");
  for (const expected of [
    /docs\/product\/wireframes\//,
    /stable (?:capability|screen|key)/i,
    /change-owned|openspec\/changes\/<name>\//,
    /openspec\/specs\//,
    /no fabricated CAP|Do not allocate `CAP-NNNN`|No capability record is required/i,
    /manifest/,
    /PNG/,
    /generate\.mjs/,
    /inspect (?:the|its) actual interface|read its actual interface/i,
  ]) assert.match(reference, expected);
  assert.doesNotMatch(reference, /~(?:[A-Za-z0-9._-]+)?\/\.hermes|\/home\//);
});

test("autonomous-implementation-review bounds orchestration to one change and supported hosts", async () => {
  const source = await read(`${entry.orchestration}SKILL.md`);
  assert.match(source, /^version: 0\.26\.4$/m);
  assert.match(source, /A planning-only request stops after proposal\/spec\/design\/tasks/);
  assert.match(source, /qualified terminal adapter/);
  assert.match(source, /resolveLegacyRouteRequest/);
  assert.match(source, /retired-route/);
  assert.match(source, /openspec-delivery/);
  assert.match(source, /\/goal draft \/openspec-delivery <name>/);
  assert.equal([...source.matchAll(/^\s*\/goal draft \/openspec-delivery .+$/gm)].length, 1);
  assert.doesNotMatch(source, /phased-plan-|application-records/);
  const reference = await read(`${entry.orchestration}references/openspec.md`);
  assert.ok(reference.length > 900, "OpenSpec orchestration reference must stay substantive");
  for (const expected of [
    /one authorized native OpenSpec change/,
    /task group/,
    /terminal-adapters\.md/,
    /resolveLegacyRouteRequest/,
    /retired-route/,
    /code-tab-phase-roles/,
    /defines no new host/,
    /openspec-delivery/,
    /sole Git and `tasks\.md` writer/,
    /checkbox writes are mediated/i,
    /requireDistinctModels/,
    /stops after the named task group/,
  ]) assert.match(reference, expected);
  assert.doesNotMatch(reference, /~(?:[A-Za-z0-9._-]+)?\/\.hermes|\/home\//);
  assert.doesNotMatch(reference, /^\s*\/goal draft Execute only /m);
});

test("integration treats GitHub as documentation and review, not a task lock", async () => {
  const source = await read(`${entry.integration}SKILL.md`);
  assert.match(source, /Parallel specification and documentation/);
  assert.match(source, /not an execution lock|not a lock|not admission/i);
  assert.match(source, /document <name>/);
  assert.match(source, /A longer prompt is not required/);
  assert.match(source, /same capability spec/);
  assert.doesNotMatch(source, /phased-plan-|application-records/);
});

test("the autonomous category contract owns the OpenSpec orchestration boundary", async () => {
  const contract = await read("autonomous-ai-agents/AGENTS.md");
  assert.match(contract, /references\/openspec\.md/);
  assert.match(contract, /openspec-delivery/);
  assert.match(contract, /sole\s+Git\/`tasks\.md`/);
  assert.match(contract, /`code-tab-phase-roles`/);
  assert.match(contract, /Herdr/);
  assert.doesNotMatch(contract, /phased-plan-closeout/);
});

test("next routes UI and external gates without starting a check or consuming a grant", async (t) => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), "openspec-next-fixture-")));
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = path.join(root, "retained observations.json");
  const route = async (command, input, args = []) => {
    const bytes = JSON.stringify(input);
    await writeFile(file, bytes);
    const result = spawnSync(process.execPath, [router, command, "--input", file, ...args],
      { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    assert.equal(result.error, undefined);
    assert.equal(await readFile(file, "utf8"), bytes);
    assert.deepEqual(await readdir(root), [path.basename(file)]);
    return { exit: result.status, ...JSON.parse(result.stdout) };
  };

  const candidate = "a".repeat(40);
  const button = { role: "button", name: "Pin note" };
  const declaration = { localTryOut: true, interactions: [button], deployPreview: false };
  const local = { candidate, url: "http://127.0.0.1:4173", localOnly: true, tryOutPassed: true,
    interactions: [{ ...button, matchedBy: "accessible-name", passed: true }] };
  assert.equal((await route("ui", { candidate, declaration, local: { ...local, url: "https://remote.invalid" } })).reason,
    "LOCAL_UI_ACCEPTANCE_PENDING");
  assert.equal((await route("ui", { candidate, declaration, local }, ["--runtime", runtime, "--json"])).action, "accepted");
  const previewInput = { candidate, local, declaration: { ...declaration, deployPreview: true } };
  assert.equal((await route("ui", previewInput)).reason, "PREVIEW_AUTHORITY_PENDING");
  const preview = { candidate, verified: true, separateGrant: true, artifactOnly: true, authorityReference: "fixture:preview-grant" };
  assert.equal((await route("ui", { ...previewInput, preview })).reason, "PREVIEW_REVIEW_PENDING");
  assert.equal((await route("ui", { ...previewInput,
    preview: { ...preview, reviewed: true, reviewReference: "fixture:preview-review" } })).action, "accepted");

  const card = { candidate, target: "fixture vendor", scope: "synthetic smoke test", data: ["synthetic-fixtures"],
    expectedCost: { amount: 1, unit: "credit" }, kind: "paid-check", runs: 1, artifact: null, trigger: null, retryOf: null };
  assert.equal((await route("external", { card, history: [] })).reason, "EXTERNAL_AUTHORITY_PENDING");
  const reference = "fixture:external-grant";
  const reservation = path.join(root, `${createHash("sha256").update(reference).digest("hex")}.json`);
  const grant = { schemaVersion: 1, kind: "external-single-run", verified: true, reference, reservation, card, localOnly: false };
  assert.equal((await route("external", { card, grant, history: [] })).action, "reserve");
  const refused = await route("reserve-external", { card, grant, history: [] });
  assert.equal(refused.exit, 1);
  assert.equal(refused.ok, false);
  const pushGrant = { verified: true, candidate, reference: "fixture:push", target: "fixture branch" };
  assert.equal((await route("push-triggers", { candidate, pushGrant, observed: { candidate, verified: true, triggers: ["app"] } })).reason,
    "PUSH_TRIGGER_AUTHORITY_PENDING");
});
