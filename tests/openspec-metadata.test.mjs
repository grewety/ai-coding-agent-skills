import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { closeSync, mkdtempSync, openSync, readFileSync, rmSync } from "node:fs";
import { cp, mkdir, mkdtemp, open, readFile, readdir, rename, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkPromotion } from "../skills/software-development/openspec-delivery/scripts/finish-readiness.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const script = path.join(root, "scripts/validate-openspec-metadata.mjs");
const change = "example-01arz3ndektsv4rrffq69g5fav";
const proposalPath = `openspec/changes/${change}/proposal.md`;
const header = (artifact, extra = "") => `---\nmetadata_version: 1\nartifact: ${artifact}\n${artifact === "spec" ? "" : `change: ${change}\n`}${extra}---\n`;
const proposal = header("proposal", "github_issue: https://github.com/example/project/issues/40\n") + "# Proposal\n\n## Why\nA synthetic fixture.\n";
function invoke(repo, ...args) {
  const capture = mkdtempSync(path.join(os.tmpdir(), "openspec-metadata-cli-"));
  let stdout;
  let stderr;
  try {
    const output = path.join(capture, "stdout.txt");
    const errors = path.join(capture, "stderr.txt");
    stdout = openSync(output, "wx", 0o600);
    stderr = openSync(errors, "wx", 0o600);
    const result = spawnSync(process.execPath, [script, "--root", repo, ...args], { stdio: ["ignore", stdout, stderr] });
    assert.ifError(result.error);
    return { status: result.status, stdout: readFileSync(output, "utf8"), stderr: readFileSync(errors, "utf8") };
  } finally {
    if (stdout !== undefined) closeSync(stdout);
    if (stderr !== undefined) closeSync(stderr);
    rmSync(capture, { recursive: true, force: true });
  }
}

async function deltaDirectory(change) {
  const { readdir } = await import("node:fs/promises");
  const changesRoot = path.join(root, "openspec", "changes");
  const archiveRoot = path.join(changesRoot, "archive");
  const archivedName = new RegExp(`^\\d{4}-\\d{2}-\\d{2}-${change}$`);
  const [active, archived] = await Promise.all([
    readdir(changesRoot, { withFileTypes: true }),
    readdir(archiveRoot, { withFileTypes: true }),
  ]);
  const matches = [...active.filter((entry) => entry.name === change),
    ...archived.filter((entry) => archivedName.test(entry.name))];
  assert.equal(matches.length, 1, `Expected exactly one active or archived copy of ${change}`);
  const [match] = matches;
  assert.ok(match.isDirectory(), `${match.name} must be a directory`);
  return path.join(match.name === change ? changesRoot : archiveRoot, match.name, "specs");
}

const adoptedDelivery = "low-touch-autonomous-delivery-01m88zpkktr16z02dh3wne3ppy";
const configurableBackends = "configurable-worker-and-reviewer-backends-01m8a1cfak28znhgw126kzxye4";
const testingOverhaul = "testing-overhaul-and-low-touch-friction-01m8b4nava84t4qbzm550nwy5n";
const tier1Reviewer = "tier1-non-claude-contained-reviewer-01m8by1bvkhr053edzgtt5t0cm";
const tieredContainment = "tiered-cross-platform-os-containment-01m8cnxjetveec864xxmbp7vyb";
const directCli = "direct-cli-reviewer-simplification-01m8deqc2446agfqswc0cb0gex";
const reviewProof = "review-proof-levels-policy-01m8evnwasn9sct0hwapqfchkt";
const currentSpecs = path.join(root, "openspec", "specs");
const requirement = /^### Requirement: ([^\n]+)\n[\s\S]*?(?=^#{1,3} |(?![\s\S]))/gm;

function readCapabilitySpec(specsRoot, capability) {
  return readFile(path.join(specsRoot, capability, "spec.md"), "utf8");
}

