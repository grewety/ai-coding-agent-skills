import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { applySetup, previewSetup, readWorksetOpener } from "../skills/software-development/openspec-delivery/scripts/agent-setup.mjs";
import { hashBytes, inspectPinnedFile } from "../skills/software-development/openspec-delivery/scripts/agent-configuration.mjs";
import { readRoleBindings } from "../skills/software-development/openspec-delivery/scripts/agent-role-config.mjs";
import { detectAgents, observeVersion } from "../skills/software-development/openspec-delivery/scripts/agent-discovery.mjs";
import { detectAgents as detectOrchestrationAgents, observeVersion as observeOrchestrationVersion } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/agent-discovery.mjs";
import { nativeRoleBinding } from "../skills/software-development/openspec-delivery/scripts/agent-role-adapters.mjs";
import { pilotDisposition, qualificationInventory } from "../skills/software-development/openspec-delivery/scripts/adapter-qualification.mjs";
import { checkRoleIndependence, verifyEffectiveRole } from "../skills/software-development/openspec-delivery/scripts/role-config.mjs";
import { auditVersion, reportedVersion } from "../skills/software-development/openspec-delivery/scripts/runtime-version.mjs";

function fixture(t) {
  const root = mkdtempSync(path.join(os.tmpdir(), "agent-setup-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const directory = path.join(root, "host");
  const workspace = path.join(root, "workspace");
  mkdirSync(directory, { mode: 0o700 });
  mkdirSync(workspace, { mode: 0o700 });
  const command = path.join(root, "codex");
  const executableBytes = '#!/bin/sh\nif [ "$1" = "--version" ]; then printf "codex-cli 0.172.0\\n"; else printf "%s\\n" "$@"; fi\n';
  writeFileSync(command, executableBytes, { mode: 0o700 });
  const executable = { path: command, sha256: hashBytes(executableBytes) };
  const codex = { client: "codex", provider: "openai", model: "gpt-fixture", reasoningEffort: "high", executable };
  return { root, workspace, command, executable, codex, input: { schemaVersion: 2, directory,
    roles: { orchestrator: codex, implementer: codex, helper: null }, interPacketDelayMs: 100, maxBudgetUsd: 1,
    reviewer: { client: "claude", model: "claude-fixture", timeoutMs: 5000 } } };
}

test("version audits preserve observed identity and independent checks", (t) => {
  assert.equal(auditVersion({}, "0.171.0", "0.171.0").comparison, "passed");
  assert.equal(auditVersion({ maxVersion: "0.172.0" }, "0.172.0", "0.171.0").comparison, "passed");
  assert.throws(() => auditVersion({}, "0.171.0-beta.1", "0.171.0"), /below/);
  assert.throws(() => auditVersion({ maxVersion: "0.171.0" }, "0.172.0", "0.171.0"), /above/);
  assert.throws(() => auditVersion({ versionPolicy: "exact", exactVersion: "0.171.0" }, "0.172.0"), /exactVersion/);
  const { codex } = fixture(t);
  const observed = { ...codex, executableSha256: codex.executable.sha256, version: "0.170.0" };
  assert.equal(verifyEffectiveRole({ ...codex, versionCheck: false }, observed).runtimeVersion.comparison, "disabled");
  assert.throws(() => verifyEffectiveRole({ ...codex, versionCheck: false }, { ...observed, executableSha256: "0".repeat(64) }), /pin mismatch/);
  assert.throws(() => verifyEffectiveRole(codex, { ...observed, reasoningEffort: "low" }), /reasoning effort/);
  assert.throws(() => checkRoleIndependence({ provider: "openai", session: "one" }, { provider: "openai", session: "two" }), /provider/);
  assert.throws(() => checkRoleIndependence({ provider: "openai", session: "one" }, { provider: "anthropic", session: "one" }), /session/);
});

test("discovery redacts raw output and keeps present pilots unsupported", (t) => {
  const { root, executable, codex } = fixture(t);
  const detected = detectAgents({ searchPath: root, run: (_command, args, options) => {
    assert.deepEqual(args, ["--version"]);
    assert.equal(options.env.HOME, "/nonexistent");
    assert.equal(options.env.OPENAI_API_KEY, undefined);
    return { status: 0, stdout: "codex-cli 0.172.0", stderr: "private fixture text" };
  } });
  assert.equal(detected.find(({ client }) => client === "codex").version, "0.172.0");
  assert.ok(!JSON.stringify(detected).includes("private fixture text"));
  assert.match(qualificationInventory(detected).find(({ client }) => client === "hermes").reason, /Executable unavailable/);
  const pilot = pilotDisposition("implementer", codex);
  assert.equal(pilot.status, "unsupported");
  assert.equal(pilot.runtimeVersion.observedVersion, "0.172.0");
  assert.match(pilot.reason, /bounded live proof/);
  assert.throws(() => inspectPinnedFile({ ...executable, sha256: "0".repeat(64) }, { executable: true }), /SHA-256/);
});

test("discovery reports untrusted executables without probing and filters the probe PATH", (t) => {
  const { root, command } = fixture(t);
  const shared = path.join(root, "shared");
  const untrusted = path.join(shared, "bin");
  const linked = path.join(root, "linked");
  mkdirSync(untrusted, { recursive: true, mode: 0o700 });
  chmodSync(shared, 0o770);
  symlinkSync(untrusted, linked);
  const claude = path.join(untrusted, "claude");
  writeFileSync(claude, '#!/bin/sh\nprintf "2.1.330 (Claude Code)\\n"\n', { mode: 0o700 });
  symlinkSync(claude, path.join(root, "claude"));
  const hermes = path.join(root, "hermes");
  writeFileSync(hermes, '#!/bin/sh\nprintf "Hermes Agent v0.11.0\\n"\n', { mode: 0o700 });
  chmodSync(hermes, 0o770);
  const searchPath = [linked, root].join(path.delimiter);
  const probed = [];
  const detected = detectAgents({ searchPath, run: (entry, _args, options) => {
    probed.push(entry);
    assert.ok(options.env.PATH.split(path.delimiter).includes(root));
    assert.ok(!options.env.PATH.split(path.delimiter).some((directory) => [linked, untrusted].includes(directory)));
    return { status: 0, stdout: "codex-cli 0.172.0" };
  } });
  assert.deepEqual(probed, [command]);
  for (const [client, executable] of [["claude-code", claude], ["hermes", hermes]]) {
    const observed = detected.find((agent) => agent.client === client);
    assert.equal(observed.status, "present");
    assert.equal(observed.executable, executable);
    assert.equal(observed.version, null);
    assert.equal(observed.versionProbe, "untrusted-path");
  }
  const cli = spawnSync(process.execPath, [new URL("../skills/software-development/openspec-delivery/scripts/detect-agents.mjs", import.meta.url).pathname],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: { PATH: root } });
  assert.equal(cli.status, 0, cli.stderr);
  const observed = JSON.parse(cli.stdout).agents;
  assert.equal(observed.find(({ client }) => client === "codex").version, "0.172.0");
  assert.equal(observed.find(({ client }) => client === "claude-code").versionProbe, "untrusted-path");
  assert.equal(observed.find(({ client }) => client === "hermes").version, null);
});

test("Grok discovery prefers the current executable and retains the legacy client and executable fallback", (t) => {
  const { root } = fixture(t);
  const current = path.join(root, "grok");
  const legacy = path.join(root, "grok-build");
  const plainVersion = "grok 1.0.92 (b06756fd6256)";
  let currentVersion = plainVersion;
  const run = (file, _args, { env }) => {
    assert.equal(env.NO_COLOR, "1");
    return { status: 0, stdout: (file === current ? currentVersion : "grok-build v1.0.89") + "\n" };
  };
  const lookup = (detect) => detect({ searchPath: root, run }).find(({ client }) => client === "grok-build");
  const check = (command, executable) => {
    const selected = lookup(detectAgents);
    assert.deepEqual(lookup(detectOrchestrationAgents), selected);
    assert.equal(selected.command, command);
    assert.equal(selected.executable, executable);
    assert.equal(selected.status, executable ? "present" : "unavailable");
    return selected;
  };

  check("grok", null);
  writeFileSync(legacy, "#!/bin/sh\n", { mode: 0o700 });
  check("grok-build", legacy);
  writeFileSync(current, "#!/bin/sh\n", { mode: 0o600 });
  check("grok-build", legacy);
  chmodSync(current, 0o700);
  for (const observed of [plainVersion, `${plainVersion} [stable]`]) {
    currentVersion = observed;
    const selected = check("grok", current);
    if (selected.versionProbe === "untrusted-path") assert.equal(selected.version, null);
    else assert.equal(selected.version, "1.0.92");
    for (const observe of [observeVersion, observeOrchestrationVersion]) {
      assert.equal(observe(current, { client: "grok-build", searchPath: root, run }), "1.0.92");
    }
  }
  rmSync(legacy);
  check("grok", current);

  const version = (file, probe = run) => observeVersion(file, { client: "grok-build", searchPath: root, run: probe });
  assert.equal(version(legacy), "1.0.89");
  assert.equal(version(current, () => ({ status: 0, stdout: "grok 1.0.92\nunrelated output" })), null);
  assert.equal(version(current, () => ({ status: 0, stdout: "grok 1.0.92 (not-a-hash) [stable]" })), null);
  assert.equal(version(current, () => ({ status: 0, stdout: "grok 1.0.92 (b06756fd6256) [dev]" })), null);
  assert.equal(version(current, () => ({ status: 0, stdout: "grok 1.0.92 (b06756fd6256) [stable]\ngrok 1.0.93" })), null);
  assert.equal(version(current, () => ({ status: 1, stdout: "grok 1.0.92" })), null);
});

test("accepts unambiguous native version output without treating an arbitrary version mention as identity", () => {
  for (const [client, text, expected] of [
    ["codex", "codex-cli 0.171.0\n", "0.171.0"],
    ["claude-code", "2.1.330 (Claude Code)\n", "2.1.330"],
    ["bubblewrap", "bubblewrap 0.9.0\n", "0.9.0"],
    ["openspec", "2.1.1\n", "2.1.1"],
    ["hermes", "Hermes Agent v0.11.0 (2026-01-02)\n", "0.11.0"],
    ["opencode", "1.5.0-beta.1\n", "1.5.0-beta.1"],
    ["codex", "download required version 0.172.0", null],
    ["codex", "2.1.330 (Claude Code)\n", null],
    ["codex", "codex-cli 0.172.0\nrunner 0.1.0", null],
    ["codex", "codex-cli 0.172.0.1", null],
    ["pi", "v1.2.3-01", null],
  ]) assert.equal(reportedVersion(text, client), expected, text);
});

test("setup previews exact bytes, refuses drift and reads back independent role and host pins", (t) => {
  const { input, workspace, root, codex } = fixture(t);
  const options = { workspace };
  const preview = previewSetup(input, options);
  assert.deepEqual(readdirSync(input.directory), []);
  assert.ok(nativeRoleBinding(codex, "orchestrator").args.includes('model_reasoning_effort="high"'));
  assert.ok(JSON.parse(preview.outputs[2].utf8).openers.codex.args.includes('model_provider="openai"'));
  assert.equal(JSON.parse(preview.outputs[0].utf8).reviewer.timeoutMs, 5000);
  assert.equal(JSON.parse(preview.outputs[0].utf8).maxBudgetUsd, 1);
  const { maxBudgetUsd, ...defaultRequest } = input;
  const defaultHost = JSON.parse(previewSetup({ ...defaultRequest, reviewer: { client: "claude", model: "claude-fixture" } }, options).outputs[0].utf8);
  assert.equal(defaultHost.maxBudgetUsd, 2.50);
  assert.equal(defaultHost.reviewer.timeoutMs, 300000);
  assert.throws(() => applySetup(input, "0".repeat(64), options), /confirmation/);
  const alias = path.join(root, "alias");
  symlinkSync(input.directory, alias);
  assert.throws(() => previewSetup({ ...input, directory: alias }, options), /canonical/);
  assert.throws(() => previewSetup({ ...input, directory: workspace }, options), /repository/);
  symlinkSync(path.join(root, "absent"), preview.outputs[0].path);
  assert.throws(() => applySetup(input, preview.confirmationSha256, options), /conflicts/);
  rmSync(preview.outputs[0].path);
  const result = applySetup(input, preview.confirmationSha256, options);
  assert.equal(result.status, "verified");
  assert.equal(result.configurationSha256, hashBytes(readFileSync(preview.outputs[0].path)));
  const pin = { path: preview.outputs[1].path, sha256: preview.outputs[1].sha256 };
  assert.equal(readRoleBindings(pin).roles.implementer.reasoningEffort, "high");
  const repeat = previewSetup(input, options);
  assert.ok(repeat.outputs.every(({ state }) => state === "matching"));
  assert.equal(applySetup(input, repeat.confirmationSha256, options).configurationSha256, result.configurationSha256);
  assert.throws(() => applySetup(input, preview.confirmationSha256, options), /confirmation/);
  const { command, args } = JSON.parse(preview.outputs[2].utf8).openers.codex;
  const native = [...args.slice(4), "--add-dir", workspace];
  const launch = readWorksetOpener(pin, native, { workspace, env: {} });
  assert.deepEqual(launch.args, native);
  assert.throws(() => readWorksetOpener(pin, [...native, "--model", "elsewhere"], { workspace }), /workset members/);
  assert.throws(() => readWorksetOpener(pin, native, { workspace, env: { OPENAI_BASE_URL: "fixture" } }), /override/);
  const opener = spawnSync(command, [...args, "--add-dir", workspace], { cwd: workspace, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    env: { PATH: "/usr/bin:/bin", HOME: root } });
  assert.equal(opener.status, 0, opener.stderr);
  assert.deepEqual(opener.stdout.trimEnd().split("\n"), native);
  assert.equal(JSON.parse(opener.stderr).observedVersion, "0.172.0");
  writeFileSync(preview.outputs[0].path, preview.outputs[0].utf8 + " ");
  assert.throws(() => readRoleBindings(pin), /SHA-256/);
  assert.throws(() => readWorksetOpener(pin, native, { workspace }), /SHA-256/);
});

test("configured opener requires approved root identities before forwarding attachments", (t) => {
  const { input, workspace, root } = fixture(t);
  const approved = path.join(root, "approved");
  const unrelated = path.join(root, "unrelated");
  const alias = path.join(root, "alias");
  mkdirSync(approved, { mode: 0o700 });
  mkdirSync(unrelated, { mode: 0o700 });
  symlinkSync(approved, alias);
  const request = { ...input, worksetRoots: [workspace, approved] };
  assert.throws(() => previewSetup({ ...request, worksetRoots: [workspace, alias] }, { workspace }), /noncanonical/);
  const preview = previewSetup(request, { workspace });
  applySetup(request, preview.confirmationSha256, { workspace });
  const pin = { path: preview.outputs[1].path, sha256: preview.outputs[1].sha256 };
  assert.deepEqual(readRoleBindings(pin).worksetRoots.map((entry) => entry.path), [workspace, approved]);
  const { command, args } = JSON.parse(preview.outputs[2].utf8).openers.codex;
  const native = [...args.slice(4), "--add-dir", workspace, "--add-dir", approved];
  const launch = readWorksetOpener(pin, native, { workspace, env: {} });
  assert.deepEqual(launch.args, native);
  assert.throws(() => readWorksetOpener(pin, [...native, "--add-dir", alias], { workspace }), /outside the approved/);
  assert.throws(() => readWorksetOpener(pin, [...native, "--add-dir", workspace], { workspace }), /Duplicate/);
  assert.throws(() => readWorksetOpener(pin, native, { workspace: unrelated }), /launch directory/);
  const rejected = spawnSync(command, [...args, "--add-dir", workspace, "--add-dir", unrelated],
    { cwd: workspace, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: { PATH: "/usr/bin:/bin", HOME: root } });
  assert.equal(rejected.status, 2);
  assert.equal(rejected.stdout, "");
  assert.match(rejected.stderr, /outside the approved workset roots/);

  const legacy = JSON.parse(preview.outputs[1].utf8);
  delete legacy.worksetRoots;
  const legacyBytes = JSON.stringify(legacy);
  const legacyPath = path.join(input.directory, "legacy-roles.json");
  writeFileSync(legacyPath, legacyBytes, { mode: 0o600 });
  const legacyPin = { path: legacyPath, sha256: hashBytes(legacyBytes) };
  assert.equal(readRoleBindings(legacyPin).roles.orchestrator.client, "codex");
  assert.throws(() => readWorksetOpener(legacyPin, native, { workspace }), /no approved workset roots/);

  renameSync(approved, path.join(root, "original"));
  mkdirSync(approved, { mode: 0o700 });
  assert.throws(() => readWorksetOpener(pin, native, { workspace }), /root identity changed/);
});

test("setup allows a distinct XDG application directory and refuses a live profile alias", (t) => {
  const { input, root, workspace } = fixture(t);
  const configRoot = path.join(root, "xdg");
  const separate = path.join(configRoot, "fixture-role-setup");
  mkdirSync(configRoot, { mode: 0o700 });
  mkdirSync(separate, { mode: 0o700 });
  const previous = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = configRoot;
  t.after(() => {
    if (previous === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = previous;
  });
  const request = { ...input, directory: separate };
  assert.equal(previewSetup(request, { workspace }).directory, separate);
  symlinkSync(separate, path.join(configRoot, "openspec"));
  assert.throws(() => previewSetup(request, { workspace }), /live profile/);
  assert.deepEqual(readdirSync(separate), []);
});

test("minimal confirmed setup writes only host.json and rejects incompatible settings", (t) => {
  const { input, workspace } = fixture(t);
  const options = { workspace };
  const minimal = { schemaVersion: 2, directory: input.directory, reviewer: { client: "pi", model: "provider/model" } };
  const preview = previewSetup(minimal, options);
  assert.deepEqual(preview.outputs.map(({ name }) => name), ["host.json"]);
  assert.deepEqual(JSON.parse(preview.outputs[0].utf8), { schemaVersion: 3, maxBudgetUsd: 2.5,
    reviewer: { client: "pi", model: "provider/model", timeoutMs: 300000, packetConcurrency: 1 } });
  assert.throws(() => applySetup({ ...minimal, reviewer: { ...minimal.reviewer, packetConcurrency: 2 } },
    preview.confirmationSha256, options), /confirmation/);
  for (const settings of [{ timeoutMs: 600001 }, { packetConcurrency: 4 }, { client: "missing" }, { relay: "old" }]) {
    assert.throws(() => previewSetup({ ...minimal, reviewer: { ...minimal.reviewer, ...settings } }, options), /Invalid|Unsupported/);
  }
  assert.deepEqual(readdirSync(input.directory), []);
  applySetup(minimal, preview.confirmationSha256, options);
  assert.deepEqual(readdirSync(input.directory), ["host.json"]);
});
