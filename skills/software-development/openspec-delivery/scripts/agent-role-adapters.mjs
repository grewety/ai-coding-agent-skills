import { need, roleConfig } from "./role-config.mjs";

const values = {
  codex: ["none", "minimal", "low", "medium", "high", "xhigh"],
  "claude-code": ["low", "medium", "high", "max"],
  pi: ["off", "minimal", "low", "medium", "high", "xhigh"],
};

export const piReviewer = Object.freeze({
  client: "pi", version: "1.5.2", provider: "xai-oauth", model: "grok-4.7", effort: "off",
  route: "pi-bubblewrap-read-only", relay: "hermes-proxy-xai-oauth",
});
export const grokReviewerBlocker =
  "Grok 1.0.92 streaming-messages-json has no verified host-only xAI OAuth routing through inference.sock";

export function requirePiReviewer(binding) {
  need(binding.client === piReviewer.client && binding.provider === piReviewer.provider &&
    binding.model === piReviewer.model && binding.reasoningEffort === piReviewer.effort &&
    binding.transport === "unix-socket" && binding.versionPolicy === "exact" &&
    binding.versionCheck === true && binding.exactVersion === piReviewer.version,
  "Pi reviewer requires exact 1.5.2, xai-oauth, grok-4.7, off thinking and Unix socket transport");
}

export function nativeRoleBinding(input, role) {
  const binding = roleConfig(input);
  const { client, provider, model, reasoningEffort, profile, transport } = binding;
  const selectedTransport = { orchestrator: "interactive", implementer: "stdin", reviewer: "unix-socket", helper: "stdin" }[role];
  need(selectedTransport && (transport === undefined || transport === selectedTransport),
    "Selected transport is unsupported for " + role);
  if (role === "reviewer" && client === "grok-build") return { args: [], blocker: grokReviewerBlocker };
  if (role === "reviewer" && client === piReviewer.client) {
    requirePiReviewer(binding);
    return { args: ["--provider", provider, "--model", model, "--thinking", reasoningEffort] };
  }
  if (client === "hermes") {
    return { args: ["--profile", profile], blocker: "Hermes needs a pinned profile with verifiable effective model, provider and agent.reasoning_effort" };
  }
  if (Object.hasOwn(values, client)) {
    need(values[client].includes(reasoningEffort), "Unsupported " + client + " reasoning effort: " + reasoningEffort);
  }
  if (client === "pi" && role === "orchestrator") {
    return { args: ["--provider", provider, "--model", model, "--thinking", reasoningEffort],
      blocker: "Pi has no verified OpenSpec attach-dirs mapping" };
  }
  if (!Object.hasOwn(values, client)) return { args: [], blocker: "No verified native reasoning-effort mapping for " + client };
  if (client === "codex") {
    need(provider === "openai", "Codex mapping only permits the explicit OpenAI provider");
    return { args: ["-m", model, "-c", 'model_provider="openai"', "-c", 'model_reasoning_effort="' + reasoningEffort + '"'],
      ...(role === "orchestrator" ? { opener: "codex", openerArgs: ["--sandbox", "workspace-write"] } : {}) };
  }
  if (client === "claude-code") {
    need(provider === "anthropic", "Claude Code mapping only permits the explicit Anthropic provider");
    return { args: ["--model", model, "--effort", reasoningEffort],
      ...(role === "orchestrator" ? { opener: "claude", openerArgs: ["--setting-sources", ""] } : {}) };
  }
  return { args: ["--provider", provider, "--model", model, "--thinking", reasoningEffort] };
}
