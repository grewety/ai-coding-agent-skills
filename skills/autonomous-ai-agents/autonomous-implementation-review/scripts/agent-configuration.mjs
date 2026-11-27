import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { closeSync, constants, fstatSync, lstatSync, openSync, readlinkSync, readSync, realpathSync } from "node:fs";
import path from "node:path";
import { absolute, need, validatePin } from "./role-config.mjs";

export const hashBytes = (bytes) => createHash("sha256").update(bytes).digest("hex");
export const jsonBytes = (value) => Buffer.from(JSON.stringify(value, null, 2) + "\n");

export function disjoint(a, b) {
  const outside = (root, file) => {
    const rel = path.relative(root, file);
    return rel === ".." || rel.startsWith(".." + path.sep) || path.isAbsolute(rel);
  };
  return outside(a, b) && outside(b, a);
}

const windowsAclScript = String.raw`
$ErrorActionPreference = 'Stop'
$file = [Environment]::GetEnvironmentVariable('DIRECT_REVIEW_ACL_PATH')
$acl = Get-Acl -LiteralPath $file
$user = [Security.Principal.WindowsIdentity]::GetCurrent().User
$trusted = @($user.Value, 'S-1-5-18', 'S-1-5-32-544', 'S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464')
$owner = $acl.GetOwner([Security.Principal.SecurityIdentifier])
if ($owner.Value -notin $trusted -or ($env:DIRECT_REVIEW_ACL_PRIVATE -eq '1' -and $owner.Value -ne $user.Value)) { exit 2 }
$protected = if ($env:DIRECT_REVIEW_ACL_PRIVATE -eq '1') { 0x1f01ff } else { 0x0d0156 }
foreach ($rule in $acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])) {
  if ($rule.AccessControlType -eq 'Allow' -and $rule.IdentityReference.Value -notin $trusted -and
      (([int]$rule.FileSystemRights -band $protected) -ne 0)) { exit 3 }
}
exit 0
`;

