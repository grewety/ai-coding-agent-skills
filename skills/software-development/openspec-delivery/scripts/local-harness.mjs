import { spawn } from "node:child_process";
import { constants, lstatSync, openSync, closeSync, fsyncSync, writeFileSync } from "node:fs";
import path from "node:path";
import { checkoutObservation, commit } from "./change-guard.mjs";
import { readBounded, scopedPath, separate, sha256 } from "./evidence-retention.mjs";
import { retainedExternalReservation } from "./external-verification.mjs";
import { need, observed } from "./operator-records.mjs";
import { checkHarnessResult, checkHarnessSeal, validateHarnessBinding } from "./harness-result.mjs";

const limit = 64 * 1024;
function hostFile(ref, excluded) {
  need(ref && typeof ref.file === "string" && excluded.every((root) => separate(root, ref.file)), "Host file overlaps candidate");
  const filename = scopedPath(ref.file);
  const st = lstatSync(filename);
  need(st.isFile() && st.nlink === 1 && (st.mode & 0o022) === 0 &&
    (process.getuid === undefined || [process.getuid(), 0].includes(st.uid)), "Host file is untrusted");
  const bytes = readBounded(filename, limit);
  need(sha256(bytes) === ref.sha256, "Host file SHA-256 mismatch");
  return bytes;
}

export function harnessConfiguration(hostConfiguration, excluded) {
  const host = JSON.parse(hostFile(hostConfiguration, excluded));
  need(host?.schemaVersion === 1, "Unsupported host.json version");
  const binding = host.localHarness;
  if (binding !== undefined && binding !== null) validateHarnessBinding(binding);
  return binding ?? null;
}

export function verifyLocalHarness({ hostConfiguration, harness, candidate, excluded, now }) {
  const binding = harnessConfiguration(hostConfiguration, excluded);
  if (!binding) {
    need(!harness, "Unexpected harness evidence without a host binding");
    return null;
  }
  const bytes = hostFile(harness, excluded);
  const result = checkHarnessSeal(bytes, { configurationSha256: hostConfiguration.sha256,
    harnessId: binding.id, candidate, maxAgeMs: binding.maxAgeMs, now });
  return { file: harness.file, sha256: harness.sha256, observedAt: result.observedAt };
}

const mcpRequest = (id, method, params) => ({ jsonrpc: "2.0", ...(id === null ? {} : { id }), method, params });

function invoke(binding, checkout, candidate) {
  const isMcp = binding.kind === "mcp";
  const spawnArgs = isMcp ? binding.args : [...binding.args, "--candidate", candidate];
  return new Promise((resolve, reject) => {
    const child = spawn(binding.executable, spawnArgs, { cwd: checkout, detached: process.platform !== "win32",
      env: { PATH: "/usr/bin:/bin", LANG: "C.UTF-8", HOME: "/nonexistent", GIT_OPTIONAL_LOCKS: "0" },
      stdio: [isMcp ? "pipe" : "ignore", "pipe", "ignore"] });
    let buffer = Buffer.alloc(0);
    let total = 0;
    let response;
    let failure;
    let ready = false;
    const stop = () => {
      try { if (child.pid && process.platform !== "win32") process.kill(-child.pid, "SIGKILL"); else child.kill("SIGKILL"); }
      catch (error) { if (error.code !== "ESRCH") failure ??= "Harness process cancellation failed"; }
    };
    const fail = (message) => { failure ??= message; stop(); };
    const deadline = setTimeout(() => fail("Harness deadline exceeded"), binding.timeoutMs);
    const send = (message) => child.stdin.write(JSON.stringify(message) + "\n");
    if (isMcp) {
      child.stdin.on("error", () => { if (!response) fail("MCP harness input failed"); });
      send(mcpRequest(1, "initialize", { protocolVersion: "2024-11-05", capabilities: {},
        clientInfo: { name: "openspec-delivery", version: "1.7.0" } }));
    }
    child.on("error", () => fail("Harness launch failed"));
    child.stdout.on("data", (chunk) => {
      total += chunk.length;
      if (total > limit) { fail("Harness output limit exceeded"); return; }
      buffer = Buffer.concat([buffer, chunk]);
      if (!isMcp) return;
      try {
        for (let end; (end = buffer.indexOf(10)) !== -1;) {
          const reply = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, end)));
          buffer = buffer.subarray(end + 1);
          need(reply.jsonrpc === "2.0" && !reply.error, "Invalid MCP harness response");
          if (reply.id === 1 && !ready) {
            need(reply.result?.protocolVersion === "2024-11-05" && reply.result.capabilities?.tools, "MCP harness did not negotiate tools");
            ready = true;
            send(mcpRequest(null, "notifications/initialized", {}));
            send(mcpRequest(2, "tools/call", { name: binding.tool, arguments: { candidate, checkout } }));
          } else if (reply.id === 2 && ready && !response) {
            need(reply.result?.isError !== true, "MCP harness reported an error");
            const content = reply.result?.content;
            response = reply.result?.structuredContent ??
              (content?.length === 1 && content[0].type === "text" ? JSON.parse(content[0].text) : null);
            need(response, "MCP harness returned no JSON result");
            stop();
          } else throw new Error("Unexpected MCP response");
        }
      } catch { fail("Invalid MCP harness response"); }
    });
    child.on("close", (code) => {
      stop();
      clearTimeout(deadline);
      try {
        need(!failure, failure);
        if (isMcp) need(response, "MCP harness stopped before a result");
        else {
          need(code === 0, "Local CLI harness failed");
          try { response = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer)); }
          catch { throw new Error("Local CLI harness returned invalid JSON"); }
        }
        resolve(response);
      } catch (error) { reject(error); }
    });
  });
}

