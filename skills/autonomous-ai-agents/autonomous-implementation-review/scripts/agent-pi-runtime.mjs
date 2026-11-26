import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, open, readdir, readlink, realpath, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { disjoint, parseStrictJson } from "./agent-configuration.mjs";
import { piReviewer } from "./agent-role-adapters.mjs";
import { absolute, fields, need } from "./role-config.mjs";

const moduleDir = "node_modules/@earendil-works/pi-coding-agent";
const packageFile = moduleDir + "/package.json";
export const piEntry = "/control/" + moduleDir + "/dist/bundle/cli.js";

export function validatePiRelease(pin) {
  fields(pin, ["path", "version", "inventorySha256"], [], "Pi release pin");
  need(absolute(pin.path) && pin.version === piReviewer.version && typeof pin.inventorySha256 === "string" &&
    /^[a-f0-9]{64}$/.test(pin.inventorySha256), "Invalid Pi release pin");
  return pin;
}

// Traverse the existing release only. Entries are hashed in sorted depth-first order.
export async function piReleaseInventory(root, excluded = [], destination) {
  need(absolute(root) && await realpath(root) === root && excluded.every((other) => disjoint(root, other)),
    "Unsafe or overlapping Pi release root");
  const info = await lstat(root);
  need(info.isDirectory() && [0, process.getuid()].includes(info.uid) && !(info.mode & 0o7022), "Invalid Pi release root");
  const hash = createHash("sha256");
  const record = (...fields) => hash.update(JSON.stringify(fields) + "\n");
  let count = 0;
  let size = 0;
  let version;
  let entry = false;
  const links = [];
  if (destination) await mkdir(destination, { mode: 0o700 });
  async function visit(name, depth) {
    need(++count <= 100000 && depth <= 40, "Pi release inventory exceeds its limit");
    const source = path.join(root, name);
    const target = destination && path.join(destination, name);
    const before = await lstat(source);
    need([0, process.getuid()].includes(before.uid), "Untrusted Pi release owner");
    if (before.isSymbolicLink()) {
      const link = await readlink(source);
      const resolved = path.resolve(path.dirname(source), link);
      need(!path.isAbsolute(link) && /^[\w@.+/-]+$/.test(link) && resolved.startsWith(root + "/node_modules/"),
        "Pi release symlink escapes the runtime");
      links.push(name);
      record("link", name, link);
      if (target) await symlink(link, target);
    } else {
      need(!(before.mode & 0o7022) && await realpath(source) === source, "Unsafe Pi release mode or path");
      if (before.isDirectory()) {
        record("directory", name);
        if (target) await mkdir(target, { mode: 0o700 });
        for (const child of (await readdir(source)).sort()) {
          need(/^[\w@.+-]+$/.test(child) && !/^(?:\.env(?:\.|$)|auth\.json$|settings\.json$|models\.json$|\.git$)/i.test(child),
            "Unsafe Pi release entry name");
          await visit(name + "/" + child, depth + 1);
        }
      } else {
        size += before.size;
        need(before.isFile() && before.size <= 128 * 1024 * 1024 && size <= 1024 * 1024 * 1024,
          "Unsupported Pi release entry or size");
        const input = await open(source, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
        let bytes;
        try {
          const opened = await input.stat();
          need(opened.dev === before.dev && opened.ino === before.ino && opened.ctimeMs === before.ctimeMs,
            "Pi release changed while opening");
          bytes = Buffer.alloc(before.size);
          const { bytesRead } = await input.read(bytes, 0, bytes.length, 0);
          const after = await lstat(source);
          need(bytesRead === before.size && after.dev === before.dev && after.ino === before.ino &&
            after.ctimeMs === before.ctimeMs && after.size === before.size, "Pi release changed while reading");
        } finally { await input.close(); }
        const executable = Boolean(before.mode & 0o111);
        record("file", name, executable, createHash("sha256").update(bytes).digest("hex"));
        if (name === packageFile) {
          need(bytes.length <= 64 * 1024, "Oversized Pi release package metadata");
          const metadata = parseStrictJson(bytes);
          need(metadata.name === "@earendil-works/pi-coding-agent" && metadata.version === piReviewer.version,
            "Pi release package identity or version differs");
          version = metadata.version;
        }
        if ("/control/" + name === piEntry) entry = bytes.length > 0;
        if (target) await writeFile(target, bytes, { flag: "wx", mode: executable ? 0o700 : 0o600 });
      }
    }
  }
  need((await readdir(root)).join() === "node_modules", "Pi release root must contain only node_modules");
  await visit("node_modules", 0);
  for (const name of links) {
    const base = destination ?? root;
    const resolved = await realpath(path.join(base, name));
    need(resolved.startsWith(base + "/node_modules/"), "Pi release symlink resolves outside the runtime");
  }
  need(version && entry, "Pi release is missing its pinned package metadata or CLI entry");
  return { version, inventorySha256: hash.digest("hex") };
}

export async function verifyPiRelease(pin, excluded, destination) {
  validatePiRelease(pin);
  const actual = await piReleaseInventory(pin.path, excluded, destination);
  need(actual.version === pin.version && actual.inventorySha256 === pin.inventorySha256,
    "Pi release inventory pin mismatch");
}
