import { lstat } from "node:fs/promises";
import path from "node:path";
import { absolute, digest, equal, fields, hash, jsonBytes, need, relative, separate, uuid } from "./review-inputs.mjs";
import { claudeVersion, requireReviewHost, reviewRelaySource, runtimeBinding, validateHostConfig, verifyRuntimePins } from "./review-runtime.mjs";
import { CANDIDATE_RECORDS, resolveRoleConfiguration } from "./terminal-adapters.mjs";
import { privateDirectory, pinnedFile, trustedJson } from "./implementer-state.mjs";
import { readRoleBindings, validateRoleBindings } from "./agent-role-config.mjs";
import { inspectPinnedFile, parseStrictJson } from "./agent-configuration.mjs";
import { requireQualifiedPilot } from "./adapter-qualification.mjs";
import { piReviewer } from "./agent-role-adapters.mjs";
import { checkRoleIndependence } from "./role-config.mjs";
import { maximumAttemptMs } from "./worker-runtime-policy.mjs";

const implementerRoute = "codex-native-named-workspace-write";
const reviewerRoute = "claude-bubblewrap-read-only";
const codexVersion = "0.171.0";
const slotPaths = (role) => role.client === "codex" ? [role.codexHome, role.home, role.xdg] : [role.configuration.path];
const locator = (entry) => absolute(entry?.path) && digest(entry.sha256);
const isDistinct = (values) => new Set(values).size === values.length;

function validateRole(role, isImplementer, explicit) {
  fields(role, ["client", "model", "provider", "version", "route", "configuration", "qualification", "inventory", "slot",
    ...(isImplementer ? ["executable", "home", "xdg", "codexHome"] : ["session"])], "role configuration");
  need(typeof role.model === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,99}$/.test(role.model) && locator(role.configuration) &&
    locator(role.qualification) && absolute(role.slot), "Incomplete role configuration");
  need(Array.isArray(role.inventory) && role.inventory.length >= 2 && role.inventory.length <= 96 &&
    role.inventory.every(locator) && isDistinct(role.inventory.map(({ path: name }) => name)) &&
    role.inventory.every(({ path: name }) => relative(path.basename(name)) &&
      !/^(?:\.env|auth\.|credentials?\.|secrets?\.)/i.test(path.basename(name))), "Invalid or unsafe role package inventory");
  if (isImplementer) need((explicit || role.client === "codex" && role.provider === "openai" &&
    role.version === codexVersion && role.route === implementerRoute) && locator(role.executable) &&
    [role.home, role.xdg, role.codexHome].every(absolute), "Unqualified candidate implementer route");
  else need((explicit || role.client === "claude-code" && role.provider === "anthropic" && role.version === claudeVersion &&
    role.route === reviewerRoute) && uuid(role.session), "Unqualified candidate reviewer route");
}

function pairFields(pair, explicit) {
  fields(pair, ["implementer", "reviewer"], "paired role bindings");
  validateRole(pair.implementer, true, explicit);
  validateRole(pair.reviewer, false, explicit);
}

export function roleQualificationBinding(role, explicit) {
  const { qualification, session, ...binding } = role;
  return hash(jsonBytes(explicit ? { binding, explicit } : binding));
}

function qualificationIdentity(role, runtimeSha256) {
  return { bindingSha256: roleQualificationBinding(role), client: role.client, route: role.route, version: role.version, model: role.model, provider: role.provider,
    runtimeSha256, configurationSha256: role.configuration.sha256, inventorySha256: hash(jsonBytes(role.inventory)) };
}