export async function runLocalHarness(input, context) {
  const { repo, checkout, candidate, hostConfiguration, output, grant, external } = input;
  need(process.getuid, "Local harness execution requires a POSIX host with verifiable ownership");
  need(context.lowTouch, "Verified integrated parent has not adopted the local harness");
  commit(repo, candidate);
  const excluded = [repo, checkout];
  need(separate(repo, checkout) && separate(output, repo) && separate(output, checkout) &&
    separate(output, hostConfiguration.file), "Harness checkout and evidence must be isolated");
  const binding = harnessConfiguration(hostConfiguration, excluded);
  if (!binding) return { action: "disabled" };
  need(observed(grant) && grant.kind === "local-candidate-harness" && grant.policyRevision === context.parent &&
    grant.change === context.change && grant.candidate === candidate && grant.harnessId === binding.id &&
    grant.checkout === checkout && grant.exposure === binding.exposure && grant.exposureVerified === true &&
    grant.configurationSha256 === hostConfiguration.sha256,
  "Missing exact local harness authority");
  if (binding.exposure !== "local-only") {
    need(retainedExternalReservation(external) && external.reference !== grant.reference &&
      external.card.candidate === candidate && external.card.scope === "harness " + binding.id &&
      ["external-check", "paid-check"].includes(external.card.kind), "Separate harness run authority is required");
  }
  checkoutObservation(checkout, candidate, { detached: true });
  const parent = lstatSync(scopedPath(path.dirname(output)));
  need(parent.isDirectory() && (parent.mode & 0o077) === 0 && parent.uid === process.getuid(), "Expected private harness evidence root");
  const adapter = scopedPath(binding.executable);
  const adapterStat = lstatSync(adapter);
  need(excluded.every((root) => separate(root, adapter)) && (adapterStat.mode & 0o022) === 0 &&
    [0, process.getuid()].includes(adapterStat.uid) &&
    sha256(readBounded(adapter)) === binding.executableSha256, "Harness executable is not host-owned and pinned");
  // Exclusive output creation claims this local run before invocation.
  const descriptor = openSync(scopedPath(output, true), constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o400);
  try {
    const earliest = Date.now();
    const result = checkHarnessResult(await invoke(binding, checkout, candidate),
      { harnessId: binding.id, candidate, earliest });
    checkoutObservation(checkout, candidate, { detached: true });
    const bytes = Buffer.from(JSON.stringify({ schemaVersion: 1, configurationSha256: hostConfiguration.sha256,
      resultSha256: sha256(JSON.stringify(result)), result }) + "\n");
    need(bytes.length <= limit, "Harness seal exceeds evidence limit");
    writeFileSync(descriptor, bytes);
    fsyncSync(descriptor);
    return { action: "sealed", verdict: result.verdict, harness: { file: output, sha256: sha256(bytes) } };
  } finally { closeSync(descriptor); }
}
