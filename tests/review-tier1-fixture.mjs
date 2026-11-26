// Native system inventory from the pinned Pi 1.5.2 offline capture.
const inventory = {
  "role": "system",
  "content": "",
  "sections": {
    "preamble": "You are a coding assistant running inside pi, a coding agent harness. Help users inspect files, run commands, and modify code.",
    "tools": "<tools>\n- read: Read file contents\n\nAdditional tools may be available.\n</tools>",
    "rules": "<rules>\n- Use read to examine files instead of cat or sed.\n- Be concise in your responses\n- Show file paths clearly when working with files\n</rules>",
    "docs": "<docs>\nPi documentation (read only when the user asks about the harness itself, its SDK, extensions, themes, skills, or TUI):\n- Main documentation: /control/node_modules/@earendil-works/pi-coding-agent/README.md\n- Additional docs: /control/node_modules/@earendil-works/pi-coding-agent/docs\n- Examples: /control/node_modules/@earendil-works/pi-coding-agent/examples (extensions, custom tools, SDK)\n- When reading pi docs or examples, resolve docs/... under Additional docs and examples/... under Examples, not the current working directory\n- When asked about: extensions (docs/extensions.md, examples/extensions/), themes (docs/themes.md), skills (docs/skills.md), prompt templates (docs/prompt-templates.md), TUI components (docs/tui.md), keybindings (docs/keybindings.md), SDK integrations (docs/sdk.md), custom providers (docs/custom-provider.md), adding models (docs/models.md), packages (docs/packages.md), environment variables (docs/environment-variables.md), MCP servers (docs/mcp.md), codemode scripts and non-LLM models such as classifiers and image models (docs/codemode.md)\n- Before implementing harness changes, read the relevant docs and examples in full, following related cross-references.\n</docs>",
    "cwd": "<cwd>\n/review\n</cwd>"
  },
  "timestamp": 1795698933663,
  "toolsAdded": [
    {
      "name": "read",
      "description": "Read the contents of a file. Supports text files and images (jpg, png, gif, webp, bmp). Images are sent as attachments. For text files, output is truncated to 2000 lines or 50KB (whichever is hit first). Use offset/limit for large files. When you need the full file, continue with offset until complete.",
      "parameters": {
        "type": "object",
        "required": [
          "path"
        ],
        "properties": {
          "path": {
            "type": "string",
            "description": "Path to the file to read (relative or absolute)"
          },
          "offset": {
            "type": "number",
            "description": "Line number to start reading from (1-indexed)"
          },
          "limit": {
            "type": "number",
            "description": "Maximum number of lines to read"
          }
        }
      },
      "constrainedSampling": {
        "type": "json_schema",
        "strict": "prefer"
      }
    }
  ]
};

export const files = new Map([
  ["target/alpha.txt", Buffer.from("Alpha fixture line one.\nAlpha fixture line two.")],
  ["target/beta.txt", Buffer.from("Beta fixture line one.\nBeta fixture line two.")],
]);

export const runtime = {
  session: "12121212-3434-4b4b-b5b5-565656565656",
  model: "grok-4.7", version: "1.5.2", route: "hermes-proxy-xai-oauth", maxTurns: 96,
  explicit: { client: "pi", provider: "xai-oauth", reasoningEffort: "off", requestLimit: 96 },
};

const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };
const text = (value) => [{ type: "text", text: value }];
const start = (message) => ({ type: "message_start", message });
const end = (message) => ({ type: "message_end", message });
const turnEnd = (message, toolResults = []) => ({ type: "turn_end", message, toolResults });
const update = (type, contentIndex, adjunct) => ({ type: "message_update", usage,
  assistantMessageEvent: { type, contentIndex, ...adjunct } });

function assistantEvents(content, stopReason, timestamp) {
  const base = { role: "assistant", model: "grok-4.7", provider: "xai-oauth", api: "openai-completions", usage, timestamp };
  const message = { ...base, content, stopReason, thinkingLevel: "off", durationMs: 3, responseId: "mock-" + timestamp,
    rawStopReason: stopReason === "stop" ? "stop" : "tool_calls" };
  const updates = content.flatMap((part, index) => part.type === "toolCall" ? [
    update("toolcall_start", index, { id: part.id, toolName: part.name }),
    update("toolcall_delta", index, { delta: JSON.stringify(part.arguments) }),
    update("toolcall_end", index, { toolCall: part }),
  ] : [
    update("text_start", index), update("text_delta", index, { delta: part.text }),
    update("text_end", index, { content: part.text }),
  ]);
  return { message, events: [start({ ...base, content: [], stopReason: "pending" }), ...updates, end(message)] };
}

export function eventsFor(report, assigned = files, session = runtime.session, prompt = "Synthetic review prompt") {
  const ids = [...assigned.keys()].map((_, i) => "call-" + i);
  const calls = [...assigned.keys()].map((name, i) => ({
    type: "toolCall", id: ids[i], name: "read", arguments: { path: "/review/" + name },
  }));
  const messages = [...assigned.values()].map((bytes, i) => ({
    role: "toolResult", toolCallId: ids[i], toolName: "read", content: text(bytes.toString()), isError: false,
    timestamp: 3, durationMs: 4,
  })).reverse();
  const read = assistantEvents(calls, "toolUse", 2);
  const final = assistantEvents(text(report), "stop", 4);
  const user = { role: "user", content: text(prompt), timestamp: 1 };
  return structuredClone([
    { type: "session", version: 3, id: session, timestamp: "2026-11-26T13:15:33.622Z", cwd: "/review" },
    { type: "agent_start" }, { type: "turn_start" },
    start(inventory), end(inventory), start(user), end(user),
    ...(calls.length ? [
      ...read.events, ...calls.map((call) => ({ type: "tool_execution_start", toolCallId: call.id, toolName: "read", args: call.arguments })),
      ...messages.map((message) => ({ type: "tool_execution_end", toolCallId: message.toolCallId, toolName: "read",
        isError: false, durationMs: message.durationMs, result: { content: message.content, structuredContent: message.content[0].text } })),
      ...messages.flatMap((message) => [start(message), end(message)]), turnEnd(read.message, messages), { type: "turn_start" },
    ] : []),
    ...final.events, turnEnd(final.message),
    { type: "agent_end", willRetry: false, messages: [inventory, user, ...(calls.length ? [read.message, ...messages] : []), final.message] },
    { type: "agent_settled", aborted: false },
  ].map((event) => JSON.parse(JSON.stringify(event))));
}

export const processFor = (events) => ({ code: 0, signal: null, outcome: "exit", quiescent: true,
  stdout: Buffer.from(events.map((event) => JSON.stringify(event)).join("\n") + "\n"), stderr: Buffer.alloc(0) });

export const requestTools = [{
  type: "function",
  function: { name: "read", description: "Read the contents of a file.", parameters: {
    type: "object", required: ["path"], properties: {
      path: { type: "string", description: "Path to the file to read (relative or absolute)" },
      offset: { type: "number", description: "Line number to start reading from (1-indexed)" },
      limit: { type: "number", description: "Maximum number of lines to read" },
    },
  } },
}];