function withoutSupersededRequirements(delta, newerDelta, ...titles) {
  const modified = /^## MODIFIED Requirements\n([\s\S]*?)(?=^#{1,2} |(?![\s\S]))/m.exec(newerDelta);
  assert.ok(modified, "Expected a MODIFIED Requirements section in the superseding delta");
  const modifiedTitles = new Set(Array.from(modified[1].matchAll(requirement), ([, title]) => title));
  for (const title of titles) {
    assert.ok(modifiedTitles.has(title), `Expected an explicit modification of ${title}`);
  }
  const remaining = new Set(titles);
  const retained = delta.replace(requirement, (block, title) => remaining.delete(title) ? "" : block);
  assert.equal(remaining.size, 0, `Missing historical requirements: ${[...remaining].join(", ")}`);
  return retained;
}

async function checkHistoricalPromotion({ capability, delta, current, expected }) {
  const successor = await readCapabilitySpec(await deltaDirectory(directCli), capability);
  const superseded = new Set([...successor.matchAll(/^## (?:MODIFIED|REMOVED) Requirements\n([\s\S]*?)(?=^#{1,2} |(?![\s\S]))/gm)]
    .flatMap(([, section]) => [...section.matchAll(requirement)].map(([, title]) => title)));
  let replaced = 0;
  const retained = delta.replace(requirement, (block, title) => {
    if (!superseded.has(title)) return block;
    replaced++;
    return "";
  });
  const promoted = /^### Requirement: /m.test(retained) ? checkPromotion({ capability, delta: retained, current }) : 0;
  assert.equal(promoted + replaced, expected, capability);
}

test("exclusive worker runtime requirements keep exact content until superseded by a current delta", async () => {
  const [deltaRoot, adoptedRoot, backendsRoot] = await Promise.all([
    deltaDirectory("exclusive-worker-runtime-01m84dt53xh6x16nwwqebacz8m"),
    deltaDirectory(adoptedDelivery),
    deltaDirectory(configurableBackends),
  ]);
  for (const [capability, expected] of [["contained-independent-review", 2], ["exclusive-worker-runtime", 4], ["openspec-integration", 1]]) {
    let delta = await readCapabilitySpec(deltaRoot, capability);
    const current = await readCapabilitySpec(currentSpecs, capability);
    assert.ok(current.startsWith(header("spec", `capability: ${capability}\n`)));
    if (capability === "contained-independent-review") {
      const newerDelta = await readCapabilitySpec(adoptedRoot, capability);
      delta = withoutSupersededRequirements(delta, newerDelta, "Verified planning-path relocation for record-only closure");
    }
    if (capability === "exclusive-worker-runtime") {
      const newerDelta = await readCapabilitySpec(backendsRoot, capability);
      delta = withoutSupersededRequirements(delta, newerDelta, "Qualified paired worker bindings");
    }
    await checkHistoricalPromotion({ capability, delta, current, expected });
  }
});

test("low-touch delivery retains requirements until explicitly superseded, with capability metadata", async () => {
  const [deltaRoot, backendsRoot, overhaulRoot] = await Promise.all(
    [adoptedDelivery, configurableBackends, testingOverhaul].map(deltaDirectory),
  );
  for (const [capability, expected] of [["contained-independent-review", 4], ["openspec-integration", 4]]) {
    let delta = await readCapabilitySpec(deltaRoot, capability);
    const current = await readCapabilitySpec(currentSpecs, capability);
    assert.ok(current.startsWith(header("spec", `capability: ${capability}\n`)));
    if (capability === "openspec-integration") {
      const newerDelta = await readCapabilitySpec(backendsRoot, capability);
      delta = withoutSupersededRequirements(delta, newerDelta,
        "Optional candidate-bound local pre-PR harness", "Operator workflow guidance");
    }
    const overhaul = await readCapabilitySpec(overhaulRoot, capability);
    delta = withoutSupersededRequirements(delta, overhaul, ...(capability === "contained-independent-review"
      ? ["Bounded inter-packet pacing and private diagnostics"]
      : ["Immutable review identity", "Independent reviewer before merge",
        "Bounded paid contained-review authorization", "Standing zero-cost finish triggers"]));
    await checkHistoricalPromotion({ capability, delta, current, expected });
  }
});

test("configurable worker and reviewer backends retain exact requirements until explicitly superseded", async () => {
  const [deltaRoot, overhaulRoot, tier1Root, tieredRoot] = await Promise.all(
    [configurableBackends, testingOverhaul, tier1Reviewer, tieredContainment].map(deltaDirectory),
  );
  for (const [capability, expected] of [["contained-independent-review", 1], ["exclusive-worker-runtime", 2], ["openspec-integration", 3]]) {
    let [delta, current] = await Promise.all([
      readCapabilitySpec(deltaRoot, capability),
      readCapabilitySpec(currentSpecs, capability),
    ]);
    if (capability === "openspec-integration") {
      const overhaul = await readCapabilitySpec(overhaulRoot, capability);
      delta = withoutSupersededRequirements(delta, overhaul, "Operator workflow guidance", "Moderated external host discovery and setup");
    }
    if (capability === "contained-independent-review") {
      const newerDelta = await readCapabilitySpec(tier1Root, capability);
      delta = withoutSupersededRequirements(delta, newerDelta, "Contained Reviewer adapter and relay qualification");
      const tieredDelta = await readCapabilitySpec(tieredRoot, capability);
      const retained = withoutSupersededRequirements(delta, tieredDelta, "Probed OS containment");
      assert.doesNotMatch(retained, /^### Requirement: /m);
      // Verify the exact current modification of the last configurable-backend requirement.
      [delta] = tieredDelta.split("\n## ADDED Requirements\n", 1);
    }
    assert.ok(current.startsWith(header("spec", `capability: ${capability}\n`)));
    await checkHistoricalPromotion({ capability, delta, current, expected });
  }
});

test("Item 5.5 promotes every frozen requirement with its exact body and capability metadata", async () => {
  const [deltaRoot, tier1Root] = await Promise.all([testingOverhaul, tier1Reviewer].map(deltaDirectory));
  for (const [capability, expected] of [["contained-independent-review", 1], ["exclusive-worker-runtime", 2], ["openspec-integration", 11]]) {
    let [delta, current] = await Promise.all([
      readCapabilitySpec(deltaRoot, capability),
      readCapabilitySpec(currentSpecs, capability),
    ]);
    if (capability === "openspec-integration") {
      const discovery = /^### Requirement: Moderated external host discovery and setup\n[\s\S]*?(?=^#{1,3} |(?![\s\S]))/m;
      const newerDelta = await readCapabilitySpec(tier1Root, capability);
      const original = discovery.exec(delta)?.[0]?.trimEnd();
      const extended = discovery.exec(newerDelta)?.[0]?.trimEnd();
      assert.ok(original && extended?.startsWith(`${original}\n\n#### Scenario: `),
        "Tier 1 must preserve the entire Item 5.5 discovery requirement before its new scenarios");
      delta = delta.replace(original, () => extended);
    }
    await checkHistoricalPromotion({ capability, delta, current, expected });
    assert.ok(current.startsWith(header("spec", `capability: ${capability}\n`)));
    assert.ok(Buffer.byteLength(current) <= 65536, `${capability} must fit the pinned review export`);
  }
});

test("Tier 1 reviewer promotes both frozen deltas exactly within the review export limit", async () => {
  const deltaRoot = await deltaDirectory(tier1Reviewer);
  for (const capability of ["contained-independent-review", "openspec-integration"]) {
    const [delta, current] = await Promise.all([
      readCapabilitySpec(deltaRoot, capability),
      readCapabilitySpec(currentSpecs, capability),
    ]);
    await checkHistoricalPromotion({ capability, delta, current, expected: 1 });
    assert.ok(current.startsWith(header("spec", `capability: ${capability}\n`)));
    assert.ok(Buffer.byteLength(current) <= 65536, `${capability} must fit the pinned review export`);
  }
});

test("tiered containment promotes all three frozen deltas within the review export limit", async () => {
  const deltaRoot = await deltaDirectory(tieredContainment);
  for (const [capability, expected] of [["contained-independent-review", 4], ["exclusive-worker-runtime", 1], ["openspec-integration", 3]]) {
    const [delta, current] = await Promise.all([
      readCapabilitySpec(deltaRoot, capability),
      readCapabilitySpec(currentSpecs, capability),
    ]);
    await checkHistoricalPromotion({ capability, delta, current, expected });
    assert.ok(Buffer.byteLength(current) <= 65536, `${capability} must fit the pinned review export`);
  }
});

test("Direct-CLI promotes each frozen requirement and keeps the integration export within its budget", async () => {
  const deltaRoot = await deltaDirectory(directCli);
  const superseding = await readCapabilitySpec(await deltaDirectory(reviewProof), "contained-independent-review");
  for (const [capability, expected] of [["contained-independent-review", 12], ["exclusive-worker-runtime", 2], ["openspec-integration", 11]]) {
    const delta = await readCapabilitySpec(deltaRoot, capability);
    const current = await readCapabilitySpec(currentSpecs, capability);
    const retained = capability === "contained-independent-review" ?
      withoutSupersededRequirements(delta, superseding, "Strict offline review receipt replay") : delta;
    assert.equal(checkPromotion({ capability, delta: retained, current }) + (retained === delta ? 0 : 1), expected, capability);
    assert.ok(current.startsWith(header("spec", `capability: ${capability}\n`)));
    assert.ok(Buffer.byteLength(current) <= (capability === "openspec-integration" ? 63488 : 65536), capability);
  }
});
test("proof policy promotion is exact and every current spec fits its pinned export", async () => {
  const capability = "contained-independent-review";
  const delta = await readCapabilitySpec(await deltaDirectory(reviewProof), capability);
  const current = await readCapabilitySpec(currentSpecs, capability);
  assert.equal(checkPromotion({ capability, delta, current }), 6);
  const files = (await readdir(currentSpecs, { recursive: true })).filter((name) => path.basename(name) === "spec.md");
  assert.ok(files.includes(path.join("openspec-integration", "spec.md")));
  for (const name of files) {
    const limit = name === path.join("openspec-integration", "spec.md") ? 63_488 : 65_536;
    assert.ok((await readFile(path.join(currentSpecs, name))).length <= limit, name);
  }
});

async function fixture(t) {
  const repo = await mkdtemp(path.join(os.tmpdir(), "openspec-metadata-"));
  t.after(() => rm(repo, { recursive: true, force: true }));
  const files = {
    [proposalPath]: proposal,
    [`openspec/changes/${change}/design.md`]: header("design") + "# Design\nA fixture.\n",
    [`openspec/changes/${change}/tasks.md`]: header("tasks") + "# Tasks\n- [ ] 1.1 Verify\n",
    [`openspec/changes/${change}/specs/nested/example/spec.md`]: "## ADDED Requirements\n",
    "openspec/specs/nested/example/spec.md": header("spec", "capability: nested/example\n") + "# Example\n",
  };
  for (const [relative, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(repo, relative)), { recursive: true });
    await writeFile(path.join(repo, relative), content);
  }
  return { repo, files };
}

test("repository native artifacts follow the metadata contract", () => {
  const result = invoke(root);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(JSON.parse(result.stdout).files.length > 0);
});

test("metadata checker validates every native artifact without writes", async (t) => {
  const { repo, files } = await fixture(t);
  const result = invoke(repo, "--require-issue");
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.ok, true);
  assert.equal(output.files.length, Object.keys(files).length);
  for (const [relative, content] of Object.entries(files)) assert.equal(await readFile(path.join(repo, relative), "utf8"), content);
});

test("draft issue null is explicit and approval readiness requires a real URL shape", async (t) => {
  const { repo } = await fixture(t);
  await writeFile(path.join(repo, proposalPath), proposal.replace("https://github.com/example/project/issues/40", "null"));
  assert.equal(invoke(repo).status, 0);
  const pending = invoke(repo, "--require-issue");
  assert.equal(pending.status, 1);
  assert.match(pending.stderr, /github_issue.*required/);
});

test("archive moves retain exact identity and remain indexed at their new paths", async (t) => {
  const { repo, files } = await fixture(t);
  await writeFile(path.join(repo, proposalPath), proposal.replace("https://github.com/example/project/issues/40", "null"));
  const archived = `openspec/changes/archive/2026-10-30-${change}`;
  await mkdir(path.join(repo, "openspec/changes/archive"));
  await rename(path.join(repo, `openspec/changes/${change}`), path.join(repo, archived));
  const result = invoke(repo, "--require-issue");
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.files.length, Object.keys(files).length);
  assert.ok(output.files.includes(`${archived}/proposal.md`));
  await writeFile(path.join(repo, archived, "proposal.md"), proposal.replace(`change: ${change}`, `change: 2026-10-30-${change}`));
  assert.equal(invoke(repo).status, 1);
});

