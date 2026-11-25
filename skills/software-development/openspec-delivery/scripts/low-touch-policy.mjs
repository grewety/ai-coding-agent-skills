// This contract is also shipped with the independently installable reviewer.
export const reviewPhases = Object.freeze(["planning", "execution", "finish"]);
export const reviewDefaults = Object.freeze({ maxReviews: 10, maxTotalUsd: 25 });
const need = (ok, reason) => { if (!ok) throw new Error(reason); };
const object = (value) => value && Object.getPrototypeOf(value) === Object.prototype;
const keys = (value, allowed) => object(value) && Object.keys(value).every((key) => allowed.includes(key));
const label = (value) => typeof value === "string" && /^[\x21-\x7e][\x20-\x7e]{0,255}$/.test(value);
export const sha256Value = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);

// USD is expressed and compared in integer millionths.
export function usdMicros(value) {
  need(typeof value === "number" && value > 0 && /^\d+(?:\.\d{1,6})?$/.test(String(value)), "Invalid USD bound");
  const [whole, fraction = ""] = String(value).split(".");
  const amount = Number(whole) * 1_000_000 + Number(fraction.padEnd(6, "0"));
  need(Number.isSafeInteger(amount), "Invalid USD bound");
  return amount;
}

export function zeroTrigger(entry) {
  return keys(entry, ["id", "repository", "event", "target", "configurationSha256", "exposure", "kind", "costUsd"]) &&
    ["id", "repository", "target", "exposure"].every((field) => label(entry[field])) &&
    ["push", "pull_request", "merge"].includes(entry.event) && sha256Value(entry.configurationSha256) &&
    entry.costUsd === 0 && entry.kind === "repository-check";
}

function policyJson(source) {
  need(Buffer.byteLength(source) <= 65536, "Integrated low-touch policy exceeds its size bound");
  const value = JSON.parse(source);
  const nesting = [];
  let previous;
  for (const [token] of source.matchAll(/"(?:[^"\\]|\\.)*"|[{}\[\]:]/g)) {
    if (token === "{") nesting.push(new Set());
    if (token === "[") nesting.push(null);
    if (token === "}" || token === "]") nesting.pop();
    if (token === ":") {
      const name = JSON.parse(previous);
      const keys = nesting.at(-1);
      need(keys && !keys.has(name), "Duplicate integrated low-touch policy key");
      keys.add(name);
    }
    previous = token;
  }
  return value;
}

export function readLowTouchPolicy(source) {
  const markers = [];
  let fence;
  let comment = false;
  for (const line of source.split(/\r?\n/)) {
    const mark = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (fence) {
      if (mark && mark[1][0] === fence[0] && mark[1].length >= fence.length && !mark[2].trim()) fence = null;
      continue;
    }
    if (comment) { if (line.includes("-->")) comment = false; continue; }
    if (mark) { fence = mark[1]; continue; }
    if (line.startsWith("<!-- openspec-low-touch:")) markers.push(line);
    else if (line.includes("<!--") && !line.includes("-->")) comment = true;
  }
  if (!markers.length) return null;
  const match = /^<!-- openspec-low-touch: (\{.*\}) -->$/.exec(markers[0]);
  need(markers.length === 1 && match, "Ambiguous or invalid low-touch policy marker");
  const value = policyJson(match[1]);
  need(keys(value, ["mode", "phases", "maxReviews", "maxTotalUsd", "standingTriggers"]), "Invalid low-touch policy");
  const { mode = "auto-approved", phases = reviewPhases, maxReviews = reviewDefaults.maxReviews,
    maxTotalUsd = reviewDefaults.maxTotalUsd, standingTriggers = [] } = value;
  need(["auto-approved", "explicit"].includes(mode) && Array.isArray(phases) && phases.length > 0 &&
    phases.every((phase) => reviewPhases.includes(phase)) && new Set(phases).size === phases.length &&
    Number.isSafeInteger(maxReviews) && maxReviews > 0, "Invalid integrated review mode, phases or count ceiling");
  usdMicros(maxTotalUsd);
  need(Array.isArray(standingTriggers) && standingTriggers.length <= 64 && standingTriggers.every(zeroTrigger) &&
    new Set(standingTriggers.map(({ id, repository, event, target }) => JSON.stringify([id, repository, event, target]))).size === standingTriggers.length,
  "Invalid or duplicate standing trigger");
  return { mode, phases, maxReviews, maxTotalUsd, standingTriggers };
}

export function reviewAuthority(policy, { mode, phase, caps = {} }) {
  need(mode === undefined || mode === "explicit", "Only an explicit per-run override is supported");
  if (!policy || policy.mode === "explicit" || mode === "explicit") return { mode: "explicit" };
  need(policy.phases.includes(phase) && keys(caps, ["maxReviews", "maxTotalUsd"]), "Automatic review phase or effective caps are unverified");
  const { maxReviews = Math.min(reviewDefaults.maxReviews, policy.maxReviews),
    maxTotalUsd = Math.min(reviewDefaults.maxTotalUsd, policy.maxTotalUsd) } = caps;
  const limitMicros = usdMicros(maxTotalUsd);
  need(Number.isSafeInteger(maxReviews) && maxReviews > 0 && maxReviews <= policy.maxReviews &&
    limitMicros <= usdMicros(policy.maxTotalUsd), "Automatic review caps exceed the integrated ceilings");
  return { mode: "auto-approved", maxReviews, maxTotalUsd, limitMicros };
}
