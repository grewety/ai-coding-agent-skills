import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { hash } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-inputs.mjs";
import { auditPiStream } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-stream.mjs";
import { processFor, runtime } from "./review-tier1-fixture.mjs";

const capture = process.env.TIER1_PI_NATIVE_CAPTURE;
test("replays the unmodified pinned Pi 1.5.2 session from the synthetic SSE control", { skip: !capture }, async () => {
  const stdout = await readFile(capture);
  assert.equal(hash(stdout), "9b76308d7e4ef29696c0945c6c5b73d19dab870381f0cdd7fee30ce0fd65ae4c");
  const files = new Map([
    ["a.txt", Buffer.from("alpha fixture\nsecond line\n")],
    ["b.txt", Buffer.from("bravo fixture\nsecond line\n")],
  ]);
  assert.equal(auditPiStream({ ...processFor([]), stdout }, runtime, [...files.keys()], false, files, true),
    "Both synthetic fixtures were read completely.");
});

test("Pi bridge disables the unsupported store field on its pinned model", async () => {
  const bridge = await readFile(new URL(
    "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-sandbox-bridge.mjs", import.meta.url), "utf8");
  assert.match(bridge, /models: \[\{ id: "grok-4\.7"[^\n]*compat: \{ supportsStore: false \}/);
});

test("host Pi relay uses the private pinned Unix upstream, strips headers and consumes its request cap", async (t) => {
  const { spawn } = await import("node:child_process");
  const { once } = await import("node:events");
  const { chmod, lstat, mkdtemp, rm } = await import("node:fs/promises");
  const { createServer, request } = await import("node:http");
  const { tmpdir } = await import("node:os");
  const path = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const { requestTools } = await import("./review-tier1-fixture.mjs");
  const { verifyHermesProxySocket } = await import("../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-relay.mjs");
  const root = await mkdtemp(path.join(tmpdir(), "pi-r-"));
  const upstreamSocket = path.join(root, "hermes-xai.sock");
  const relaySocket = path.join(root, "inference.sock");
  let seen;
  const upstream = createServer(async (req, res) => {
    for await (const _ of req) {}
    seen = { url: req.url, headers: req.headers };
    res.writeHead(200, { "content-type": "text/event-stream", "x-upstream-private": "hidden" });
    res.end("data: " + JSON.stringify({ id: "fixture", created: 1, object: "chat.completion.chunk", model: runtime.model,
      system_fingerprint: "hidden", choices: [{ index: 0, delta: { content: "OK" }, finish_reason: "stop" }] }) + "\n\ndata: [DONE]\n\n");
  });
  try {
    const listening = once(upstream, "listening");
    upstream.listen(upstreamSocket);
    await listening;
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    if (["EPERM", "EACCES"].includes(error.code)) return t.skip("Unix socket bind unavailable in this sandbox");
    throw error;
  }
  let relay;
  t.after(async () => {
    try {
      if (relay && relay.exitCode === null && relay.signalCode === null) {
        const stopped = once(relay, "exit", { signal: AbortSignal.timeout(3000) });
        if (relay.connected) relay.disconnect();
        else relay.kill("SIGTERM");
        try {
          assert.deepEqual(await stopped, [0, null]);
        } catch (error) {
          relay.kill("SIGKILL");
          throw error;
        }
      }
    } finally {
      upstream.closeAllConnections();
      await new Promise((resolve) => upstream.close(resolve));
      await rm(root, { recursive: true, force: true });
    }
  });
  await chmod(upstreamSocket, 0o600);
  const stat = await lstat(upstreamSocket, { bigint: true });
  const pin = { path: upstreamSocket, device: String(stat.dev), inode: String(stat.ino) };
  await assert.rejects(verifyHermesProxySocket({ ...pin, inode: String(stat.ino + 1n) }), /Unverified/);
  await chmod(upstreamSocket, 0o660);
  await assert.rejects(verifyHermesProxySocket(pin), /Unverified/);
  await chmod(upstreamSocket, 0o600);
  relay = spawn(process.execPath, [fileURLToPath(new URL(
    "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-relay.mjs", import.meta.url))],
  { env: { HOME: "/nonexistent", PATH: "/usr/bin:/bin" }, stdio: ["pipe", "ignore", "ignore", "ipc"] });
  const signal = AbortSignal.timeout(3000);
  const ready = Promise.race([
    once(relay, "message", { signal }),
    once(relay, "exit", { signal }).then(() => assert.fail("relay exited before ready")),
  ]);
  relay.stdin.end(JSON.stringify({ socket: relaySocket, upstreamSocket: pin, route: runtime.route, model: runtime.model,
    allowedPaths: ["a.txt"], requestLimit: 1, socketMode: 0o600, timeoutMs: 1000, reasoningEffort: "off" }));
  const [event] = await ready;
  assert.deepEqual(event, { ready: true });
  const post = () => new Promise((resolve, reject) => {
    const req = request({ socketPath: relaySocket, method: "POST", path: "/v1/chat/completions", agent: false,
      headers: { "content-type": "application/json", authorization: "sandbox-sentinel" } }, async (res) => {
      const chunks = [];
      for await (const chunk of res) chunks.push(chunk);
      resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() });
    });
    req.on("error", reject);
    req.end(JSON.stringify({ model: runtime.model, messages: [{ role: "user", content: "fixture" }], stream: true, tools: requestTools }));
  });
  const result = await post();
  assert.equal(result.status, 200);
  assert.equal(result.headers["x-upstream-private"], undefined);
  assert.match(result.body, /"content":"OK"/);
  assert.doesNotMatch(result.body, /hidden/);
  assert.equal(seen.url, "/v1/chat/completions");
  assert.equal(seen.headers.authorization, undefined);
  assert.equal((await post()).status, 403);
});
