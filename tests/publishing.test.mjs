import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { parse } from "yaml";
import { buildDistribution } from "../scripts/build-distribution.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const execFileAsync = promisify(execFile);

test("Pages artifact includes the hidden endpoint and Claude downloads", async (t) => {
  const manifest = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  assert.equal(manifest.scripts.build, "node scripts/build-distribution.mjs --out dist");
  const workflow = parse(await readFile(path.join(root, ".github/workflows/publish-skills.yml"), "utf8"));
  const archive = workflow.jobs.build.steps.find((step) => step.name === "Archive complete site");
  assert.ok(archive, "explicit archive step must preserve dot-directories");
  const scratch = await mkdtemp(path.join(os.tmpdir(), "skills-pages-"));
  t.after(() => rm(scratch, { recursive: true, force: true }));
  await buildDistribution({ root, output: path.join(scratch, "dist") });
  await execFileAsync("sh", ["-c", archive.run], { cwd: scratch, env: { ...process.env, RUNNER_TEMP: scratch } });
  const { stdout: inventory } = await execFileAsync("tar", ["-tf", path.join(scratch, "artifact.tar")], { encoding: "utf8" });
  assert.match(inventory, /\.well-known\/skills\/index\.json/);
  assert.match(inventory, /downloads\/openspec-development\.plugin\.zip/);
  assert.match(inventory, /downloads\/autonomous-orchestration\.plugin\.zip/);
  assert.match(inventory, /downloads\/delivery-operations\.plugin\.zip/);
  assert.match(inventory, /downloads\/release-train-supervisor\.zip/);
  assert.match(inventory, /downloads\/wiki-delivery-sync\.zip/);
  assert.match(inventory, /\.well-known\/skills\/release-train-supervisor\/references\/herdr\.md/);
  assert.match(inventory, /\.well-known\/skills\/wiki-delivery-sync\/references\/closeout\.md/);
  assert.match(inventory, /downloads\/openspec-delivery\.zip/);
  assert.match(inventory, /downloads\/index\.html/);
  assert.match(inventory, /(?:^|\/)downloads\/index\.json$/m);
  assert.doesNotMatch(inventory, /(?:^|\/)AGENTS\.md$/m);
});
