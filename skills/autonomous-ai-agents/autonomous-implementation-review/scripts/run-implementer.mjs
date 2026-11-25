#!/usr/bin/env node
import { writeSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { fields, need } from "./review-inputs.mjs";
import { trustedJson } from "./implementer-state.mjs";
import { observeImplementer, runImplementers, runtimeIdentity } from "./implementer-runtime.mjs";

const actions = ["--run", "--run-standalone", "--inspect", "--recover", "--cancel", "--release-slot", "--release-claim"];

export async function implementerCommand(args, emit = () => {}) {
  const [flag, inputPath, inputSha256, releasePath, releaseSha256] = args;
  if (flag === "--runtime-identity" && args.length === 1) return { runtimeSha256: await runtimeIdentity() };
  const releaseAction = ["--release-slot", "--release-claim"].includes(flag);
  need(actions.includes(flag) && args.length === (releaseAction ? 5 : 3), "Invalid run-implementer CLI options");
  const input = await trustedJson({ path: inputPath, sha256: inputSha256 });
  fields(input, ["schemaVersion", "assignments"], "run-implementer input");
  need(input.schemaVersion === 1 && Array.isArray(input.assignments), "Unsupported run-implementer input");
  if (flag === "--run" || flag === "--run-standalone") {
    return { outcomes: await runImplementers(input.assignments, { emit, standalone: flag === "--run-standalone" }) };
  }
  need(input.assignments.length === 1, "Original-attempt actions require one exact assignment");
  return observeImplementer(input.assignments[0], { action: flag.slice(2), release: releaseAction ?
    { path: releasePath, sha256: releaseSha256 } : null });
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    const result = await implementerCommand(process.argv.slice(2), (event) => writeSync(2, JSON.stringify(event) + "\n"));
    writeSync(1, JSON.stringify(result) + "\n");
    if (["blocked", "unsupported"].includes(result.phase) ||
      result.outcomes?.some(({ phase }) => phase !== "completed")) process.exitCode = 1;
  } catch (error) {
    writeSync(2, JSON.stringify({ phase: "blocked", reason: error.message }) + "\n");
    process.exitCode = 2;
  }
}
