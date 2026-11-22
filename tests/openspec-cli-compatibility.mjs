// Opt-in real upstream probe. The credential-minimized child environment is not an OS sandbox.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import * as fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lifecycle } from "./openspec-cli-lifecycle.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const packageName = "@fission-ai/openspec";
const version = "2.1.1";
const commit = "0c737dc1b543249b38b0f4716816fcf493d894dd";
const url = "https://registry.npmjs.org/@fission-ai/openspec/-/openspec-2.1.1.tgz";
const sri = "sha512-GQv1xU4uLrTVJ6MfOKNIxo/BgEk+e8C/XBmjTfzd/W3LNh4v2UMAsfTdn8mjHdjDA/KjfGstwUhZedQW4hdcZQ==";
// SHA-256 of each independent SKILL.md at the pinned upstream tag commit.
const workflowSkills = {
  explore: ["openspec-explore", "8eb7074d34277cf09e630ebd189a127154b8007d48445824b2c4c676806d501a"],
  propose: ["openspec-propose", "e353e74472fdef44af4af2c646348085b5b87df60efe06949ca401ff00c972e6"],
  update: ["openspec-update-change", "ca7ef061078b2260be47c2654e7df29b4c81ac1173dc73cbd565c3ea40879e87"],
  apply: ["openspec-apply-change", "a8933b263ab01b4ce0a04ac805bd5321cadab78c84b6717b8617fea7eb2dc7dc"],
  sync: ["openspec-sync-specs", "75556d2ca69892525698a0c681e0c3deead1e25f3b7b9be5449eaaf1621f026b"],
  archive: ["openspec-archive-change", "8ea5eb23ac050a781616c7b951228c9763f62fccb7e0a6537f286679f1c01a08"],
  verify: ["openspec-verify-change", "3b86fbb9734fdb6b942dd12d0afa4247457aa7f212bb48832eae133f5e66880a"],
};
const workflows = Object.keys(workflowSkills);
const names = Object.values(workflowSkills).map(([name]) => name).sort();
const hash = (bytes, algorithm = "sha256", encoding = "hex") =>
  createHash(algorithm).update(bytes).digest(encoding);
const assertSri = (bytes) => assert.equal(
  `sha512-${hash(bytes, "sha512", "base64")}`, sri, "OpenSpec tarball SRI",
);

function checkNode(value) {
  const match = /^v(\d+)\.(\d+)\.(\d+)$/.exec(value);
  assert.ok(match, `Expected stable Node version, observed ${value}`);
  const [, major, minor] = match.map(Number);
  assert.ok(major > 22 || (major === 22 && minor >= 20), `Node >=22.20.0 required, observed ${value}`);
}

function inside(root, target) {
  const relative = path.relative(root, target);
  assert.ok(relative && relative !== ".." && !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative), `Path escapes ${root}: ${target}`);
  return relative;
}

// Check each component before accessing the next one. Only the explicit Claude
// leaf is allowed to be a symlink, and its resolved target must match exactly.
async function regularPath(root, target, kind) {
  const parts = inside(root, target).split(path.sep);
  let current = root;
  for (const [index, part] of parts.entries()) {
    current = path.join(current, part);
    const stat = await fs.lstat(current);
    const expected = index === parts.length - 1 ? kind : "directory";
    assert.ok(expected === "directory" ? stat.isDirectory() : stat.isFile(),
      `Expected real ${expected}: ${current}`);
  }
  return target;
}

