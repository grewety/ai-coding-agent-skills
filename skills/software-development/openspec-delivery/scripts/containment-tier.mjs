import { lstatSync, readdirSync, realpathSync } from "node:fs";
import path from "node:path";
import { disjoint, trustedHostPath } from "./agent-configuration.mjs";
import { absolute, need } from "./role-config.mjs";

export const tierFields = ["containmentTier", "osDriver"];
export const defaultReviewerTimeoutMs = 300000;
export const maximumReviewerTimeoutMs = 600000;
export const grokTierBlocker = "Grok 1.0.92 Tier B requires native provider-only HTTPS, role-specific OS mounts, a sole read_file tool and sealed whole-file qualification replay";
export const wrappedWorkerBlocker = "Tier B wrapped implementer requires exact native role, scoped OS writes, provider-only HTTPS and sealed qualification";

export function driverDisposition(driver, platform = process.platform) {
  switch (driver) {
    case "linux-bwrap":
    case "linux-codex-native":
      return platform === "linux" ? "available-for-preflight" : "unsupported-on-host";
    case "windows-container":
      return platform === "win32" ? "unqualified" : "unsupported-on-host";
    case "macos-seatbelt":
      return platform === "darwin" ? "unqualified" : "unsupported-on-host";
    default:
      return "unknown-driver";
  }
}

export function tierIdentity(record) {
  if (!tierFields.some((field) => Object.hasOwn(record, field))) return {};
  const { containmentTier, osDriver } = record;
  need(["a", "b"].includes(containmentTier) && typeof osDriver === "string" &&
    driverDisposition(osDriver) !== "unknown-driver", "Unknown or incomplete containment tier or driver");
  return { containmentTier, osDriver };
}

export function requireTier(record, role, client, platform = process.platform) {
  const tier = tierIdentity(record);
  const disposition = driverDisposition(tier.osDriver, platform);
  need(disposition === "available-for-preflight", `Containment driver ${tier.osDriver}: ${disposition}`);
  const allowed = role === "reviewer" ? tier.osDriver === "linux-bwrap" &&
    (tier.containmentTier === "a" ? ["claude-code", "pi"].includes(client) : client === "grok-build")
    : role === "implementer" && tier.containmentTier === "b" &&
      tier.osDriver === (client === "codex" ? "linux-codex-native" : "linux-bwrap");
  need(allowed, "Containment tier and driver do not match the selected role and client");
  return tier;
}

export function authDirectoryIdentity(directory, excluded = []) {
  // This boundary uses only directory and file metadata. The pilot allowlist
  // stays closed until a concrete native auth layout has been qualified.
  const invalid = "Unsafe dedicated auth directory or auth-only inventory";
  need(process.getuid && absolute(directory) && excluded.every((root) => disjoint(directory, root)) &&
    trustedHostPath(directory) === directory && realpathSync(directory) === directory &&
    !directory.split(path.sep).some((part) => /^\.(?:agents|claude|codex|config|grok|hermes|pi|ssh|gnupg)$/.test(part)), invalid);
  const before = lstatSync(directory, { bigint: true });
  need(before.isDirectory() && before.uid === BigInt(process.getuid()) && (before.mode & 0o7777n) === 0o700n, invalid);
  const names = readdirSync(directory);
  need(names.length === 1 && names[0] === "auth.json", invalid);
  const auth = lstatSync(path.join(directory, "auth.json"), { bigint: true });
  need(auth.isFile() && auth.nlink === 1n && auth.uid === before.uid && (auth.mode & 0o7777n) === 0o600n, invalid);
  const after = lstatSync(directory, { bigint: true });
  need(before.dev === after.dev && before.ino === after.ino && before.ctimeNs === after.ctimeNs, invalid);
  return { device: String(before.dev), inode: String(before.ino), inventoryChangedAt: String(before.ctimeNs),
    authDevice: String(auth.dev), authInode: String(auth.ino), authChangedAt: String(auth.ctimeNs) };
}
