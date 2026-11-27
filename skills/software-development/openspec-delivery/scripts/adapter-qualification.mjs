import { hashBytes, inspectPinnedFile, jsonBytes, parseStrictJson } from "./agent-configuration.mjs";
import { observeVersion } from "./agent-discovery.mjs";
import { directReviewClients, nativeRoleBinding } from "./agent-role-adapters.mjs";
import { clients, fields, need, roleConfig, sha256Pattern, token, verifyEffectiveRole } from "./role-config.mjs";
import { auditVersion } from "./runtime-version.mjs";

const candidates = {
  implementer: ["codex", "claude-code", "hermes", "opencode", "pi", "agy", "grok-build", "kilo", "gemini"],
  reviewer: directReviewClients,
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
};

function matches(actual, expected, label) {
  fields(actual, Object.keys(expected), [], label);
  for (const [key, value] of Object.entries(expected)) need(actual[key] === value, label + " differs: " + key);
}

function qualificationSubject(binding, actual, context) {
  fields(context, ["runtimeSha256", "configurationSha256", "constraintsSha256"], [], "trusted implementer qualification context");
  need(Object.values(context).every((value) => typeof value === "string" && sha256Pattern.test(value)),
    "Missing independent runtime, configuration or constraints pin");
  const subject = { ...context, roleBindingSha256: hashBytes(jsonBytes(binding)) };
  const effective = Object.fromEntries(["client", "provider", "model", "reasoningEffort", "profile", "transport"]
    .filter((name) => binding[name] !== undefined).map((name) => [name, binding[name]]));
  return { subject, effective: { ...effective, version: actual, executableSha256: binding.executable.sha256 } };
}

function readControl(pin, { kind, subject, effective, supervisor, contract, excluded, independentOf }) {
  const proof = parseStrictJson(inspectPinnedFile(pin, { read: true, excluded }));
  fields(proof, ["schemaVersion", "kind", "supervisor", "subject", "effective", "controls",
    ...(kind === "live" ? ["runGrantReference", "attempt", "positiveControl", "negativeControl"] : [])], [], kind + " qualification evidence");
  need(proof.schemaVersion === 1 && proof.kind === kind && token(proof.supervisor) &&
    !independentOf.includes(proof.supervisor) && (supervisor === undefined || proof.supervisor === supervisor),
  kind + " qualification evidence does not match its supervisor or stage");
  matches(proof.subject, subject, kind + " qualification subject");
  matches(proof.effective, effective, kind + " effective qualification");
  if (kind === "live") {
    need(typeof proof.runGrantReference === "string" && proof.runGrantReference.trim().length > 0 &&
      proof.runGrantReference.length <= 1024 && token(proof.attempt), "Missing bounded live qualification grant or attempt");
    for (const name of ["positiveControl", "negativeControl"]) need(proof[name] === true, "Live qualification invariant failed: " + name);
  }
  fields(proof.controls, contract.controls, [], kind + " qualification controls");
  for (const name of contract.controls) need(proof.controls[name] === true, kind + " qualification invariant failed: " + name);
}

function readQualification(role, binding, actual, { qualification, context, excluded, independentOf = [] }) {
  const contract = contracts[role];
  const { subject, effective } = qualificationSubject(binding, actual, context);
  const record = parseStrictJson(inspectPinnedFile(qualification, { read: true, excluded }));
  fields(record, ["schemaVersion", "kind", "role", "route", "subject", "effective", "supervisor", "offline", "live"], [],
    "explicit route qualification");
  need(record.schemaVersion === 1 && record.kind === "explicit-route-qualification" &&
    record.role === role && record.route === contract.route, "Qualification does not identify the selected launch route");
  matches(record.subject, subject, "Qualification subject");
  matches(record.effective, effective, "Effective qualification");
  need(token(record.supervisor) && !independentOf.includes(record.supervisor), "Qualification supervisor is not independent");
  need(new Set([qualification.path, record.offline?.path, record.live?.path]).size === 3,
    "Qualification evidence files must be distinct");
  for (const kind of ["offline", "live"]) {
    readControl(record[kind], { kind, subject, effective, supervisor: record.supervisor, contract, excluded, independentOf });
  }
  return record;
}

export function qualificationInventory(agents) {
  const observed = new Map(agents.map((agent) => [agent.client, agent]));
  const entries = Object.entries(candidates).flatMap(([role, list]) => list.map((client) => {
    const agent = observed.get(({ claude: "claude-code", grok: "grok-build" })[client] ?? client);
    if (role === "reviewer") return { role, client, status: agent?.status === "present" ? "unknown" : "unavailable",
      reason: "Direct-CLI effective capability and live qualification are unverified" };
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
    const contract = contracts[role];
    if (mapped.blocker || contract?.client !== client || !options.qualification) {
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