async function qualification(role, runtimeSha256, author, orchestrator) {
  const record = await trustedJson(role.qualification);
  const expected = qualificationIdentity(role, runtimeSha256);
  need(record.schemaVersion === 1 && record.kind === "exclusive-runtime-qualification" &&
    record.status === "qualified" && record.role === (role.client === "codex" ? "implementer" : "reviewer") &&
    Object.entries(expected).every(([field, value]) => record[field] === value) &&
    typeof record.supervisor === "string" && record.supervisor.length > 0 && ![author, orchestrator, role.session].includes(record.supervisor) &&
    record.positiveControl === true && record.deniedPublication === true && record.protectedPaths === true &&
    record.settlementVerified === true && record.inventoryUnchanged === true, "Missing independent exact-route role qualification");
  return record.supervisor;
}

export function effectiveRole(role, roleName, request, session, { source, restrictions, roleAudit }) {
  const review = roleName === "reviewer";
  const nativeSession = review ? role.session : session;
  if (roleAudit) {
    need(typeof nativeSession === "string" &&
      ![request.authority.orchestrator, request.authority.authorSession].includes(nativeSession),
    "Effective worker session is not independent");
    need(restrictions.allowedClients.includes(role.client) && restrictions.allowedModels.includes(role.model) &&
      restrictions.allowedProviders.includes(role.provider) &&
      !(review && restrictions.requireDistinctModels && role.model === session.implementerModel),
    "Explicit role violates host client, model or provider restrictions");
    if (review) checkRoleIndependence({ provider: roleAudit.implementer.provider, session: session.implementer },
      { provider: role.provider, session: nativeSession });
    return { adapter: role.client, client: role.client, version: role.version, provider: role.provider, model: role.model,
      session: nativeSession, configurationSource: source, configurationScope: role.configuration.sha256, readOnly: review };
  }
  const binding = resolveRoleConfiguration({
    role: roleName, orchestratorSession: request.authority.orchestrator,
    implementerSession: review ? session.implementer : null, session: nativeSession,
    ...(source === "per-run-override" ? { perRunOverride: role } : { projectDefault: role }),
    restrictions: review ? { ...restrictions, implementerModel: session.implementerModel } : restrictions,
    records: CANDIDATE_RECORDS,
    effectiveReadback: { verified: true, credentialsRead: false, aliasOnly: false, entitlementOnly: false,
      globalDefaultsModified: false, client: role.client, version: role.version, provider: role.provider, model: role.model,
      session: nativeSession },
  });
  need(binding.action === "bound", binding.reason);
  return { adapter: binding.client, client: binding.client, version: binding.version, provider: binding.provider, model: binding.model,
    session: binding.session, configurationSource: binding.configurationSource, configurationScope: role.configuration.sha256,
    readOnly: binding.readOnly };
}

export async function checkRolePins(pair, excluded, reviewerConfig) {
  await Promise.all([
    ...pair.implementer.inventory.map((pin) => pinnedFile(pin)), ...pair.reviewer.inventory.map((pin) => pinnedFile(pin)),
    pinnedFile(pair.implementer.executable, { executable: true }), verifyRuntimePins(reviewerConfig, excluded),
  ]);
}

