// Runs inside the isolated network namespace. Only the mounted Unix socket has host egress.
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { connect, createServer } from "node:net";
import { constants } from "node:os";

for (const dirname of ["home", "config", "cache", "data", "state", "tmp"]) mkdirSync("/scratch/" + dirname, { mode: 0o700 });
const args = process.argv.slice(2);
const pi = args[0] === "--pi-review";
if (pi) args.shift();
const sockets = new Set();
let fault = false;
const server = createServer((local) => {
  const relay = connect("/control/inference.sock");
  for (const socket of [local, relay]) sockets.add(socket);
  local.on("error", () => relay.destroy());
  relay.on("error", () => { fault = true; local.destroy(); });
  local.on("close", () => { sockets.delete(local); relay.destroy(); });
  relay.on("close", () => { sockets.delete(relay); local.destroy(); });
  local.pipe(relay).pipe(local);
});
server.maxConnections = 8;
server.once("error", () => { process.exitCode = 125; });
server.listen(0, "127.0.0.1", () => {
  const base = "http://127.0.0.1:" + server.address().port;
  if (pi) {
    mkdirSync("/scratch/config/pi", { mode: 0o700 });
    writeFileSync("/scratch/config/pi/models.json", JSON.stringify({ providers: {
      "xai-oauth": { api: "openai-completions", baseUrl: base + "/v1", apiKey: "relay-managed",
        models: [{ id: "grok-4.7", name: "grok-4.7", reasoning: false, input: ["text"], compat: { supportsStore: false },
          contextWindow: 131072, maxTokens: 16384, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } }] },
    } }), { mode: 0o600, flag: "wx" });
  }
  const child = spawn(pi ? "/control/node" : "/control/claude", pi ?
    ["/control/node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js", ...args] : args, {
    stdio: pi ? ["inherit", "inherit", "pipe"] : "inherit",
    env: pi ? process.env : { ...process.env, ANTHROPIC_BASE_URL: base },
  });
  if (pi) child.stderr.on("data", () => { fault = true; });
  child.once("error", () => { server.close(); process.exitCode = 125; });
  child.once(pi ? "close" : "exit", (code, signal) => {
    for (const socket of sockets) socket.destroy();
    server.close();
    if (signal) {
      process.removeAllListeners(signal);
      process.kill(process.pid, signal);
      process.exitCode = 128 + constants.signals[signal];
    } else process.exitCode = fault && code === 0 ? 125 : code;
  });
});
