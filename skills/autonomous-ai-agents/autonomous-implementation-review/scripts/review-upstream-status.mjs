export const upstreamClasses = Object.freeze(["upstream-rate-limited", "upstream-overloaded", "upstream-auth-failed"]);
export function classifyUpstream(status) {
  if (status === 429) return upstreamClasses[0];
  if (status === 529) return upstreamClasses[1];
  if (status === 401 || status === 403) return upstreamClasses[2];
  return null;
}
