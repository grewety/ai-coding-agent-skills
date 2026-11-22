import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import path from "node:path";
import { validateMetadata } from "../scripts/validate-openspec-metadata.mjs";

const name = "metadata-fixture-01arz3ndektsv4rrffq69g5fav";
const change = `openspec/changes/${name}`;
const existing = "openspec/specs/existing/spec.md";
const fresh = "openspec/specs/fresh/spec.md";
const existingDelta = `${change}/specs/existing/spec.md`;
const freshDelta = `${change}/specs/fresh/spec.md`;
const header = (artifact, extra = "") =>
  `---\nmetadata_version: 1\nartifact: ${artifact}\n${artifact === "spec" ? "" : `change: ${name}\n`}${extra}---\n`;
const requirement = (title, body) => `### Requirement: ${title}\n${body}\n\n#### Scenario: Fixture request\n- **WHEN** the fixture is exercised\n- **THEN** it respects the requirement\n`;
const baseline = requirement("Baseline behavior", "The system SHALL retain baseline behavior.");
const additional = requirement("Additional behavior", "The system SHALL expose additional behavior.");
const newBehavior = requirement("Fresh behavior", "The system SHALL provide the new fixture behavior.");
const purpose = "Provide an isolated fixture for checking spec updates and archive behavior.";
const current = (capability, requirements) =>
  header("spec", `capability: ${capability}\n`) +
  `# ${capability} Specification\n\n## Purpose\n${purpose}\n\n## Requirements\n\n${requirements}`;
const pristine = current("existing", baseline);
const existingAddition = `## ADDED Requirements\n\n${additional}`;
const freshAddition = `## Purpose\n${purpose}\n\n## ADDED Requirements\n\n${newBehavior}`;
const tasks = header("tasks") + "# Tasks\n\n## 1. Fixture\n- [ ] 1.1 Verify metadata interoperability\n";
const proposal = header("proposal", "github_issue: https://github.com/example/project/issues/40\n") +
  "# Proposal\n\n## Why\nVerify metadata interoperability using synthetic records.\n\n## What Changes\n- Extend an existing capability and add a fixture capability.\n\n## Impact\nOnly disposable fixture files.\n";
const design = header("design") + "# Design\n\n## Context\nSynthetic fixture for validation, sync and archive.\n";

