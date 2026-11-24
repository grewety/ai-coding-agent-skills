import { lstat } from "node:fs/promises";
import path from "node:path";
import { captureLimit } from "./bounded-worker.mjs";
import { checkoutIdentity, checkoutStatus, gitState } from "./worker-runtime-policy.mjs";
import { absolute, equal, hash, need, parseStrictJson, plain, relative, utf8 } from "./review-inputs.mjs";
import { readClosed } from "./worker-handoff.mjs";

const codexStartupWarning = "Under-development features enabled: skip_host_skill_discovery. " +
  "Under-development features are incomplete and may behave unpredictably. " +
  "To suppress this warning, set `suppress_unstable_features_warning = true` in ";

function isCodexStartupWarning(event) {
  const { item } = event;
  if (Object.keys(event).length !== 2 || !plain(item) || Object.keys(item).length !== 3 ||
      item.id !== "item_0" || item.type !== "error" || typeof item.message !== "string" ||
      !item.message.startsWith(codexStartupWarning)) return false;
  // The unquoted location uses portable path characters so it cannot absorb another diagnostic.
  const location = /^(\/[A-Za-z0-9_.@+/-]*\/config\.toml)\.$/.exec(item.message.slice(codexStartupWarning.length));
  return location !== null && absolute(location[1]);
}

function decode(value, limit) {
  need(typeof value === "string" && value.length <= Math.ceil(limit / 3) * 4, "Capture exceeds the admitted stream limit");
  const bytes = Buffer.from(value, "base64");
  need(bytes.length <= limit && bytes.toString("base64") === value, "Noncanonical or oversized capture");
  return bytes;
}

export function captureObservation(state, limits) {
  const outcome = state.settlement.result;
  need(outcome.quiescent && ["exit", "timeout", "stdout-quota", "stderr-quota", "surviving-descendants", "cancelled",
    "supervisor-turn-limit"].includes(outcome.outcome), "No verified worker tree quiescence or known termination");
  need((Number.isSafeInteger(outcome.code) && outcome.code >= 0 && outcome.signal === null) ||
    (outcome.code === null && /^SIG[A-Z0-9]+$/.test(outcome.signal)), "Missing actual worker exit disposition");
  return { stdout: decode(outcome.stdout, limits.stdoutBytes), stderr: decode(outcome.stderr, limits.stderrBytes),
    completion: { kind: "exit", code: outcome.code, signal: outcome.signal }, outcome: outcome.outcome };
}

export function auditCodexCapture(state, captured, limits) {
  const reduce = (status, reason, report = null, turns = 0) => ({ status, reason, report, turns });
  if (captured.outcome !== "exit") return reduce("stopped", captured.outcome);
  if (!state.delivered || !state.session) return reduce("failed", "missing-delivery-or-session");
  let events;
  try {
    need(captured.stdout.at(-1) === 10, "Partial native stream");
    const lines = utf8(captured.stdout).slice(0, -1).split("\n");
    need(lines.length <= 50000, "Too many native events");
    events = lines.map((line) => parseStrictJson(Buffer.from(line)));
  } catch { return reduce("failed", "invalid-native-stream"); }
  const threads = events.filter((item) => item?.type === "thread.started");
  if (threads.length !== 1 || events[0] !== threads[0] || threads[0].thread_id !== state.session.session) {
    return reduce("failed", "native-session-mismatch");
  }
  let open = false;
  let turns = 0;
  let report = null;
  let waiting = null;
  let terminal = null;
  for (let index = 1; index < events.length; ++index) {
    const item = events[index];
    if (!item || (item.thread_id !== undefined && item.thread_id !== state.session.session) || terminal === "failed") {
      return reduce("failed", "native-event-identity-mismatch");
    }
    switch (item.type) {
    case "turn.started":
      if (open || waiting || ++turns > limits.maxTurns) return reduce("failed", "native-turn-order-or-bound");
      open = true;
      report = null;
      terminal = null;
      break;
    case "item.completed":
      // Codex 0.171.0 emits this diagnostic before opening the first turn.
      if (index === 1 && events[index + 1]?.type === "turn.started" && isCodexStartupWarning(item)) break;
      if (!open || waiting) return reduce("failed", "native-event-outside-active-turn");
      if (item.item?.type === "agent_message" && typeof item.item.text === "string" && item.item.text.trim()) report = item.item.text;
      break;
    case "item.started":
    case "item.updated":
      if (!open || waiting) return reduce("failed", "native-event-outside-active-turn");
      break;
    case "approval.requested":
      if (!open || waiting || !state.wait || item.thread_id !== state.session.session || item.kind !== state.wait.kind ||
          item.request_id !== state.wait.request) return reduce("blocked", "unverified-native-wait");
      waiting = item.request_id;
      break;
    case "approval.resolved":
      if (waiting === null || item.thread_id !== state.session.session || waiting !== item.request_id ||
          item.decision !== "approved" || item.by !== "operator" || state.resumed?.request !== waiting) return reduce("blocked", "unresolved-native-wait");
      waiting = null;
      break;
    case "turn.completed":
      if (!open || waiting || !item.usage || !Number.isSafeInteger(item.usage.output_tokens) || item.usage.output_tokens <= 0) {
        return reduce("failed", "invalid-native-completion");
      }
      open = false;
      terminal = "completed";
      break;
    case "error":
      if (item.code === "authentication_required") return reduce("blocked", "dedicated-authentication-required");
      return reduce("failed", "native-error");
    case "turn.failed":
      if (!open || waiting) return reduce("blocked", waiting ? "unresolved-native-wait" : "invalid-native-failure");
      open = false;
      terminal = "failed";
      if (item.error?.code === "turn_limit" && turns === limits.maxTurns &&
          captured.completion.code !== 0 && captured.completion.signal === null && item === events.at(-1)) {
        return reduce("capped", "native-turn-cap", report, turns);
      }
      return reduce("failed", "native-turn-failed");
    default:
      return reduce("failed", "unsupported-native-event");
    }
  }
  if (waiting !== null || (state.wait && !events.some((item) => item.type === "approval.requested"))) {
    return reduce("blocked", "unresolved-native-wait");
  }
  if (open || terminal !== "completed" || !report || captured.completion.code !== 0 || captured.completion.signal !== null ||
      events.at(-1).type !== "turn.completed") return reduce("failed", "no-authentic-native-completion");
  return reduce("completed", null, report, turns);
}

export async function verifyPostWorker(request, grant, expectedGitState) {
  const workspace = request.identity.workspace;
  need(equal(checkoutIdentity(workspace), { head: grant.head, branch: grant.branch }), "Worker changed Git HEAD or branch");
  need(equal(await gitState(workspace), expectedGitState), "Worker changed protected Git metadata");
  const status = checkoutStatus(workspace);
  const entries = status.split("\0").filter(Boolean);
  need(entries.length <= request.mutablePaths.length, "Post-worker output exceeds admitted paths");
  const outputs = {};
  for (const entry of entries) {
    const code = entry.slice(0, 3);
    const name = entry.slice(3);
    need([" M ", " D ", "?? "].includes(code) && relative(name) && request.mutablePaths.includes(name),
      "Post-worker staged, ignored, renamed, conflicting or out-of-scope change");
    if (code === " D ") outputs[name] = null;
    else {
      const filename = path.join(workspace, name);
      const st = await lstat(filename);
      need(st.nlink === 1 && st.isFile(), "Unsafe worker output alias");
      outputs[name] = hash(await readClosed(filename, captureLimit));
    }
  }
  return outputs;
}
