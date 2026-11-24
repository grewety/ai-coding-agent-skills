import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { chmod, copyFile, lstat, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { hash } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-inputs.mjs";
import { withReviewRuntime } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-runtime.mjs";

const fixtureSource = String.raw`
#include <arpa/inet.h>
#include <errno.h>
#include <fcntl.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <unistd.h>

static int request_status(int port, const char *request_path) {
    int fd = socket(AF_INET, SOCK_STREAM, 0);
    struct sockaddr_in remote = { .sin_family = AF_INET, .sin_port = htons(port) };
    if (fd < 0 || inet_pton(AF_INET, "127.0.0.1", &remote.sin_addr) != 1 ||
            connect(fd, (struct sockaddr *)&remote, sizeof(remote))) return -1;
    char request[512];
    int length = snprintf(request, sizeof(request),
        "POST %s HTTP/1.1\r\nHost: localhost\r\nContent-Length: 0\r\nConnection: close\r\n\r\n", request_path);
    if (write(fd, request, length) != length) return -1;
    char reply[512] = {0};
    int used = 0;
    while (used < 12) {
        int size = read(fd, reply + used, sizeof(reply) - used - 1);
        if (size <= 0) break;
        used += size;
    }
    close(fd);
    return used >= 12 ? atoi(reply + 9) : -1;
}

int main(void) {
    const char *relay = getenv("ANTHROPIC_BASE_URL");
    const char *separator = relay ? strrchr(relay, ':') : NULL;
    if (!separator || getenv("OPENAI_API_KEY") || getenv("FIXTURE_PUBLISH_TOKEN")) return 11;
    int port = atoi(separator + 1);
    char input;
    if (read(STDIN_FILENO, &input, 1) != 1 || input != 'S') return 12;
    int source = open("/review/fixture.txt", O_RDONLY);
    if (source < 0 || read(source, &input, 1) != 1 || input != 'R') return 13;
    close(source);
    source = open("/review/fixture.txt", O_WRONLY);
    if (source >= 0 || (errno != EROFS && errno != EACCES)) return 14;
    if (access("/control/synthetic-key", F_OK) == 0) return 15;
    if (request_status(port, "/v1/messages") != 200 || request_status(port, "/publish") != 403) return 16;
    puts("PRIVATE_SOCKET_CONTROL_OK");
    return 0;
}
`;

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), "socket-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const short = path.join(root, "s");
  const evidence = path.join(root, "verification-records", "ai-coding-agent-skills",
    "exclusive-worker-runtime-01m84dt53xh6x16nwwqebacz8m", "execution", "group3-live-qualification",
    "attempt-contained-independent-review-01m84dt53xh6x16nwwqebacz8m", "retained");
  await mkdir(short, { mode: 0o700 });
  await mkdir(evidence, { recursive: true, mode: 0o700 });
  await writeFile(path.join(evidence, "sentinel"), "retained review evidence");
  const launcher = path.join(root, "fixture-bwrap");
  await writeFile(launcher, "#!/bin/sh\n[ \"$1\" = --version ] && { echo 'bubblewrap 0.9.0'; exit 0; }\nexit 47\n", { mode: 0o700 });
  const node = path.join(root, "fixture-node");
  await writeFile(node, "#!/bin/sh\nexit 47\n", { mode: 0o700 });
  const keyFile = path.join(root, "synthetic-key");
  await writeFile(keyFile, "synthetic input", { mode: 0o400 });
  const pin = async (file) => ({ path: file, sha256: hash(await readFile(file)) });
  const config = { schemaVersion: 1, bwrap: await pin(launcher), node: await pin(node), claude: await pin(launcher),
    libraries: [], model: "claude-fixture", relay: { route: "same-uid-key", keyFile, keyFormat: "raw" },
    timeoutMs: 3000, maxTurns: 4, maxBudgetUsd: 1, requirePreExposureAttestation: false };
  return { root, short, evidence, config, pin };
}

async function bridgeNodePin(fixture, executable) {
  const source = await realpath(executable);
  if (((await lstat(source)).mode & 0o022) === 0) return fixture.pin(source);
  const privateCopy = path.join(fixture.root, "bridge-node");
  await copyFile(source, privateCopy);
  await chmod(privateCopy, 0o700);
  return fixture.pin(privateCopy);
}

const options = ({ evidence, short }) => ({ parent: evidence, excluded: [evidence], packetCount: 1, scratchRoot: short });

test("private scratch validation rejects group-writable pins, unsafe scratch and oversized UTF-8 socket addresses before bind", async (t) => {
  const f = await fixture(t);
  assert.ok(Buffer.byteLength(path.join(f.evidence, "inference.sock")) >= 108);
  const noBind = async () => assert.fail("started a relay for an unsafe fixture");
  const groupWritable = path.join(f.root, "bad-node");
  await writeFile(groupWritable, "synthetic binary pin");
  await chmod(groupWritable, 0o770);
  await assert.rejects(withReviewRuntime({ ...f.config, node: await f.pin(groupWritable) }, options(f), noBind, noBind), /Unsafe runtime pin/);
  const privateCopy = await bridgeNodePin(f, groupWritable);
  assert.notEqual(privateCopy.path, groupWritable);
  assert.equal((await lstat(privateCopy.path)).mode & 0o777, 0o700);
  assert.equal((await lstat(groupWritable)).mode & 0o777, 0o770);
  assert.equal(privateCopy.sha256, (await f.pin(groupWritable)).sha256);
  const oversized = path.join(f.short, "ü".repeat(45));
  await mkdir(oversized, { mode: 0o700 });
  await assert.rejects(withReviewRuntime(f.config, { ...options(f), scratchRoot: oversized }, noBind, noBind), /socket path exceeds/);
  await chmod(f.short, 0o770);
  await assert.rejects(withReviewRuntime(f.config, options(f), noBind, noBind), /Unsafe Unix relay scratch root/);
});

