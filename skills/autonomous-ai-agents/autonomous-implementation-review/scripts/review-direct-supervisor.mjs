import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { inspectPinnedFile } from "./agent-configuration.mjs";
import { resolveInstalledExecutable } from "./agent-discovery.mjs";
import { fields, need, parseStrictJson } from "./review-inputs.mjs";

const helper = fileURLToPath(new URL("./review-direct-supervisor.py", import.meta.url));
const stdoutLimit = 4 * 1024 * 1024;
const stderrLimit = 128 * 1024;
export const reviewBackends = Object.freeze({ linux: "linux-subreaper", win32: "windows-job", darwin: "macos-no-fork" });
export const unavailableProcess = Object.freeze({ code: null, signal: null, outcome: "supervisor-failed", quiescent: false });
const helperEnv = () => process.platform === "win32" ? { SystemRoot: process.env.SystemRoot } : { PATH: "/usr/bin:/bin" };

export function supervisorCommand(excluded = []) {
  need(Object.hasOwn(reviewBackends, process.platform), "Unsupported native reviewer supervision platform");
  return resolveInstalledExecutable(process.platform === "win32" ? "python" : "python3", { excluded });
}

export async function observeSupervisor(python, excluded) {
  const pin = () => inspectPinnedFile({ path: python }, { executable: true, excluded, discover: true }).sha256;
  const executableSha256 = pin();
  if (process.platform === "darwin") {
    const probe = spawnSync(python, ["-I", "-B", helper, "--macos-probe"], {
      cwd: "/", env: helperEnv(), encoding: "utf8", timeout: 3000, maxBuffer: 4096,
    });
    need(!probe.error && probe.status === 0 && probe.stdout === "macos-nproc-zero\n",
      "macOS reviewer requires native unprivileged fork and posix_spawn denial under RLIMIT_NPROC=0");
  }
  const noFork = process.platform === "darwin";
  const probe = await superviseReview(python, { executable: python,
    args: ["-I", "-B", "-c", "import sys; sys.stdout.write('review-supervisor')"], env: helperEnv(), input: "" },
  { cwd: process.platform === "win32" ? process.env.SystemRoot : "/", timeoutMs: 3000, noFork });
  need(probe.code === 0 && probe.outcome === "exit" && probe.quiescent && probe.stdout.toString() === "review-supervisor",
    "Native reviewer supervisor could not establish initial process control and settlement");
  need(pin() === executableSha256, "Native supervisor executable changed during its probe");
  return { backend: reviewBackends[process.platform], executableSha256 };
}

export async function superviseReview(python, launch, { cwd, timeoutMs, signal, noFork = false }) {
  need(Number.isSafeInteger(timeoutMs) && timeoutMs >= 1 && timeoutMs <= 600000, "Invalid reviewer wall-clock bound");
  if (signal?.aborted) return { ...unavailableProcess, outcome: "canceled", quiescent: true, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) };
  const { executable, args, env, input } = launch;
  const payload = { argv: [executable, ...args], cwd, env, timeoutMs, stdoutLimit, stderrLimit, noFork,
    input: Buffer.from(input).toString("base64") };
  return new Promise((resolve) => {
    const child = spawn(python, ["-I", "-B", helper], {
      cwd, env: helperEnv(),
      windowsHide: true, stdio: ["pipe", "pipe", "ignore"],
    });
    const chunks = [];
    let bytes = 0;
    const cancel = () => child.stdin.end("\n");
    const fallback = () => ({ ...unavailableProcess, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) });
    // The native helper owns termination and settlement. A wedged helper can
    // never hold the orchestrator indefinitely or establish quiescence.
    const watchdog = setTimeout(() => child.kill("SIGKILL"), timeoutMs + 8000);
    watchdog.unref();
    child.stdin.on("error", () => {}); // close below supplies the authoritative terminal observation.
    child.stdout.on("data", (chunk) => {
      bytes += chunk.length;
      if (bytes > Math.ceil((stdoutLimit + stderrLimit) * 4 / 3) + 8192) cancel();
      else chunks.push(chunk);
    });
    child.on("error", () => resolve(fallback()));
    child.on("close", (code) => {
      clearTimeout(watchdog);
      signal?.removeEventListener("abort", cancel);
      child.stdin.end();
      try {
        need(code === 0, "Native supervisor failed");
        const result = parseStrictJson(Buffer.concat(chunks));
        fields(result, ["code", "signal", "outcome", "quiescent", "stdout", "stderr"], "supervisor result");
        const captures = {};
        for (const [name, limit] of [["stdout", stdoutLimit], ["stderr", stderrLimit]]) {
          const value = Buffer.from(result[name], "base64");
          need(value.toString("base64") === result[name] && value.length <= limit, "Invalid supervisor capture");
          captures[name] = value;
        }
        resolve({ ...result, ...captures });
      } catch {
        resolve(fallback());
      }
    });
    child.stdin.write(JSON.stringify(payload) + "\n");
    signal?.addEventListener("abort", cancel, { once: true });
    if (signal?.aborted) cancel();
  });
}
