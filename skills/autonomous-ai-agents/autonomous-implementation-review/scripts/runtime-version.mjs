const invalid = (reason) => { throw new Error(reason); };
const pattern = /^(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

function parse(value) {
  const match = typeof value === "string" && value.length <= 100 && pattern.exec(value);
  if (!match) invalid("Expected a verifiable three-component runtime version");
  const pre = match[4]?.split(".") ?? [];
  if (pre.some((part) => /^0[0-9]+$/.test(part))) invalid("Invalid numeric prerelease identifier");
  return { numbers: match.slice(1, 4).map(Number), pre };
}

function compare(left, right) {
  const a = parse(left);
  const b = parse(right);
  for (let i = 0; i < a.numbers.length; i++) {
    if (a.numbers[i] !== b.numbers[i]) return a.numbers[i] - b.numbers[i];
  }
  if (!a.pre.length || !b.pre.length) return Number(!a.pre.length) - Number(!b.pre.length);
  for (let i = 0; i < Math.min(a.pre.length, b.pre.length); i++) {
    const x = a.pre[i];
    const y = b.pre[i];
    if (x === y) continue;
    const xn = /^\d+$/.test(x);
    const yn = /^\d+$/.test(y);
    if (xn && yn && x.length !== y.length) return x.length - y.length;
    if (xn !== yn) return xn ? -1 : 1;
    return x < y ? -1 : 1;
  }
  return a.pre.length - b.pre.length;
}

export function versionPolicy(settings, testedFloor) {
  const { versionPolicy: policy = "gte", versionCheck = true, minVersion = testedFloor, maxVersion, exactVersion } = settings;
  if (typeof versionCheck !== "boolean") invalid("versionCheck must be boolean");
  if (policy === "exact") {
    if (settings.minVersion !== undefined || maxVersion !== undefined) invalid("Exact version cannot have range bounds");
    parse(exactVersion);
    return { versionPolicy: policy, versionCheck, exactVersion };
  }
  if (policy !== "gte" || exactVersion !== undefined) invalid("Unsupported or ambiguous version policy");
  if (!minVersion) invalid("No tested version floor is available for this client");
  parse(minVersion);
  if (testedFloor && compare(minVersion, testedFloor) < 0) invalid("Configured minimum falls below the tested floor");
  if (maxVersion !== undefined && compare(maxVersion, minVersion) < 0) invalid("Maximum version falls below the minimum");
  return { versionPolicy: policy, versionCheck, minVersion, ...(maxVersion === undefined ? {} : { maxVersion }) };
}

export function auditVersion(settings, observedVersion, testedFloor) {
  const policy = versionPolicy(settings, testedFloor);
  parse(observedVersion);
  if (!policy.versionCheck) return { ...policy, observedVersion, comparison: "disabled" };
  if (policy.versionPolicy === "exact") {
    if (observedVersion !== policy.exactVersion) invalid("Observed version does not match exactVersion");
  } else {
    if (compare(observedVersion, policy.minVersion) < 0) invalid("Observed version is below minVersion");
    if (policy.maxVersion && compare(observedVersion, policy.maxVersion) > 0) invalid("Observed version is above maxVersion");
  }
  return { ...policy, observedVersion, comparison: "passed" };
}

const versionLabels = {
  codex: [/^codex(?:-cli)? (\S+)$/],
  "claude-code": [/^(\S+) \(Claude Code\)$/],
  bubblewrap: [/^bubblewrap (\S+)$/],
  hermes: [/^Hermes Agent v?(\S+)(?: \([\d-]+\))?$/],
  opencode: [/^opencode v?(\S+)$/],
  kilo: [/^(?:kilo|Kilo Code) v?(\S+)$/],
  pi: [/^pi v?(\S+)$/],
  agy: [/^(?:agy|Antigravity CLI) v?(\S+)$/],
  "grok-build": [/^(?:grok-build|grok) v?(\S+)$/, /^grok v?(\S+) \([0-9a-f]{7,40}\)(?: \[stable\])?$/],
  gemini: [/^gemini(?:-cli)? v?(\S+)$/],
  openspec: [/^openspec v?(\S+)$/],
};

export function reportedVersion(stdout, client) {
  if (typeof stdout !== "string" || stdout.length > 4096) return null;
  const line = stdout.trim();
  const forms = [/^v?(\S+)$/, ...(client ? versionLabels[client] ?? [] : Object.values(versionLabels).flat())];
  for (const form of forms) {
    const match = form.exec(line);
    if (!match) continue;
    try { parse(match[1]); return match[1]; }
    catch { /* Try the remaining recognized forms. */ }
  }
  return null;
}
