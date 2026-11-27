#!/usr/bin/env node
import { closeSync, constants, fstatSync, openSync, readSync, writeSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import { applySetup, previewSetup, readWorksetOpener } from "./agent-setup.mjs";
import { parseStrictJson } from "./agent-configuration.mjs";
import { need, sha256Pattern } from "./role-config.mjs";

function setup() {
  if (process.argv[2] === "--launch-opener") {
    const [, , , path, sha256, ...args] = process.argv;
    const launch = readWorksetOpener({ path, sha256 }, args);
    writeSync(2, JSON.stringify({ event: "workset-opener-version", ...launch.runtimeVersion }) + "\n");
    const result = spawnSync(launch.command, launch.args, { stdio: "inherit" });
    need(!result.error, "Workset opener launch failed");
    process.exitCode = result.status ?? 128 + (os.constants.signals[result.signal] ?? 0);
    return;
  }
  const args = process.argv.slice(2);
  const [file, flag, confirmation] = args;
  need(file && (flag === undefined || args.length === 3 && flag === "--confirm" &&
    sha256Pattern.test(confirmation)), "Usage: setup.mjs REQUEST [--confirm PREVIEW_SHA256]");
  const fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  let input;
  try {
    const st = fstatSync(fd);
    need(st.isFile() && st.size <= 64 * 1024, "Expected a bounded regular setup request");
    const bytes = Buffer.alloc(64 * 1024 + 1);
    let count = 0;
    while (count < bytes.length) {
      const read = readSync(fd, bytes, count, bytes.length - count, null);
      if (read === 0) break;
      count += read;
    }
    need(count === st.size, "Setup request changed during read");
    input = parseStrictJson(bytes.subarray(0, count));
  } finally { closeSync(fd); }
  need(input.schemaVersion === 2, "Expected a Direct-CLI setup request");
  const result = flag ? applySetup(input, confirmation) : previewSetup(input);
  writeSync(1, JSON.stringify(result, null, 2) + "\n");
}

try { setup(); }
catch (error) {
  writeSync(2, JSON.stringify({ status: "blocked", reason: error.code ?? error.message,
    ...(error.outputs ? { outputs: error.outputs } : {}) }) + "\n");
  process.exitCode = 2;
}
