import path from "node:path";
import { auditVersion, versionPolicy } from "./runtime-version.mjs";

export const roleNames = Object.freeze(["orchestrator", "implementer", "reviewer", "helper"]);
export const clients = Object.freeze({
  codex: { command: "codex", floor: "0.171.0" },
  "claude-code": { command: "claude", floor: "2.1.330" },
  hermes: { command: "hermes" }, opencode: { command: "opencode" }, pi: { command: "pi" },
  agy: { command: "agy" }, "grok-build": { command: "grok-build" }, kilo: { command: "kilo" },
  gemini: { command: "gemini" },
});
const settings = ["versionPolicy", "versionCheck", "minVersion", "maxVersion", "exactVersion"];
export const token = (value) => typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,99}$/.test(value);
export const sha256Pattern = /^[a-f0-9]{64}$/;
export const object = (value) => value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype;
export const need = (condition, reason) => { if (!condition) throw new Error(reason); };
export const absolute = (value) => typeof value === "string" && path.isAbsolute(value) &&
  path.normalize(value) === value && !/[\x00-\x1f\x7f]/.test(value) && value !== "/";

export function fields(value, required, optional = [], label = "configuration") {
  need(object(value) && required.every((name) => Object.hasOwn(value, name)) &&
    Object.keys(value).every((name) => required.includes(name) || optional.includes(name)), "Invalid " + label + " fields");
}

export function validatePin(pin) {
  fields(pin, ["path", "sha256"], [], "file pin");
  need(absolute(pin.path) && typeof pin.sha256 === "string" && sha256Pattern.test(pin.sha256), "Invalid external file pin");
  return { path: pin.path, sha256: pin.sha256 };
}

export function roleConfig(input) {
  fields(input, ["client", "provider", "model", "reasoningEffort", "executable"],
    [...settings, "profile", "transport"], "explicit role");
  const { client, provider, model, reasoningEffort, profile, transport } = input;
  need(Object.hasOwn(clients, client), "Unknown role client");
  need(token(provider) && provider === provider.toLowerCase() && token(model) &&
    typeof reasoningEffort === "string" && /^[a-z][a-z0-9-]{0,31}$/.test(reasoningEffort),
  "Invalid explicit provider, model or reasoningEffort");
  need(client === "hermes" ? token(profile) : profile === undefined, "Hermes requires an explicit profile. Other clients do not accept profile.");
  need(transport === undefined || ["interactive", "stdin", "unix-socket"].includes(transport), "Unsupported role transport");
  return { client, provider, model, reasoningEffort, ...versionPolicy(input, clients[client].floor),
    executable: validatePin(input.executable), ...(profile === undefined ? {} : { profile }),
    ...(transport === undefined ? {} : { transport }) };
}

export function verifyEffectiveRole(input, observation) {
  const role = roleConfig(input);
  need(observation && ["client", "provider", "model", "reasoningEffort", "profile", "transport"].every((name) =>
    role[name] === observation[name]), "Effective client, provider, model, reasoning effort, profile or transport differs");
  need(observation.executableSha256 === role.executable.sha256, "Executable SHA-256 pin mismatch");
  return { ...role, runtimeVersion: auditVersion(role, observation.version, clients[role.client].floor) };
}

export function checkRoleIndependence(generator, reviewer) {
  for (const binding of [generator, reviewer]) {
    need(token(binding?.provider) && binding.provider === binding.provider.toLowerCase() &&
      typeof binding.session === "string" && binding.session.length > 0, "Missing effective provider or session for independent review");
  }
  need(generator.session !== reviewer.session, "Reviewer session is not independent");
  need(generator.provider !== reviewer.provider, "Reviewer provider is not independent");
}