function environment(base, node) {
  const home = path.join(base, "home");
  const temp = path.join(base, "tmp");
  return {
    HOME: home, XDG_CONFIG_HOME: path.join(base, "config"),
    XDG_CACHE_HOME: path.join(base, "cache"), XDG_STATE_HOME: path.join(base, "state"),
    XDG_DATA_HOME: path.join(base, "data"),
    TMPDIR: temp, TMP: temp, TEMP: temp,
    PATH: [path.dirname(node), "/usr/bin", "/bin"].join(path.delimiter),
    LANG: "C", TZ: "UTC", CI: "1", NO_COLOR: "1",
    OPENSPEC_TELEMETRY: "0", DISABLE_TELEMETRY: "1", DO_NOT_TRACK: "1",
    npm_config_userconfig: path.join(base, "user.npmrc"),
    npm_config_globalconfig: path.join(base, "global.npmrc"),
    npm_config_cache: path.join(base, "npm-cache"),
    npm_config_registry: "https://registry.npmjs.org/",
    npm_config_ignore_scripts: "true",
    GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_TERMINAL_PROMPT: "0",
  };
}

async function inventory(root) {
  const result = {};
  async function walk(dir) {
    for (const name of (await fs.readdir(dir)).sort()) {
      const target = path.join(dir, name);
      const relative = inside(root, target);
      const stat = await fs.lstat(target);
      if (stat.isSymbolicLink()) {
        const link = await fs.readlink(target);
        inside(root, path.resolve(dir, link));
        // Check the immediate target without following any intermediate links.
        await regularPath(root, path.resolve(dir, link), "directory");
        result[relative] = { link };
      } else if (stat.isDirectory()) {
        result[relative] = { directory: true };
        await walk(target);
      } else {
        assert.ok(stat.isFile(), `Unexpected file type: ${target}`);
        result[relative] = { sha256: hash(await fs.readFile(target)) };
      }
    }
  }
  await walk(root);
  return result;
}

function assertExact(actual, expected, label) {
  assert.deepEqual([...actual].sort(), [...expected].sort(), label);
}

function assertWorkflowSelection(actual) {
  assertExact(actual, workflows, "required workflow identities");
}

async function inspectSkills(runRoot, target, other, scope, expectedSkills = workflowSkills) {
  const shared = await regularPath(runRoot, path.join(target, ".agents/skills"), "directory");
  const claude = await regularPath(runRoot, path.join(target, ".claude/skills"), "directory");
  // The release writes a tool-list marker for project setup.
  const projectMarker = ".openspec-target";
  const sharedEntries = scope === "project" ? [...names, projectMarker] : names;
  assertExact(await fs.readdir(shared), sharedEntries, "shared skill selection");
  if (scope === "project") {
    const marker = await regularPath(runRoot, path.join(shared, projectMarker), "file");
    assert.equal(await fs.readFile(marker, "utf8"), "claude own-files\n", "project tool-list marker");
  }
  assertExact(await fs.readdir(claude), names, "Claude skill selection");
  for (const dir of [".agents", ".claude"]) {
    await assert.rejects(fs.lstat(path.join(other, dir)), { code: "ENOENT" });
  }
  await assert.rejects(fs.lstat(path.join(target, ".claude/commands")), { code: "ENOENT" });
  const observed = {};
  for (const [workflow, [name, expectedHash]] of Object.entries(expectedSkills)) {
    const skillDir = await regularPath(runRoot, path.join(shared, name), "directory");
    assertExact(await fs.readdir(skillDir), ["SKILL.md"], `${name} package inventory`);
    const link = path.join(claude, name);
    assert.ok((await fs.lstat(link)).isSymbolicLink(), `Expected Claude skill link: ${link}`);
    const rawLink = await fs.readlink(link);
    assert.equal(path.resolve(claude, rawLink), skillDir, `${name}: Claude link target`);
    assert.equal(await fs.realpath(link), skillDir, `${name}: resolved Claude target`);
    const bytes = await fs.readFile(await regularPath(runRoot, path.join(skillDir, "SKILL.md"), "file"));
    const actualHash = hash(bytes);
    assert.equal(actualHash, expectedHash, `${name}: generated SHA-256 differs from pinned GitHub file`);
    assert.match(bytes.toString(), new RegExp(`^---\\nname: ${name}\\n`));
    observed[workflow] = { name, sha256: actualHash, rawLink, resolved: skillDir };
  }
  return observed;
}