test("native artifacts directly under archive are invalid layouts, not a change named archive", async (t) => {
  const { repo } = await fixture(t);
  await mkdir(path.join(repo, "openspec/changes/archive"), { recursive: true });
  const stray = {
    "proposal.md": header("proposal", "github_issue: null\n") + "# Proposal\nA stray archive-root artifact.\n",
    "design.md": header("design") + "# Design\nA stray archive-root artifact.\n",
    "tasks.md": header("tasks") + "# Tasks\n- [ ] 1.1 Stray\n",
  };
  for (const [name, content] of Object.entries(stray)) {
    const target = path.join(repo, "openspec/changes/archive", name);
    await writeFile(target, content);
    const result = invoke(repo);
    assert.equal(result.status, 1, `${name} directly under archive must not be accepted`);
    assert.match(result.stderr, /archive\/[a-z]+\.md.*(?:archive layout|dated change)/, result.stderr);
    await rm(target);
  }
  // Supporting Markdown outside native artifact paths is not governed by this schema.
  const nested = path.join(repo, "openspec/changes/archive/2026-10-30-other-change/notes/proposal.md");
  await mkdir(path.dirname(nested), { recursive: true });
  await writeFile(nested, stray["proposal.md"]);
  const deep = invoke(repo);
  assert.equal(deep.status, 0, deep.stderr);
  // A dated archive entry that is a file rather than a directory is malformed too.
  await rm(path.join(repo, "openspec/changes/archive"), { recursive: true, force: true });
  await mkdir(path.join(repo, "openspec/changes/archive"));
  await writeFile(path.join(repo, "openspec/changes/archive/2026-10-30-stray"), "not a directory\n");
  const truncated = invoke(repo);
  assert.equal(truncated.status, 1);
  assert.match(truncated.stderr, /archive layout/);
});

