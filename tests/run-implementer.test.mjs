import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { hash, jsonBytes } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-inputs.mjs";
import { pinnedFile, readState, trustedJson } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/implementer-state.mjs";
import { runtimeIdentity } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/implementer-runtime.mjs";

const cli = fileURLToPath(new URL("../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/run-implementer.mjs", import.meta.url));
const invoke = (...args) => spawnSync(process.execPath, [cli, ...args], { timeout: 4000, encoding: "utf8" });

test("candidate runtime identity is read-only and the implementer CLI has no argv or host override surface", async () => {
  const output = invoke("--runtime-identity");
  assert.equal(output.status, 0, output.stderr);
  assert.equal(JSON.parse(output.stdout).runtimeSha256, await runtimeIdentity());
  for (const args of [
    ["--runtime-identity", "--command"], ["--run", "--command", "/not-a-real-executable", "unexpected"],
    ["--inspect", "/unused.json", "0".repeat(64), "--registry", "/unused-registry"],
  ]) {
    const result = invoke(...args);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Invalid run-implementer CLI options/);
    assert.equal(result.stdout, "");
  }
});

test("invalid evidence path, unsealed input and changed SHA fail before any original-attempt operation", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "run-imp-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const bytes = jsonBytes({ schemaVersion: 1, assignments: [] });
  const unsealed = path.join(root, "unsealed.json");
  const sealed = path.join(root, "sealed.json");
  await writeFile(unsealed, bytes, { mode: 0o600 });
  await writeFile(sealed, bytes, { mode: 0o400 });
  for (const [pathname, sha, expected] of [
    ["../untrusted", hash(bytes), /Invalid independently retained locator/],
    [unsealed, hash(bytes), /not sealed/],
    [sealed, "0".repeat(64), /Trusted locator bytes changed/],
    [sealed, hash(bytes), /require one exact assignment/],
  ]) {
    const result = invoke("--inspect", pathname, sha);
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, expected);
  }
});


test("retained state and pin readers require canonical paths and a direct state filename", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "runtime-paths-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const directory = path.join(root, "private");
  const alias = path.join(root, "alias");
  await mkdir(directory, { mode: 0o700 });
  await symlink(directory, alias);
  const bytes = jsonBytes({ synthetic: true });
  const sha256 = hash(bytes);
  const target = path.join(directory, "owner.json");
  await writeFile(target, bytes, { mode: 0o400 });
  await symlink(target, path.join(directory, "linked.json"));
  for (const file of [null, "private/owner.json", `${directory}/../private/owner.json`, `${directory}//owner.json`,
    `${target}/`, path.join(alias, "owner.json"), path.join(directory, "linked.json")]) {
    await assert.rejects(trustedJson({ path: file, sha256 }), /Invalid|symlink|canonical/);
    await assert.rejects(pinnedFile({ path: file, sha256 }), /Invalid|symlink|canonical/);
  }
  for (const name of ["../private/owner.json", "./owner.json", "nested/../owner.json", target]) {
    await assert.rejects(readState(directory, name), /Invalid retained state filename/);
  }
  assert.deepEqual(await trustedJson({ path: target, sha256 }), { synthetic: true });
  assert.deepEqual(await readState(directory, "owner.json"), { synthetic: true });
  await pinnedFile({ path: target, sha256 });
});
