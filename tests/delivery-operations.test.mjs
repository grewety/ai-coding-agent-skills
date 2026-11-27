import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, mkdir, mkdtemp, readFile, readdir, realpath, rename, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse, stringify } from "yaml";
import { execFixtureSync } from "./test-shards.mjs";

const skills = new URL("../skills/delivery-operations/", import.meta.url);
const supervisor = (file) => readFile(new URL("release-train-supervisor/" + file, skills), "utf8");
const wiki = (file) => readFile(new URL("wiki-delivery-sync/" + file, skills), "utf8");
const exampleId = "pin-note-01arz3ndektsv4rrffq69g5fav";
const repository = "example-org/sample-widget";
const projectPath = "projects/sample-widget";
const privateNote = "_meta/local.md";
const date = "2026-01-12";
const issueUrl = "https://github.com/example-org/sample-widget/issues/73";
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

function command(file, firstLine) {
  const block = [...file.matchAll(/^\s*\x60{3}sh\n([\s\S]*?)^\s*\x60{3}$/gm)]
    .map((match) => match[1].trim()).find((body) => body.startsWith(firstLine));
  assert.ok(block, firstLine);
  return block;
}

function note(source) {
  const match = /^---\n([\s\S]+?)\n---\n([\s\S]*)$/.exec(source);
  assert.ok(match, "expected frontmatter");
  return { data: parse(match[1]), body: match[2] };
}

const markdown = ({ data, body }) => "---\n" + stringify(data) + "---\n" + body;
const run = (program, args, options = {}) =>
  execFixtureSync(program, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...options }).trim();
const shell = (code, bindings) => run("sh", ["-eu", "-c", code], { env: { ...process.env, ...bindings } });
const read = (root, file) => readFile(path.join(root, file), "utf8");
const write = (root, file, value, flag = "w") => writeFile(path.join(root, file), value, { flag });

async function scratch(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "delivery-operations-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return realpath(directory);
}

async function exists(file) {
  try {
    await lstat(file);
    return true;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return false;
  }
}

function checkpoint(source) {
  const block = /^## Supervisor checkpoint\n\n((?:- .+\n)+)/m.exec(source);
  assert.ok(block, "checkpoint block");
  return block[1];
}

