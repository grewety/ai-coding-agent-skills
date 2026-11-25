import { fields, roleConfig, roleNames, validatePin } from "./role-config.mjs";
import { inspectPinnedFile, parseStrictJson } from "./agent-configuration.mjs";

export function validateRoleBindings(input) {
  fields(input, ["schemaVersion", "roles", "reviewerHost"], [], "external role bindings");
  if (input.schemaVersion !== 1) throw new Error("Unsupported external role binding schema");
  fields(input.roles, roleNames, [], "roles");
  return {
    schemaVersion: 1,
    roles: Object.fromEntries(roleNames.map((name) =>
      [name, name === "helper" && input.roles[name] === null ? null : roleConfig(input.roles[name])])),
    reviewerHost: validatePin(input.reviewerHost),
  };
}

export function readRoleBindings(pin, excluded = []) {
  const binding = validateRoleBindings(parseStrictJson(inspectPinnedFile(pin, { read: true, excluded })));
  const host = parseStrictJson(inspectPinnedFile(binding.reviewerHost, { read: true, excluded }));
  if (host.schemaVersion !== 2 || JSON.stringify(roleConfig(host.roleBinding)) !== JSON.stringify(binding.roles.reviewer)) {
    throw new Error("Reviewer host differs from the independently pinned role tuple");
  }
  return binding;
}