test("runtime removes only identified scratch after settlement and retains it after a relay close failure", async (t) => {
  const f = await fixture(t);
  let directory;
  const relay = (fault) => async (_, scratch) => {
    directory = scratch;
    assert.equal((await lstat(directory)).mode & 0o777, 0o700);
    const socket = path.join(directory, "inference.sock");
    assert.ok(Buffer.byteLength(socket) < 108, socket);
    return { socket, close: async () => { if (fault) throw new Error("synthetic relay settlement fault"); } };
  };
  await withReviewRuntime(f.config, options(f), async () => {}, relay(false));
  await assert.rejects(lstat(directory), { code: "ENOENT" });
  await assert.rejects(withReviewRuntime(f.config, options(f), async () => {}, relay(true)), /relay settlement fault/);
  assert.ok((await lstat(directory)).isDirectory());
  assert.equal(await readFile(path.join(f.evidence, "sentinel"), "utf8"), "retained review evidence");
});

function listen(server, socket) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(socket, resolve);
  });
}

test("real contained bridge over a private Unix socket denies synthetic publication at a long retained path", async (t) => {
  const f = await fixture(t);
  assert.ok(Buffer.byteLength(path.join(f.evidence, "inference.sock")) >= 108);
  const canBind = createServer();
  try { await listen(canBind, path.join(f.short, "detect.sock")); }
  catch (error) {
    if (!["EPERM", "EACCES", "ENOSYS"].includes(error.code)) throw error;
    t.skip("Managed host denies a synthetic AF_UNIX listener (" + error.code + ")");
    return;
  }
  await new Promise((resolve) => canBind.close(resolve));
  let bwrap;
  try { bwrap = await realpath("/usr/bin/bwrap"); }
  catch (error) {
    if (error.code !== "ENOENT") throw error;
    t.skip("Pinned Bubblewrap executable is unavailable");
    return;
  }
  if (execFileSync(bwrap, ["--version"], { encoding: "utf8" }).trim() !== "bubblewrap 0.9.0") {
    t.skip("The installed Bubblewrap version differs from the pinned route");
    return;
  }
  const capability = spawnSync(bwrap, ["--unshare-all", "--unshare-user", "--die-with-parent", "--new-session",
    "--disable-userns", "--cap-drop", "ALL", "--clearenv", "--ro-bind", "/", "/", "--", "/usr/bin/true"],
  { encoding: "utf8", timeout: 5000 });
  if (capability.status !== 0 && /not permitted|permission denied|user namespaces/i.test(capability.stderr ?? "")) {
    t.skip("Managed host denies the pinned Bubblewrap namespace controls");
    return;
  }
  assert.equal(capability.status, 0, capability.stderr);
  f.config.bwrap = await f.pin(bwrap);
  f.config.node = await bridgeNodePin(f, process.execPath);
  const ldd = execFileSync("/usr/bin/ldd", [f.config.node.path], { encoding: "utf8" });
  const targets = [...ldd.matchAll(/(?:=>\s+|^\s+)(\/lib(?:64)?\/[^\s]+)\s+\(/gm)].map((match) => match[1]);
  f.config.libraries = await Promise.all(targets.map(async (target) => ({ ...await f.pin(await realpath(target)), target })));
  const c = path.join(f.root, "fixture.c");
  const claude = path.join(f.root, "fixture-review");
  await writeFile(c, fixtureSource);
  const compiled = spawnSync("/usr/bin/cc", ["-Wall", "-Wextra", "-Werror", "-O2", "-static", c, "-o", claude],
    { timeout: 15000, encoding: "utf8" });
  if (compiled.error?.code === "ENOENT" || /cannot find (?:-lc|crt1\.o|crti\.o)/.test(compiled.stderr ?? "")) {
    t.skip("Static C fixture compiler or runtime libraries are unavailable");
    return;
  }
  assert.equal(compiled.error, undefined);
  assert.equal(compiled.status, 0, compiled.stderr);
  await chmod(claude, 0o700);
  f.config.claude = await f.pin(claude);
  let scratch;
  const routes = [];
  const run = await withReviewRuntime(f.config, options(f), (worker) =>
    worker({ files: new Map([["fixture.txt", Buffer.from("Read-only data")]]), prompt: "Synthetic request through local bridge" }),
  async (_, directory) => {
    scratch = directory;
    const socket = path.join(directory, "inference.sock");
    const server = createServer((req, res) => {
      routes.push(req.url);
      if (req.url === "/v1/messages") res.writeHead(200).end("{}");
      else res.writeHead(403).end("denied");
    });
    await listen(server, socket);
    await chmod(socket, 0o600);
    assert.ok((await lstat(socket)).isSocket());
    assert.equal((await lstat(socket)).mode & 0o777, 0o600);
    assert.ok(Buffer.byteLength(socket) < 108);
    return { socket, close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())) };
  });
  assert.equal(run.proc.code, 0, run.proc.stderr.toString());
  assert.equal(run.proc.quiescent, true);
  assert.equal(run.proc.stdout.toString(), "PRIVATE_SOCKET_CONTROL_OK\n");
  assert.deepEqual(routes, ["/v1/messages", "/publish"]);
  await assert.rejects(lstat(scratch), { code: "ENOENT" });
  assert.equal(await readFile(path.join(f.evidence, "sentinel"), "utf8"), "retained review evidence");
});
