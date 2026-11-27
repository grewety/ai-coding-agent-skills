import { inspectPinnedFile, parseStrictJson } from "./agent-configuration.mjs";
import { lstat } from "node:fs/promises";
import path from "node:path";
import { absolute, digest, equal, fields, git, hash, jsonBytes, need, relative, separate, tree, utf8, uuid } from "./review-inputs.mjs";
import { observeDirectRuntime } from "./review-runtime.mjs";
import { CANDIDATE_RECORDS, resolveRoleConfiguration } from "./terminal-adapters.mjs";
import { privateDirectory, pinnedFile, trustedJson } from "./implementer-state.mjs";
import { readRoleBindings } from "./agent-role-config.mjs";
import { requireQualifiedPilot } from "./adapter-qualification.mjs";
import { directReviewClients } from "./agent-role-adapters.mjs";
import { directReviewHost, reviewerProvider } from "./review-direct-adapters.mjs";
import { directReviewAdopted } from "./low-touch-policy.mjs";
import { checkRoleIndependence } from "./role-config.mjs";
import { maximumAttemptMs } from "./worker-runtime-policy.mjs";

const implementerRoute = "codex-native-named-workspace-write";
const reviewerRoute = "claude-bubblewrap-read-only";
const claudeVersion = "2.1.330";
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
    if (review && role.route !== "direct-cli") checkRoleIndependence({ provider: roleAudit.implementer.provider, session: session.implementer },
      { provider: role.provider, session: nativeSession });
    return {
      adapter: role.client, client: role.client, version: role.version, provider: role.provider, model: role.model,
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

function adoptedReviewer(grant) {
  const { workspace, policyRevision } = grant;
  const contracts = tree(workspace, policyRevision, ["AGENTS.md", "CLAUDE.md"]);
  const entry = contracts.get("AGENTS.md") ?? contracts.get("CLAUDE.md");
  return Boolean(entry && entry.mode === "100644" &&
    directReviewAdopted(utf8(git(workspace, "cat-file", "blob", entry.oid))));
}

async function bindDirectPair({ entry, grant, host, runtimeSha256, roots, prospective }) {
  fields(host, ["schemaVersion", "runtimeSha256", "pair", "override", "restrictions", "roleBindings"],
    "Direct-CLI paired host", ["goalFirstTimeoutMs"]);
  const request = entry.request;
  need(host.runtimeSha256 === runtimeSha256, "Host qualification does not name this runtime");
  fields(host.restrictions, ["allowedClients", "allowedModels", "allowedProviders", "requireDistinctModels"], "paired role restrictions");
  need(Object.entries(host.restrictions).every(([name, value]) => name === "requireDistinctModels" ? typeof value === "boolean" :
    Array.isArray(value) && value.length > 0 && value.length <= 64 && value.every((item) => typeof item === "string")),
  "Invalid paired role restrictions");
  let pair = host.pair;
  let roleBindings = host.roleBindings;
  const source = host.override === null ? "project-default" : "per-run-override";
  if (host.override !== null) {
    fields(host.override, ["attempt", "expiresAt", "pair", "roleBindings"], "bounded per-run override");
    need(host.override.attempt === request.identity.attempt && Number.isSafeInteger(host.override.expiresAt) &&
      host.override.expiresAt >= grant.issuedAt && host.override.expiresAt <= grant.expiresAt &&
      grant.overrideSha256 === hash(jsonBytes(host.override)), "Unapproved or unbounded per-run override");
    pair = host.override.pair;
    roleBindings = host.override.roleBindings;
  } else need(grant.overrideSha256 === null, "Approved override missing");
  need(host.goalFirstTimeoutMs === undefined || Number.isSafeInteger(host.goalFirstTimeoutMs) &&
    host.goalFirstTimeoutMs > 0 && host.goalFirstTimeoutMs <= maximumAttemptMs, "Invalid finite Goal-First host deadline override");
  fields(pair, ["implementer", "reviewer"], "Direct-CLI role pair");
  const { implementer, reviewer } = pair;
  need(implementer.client === "codex" && implementer.route === implementerRoute,
    "Only qualified native Codex workspace-write can dispatch");
  validateRole(implementer, true, true);
  fields(reviewer, ["client", "model", "provider", "version", "route", "configuration", "inventory", "session"], "Direct-CLI role binding");
  need(directReviewClients.includes(reviewer.client) && reviewer.route === "direct-cli" && uuid(reviewer.session) &&
    locator(reviewer.configuration) && Array.isArray(reviewer.inventory) && reviewer.inventory.length >= 2 &&
    reviewer.inventory.length <= 96 && reviewer.inventory.every(locator) &&
    isDistinct(reviewer.inventory.map(({ path: name }) => name)), "Invalid independently bound Direct-CLI reviewer");
  const profiles = slotPaths(implementer);
  need(implementer.slot === implementer.codexHome && profiles.every((root, i) =>
    profiles.slice(i + 1).every((other) => separate(root, other))), "Implementer homes or slot are aliased");
  const excluded = [...roots, ...profiles, entry.approval.path, entry.grant.path, entry.host.path];
  const pins = [roleBindings, implementer.configuration, implementer.executable, implementer.qualification,
    reviewer.configuration, ...implementer.inventory, ...reviewer.inventory];
  need(pins.every((pin) => locator(pin) && excluded.every((root) => separate(root, pin.path))),
    "Role pins overlap mutable, profile or authority roots");
  need(profiles.every((profile) => roots.every((root) => separate(root, profile))), "Implementer homes overlap protected state");
  const profileIds = await Promise.all(profiles.map(privateDirectory));
  need(isDistinct(profileIds.map((id) => JSON.stringify(id))), "Physical role directories are aliased");
  const state = await trustedJson(implementer.configuration);
  need(equal(state, { schemaVersion: 1, role: "implementer", auth: "dedicated-file", disableHostDiscovery: true,
    permissionMode: "named-workspace-write" }), "Unsupported Codex auth, discovery or permission mode");
  const selected = readRoleBindings(roleBindings, excluded);
  need(selected.schemaVersion === 2 && equal(selected.reviewerHost, reviewer.configuration), "Reviewer configuration differs from role pin");
  const independentOf = [request.authority.authorSession, request.authority.orchestrator, reviewer.session];
  const manifest = requireQualifiedPilot("implementer", selected.roles.implementer, {
    qualification: implementer.qualification, excluded, independentOf,
    context: { runtimeSha256, configurationSha256: implementer.configuration.sha256,
      constraintsSha256: roleQualificationBinding(implementer) },
  });
  need(["client", "model", "provider"].every((name) => implementer[name] === manifest.binding[name]) &&
    equal(manifest.binding.executable, implementer.executable) && implementer.version === manifest.runtimeVersion.observedVersion,
  "Approved implementer executable or effective settings differ");
  const config = directReviewHost(parseStrictJson(inspectPinnedFile(reviewer.configuration, { read: true, excluded })));
  need(reviewer.client === config.client && reviewer.model === config.model && reviewer.provider === reviewerProvider(config.reviewer),
    "Direct-CLI reviewer effective identity changed");
  const { runtime } = await observeDirectRuntime(config, excluded);
  need(reviewer.version === runtime.version, "Direct-CLI reviewer effective identity changed");
  await Promise.all([...implementer.inventory, ...reviewer.inventory].map((pin) => pinnedFile(pin)));
  const roleAudit = { implementer: { provider: manifest.binding.provider, args: manifest.args,
    reasoningEffort: manifest.binding.reasoningEffort, runtimeVersion: manifest.runtimeVersion,
    qualificationSha256: manifest.qualificationSha256, roleBindingsSha256: roleBindings.sha256 }, reviewer: runtime };
  const roleOptions = { source, restrictions: host.restrictions, roleAudit };
  const launchNonce = "preflight-" + request.identity.attempt;
  effectiveRole(implementer, "implementer", request, launchNonce, roleOptions);
  effectiveRole(reviewer, "reviewer", request, { implementer: launchNonce, implementerModel: implementer.model }, roleOptions);
  return { pair, ...roleOptions, reviewerConfig: config, profileIds, physicalSlot: profileIds[0],
    ...(prospective ? { attemptPolicy: true, goalFirstTimeoutMs: host.goalFirstTimeoutMs ?? null } : {}),
    expiresAt: host.override?.expiresAt ?? grant.expiresAt };
}

export async function bindPair(entry, grant, runtimeSha256, registry, prospective = false) {
  const host = await trustedJson(entry.host);
  const request = entry.request;
  const roots = [request.identity.workspace, ...request.evidenceRoots, registry];
  const direct = adoptedReviewer(grant);
  need((host.schemaVersion === 4) === direct, "Paired host transport differs from the integrated policy");
  if (direct) return bindDirectPair({ entry, grant, host, runtimeSha256, roots, prospective });
  fields(host, ["schemaVersion", "runtimeSha256", "pair", "override", "restrictions"],
    "retained native host binding", ["goalFirstTimeoutMs"]);
  need(host.schemaVersion === 1 && host.runtimeSha256 === runtimeSha256, "Use the original pinned package for this legacy worker binding");
  if (Object.hasOwn(host, "goalFirstTimeoutMs")) need(Number.isSafeInteger(host.goalFirstTimeoutMs) &&
    host.goalFirstTimeoutMs > 0 && host.goalFirstTimeoutMs <= maximumAttemptMs, "Invalid finite Goal-First host deadline override");
  fields(host.restrictions, ["allowedClients", "allowedModels", "allowedProviders", "requireDistinctModels"], "paired role restrictions");
  need(Object.entries(host.restrictions).every(([name, value]) => name === "requireDistinctModels" ? typeof value === "boolean" :
    Array.isArray(value) && value.length > 0 && value.length <= 64 && value.every((item) => typeof item === "string")),
  "Invalid paired role restrictions");
  pairFields(host.pair, false);
  let pair = host.pair;
  const source = host.override === null ? "project-default" : "per-run-override";
  if (host.override !== null) {
    fields(host.override, ["attempt", "expiresAt", "pair"], "bounded per-run override");
    need(host.override.attempt === entry.request.identity.attempt && Number.isSafeInteger(host.override.expiresAt) &&
      host.override.expiresAt <= grant.expiresAt && host.override.expiresAt >= grant.issuedAt &&
      grant.overrideSha256 === hash(jsonBytes(host.override)), "Unapproved or unbounded per-run override");
    pairFields(host.override.pair, false);
    pair = host.override.pair;
  } else need(grant.overrideSha256 === null, "Approved override missing");
  const { implementer, reviewer } = pair;
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
  const cfg = await trustedJson(reviewer.configuration);
  need(cfg.schemaVersion === 1 && cfg.model === reviewer.model, "Retained reviewer configuration differs");
  await Promise.all([qualification(implementer, runtimeSha256, request.authority.authorSession, request.authority.orchestrator),
    qualification(reviewer, runtimeSha256, request.authority.authorSession, request.authority.orchestrator),
    ...implementer.inventory.map((pin) => pinnedFile(pin)), ...reviewer.inventory.map((pin) => pinnedFile(pin)),
    pinnedFile(implementer.executable, { executable: true })]);
  need(![request.authority.orchestrator, request.authority.authorSession].includes(reviewer.session), "Reviewer session is not independent");
  const launchNonce = "preflight-" + request.identity.attempt;
  const roleOptions = { source, restrictions: host.restrictions };
  effectiveRole(implementer, "implementer", request, launchNonce, roleOptions);
  effectiveRole(reviewer, "reviewer", request, { implementer: launchNonce, implementerModel: implementer.model },
    roleOptions);
  return { pair, ...roleOptions, reviewerConfig: cfg, profileIds,
    ...(prospective ? { attemptPolicy: true, goalFirstTimeoutMs: host.goalFirstTimeoutMs ?? null } : {}),
    physicalSlot: profileIds[0], expiresAt: host.override?.expiresAt ?? grant.expiresAt };
}
