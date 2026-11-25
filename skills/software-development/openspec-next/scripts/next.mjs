#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const companion = fileURLToPath(new URL("../../openspec-delivery/scripts/delivery-cli.mjs", import.meta.url));
const routes = new Map([
  ["inspect", "status"],
  ["init", "init"],
  ["proposal", "proposal"],
  ["checkpoint-relay", "checkpoint-relay"],
  ["next", "decision"],
  ["finish-readiness", "finish-readiness"],
  ["finish", "finish"],
  ["continue", "continue"],
  ["sync-skills", "sync-skills"],
  ["ui", "ui"],
  ["external", "external"],
  ["push-triggers", "push-triggers"],
]);

try {
  const [verb, ...args] = process.argv.slice(2);
  const command = routes.get(verb);
  if (!command) throw new Error(`Expected one of ${[...routes.keys()].join(", ")}`);
  const { values } = parseArgs({ args, options: {
    input: { type: "string", multiple: true },
    runtime: { type: "string", multiple: true },
    "runtime-sha256": { type: "string" },
    json: { type: "boolean" },
  } });
  if (values.input?.length !== 1) throw new Error("Expected one --input JSON file");
  if (values.runtime && values.runtime.length !== 1) throw new Error("Expected at most one --runtime path");
  const runtime = values.runtime?.[0] ?? companion;
  if (!path.isAbsolute(runtime) || path.basename(runtime) !== "delivery-cli.mjs") {
    throw new Error("Expected an absolute path to the trusted delivery-cli.mjs");
  }
  if (values["runtime-sha256"] && createHash("sha256").update(readFileSync(runtime)).digest("hex") !== values["runtime-sha256"]) {
    throw new Error("Selected delivery runtime digest differs from the verified package inventory");
  }
  const result = spawnSync(process.execPath, [runtime, command, "--input", values.input[0], "--json"], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error) throw result.error;
  if (result.signal) throw new Error(`Delivery runtime terminated by ${result.signal}`);
  if (result.stdout.length === 0) throw new Error("Delivery runtime returned no JSON. Check the installed companion path and runtime.");
  writeFileSync(1, result.stdout);
  if (result.stderr.length > 0) writeFileSync(2, result.stderr);
  process.exitCode = result.status ?? 1;
} catch (error) {
  writeFileSync(1, `${JSON.stringify({ schemaVersion: 1, ok: false, error: error.message,
    stopPredicate: "DELIVERY_COMPANION_UNVERIFIED",
    footer: `### Next step\nDELIVERY_COMPANION_UNVERIFIED (${error.message})\n- Verify the selected delivery package and rerun $openspec-next inspect` })}\n`);
  process.exitCode = 1;
}
