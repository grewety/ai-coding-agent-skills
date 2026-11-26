import { hashBytes, inspectPinnedFile, jsonBytes, parseStrictJson } from "./agent-configuration.mjs";
import { observeVersion } from "./agent-discovery.mjs";
import { nativeRoleBinding } from "./agent-role-adapters.mjs";
import { clients, fields, need, roleConfig, sha256Pattern, token, verifyEffectiveRole } from "./role-config.mjs";
import { auditVersion } from "./runtime-version.mjs";

const candidates = {
  implementer: ["codex", "claude-code", "hermes", "opencode", "pi", "agy", "grok-build", "kilo", "gemini"],
  reviewer: ["claude-code", "codex", "gemini", "openrouter", "openai-compatible"],
};

const limits = {
  implementer: {
    codex: "No exact-route offline and bounded live proof of effective model/provider/effort and protected native workspace-write handover for the explicit binding",
    "claude-code": "Native OS workspace-write containment with isolated settings and protected-path denials is unverified",
    hermes: "Explicit profile effective effort, native OS workspace-write containment and sealed non-interactive handover are unverified",
    opencode: "Effective reasoning effort and native OS workspace-write isolation are unverified",
    pi: "Native OS workspace-write isolation and protected-path denials are unverified",
    agy: "Non-interactive effective role settings and native OS workspace-write isolation are unverified",
    "grok-build": "Effective reasoning effort and native OS workspace-write isolation are unverified",
  },
  reviewer: {
    "claude-code": "No exact-route offline and bounded live proof of explicit reasoning effort through the isolated Anthropic relay and whole-file Read audit",
    codex: "No qualified host inference relay plus stream-proved whole-file Read and receipt mapping for Codex",
  },
};

const unsupported = (role, client, reason, runtimeVersion) => ({
  status: "unsupported", role, client, reason, ...(runtimeVersion ? { runtimeVersion } : {}),
});

const contracts = {
  implementer: { client: "codex", route: "codex-native-named-workspace-write", controls: [
    "effectiveSettings", "workspaceWrite", "isolatedHomeAndXdg", "ambientDiscoverySuppressed",
    "exclusiveClaim", "protectedPathsDenied", "publicationDenied", "nonInteractive",
    "originalProcessTreeSettled", "sealedFileHandover", "inventoryUnchanged",
  ] },
  reviewer: { client: "claude-code", route: "claude-bubblewrap-read-only", controls: [
    "effectiveSettings", "minimalRootfs", "readOnly", "directNetworkDenied", "unixSocketInference",
    "credentialsAndDiagnosticsHostOnly", "unauthorizedToolsDenied", "wholeFileStreamCoverage",
    "nativeTerminalResult", "strictReceipt", "offlineReplay", "originalProcessTreeSettled",
  ] },
};

function matches(actual, expected, label) {
  fields(actual, Object.keys(expected), [], label);
  for (const [key, value] of Object.entries(expected)) need(actual[key] === value, label + " differs: " + key);
}