test("Supervisor uses documented Herdr argv with a mock and supervises one request to a governance stop", async (t) => {
  const directory = await scratch(t);
  const playbook = await supervisor("SKILL.md");
  const adapter = await supervisor("references/herdr.md");
  const split = command(adapter, "herdr pane split");
  const observe = command(adapter, "herdr pane get");
  const start = command(adapter, "herdr agent start");
  const readDriver = command(adapter, "herdr agent get");
  const prompt = command(adapter, "herdr agent prompt");
  const mock = path.join(directory, "mock-herdr.mjs");
  const callsFile = path.join(directory, "calls.jsonl");
  await writeFile(mock, [
    'import { appendFileSync } from "node:fs";',
    'const args = process.argv.slice(2);',
    'appendFileSync(process.env.calls_file, JSON.stringify(args) + "\\n");',
    'const [, operation] = args;',
    'if (operation === "split") console.log(JSON.stringify({ result: { pane: { pane_id: "w1:p2" } } }));',
    'if (operation === "process-info") console.log(JSON.stringify({ cwd: process.env.worktree }));',
    'if (operation === "read" && args[0] === "agent") console.log(process.env.driver_session);',
    'if (operation === "prompt") process.exitCode = 75; // Submitted, acknowledgment lost.',
  ].join("\n"));
  const bindings = {
    anchor_pane: "w1:p1", worktree: path.join(directory, "repo with 'quotes'; $(literal)"),
    driver_name: "widget-driver", driver_session: "native 'session'; $(literal)", calls_file: callsFile,
    request_text: "Request D1: deliver " + exampleId + " with '$literal' and a semicolon;",
    mock_script: mock,
  };
  const invoke = (script) => shell('herdr() { node "$mock_script" "$@"; }\n' + script, bindings);

  // Exercise the documented startup read sequence and route qualification in the fixture.
  const startup = new Map([
    ["hot.md", await supervisor("templates/hot.md")],
    ["_meta/voice.md", "Use concise observed progress.\n"],
    [privateNote, "Selected terminal and scheduler: fixture.\n"],
    ["PROJECT.md", await wiki("templates/project-index.md")],
    ["STATE.md", await supervisor("templates/state.md")],
  ]);
  for (const [file, contents] of startup) {
    assert.ok(playbook.includes(file), file);
    assert.ok(contents.trim(), file);
  }
  const stateTemplate = startup.get("STATE.md");
  const hotTemplate = startup.get("hot.md");
  assert.equal(checkpoint(hotTemplate), checkpoint(stateTemplate));
  assert.equal(checkpoint(await wiki("templates/hot.md")), checkpoint(stateTemplate));
  assert.match(playbook, /same turn/);
  assert.match(playbook, /verified in-session/);
  assert.match(playbook, /positive evidence proves the action did not take effect/);

  let pending;
  let generation = 0;
  const bind = { change: exampleId, phase: "local delivery", session: bindings.driver_session, request: "D1" };
  const arm = (nextBinding) => {
    assert.equal(pending, undefined, "only one outstanding check");
    pending = { id: ++generation, binding: nextBinding };
    return pending.id;
  };
  const wake = (id) => {
    if (pending?.id !== id) return null;
    const { binding } = pending;
    pending = undefined;
    return binding;
  };
  assert.deepEqual(wake(arm({ probe: true })), { probe: true });

  // Owner and grant readback are controlled fixture inputs. No live adapter is used.
  const grant = { change: exampleId, phase: "local delivery", remaining: 2 };
  assert.equal(grant.change, bind.change);
  assert.equal(grant.phase, bind.phase);
  assert.ok(grant.remaining > 0);
  bindings.pane_id = JSON.parse(invoke(split)).result.pane.pane_id;
  assert.equal(JSON.parse(invoke(observe)).cwd, bindings.worktree);
  invoke(start);
  assert.equal(invoke(readDriver), bind.session);
  assert.throws(() => invoke(prompt), { status: 75 });
  const firstWake = arm(bind); // Uncertain delivery still arms in the launch turn.
  assert.equal(pending.id, firstWake);
  assert.deepEqual(wake(firstWake), bind);
  assert.equal(invoke(readDriver), bind.session);
  const calls = (await readFile(callsFile, "utf8")).trim().split("\n").map((line) => JSON.parse(line));
  assert.deepEqual(calls.find((argv) => argv[1] === "split"),
    ["pane", "split", bindings.anchor_pane, "--direction", "right", "--cwd", bindings.worktree, "--no-focus"]);
  assert.deepEqual(calls.find((argv) => argv[1] === "start"),
    ["agent", "start", bindings.driver_name, "--kind", "codex", "--pane", bindings.pane_id, "--", "resume", bind.session]);
  assert.deepEqual(calls.filter((argv) => argv[1] === "prompt"), [["agent", "prompt", bindings.driver_name, bindings.request_text]]);

  const routineWake = arm(bind); // Working through a recoverable check failure.
  assert.equal(wake(firstWake), null);
  assert.deepEqual(wake(routineWake), bind);
  const readback = { finishReady: true, candidate: "a".repeat(40), finishGrant: null };
  assert.ok(readback.finishReady && !readback.finishGrant);
  assert.equal(pending, undefined);
  const card = await supervisor("templates/decision-card.md");
  assert.match(card, /^1\. \*\*Recommended\.\*\*/m);
  assert.match(card, /^2\. /m);
  assert.ok(card.includes(exampleId) && card.includes(readback.candidate));
  assert.match(card, /separate grant/);
  // Simulate an interruption after the STATE update and repair only the stale hot block.
  await write(directory, "STATE.md", stateTemplate);
  await write(directory, "hot.md", hotTemplate.replace("awaiting protected finish authorization", "working"));
  assert.notEqual(checkpoint(await read(directory, "STATE.md")), checkpoint(await read(directory, "hot.md")));
  await write(directory, "hot.md", (await read(directory, "hot.md")).replace(
    checkpoint(await read(directory, "hot.md")), checkpoint(await read(directory, "STATE.md"))));
  assert.equal(checkpoint(await read(directory, "STATE.md")), checkpoint(await read(directory, "hot.md")));

  const finishGrant = { change: bind.change, candidate: readback.candidate, phase: "protected finish" };
  assert.equal(finishGrant.candidate, readback.candidate);
  const finishBinding = { ...bind, phase: finishGrant.phase, request: "D2" };
  const unblockWake = arm(finishBinding);
  assert.deepEqual(pending.binding, finishBinding); // Verified in the unblock turn.
  assert.deepEqual(wake(unblockWake), finishBinding);
  assert.equal(pending, undefined);
});

