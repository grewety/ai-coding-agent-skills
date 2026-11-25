import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readdir, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sha256 } from "../skills/software-development/openspec-delivery/scripts/evidence-cli.mjs";

const delivery = fileURLToPath(new URL("../skills/software-development/openspec-delivery/scripts/delivery-cli.mjs", import.meta.url));
const nextRouter = fileURLToPath(new URL("../skills/software-development/openspec-next/scripts/next.mjs", import.meta.url));
export const change = "delivery-fixture";
export const own = `openspec/changes/${change}`;
export const current = "openspec/specs/widget/spec.md";
const requirement = "### Requirement: Widget works\nThe widget SHALL load.\n\n#### Scenario: Launch\n- **WHEN** the widget opens\n- **THEN** it loads\n";
export const currentSpec = `---\nmetadata_version: 1\nartifact: spec\ncapability: widget\n---\n# Widget\n\n## Requirements\n\n${requirement}`;
export const gateArgv = [process.execPath, "-e", "const fs=require('node:fs');if(fs.readFileSync('widget.txt','utf8')!=='new')process.exit(8);fs.writeSync(1,'widget tested')"];
const env = { PATH: process.env.PATH, GIT_CONFIG_NOSYSTEM: "1",
  GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : os.devNull };
export const boundary = { reversibleLocal: true, orderedDependencies: false, stagedAuthority: false, prescribedMethod: false };

