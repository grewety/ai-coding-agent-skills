import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";

export const captureLimit = 8 * 1024 * 1024;
export const captureAggregateLimit = 32 * 1024 * 1024;

export async function runBoundedWorker(command, args, {
  cwd, env, input = Buffer.alloc(0), timeoutMs = 30000,
  stdoutLimit = 4 * 1024 * 1024, stderrLimit = 1024 * 1024, postLeaderGraceMs = 0,
}) {
  if (process.platform !== "linux" || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 600000 ||
      !Number.isSafeInteger(postLeaderGraceMs) || postLeaderGraceMs < 0 || postLeaderGraceMs > 250 ||
      ![stdoutLimit, stderrLimit, input.length].every((n) => Number.isSafeInteger(n) && n >= 0 && n <= captureLimit)) {
    throw new Error("Unavailable or invalid bounded worker supervision");
  }
  const helper = fileURLToPath(new URL("./bounded-worker.py", import.meta.url));
  return new Promise((resolve, reject) => {
    const child = execFile("/usr/bin/python3", ["-I", "-B", helper], {
      env: { PATH: "/usr/bin:/bin" }, encoding: "utf8",
      maxBuffer: Math.ceil((stdoutLimit + stderrLimit) * 4 / 3) + 4096,
    }, (error, output) => {
      if (error) return reject(new Error("Worker supervisor failed without quiescence proof"));
      try {
        const result = JSON.parse(output);
        if (result.error) throw new Error("Worker supervisor unavailable or failed without quiescence proof");
        for (const stream of ["stdout", "stderr"]) result[stream] = Buffer.from(result[stream], "base64");
        resolve(result);
      } catch (err) { reject(err); }
    });
    child.stdin.on("error", () => {}); // The supervisor exit reports a control-channel failure.
    child.stdin.end(JSON.stringify({ argv: [command, ...args], cwd, env, timeoutMs, stdoutLimit, stderrLimit,
      postLeaderGraceMs, input: Buffer.from(input).toString("base64") }));
  });
}