async function setupVault(t) {
  const directory = await scratch(t);
  const vault = path.join(directory, "vault; literal");
  const repo = path.join(directory, "repo with 'quotes' $(literal)");
  const project = path.join(vault, projectPath);
  const git = (root, ...args) => run("git", ["-C", root, ...args]);
  for (const root of [vault, repo]) {
    await mkdir(path.join(root, "_meta"), { recursive: true });
    git(root, "init", "-q");
    await write(root, ".gitignore", "/_meta/local.md\n");
  }
  git(repo, "remote", "add", "origin", "https://github.com/" + repository + ".git");
  await mkdir(path.join(project, "briefs", "archive"), { recursive: true });
  await mkdir(path.join(vault, "decisions"));
  await mkdir(path.join(vault, "runbooks"));
  await write(vault, "AGENTS.md", await wiki("templates/vault-agents.md"));
  await write(repo, "AGENTS.md", (await wiki("templates/repository-agents.md")) + "\nAdopt full Change Brief names.\n");
  await write(vault, "_meta/voice.md", "# Voice\n\nUse concise observed progress.\n");
  await write(vault, "index.md", "# Delivery vault\n\n[Hot](hot.md) [Log](log.md) [Project](" + projectPath + "/PROJECT.md)\n");
  await write(vault, "log.md", "# Release log\n");
  await write(vault, "runbooks/index.md", "# Runbooks\n\n[Vault](../index.md)\n");
  await write(vault, "decisions/index.md", (await wiki("templates/decisions.md")).split("\n## ")[0]);
  await write(vault, "hot.md", await wiki("templates/hot.md"));
  await write(project, "PROJECT.md", await wiki("templates/project-index.md"));
  await write(project, "STATE.md", await supervisor("templates/state.md"));
  await write(project, "TRAIN.md", (await wiki("templates/release-train.md")).replace(/^- \[Pin note\].+$/m, "_Empty._"));
  await write(project, "SHIPPED.md", (await wiki("templates/shipped.md")).split("\n| 2026-")[0] + "\n");
  const guard = command(await wiki("SKILL.md"), "# Check the exact private pointer");
  for (const root of [vault, repo]) shell(guard, { root });
  await write(vault, privateNote, (await wiki("templates/vault-local.md"))
    .replace("/example/checkouts/sample-widget", JSON.stringify(repo)));
  await write(repo, privateNote, (await wiki("templates/repository-local.md"))
    .replace("/example/vaults/delivery", JSON.stringify(vault)));
  return { vault, repo, project, git, guard };
}

