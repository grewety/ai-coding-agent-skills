import { createServer } from "node:http";
import { request as httpsRequest } from "node:https";
import { constants } from "node:fs";
import { chmod, lstat, open, unlink } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { safePath } from "./worker-handoff.mjs";
import { absolute, fields, need, parseStrictJson, utf8 } from "./review-inputs.mjs";

const maximumRequest = 2 * 1024 * 1024;
const maximumResponse = 8 * 1024 * 1024;
const destination = "api.anthropic.com";

export function credentialValue(bytes, format) {
  const source = utf8(bytes);
  let value;
  if (format === "raw") value = source.trim();
  if (format === "assignment") {
    const lines = source.split(/\r?\n/);
    const assignments = lines.filter((line) => /^[ \t]*(?:export[ \t]+)?ANTHROPIC_API_KEY(?:[ \t]*=|[ \t]*$)/.test(line));
    need(assignments.length === 1 && !/\\[\r\n]|[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(source),
      "Invalid explicit host key source");
    value = /^[ \t]*(?:export[ \t]+)?ANTHROPIC_API_KEY=(?:"([\w-]+)"|'([\w-]+)'|([\w-]+))[ \t]*$/
      .exec(assignments[0])?.slice(1).find(Boolean);
  }
  need(typeof value === "string" && /^sk-ant-[A-Za-z0-9_-]{12,512}$/.test(value), "Invalid explicit host key source");
  return value;
}

export async function readHostKey(filename, format) {
  await safePath(filename);
  const handle = await open(filename, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const stat = await handle.stat();
    const mode = format === "raw" ? 0o400 : 0o600;
    const limit = format === "raw" ? 4096 : 64 * 1024;
    need(stat.isFile() && stat.uid === process.getuid() && (stat.mode & 0o7777) === mode &&
      stat.nlink === 1 && stat.size <= limit, "Unsafe explicit host key file");
    const bytes = Buffer.alloc(stat.size + 1);
    const { bytesRead } = await handle.read(bytes);
    const after = await lstat(filename);
    need(bytesRead === stat.size && after.dev === stat.dev && after.ino === stat.ino &&
      after.ctimeMs === stat.ctimeMs && after.size === stat.size, "Host key file changed");
    return credentialValue(bytes.subarray(0, bytesRead), format);
  } finally { await handle.close(); }
}

export function relayRequest(req, bytes, model, maxRequests) {
  need(req.method === "POST" && ["/v1/messages", "/v1/messages?beta=true",
    "/v1/messages/count_tokens", "/v1/messages/count_tokens?beta=true"].includes(req.url) &&
    req.headers["content-type"]?.split(";")[0] === "application/json" && !req.headers["content-encoding"] &&
    maxRequests > 0, "Relay route or quota denied");
  const payload = parseStrictJson(bytes);
  need(payload?.model === model && Array.isArray(payload.messages) && !Object.hasOwn(payload, "mcp_servers") &&
    (payload.max_tokens === undefined || (Number.isSafeInteger(payload.max_tokens) && payload.max_tokens > 0 && payload.max_tokens <= 32000)),
    "Relay inference payload denied");
  const headers = { "content-type": "application/json", "content-length": bytes.length, "anthropic-version": "2023-06-01" };
  const beta = req.headers["anthropic-beta"];
  if (beta !== undefined) {
    need(typeof beta === "string" && beta.length <= 1024 && /^[a-z0-9, -]+$/.test(beta), "Invalid inference feature header");
    headers["anthropic-beta"] = beta;
  }
  return headers;
}

async function serve(config) {
  fields(config, ["socket", "keyFile", "keyFormat", "model", "requestLimit", "socketMode"], "relay configuration");
  need(absolute(config.socket) && path.basename(config.socket) === "inference.sock" && absolute(config.keyFile) &&
    ["raw", "assignment"].includes(config.keyFormat) && typeof config.model === "string" &&
    [0o600, 0o660].includes(config.socketMode) && Number.isSafeInteger(config.requestLimit) &&
    config.requestLimit > 0 && config.requestLimit <= 4096, "Invalid host relay configuration");
  await safePath(config.socket, true);
  const key = await readHostKey(config.keyFile, config.keyFormat);
  let available = config.requestLimit;
  const connections = new Set();
  const upstreams = new Set();
  const server = createServer({ maxHeaderSize: 8192, requestTimeout: 10000, headersTimeout: 10000 }, async (req, res) => {
    const reject = () => {
      if (res.headersSent) res.destroy();
      else res.writeHead(403, { "content-type": "text/plain", connection: "close" }).end("Inference relay refused request");
    };
    try {
      need(available-- > 0, "Relay quota exhausted");
      const data = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        need(size <= maximumRequest, "Relay request size exceeded");
        data.push(chunk);
      }
      const body = Buffer.concat(data, size);
      const headers = relayRequest(req, body, config.model, available + 1);
      const upstream = httpsRequest({
        hostname: destination, servername: destination, port: 443, method: "POST", path: req.url,
        rejectUnauthorized: true, minVersion: "TLSv1.2", agent: false,
        headers: { ...headers, "x-api-key": key },
      });
      upstreams.add(upstream);
      const deadline = setTimeout(() => upstream.destroy(), 90000);
      upstream.on("close", () => { clearTimeout(deadline); upstreams.delete(upstream); });
      upstream.on("error", reject);
      res.on("close", () => upstream.destroy());
      upstream.on("response", (response) => {
        if (response.statusCode !== 200) {
          response.destroy();
          reject(); // Do not reflect redirects, headers, or provider error bodies.
          return;
        }
        const type = response.headers["content-type"];
        if (typeof type !== "string" || !/^(?:text\/event-stream|application\/json)(?:;|$)/.test(type)) {
          response.destroy();
          reject();
          return;
        }
        res.writeHead(200, { "content-type": type });
        let received = 0;
        response.on("data", (chunk) => {
          received += chunk.length;
          if (received > maximumResponse) { response.destroy(); res.destroy(); }
          else if (!res.write(chunk)) response.pause();
        });
        res.on("drain", () => response.resume());
        response.on("error", reject);
        response.on("end", () => res.end());
      });
      upstream.end(body);
    } catch { reject(); }
  });
  server.maxConnections = 8;
  server.on("connection", (socket) => {
    connections.add(socket);
    socket.setTimeout(100000, () => socket.destroy());
    socket.on("close", () => connections.delete(socket));
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.socket, resolve);
  });
  await chmod(config.socket, config.socketMode);
  const statSocket = await lstat(config.socket);
  const close = async () => {
    for (const upstream of upstreams) upstream.destroy();
    for (const socket of connections) socket.destroy();
    await new Promise((resolve) => server.close(resolve));
    const remaining = await lstat(config.socket).catch(() => null);
    if (remaining?.ino === statSocket.ino && remaining.dev === statSocket.dev) await unlink(config.socket);
  };
  process.once("SIGTERM", () => { void close(); });
  if (process.connected) {
    process.once("disconnect", () => { void close(); });
    process.send({ ready: true });
  } else process.stdout.write("Inference relay ready\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.umask(0o077);
  try {
    const chunks = [];
    let total = 0;
    for await (const chunk of process.stdin) {
      total += chunk.length;
      need(total <= 8192, "Invalid relay setup size");
      chunks.push(chunk);
    }
    await serve(parseStrictJson(Buffer.concat(chunks)));
  } catch {
    process.stderr.write("Host inference relay setup failed\n");
    process.exitCode = 1;
    if (process.connected) process.disconnect();
  }
}