function formatSpec(text, titles) {
  assert.match(text, /^# .+$/m);
  assert.equal([...text.matchAll(/^## Purpose$/gm)].length, 1, "exactly one Purpose heading");
  assert.equal([...text.matchAll(/^## Requirements$/gm)].length, 1, "exactly one Requirements heading");
  assert.ok(text.indexOf("## Purpose") < text.indexOf("## Requirements"), "Purpose precedes Requirements");
  assert.doesNotMatch(text, /^## (ADDED|MODIFIED|REMOVED|RENAMED) Requirements$/m);
  assert.deepEqual([...text.matchAll(/^### Requirement: (.*)$/gm)].map((m) => m[1]), titles);
  assert.equal([...text.matchAll(/^#### Scenario: Fixture request$/gm)].length, titles.length);
  assert.ok(text.endsWith("\n") && !text.includes("\r"), "LF output with final newline");
}

export async function lifecycle({ step, fixture, cli, inventory, root, putJson }) {
  const checkMetadata = (context) => validateMetadata({ root: context.cwd, requireIssue: true });
  const validate = async (context, subject, expected = 0) => {
    const output = await cli(context, ["validate", subject, "--strict", "--json", "--no-interactive"], expected);
    return { ...output, report: JSON.parse(output.stdout) };
  };
  const put = async ({ cwd }, relative, value) => {
    const file = path.join(cwd, relative);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, value);
  };
  const read = ({ cwd }, relative) => fs.readFile(path.join(cwd, relative), "utf8");
  const snapshot = async (context, label) =>
    putJson(path.join(context.base, `${label}.json`), await inventory(context.cwd));
  const seed = async (label) => {
    const context = await fixture(label);
    await put(context, "openspec/config.yaml", "schema: spec-driven\nrules:\n  specs:\n    - Preserve capability identity.\n");
    const scaffold = await cli(context, ["new", "change", name, "--json"]);
    JSON.parse(scaffold.stdout);
    await snapshot(context, "scaffold");
    await fs.cp(path.join(context.cwd, "openspec"), path.join(context.base, "scaffold-bytes"), { recursive: true });
    for (const [file, text] of Object.entries({
      [existing]: pristine,
      [existingDelta]: existingAddition,
      [freshDelta]: freshAddition,
      [`${change}/proposal.md`]: proposal,
      [`${change}/design.md`]: design,
      [`${change}/tasks.md`]: tasks,
    })) await put(context, file, text);
    await snapshot(context, "inputs");
    return context;
  };

  await step("strict validation of the repository OpenSpec tree in scratch", async () => {
    const context = await fixture("tracked");
    const copied = path.join(context.cwd, "openspec");
    await fs.cp(path.join(root, "openspec"), copied, { recursive: true, verbatimSymlinks: true });
    for (const entry of Object.values(await inventory(copied))) {
      assert.ok(!Object.hasOwn(entry, "link"), "repository OpenSpec inputs must be regular files or directories");
    }
    const specsRoot = path.join(copied, "specs");
    const currentSpecs = [];
    for (const capability of await fs.readdir(specsRoot, { withFileTypes: true })) {
      if (!capability.isDirectory()) continue;
      const files = await fs.readdir(path.join(specsRoot, capability.name), { withFileTypes: true });
      if (files.some((file) => file.name === "spec.md" && file.isFile())) {
        currentSpecs.push(capability.name);
      }
    }
    assert.ok(currentSpecs.length, "expected current capability specs");
    const specs = await validate(context, "--specs");
    const all = await validate(context, "--all");
    for (const { report } of [specs, all]) {
      for (const id of currentSpecs) {
        assert.ok(report.items.some((item) => item.id === id && item.valid), `Missing passing validation result: ${id}`);
      }
    }
    await validateMetadata({ root: context.cwd });
    await snapshot(context, "validated");
  });

  const context = await step("synthetic strict validation and independent metadata", async () => {
    const context = await seed("validation");
    await validate(context, name);
    await validate(context, "--all");
    await checkMetadata(context);

    const positive = await fixture("frontmatter");
    await fs.cp(path.join(context.cwd, "openspec"), path.join(positive.cwd, "openspec"), { recursive: true });
    await put(positive, existingDelta, header("delta-spec", "capability: existing\n") + existingAddition);
    await snapshot(positive, "inputs");
    await validate(positive, name);
    await assert.rejects(checkMetadata(positive), /delta spec must not have frontmatter by repository policy/);

    const invalid = await fixture("invalid");
    await fs.cp(path.join(context.cwd, "openspec"), path.join(invalid.cwd, "openspec"), { recursive: true });
    await put(invalid, existingDelta, "## ADDED Requirements\n\n### Requirement: Missing scenario\nThe system SHALL reject invalid structure.\n");
    await snapshot(invalid, "invalid-delta");
    const rejected = await validate(invalid, name, 1);
    assert.match(rejected.stdout, /scenario/i);
    // Structure and metadata are independent in the other direction too.
    await checkMetadata(invalid);
    const wrongIdentity = await fixture("wrong-identity");
    await fs.cp(path.join(context.cwd, "openspec"), path.join(wrongIdentity.cwd, "openspec"), { recursive: true });
    await put(wrongIdentity, existing, pristine.replace("capability: existing", "capability: wrong"));
    await snapshot(wrongIdentity, "inputs");
    await assert.rejects(checkMetadata(wrongIdentity), /capability must match existing/);

    const warning = await fixture("modified-warning");
    await fs.cp(path.join(context.cwd, "openspec"), path.join(warning.cwd, "openspec"), { recursive: true });
    await put(warning, existingDelta, `## MODIFIED Requirements\n\n${requirement("Missing baseline", "The system SHALL modify the missing baseline.")}`);
    await snapshot(warning, "inputs");
    const diagnostic = await validate(warning, name);
    const item = diagnostic.report.items.find((entry) => entry.id === name);
    assert.equal(item?.valid, true);
    assert.ok(item.issues.some(({ level, path: file, message }) =>
      level === "INFO" && file === "existing/spec.md" &&
      /Archive would refuse this delta: existing MODIFIED failed.*Missing baseline.*not found/.test(message)),
    "missing MODIFIED baseline must be reported as an archive refusal");
    const beforeWarningArchive = await inventory(warning.cwd);
    const refusedModification = await cli(warning, ["archive", name, "--yes"], 1);
    assert.match(refusedModification.stdout + refusedModification.stderr, /MODIFIED failed.*Missing baseline.*not found/);
    assert.deepEqual(await inventory(warning.cwd), beforeWarningArchive, "missing baseline archive must make no writes");

    const conflict = await fixture("conflicting-delta");
    await fs.cp(path.join(context.cwd, "openspec"), path.join(conflict.cwd, "openspec"), { recursive: true });
    await put(conflict, existingDelta, `## MODIFIED Requirements\n\n${baseline}\n## REMOVED Requirements\n\n### Requirement: Baseline behavior\n**Reason**: Synthetic conflict.\n`);
    await snapshot(conflict, "inputs");
    const before = await inventory(conflict.cwd);
    await validate(conflict, name, [0, 1]);
    const refused = await cli(conflict, ["archive", name, "--yes"], 1);
    assert.match(refused.stdout + refused.stderr, /conflict|both|multiple|duplicate/i);
    assert.deepEqual(await inventory(conflict.cwd), before, "conflicting archive must make no writes");
    return context;
  });

  await step("task discovery and progress", async () => {
    const apply = async () => JSON.parse((await cli(context, ["instructions", "apply", "--change", name, "--json"])).stdout);
    const pending = await apply();
    assert.deepEqual(pending.progress, { total: 1, complete: 0, remaining: 1 });
    assert.equal(pending.state, "ready");
    assert.equal(pending.tasks.length, 1);
    assert.equal(pending.tasks[0].description, "1.1 Verify metadata interoperability");
    assert.equal(pending.tasks[0].done, false);
    await put(context, `${change}/tasks.md`, tasks.replace("- [ ]", "- [x]"));
    await snapshot(context, "completed-task");
    const done = await apply();
    assert.deepEqual(done.progress, { total: 1, complete: 1, remaining: 0 });
    assert.equal(done.state, "all_done");
    assert.equal(done.tasks.length, 1);
    assert.equal(done.tasks[0].done, true);
  });

  await step("agent-driven sync inputs, formatting and post-sync metadata", async () => {
    const sync = await fixture("sync");
    await fs.cp(path.join(context.cwd, "openspec"), path.join(sync.cwd, "openspec"), { recursive: true });
    const status = JSON.parse((await cli(sync, ["status", "--change", name, "--json"])).stdout);
    assert.equal(status.planningHome.root, sync.cwd);
    const deltas = status.artifactPaths.specs.existingOutputPaths;
    assert.deepEqual([...deltas].sort(), [existingDelta, freshDelta].map((file) => path.join(sync.cwd, file)).sort());
    const instructions = JSON.parse((await cli(sync, ["instructions", "specs", "--change", name, "--json"])).stdout);
    assert.deepEqual(instructions.rules, ["Preserve capability identity."]);
    assert.equal(await read(sync, existingDelta), existingAddition);
    assert.equal(await read(sync, freshDelta), freshAddition);
    assert.equal(await read(sync, existing), pristine);
    await snapshot(sync, "before-sync");
    const originalChange = await inventory(path.join(sync.cwd, change));

    // Perform the two known fixture edits described by the pinned sync skill.
    // Status and instructions are native commands; the merge is an agent edit.
    await put(sync, existing, pristine + "\n" + additional);
    await put(sync, fresh, current("fresh", newBehavior));
    assert.deepEqual(await inventory(path.join(sync.cwd, change)), originalChange, "sync preserves active change bytes");
    formatSpec(await read(sync, existing), ["Baseline behavior", "Additional behavior"]);
    formatSpec(await read(sync, fresh), ["Fresh behavior"]);
    await validate(sync, "--all");
    await checkMetadata(sync);
    await snapshot(sync, "after-sync");
  });

  await step("native archive refusal, collision, merge formatting and metadata", async () => {
    const collision = await fixture("collision");
    await fs.cp(path.join(context.cwd, "openspec"), path.join(collision.cwd, "openspec"), { recursive: true });
    const beforePrompt = await inventory(collision.cwd);
    const prompt = await cli(collision, ["archive", name], 1);
    assert.match(prompt.stdout + prompt.stderr, /--yes/);
    assert.deepEqual(await inventory(collision.cwd), beforePrompt, "closed-stdin refusal must make no writes");
    // Seed adjacent UTC dates too, so crossing midnight cannot turn the
    // collision control into an authorized write to an unoccupied destination.
    for (const offset of [-1, 0, 1]) {
      const date = new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
      await put(collision, `openspec/changes/archive/${date}-${name}/sentinel.txt`, "Do not replace this existing archive.\n");
    }
    await snapshot(collision, "occupied-archive");
    const occupied = await inventory(collision.cwd);
    const blocked = await cli(collision, ["archive", name, "--yes"], 1);
    assert.match(blocked.stdout + blocked.stderr, /already exists|collision|destination/i);
    assert.deepEqual(await inventory(collision.cwd), occupied, "collision must preserve specs, active change and occupied archive");

    // Use an independent copy with no collision. The native archive operation
    // applies its own merge to pristine current specs.
    const archived = await fixture("archive");
    await fs.cp(path.join(context.cwd, "openspec"), path.join(archived.cwd, "openspec"), { recursive: true });
    const before = await inventory(path.join(archived.cwd, change));
    await snapshot(archived, "before-archive");
    const archive = await cli(archived, ["archive", name, "--yes"]);
    assert.match(archive.stdout + archive.stderr, /archived/i);
    const archiveRoot = path.join(archived.cwd, "openspec/changes/archive");
    const destinations = await fs.readdir(archiveRoot);
    assert.equal(destinations.length, 1);
    assert.match(destinations[0], new RegExp(`^\\d{4}-\\d{2}-\\d{2}-${name}$`));
    assert.deepEqual(await inventory(path.join(archiveRoot, destinations[0])), before, "archive preserves all change bytes");
    await assert.rejects(fs.lstat(path.join(archived.cwd, change)), { code: "ENOENT" });
    const merged = await read(archived, existing);
    assert.ok(merged.startsWith(header("spec", "capability: existing\n")), "archive preserves existing capability header");
    formatSpec(merged, ["Baseline behavior", "Additional behavior"]);
    const nativeFresh = await read(archived, fresh);
    formatSpec(nativeFresh, ["Fresh behavior"]);
    assert.doesNotMatch(nativeFresh, /^---|^(change|github_issue):/m);
    await snapshot(archived, "native-output");
    await assert.rejects(checkMetadata(archived), /fresh\/spec\.md: missing YAML frontmatter/);
    await put(archived, fresh, header("spec", "capability: fresh\n") + nativeFresh);
    await checkMetadata(archived);
    await validate(archived, "--all");
    const checked = await cli(archived, ["validate", "--archived", "--json", "--no-interactive"]);
    JSON.parse(checked.stdout);
    await snapshot(archived, "final");
  });
}