// Fixture walkthrough of the documented local-data checks. Only the published shell block is executable in the package.
async function discoverFrom(f, initialRoot) {
  const readPointer = async (root) => {
    assert.equal(await realpath(root), root);
    assert.equal(f.git(root, "rev-parse", "--show-toplevel"), root);
    assert.ok((await lstat(path.join(root, "_meta"))).isDirectory());
    assert.ok((await lstat(path.join(root, privateNote))).isFile());
    shell(f.guard, { root });
    return note(await read(root, privateNote)).data;
  };
  const projectEntry = (vaultPointer) => {
    const matches = vaultPointer.projects.filter((entry) => entry.repository === repository);
    assert.equal(matches.length, 1, "exact project entry");
    return matches[0];
  };
  const initial = await readPointer(initialRoot);
  const vaultEntry = initial.projects ? projectEntry(initial) : projectEntry(await readPointer(initial.vault_root));
  const repoEntry = initial.projects ? await readPointer(vaultEntry.repository_root) : initial;
  assert.equal(vaultEntry.repository_root, f.repo, "repository root");
  assert.equal(repoEntry.vault_root, f.vault, "vault root");
  for (const entry of [vaultEntry, repoEntry]) {
    assert.equal(entry.repository, repository);
    assert.equal(entry.project_key, "sample-widget");
    assert.equal(entry.project_path, projectPath);
  }
  assert.equal(f.git(f.repo, "remote", "get-url", "origin"), "https://github.com/" + repository + ".git");
  assert.equal(await realpath(f.project), f.project);
  const { data } = note(await read(f.project, "PROJECT.md"));
  assert.deepEqual(data, { repository, project_key: "sample-widget" });
  return f.project;
}

async function assertNavigation(root, file) {
  const source = await read(root, file);
  for (const [, relative] of source.matchAll(/\]\(([^)]+)\)/g)) {
    assert.ok(await exists(path.resolve(root, path.dirname(file), relative)), file + " → " + relative);
  }
}

test("vault templates bootstrap portable navigation and route either root with private values ignored", async (t) => {
  const f = await setupVault(t);
  for (const root of [f.vault, f.repo]) {
    assert.equal(await discoverFrom(f, root), f.project);
    assert.ok(!f.git(root, "status", "--short", "--untracked-files=all").includes(privateNote));
    assert.equal(f.git(root, "ls-files", "--", privateNote), "");
  }
  for (const file of ["index.md", "hot.md", "decisions/index.md", "runbooks/index.md",
    ...["PROJECT.md", "STATE.md", "TRAIN.md", "SHIPPED.md"].map((name) => projectPath + "/" + name)]) {
    await assertNavigation(f.vault, file);
    for (const value of [f.vault, f.repo]) assert.ok(!(await read(f.vault, file)).includes(value));
  }
});

test("missing, stale, tracked, unsafe and conflicting reciprocal pointers preserve both roots", async (t) => {
  const mutations = {
    missing: (f) => rm(path.join(f.repo, privateNote)),
    stale: async (f) => write(f.repo, privateNote,
      (await read(f.repo, privateNote)).replace(JSON.stringify(f.vault), JSON.stringify(f.vault + "-old"))),
    tracked: (f) => f.git(f.repo, "add", "-f", "--", privateNote),
    unsafe: async (f) => {
      await rename(path.join(f.repo, privateNote), path.join(f.repo, "_meta/redirected.md"));
      await symlink("redirected.md", path.join(f.repo, privateNote));
    },
    traversal: async (f) => write(f.repo, privateNote,
      (await read(f.repo, privateNote)).replace("project_path: " + projectPath, "project_path: projects/../sample-widget")),
    conflicting: async (f) => write(f.repo, privateNote,
      (await read(f.repo, privateNote)).replace("repository: " + repository, "repository: example-org/another-widget")),
    mismatchedRemote: (f) => f.git(f.repo, "remote", "set-url", "origin", "https://github.com/example-org/another-widget.git"),
  };
  for (const [label, mutate] of Object.entries(mutations)) await t.test(label, async (t) => {
    const f = await setupVault(t);
    const before = await read(f.project, "TRAIN.md");
    await mutate(f);
    for (const root of [f.vault, f.repo]) await assert.rejects(discoverFrom(f, root));
    assert.equal(await read(f.project, "TRAIN.md"), before);
    assert.deepEqual(await readdir(path.join(f.project, "briefs")), ["archive"]);
  });
});

