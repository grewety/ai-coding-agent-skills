import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sha256 } from "../skills/software-development/openspec-delivery/scripts/evidence-cli.mjs";
import { verifyRepresentation } from "../skills/software-development/openspec-delivery/scripts/evidence-retention.mjs";

const cli = fileURLToPath(new URL("../skills/software-development/openspec-delivery/scripts/delivery-cli.mjs", import.meta.url));
const candidate = "1".repeat(40);
async function fixture(t) {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), "external-authority-")));
  t.after(() => rm(root, { recursive: true, force: true }));
  let index = 0;
  const run = async (command, input) => {
    const file = path.join(root, `input-${++index}.json`);
    await writeFile(file, JSON.stringify(input));
    const result = spawnSync(process.execPath, [cli, command, "--input", file, "--json"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    assert.equal(result.error, undefined);
    return { status: result.status, result: JSON.parse(result.stdout) };
  };
  return { root, run };
}
const makeCard = (patch = {}) => ({ candidate, target: "fixture service", scope: "check one synthetic behavior", data: ["synthetic-fixtures"],
  expectedCost: { amount: 1, unit: "test credit" }, kind: "paid-check", runs: 1, artifact: null, trigger: null, retryOf: null, ...patch });
const grantFor = (root, card, reference) => ({ schemaVersion: 1, kind: "external-single-run", verified: true, localOnly: false, reference, card,
  reservation: path.join(root, `${sha256(reference)}.json`) });

test("external authority for a synthetic paid check is single-run and a retry has a new grant", async (t) => {
  const { root, run } = await fixture(t);
  const card = makeCard();
  const grant = grantFor(root, card, "retained:external-grant-1");
  const input = { card, grant, history: [] };
  const offer = await run("external", input);
  assert.equal(offer.result.action, "reserve");
  const displayed = await run("external", { card, displayCard: true });
  assert.equal(displayed.result.reason, "EXTERNAL_AUTHORITY_PENDING");
  assert.deepEqual(displayed.result.card, card);
  await assert.rejects(stat(grant.reservation), { code: "ENOENT" });
  assert.equal((await run("external", { ...input, grant: { ...grant, kind: "local-execution-grant" } })).result.reason,
    "EXTERNAL_AUTHORITY_PENDING");
  assert.equal((await run("external", { ...input, card: { ...card, data: ["live-data"] } })).result.reason,
    "EXTERNAL_SCOPE_UNVERIFIED");
  const first = await run("reserve-external", input);
  assert.deepEqual([first.status, first.result.action, first.result.automaticRetry], [0, "run-once", false]);
  assert.equal((await run("reserve-external", input)).result.reason, "EXTERNAL_GRANT_CONSUMED");
  assert.equal((await run("external", { ...input, reservation: first.result.reservation })).result.reason, "EXTERNAL_GRANT_CONSUMED");
  const retry = makeCard({ retryOf: grant.reference });
  const replacement = grantFor(root, retry, "retained:external-grant-2");
  const history = [{ reference: grant.reference, verified: true, state: "failed", cleanup: "pending",
    candidate, target: card.target, kind: card.kind, scope: card.scope }];
  assert.equal((await run("external", { card: retry, grant: replacement, history })).result.reason, "PRIOR_RUN_CLEANUP_UNVERIFIED");
  history[0].cleanup = "complete";
  assert.equal((await run("reserve-external", { card: retry, grant: replacement, history })).result.action, "run-once");
});

test("artifact-only tunnels and app triggers require their own bounded reservation", async (t) => {
  const { root, run } = await fixture(t);
  const artifact = { root: path.join(root, "build"), sha256: sha256("synthetic artifact") };
  await mkdir(artifact.root);
  const card = makeCard({ kind: "tunnel", data: ["built-artifact"], artifact });
  const grant = grantFor(root, card, "retained:tunnel");
  const signal = { artifact: { ...artifact, candidate, isolated: true, approvedDataOnly: true, accountActions: false, cleanupReady: true } };
  assert.equal((await run("external", { card, grant, history: [] })).result.reason, "ARTIFACT_BOUNDARY_UNVERIFIED");
  assert.equal((await run("external", { card, grant, history: [], observed: { artifact: { ...signal.artifact, accountActions: true } } })).result.reason,
    "ARTIFACT_BOUNDARY_UNVERIFIED");
  const approved = await run("reserve-external", { card, grant, history: [], observed: signal });
  assert.equal(approved.result.serveOnly, artifact.root);
  assert.equal(approved.result.cleanup, "immediate-on-success-or-failure");
  const builtCheck = makeCard({ data: ["built-artifact"], artifact });
  assert.equal((await run("external", { card: { ...builtCheck, artifact: null }, displayCard: true })).result.reason,
    "EXTERNAL_SCOPE_UNVERIFIED");
  const builtGrant = grantFor(root, builtCheck, "retained:built-check");
  assert.equal((await run("external", { card: builtCheck, grant: builtGrant, history: [], observed: signal })).result.action, "reserve");
  const trigger = "preview-vendor";
  const triggerCard = makeCard({ kind: "app-trigger", trigger });
  const pushGrant = { verified: true, candidate, target: triggerCard.target, reference: "retained:push" };
  const push = { candidate, pushGrant, observed: { verified: true, candidate, triggers: [trigger] } };
  assert.equal((await run("push-triggers", push)).result.reason, "PUSH_TRIGGER_AUTHORITY_PENDING");
  assert.equal((await run("push-triggers", { ...push, observed: { ...push.observed, verified: false } })).result.reason,
    "TRIGGER_INVENTORY_UNVERIFIED");
  const external = await run("reserve-external", { card: triggerCard, grant: grantFor(root, triggerCard, "retained:trigger"),
    history: [], observed: { pushGrant, triggers: [trigger], triggerInventoryVerified: true } });
  assert.equal(external.result.action, "run-once");
  assert.equal((await run("push-triggers", { ...push, external: [external.result] })).result.action, "proceed");
});

test("declared UI acceptance stays local and pauses for separate preview review", async (t) => {
  const { run } = await fixture(t);
  const declaration = { localTryOut: true, interactions: [{ role: "button", name: "Load widget" }], deployPreview: true };
  const local = { candidate, url: "http://127.0.0.1:4173", localOnly: true, tryOutPassed: true,
    interactions: [{ role: "button", name: "Load widget", matchedBy: "accessible-name", passed: true }] };
  const input = { candidate, declaration, local };
  assert.equal((await run("ui", { candidate, declaration: null })).result.action, "not-declared");
  assert.equal((await run("ui", { ...input, local: { ...local, url: "https://fixture.invalid" } })).result.reason, "LOCAL_UI_ACCEPTANCE_PENDING");
  assert.equal((await run("ui", { ...input, local: { ...local, interactions: [{ ...local.interactions[0], matchedBy: "css" }] } })).result.reason,
    "LOCAL_UI_ACCEPTANCE_PENDING");
  assert.equal((await run("ui", input)).result.reason, "PREVIEW_AUTHORITY_PENDING");
  const preview = { candidate, authorityReference: "retained:preview", separateGrant: true, artifactOnly: true, verified: true };
  assert.equal((await run("ui", { ...input, preview })).result.action, "pause");
  assert.equal((await run("ui", { ...input, preview: { ...preview, reviewed: true, reviewReference: "retained:operator-preview-result" } })).result.action,
    "accepted");
});

test("bounded upgrade discovery uses disposable cwd, home, configuration and cache paths", async (t) => {
  const { root, run } = await fixture(t);
  const repository = path.join(root, "repository");
  const output = path.join(root, "discovery.json");
  await mkdir(repository);
  await writeFile(path.join(repository, "product.txt"), "unchanged");
  const script = "const fs=require('node:fs');const p=require('node:path');const home=process.env.HOME;const cwd=process.cwd();" +
    "fs.writeFileSync(p.join(home,'probe.txt'),'synthetic');fs.writeFileSync(p.join(process.env.XDG_CACHE_HOME,'probe.txt'),'synthetic');" +
    "fs.writeSync(1,JSON.stringify({cwd,home,cache:process.env.XDG_CACHE_HOME,config:process.env.XDG_CONFIG_HOME}));";
  const commands = [{ argv: [process.execPath, "-e", script], timeoutMs: 2_500 }];
  const grant = { schemaVersion: 1, kind: "local-planning-probe", verified: true, reference: "retained:probe", target: "breaking CLI behavior",
    scope: "scratch-only", external: false, commands, limitMs: 5_000 };
  const request = { grant, target: grant.target, repository, output, commands, limitMs: 5_000, planLocked: false };
  for (const patch of [{ planLocked: true }, { output: path.join(repository, "forbidden") }, { grant: { ...grant, external: true } },
    { commands: [...commands, ...commands] }]) {
    assert.equal((await run("discovery", { ...request, ...patch })).status, 1);
  }
  const completed = await run("discovery", request);
  assert.equal(completed.status, 0, JSON.stringify(completed));
  const sealed = JSON.parse(await readFile(output, "utf8"));
  const observed = JSON.parse(verifyRepresentation(sealed.records[0].stdout).toString("utf8"));
  for (const field of ["home", "config", "cache"]) assert.equal(path.dirname(observed[field]), observed.cwd);
  await assert.rejects(stat(observed.cwd), { code: "ENOENT" });
  assert.equal(await readFile(path.join(repository, "product.txt"), "utf8"), "unchanged");
  assert.equal(sealed.eligibleAsAcceptance, false);
});
