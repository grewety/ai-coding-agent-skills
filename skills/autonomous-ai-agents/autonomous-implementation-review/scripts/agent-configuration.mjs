import { createHash } from "node:crypto";
import { closeSync, constants, fstatSync, lstatSync, openSync, readSync, realpathSync } from "node:fs";
import path from "node:path";
import { need, validatePin } from "./role-config.mjs";

export const hashBytes = (bytes) => createHash("sha256").update(bytes).digest("hex");
export const jsonBytes = (value) => Buffer.from(JSON.stringify(value, null, 2) + "\n");

export function disjoint(a, b) {
  const outside = (root, file) => {
    const rel = path.relative(root, file);
    return rel === ".." || rel.startsWith(".." + path.sep) || path.isAbsolute(rel);
  };
  return outside(a, b) && outside(b, a);
}

export function inspectPinnedFile(input, { executable = false, excluded = [], read = false } = {}) {
  const pin = validatePin(input);
  need(realpathSync(pin.path) === pin.path && excluded.every((root) => disjoint(root, pin.path)), "Unsafe or overlapping pinned file");
  const parent = lstatSync(path.dirname(pin.path));
  need(process.getuid && [0, process.getuid()].includes(parent.uid) && !(parent.mode & 0o022), "Untrusted pin directory");
  const fd = openSync(pin.path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  const hash = createHash("sha256");
  const chunks = [];
  try {
    const before = fstatSync(fd);
    need(before.isFile() && [0, process.getuid()].includes(before.uid) && !(before.mode & 0o022) &&
      before.size > 0 && before.size <= (executable ? 512 * 1024 * 1024 : 64 * 1024) &&
      (executable ? before.mode & 0o111 : before.nlink === 1), "Untrusted pinned file");
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
    need(hash.digest("hex") === pin.sha256, executable ? "Executable SHA-256 pin mismatch" : "Configuration SHA-256 pin mismatch");
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