test("authorized intake mints one trusted identity, repairs a lane write, and binds only the verified provider issue", async (t) => {
  const f = await setupVault(t);
  const { repo, vault, project } = f;
  const playbook = await wiki("SKILL.md");
  assert.match(playbook, /has not adopted this intake\/naming convention, stop/);
  assert.match(playbook, /With separate proposal authority/);
  assert.match(await read(repo, "AGENTS.md"), /Adopt full Change Brief names/);
  assert.equal(await discoverFrom(f, repo), project);
  const naming_helper = fileURLToPath(new URL("../skills/software-development/openspec-delivery/scripts/change-name.mjs", import.meta.url));
  const mint = command(playbook, 'node "$naming_helper"');
  let mintCount = 0;
  function newIdentity() {
    mintCount++;
    return JSON.parse(shell(mint, { naming_helper, slug: "pin-note" }));
  }

  const identity = newIdentity();
  assert.equal(identity.ok, true);
  assert.match(identity.name, /^pin-note-[0-7][0-9a-hjkmnp-tv-z]{25}$/);
  assert.equal(identity.path, "openspec/changes/" + identity.name);
  assert.equal(identity.branch, "change/" + identity.name);
  const briefRelative = "briefs/" + identity.name + ".md";
  const brief = note((await wiki("templates/change-brief.md")).replaceAll(exampleId, identity.name));
  assert.deepEqual(Object.keys(brief.data).sort(), ["change_id", "github_issue", "lane", "slug", "status", "updated"]);
  await write(project, briefRelative, markdown(brief), "wx");
  await assert.rejects(write(project, briefRelative, markdown(brief), "wx"), { code: "EEXIST" });

  // The prior operation returned its name and wrote the brief, but the lane write stopped early.
  assert.equal(await discoverFrom(f, vault), project);
  const recovered = note(await read(project, briefRelative));
  assert.equal(recovered.data.change_id, identity.name);
  assert.equal(recovered.data.github_issue, null);
  assert.equal(mintCount, 1);
  const train = await read(project, "TRAIN.md");
  const link = "- [Pin note](" + briefRelative + ")";
  await write(project, "TRAIN.md", train.replace("## Now\n\n_Empty._", "## Now\n\n" + link));
  await assertNavigation(project, "TRAIN.md");

  recovered.data.lane = "Next";
  await write(project, briefRelative, markdown(recovered));
  await write(project, "TRAIN.md", train.replace("## Next\n\n_Empty._", "## Next\n\n" + link));
  assert.equal((await read(project, "TRAIN.md")).split(link).length - 1, 1);
  assert.equal(note(await read(project, briefRelative)).data.lane, "Next");

  const proposal = { change: identity.name, github_issue: issueUrl };
  const provider = { repository, url: issueUrl, change: identity.name };
  const bindIssue = async (nativeProposal, providerIssue) => {
    const current = note(await read(project, briefRelative));
    assert.equal(current.data.change_id, nativeProposal.change);
    if (nativeProposal.github_issue === null) {
      assert.equal(current.data.github_issue, null, "pending binding");
      return;
    }
    assert.equal(providerIssue.repository, repository);
    assert.equal(providerIssue.change, current.data.change_id);
    assert.equal(providerIssue.url, nativeProposal.github_issue);
    assert.ok(current.data.github_issue === null || current.data.github_issue === providerIssue.url);
    if (current.data.github_issue === null) {
      current.data.github_issue = providerIssue.url;
      await write(project, briefRelative, markdown(current));
    }
  };
  await bindIssue({ ...proposal, github_issue: null }, null);
  const before = await read(project, briefRelative);
  await assert.rejects(bindIssue(proposal, { ...provider, change: exampleId }));
  await assert.rejects(bindIssue(proposal, { ...provider, repository: "example-org/another-widget" }));
  assert.equal(await read(project, briefRelative), before);
  await bindIssue(proposal, provider);
  const bound = await read(project, briefRelative);
  await bindIssue(proposal, provider);
  await assert.rejects(bindIssue({ ...proposal, github_issue: issueUrl + "1" }, { ...provider, url: issueUrl + "1" }));
  assert.equal(await read(project, briefRelative), bound);
  assert.equal(note(bound).data.github_issue, issueUrl);
  assert.equal(mintCount, 1);
});

