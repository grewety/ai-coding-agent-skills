import { test } from "node:test";
import assert from "node:assert/strict";
import { runBoundedWorker } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/bounded-worker.mjs";

const run = (script, limits = {}) => runBoundedWorker(process.execPath, ["-e", script], {
  cwd: process.cwd(), env: {}, timeoutMs: 3000, stdoutLimit: 1024, stderrLimit: 1024, ...limits,
});

test("native exit and independent supervisor outcomes remain distinct", async () => {
  const good = await run('console.log("ok")');
  assert.equal(good.outcome, "exit");
  assert.equal(good.code, 0);
  assert.equal(good.quiescent, true);
  for (const stream of ["stdout", "stderr"]) {
    const capped = await run(`process.${stream}.write("x".repeat(8192))`);
    assert.equal(capped.outcome, stream + "-quota");
    assert.equal(capped[stream].length, 1024);
    assert.equal(capped.quiescent, true);
  }
  const slow = await run("setInterval(() => {}, 1000)", { timeoutMs: 100 });
  assert.equal(slow.outcome, "timeout");
  assert.equal(slow.quiescent, true);
});

test("detached descendants after a successful leader exit prevent completion", async () => {
  const result = await run(`
    const child = require("node:child_process").spawn(process.execPath,
      ["-e", "setInterval(() => {}, 1000)"], {detached:true, stdio:"ignore"});
    child.unref();
  `);
  assert.equal(result.code, 0);
  assert.equal(result.outcome, "surviving-descendants");
  assert.equal(result.quiescent, true);
});
