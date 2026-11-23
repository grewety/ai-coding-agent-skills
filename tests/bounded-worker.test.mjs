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

const detached = (script) => `
  const child = require("node:child_process").spawn(process.execPath,
    ["-e", ${JSON.stringify(script)}], {detached:true, stdio:["ignore", 1, 2]});
  child.unref();
`;

test("opt-in teardown grace requires natural quiescence within the worker limits", async () => {
  const grace = { postLeaderGraceMs: 250 };
  const orderly = detached('setTimeout(() => console.log("teardown"), 50)');
  const result = await run(orderly, grace);
  assert.deepEqual({
    outcome: result.outcome, code: result.code, signal: result.signal,
    quiescent: result.quiescent, stdout: result.stdout.toString(),
  }, { outcome: "exit", code: 0, signal: null, quiescent: true, stdout: "teardown\n" });
  assert.equal((await run(orderly)).outcome, "surviving-descendants");
  for (const [script, outcome] of [
    ["setInterval(() => {}, 1000)", "surviving-descendants"],
    ['setTimeout(() => process.kill(process.pid, "SIGKILL"), 50)', "surviving-descendants"],
    ['setTimeout(() => process.stdout.write("x".repeat(8192)), 50)', "stdout-quota"],
  ]) {
    const refused = await run(detached(script), grace);
    assert.equal(refused.outcome, outcome);
    assert.equal(refused.quiescent, true);
  }
  const timedOut = await run(detached("setInterval(() => {}, 1000)"), { ...grace, timeoutMs: 150 });
  assert.equal(timedOut.outcome, "timeout");
  assert.equal(timedOut.quiescent, true);
});
