import assert from "node:assert/strict";
import test from "node:test";
import { admitReceipt } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-admission.mjs";
import { piInferenceFrames, piRelayRequest } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-relay.mjs";
import { auditPiStream } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-stream.mjs";
import { eventsFor, files, processFor, requestTools, runtime } from "./review-tier1-fixture.mjs";

const paths = [...files.keys()];
const target = "a".repeat(40);
const receipt = ["BEGIN_REVIEW_RECEIPT", "Verdict: No findings", "Target: " + target,
  JSON.stringify({ target, packet: 1, findings: [], coverageLimitations: [] }), "END_REVIEW_RECEIPT"].join("\n");
const audit = (events, binding = runtime) => auditPiStream(processFor(events), binding, paths, false, files, true);
const admit = (report) => admitReceipt({ mode: "candidate" }, { target }, report, 0, "fixture", { paths }, { framedOnly: true });

test("Pi replays parallel whole-file reads by call ID and admits the exact framed receipt", () => {
  assert.equal(admit(audit(eventsFor(receipt))).verdict, "Verdict: No findings");
  for (const bad of [receipt.replace("END_REVIEW_RECEIPT", ""), receipt.replace('"packet":1', '"packet":2'), receipt + "\ntrailing"]) {
    assert.throws(() => admit(audit(eventsFor(bad))), /framing|identity/);
  }
  assert.equal(auditPiStream(processFor(eventsFor("REVIEW_PROBE_OK", new Map())), runtime, [], true, new Map()),
    "REVIEW_PROBE_OK");
});

test("Pi rejects wrong bindings, forbidden tools, partial ranges and mismatched parallel results", () => {
  assert.throws(() => audit(eventsFor(receipt), { ...runtime, version: "1.5.3" }), /binding/);
  const event = (events, type, predicate = () => true) => events.find((entry) => entry.type === type && predicate(entry));
  const cases = [
    [(ev) => { ev[0].id = "99999999-9999-9999-9999-999999999999"; }, /session identity/],
    [(ev) => { ev[0].cwd = "/foreign"; }, /session identity/],
    [(ev) => { ev[0].version = 2; }, /session identity/],
    [(ev) => { ev[3].message.sections.docs += "host diagnostic"; }, /system inventory/],
    [(ev) => { ev[3].message.toolsAdded.push({ name: "bash" }); }, /system inventory/],
    [(ev) => { event(ev, "message_start", (e) => e.message.role === "assistant").message.provider = "wrong"; }, /assistant identity/],
    [(ev) => { event(ev, "message_update").message = {}; }, /message update/],
    [(ev) => { event(ev, "message_update").assistantMessageEvent.toolName = "bash"; }, /Read update/],
    [(ev) => { event(ev, "message_update", (e) => e.assistantMessageEvent.type === "toolcall_end").assistantMessageEvent.toolCall.arguments.offset = 2; }, /whole-file Read/],
    [(ev) => { event(ev, "message_update", (e) => e.assistantMessageEvent.type === "toolcall_end").assistantMessageEvent.toolCall.arguments.path = "/review/foreign"; }, /Read call/],
    [(ev) => { event(ev, "tool_execution_start").args = { path: "/review/target/beta.txt" }; }, /Read start/],
    [(ev) => { event(ev, "tool_execution_end").toolCallId = "call-0"; }, /full exported file/],
    [(ev) => { event(ev, "tool_execution_end").result.content[0].text = "Beta fixture line one."; }, /full exported file/],
    [(ev) => { event(ev, "tool_execution_end").result.structuredContent += "clipped"; }, /full exported file/],
    [(ev) => { event(ev, "tool_execution_end").result.details = { truncation: true }; }, /whole-file result/],
    [(ev) => { event(ev, "message_start", (e) => e.message.role === "toolResult").message.content[0].text = "Wrong"; }, /mismatched Pi Read/],
    [(ev) => { event(ev, "turn_end").toolResults.pop(); }, /mismatched Pi turn/],
    [(ev) => { ev.at(-2).messages.pop(); }, /final stream result/],
    [(ev) => { ev.at(-2).willRetry = true; }, /final stream result/],
    [(ev) => { ev.at(-1).aborted = true; }, /final stream result/],
  ];
  for (const [change, reason] of cases) {
    const events = eventsFor(receipt);
    change(events);
    assert.throws(() => audit(events), reason);
  }
  assert.throws(() => audit(eventsFor(receipt), { ...runtime, maxTurns: 1,
    explicit: { ...runtime.explicit, requestLimit: 1 } }), /request limit/);
  const clipped = processFor(eventsFor(receipt));
  clipped.stdout = clipped.stdout.subarray(0, -1);
  assert.throws(() => auditPiStream(clipped, runtime, paths, false, files), /Partial/);
  assert.throws(() => auditPiStream({ ...clipped, outcome: "timeout" }, runtime, paths, false, files), /supervisor/);
});

