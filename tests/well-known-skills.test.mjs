import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildWellKnownSkills } from "../scripts/build-well-known-skills.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const expectedSkillNames = [
  "autonomous-implementation-review",
  "capability-wireframes",
  "git-commit-message",
  "openspec-delivery",
  "openspec-next",
];

function frontmatterField(source, name) {
  return source.match(new RegExp(`^${name}:\\s*(.+)$`, "m"))?.[1]?.trim() ?? null;
}

test("well-known build publishes every skill and all advertised files", async () => {
  const output = await mkdtemp(path.join(os.tmpdir(), "ai-blueprint-well-known-"));
  try {
    const result = await buildWellKnownSkills({ root, output });
    assert.deepEqual(result.skills.map((skill) => skill.name), expectedSkillNames);
    const html = await readFile(path.join(output, "index.html"), "utf8");
    assert.ok(html.includes("https://github.com/grewety/ai-coding-agent-skills#install-with-hermes"));
    assert.ok(!html.includes("https://github.com/forgegod/"));

    const endpoint = path.join(output, ".well-known", "skills");
    const index = JSON.parse(await readFile(path.join(endpoint, "index.json"), "utf8"));
    assert.deepEqual(index.skills, result.skills);

    for (const skill of index.skills) {
      assert.ok(skill.description, `${skill.name} has no public description`);
      assert.ok(skill.files.includes("SKILL.md"), `${skill.name} omits SKILL.md`);
      for (const file of skill.files) {
        const info = await stat(path.join(endpoint, skill.name, file));
        assert.ok(info.isFile(), `${skill.name} advertises a missing ${file}`);
      }
      const source = await readFile(path.join(endpoint, skill.name, "SKILL.md"), "utf8");
      assert.equal(frontmatterField(source, "name"), skill.name);
      assert.equal(frontmatterField(source, "description"), skill.description);
      const category = skill.name === "autonomous-implementation-review" ? "autonomous-ai-agents" : "software-development";
      for (const file of skill.files) {
        assert.deepEqual(await readFile(path.join(endpoint, skill.name, file)), await readFile(path.join(root, "skills", category, skill.name, file)));
      }
    }

    const next = index.skills.find(({ name }) => name === "openspec-next");
    assert.deepEqual([...next.files].sort(), ["SKILL.md", "references/routing.md", "scripts/next.mjs"]);

    const autonomous = index.skills.find((skill) => skill.name === "autonomous-implementation-review");
    const contract = await readFile(path.join(root, "skills/autonomous-ai-agents/AGENTS.md"), "utf8");
    const generatedList = contract.split("Confirm the generated package advertises")[1]?.split("Parent contract:")[0];
    assert.ok(generatedList, "category contract owns the complete generated-package list");
    const declaredFiles = [...generatedList.matchAll(/`((?:references|scripts|templates)\/[^`]+|SKILL\.md)`/g)].map((m) => m[1]);
    const reviewerFiles = [
      "references/review-candidate.md",
      "scripts/bounded-worker.mjs",
      "scripts/bounded-worker.py",
      "scripts/harness-result.mjs",
      "scripts/low-touch-policy.mjs",
      "scripts/planning-inventory.mjs",
      "scripts/review-admission.mjs",
      "scripts/review-archive.mjs",
      "scripts/review-candidate.mjs",
      "scripts/review-inputs.mjs",
      "scripts/review-preflight.mjs",
      "scripts/review-relay.mjs",
      "scripts/review-runtime-scratch.mjs",
      "scripts/review-runtime.mjs",
      "scripts/review-sandbox-bridge.mjs",
      "scripts/review-spend.mjs",
      "scripts/review-stream.mjs",
      "scripts/review-upstream-status.mjs",
    ];
    const implementerFiles = [
      "references/run-implementer.md",
      "references/worker-runtime.md",
      "scripts/implementer-bindings.mjs",
      "scripts/implementer-claims.mjs",
      "scripts/implementer-observations.mjs",
      "scripts/implementer-recovery.mjs",
      "scripts/implementer-runtime.mjs",
      "scripts/implementer-sandbox.mjs",
      "scripts/implementer-state.mjs",
      "scripts/implementer-supervisor.mjs",
      "scripts/implementer-supervisor.py",
      "scripts/run-implementer.mjs",
      "scripts/worker-runtime-policy.mjs",
    ];
    const roleFiles = ["adapter-qualification", "agent-configuration", "agent-discovery", "agent-role-adapters",
      "agent-role-config", "agent-setup", "detect-agents", "role-config", "runtime-version", "setup"]
      .map((name) => "scripts/" + name + ".mjs");
    assert.deepEqual(
      [...declaredFiles, ...reviewerFiles, ...implementerFiles].sort(),
      [...autonomous.files].sort(),
      "generated package must include exactly the declared files and worker support files",
    );
    assert.deepEqual(autonomous?.files, [
      ...reviewerFiles,
      ...implementerFiles,
      ...roleFiles,
      "references/claude-code-host.md",
      "references/claude-code-roles.md",
      "references/environment-passthrough.md",
      "references/herdr.md",
      "references/lifecycle-watch.md",
      "references/openspec.md",
      "references/portable-core.md",
      "references/profile-preparation.md",
      "references/terminal-adapters.md",
      "references/worker-handoff.md",
      "scripts/herdr_lifecycle_watch.mjs",
      "scripts/herdr_panes.py",
      "scripts/herdr-pane-state.mjs",
      "scripts/orchestration-core.mjs",
      "scripts/terminal-adapters.mjs",
      "scripts/worker-handoff.mjs",
      "SKILL.md",
      "templates/phase-implementer.md",
      "templates/phase-reviewer.md",
    ].sort((left, right) => left.localeCompare(right)));
    const integration = index.skills.find((skill) => skill.name === "openspec-delivery");
    assert.deepEqual(integration?.files, [
      ...roleFiles,
      "references/continuation.md",
      "references/delivery-policy.md",
      "references/delivery-runtime.md",
      "references/evidence-retention.md",
      "references/external-verification.md",
      "references/git-environment.md",
      "references/guard.md",
      "references/integration.md",
      "references/low-touch.md",
      "references/naming.md",
      "references/operator-workflow.md",
      "references/protected-finish.md",
      "references/recovery.md",
      "references/task-authoring.md",
      "references/ticket.md",
      "references/workspace.md",
      "scripts/change-guard.mjs",
      "scripts/change-name.mjs",
      "scripts/change-workspace.mjs",
      "scripts/delegated-delivery.mjs",
      "scripts/delivery-cli.mjs",
      "scripts/delivery-control.mjs",
      "scripts/delivery-policy.mjs",
      "scripts/delivery-status.mjs",
      "scripts/evidence-cli.mjs",
      "scripts/evidence-retention.mjs",
      "scripts/external-verification.mjs",
      "scripts/finish-readiness.mjs",
      "scripts/git-environment.mjs",
      "scripts/harness-result.mjs",
      "scripts/local-harness.mjs",
      "scripts/low-touch-policy.mjs",
      "scripts/operator-planning.mjs",
      "scripts/operator-records.mjs",
      "scripts/operator-status.mjs",
      "scripts/planning-inventory.mjs",
      "scripts/protected-finish.mjs",
      "SKILL.md",
    ].sort((left, right) => left.localeCompare(right)));
    // Independent of dynamic package discovery: both representation files are required.
    for (const file of roleFiles) {
      assert.deepEqual(await readFile(path.join(endpoint, "openspec-delivery", file)),
        await readFile(path.join(endpoint, "autonomous-implementation-review", file)));
    }
    for (const file of ["references/evidence-retention.md", "scripts/evidence-retention.mjs", "references/delivery-policy.md", "references/task-authoring.md", "scripts/delivery-policy.mjs"]) {
      assert.ok(integration.files.includes(file), `delivery inventory omits ${file}`);
      assert.ok((await stat(path.join(endpoint, "openspec-delivery", file))).isFile());
      assert.deepEqual(await readFile(path.join(endpoint, "openspec-delivery", file)), await readFile(path.join(root, "skills/software-development/openspec-delivery", file)));
    }
    for (const file of ["references/portable-core.md", "scripts/orchestration-core.mjs", "references/worker-handoff.md", "scripts/worker-handoff.mjs", "references/terminal-adapters.md", "scripts/terminal-adapters.mjs", "references/profile-preparation.md"]) {
      assert.deepEqual(await readFile(path.join(endpoint, "autonomous-implementation-review", file)), await readFile(path.join(root, "skills/autonomous-ai-agents/autonomous-implementation-review", file)));
    }
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});