test("closeout walkthrough validates receipt bytes, resumes an interrupted write and replays without duplicates", async (t) => {
  const f = await setupVault(t);
  const { vault, project } = f;
  const closeout = await wiki("references/closeout.md");
  assert.match(closeout, /Compute SHA-256 of the raw bytes/);
  assert.match(closeout, /Create the archive exclusively/);
  assert.match(closeout, /Preserve any newer\/unrelated checkpoint/);
  const brief = note(await wiki("templates/change-brief.md"));
  brief.data.github_issue = issueUrl;
  const active = "briefs/" + exampleId + ".md";
  const archive = "briefs/archive/" + date + "-" + exampleId + ".md";
  await write(project, active, markdown(brief));
  const laneLine = "- [Pin note](" + active + ")";
  await write(project, "TRAIN.md", (await read(project, "TRAIN.md")).replace("## Now\n\n_Empty._", "## Now\n\n" + laneLine));
  const receipt = Buffer.from(JSON.stringify({ change: exampleId, integrated: "b".repeat(40), issue: issueUrl }) + "\n");
  const readback = {
    target: "d".repeat(40), archive: "openspec/changes/archive/" + date + "-" + exampleId,
    date, receiptSha256: digest(receipt), change: exampleId, issue: issueUrl, integrated: "b".repeat(40),
  };
  const row = "| " + date + " | [" + exampleId + "](" + archive + ") | " + readback.integrated +
    " | " + readback.receiptSha256 + " | fixture accepted readback |";
  const event = "- " + date + " " + exampleId + " " + readback.receiptSha256;
  const nav = "[Shipped](" + projectPath + "/SHIPPED.md)";
  const decisionLine = "- Keep pinning user-scoped. [" + exampleId + "](../" + projectPath + "/" + archive + ")";
  const stateBefore = await read(project, "STATE.md");
  const observed = checkpoint(stateBefore);
  const complete = observed.replace("local delivery", "verified closeout")
    .replace("awaiting protected finish authorization", "archived")
    .replace(/^(- Evidence: ).+$/m, "$1" + readback.receiptSha256)
    .replace("bounded local grant used; protected finish pending", "delivery accepted")
    .replace(/^(- Next safe action: ).+$/m, "$1review the remaining train");
  const state = (root, file) => read(root, file).then(checkpoint);
  const tracked = [
    [project, active], [project, archive], [project, "STATE.md"], [project, "SHIPPED.md"], [project, "TRAIN.md"],
    [vault, "hot.md"], [vault, "index.md"], [vault, "log.md"], [vault, "decisions/index.md"],
  ];
  const snapshot = () => Promise.all(tracked.map(async ([root, relative]) =>
    await exists(path.join(root, relative)) ? read(root, relative) : null));

  // A controlled walkthrough using an authoritative fixture readback, no live receipt verifier or integration.
  async function apply(bytes, { interrupt = false } = {}) {
    assert.ok(bytes, "receipt required");
    assert.equal(digest(bytes), readback.receiptSha256, "retained raw receipt hash");
    assert.deepEqual(JSON.parse(bytes), { change: readback.change, integrated: readback.integrated, issue: readback.issue });
    assert.equal(readback.archive.split("/").at(-1), readback.date + "-" + readback.change);
    const activePresent = await exists(path.join(project, active));
    const archivePresent = await exists(path.join(project, archive));
    const copies = await readdir(path.join(project, "briefs/archive"));
    assert.ok(copies.every((name) => !name.endsWith("-" + exampleId + ".md") || name === path.basename(archive)), "competing archive");
    const source = note(await read(project, activePresent ? active : archive));
    assert.equal(source.data.change_id, readback.change);
    assert.equal(source.data.github_issue, readback.issue);
    const expected = markdown({
      data: { ...source.data, status: "archived", updated: date, shipped_commit: readback.integrated, receipt_sha256: readback.receiptSha256 },
      body: source.body,
    });
    if (archivePresent) assert.equal(await read(project, archive), expected, "archive readback differs");
    const upserts = [
      [project, "SHIPPED.md", row, exampleId], [vault, "log.md", event, exampleId],
      [vault, "decisions/index.md", decisionLine, exampleId], [vault, "index.md", nav, nav],
    ];
    const pending = [];
    for (const [root, file, line, key] of upserts) {
      const text = await read(root, file);
      const existing = text.split("\n").filter((value) => value.includes(key));
      if (existing.length) assert.deepEqual(existing, [line], "matching single " + file + " entry");
      else pending.push([root, file, text.trimEnd() + "\n" + line + "\n"]);
    }

    if (!archivePresent) await write(project, archive, expected, "wx");
    assert.equal(await read(project, archive), expected);
    if (interrupt) return;
    if (activePresent) await rm(path.join(project, active));
    for (const [root, file, text] of pending) await write(root, file, text);
    const train = await read(project, "TRAIN.md");
    if (train.includes(laneLine)) await write(project, "TRAIN.md", train.replace(laneLine, "_Empty._"));
    for (const [root, file] of [[project, "STATE.md"], [vault, "hot.md"]]) {
      const before = await read(root, file);
      const block = checkpoint(before);
      if (block.includes(exampleId) && block !== complete) {
        await write(root, file, before.replace(block, complete));
      }
    }
  }

  const initial = await snapshot();
  await assert.rejects(apply(null), /receipt required/);
  await assert.rejects(apply(Buffer.from(receipt.toString() + " ")), /retained raw receipt hash/);
  assert.deepEqual(await snapshot(), initial);
  await apply(receipt, { interrupt: true });
  assert.ok(await exists(path.join(project, active)));
  const archived = await read(project, archive);
  await write(project, archive, archived.replace(readback.receiptSha256, "e".repeat(64)));
  const mismatch = await snapshot();
  await assert.rejects(apply(receipt), /archive readback differs/);
  assert.deepEqual(await snapshot(), mismatch);
  await write(project, archive, archived);
  await apply(receipt);
  assert.deepEqual(note(await read(project, archive)).data, {
    ...brief.data, status: "archived", shipped_commit: readback.integrated, receipt_sha256: digest(receipt),
  });
  assert.equal(await state(project, "STATE.md"), complete);
  assert.equal(await state(vault, "hot.md"), complete);
  assert.ok(!(await exists(path.join(project, active))));
  assert.ok(!(await read(project, "TRAIN.md")).includes(exampleId));
  for (const [root, file] of [[project, "SHIPPED.md"], [vault, "index.md"], [vault, "decisions/index.md"]]) {
    await assertNavigation(root, file);
  }
  const completed = await snapshot();
  await apply(receipt);
  assert.deepEqual(await snapshot(), completed);

  const newer = (await read(vault, "hot.md")).replace(exampleId, "another-change-01arz3ndektsv4rrffq69g5faw");
  await write(vault, "hot.md", newer);
  await apply(receipt);
  assert.equal(await read(vault, "hot.md"), newer);
  await write(project, "SHIPPED.md", (await read(project, "SHIPPED.md")).replace(readback.integrated, "f".repeat(40)));
  const conflictingHistory = await snapshot();
  await assert.rejects(apply(receipt), /matching single SHIPPED\.md entry/);
  assert.deepEqual(await snapshot(), conflictingHistory);
});
