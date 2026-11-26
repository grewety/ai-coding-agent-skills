import { piReviewer } from "./agent-role-adapters.mjs";
import { classifyUpstream } from "./review-upstream-status.mjs";
import { createServer, request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { constants } from "node:fs";
import { chmod, lstat, open, unlink } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { safePath } from "./worker-handoff.mjs";
import { absolute, fields, need, parseStrictJson, relative, utf8 } from "./review-inputs.mjs";

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

const efforts = ["low", "medium", "high", "max"];

export function relayRequest(req, bytes, model, maxRequests, reasoningEffort) {
  need(req.method === "POST" && ["/v1/messages", "/v1/messages?beta=true",
    "/v1/messages/count_tokens", "/v1/messages/count_tokens?beta=true"].includes(req.url) &&
    req.headers["content-type"]?.split(";")[0] === "application/json" && !req.headers["content-encoding"] &&
    maxRequests > 0, "Relay route or quota denied");
  const payload = parseStrictJson(bytes);
  need(payload?.model === model && Array.isArray(payload.messages) && !Object.hasOwn(payload, "mcp_servers") &&
    (payload.max_tokens === undefined || (Number.isSafeInteger(payload.max_tokens) && payload.max_tokens > 0 && payload.max_tokens <= 32000)),
    "Relay inference payload denied");
  if (reasoningEffort !== undefined && !req.url.startsWith("/v1/messages/count_tokens")) {
    need(efforts.includes(reasoningEffort) && payload.output_config?.effort === reasoningEffort,
      "Relay inference request does not confirm the selected reasoning effort");
  }
  const headers = { "content-type": "application/json", "content-length": bytes.length, "anthropic-version": "2023-06-01" };
  const beta = req.headers["anthropic-beta"];
  if (beta !== undefined) {
    need(typeof beta === "string" && beta.length <= 1024 && /^[a-z0-9, -]+$/.test(beta), "Invalid inference feature header");
    headers["anthropic-beta"] = beta;
  }
  return headers;
}

const piId = (value) => typeof value === "string" && /^[\w.-]{1,128}$/.test(value);
const piCount = (value) => Number.isSafeInteger(value) && value >= 0;

function piReadArguments(args, allowed) {
  const value = typeof args === "string" && args.length <= 4096 && parseStrictJson(Buffer.from(args));
  fields(value, ["path"], "Pi whole-file inference arguments");
  const name = typeof value.path === "string" && value.path.startsWith("/review/") && value.path.slice(8);
  need(relative(name) && (!allowed || allowed.has(name)), "Pi inference Read path is outside the assigned packet");
}

function piChatContent(content) {
  return typeof content === "string" || Array.isArray(content) && content.every((part) => {
    fields(part, ["type", "text"], "Pi chat text");
    return part.type === "text" && typeof part.text === "string";
  });
}

const piReadProperties = ["path", "offset", "limit"];

export function piRelayRequest(req, bytes, model, allowed) {
  need(req.method === "POST" && req.url === "/v1/chat/completions" &&
    req.headers["content-type"]?.split(";")[0] === "application/json" && !req.headers["content-encoding"],
  "Pi inference route denied");
  const value = parseStrictJson(bytes);
  fields(value, ["model", "messages", "stream", "tools"], "Pi chat request",
    ["stream_options", "max_tokens", "max_completion_tokens", "temperature", "tool_choice", "parallel_tool_calls"]);
  need(value.model === model && value.stream === true && Array.isArray(value.messages) &&
    value.messages.length > 0 && Array.isArray(value.tools) && value.tools.length === 1 &&
    (value.tool_choice === undefined || value.tool_choice === "auto") &&
    (value.temperature === undefined || Number.isFinite(value.temperature) && value.temperature >= 0 && value.temperature <= 2) &&
    (value.parallel_tool_calls === undefined || value.parallel_tool_calls === true) &&
    [value.max_tokens, value.max_completion_tokens].every((limit) =>
      limit === undefined || Number.isSafeInteger(limit) && limit > 0 && limit <= 16384),
  "Pi inference payload or tools denied");
  if (value.stream_options !== undefined) {
    fields(value.stream_options, ["include_usage"], "Pi stream options");
    need(value.stream_options.include_usage === true, "Invalid Pi stream options");
  }
  const [tool] = value.tools;
  fields(tool, ["type", "function"], "Pi tools");
  fields(tool.function, ["name", "description", "parameters"], "Pi read function", ["strict"]);
  const { name, description, parameters, strict } = tool.function;
  need(tool.type === "function" && name === "read" && typeof description === "string" &&
    (strict === undefined || typeof strict === "boolean"), "Pi inference tools denied");
  fields(parameters, ["type", "required", "properties"], "Pi read parameters", ["additionalProperties"]);
  need(parameters.type === "object" && Array.isArray(parameters.required) && parameters.required.length === 1 &&
    parameters.required[0] === "path" && (parameters.additionalProperties === undefined || parameters.additionalProperties === false),
  "Pi inference tools denied");
  fields(parameters.properties, ["path"], "Pi read properties", ["offset", "limit"]);
  for (const key of piReadProperties) {
    const property = parameters.properties[key];
    if (property === undefined) continue;
    fields(property, ["type", "description"], "Pi read property");
    need(property.type === (key === "path" ? "string" : "number") && typeof property.description === "string", "Invalid Pi read property");
  }
  const calls = new Set();
  for (const message of value.messages) {
    const role = message?.role;
    need(["system", "developer", "user", "assistant", "tool"].includes(role), "Pi chat history has an unauthorized role");
    fields(message, ["role", ...(role === "assistant" ? [] : ["content"]), ...(role === "tool" ? ["tool_call_id"] : [])],
      "Pi chat message", role === "assistant" ? ["content", "tool_calls"] : []);
    need(piChatContent(message.content) || role === "assistant" && message.content == null, "Invalid Pi chat message content");
    if (role === "tool") need(calls.delete(message.tool_call_id), "Unpaired Pi chat tool result");
    if (message.tool_calls === undefined) continue;
    need(Array.isArray(message.tool_calls) && message.tool_calls.length > 0, "Invalid Pi chat tools");
    for (const call of message.tool_calls) {
      fields(call, ["id", "type", "function"], "Pi chat tool");
      fields(call.function, ["name", "arguments"], "Pi chat function");
      need(call.type === "function" && piId(call.id) && !calls.has(call.id) && call.function.name === "read", "Pi chat tool denied");
      piReadArguments(call.function.arguments, allowed);
      calls.add(call.id);
    }
  }
  need(calls.size === 0, "Incomplete Pi chat tool results");
  return { "content-type": "application/json", "content-length": bytes.length };
}

function piTokenUsage(usage) {
  fields(usage, ["prompt_tokens", "completion_tokens", "total_tokens"], "Pi inference usage",
    ["prompt_tokens_details", "completion_tokens_details"]);
  for (const key of ["prompt_tokens", "completion_tokens", "total_tokens"]) {
    need(piCount(usage[key]), "Invalid Pi inference usage");
  }
  for (const [key, optional] of [
    ["prompt_tokens_details", ["cached_tokens", "audio_tokens"]],
    ["completion_tokens_details", ["reasoning_tokens", "audio_tokens", "accepted_prediction_tokens", "rejected_prediction_tokens"]],
  ]) {
    if (usage[key] === undefined || usage[key] === null) continue;
    fields(usage[key], [], "Pi inference token details", optional);
    need(Object.values(usage[key]).every((count) => count === null || piCount(count)), "Invalid Pi inference token details");
  }
}

export function piInferenceFrames(model, allowed) {
  let pending = Buffer.alloc(0);
  let done = false;
  let finish;
  const calls = new Map();
  const ids = new Set();
  const accepted = [];

  function frame(value) {
    fields(value, ["id", "object", "created", "model", "choices"], "Pi inference frame",
      ["usage", "system_fingerprint", "service_tier"]);
    need(piId(value.id) && piCount(value.created) && value.object === "chat.completion.chunk" && value.model === model &&
      Array.isArray(value.choices) && value.choices.length <= 1 &&
      [value.system_fingerprint, value.service_tier].every((entry) => entry == null || piId(entry)), "Unexpected Pi inference response");
    if (value.usage != null) piTokenUsage(value.usage);
    // Retain only protocol data used by the pinned client.
    delete value.system_fingerprint;
    delete value.service_tier;
    if (!value.choices.length) return;
    const [choice] = value.choices;
    fields(choice, ["index", "delta", "finish_reason"], "Pi completion choice", ["logprobs"]);
    need(!finish && choice.index === 0 && [null, "stop", "tool_calls"].includes(choice.finish_reason) &&
      choice.logprobs == null, "Unexpected Pi completion choice");
    delete choice.logprobs;
    const { delta } = choice;
    fields(delta, [], "Pi completion delta", ["role", "content", "tool_calls", "refusal"]);
    need((delta.role === undefined || delta.role === "assistant") &&
      (delta.content == null || typeof delta.content === "string") && delta.refusal == null, "Unexpected Pi completion delta");
    delete delta.refusal;
    if (delta.tool_calls !== undefined) {
      need(Array.isArray(delta.tool_calls) && delta.tool_calls.length > 0, "Invalid Pi inference tool calls");
      for (const call of delta.tool_calls) {
        fields(call, ["index", "function"], "Pi inference tool call", ["id", "type"]);
        fields(call.function, [], "Pi inference function", ["name", "arguments"]);
        need(piCount(call.index) && call.index < 128 && (call.type === undefined || call.type === "function") &&
          (call.function.arguments === undefined || typeof call.function.arguments === "string"), "Invalid Pi inference tool call");
        let current = calls.get(call.index);
        if (!current) {
          need(piId(call.id) && !ids.has(call.id) && call.type === "function" && call.function.name === "read", "Pi inference tool denied");
          ids.add(call.id);
          current = { id: call.id, args: "" };
          calls.set(call.index, current);
        } else need((call.id === undefined || call.id === current.id) &&
          (call.function.name === undefined || call.function.name === "read"), "Pi inference tool changed");
        current.args += call.function.arguments ?? "";
        need(current.args.length <= 4096, "Oversized Pi inference arguments");
      }
    }
    if (choice.finish_reason) finish = choice.finish_reason;
  }

  return {
    write(chunk) {
      pending = Buffer.concat([pending, chunk]);
      let newline;
      while ((newline = pending.indexOf(10)) >= 0) {
        need(newline <= 256 * 1024 && accepted.length < 65536, "Oversized Pi inference frame");
        const line = utf8(pending.subarray(0, newline)).replace(/\r$/, "");
        pending = pending.subarray(newline + 1);
        if (line === "") continue;
        need(!done && line.startsWith("data: "), "Unexpected Pi inference frame");
        if (line === "data: [DONE]") {
          need(finish === (calls.size ? "tool_calls" : "stop"), "Incomplete Pi inference response");
          for (const call of calls.values()) piReadArguments(call.args, allowed);
          done = true;
          accepted.push(line + "\n\n");
        } else {
          const value = parseStrictJson(Buffer.from(line.slice(6)));
          frame(value);
          accepted.push("data: " + JSON.stringify(value) + "\n\n");
        }
      }
      need(pending.length <= 256 * 1024, "Oversized Pi inference frame");
    },
    complete() { return done && pending.length === 0; },
    output() { return accepted.join(""); },
  };
}

export function validateHermesProxySocket(pin) {
  fields(pin, ["path", "device", "inode"], "host Hermes proxy socket pin");
  need(absolute(pin.path) && path.basename(pin.path) === "hermes-xai.sock" && Buffer.byteLength(pin.path) <= 107 &&
    typeof pin.device === "string" && /^\d{1,20}$/.test(pin.device) &&
    typeof pin.inode === "string" && /^[1-9]\d{0,19}$/.test(pin.inode), "Invalid host Hermes proxy socket pin");
}

export async function verifyHermesProxySocket(pin) {
  validateHermesProxySocket(pin);
  await safePath(pin.path);
  const directory = path.dirname(pin.path);
  const parent = await lstat(directory);
  const stat = await lstat(pin.path, { bigint: true });
  need(parent.uid === process.getuid() && (parent.mode & 0o7777) === 0o700 && stat.isSocket() &&
    stat.uid === BigInt(process.getuid()) && (stat.mode & 0o7777n) === 0o600n && stat.nlink === 1n &&
    String(stat.dev) === pin.device && String(stat.ino) === pin.inode, "Unverified host Hermes proxy socket");
}

function refuse(res) {
  if (res.destroyed) return;
  if (res.headersSent) res.destroy();
  else res.writeHead(403, { "content-type": "text/plain", connection: "close" }).end("Inference relay refused request");
}

// Node can emit errors after forwarding has finished or a stream is destroyed.
function ignoreLateError() {}

export function forwardInference(upstream, res, body, timeoutMs, observe = () => {}, frames) {
  const idleMs = Math.min(timeoutMs, 90000);
  let response;
  let idle;
  let finished = false;
  let received = 0;
  const resume = () => response.resume();
  const resetIdle = () => {
    clearTimeout(idle);
    idle = setTimeout(fail, idleMs);
  };
  const data = (chunk) => {
    resetIdle();
    received += chunk.length;
    try {
      need(received <= maximumResponse, "Inference response limit exceeded");
      if (frames) frames.write(chunk);
      else if (!res.write(chunk)) response.pause();
    } catch { fail(); }
  };
  const cleanup = () => {
    finished = true;
    clearTimeout(deadline);
    clearTimeout(idle);
    res.off("drain", resume);
    res.off("close", abort);
    response?.off("data", data);
    upstream.on("error", ignoreLateError);
    upstream.off("error", fail);
    response?.on("error", ignoreLateError);
    response?.off("error", fail);
  };
  const abort = () => {
    cleanup();
    response?.destroy();
    upstream.destroy();
  };
  function fail() {
    if (finished) return;
    abort();
    if (frames) observe("inference-relay-refused");
    refuse(res);
  }
  const deadline = setTimeout(fail, timeoutMs);
  upstream.once("close", fail);
  upstream.on("error", fail);
  res.once("close", abort);
  upstream.once("response", (incoming) => {
    if (finished) {
      incoming.on("error", ignoreLateError);
      incoming.destroy();
      return;
    }
    response = incoming;
    response.on("error", fail);
    response.once("close", fail);
    // Reject redirects and provider errors without forwarding their headers or bodies.
    const type = response.headers["content-type"];
    if (response.statusCode !== 200 || typeof type !== "string" ||
        !(frames ? /^text\/event-stream(?:;|$)/ : /^(?:text\/event-stream|application\/json)(?:;|$)/).test(type)) {
      const classification = classifyUpstream(response.statusCode);
      if (classification) observe(classification);
      fail();
      return;
    }
    res.writeHead(200, { "content-type": frames ? "text/event-stream" : type });
    resetIdle();
    res.on("drain", resume);
    response.once("end", () => {
      if (finished) return;
      if (frames && !frames.complete()) { fail(); return; }
      cleanup();
      res.end(frames?.output());
    });
    response.on("data", data);
  });
  if (res.destroyed) abort();
  else {
    try { upstream.end(body); }
    catch { fail(); }
  }
}

export function validateRelayConfig(config) {
  const pi = config?.route === piReviewer.relay;
  fields(config, ["socket", "model", "requestLimit", "socketMode", "timeoutMs",
    ...(pi ? ["route", "upstreamSocket", "allowedPaths", "reasoningEffort"] : ["keyFile", "keyFormat"])],
    "relay configuration", pi ? [] : ["reasoningEffort"]);
  need(absolute(config.socket) && path.basename(config.socket) === "inference.sock" &&
    (pi ? config.model === piReviewer.model && config.socketMode === 0o600 &&
      config.requestLimit <= 128 && Array.isArray(config.allowedPaths) && config.allowedPaths.length <= 4096 &&
      config.allowedPaths.every(relative) && new Set(config.allowedPaths).size === config.allowedPaths.length :
      absolute(config.keyFile) && ["raw", "assignment"].includes(config.keyFormat) && typeof config.model === "string") &&
    [0o600, 0o660].includes(config.socketMode) && Number.isSafeInteger(config.requestLimit) &&
    config.requestLimit > 0 && config.requestLimit <= 4096 &&
    Number.isSafeInteger(config.timeoutMs) && config.timeoutMs >= 1000 && config.timeoutMs <= 300000 &&
    (pi ? config.reasoningEffort === piReviewer.effort : config.reasoningEffort === undefined || efforts.includes(config.reasoningEffort)),
    "Invalid host relay configuration");
  if (pi) {
    validateHermesProxySocket(config.upstreamSocket);
    need(config.upstreamSocket.path !== config.socket, "Hermes proxy socket aliases inference socket");
  }
}

async function serve(config) {
  validateRelayConfig(config);
  await safePath(config.socket, true);
  const pi = config.route === piReviewer.relay;
  if (pi) await verifyHermesProxySocket(config.upstreamSocket);
  const allowed = pi ? new Set(config.allowedPaths) : undefined;
  const key = pi ? null : await readHostKey(config.keyFile, config.keyFormat);
  const observe = (upstreamStatus) => { if (process.connected) process.send({ upstreamStatus }, () => {}); };
  let available = config.requestLimit;
  const connections = new Set();
  const upstreams = new Set();
  const server = createServer({ maxHeaderSize: 8192, requestTimeout: 10000, headersTimeout: 10000 }, async (req, res) => {
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
      if (pi) await verifyHermesProxySocket(config.upstreamSocket);
      const upstream = pi ? httpRequest({
        socketPath: config.upstreamSocket.path, method: "POST", path: "/v1/chat/completions", agent: false,
        headers: piRelayRequest(req, body, config.model, allowed),
      }) : httpsRequest({
        hostname: destination, servername: destination, port: 443, method: "POST", path: req.url,
        rejectUnauthorized: true, minVersion: "TLSv1.2", agent: false,
        headers: { ...relayRequest(req, body, config.model, available + 1, config.reasoningEffort), "x-api-key": key },
      });
      upstreams.add(upstream);
      upstream.once("close", () => upstreams.delete(upstream));
      forwardInference(upstream, res, body, config.timeoutMs, observe, pi ? piInferenceFrames(config.model, allowed) : undefined);
    } catch {
      if (pi) observe("inference-relay-refused");
      refuse(res);
    }
  });
  server.maxConnections = 8;
  server.setTimeout(config.timeoutMs + 10000, (socket) => socket.destroy());
  server.on("connection", (socket) => {
    connections.add(socket);
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
    process.on("message", (event) => {
      if (Number.isSafeInteger(event?.barrier) && event.barrier > 0 && process.connected) {
        process.send({ barrier: event.barrier }, () => {});
      }
    });
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
      need(total <= 4 * 1024 * 1024, "Invalid relay setup size");
      chunks.push(chunk);
    }
    await serve(parseStrictJson(Buffer.concat(chunks)));
  } catch {
    process.stderr.write("Host inference relay setup failed\n");
    process.exitCode = 1;
    if (process.connected) process.disconnect();
  }
}
