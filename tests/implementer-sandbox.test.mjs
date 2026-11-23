import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { lstat, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
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
  const workspace = p("checkout");
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
    "permissions.worker.network.enabled=false", "approval_policy=\"never\"", "mcp_servers={}"]) assert.ok(launch.args.includes(flag), flag);
  for (const value of ["-s", "--sandbox", "--add-dir", "--trust", "--dangerously-bypass-approvals-and-sandbox"]) assert.ok(!launch.args.includes(value), value);
  assert.equal(launch.env.CODEX_HOME, f.role.codexHome);
  assert.equal(launch.env.HOME, f.role.home);
  assert.equal(launch.env.XDG_CONFIG_HOME, f.role.xdg);
  for (const variable of ["GH_TOKEN", "GITHUB_TOKEN", "OPENAI_API_KEY", "VIRTUAL_ENV", "PYTHONHOME", "PYTHONPATH", "HERDR_ENV"]) {
    assert.equal(launch.env[variable], undefined, variable);
  }
  const fs = launch.args.find((item) => item.startsWith("permissions.worker.filesystem="));
  assert.ok(fs.includes(JSON.stringify(path.join(f.workspace, "ok.txt")) + ' = "write"'));
  assert.ok(fs.includes(JSON.stringify(path.join(f.workspace, f.relativeTask)) + ' = "read"'));
  for (const name of [f.role.codexHome, f.registry, f.attemptDirectory, path.join(f.workspace, ".git")]) {
    assert.ok(fs.includes(JSON.stringify(name) + ' = "none"'), name);
  }
  await mkdir(path.join(f.workspace, ".codex"), { mode: 0o700 });
  await writeFile(path.join(f.workspace, ".codex", "config.toml"), "synthetic project config");
  await assert.rejects(buildCodexLaunch(f.request, f.role, f.registry, f.controlDirectory, "fixture-nonce"), /ambient Codex settings/);
});

test("the read-only then workspace-write smoke probes keep the checkout clean and refuse an uncontained route", async (t) => {
  for (const bypass of [false, true]) {
    const f = await fixture(t);
    const modes = [];
    const before = await readFile(path.join(f.workspace, ".git/HEAD"));
    const perform = smokeCheck({ ...f, run: async (command, args, options) => {
      if (args[0] === "--version") return runBoundedWorker(command, args, options);
      const separator = args.indexOf("--");
      assert.ok(separator >= 0);
      assert.deepEqual(args.slice(separator - 2, separator), ["sandbox", "linux"]);
      const [python, ...code] = args.slice(separator + 1);
      const [mode, config, scratch, tasks, secret, evidence, git, grant] = code.slice(4);
      modes.push(mode);
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