test("one change identity may exist in exactly one active or dated archive location", async (t) => {
  const { repo } = await fixture(t);
  const archive = "openspec/changes/archive";
  await mkdir(path.join(repo, archive), { recursive: true });
  // Same identity active and archived is ambiguous, so both are refused.
  await cp(path.join(repo, `openspec/changes/${change}`), path.join(repo, archive, `2026-10-30-${change}`), { recursive: true });
  let result = invoke(repo);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /duplicate change identity/);
  // Two dated archives of the same identity are refused as well.
  await rm(path.join(repo, `openspec/changes/${change}`), { recursive: true });
  await cp(path.join(repo, archive, `2026-10-30-${change}`), path.join(repo, archive, `2026-10-29-${change}`), { recursive: true });
  result = invoke(repo);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /duplicate change identity/);
  await rm(path.join(repo, archive, `2026-10-29-${change}`), { recursive: true });
  // Empty duplicate directories still claim the identity, so they are refused too.
  await mkdir(path.join(repo, `openspec/changes/${change}`));
  result = invoke(repo);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /duplicate change identity/);
  await rm(path.join(repo, `openspec/changes/${change}`), { recursive: true });
  await mkdir(path.join(repo, archive, `2026-10-28-${change}`));
  result = invoke(repo);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /duplicate change identity/);
  await rm(path.join(repo, archive, `2026-10-28-${change}`), { recursive: true });
  assert.equal(invoke(repo, "--require-issue").status, 0, "a single dated archive move remains valid");
});

