import { candidate, committedDocument, planning } from "./change-guard.mjs";
import { planningLayout } from "./planning-inventory.mjs";

const need = (condition, message) => { if (!condition) throw new Error(message); };
const capabilityName = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const requirementMark = /^### Requirement: (\S.*)$/;
const operationMark = /^## (ADDED|MODIFIED|REMOVED|RENAMED) Requirements$/;

// Match only real headings. Fenced examples may contain OpenSpec-like headings.
function headings(source) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const found = [];
  let fence = null;
  let comment = false;
  for (const [index, line] of lines.entries()) {
    const mark = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (fence) {
      if (mark && mark[1][0] === fence[0] && mark[1].length >= fence.length && !mark[2].trim()) fence = null;
      continue;
    }
    if (comment) { if (line.includes("-->")) comment = false; continue; }
    if (line.trimStart().startsWith("<!--")) { comment = !line.includes("-->"); continue; }
    if (mark) { fence = mark[1]; continue; }
    if (/^#{1,3} /.test(line)) found.push({ index, heading: line.trimEnd() });
  }
  need(!fence && !comment, "Unclosed Markdown block");
  return found.map(({ index, heading }, i) => ({ heading, body: lines.slice(index + 1, found[i + 1]?.index)
    .join("\n").replace(/^\n+|\n+$/g, "").trimEnd() }));
}

function currentSpec(source, capability) {
  const match = /^(?:\uFEFF)?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source);
  need(match, "Missing current-spec identity frontmatter");
  const entries = new Map();
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const field = /^([a-z_]+):[ \t]+([a-z0-9/-]+)(?:[ \t]+#.*)?[ \t]*$/.exec(line.trimEnd());
    need(field && !entries.has(field[1]), "Invalid or duplicate current-spec metadata field");
    entries.set(field[1], field[2]);
  }
  need(entries.size === 3 && entries.get("metadata_version") === "1" && entries.get("artifact") === "spec" &&
    entries.get("capability") === capability, "Current-spec identity metadata does not match the capability");
  const requirements = new Map();
  for (const section of headings(source.slice(match[0].length))) {
    const req = requirementMark.exec(section.heading);
    if (!req) continue;
    need(section.body && !requirements.has(req[1]), `Empty or duplicate current requirement: ${req[1]}`);
    requirements.set(req[1], section.body);
  }
  // A valid capability may have its last requirement removed.
  return requirements;
}

function operations(source) {
  const results = [];
  let action = null;
  for (const section of headings(source)) {
    const operation = operationMark.exec(section.heading);
    if (operation) {
      action = operation[1];
      if (action === "RENAMED") {
        const lines = section.body.split("\n").filter((line) => line.trim());
        need(lines.length > 0 && lines.length % 2 === 0, "Incomplete requirement rename");
        for (let i = 0; i < lines.length; i += 2) {
          const from = /^[-*] FROM: `?### Requirement: ([^`]+)`?$/.exec(lines[i])?.[1]?.trim();
          const to = /^[-*] TO: `?### Requirement: ([^`]+)`?$/.exec(lines[i + 1])?.[1]?.trim();
          need(from && to && from !== to, "Invalid FROM/TO requirement rename");
          results.push({ action, name: from, to });
        }
      } else need(!section.body.trim(), `Unexpected text in ${action} Requirements section`);
    } else {
      const req = requirementMark.exec(section.heading);
      if (req) {
        need(action && action !== "RENAMED" && (action === "REMOVED" || section.body), `Invalid delta requirement: ${req[1]}`);
        results.push({ action, name: req[1], body: section.body });
      } else if (section.heading.startsWith("## ")) action = null;
    }
  }
  need(results.length > 0 && new Set(results.map(({ name, action }) => `${action}:${name}`)).size === results.length,
    "Empty or duplicate delta requirements");
  return results;
}

export function checkPromotion({ capability, delta, current, previous }) {
  need(capability.split("/").every((part) => capabilityName.test(part)), "Invalid capability path");
  const actual = currentSpec(current, capability);
  const changes = operations(delta);
  const renamedTo = new Map(changes.filter(({ action }) => action === "RENAMED").map((entry) => [entry.to, entry.name]));
  const renamedFrom = new Set(renamedTo.values());
  const replaced = new Set(changes.filter(({ action }) => action === "MODIFIED").map(({ name }) => name));
  const parent = renamedTo.size ? currentSpec(previous, capability) : null;
  need(renamedTo.size === renamedFrom.size && changes.filter(({ action }) => action === "RENAMED").length === renamedTo.size,
    "Ambiguous requirement rename");
  for (const { action, name, body, to } of changes) {
    if (action === "ADDED" || action === "MODIFIED") {
      need(actual.get(name) === body, `Requirement ${name} is missing or differs from the delta`);
    } else {
      need(!actual.has(name), `Requirement ${name} still exists`);
      if (action === "RENAMED") need(parent.has(name) && actual.has(to) &&
        (replaced.has(to) || actual.get(to) === parent.get(name)), `Renamed requirement ${to} differs from its source`);
    }
  }
  return changes.length;
}

export function finishReadiness(input, result) {
  const { repo, change, head } = input;
  const report = (predicate, issue, promoted = []) => ({ schemaVersion: 1, change, head, ready: false, predicate, issue, promoted });
  if (result?.action !== "accept-result" || result.head !== head) return report("EXACT_RESULT_UNVERIFIED", null);
  let snapshot;
  try { snapshot = candidate(input); }
  catch (error) { return report("CANDIDATE_UNVERIFIED", error.message); }
  if (!snapshot.tasksComplete) return report("NATIVE_OUTCOME_PENDING", null);
  const layout = planningLayout(change);
  const { inputs } = planning(repo, head, change);
  const promoted = [];
  for (const file of Object.keys(inputs).filter((name) => name.startsWith(`${layout.specs}/`) && name.endsWith("/spec.md"))) {
    const capability = file.slice(layout.specs.length + 1, -"/spec.md".length);
    const currentFile = `openspec/specs/${capability}/spec.md`;
    try {
      const delta = committedDocument(repo, head, file);
      const current = committedDocument(repo, head, currentFile);
      const previous = /^## RENAMED Requirements\r?$/m.test(delta) ? committedDocument(repo, snapshot.base, currentFile) : undefined;
      promoted.push({ capability, requirements: checkPromotion({ capability, delta, current, previous }) });
    } catch (error) {
      return report("CURRENT_SPEC_PROMOTION_UNVERIFIED", { capability, path: currentFile, reason: error.message }, promoted);
    }
  }
  return { schemaVersion: 1, change, head, ready: true, predicate: null, issue: null, promoted,
    authority: "separate-finish-grant-required" };
}