function windowsPathAccess(file, privateOnly = false) {
  const system = process.env.SystemRoot;
  if (!absolute(system)) return false;
  const powershell = path.join(system, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  const result = spawnSync(powershell, ["-NoProfile", "-NonInteractive", "-Command", windowsAclScript], {
    env: { SystemRoot: system, WINDIR: system, DIRECT_REVIEW_ACL_PATH: file,
      DIRECT_REVIEW_ACL_PRIVATE: privateOnly ? "1" : "0" }, stdio: "ignore", windowsHide: true, timeout: 6500,
  });
  return !result.error && result.status === 0;
}

export function privatePath(file, stat = lstatSync(file)) {
  if (process.platform === "win32") return windowsPathAccess(file, true);
  return stat.uid === process.getuid() && !(stat.mode & 0o077);
}

export function trustedHostPath(file) {
  if (!absolute(file)) return null;
  if (process.platform === "win32") {
    try {
      const resolved = path.normalize(realpathSync(file));
      return windowsPathAccess(resolved) && windowsPathAccess(path.dirname(resolved)) ? resolved : null;
    } catch {
      return null;
    }
  }
  const uid = process.getuid();
  const systemUid = lstatSync(path.parse(file).root).uid;
  const resolve = (entry, links, ancestor = false) => {
    const parent = path.dirname(entry);
    const directory = parent === entry ? entry : resolve(parent, links, true);
    if (!directory) return null;
    const candidate = parent === entry ? entry : path.join(directory, path.basename(entry));
    const info = lstatSync(candidate);
    if (info.uid !== systemUid && info.uid !== uid) return null;
    if (info.isSymbolicLink()) {
      if (links.has(candidate) || links.size >= 40) return null;
      return resolve(path.resolve(directory, readlinkSync(candidate)), new Set([...links, candidate]), ancestor);
    }
    // A root-owned sticky ancestor cannot be used by another UID to replace a trusted child.
    const stickyAncestor = ancestor && info.isDirectory() && info.uid === systemUid && (info.mode & 0o1000);
    if ((info.mode & 0o022) && !stickyAncestor) return null;
    return (ancestor ? info.isDirectory() : info.isDirectory() || info.isFile()) ? candidate : null;
  };
  try {
    const resolved = resolve(file, new Set());
    return resolved === realpathSync(file) ? resolved : null;
  } catch {
    return null;
  }
}

export function inspectPinnedFile(input, { executable = false, excluded = [], read = false, discover = false, runtime = false } = {}) {
  const discovering = discover && !Object.hasOwn(input, "sha256");
  const pin = discovering ? input : validatePin(input);
  if (discover) need(trustedHostPath(pin.path) === pin.path, "Untrusted discovery path");
  need(realpathSync(pin.path) === pin.path && excluded.every((root) => disjoint(root, pin.path)), "Unsafe or overlapping pinned file");
  const parent = lstatSync(path.dirname(pin.path));
  const owners = [lstatSync(path.parse(pin.path).root).uid, process.getuid?.()];
  need(process.platform === "win32" ? trustedHostPath(pin.path) === pin.path :
    owners.includes(parent.uid) && !(parent.mode & 0o022), "Untrusted pin directory");
  const fd = openSync(pin.path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
  const hash = createHash("sha256");
  const chunks = [];
  try {
    const before = fstatSync(fd);
    need(before.isFile() && (process.platform === "win32" || owners.includes(before.uid) && !(before.mode & 0o022)) &&
      before.size > 0 && before.size <= (executable || runtime ? 512 * 1024 * 1024 : 64 * 1024) &&
      (executable ? process.platform === "win32" || before.mode & 0o111 : before.nlink === 1), "Untrusted pinned file");
    const buffer = Buffer.alloc(64 * 1024);
    let remaining = before.size;
    while (remaining) {
      const count = readSync(fd, buffer, 0, Math.min(buffer.length, remaining), null);
      need(count, "Pinned file changed during read");
      const bytes = buffer.subarray(0, count);
      hash.update(bytes);
      if (read) chunks.push(Buffer.from(bytes));
      remaining -= count;
    }
    const after = lstatSync(pin.path);
    need(realpathSync(pin.path) === pin.path && after.dev === before.dev && after.ino === before.ino &&
      after.size === before.size && after.ctimeMs === before.ctimeMs, "Pinned file changed during read");
    const sha256 = hash.digest("hex");
    if (discovering) return { path: pin.path, sha256 };
    need(sha256 === pin.sha256, executable ? "Executable SHA-256 pin mismatch" : "Configuration SHA-256 pin mismatch");
    if (discover) return pin;
    return read ? Buffer.concat(chunks) : undefined;
  } finally { closeSync(fd); }
}

const utf8 = (bytes) => new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);

export function parseStrictJson(bytes) {
  const input = utf8(bytes);
  // Walk the JSON grammar before JSON.parse, comparing decoded member names.
  const token = /[\x20\t\r\n]*("(?:[^"\\\x00-\x1f]|\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))*"|[{}\[\]:,]|true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/y;
  let next;
  const advance = () => { next = token.exec(input)?.[1]; };
  const fail = () => { throw new Error("Invalid or duplicate JSON fields"); };
  function value(depth) {
    if (!next || depth > 64) fail();
    const opening = next;
    advance();
    if (opening === "{" || opening === "[") {
      const close = opening === "{" ? "}" : "]";
      const seen = new Set();
      if (next !== close) {
        for (;;) {
          if (opening === "{") {
            if (!next?.startsWith('"')) fail();
            const key = JSON.parse(next);
            if (seen.has(key)) fail();
            seen.add(key);
            advance();
            if (next !== ":") fail();
            advance();
          }
          value(depth + 1);
          if (next !== ",") break;
          advance();
        }
      }
      if (next !== close) fail();
      advance();
    } else if (/^[\]}:,]$/.test(opening)) fail();
  }
  advance();
  value(0);
  if (next !== undefined) fail();
  try { return JSON.parse(input); } catch { return fail(); }
}
