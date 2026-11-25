import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, realpath, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import os from "node:os";
import { planningLimits } from "../skills/software-development/openspec-delivery/scripts/planning-inventory.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const removed = [
  "application-records",
  "phased-plan-design",
  "phased-plan-execution",
  "phased-plan-closeout",
  "phased-plan-overview",
  "phased-plan-next",
  "phased-plan-refactoring",
];

async function absent(relative) {
  return stat(path.join(root, relative)).then(() => false, (error) => {
    if (error.code === "ENOENT") return true;
    throw error;
  });
}

test("this distribution no longer ships the phase packages", async () => {
  for (const name of removed) {
    assert.equal(await absent(path.join("skills/software-development", name)), true, name);
  }
});

const guard = fileURLToPath(new URL("../skills/software-development/openspec-delivery/scripts/change-guard.mjs", import.meta.url));
const change = "bounded-planning";
const planningRoot = `openspec/changes/${change}`;
const gitEnv = { PATH: process.env.PATH, GIT_CONFIG_NOSYSTEM: "1",
  GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : os.devNull };

function run(executable, args) {
  return spawnSync(executable, args, { env: gitEnv, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}
async function planningFixture(t) {
  const repo = await realpath(await mkdtemp(path.join(os.tmpdir(), "planning-budget-")));
  t.after(() => rm(repo, { recursive: true, force: true }));
  const git = (...args) => {
    const result = run("git", ["--no-optional-locks", "-C", repo, "-c", "user.name=Fixture", "-c",
      "user.email=fixture@example.invalid", ...args]);
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  git("init", "-b", "main");
  git("commit", "--allow-empty", "-m", "Integrated parent");
  const base = git("rev-parse", "HEAD");
  const specs = path.join(repo, planningRoot, "specs");
  await mkdir(path.join(specs, "demo"), { recursive: true });
  await Promise.all([
    writeFile(path.join(repo, "openspec/config.yaml"), "schema: spec-driven\n"),
    writeFile(path.join(repo, planningRoot, ".openspec.yaml"), "schema: spec-driven\n"),
    writeFile(path.join(repo, planningRoot, "proposal.md"), "# Fixture\n"),
    writeFile(path.join(repo, planningRoot, "tasks.md"), "# Tasks\n- [ ] 1.1 Test bounds\n"),
    writeFile(path.join(specs, "demo/spec.md"), "# Delta\n"),
  ]);
  const invoke = (command, ...args) => {
    const result = run(process.execPath, [guard, command, "--repo", repo, "--change", change, ...args]);
    assert.equal(result.error, undefined);
    return { status: result.status, ...JSON.parse(result.stdout) };
  };
  return { repo, specs, base, git, invoke };
}

const limitCases = [
  ["file count", /file limit/, async ({ specs }) => {
    await Promise.all(Array.from({ length: planningLimits.files }, (_, index) => writeFile(path.join(specs, `extra-${index}`), "x")));
  }],
  ["aggregate bytes", /aggregate byte limit/, async ({ specs }) => {
    const bytes = Buffer.alloc(3_600_000, 65);
    await Promise.all(Array.from({ length: 5 }, (_, index) => writeFile(path.join(specs, `large-${index}`), bytes)));
  }],
  ["path depth", /depth limit/, async ({ specs }) => {
    const deep = path.join(specs, ...Array.from({ length: planningLimits.depth }, () => "deep"));
    await mkdir(deep, { recursive: true });
    await writeFile(path.join(deep, "input"), "x");
  }],
  ["inventory output", /output limit/, async ({ specs }) => {
    const deep = path.join(specs, ...Array.from({ length: 5 }, (_, index) => String(index).repeat(200)));
    await mkdir(deep, { recursive: true });
    await Promise.all(Array.from({ length: 125 }, (_, index) => writeFile(path.join(deep, `input-${index}`), "x")));
  }],
];

for (const [label, reason, expand] of limitCases) {
  test(`Planning inventory refuses partial planning inventory at the ${label} limit`, async (t) => {
    const fixture = await planningFixture(t);
    const { base, git, invoke } = fixture;
    const normal = invoke("planning-worktree");
    assert.equal(normal.ok, true);
    assert.equal(normal.inventory.files, 5);
    await expand(fixture);
    const refuse = (result) => {
      assert.equal(result.status, 1, JSON.stringify(result));
      assert.match(result.error, reason);
      assert.equal(Object.hasOwn(result, "planDigest"), false);
      assert.equal(Object.hasOwn(result, "inputs"), false);
    };
    refuse(invoke("planning-worktree"));
    git("add", ".");
    git("commit", "-m", "Oversized planning inputs");
    const plan = git("rev-parse", "HEAD");
    refuse(invoke("planning", "--head", plan));
    refuse(invoke("policy-context", "--plan", plan, "--target", base));
    refuse(invoke("candidate", "--head", plan, "--plan", plan, "--base", base));
  });
}
