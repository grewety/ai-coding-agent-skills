import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { runBoundedWorker } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/bounded-worker.mjs";
import { buildCodexLaunch, smokeCheck } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/implementer-sandbox.mjs";
import { checkoutStatus } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/worker-runtime-policy.mjs";
import { requestBytes } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/worker-handoff.mjs";

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), "sandbox-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const p = (...names) => path.join(root, ...names);
  const workspace = p("operator-home", "src", "checkout");
  const change = "fixture-sandbox";
  const relativeTask = "openspec/changes/" + change + "/tasks.md";
  const relativeConfig = "openspec/config.yaml";
  const role = { home: p("home"), xdg: p("xdg"), codexHome: p("codex"), version: "0.171.0", model: "fixture-model",
    executable: { path: p("fixture-binary") } };
  const registry = p("registry");
  const attemptDirectory = p("evidence");
  const controlDirectory = p("control");
  const protectedFile = p("synthetic-grant");
  await Promise.all([role.home, role.xdg, role.codexHome, registry, attemptDirectory, controlDirectory,
    path.dirname(path.join(workspace, relativeTask))].map((name) => mkdir(name, { recursive: true, mode: 0o700 })));
  await Promise.all([
    writeFile(path.join(workspace, relativeTask), "- [ ] 1.1 fixture\n"), writeFile(path.join(workspace, relativeConfig), "fixture config\n"),
    writeFile(path.join(workspace, "ok.txt"), "fixture source\n"), writeFile(protectedFile, "synthetic data\n"),
    writeFile(path.join(attemptDirectory, "request.md"), "synthetic request\n"),
    writeFile(role.executable.path, "#!/bin/sh\nif [ \"$1\" = --version ]; then echo 'codex-cli 0.171.0'; exit 0; fi\nexit 1\n", { mode: 0o700 }),
  ]);
  const git = (...args) => execFileSync("/usr/bin/git", ["-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", ...args],
    { cwd: workspace, env: { PATH: "/usr/bin:/bin", HOME: "/nonexistent", GIT_CONFIG_NOSYSTEM: "1" }, stdio: "ignore" });
  git("init", "-q");
  git("add", ".");
  git("commit", "-qm", "synthetic fixture");
  const request = { identity: { workspace, change }, mutablePaths: ["ok.txt"], evidenceRoots: [attemptDirectory], outcome: "Synthetic prompt only" };
  return { root, p, request, role, registry, attemptDirectory, controlDirectory, protectedFile, workspace, relativeTask };
}

test("native launch sends only request stdin, a named exact scope and isolated process environment", async (t) => {
  const f = await fixture(t);
  const launch = await buildCodexLaunch(f.request, f.role, f.registry, f.controlDirectory, "fixture-nonce");
  assert.deepEqual(launch.input, requestBytes(f.request));
  assert.ok(!launch.args.join("\n").includes(f.request.outcome));
  for (const flag of ["--json", "--ephemeral", "--ignore-user-config", "--ignore-rules", "skip_host_skill_discovery",
    'default_permissions="worker"', 'project_root_markers=[".git"]', "permissions.worker.network.enabled=false",
    "approval_policy=\"never\"", "mcp_servers={}"]) assert.ok(launch.args.includes(flag), flag);
  for (const value of ["-s", "--sandbox", "--add-dir", "--trust", "--dangerously-bypass-approvals-and-sandbox"]) assert.ok(!launch.args.includes(value), value);
  assert.equal(launch.env.CODEX_HOME, f.role.codexHome);
  assert.equal(launch.env.HOME, f.role.home);
  assert.equal(launch.env.XDG_CONFIG_HOME, f.role.xdg);
  for (const variable of ["GH_TOKEN", "GITHUB_TOKEN", "OPENAI_API_KEY", "VIRTUAL_ENV", "PYTHONHOME", "PYTHONPATH", "HERDR_ENV"]) {
    assert.equal(launch.env[variable], undefined, variable);
  }
  const fs = launch.args.find((item) => item.startsWith("permissions.worker.filesystem="));
  assert.ok(fs.includes('":minimal" = "read"'));
  assert.ok(fs.includes(JSON.stringify(f.role.executable.path) + ' = "read"'));
  assert.ok(fs.includes(JSON.stringify(path.join(f.workspace, "ok.txt")) + ' = "write"'));
  assert.equal([...fs.matchAll(/ = "write"/g)].length, 1);
  assert.ok(fs.includes(JSON.stringify(path.join(f.workspace, f.relativeTask)) + ' = "read"'));
  for (const name of [f.role.codexHome, f.role.home, f.role.xdg, f.registry, f.attemptDirectory, path.join(f.workspace, ".git")]) {
    assert.ok(fs.includes(JSON.stringify(name) + ' = "deny"'), name);
  }
});

test("project discovery stops at the checkout marker and rejects project-local settings", async (t) => {
  const f = await fixture(t);
  const launch = () => buildCodexLaunch(f.request, f.role, f.registry, f.controlDirectory, "fixture-nonce");
  const entryPoints = [".codex/config.toml", ".codex/rules", ".codex/agents", ".mcp.json"];
  for (const dir of [f.p("operator-home"), f.p("operator-home", "src"), f.workspace]) {
    await mkdir(path.join(dir, ".codex"), { mode: 0o700 });
  }
  for (const entry of entryPoints) await writeFile(f.p("operator-home", entry), "synthetic host setting");
  await writeFile(f.p("operator-home", "src", ".codex", "config.toml"), "synthetic ancestor setting");
  await launch();
  for (const entry of entryPoints) {
    const file = path.join(f.workspace, entry);
    if (entry.endsWith(".toml") || entry.endsWith(".json")) await writeFile(file, "synthetic project setting");
    else await mkdir(file, { mode: 0o700 });
    await assert.rejects(launch(), /project-local Codex settings/);
    await rm(file, { recursive: true });
  }
});