test("legacy unsuffixed change names stay valid while active and after an archive move", async (t) => {
  const { repo } = await fixture(t);
  const legacy = "legacy-change";
  const legacyHeader = (artifact, extra = "") => `---\nmetadata_version: 1\nartifact: ${artifact}\n${artifact === "spec" ? "" : `change: ${legacy}\n`}${extra}---\n`;
  const legacyDir = `openspec/changes/${legacy}`;
  await mkdir(path.join(repo, legacyDir, "specs/legacy"), { recursive: true });
  await writeFile(path.join(repo, legacyDir, "proposal.md"), legacyHeader("proposal", "github_issue: https://github.com/example/project/issues/41\n") + "# Proposal\nLegacy name.\n");
  await writeFile(path.join(repo, legacyDir, "design.md"), legacyHeader("design") + "# Design\nLegacy.\n");
  await writeFile(path.join(repo, legacyDir, "tasks.md"), legacyHeader("tasks") + "# Tasks\n- [ ] 1.1 Legacy\n");
  await writeFile(path.join(repo, legacyDir, "specs/legacy/spec.md"), "## ADDED Requirements\n");
  assert.equal(invoke(repo, "--require-issue").status, 0);
  await mkdir(path.join(repo, "openspec/changes/archive"), { recursive: true });
  await rename(path.join(repo, legacyDir), path.join(repo, "openspec/changes/archive/2026-10-30-legacy-change"));
  const archived = invoke(repo, "--require-issue");
  assert.equal(archived.status, 0, archived.stderr);
  assert.ok(JSON.parse(archived.stdout).files.includes("openspec/changes/archive/2026-10-30-legacy-change/proposal.md"));
});

