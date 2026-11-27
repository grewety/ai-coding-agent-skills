import assert from "node:assert/strict";
import { chmod, mkdtemp, readdir, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { schedulePackets, replayPacketSchedule } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-packet-scheduler.mjs";

export const startupLabels = ["claude", "Explore", "general-purpose", "Plan", "statusline-setup"];

export async function scratch(t) {
  const root = await mkdtemp(path.join(await realpath(tmpdir()), "review-test-"));
  t.after(async () => {
    async function restore(dir) {
      await chmod(dir, 0o700);
      for (const entry of await readdir(dir, { withFileTypes: true })) if (entry.isDirectory()) await restore(path.join(dir, entry.name));
    }
    await restore(root);
    await rm(root, { recursive: true, force: true });
  });
  return root;
}

if (!new URL(import.meta.url).search) {
  test("concurrent review settles siblings and prevents launches after a failure", async () => {
    const started = [];
    const ended = [];
    const second = Promise.withResolvers();
    const clock = { next: async () => true, remaining: () => 500 };
    const events = await schedulePackets(4, 2, clock, async (packet, begin, halt, stop) => {
      assert.ok(begin() > 0);
      started.push(packet);
      if (packet === 1) {
        await second.promise;
        halt();
      } else {
        second.resolve();
        await new Promise((resolve) => stop.addEventListener("abort", resolve, { once: true }));
      }
      ended.push(packet);
      return false;
    });
    assert.deepEqual(started, [1, 2]);
    assert.deepEqual(ended, [1, 2]);
    assert.equal(replayPacketSchedule(events, 2, [{ failure: "fixture" }, { failure: "canceled" }], true).failure, "fixture");
    assert.throws(() => replayPacketSchedule(events.slice(0, -1), 2, [{ failure: "fixture" }, { failure: "canceled" }], true), /settle/);
  });
}