export function exec(executable, args) {
  const result = spawnSync(executable, args, { env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  assert.equal(result.error, undefined);
  return result;
}
export async function fixture(t, { integratedOptIn = true, staged = false, exclusive = false, continuous = false,
  proposeToFreeze = false, beforeFreeze } = {}) {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), "delivery-runtime-")));
  t.after(async () => {
    // The contained reviewer seals export and output directories at 0500.
    async function restore(directory) {
      await chmod(directory, 0o700);
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        if (entry.isDirectory()) await restore(path.join(directory, entry.name));
      }
    }
    await restore(root);
    await rm(root, { recursive: true, force: true });
  });
  const repo = path.join(root, "source");
  const workspace = path.join(root, "implementation");
  await mkdir(repo);
  const git = (cwd, ...args) => {
    const result = exec("git", ["--no-optional-locks", "-C", cwd, "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", ...args]);
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  const write = async (dir, file, contents) => {
    await mkdir(path.dirname(path.join(dir, file)), { recursive: true });
    await writeFile(path.join(dir, file), contents);
  };
  const commit = (dir, message) => {
    git(dir, "add", ".");
    git(dir, "commit", "-m", message);
    return git(dir, "rev-parse", "HEAD");
  };
  git(repo, "init", "-b", "main");
  await write(repo, "AGENTS.md", `# Fixtures\n${integratedOptIn ? "<!-- openspec-delivery-mode: goal-first -->\n" : ""}` +
    (proposeToFreeze ? "<!-- openspec-proposal: propose-to-freeze -->\n" : "") +
    (exclusive ? "<!-- openspec-worker-runtime: exclusive -->\n" : ""));
  await write(repo, ".gitignore", "/dist/\n/ignored-input\n");
  await write(repo, "widget.txt", "old");
  const base = commit(repo, "Integrated policy and product");
  git(repo, "update-ref", "refs/remotes/origin/main", base);
  git(repo, "remote", "add", "origin", "git@github.com:Example/Fixture.git");
  git(repo, "worktree", "add", "-b", `change/${change}`, workspace, base);
  const contract = { schemaVersion: 1, outcome: "Deliver the widget", scope: [current, "widget.txt"],
    invariants: ["Use only local synthetic fixture data"], nonGoals: ["Publish"],
    adaptableAssumptions: ["Legacy fixture still uses its previous value"], acceptance: ["Widget loads"],
    gates: [gateArgv], localAuthority: { commits: true, stop: "Scope conflict" }, budgets: { minutes: 30, corrections: 2 } };
  await Promise.all([
    write(workspace, "openspec/config.yaml", "schema: spec-driven\n"),
    write(workspace, `${own}/.openspec.yaml`, "schema: spec-driven\n"),
    write(workspace, `${own}/proposal.md`, "# Proposal\n\n```openspec-goal-contract\n" + JSON.stringify(contract) + "\n```\n"),
    write(workspace, `${own}/specs/widget/spec.md`, `# Spec Delta\n\n## ADDED Requirements\n\n${requirement}`),
    write(workspace, `${own}/tasks.md`, "# Tasks\n\n## 1. Widget\n- [ ] 1.1 Pass the widget gate\n" +
      (staged ? "\n## 2. External\n- [ ] 2.1 Run separate preview\n" : "")),
  ]);
  if (!integratedOptIn && !exclusive) await write(workspace, "AGENTS.md", "# Unintegrated opt-in\n<!-- openspec-delivery-mode: goal-first -->\n");
  let index = 0;
  const run = async (command, input, cli = delivery, nodeArgs = []) => {
    const file = path.join(root, `input-${++index}.json`);
    await writeFile(file, JSON.stringify(input));
    const result = exec(process.execPath, [...nodeArgs, cli, command, "--input", file, ...(cli === delivery ? ["--json"] : [])]);
    assert.ok(result.stdout, result.stderr);
    return { status: result.status, stdout: result.stdout, value: JSON.parse(result.stdout) };
  };
  const draft = await run("policy", {
    repo: workspace, change, phase: "freeze", parent: base, target: base,
    selection: { revision: base, reference: "retained:draft-policy", preExecutionReview: false, continuousGoal: continuous },
    deliveryBoundary: { ...boundary, stagedAuthority: staged }, declaredContractPaths: integratedOptIn || exclusive ? [] : ["AGENTS.md"],
    orchestrationAvailable: continuous,
  });
  assert.equal(draft.status, 0, draft.stdout);
  assert.equal(draft.value.planDigest, null);
  assert.equal(draft.value.policy.executionAuthorized, false);
  await beforeFreeze?.({ repo, workspace, base, run, draft: draft.value, root, contract });
  const plan = commit(workspace, "Freeze plan");
  const selection = { revision: base, reference: "retained:integrated-policy", preExecutionReview: false, continuousGoal: continuous };
  const defaults = { repo, change, plan, target: base, workspace, selection, deliveryBoundary: { ...boundary, stagedAuthority: staged },
    declaredContractPaths: integratedOptIn || exclusive ? [] : ["AGENTS.md"], orchestrationAvailable: continuous };
  const evaluated = (await run("policy", defaults)).value;
  assert.equal(evaluated.policy.mode, integratedOptIn && !staged ? "goal-first" : "task-guided");
  const { planDigest, policy } = evaluated;
  assert.equal(draft.value.goalContractDigest, evaluated.goalContractDigest);
  const identity = { change, plan, planDigest, workspace, mode: policy.mode, policyRevision: base };
  const approval = { ...identity, schemaVersion: 1, kind: policy.mode === "goal-first" ? "exact-goal-approval" : "exact-plan-approval",
    approved: true, verified: true, reference: "retained:approval" };
  const grant = { ...identity, schemaVersion: 1, kind: "local-execution-grant", verified: true, reference: "retained:local-grant",
    approvalReference: approval.reference, localOnly: true, budgets: { minutes: 25, corrections: 1 }, commits: true, stop: "Local result",
    eligibleGroups: ["1"], budget: { limit: 25, unit: "minutes" } };
  const retained = { verified: true, reference: "retained:preflight" };
  const reviewer = sha256("synthetic reviewer");
  const config = sha256("synthetic reviewer config");
  const preflight = {
    live: { ...retained, head: base, branch: "main", remote: "origin", repository: "example/fixture" },
    auth: { ...retained, authenticated: true, requiredScopesPresent: true, repository: "example/fixture" },
    local: { ...retained, activeChangeInventoryVerified: true },
    reviewer: { ...retained, outcome: "pass", configurationSha256: config, expectedConfigurationSha256: config, packageSha256: reviewer },
    relay: { ...retained, ready: true, materialRetained: false, configurationSha256: config },
    runtime: { ...retained, node: process.version, openspec: "2.1.1", expected: { node: process.version, openspec: "2.1.1" } },
    checkpoint: { ...retained, head: base, policyRevision: base, prerequisitesVerified: true },
    companions: { ...retained, actual: { reviewer }, expected: { reviewer } },
  };
  const observed = { plan, planDigest, ownership: "exclusive", host: "ready", humanInput: "none", remoteRequired: false, stopReached: false,
    alignment: { scope: "aligned", invariants: "aligned", nonGoals: "aligned", acceptance: "aligned", localAuthority: "aligned",
      "frozen-plan": "aligned", order: "aligned" }, adaptations: [], minutesUsed: 1, groupMinutesUsed: 1, correctionsUsed: 0,
    correctionHistory: [], activeAttempt: { group: "1", implementerSession: "fixture-implementer" }, dependencies: "accepted",
    gates: "pass", review: "pass", nextChange: false, budgetUsed: 1, authorityBudgetUsed: 1, completedGroups: 0 };
  const request = { ...defaults, approval, grant, preflight, observed, restrictions: { inspect: false, group: null, noCommits: false },
    deliveryPhase: "dispatch" };
  const route = (command, input) => run(command, input, nextRouter);
  return { root, repo, workspace, base, plan, planDigest, policy, evaluated, contract, request, git, run, route, write, commit };
}

export function twoGroupGuidance(planDigest) {
  return { verified: true, reference: "retained:frozen-guidance", planDigest, groups: [
    { id: "1", taskIds: ["1.1"], requires: [], authority: "local", gates: [gateArgv], stop: "Stage complete",
      resultBudget: { minutes: 20, corrections: 1 } },
    { id: "2", taskIds: ["2.1"], requires: ["1"], authority: "external", gates: [gateArgv], stop: "Stage complete",
      resultBudget: { minutes: 20, corrections: 1 } },
  ] };
}
