// Runs inside the isolated network namespace. Only the mounted Unix socket has host egress.
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { connect, createServer } from "node:net";
import { constants } from "node:os";

for (const dirname of ["home", "config", "cache", "data", "state", "tmp"]) mkdirSync("/scratch/" + dirname, { mode: 0o700 });
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
  const child = spawn("/control/claude", process.argv.slice(2), {
    stdio: "inherit",
    env: { ...process.env, ANTHROPIC_BASE_URL: "http://127.0.0.1:" + server.address().port },
  });
  child.once("error", () => { server.close(); process.exitCode = 125; });
  child.once("exit", (code, signal) => {
    for (const socket of sockets) socket.destroy();
    server.close();
    if (signal) {
      process.removeAllListeners(signal);
      process.kill(process.pid, signal);
      process.exitCode = 128 + constants.signals[signal];
    } else process.exitCode = fault && code === 0 ? 125 : code;
  });
});
