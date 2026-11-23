import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { hash, jsonBytes } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-inputs.mjs";
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
