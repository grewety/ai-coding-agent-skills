import { spawn } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { captureLimit } from "./bounded-worker.mjs";
import { equal, hash, jsonBytes, need, uuid } from "./review-inputs.mjs";
import { readState, writeState } from "./implementer-state.mjs";

const supervisor = fileURLToPath(new URL("./implementer-supervisor.py", import.meta.url));
const identifier = (p) => Number.isSafeInteger(p?.pid) && p.pid > 1 &&
  /^\d+$/.test(p.start) && uuid(p.boot) && /^\d+$/.test(p.namespace) && /^\d+$/.test(p.session);

export async function operationProcess(processIdentity) {
  need(identifier(processIdentity), "Incomplete process birth identity");
  const [boot, namespace] = await Promise.all([
    readFile("/proc/sys/kernel/random/boot_id", "utf8"), stat("/proc/self/ns/pid", { bigint: true }),
  ]);
  if (boot.trim() !== processIdentity.boot || String(namespace.ino) !== processIdentity.namespace) return "unverified";
  try {
    const raw = await readFile(`/proc/${processIdentity.pid}/stat`, "utf8");
    const tail = raw.slice(raw.lastIndexOf(")") + 1).trim().split(/\s+/);
    if (tail[19] !== processIdentity.start) return "reused-pid";
    if (tail[3] !== processIdentity.session) return "unverified";
    return tail[0] === "Z" ? "settled-process" : "active";
  } catch (error) {
    // Linux may report ESRCH when the task exits during the procfs stat read.
    if (error.code === "ENOENT" || error.code === "ESRCH") return "absent";
    throw error;
  }
}

export async function startSupervisor(directory, launch, binding, limits, deadlineMs) {
  const { timeoutMs, stdoutBytes: stdoutLimit, stderrBytes: stderrLimit, maxTurns } = limits;
  need(launch.input.length <= 128 * 1024 && [stdoutLimit, stderrLimit].every((n) =>
    Number.isSafeInteger(n) && n > 0 && n <= captureLimit), "Supervisor capture bounds changed");
  const spec = { binding, argv: [launch.command, ...launch.args], cwd: launch.cwd, env: launch.env,
    input: launch.input.toString("base64"), timeoutMs, stdoutLimit, stderrLimit, maxTurns,
    ...(deadlineMs === undefined ? {} : { deadlineMs }) };
  await writeState(directory, "spawn.json", spec);
  const child = spawn("/usr/bin/python3", ["-I", "-B", supervisor, directory, hash(jsonBytes(spec))], {
    env: { PATH: "/usr/bin:/bin", LC_ALL: "C.UTF-8" }, stdio: "ignore", detached: true,
  });
  return { wait: new Promise((resolve) => {
    child.once("error", () => resolve(false));
    child.once("exit", (code) => resolve(code === 0));
  }) };
}

export async function supervisorState(directory, binding) {
  const names = ["supervisor", "worker", "delivered", "session", "wait", "resumed", "settlement"];
  // Read settlement first. Its existence makes every earlier record final.
  const settlement = await readState(directory, "settlement.json", true, 24 * 1024 * 1024);
  const values = await Promise.all(names.slice(0, -1).map((name) => readState(directory, name + ".json", true)));
  const state = Object.fromEntries(names.map((name, i) => [name, i === values.length ? settlement : values[i]]));
  for (const item of [...values, settlement].filter(Boolean)) need(equal(item.binding, binding), "Original supervisor binding changed");
  if (!state.supervisor) {
    need(!values.slice(1).some(Boolean) && !settlement, "Partial unbound supervisor state");
    return state;
  }
  const controller = state.supervisor.process;
  need(identifier(controller) && (!state.worker || identifier(state.worker.process)), "Invalid original process birth identity");
  for (const item of values.slice(1).filter(Boolean)) need(equal(item.supervisor, controller), "Original supervisor process changed");
  need(!state.session || uuid(state.session.session), "Unverified native session");
  need(!state.wait || (state.wait.session === state.session?.session && typeof state.wait.request === "string" && ["approval", "credential"].includes(state.wait.kind)),
    "Unverified native wait");
  need(!state.resumed || (state.wait && state.resumed.session === state.wait.session && state.resumed.request === state.wait.request),
    "Unverified native wait resolution");
  if (settlement) need(equal(settlement.process, controller) && state.worker && Number.isSafeInteger(settlement.elapsedMs) &&
    settlement.elapsedMs >= 0 && typeof settlement.result?.quiescent === "boolean", "Incomplete original process settlement");
  return state;
}

export async function cancelSupervisor(directory, state) {
  need(state.supervisor && state.worker && !state.settlement &&
    await operationProcess(state.supervisor.process) === "active" && await operationProcess(state.worker.process) === "active",
  "Original live supervisor and worker could not be identified");
  await writeState(directory, "cancel.json", { binding: state.supervisor.binding, process: state.supervisor.process });
}