test("opt-in upstream probe runs scratch controls offline", { skip: process.platform !== "linux" }, async (t) => {
  const scratch = await mkdtemp(path.join(os.tmpdir(), "openspec-offline-"));
  t.after(() => rm(scratch, { recursive: true, force: true }));
  const probe = path.join(root, "tests/openspec-cli-compatibility.mjs");
  const capturePath = path.join(scratch, "output");
  const capture = await open(capturePath, "wx");
  let result;
  try {
    result = spawnSync(process.execPath, [probe, "--offline-controls"], {
      env: { TMPDIR: scratch },
      stdio: ["ignore", capture.fd, capture.fd],
      timeout: 30_000,
    });
  } finally {
    await capture.close();
  }
  const output = await readFile(capturePath, "utf8");
  assert.ifError(result.error);
  assert.equal(result.status, 0, output);
  assert.match(output, /PASS offline controls/);
});

test("checker fails closed on empty sources, symlinks, invalid UTF-8 and malformed paths", async (t) => {
  const { repo } = await fixture(t);
  await writeFile(path.join(repo, proposalPath), Buffer.concat([Buffer.from(proposal), Buffer.from([0xff])]));
  assert.equal(invoke(repo).status, 1, "Invalid UTF-8 must not be replaced silently");
  await rm(path.join(repo, proposalPath));
  await writeFile(path.join(repo, "outside.md"), proposal);
  await symlink(path.join(repo, "outside.md"), path.join(repo, proposalPath));
  assert.equal(invoke(repo).status, 1);
  await rm(path.join(repo, proposalPath));
  await rename(path.join(repo, `openspec/changes/${change}`), path.join(repo, "openspec/changes/Bad Name"));
  assert.equal(invoke(repo).status, 1);
  await rm(path.join(repo, "openspec"), { recursive: true });
  await mkdir(path.join(repo, "openspec"));
  assert.equal(invoke(repo).status, 1, "Empty inventory is not successful validation");
  await rm(path.join(repo, "openspec"), { recursive: true });
  assert.equal(invoke(repo).status, 1);
});

