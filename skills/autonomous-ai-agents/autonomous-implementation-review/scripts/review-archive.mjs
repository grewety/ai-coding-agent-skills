import { need, relative } from "./review-inputs.mjs";

const activePrefix = (change) => `openspec/changes/${change}/`;
const archiveRoot = "openspec/changes/archive/";
const same = (a, b) => Boolean(a && b && a.oid === b.oid && a.mode === b.mode);
const regular = (entry) => ["100644", "100755"].includes(entry?.mode);
const under = (entries, prefix) => [...entries.keys()].filter((name) => name.startsWith(prefix));

function archivePrefixes(entries, change) {
  const prefixes = new Set();
  for (const name of under(entries, archiveRoot)) {
    const directory = name.slice(archiveRoot.length).split("/")[0];
    if (directory !== change && (directory.length !== change.length + 11 || directory.slice(10) !== "-" + change)) continue;
    const date = directory.slice(0, -(change.length + 1));
    const parsed = new Date(date + "T00:00:00.000Z");
    need(/^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(+parsed) &&
      parsed.toISOString().slice(0, 10) === date &&
      name.startsWith(archiveRoot + directory + "/"), "Noncanonical archive change path");
    prefixes.add(archiveRoot + directory + "/");
  }
  return [...prefixes];
}

// Logically map to the active coordinates only after verifying the exact move.
export function relocatedPlan({ change, targetTree, baseTree, frozenTree, predecessor, additions }) {
  const active = activePrefix(change);
  const archives = archivePrefixes(targetTree, change);
  if (!archives.length) return targetTree;
  need(archives.length === 1 && !under(targetTree, active).length &&
    !archivePrefixes(frozenTree, change).length, "Ambiguous active/archive planning inventory");
  const archive = archives[0];
  const before = predecessor();
  for (const source of [before, baseTree]) {
    need(!archivePrefixes(source, change).length && under(source, active).length > 0,
      "Missing verified active archive predecessor");
    for (const name of new Set([...source.keys(), ...targetTree.keys()])) {
      if (same(source.get(name), targetTree.get(name))) continue;
      need(relative(name), "Unsafe archive diff path");
      if (name.startsWith(active)) {
        const entry = source.get(name);
        need(regular(entry) && same(entry, targetTree.get(archive + name.slice(active.length))),
          "Archive move changed or omitted a file's bytes or mode");
      } else if (name.startsWith(archive)) {
        const suffix = name.slice(archive.length);
        const entry = targetTree.get(name);
        need(same(source.get(active + suffix), entry) ||
          (entry?.mode === "100644" && /^evidence\/[a-zA-Z0-9_-][a-zA-Z0-9_.-]*\.json$/.test(suffix) && additions(name, entry)),
          "Unexpected archive addition or changed bytes or mode");
      } else throw new Error("Archive target is not a record-only diff");
    }
  }
  return new Map([...targetTree].map(([name, entry]) =>
    [name.startsWith(archive) ? active + name.slice(archive.length) : name, entry]));
}
