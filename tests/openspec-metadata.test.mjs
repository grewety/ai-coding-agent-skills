import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { closeSync, mkdtempSync, openSync, readFileSync, rmSync } from "node:fs";
import { cp, mkdir, mkdtemp, open, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
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

test("exclusive worker runtime promotes the full native deltas with capability metadata", async () => {
  const change = "exclusive-worker-runtime-01m84dt53xh6x16nwwqebacz8m";
  const capabilities = new Map([["contained-independent-review", 3], ["exclusive-worker-runtime", 5], ["openspec-integration", 1]]);
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
  const deltaRoot = path.join(match.name === change ? changesRoot : archiveRoot, match.name, "specs");
  for (const [capability, requirements] of capabilities) {
    const [delta, current] = await Promise.all([
      readFile(path.join(deltaRoot, capability, "spec.md"), "utf8"),
      readFile(path.join(root, "openspec", "specs", capability, "spec.md"), "utf8"),
    ]);
    assert.ok(current.startsWith(header("spec", `capability: ${capability}\n`)));
    assert.equal(checkPromotion({ capability, delta, current }), requirements, capability);
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