test("repository metadata policy rejects frontmatter on otherwise native delta specs", async (t) => {
  const { repo } = await fixture(t);
  const { validateMetadata } = await import("../scripts/validate-openspec-metadata.mjs");
  const relative = `openspec/changes/${change}/specs/nested/example/spec.md`;
  assert.ok((await validateMetadata({ root: repo })).files.includes(relative));
  await writeFile(path.join(repo, relative), header("delta-spec", "capability: nested/example\n") + "## ADDED Requirements\n");
  await assert.rejects(validateMetadata({ root: repo }), /delta spec must not have frontmatter by repository policy/);
});

test("CLI rejects duplicate options and missing values", async (t) => {
  const { repo } = await fixture(t);
  for (const args of [["--root", repo], ["--require-issue", "--require-issue"], ["--root"], ["--unknown"], ["--root", "--require-issue"]]) {
    assert.equal(invoke(repo, ...args).status, 1, args.join(" "));
  }
});

test("metadata schema rejects drift, PRs, malformed issue URLs and ambiguous YAML", async (t) => {
  const { repo } = await fixture(t);
  const mutations = [
    proposal.replace("metadata_version: 1", 'metadata_version: "1"'),
    proposal.replace("metadata_version: 1", "metadata_version: 2"),
    proposal.replace("artifact: proposal", "artifact: design"),
    proposal.replace(`change: ${change}`, "change: other"),
    proposal.replace("artifact: proposal", "artifact: proposal\nstatus: done"),
    proposal.replace("artifact: proposal", "artifact: proposal\ngithub_prs: []"),
    proposal.replace("artifact: proposal", "artifact: proposal\nartifact: design"),
    proposal.replace("artifact: proposal", "artifact: &value proposal\nextra: *value"),
    proposal.replace("artifact: proposal", "artifact: ["),
    proposal.replace(/github_issue: .+\n/, ""),
    ...["40", "[]", "false", "https://github.com/example/project/pull/40", "http://github.com/example/project/issues/40", "https://github.com/example/project/issues/0", "https://github.com/example/project/issues/40#comment", "https://github.com/example/project/issues/40?x=y", "https://github.com/example/project/../issues/40", "https://github.com.evil.test/example/project/issues/40"].map((url) => proposal.replace(/github_issue: .+/, `github_issue: ${url}`)),
    "---\n- not-a-mapping\n---\n# Proposal\n",
    proposal.replace(/^---\n/, ""),
    proposal.replace(/---\n# Proposal[\s\S]*/, "---\n"),
  ];
  for (const source of mutations) {
    await writeFile(path.join(repo, proposalPath), source);
    const result = invoke(repo);
    assert.equal(result.status, 1, `Unexpected acceptance: ${source}`);
    assert.match(result.stderr, /proposal\.md/);
  }
  await writeFile(path.join(repo, proposalPath), proposal);
  const currentSpec = "openspec/specs/nested/example/spec.md";
  for (const extra of [`change: ${change}\n`, "github_issue: null\n", "capability: wrong\n"]) {
    await writeFile(path.join(repo, currentSpec), header("spec", `capability: nested/example\n${extra}`) + "# Spec\n");
    assert.equal(invoke(repo).status, 1, extra);
  }
});
