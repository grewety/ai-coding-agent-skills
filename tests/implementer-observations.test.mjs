import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { test } from "node:test";
import { auditCodexCapture } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/implementer-observations.mjs";

const session = "09007daf-94c3-4987-a72d-f8ceedfb1a60";
const threadStarted = { type: "thread.started", thread_id: session };
const turnStarted = { type: "turn.started" };
const report = { type: "item.completed", item: { type: "agent_message", text: "Synthetic result" } };
const turnCompleted = { type: "turn.completed", usage: { output_tokens: 2 } };
const turn = [turnStarted, report, turnCompleted];
const unknown = { type: "synthetic.unknown" };
const warning = {
  type: "item.completed",
  item: {
    id: "item_0",
    type: "error",
    message: "Under-development features enabled: skip_host_skill_discovery. " +
      "Under-development features are incomplete and may behave unpredictably. " +
      "To suppress this warning, set `suppress_unstable_features_warning = true` in /tmp/fixture-codex/config.toml.",
  },
};

function audit(events, options = {}) {
  const state = { delivered: true, session: { session } };
  const stdout = Buffer.from(events.map((event) => JSON.stringify(event)).join("\n") + "\n");
  const captured = { stdout, outcome: "exit", completion: { kind: "exit", code: 0, signal: null }, ...options };
  return auditCodexCapture(state, captured, { maxTurns: 1 });
}

const warningWith = (fields) => ({ ...warning, item: { ...warning.item, ...fields } });
const completed = { status: "completed", reason: null, report: "Synthetic result", turns: 1 };

test("the exact Codex warning is admitted once between the thread and first turn", () => {
  assert.deepEqual(audit([threadStarted, warning, ...turn]), completed);
  const relocated = warningWith({ message: warning.item.message.replace("/tmp/fixture-codex/", "/srv/fixture/.codex_2/") });
  assert.deepEqual(audit([threadStarted, relocated, ...turn]), completed);
});

test("genuine pre-turn errors and unknown events still fail admission", () => {
  assert.equal(audit([threadStarted, warningWith({ message: "Synthetic connection refused" }), ...turn]).reason,
    "native-event-outside-active-turn");
  assert.equal(audit([threadStarted, { type: "error", message: "Synthetic worker failure" }, ...turn]).reason,
    "native-error");
  assert.equal(audit([threadStarted, unknown, ...turn]).reason, "unsupported-native-event");
});

test("altered warning text and malformed config locations fail admission", () => {
  const message = warning.item.message;
  for (const altered of [
    `Warning: ${message}`,
    message.replace("skip_host_skill_discovery.", "skip_host_skill_discovery, another_feature."),
    message.replace("behave unpredictably", "be unstable"),
    message.replace("= true", "= false"),
    message.replace("/tmp/", "tmp/"),
    message.replace("/tmp/", "/tmp/../"),
    message.replace("/config.toml", "/settings.toml"),
    message.replace("/config.toml.", "/config.toml. Synthetic failure at /tmp/other/config.toml."),
    `${message} Extra message.`,
    `${message}\n`,
    message.slice(0, -1),
  ]) {
    assert.equal(audit([threadStarted, warningWith({ message: altered }), ...turn]).reason,
      "native-event-outside-active-turn", altered);
  }
});

test("the startup warning requires the exact event and item schema", () => {
  for (const item of [
    { ...warning, type: "item.updated" },
    { ...warning, thread_id: session },
    { ...warning, extra: true },
    { ...warning, item: [warning.item] },
    warningWith({ id: "item_1" }),
    warningWith({ type: "warning" }),
    warningWith({ extra: true }),
    warningWith({ message: [warning.item.message] }),
    warningWith({ message: undefined }),
  ]) {
    assert.equal(audit([threadStarted, item, ...turn]).reason, "native-event-outside-active-turn", JSON.stringify(item));
  }
});

test("the warning cannot precede the thread, repeat before the first turn, or appear between or after turns", () => {
  assert.equal(audit([warning, threadStarted, ...turn]).reason, "native-session-mismatch");
  for (const events of [
    [threadStarted, warning],
    [threadStarted, warning, warning, ...turn],
    [threadStarted, warning, unknown, ...turn],
    [threadStarted, ...turn, warning, ...turn],
    [threadStarted, warning, ...turn, warning],
  ]) {
    assert.equal(audit(events).reason, "native-event-outside-active-turn");
  }
  assert.equal(audit([threadStarted, unknown, warning, ...turn]).reason, "unsupported-native-event");
});

test("the warning preserves session, turn, and completion checks as well as in-turn handling", () => {
  assert.deepEqual(audit([threadStarted, turnStarted, warning, report, turnCompleted]), completed);
  assert.equal(audit([{ ...threadStarted, thread_id: "wrong-session" }, warning, ...turn]).reason, "native-session-mismatch");
  assert.equal(audit([threadStarted, warning, { ...turnStarted, thread_id: "wrong-session" }, report, turnCompleted]).reason,
    "native-event-identity-mismatch");
  assert.equal(audit([threadStarted, warning, turnStarted, turnCompleted]).reason, "no-authentic-native-completion");
  assert.equal(audit([threadStarted, warning, ...turn], { completion: { kind: "exit", code: 1, signal: null } }).reason,
    "no-authentic-native-completion");
  assert.equal(audit([threadStarted, warning, ...turn, ...turn]).reason, "native-turn-order-or-bound");
});


test("supervisor stat reader requires a positive integer PID and a canonical proc path", { skip: process.platform !== "linux" }, () => {
  const script = fileURLToPath(new URL(
    "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/implementer-supervisor.py", import.meta.url));
  const program = `
import os
import runpy
import sys
from unittest.mock import patch

module = runpy.run_path(sys.argv[1])
identity = module["identity"]
pid = os.getpid()
assert identity(pid)["pid"] == pid

def reject(value, reason):
    try:
        identity(value)
    except ValueError as error:
        assert reason in str(error), str(error)
    else:
        raise AssertionError("accepted an invalid stat locator")

with patch("os.open", side_effect=AssertionError("opened an unverified stat path")):
    with patch("os.path.realpath", side_effect=AssertionError("resolved an invalid PID")):
        for value in (None, True, 0, -1, 1.0, "1", "../1"):
            reject(value, "invalid process ID")
    for resolved in ("/proc/1/stat", "/proc-fixture/stat", "/outside-fixture/stat"):
        with patch("os.path.realpath", return_value=resolved):
            reject(pid, "noncanonical process stat path")
    for directory in (None, "relative", "/proc/../proc", "/proc//self", "/proc/self", "/proc/"):
        try:
            module["Attempt"](directory, "0" * 64)
        except ValueError as error:
            assert "noncanonical supervisor state directory" in str(error)
        else:
            raise AssertionError("accepted a noncanonical state directory")
`;
  const result = spawnSync("/usr/bin/python3", ["-I", "-B", "-c", program, script], { encoding: "utf8", timeout: 5000 });
  assert.equal(result.status, 0, result.stderr);
});