test("the isolated profile allows only built-in skills and still rejects dedicated configuration", async (t) => {
  const f = await fixture(t);
  const launch = () => buildCodexLaunch(f.request, f.role, f.registry, f.controlDirectory, "fixture-nonce");
  await launch();

  const builtin = path.join(f.role.codexHome, "skills", ".system", "fixture-builtin");
  await mkdir(builtin, { recursive: true });
  await writeFile(path.join(builtin, "SKILL.md"), "Synthetic built-in skill\n");
  await launch();

  for (const name of ["config.toml", "rules", "AGENTS.md"]) {
    const entry = path.join(f.role.codexHome, name);
    if (name === "rules") await mkdir(entry);
    else await writeFile(entry, "synthetic dedicated profile setting");
    await assert.rejects(launch(), /Dedicated Codex home has ambient configuration/, name);
    await rm(entry, { recursive: true });
  }
});

test("the isolated profile rejects other skills directory layouts", async (t) => {
  const f = await fixture(t);
  const launch = () => buildCodexLaunch(f.request, f.role, f.registry, f.controlDirectory, "fixture-nonce");
  const skills = path.join(f.role.codexHome, "skills");
  const builtin = path.join(skills, ".system");
  const user = path.join(skills, "user-skill");
  const target = f.p("external-skills");
  await mkdir(path.join(target, ".system"), { recursive: true });

  for (const [name, setup] of [
    ["empty skills directory", () => mkdir(skills)],
    ["only a user-created skill", () => mkdir(user, { recursive: true })],
    ["a user-created skill alongside .system", async () => {
      await mkdir(builtin, { recursive: true });
      await mkdir(user);
    }],
    ["skills is a file", () => writeFile(skills, "synthetic file")],
    ["skills is a symlink", () => symlink(target, skills)],
    ["skills is a dangling symlink", () => symlink(f.p("missing-skills"), skills)],
    [".system is a file", async () => {
      await mkdir(skills);
      await writeFile(builtin, "synthetic file");
    }],
    [".system is a symlink", async () => {
      await mkdir(skills);
      await symlink(path.join(target, ".system"), builtin);
    }],
  ]) {
    await t.test(name, async (t) => {
      t.after(() => rm(skills, { recursive: true }));
      await setup();
      await assert.rejects(launch(), /Dedicated Codex home has ambient configuration or discoverable skills/);
    });
  }
});

test("the read-only then workspace-write smoke probes keep the checkout clean and refuse an uncontained route", async (t) => {
  for (const bypass of [false, true]) {
    const f = await fixture(t);
    const modes = [];
    const before = await readFile(path.join(f.workspace, ".git/HEAD"));
    const perform = smokeCheck({ ...f, run: async (command, args, options) => {
      if (args[0] === "--version") return runBoundedWorker(command, args, options);
      const separator = args.indexOf("--");
      assert.ok(separator > 5);
      assert.deepEqual(args.slice(0, 5), ["sandbox", "-P", "worker", "-C", f.workspace]);
      assert.ok(args.includes('project_root_markers=[".git"]'));
      assert.ok(args.includes("permissions.worker.network.enabled=false"));
      assert.ok(!args.includes("-s"));
      assert.ok(!args.includes("-m"));
      const [python, ...code] = args.slice(separator + 1);
      const [mode, config, scratch, tasks, secret, evidence, git, grant] = code.slice(4);
      modes.push(mode);
      const fs = args.find((item) => item.startsWith("permissions.worker.filesystem="));
      assert.ok(fs.includes(JSON.stringify(command) + ' = "read"'));
      assert.equal([...fs.matchAll(/ = "write"/g)].length, mode === "read-only" ? 0 : 1);
      if (mode === "workspace-write") assert.ok(fs.includes(JSON.stringify(path.dirname(scratch)) + ' = "write"'));
      assert.equal(tasks, path.join(f.workspace, f.relativeTask));
      assert.equal(grant, f.protectedFile);
      assert.equal(git, path.join(f.workspace, ".git/HEAD"));
      assert.equal(evidence, path.join(f.attemptDirectory, "request.md"));
      assert.equal(secret, path.join(f.controlDirectory, "synthetic-protected.txt"));
      assert.equal(config, path.join(f.workspace, "openspec/config.yaml"));
      if (bypass) {
        // Deliberately run the benign probe without a sandbox. Its protected
        // write-open test must detect this, without changing protected bytes.
        return runBoundedWorker(python, code, options);
      }
      if (mode === "workspace-write") await rm(scratch);
      return { quiescent: true, outcome: "exit", code: 0, stdout: Buffer.from("WORKSPACE_PROBE_OK " + mode + "\n") };
    } });
    if (bypass) await assert.rejects(perform, /read-only smoke predicate failed/);
    else assert.deepEqual((await perform).proof.map(({ mode }) => mode), ["read-only", "workspace-write"]);
    assert.deepEqual(modes, bypass ? ["read-only"] : ["read-only", "workspace-write"]);
    assert.deepEqual(await readFile(path.join(f.workspace, ".git/HEAD")), before);
    assert.ok((await readdir(f.workspace)).every((name) => !name.startsWith(".runtime-probe-")));
    assert.equal(checkoutStatus(f.workspace), "");
    await lstat(path.join(f.controlDirectory, "synthetic-protected.txt"));
  }
});