function readQualification(role, binding, actual, { qualification, context, excluded, independentOf = [] }) {
  const contract = contracts[role];
  fields(context, ["runtimeSha256", "configurationSha256", "constraintsSha256",
    ...(role === "reviewer" ? ["relaySha256"] : [])], [], "trusted qualification context");
  need(Object.values(context).every((value) => typeof value === "string" && sha256Pattern.test(value)),
    "Missing independent runtime, configuration, constraints or relay pin");
  const record = parseStrictJson(inspectPinnedFile(qualification, { read: true, excluded }));
  fields(record, ["schemaVersion", "kind", "role", "route", "subject", "effective", "supervisor", "offline", "live"], [],
    "explicit route qualification");
  need(record.schemaVersion === 1 && record.kind === "explicit-route-qualification" &&
    record.role === role && record.route === contract.route, "Qualification does not identify the selected launch route");
  const subject = { ...context, roleBindingSha256: hashBytes(jsonBytes(binding)) };
  matches(record.subject, subject, "Qualification subject");
  const effective = Object.fromEntries(["client", "provider", "model", "reasoningEffort", "profile", "transport"]
    .filter((name) => binding[name] !== undefined).map((name) => [name, binding[name]]));
  matches(record.effective, { ...effective, version: actual, executableSha256: binding.executable.sha256 }, "Effective qualification");
  need(token(record.supervisor) && !independentOf.includes(record.supervisor), "Qualification supervisor is not independent");

  const paths = new Set([qualification.path]);
  for (const kind of ["offline", "live"]) {
    const pin = record[kind];
    const proof = parseStrictJson(inspectPinnedFile(pin, { read: true, excluded }));
    need(!paths.has(pin.path), "Qualification evidence files must be distinct");
    paths.add(pin.path);
    fields(proof, ["schemaVersion", "kind", "supervisor", "subject", "effective", "controls",
      ...(kind === "live" ? ["runGrantReference", "attempt", "positiveControl", "negativeControl"] : [])], [], kind + " qualification evidence");
    need(proof.schemaVersion === 1 && proof.kind === kind && proof.supervisor === record.supervisor,
      kind + " qualification evidence does not match its supervisor or stage");
    matches(proof.subject, subject, kind + " qualification subject");
    matches(proof.effective, record.effective, kind + " effective qualification");
    if (kind === "live") {
      need(typeof proof.runGrantReference === "string" && proof.runGrantReference.trim().length > 0 &&
        proof.runGrantReference.length <= 1024 && token(proof.attempt), "Missing bounded live qualification grant or attempt");
      for (const name of ["positiveControl", "negativeControl"]) {
        need(proof[name] === true, "Live qualification invariant failed: " + name);
      }
    }
    fields(proof.controls, contract.controls, [], kind + " qualification controls");
    for (const name of contract.controls) need(proof.controls[name] === true, kind + " qualification invariant failed: " + name);
  }
  return record;
}

export function qualificationInventory(agents) {
  const observed = new Map(agents.map((agent) => [agent.client, agent]));
  const entries = Object.entries(candidates).flatMap(([role, list]) => list.map((client) => {
    const agent = observed.get(client);
    const route = limits[role][client];
    let reason = !route ? "Discovery or adapter contract only" :
      !agent || agent.status === "unavailable" ? "Executable unavailable on discovery PATH: " + clients[client].command :
        !agent.version ? "Unable to establish an unambiguous executable version: " + agent.command : route;
    if (agent?.version && clients[client]?.floor && route) {
      try { auditVersion({}, agent.version, clients[client].floor); }
      catch { reason = agent.command + " " + agent.version + " is below the default tested floor " + clients[client].floor; }
    }
    return unsupported(role, client, reason);
  }));
  return entries;
}

export function pilotDisposition(role, input, options = {}) {
  const client = input?.client ?? null;
  let runtimeVersion;
  try {
    if (!Object.hasOwn(limits[role] ?? {}, client)) {
      return unsupported(role, client, role === "helper" ? "No verified effective binding adapter for optional AI invocation" :
        "No qualified launch contract for the selected role/client");
    }
    const binding = roleConfig(input);
    inspectPinnedFile(binding.executable, { executable: true, excluded: options.excluded });
    const actual = observeVersion(binding.executable.path, { ...options, client });
    if (!actual) return unsupported(role, client, "Executable version could not be verified");
    inspectPinnedFile(binding.executable, { executable: true, excluded: options.excluded });
    runtimeVersion = auditVersion(binding, actual, clients[client].floor);
    const mapped = nativeRoleBinding(binding, role);
    if (mapped.blocker || contracts[role]?.client !== client || !options.qualification) {
      return unsupported(role, client, mapped.blocker ?? limits[role][client], runtimeVersion);
    }
    const record = readQualification(role, binding, actual, options);
    return { status: "qualified", role, client, route: record.route, runtimeVersion,
      binding: verifyEffectiveRole(binding, record.effective), args: mapped.args, qualificationSha256: options.qualification.sha256 };
  } catch (error) {
    const reason = error.code === "ENOENT" ? (runtimeVersion ? "Qualification or control evidence file is absent" :
      "Configured executable is absent") : (error.code ?? error.message);
    return unsupported(role, client, reason, runtimeVersion);
  }
}

export function requireQualifiedPilot(role, input, options) {
  const disposition = pilotDisposition(role, input, options);
  if (disposition.status === "qualified") return disposition;
  const error = new Error("unsupported " + role + "/" + disposition.client + ": " + disposition.reason);
  error.disposition = disposition;
  throw error;
}