export async function bindPair(entry, grant, runtimeSha256, registry, prospective = false, verifyRuntimeIdentity) {
  const host = await trustedJson(entry.host);
  const request = entry.request;
  const roots = [request.identity.workspace, ...request.evidenceRoots, registry];
  if (Object.hasOwn(host, "roles")) {
    const selected = validateRoleBindings(host);
    requireQualifiedPilot("implementer", selected.roles.implementer,
      { excluded: roots });
  }
  const explicit = host.schemaVersion === 2;
  fields(host, ["schemaVersion", "runtimeSha256", "pair", "override", "restrictions", ...(explicit ? ["roleBindings"] : [])],
    "independent host binding", ["goalFirstTimeoutMs"]);
  need([1, 2].includes(host.schemaVersion) && host.runtimeSha256 === runtimeSha256, "Host qualification does not name this runtime");
  if (Object.hasOwn(host, "goalFirstTimeoutMs")) need(Number.isSafeInteger(host.goalFirstTimeoutMs) &&
    host.goalFirstTimeoutMs > 0 && host.goalFirstTimeoutMs <= maximumAttemptMs, "Invalid finite Goal-First host deadline override");
  fields(host.restrictions, ["allowedClients", "allowedModels", "allowedProviders", "requireDistinctModels"], "paired role restrictions");
  need(Object.entries(host.restrictions).every(([name, value]) => name === "requireDistinctModels" ? typeof value === "boolean" :
    Array.isArray(value) && value.length > 0 && value.length <= 64 && value.every((item) => typeof item === "string")),
  "Invalid paired role restrictions");
  pairFields(host.pair, explicit);
  let pair = host.pair;
  let roleBindings = host.roleBindings;
  const source = host.override === null ? "project-default" : "per-run-override";
  if (host.override !== null) {
    fields(host.override, ["attempt", "expiresAt", "pair", ...(explicit ? ["roleBindings"] : [])], "bounded per-run override");
    need(host.override.attempt === entry.request.identity.attempt && Number.isSafeInteger(host.override.expiresAt) &&
      host.override.expiresAt <= grant.expiresAt && host.override.expiresAt >= grant.issuedAt &&
      grant.overrideSha256 === hash(jsonBytes(host.override)), "Unapproved or unbounded per-run override");
    pairFields(host.override.pair, explicit);
    pair = host.override.pair;
    roleBindings = host.override.roleBindings;
  } else need(grant.overrideSha256 === null, "Approved override missing");
  const { implementer, reviewer } = pair;
  const excludedInputs = [...roots, entry.approval.path, entry.grant.path, entry.host.path];
  const selected = explicit ? readRoleBindings(roleBindings, excludedInputs) : null;
  if (selected && selected.roles.implementer.client !== "codex") {
    requireQualifiedPilot("implementer", selected.roles.implementer, { excluded: excludedInputs });
  }
  if (selected && !["claude-code", piReviewer.client].includes(selected.roles.reviewer.client)) {
    requireQualifiedPilot("reviewer", selected.roles.reviewer, { excluded: excludedInputs });
  }
  const profiles = [...slotPaths(implementer), reviewer.slot];
  need(profiles.every((name, i) => profiles.slice(i + 1).every((other) => separate(name, other))) &&
    implementer.slot === implementer.codexHome, "Role homes, configuration or physical slots are aliased");
  const roleInputs = [...profiles, reviewer.configuration.path, implementer.configuration.path, implementer.executable.path,
    ...implementer.inventory.map((pin) => pin.path), ...reviewer.inventory.map((pin) => pin.path)];
  need(roleInputs.every((name) => roots.every((root) => separate(root, name))) &&
    [entry.approval, entry.grant, entry.host, implementer.qualification, reviewer.qualification]
      .every(({ path: name }) => [...roots, ...profiles].every((root) => separate(root, name))),
  "Role, authority and protected checkout/evidence roots overlap");
  const profileIds = await Promise.all(profiles.map(privateDirectory));
  need(isDistinct(profileIds.map((id) => JSON.stringify(id))), "Physical role directories are aliased");
  const state = await trustedJson(implementer.configuration);
  fields(state, ["schemaVersion", "role", "auth", "disableHostDiscovery", "permissionMode"], "dedicated Codex settings");
  need(equal(state, { schemaVersion: 1, role: "implementer", auth: "dedicated-file", disableHostDiscovery: true,
    permissionMode: "named-workspace-write" }), "Unsupported Codex auth, discovery or permission mode");
  let cfg;
  let roleAudit;
  if (explicit) {
    const excluded = [...excludedInputs, ...profiles];
    need(profiles.every((root) => separate(root, roleBindings.path) && separate(root, selected.reviewerHost.path)),
      "External role bindings overlap a physical role profile");
    const independentOf = [request.authority.authorSession, request.authority.orchestrator, reviewer.session];
    const manifest = requireQualifiedPilot("implementer", selected.roles.implementer, {
      qualification: implementer.qualification, excluded, independentOf,
      context: { runtimeSha256, configurationSha256: implementer.configuration.sha256,
        constraintsSha256: roleQualificationBinding(implementer) },
    });
    need(equal(selected.reviewerHost, reviewer.configuration), "Paired reviewer configuration differs from external host pin");
    for (const [role, configured] of [[implementer, manifest.binding], [reviewer, selected.roles.reviewer]]) {
      need(["client", "model", "provider"].every((name) => role[name] === configured[name]),
        "External role tuple differs from the approved paired role");
    }
    need(equal(manifest.binding.executable, implementer.executable) && manifest.runtimeVersion.observedVersion === implementer.version,
      "Approved implementer executable or observed version differs from the effective role");
    cfg = requireReviewHost(parseStrictJson(inspectPinnedFile(reviewer.configuration, { read: true, excluded })), excluded,
      { qualification: reviewer.qualification, runtimeSha256, independentOf, verifyRuntimeIdentity,
        configurationSha256: reviewer.configuration.sha256, hostPin: reviewer.configuration });
    const observed = runtimeBinding(cfg, reviewer.session, reviewer.configuration.sha256);
    const resolvedRoute = observed.explicit?.client === piReviewer.client ? piReviewer.route : reviewerRoute;
    need(implementer.route === manifest.route && reviewer.route === resolvedRoute &&
      observed.explicit && observed.version === reviewer.version &&
      (reviewer.client !== piReviewer.client || observed.explicit.client === reviewer.client &&
        observed.explicit.provider === reviewer.provider &&
        observed.explicit.executableSha256 === selected.roles.reviewer.executable.sha256 &&
        observed.explicit.reasoningEffort === selected.roles.reviewer.reasoningEffort), "Approved native route or reviewer version differs from the effective role");
    roleAudit = { implementer: { provider: manifest.binding.provider, args: manifest.args,
      reasoningEffort: manifest.binding.reasoningEffort, runtimeVersion: manifest.runtimeVersion,
      qualificationSha256: manifest.qualificationSha256, roleBindingsSha256: roleBindings.sha256 },
    reviewer: observed.explicit };
  } else {
    cfg = await trustedJson(reviewer.configuration);
    validateHostConfig(cfg);
  }
  const relaySource = reviewRelaySource(cfg);
  need([...roots, ...profiles, ...roleInputs.filter((name) => !profiles.includes(name))]
    .every((root) => separate(root, relaySource)), "Reviewer relay source overlaps role, runtime or evidence state");
  need(cfg.model === reviewer.model && (explicit || runtimeBinding(cfg, reviewer.session).configurationSha256 === reviewer.configuration.sha256),
    "Contained reviewer configuration pin changed");
  if (!explicit) await Promise.all([qualification(implementer, runtimeSha256, request.authority.authorSession, request.authority.orchestrator),
    qualification(reviewer, runtimeSha256, request.authority.authorSession, request.authority.orchestrator)]);
  need(![request.authority.orchestrator, request.authority.authorSession].includes(reviewer.session), "Reviewer session is not independent");
  const launchNonce = "preflight-" + request.identity.attempt;
  const roleOptions = { source, restrictions: host.restrictions, ...(roleAudit ? { roleAudit } : {}) };
  effectiveRole(implementer, "implementer", request, launchNonce, roleOptions);
  effectiveRole(reviewer, "reviewer", request, { implementer: launchNonce, implementerModel: implementer.model },
    roleOptions);
  await checkRolePins(pair, roots, cfg);
  return { pair, ...roleOptions, reviewerConfig: cfg, profileIds,
    ...(prospective ? { attemptPolicy: true, goalFirstTimeoutMs: host.goalFirstTimeoutMs ?? null } : {}),
    physicalSlot: profileIds[0], expiresAt: host.override?.expiresAt ?? grant.expiresAt };
}
