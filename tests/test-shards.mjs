import { spawn } from "node:child_process";
import { accessSync, constants, lstatSync, mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { availableParallelism, tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const shardKey = Symbol.for("ai-coding-agent-skills fixture shard");
const shardCounts = new Map([
  ["delivery-runtime.test.mjs", 6],
  ["operator-workflow.test.mjs", 6],
  ["low-touch-delivery.test.mjs", 4],
  ["protected-finish.test.mjs", 4],
  ["openspec-integration.test.mjs", 6],
  ["implementer-runtime.test.mjs", 5],
  ["git-environment.test.mjs", 4],
]);

let nextFixture = 0;
export function fixtureTest(...args) {
  // Each wrapper loads one suite in its own test-file process.
  const shard = globalThis[shardKey];
  if (!shard || nextFixture++ % shard.count === shard.index) return test(...args);
}

function testFiles(filenames, root) {
  return filenames.flatMap((name) => {
    const source = path.join(directory, name);
    const count = shardCounts.get(name);
    if (!count) return [source];
    return Array.from({ length: count }, (_, index) => {
      const scratch = mkdtempSync(path.join(root, "s"));
      const home = path.join(scratch, "home");
      const temporary = path.join(scratch, "tmp");
      mkdirSync(home, { mode: 0o700 });
      mkdirSync(temporary, { mode: 0o700 });
      const env = {
        PATH: "/usr/bin:/bin", LC_ALL: "C",
        HOME: home, XDG_CONFIG_HOME: path.join(home, "config"), XDG_DATA_HOME: path.join(home, "data"),
        XDG_CACHE_HOME: path.join(home, "cache"), XDG_STATE_HOME: path.join(home, "state"),
        TMPDIR: temporary, TMP: temporary, TEMP: temporary,
        GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null",
      };
      const wrapper = path.join(scratch, name);
      writeFileSync(wrapper, [
        // Preserve the native test reporter's parent/child protocol.
        `process.env = { ...${JSON.stringify(env)}, NODE_TEST_CONTEXT: process.env.NODE_TEST_CONTEXT };`,
        `globalThis[Symbol.for(${JSON.stringify(Symbol.keyFor(shardKey))})] = ${JSON.stringify({ index, count })};`,
        `await import(${JSON.stringify(pathToFileURL(source).href)});`,
        "",
      ].join("\n"), { mode: 0o600, flag: "wx" });
      return wrapper;
    });
  });
}

function runTests(args, options = {}) {
  return new Promise((resolve, reject) => {
    const runner = spawn(process.execPath, ["--test", ...args], { stdio: "inherit", ...options });
    runner.once("error", reject);
    runner.once("exit", (code) => resolve(code ?? 1));
  });
}

async function main() {
  const args = process.argv.slice(2);
  const serial = args[0] === "--serial";
  if (serial) args.shift();
  const filenames = readdirSync(directory).filter((name) => name.endsWith(".test.mjs")).sort();
  const files = filenames.map((name) => path.join(directory, name));
  const unsharded = () => runTests([...(serial ? ["--test-concurrency=1"] : []), ...args, ...files]);
  if (serial || args.length || process.platform !== "linux" || availableParallelism() < 2) return unsharded();

  let root;
  let shardFiles;
  try {
    accessSync("/usr/bin/git", constants.X_OK);
    accessSync("/usr/bin/python3", constants.X_OK);
    root = mkdtempSync(path.join(realpathSync(tmpdir()), "st-"));
    const info = lstatSync(root);
    if (info.uid !== process.getuid() || (info.mode & 0o777) !== 0o700) {
      throw new Error("Fixture shard directory is not owner-private");
    }
    shardFiles = testFiles(filenames, root);
  } catch (error) {
    if (root) rmSync(root, { recursive: true, force: true });
    process.stderr.write(`Using unsharded fixtures. ${error.message}\n`);
    return unsharded();
  }

  try {
    // Prevent Node options or preloads from changing test-file process isolation.
    const env = { ...process.env };
    delete env.NODE_OPTIONS;
    return await runTests(shardFiles, { env });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
