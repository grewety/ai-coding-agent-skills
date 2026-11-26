import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { validateHostConfig } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-runtime.mjs";

import { hash, jsonBytes } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-inputs.mjs";
export const startupLabels = ["claude", "Explore", "general-purpose", "Plan", "statusline-setup"];

export async function scratch(t) {
  const root = await mkdtemp(path.join(tmpdir(), "contained-review-test-"));
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

// This executable only emits synthetic stream events. It cannot invoke Claude or call a relay.
export async function fakeHost(root, behavior = "valid") {
  const node = await realpath(process.execPath);
  const launcher = path.join(root, "fixture-launcher-" + behavior);
  await writeFile(launcher, `#!${node}
const fs = require("node:fs");
const args = process.argv.slice(2);
if (args[0] === "--version") { fs.writeSync(1, "bubblewrap 0.9.0\\n"); process.exit(0); }
const arg = (flag) => args[args.indexOf(flag) + 1];
const policy = ["--unshare-all", "--unshare-user", "--disable-userns", "--clearenv", "--remount-ro", "--no-chrome", "--strict-mcp-config",
  "--no-session-persistence", "--disable-slash-commands", "--die-with-parent"];
if (!policy.every((flag) => args.includes(flag)) || arg("--permission-prompts") !== "none" ||
    arg("--tools") !== "Read" || arg("--allowedTools") !== "Read" ||
    args[args.indexOf("CLAUDE_CODE_DISABLE_BUILTIN_PLUGINS") + 1] !== "1") process.exit(31);
const prompt = fs.readFileSync(0, "utf8");
const probe = prompt.includes("REVIEW_PROBE_OK");
const model = arg("--model");
const session_id = arg("--session-id");
const emit = (event) => fs.writeSync(1, JSON.stringify({ ...event, session_id }) + "\\n");
const message = (type, content) => emit({ type, message: { content } });
const behavior = ${JSON.stringify(behavior)};
emit({ type: "system", subtype: "init", model: behavior === "probe-fails" && probe ? "wrong-model" : model,
  claude_code_version: "2.1.330", cwd: "/review", tools: ["Read"], permissionMode: "dontAsk",
  mcp_servers: [], skills: [], slash_commands: [], plugins: [], agents: ${JSON.stringify(startupLabels)} });
const lines = prompt.split("\\n");
const assigned = lines.filter((line) => line.startsWith("/review/"));
if (behavior !== "no-coverage") assigned.forEach((file_path, index) => {
  const id = String(index);
  const root = args[args.indexOf("/review") - 1];
  const content = fs.readFileSync(root + file_path.slice("/review".length), "utf8");
  message("assistant", [{ type: "tool_use", id, name: "Read", input: { file_path } }]);
  const numLines = content ? content.split("\\n").length : 0;
  emit({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: id, content }] },
    tool_use_result: { type: "text", file: { filePath: file_path, content, numLines, startLine: 1, totalLines: numLines } } });
});
const verdict = "Verdict: No findings";
if (!probe && (lines.at(-5) !== "BEGIN_REVIEW_RECEIPT" || lines.at(-1) !== "END_REVIEW_RECEIPT")) process.exit(32);
const input = probe ? null : JSON.parse(lines.at(-2));
const reference = lines.find((line) => line.startsWith("Native reference: "))?.slice(18);
const candidate = input?.target;
const value = candidate
  ? { target: candidate, packet: Number(lines.find((line) => line.startsWith("Packet: ")).split(" ")[1]),
      findings: [], coverageLimitations: [] }
  : { identity: input?.identity, readOnly: true, reference, verdict, findings: [], observations: [],
      coverageLimitations: behavior === "packet-gap" ? [{ class: "packet-gap", detail: "fixture gap" }] : [], ledgerChecks: [] };
if (behavior === "wrong-second-sha" && candidate && value.packet === 2) value.target = "f".repeat(40);
const result = probe ? "REVIEW_PROBE_OK" : behavior === "bad-receipt" || (behavior === "retry" && !reference.includes("retried"))
  ? "malformed fixture receipt" : ["Reviewed the assigned fixture files.", "BEGIN_REVIEW_RECEIPT", verdict,
    candidate ? "Target: " + candidate : "Policy: charter-v1", JSON.stringify(value), "END_REVIEW_RECEIPT"].join("\\n");
message("assistant", [{ type: "text", text: result }]);
emit({ type: "result", subtype: "success", is_error: false, num_turns: 1, total_cost_usd: 0, permission_denials: [], result });
`, { mode: 0o700 });
  const keyFile = path.join(root, "fixture-key");
  await writeFile(keyFile, "EXAMPLE=true\nANTHROPIC_API_KEY=sk-" + "ant-" + "synthetic".repeat(3) + "\n", { mode: 0o600 });
  const pin = async (file) => ({ path: file, sha256: hash(await readFile(file)) });
  const config = { schemaVersion: 1, bwrap: await pin(launcher), node: await pin(launcher), claude: await pin(launcher),
    libraries: [], model: "claude-fixture", relay: { route: "same-uid-key", keyFile, keyFormat: "assignment" },
    timeoutMs: 4000, maxTurns: 16, maxBudgetUsd: 1, requirePreExposureAttestation: false };
  const filename = path.join(root, "fixture-host-" + behavior + ".json");
  await writeFile(filename, jsonBytes(config));
  return { filename, config };
}

if (!new URL(import.meta.url).search) {
  test("review host bounds concurrency and refuses the dedicated broker for parallel packets", async (t) => {
    const { config } = await fakeHost(await scratch(t));
    for (const value of [undefined, 1, 2, 3]) validateHostConfig({ ...config, packetConcurrency: value });
    for (const value of [null, "2", 0, 1.5, 4]) {
      assert.throws(() => validateHostConfig({ ...config, packetConcurrency: value }), /Invalid packetConcurrency/);
    }
    const broker = { route: "dedicated-uid-broker", socket: "/fixture/inference.sock", ownerUid: process.getuid() + 1 };
    validateHostConfig({ ...config, relay: broker, packetConcurrency: 1 });
    assert.throws(() => validateHostConfig({ ...config, relay: broker, packetConcurrency: 2 }), /no verified packet isolation/);
  });
}
