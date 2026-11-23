export const planningLimits = Object.freeze({
  files: 256, entries: 512, bytes: 16 * 1024 * 1024, fileBytes: 4 * 1024 * 1024,
  depth: 16, outputBytes: 128 * 1024,
});

export function safePlanningPath(file) {
  return typeof file === "string" && file.split("/").every((part) =>
    part && part !== "." && part !== ".." && !/[\\:\u0000-\u001f\u007f]/.test(part));
}

export function planningLayout(change) {
  if (typeof change !== "string" || change.length > 200 || change === "archive" ||
      !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(change)) throw new Error("Expected a literal OpenSpec change name");
  const directory = `openspec/changes/${change}`;
  const required = ["openspec/config.yaml", ...[".openspec.yaml", "proposal.md", "tasks.md"].map((file) => `${directory}/${file}`)];
  const specs = `${directory}/specs`;
  return { directory, required, specs, design: `${directory}/design.md`,
    includes: (file) => required.includes(file) || file === `${directory}/design.md` || file.startsWith(`${specs}/`) };
}

export function planningBudget() {
  let files = 0;
  let entries = 0;
  let bytes = 0;
  let outputBytes = 0;
  const seen = new Set();
  return {
    add(file, size) {
      if (!safePlanningPath(file) || seen.has(file)) throw new Error(`Unsafe or duplicate planning path: ${file}`);
      seen.add(file);
      if (file.split("/").length > planningLimits.depth) throw new Error(`Planning inventory depth limit exceeded: ${file}`);
      if (++entries > planningLimits.entries) throw new Error("Planning inventory entry limit exceeded");
      // Charge each path plus a ceiling for Git entry framing or its JSON hash.
      outputBytes += Buffer.byteLength(JSON.stringify(file)) + 96;
      if (outputBytes > planningLimits.outputBytes) throw new Error("Planning inventory output limit exceeded");
      if (size === null) return;
      if (++files > planningLimits.files) throw new Error("Planning inventory file limit exceeded");
      if (!Number.isSafeInteger(size) || size < 0 || size > planningLimits.fileBytes) throw new Error(`Planning input is too large or invalid: ${file}`);
      bytes += size;
      if (bytes > planningLimits.bytes) throw new Error("Planning inventory aggregate byte limit exceeded");
    },
    totals: () => ({ files, entries, bytes, outputBytes }),
  };
}

export function validatePlanningInputs(change, inputs, totals) {
  const layout = planningLayout(change);
  if (!inputs || typeof inputs !== "object" || Array.isArray(inputs) ||
      !layout.required.every((file) => Object.hasOwn(inputs, file))) throw new Error("Incomplete planning inventory inputs");
  const budget = planningBudget();
  for (const [file, hash] of Object.entries(inputs)) {
    if (!layout.includes(file) || typeof hash !== "string" || !/^[a-f0-9]{64}$/.test(hash)) throw new Error("Invalid planning inventory inputs");
    budget.add(file, 0);
  }
  // Older observations only carried hashes. Byte accounting comes from a fresh
  // guard inventory when those callers make an acceptance decision.
  if (totals !== undefined) {
    const minimum = budget.totals();
    if (!totals || totals.files !== minimum.files ||
        !Number.isSafeInteger(totals.entries) || totals.entries < minimum.entries || totals.entries > planningLimits.entries ||
        !Number.isSafeInteger(totals.bytes) || totals.bytes < 0 || totals.bytes > planningLimits.bytes ||
        !Number.isSafeInteger(totals.outputBytes) || totals.outputBytes < minimum.outputBytes || totals.outputBytes > planningLimits.outputBytes) {
      throw new Error("Invalid planning inventory totals");
    }
  }
}