test("Pi relay accepts only the pinned streamed inference request and strips caller headers", () => {
  const req = { method: "POST", url: "/v1/chat/completions",
    headers: { "content-type": "application/json", authorization: "synthetic-secret", "x-other": "opaque" } };
  const payload = { model: runtime.model, stream: true, messages: [{ role: "user", content: "fixture" }],
    tools: requestTools };
  const body = (value) => Buffer.from(JSON.stringify(value));
  assert.deepEqual(piRelayRequest(req, body(payload), runtime.model),
    { "content-type": "application/json", "content-length": body(payload).length });
  assert.throws(() => piRelayRequest({ ...req, url: "/v1/responses" }, body(payload), runtime.model), /route/);
  assert.throws(() => piRelayRequest(req, body({ ...payload, model: "wrong" }), runtime.model), /payload/);
  assert.throws(() => piRelayRequest(req, body({ ...payload, tools: [...payload.tools, { type: "web_search" }] }), runtime.model), /tools/);
  assert.throws(() => piRelayRequest(req, body({ ...payload, reasoning_effort: "high" }), runtime.model), /schema/);
  assert.throws(() => piRelayRequest(req, body({ ...payload, store: false }), runtime.model), /schema/);
  const guard = piInferenceFrames(runtime.model);
  const frame = JSON.stringify({ id: "fixture", object: "chat.completion.chunk", created: 1, model: runtime.model,
    choices: [{ index: 0, delta: { content: receipt }, finish_reason: "stop" }] });
  guard.write(Buffer.from("data: "));
  guard.write(Buffer.from(frame + "\n\ndata: [DONE]\n\n"));
  assert.equal(guard.output(), "data: " + frame + "\n\ndata: [DONE]\n\n");
  assert.ok(guard.complete());
  const forbidden = (args) => Buffer.from("data: " + JSON.stringify({
    id: "fixture", created: 1, object: "chat.completion.chunk", model: runtime.model,
    choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: "read-0", type: "function",
      function: { name: "read", arguments: JSON.stringify(args) } }] }, finish_reason: "tool_calls" }],
  }) + "\n\ndata: [DONE]\n\n");
  for (const args of [{ path: "/proc/self/environ" }, { path: "/review/unassigned" }, { path: "/review/a", offset: 1 }]) {
    assert.throws(() => piInferenceFrames(runtime.model, new Set(["a"])).write(forbidden(args)), /assigned packet|whole-file/);
  }
  const injected = JSON.parse(frame);
  injected.choices[0].delta.debug = "upstream diagnostic";
  assert.throws(() => piInferenceFrames(runtime.model).write(Buffer.from("data: " + JSON.stringify(injected) + "\n")),
    /completion delta/);
  assert.throws(() => piInferenceFrames(runtime.model).write(Buffer.from('data: {"error":{"message":"synthetic-secret"}}\n\n')),
    /Pi inference frame/);
});