async function main() {
  assert.equal(process.platform, "linux", "Qualification models the Linux Claude symlink layout");
  const args = process.argv.slice(2);
  assert.ok(!args.length || (args.length === 1 && args[0] === "--offline-controls"),
    "Usage: node openspec-cli-compatibility.mjs [--offline-controls]");
  const runRoot = await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()), "openspec-compatibility-"));
  const log = path.join(runRoot, "gate.jsonl");
  let gate = "preflight";
  const emit = (record) => fs.appendFile(log, JSON.stringify({ gate, ...record }) + "\n");
  const step = async (label, probe) => {
    gate = label;
    await emit({ state: "start" });
    const result = await probe();
    await emit({ state: "pass" });
    return result;
  };
  const putJson = (file, data) => fs.writeFile(file, JSON.stringify(data, null, 2) + "\n", { flag: "wx" });
  const fixture = async (label) => {
    const base = await fs.mkdtemp(path.join(runRoot, `${label}-`));
    const env = environment(base, process.execPath);
    const cwd = path.join(base, "project");
    for (const dir of [cwd, env.HOME, env.TMPDIR, env.XDG_CONFIG_HOME, env.XDG_CACHE_HOME,
      env.XDG_DATA_HOME, env.XDG_STATE_HOME, env.npm_config_cache]) await fs.mkdir(dir);
    for (const file of [env.npm_config_userconfig, env.npm_config_globalconfig]) await fs.writeFile(file, "");
    return { base, cwd, env };
  };
  let commandIndex = 0;
  const run = async ({ cwd, env }, executable, argv, expected = 0, timeout = 30_000) => {
    await regularPath(runRoot, cwd, "directory");
    const capture = await fs.mkdtemp(path.join(runRoot, `command-${++commandIndex}-`));
    const command = { executable, argv, cwd, env, timeout, capture };
    await emit({ command });
    const stdin = await fs.open("/dev/null", "r");
    const stdoutFile = await fs.open(path.join(capture, "stdout"), "wx+");
    const stderrFile = await fs.open(path.join(capture, "stderr"), "wx+");
    let result;
    try {
      result = spawnSync(executable, argv, {
        cwd, env, stdio: [stdin.fd, stdoutFile.fd, stderrFile.fd],
        timeout, killSignal: "SIGKILL",
      });
      await emit({ command, status: result.status, signal: result.signal, error: result.error?.message });
      for (const [label, file] of [["stdout", stdoutFile], ["stderr", stderrFile]]) {
        const { size } = await file.stat();
        assert.ok(size <= 16 * 1024 * 1024, `Excessive ${label}, raw bytes at ${capture}`);
        const bytes = await fs.readFile(path.join(capture, label));
        result[label] = bytes.toString("utf8");
        await emit({ capture, stream: label, size, sha256: hash(bytes) });
      }
    } finally {
      await Promise.all([stdin.close(), stdoutFile.close(), stderrFile.close()]);
    }
    assert.ifError(result.error);
    assert.ok(result.status !== null &&
      (expected === null || (Array.isArray(expected) ? expected : [expected]).includes(result.status)),
      `${executable} ${argv.join(" ")} exited ${result.status}\n${result.stdout}\n${result.stderr}`);
    return { stdout: result.stdout, stderr: result.stderr, status: result.status };
  };

  console.log(`OpenSpec compatibility evidence: ${runRoot}`);
  try {
    await putJson(path.join(runRoot, "release.json"), { packageName, version, commit, url, sri, workflowSkills });

    await step("offline negative controls", async () => {
      const control = await fixture("controls");
      for (const bad of ["v20.20.0", "v22.19.99", "v22.20.0-rc.1"]) assert.throws(() => checkNode(bad), /Node/);
      for (const good of ["v22.20.0", "v24.0.0"]) checkNode(good);
      assert.throws(() => assertSri(Buffer.from("synthetic tampered artifact")), /tarball SRI/);
      const contaminants = {
        HOME: "/synthetic/home", XDG_CONFIG_HOME: "/synthetic/config", NODE_OPTIONS: "--require /synthetic/module",
        PATH: "/synthetic/bin", CLAUDE_CONFIG_DIR: "/synthetic/claude", HERMES_HOME: "/synthetic/hermes",
        CODEX_HOME: "/synthetic/codex", GH_TOKEN: "synthetic-token", NPM_TOKEN: "synthetic-token",
        AWS_SECRET_ACCESS_KEY: "synthetic-key", OPENAI_API_KEY: "synthetic-key",
        npm_config_userconfig: "/synthetic/.npmrc", NPM_CONFIG_REGISTRY: "https://synthetic.invalid",
        OPENSPEC_TELEMETRY: "1", DISABLE_TELEMETRY: "0", DO_NOT_TRACK: "0",
      };
      // The launcher starts from a clean environment and builds another allowlist
      // while the synthetic host contaminants are present in its process.env.
      const source = `
        Object.assign(process.env, ${JSON.stringify(contaminants)});
        process.stdout.write(JSON.stringify((${environment.toString()})(${JSON.stringify(control.base)}, process.execPath)));
      `;
      const childScript = `import path from "node:path";\n${source}`;
      const observed = await run(control, process.execPath, ["--input-type=module", "-e", childScript]);
      assert.deepEqual(JSON.parse(observed.stdout), control.env);
      const childEnv = await run(control, process.execPath, ["-p", "JSON.stringify(process.env)"]);
      assert.deepEqual(JSON.parse(childEnv.stdout), control.env);

      assert.throws(() => inside(control.base, path.join(runRoot, "outside-control")), /escapes/);
      const wrong = path.join(runRoot, "wrong-target");
      await fs.mkdir(wrong);
      const link = path.join(control.cwd, "escape");
      await fs.symlink(wrong, link);
      await assert.rejects(regularPath(control.base, path.join(link, "SKILL.md"), "file"), /Expected real directory/);
      await assert.rejects(inventory(control.base), /escapes/);
      assert.throws(() => assertExact(names.slice(1), names, "missing selection"), /missing selection/);
      assert.throws(() => assertExact([...names, "openspec-unexpected"], names, "extra selection"), /extra selection/);

      const layout = await fixture("layout-control");
      const shared = path.join(layout.cwd, ".agents/skills");
      const claude = path.join(layout.cwd, ".claude/skills");
      await fs.mkdir(claude, { recursive: true });
      const syntheticSkills = {};
      for (const [workflow, [name]] of Object.entries(workflowSkills)) {
        const bytes = Buffer.from(`---\nname: ${name}\n---\nSynthetic fixture.\n`);
        syntheticSkills[workflow] = [name, hash(bytes)];
        await fs.mkdir(path.join(shared, name), { recursive: true });
        await fs.writeFile(path.join(shared, name, "SKILL.md"), bytes);
        await fs.symlink(path.relative(claude, path.join(shared, name)), path.join(claude, name));
      }
      await inspectSkills(runRoot, layout.cwd, layout.env.HOME, "global", syntheticSkills);

      // Keep each failing control as a separate tree or retained input.
      const wrongLayout = await fixture("bad-layout-control");
      await fs.cp(layout.cwd, wrongLayout.cwd, { recursive: true, verbatimSymlinks: true });
      const first = names[0];
      const wrongLink = path.join(wrongLayout.cwd, ".claude/skills", first);
      await fs.rename(wrongLink, path.join(wrongLayout.base, "original-link"));
      await fs.symlink(path.join(wrongLayout.cwd, ".agents/skills", names[1]), wrongLink);
      await assert.rejects(inspectSkills(runRoot, wrongLayout.cwd, wrongLayout.env.HOME, "global", syntheticSkills), /Claude link target/);
      const changedLayout = await fixture("bad-bytes-control");
      await fs.cp(layout.cwd, changedLayout.cwd, { recursive: true, verbatimSymlinks: true });
      await fs.appendFile(path.join(changedLayout.cwd, ".agents/skills", first, "SKILL.md"), "\nSynthetic mutation.\n");
      await assert.rejects(inspectSkills(runRoot, changedLayout.cwd, changedLayout.env.HOME, "global", syntheticSkills), /generated SHA-256 differs/);
      await emit({ controls: ["Node minimum", "tarball SRI", "ambient environment",
        "escaping path and link", "missing and extra identity", "wrong Claude target", "mutated generated bytes"] });
    });
    if (args.length) {
      console.log("PASS offline controls");
      return;
    }

    await step("actual Node preflight", async () => {
      const runtime = await fixture("node");
      checkNode((await run(runtime, process.execPath, ["--version"])).stdout.trim());
    });

    const install = await fixture("install");
    const prefix = install.cwd;
    const tarball = path.join(install.base, "openspec-2.1.1.tgz");
    const npm = path.join(path.dirname(process.execPath), "npm");
    const cli = await step("tag, SRI and exact local installation", async () => {
      const tagRef = `refs/tags/v${version}`;
      const tag = await run(install, "/usr/bin/git", ["ls-remote", "--exit-code",
        "https://github.com/Fission-AI/OpenSpec.git", tagRef, `${tagRef}^{}`], 0, 60_000);
      const refs = new Map(tag.stdout.trim().split("\n").map((line) => line.split("\t").reverse()));
      assert.equal(refs.get(`${tagRef}^{}`) ?? refs.get(tagRef), commit, "release tag commit");
      await run(install, "/usr/bin/curl", ["--disable", "--fail", "--silent", "--show-error",
        "--proto", "=https", "--max-time", "90", "--output", tarball, url], 0, 95_000);
      const artifact = await fs.readFile(await regularPath(runRoot, tarball, "file"));
      assertSri(artifact);
      const tampered = Buffer.from(artifact);
      tampered[0] ^= 1;
      await fs.writeFile(path.join(install.base, "tampered.tgz"), tampered);
      assert.throws(() => assertSri(tampered), /tarball SRI/);
      await emit({ sri, sha256: hash(artifact), tamperedSha256: hash(tampered), byteLength: artifact.length });
      assertExact(await fs.readdir(prefix), [], "npm prefix must start empty");
      await run(install, process.execPath, [npm, "install", "--prefix", prefix, "--ignore-scripts",
        "--no-audit", "--no-fund", "--fetch-retries=0", "--fetch-timeout=60000", "--save-exact", tarball], 0, 180_000);
      const packageDir = path.join(prefix, "node_modules", packageName);
      const pkg = JSON.parse(await fs.readFile(await regularPath(runRoot, path.join(packageDir, "package.json"), "file"), "utf8"));
      assert.deepEqual([pkg.name, pkg.version, pkg.engines.node, pkg.bin.openspec],
        [packageName, version, ">=22.20.0", "./bin/openspec.js"]);
      const lock = JSON.parse(await fs.readFile(await regularPath(runRoot, path.join(prefix, "package-lock.json"), "file"), "utf8"));
      assert.equal(lock.packages[`node_modules/${packageName}`].integrity, sri, "installed lock integrity");
      assert.match(lock.packages[`node_modules/${packageName}`].resolved, /^file:/, "installed from local tarball");
      assert.equal(path.resolve(prefix, lock.packages[`node_modules/${packageName}`].resolved.slice(5)),
        tarball, "lock must resolve the SRI-verified file");
      const binary = await regularPath(prefix, path.join(packageDir, pkg.bin.openspec), "file");
      const deps = await run(install, process.execPath, [npm, "ls", "--prefix", prefix, "--all", "--json"]);
      await putJson(path.join(runRoot, "dependencies.json"), JSON.parse(deps.stdout));
      await emit({ binary, sha256: hash(await fs.readFile(binary)) });
      return async (fixture, argv, expected) => {
        assert.ok(["--version", "config", "init", "validate", "new", "instructions", "status", "archive"].includes(argv[0]),
          `CLI operation outside probe scope: ${argv[0]}`);
        await regularPath(prefix, binary, "file");
        return run(fixture, process.execPath, [binary, ...argv], expected);
      };
    });

    await step("CLI identity", async () => {
      assert.equal((await cli(await fixture("version"), ["--version"])).stdout.trim(), version);
    });
    await step("unknown workflow selection refusal", async () => {
      const context = await fixture("unknown-workflow");
      const unknownId = "unknown-fixture-workflow";
      const requested = [...workflows, unknownId];
      const config = (argv, expected) => cli(context, ["config", ...argv], expected);
      await config(["set", "profile", "custom"]);
      const set = await config(["set", "workflows", JSON.stringify(requested)], null);
      const readback = await config(["get", "workflows"], null);
      const configured = readback.status === 0 ? JSON.parse(readback.stdout) : null;
      assert.throws(() => assertWorkflowSelection(requested), /required workflow identities/);
      const includesUnknown = Array.isArray(configured) && configured.includes(unknownId);
      if (set.status === 0) assert.ok(includesUnknown, "Native accepted the write but did not retain the unknown identity");
      if (includesUnknown) {
        assert.throws(() => assertWorkflowSelection(configured), /required workflow identities/);
      }

      const init = await cli(context, ["init", "--tools", "claude", "--profile", "custom",
        "--scope", "project", "--no-animation"], null);
      const project = await inventory(context.cwd);
      const home = await inventory(context.env.HOME);
      await putJson(path.join(context.base, "unknown-selection.json"), {
        requested, configured, setStatus: set.status, readbackStatus: readback.status,
        initStatus: init.status, project, home,
      });
      const emitted = [...Object.keys(project), ...Object.keys(home)];
      assert.ok(emitted.every((entry) => !entry.includes(unknownId)), "Unknown workflow emitted an install path");
      if (init.status === 0) {
        // Native init may ignore the unknown identity. Only the seven pinned
        // skills can be emitted and the requested selection still fails.
        await inspectSkills(runRoot, context.cwd, context.env.HOME, "project");
      }
    });
    for (const scope of ["global", "project"]) {
      await step(`Claude ${scope} custom workflow installation`, async () => {
        const context = await fixture(scope);
        const config = (argv, expected) => cli(context, ["config", ...argv], expected);
        await config(["set", "profile", "custom"]);
        assert.equal((await config(["get", "profile"])).stdout.trim(), "custom");
        await config(["set", "workflows", JSON.stringify(workflows)]);
        const configured = JSON.parse((await config(["get", "workflows"])).stdout);
        assertWorkflowSelection(configured);
        assert.deepEqual(configured, workflows, "workflow configuration readback");
        const target = scope === "global" ? context.env.HOME : context.cwd;
        const other = scope === "global" ? context.cwd : context.env.HOME;
        const init = await cli(context, ["init", "--tools", "claude", "--profile", "custom",
          ...(scope === "project" ? ["--scope", "project"] : []), "--no-animation"]);
        assert.match(init.stdout, /7 skills in (?:~\/)?\.agents\/skills\//);
        const observed = await inspectSkills(runRoot, target, other, scope);
        await putJson(path.join(context.base, "generated.json"), {
          observed, project: await inventory(context.cwd), home: await inventory(context.env.HOME),
        });
      });
    }
    await lifecycle({
      step, fixture, cli, inventory, root, putJson,
    });
    console.log("PASS OpenSpec 2.1.1 compatibility");
  } catch (error) {
    await emit({ state: "fail", error: error.stack });
    throw new Error(`Gate "${gate}" failed. Evidence: ${log}\n${error.message}`, { cause: error });
  }
}

if (process.argv[1] && await fs.realpath(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
