import { absolute, fields, need, roleConfig, roleNames, validatePin } from "./role-config.mjs";
import { inspectPinnedFile, parseStrictJson } from "./agent-configuration.mjs";

function validateWorksetRoots(roots) {
  need(Array.isArray(roots) && roots.length > 0, "Expected approved OpenSpec workset roots");
  const paths = new Set();
  return roots.map((root) => {
    fields(root, ["path", "device", "inode", "uid"], [], "approved OpenSpec workset root");
    need(absolute(root.path) && !paths.has(root.path) &&
      [root.device, root.inode, root.uid].every((value) => typeof value === "string" && /^(0|[1-9][0-9]*)$/.test(value)),
    "Invalid or duplicate approved OpenSpec workset root");
    paths.add(root.path);
    return { path: root.path, device: root.device, inode: root.inode, uid: root.uid };
  });
}

export function validateRoleBindings(input) {
  fields(input, ["schemaVersion", "roles", "reviewerHost"], ["worksetRoots"], "external role bindings");
  if (input.schemaVersion !== 1) throw new Error("Unsupported external role binding schema");
  fields(input.roles, roleNames, [], "roles");
  return {
    schemaVersion: 1,
    roles: Object.fromEntries(roleNames.map((name) =>
      [name, name === "helper" && input.roles[name] === null ? null : roleConfig(input.roles[name])])),
    reviewerHost: validatePin(input.reviewerHost),
    ...(input.worksetRoots === undefined ? {} : { worksetRoots: validateWorksetRoots(input.worksetRoots) }),
  };
}

export function readRoleBindings(pin, excluded = []) {
  const binding = validateRoleBindings(parseStrictJson(inspectPinnedFile(pin, { read: true, excluded })));
  const host = parseStrictJson(inspectPinnedFile(binding.reviewerHost, { read: true, excluded }));
  if (![2, 4].includes(host.schemaVersion) || JSON.stringify(roleConfig(host.roleBinding)) !== JSON.stringify(binding.roles.reviewer)) {
    throw new Error("Reviewer host differs from the independently pinned role tuple");
  }
  return binding;
}
