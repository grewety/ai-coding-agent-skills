import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sha256 } from "../skills/software-development/openspec-delivery/scripts/evidence-cli.mjs";
import { deliveryCommand } from "../skills/software-development/openspec-delivery/scripts/delivery-cli.mjs";
import { requestBytes } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/worker-handoff.mjs";
import { roleQualificationBinding } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/implementer-bindings.mjs";
import { claimPath } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/implementer-claims.mjs";
import { observeImplementer, runImplementers, runtimeIdentity } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/implementer-runtime.mjs";
import { readState } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/implementer-state.mjs";
import { privateCheckoutIdentity } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/worker-runtime-policy.mjs";
import { jsonBytes } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-inputs.mjs";
import { claudeVersion } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-runtime.mjs";

import { change } from "./delivery-runtime-setup.mjs";

export function workerRequest(f, head, gateReference, attempt, directory, role = "reviewer") {
  return { schemaVersion: 1,
    identity: { attempt, predecessor: null, role, change, group: "1", task: "1.1", action: "1.1", workspace: f.workspace, plan: f.plan,
      planDigest: f.planDigest, candidate: role === "reviewer" ? head : null, inputs: { ...f.evaluated.context.inputs },
      implementerSession: role === "reviewer" ? "fixture-implementer" : null },
    outcome: "Review the widget", acceptance: [`gate-run:${gateReference}`], scope: ["widget.txt"], nonGoals: ["Publish"],
    authority: { orchestrator: "fixture-owner", writer: "fixture-owner", authorSession: "fixture-author",
      approvalReference: f.request.approval.reference, executionReference: f.request.grant.reference },
    restrictions: ["no Git writes", "no tasks.md writes", "no profile writes", "no subagents", "no multiplexers",
      ...(role === "reviewer" ? ["read-only"] : [])], budget: { limit: 15, unit: "minutes" },
    stop: "Scope conflict", evidenceRoots: [directory], requiredEvidence: ["native.txt", "lifecycle.jsonl"], mutablePaths: [],
  };
}

const fakeCodex = `#!/usr/bin/python3
import json, pathlib, sys, uuid
fence = chr(96) * 3
request = json.loads(sys.stdin.read().split(fence + "json\\n", 1)[1].split("\\n" + fence, 1)[0])
def emit(kind, **fields):
    print(json.dumps(dict(type=kind, **fields)), flush=True)
emit("thread.started", thread_id=str(uuid.uuid4()))
emit("turn.started")
if "synthetic cap" in request["acceptance"]:
    emit("item.completed", item=dict(type="agent_message", text="Partial synthetic progress"))
    emit("turn.failed", error=dict(code="turn_limit"))
    sys.exit(12)
for name in request["mutablePaths"]:
    pathlib.Path(name).write_text("new" if request["identity"]["task"] == "1.1" else "next")
emit("item.completed", item=dict(type="agent_message", text="Synthetic implementation result"))
emit("turn.completed", usage=dict(output_tokens=3))
`;

export async function buildExclusiveFixture(f, { workerRequest, containedHandover }) {
  const registry = path.join(f.root, "exclusive-registry");
  const trusted = path.join(f.root, "trusted-worker-inputs");
  const evidence = path.join(f.root, "worker-evidence");
  const paths = ["worker-home", "worker-xdg", "worker-codex", "review-slot"].map((name) => path.join(f.root, name));
  const [home, xdg, codexHome, reviewSlot] = paths;
  await Promise.all([trusted, evidence, ...paths].map((dir) => mkdir(dir, { mode: 0o700 })));
  const pin = async (name, bytes, mode = 0o400) => {
    const file = path.join(trusted, name);
    await writeFile(file, bytes, { mode, flag: "wx" });
    return { path: file, sha256: sha256(bytes) };
  };
  const retain = (name, value) => pin(name, jsonBytes(value));
  const runtimeSha256 = await runtimeIdentity();
  const binary = await pin("synthetic-native", fakeCodex, 0o700);
  const codexConfiguration = await retain("codex-configuration.json", {
    schemaVersion: 1, role: "implementer", auth: "dedicated-file", disableHostDiscovery: true, permissionMode: "named-workspace-write",
  });
  const reviewerConfiguration = await retain("review-configuration.json", {
    schemaVersion: 1, bwrap: binary, claude: binary, node: binary, libraries: [], model: "claude-fixture",
    relay: { route: "same-uid-key", keyFile: path.join(f.root, "synthetic-relay-pin"), keyFormat: "raw" },
    timeoutMs: 2000, maxTurns: 4, maxBudgetUsd: 1, requirePreExposureAttestation: false,
  });
  const inventory = async (name) => [await pin(name + "-skill.md", "Synthetic skill"), await pin(name + "-helper.mjs", "Synthetic helper")];
  const pair = {
    implementer: { client: "codex", provider: "openai", model: "fixture-codex", version: "0.171.0", route: "codex-native-named-workspace-write",
      configuration: codexConfiguration, inventory: await inventory("implementer"), slot: codexHome, home, xdg, codexHome, executable: binary },
    reviewer: { client: "claude-code", provider: "anthropic", model: "claude-fixture", version: claudeVersion, route: "claude-bubblewrap-read-only",
      configuration: reviewerConfiguration, inventory: await inventory("reviewer"), slot: reviewSlot, session: randomUUID() },
  };
  for (const [name, role] of Object.entries(pair)) {
    const { client, provider, version, model, route, configuration } = role;
    role.qualification = await retain(name + "-qualification.json", {
      schemaVersion: 1, kind: "exclusive-runtime-qualification", status: "qualified", role: name, client, provider, version, model,
      route, configurationSha256: configuration.sha256, inventorySha256: sha256(jsonBytes(role.inventory)), runtimeSha256,
      bindingSha256: roleQualificationBinding(role), supervisor: name + "-synthetic-controller", positiveControl: true,
      deniedPublication: true, protectedPaths: true, settlementVerified: true, inventoryUnchanged: true,
    });
  }
  const repository = "github.com/example/fixture";
  const { change, plan, planDigest, mode, policyRevision, workspace } = f.request.approval;
  const base = { schemaVersion: 1, change, plan, planDigest, mode, policyRevision, workspace, repository,
    branch: `refs/heads/change/${change}`, orchestrator: "fixture-owner", authorSession: "fixture-author" };
  const issuedAt = Date.now() - 1000;
  const expiresAt = issuedAt + 240000;
  const approval = await retain("approval.json", { ...base, kind: f.request.approval.kind, approved: true, approvedAt: issuedAt });
  const implementer = fileURLToPath(new URL("../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/run-implementer.mjs", import.meta.url));
  const verifierSha256 = sha256(await readFile(implementer));
  const decide = (input) => deliveryCommand("decision", input, { registry });
  const status = (input) => deliveryCommand("status", input, { registry });
  const readClaim = (attempt) => path.join(claimPath(registry, repository, change), "attempt-" + attempt);

  async function assignment(attempt, {
    task = "1.1", predecessor = null, continuation = null, accepted = [], initialHead = plan, reviewSession = pair.reviewer.session,
    noCommits = false, commits = !noCommits, behavior,
  } = {}) {
    const host = await retain(attempt + "-host.json", {
      schemaVersion: 1, runtimeSha256, pair: { ...pair, reviewer: { ...pair.reviewer, session: reviewSession } }, override: null,
      restrictions: { allowedClients: ["codex", "claude-code"], allowedModels: ["fixture-codex", "claude-fixture"],
        allowedProviders: ["openai", "anthropic"], requireDistinctModels: true },
    });
    const grantFile = path.join(trusted, attempt + "-grant.json");
    const group = task.split(".")[0];
    const request = workerRequest(f, null, "", attempt, path.join(evidence, attempt), "implementer");
    Object.assign(request, { outcome: mode === "goal-first" ? f.contract.outcome : "Deliver the fixture group",
      scope: mode === "goal-first" ? f.contract.scope : ["widget.txt"], acceptance: mode === "goal-first" ? f.contract.acceptance :
        ["Widget loads", ...(behavior ? [behavior] : [])], stop: "Scope conflict", budget: { limit: 1, unit: "minutes" },
      mutablePaths: ["widget.txt"], requiredEvidence: ["native.txt", "lifecycle.jsonl", "stdout.jsonl", "stderr.log", "launch.json"],
    });
    Object.assign(request.identity, { group, task, action: task, predecessor });
    Object.assign(request.authority, { approvalReference: approval.path, executionReference: grantFile });
    if (noCommits) request.restrictions.push("no commits");
    const requestSha256 = sha256(requestBytes(request));
    const inference = await retain(attempt + "-inference.json", { schemaVersion: 1, kind: "worker-inference-authority", attempt,
      requestSha256, hostSha256: host.sha256, orchestrator: base.orchestrator, maxRuns: 1, expiresAt });
    const grant = await retain(attempt + "-grant.json", {
      ...base, kind: "local-execution-grant", localOnly: true, commits, requestSha256, hostSha256: host.sha256, approvalSha256: approval.sha256,
      checkoutIdentity: await privateCheckoutIdentity(workspace), head: initialHead, eligibleTasks: [task], accepted, knownWorkspaces: [],
      mutablePaths: request.mutablePaths, restrictions: request.restrictions, stop: request.stop, issuedAt, expiresAt, overrideSha256: null,
      limits: { timeoutMs: 3500, stdoutBytes: 16384, stderrBytes: 16384, maxTurns: 1, totalMs: 240000, groupMs: 180000,
        corrections: 1, batchSize: 1 }, continuation, inference,
      ...(mode === "goal-first" ? { normalizedPlanDigest: f.evaluated.context.planDigest } : {}),
    });
    const entry = { request, host, approval, grant };
    const reviewerInventory = sha256(jsonBytes(pair.reviewer.inventory));
    const preflight = { ...f.request.preflight,
      live: { ...f.request.preflight.live, repository }, auth: { ...f.request.preflight.auth, repository },
      reviewer: { ...f.request.preflight.reviewer, configurationSha256: reviewerConfiguration.sha256,
        expectedConfigurationSha256: reviewerConfiguration.sha256, packageSha256: reviewerInventory },
      relay: { ...f.request.preflight.relay, configurationSha256: reviewerConfiguration.sha256 },
      companions: { ...f.request.preflight.companions, actual: { reviewer: reviewerInventory }, expected: { reviewer: reviewerInventory } },
    };
    const input = { ...f.request, approval: { ...f.request.approval, reference: approval.path },
      grant: { ...f.request.grant, reference: grant.path, approvalReference: approval.path, stop: request.stop, eligibleGroups: ["1", "2"] },
      preflight, delegation: { verifier: implementer, verifierSha256, runtimeSha256, assignment: await retain(attempt + "-input.json",
        { schemaVersion: 1, assignments: [entry] }) } };
    return { entry, input, reviewSession };
  }

  async function settled(attempt, options = {}) {
    const [outcome] = await runImplementers([attempt.entry], { registry, runProbe: async () => ({ proof: [] }), ...options });
    return outcome;
  }

  async function release(attempt, result) {
    const id = attempt.entry.request.identity.attempt;
    const { claimId } = await readState(readClaim(id), "launch.json");
    const proof = await retain(id + "-release.json", {
      schemaVersion: 1, kind: "exclusive-runtime-release", action: "release-slot", claimId, change, attempt: id,
      orchestrator: base.orchestrator, settlementSha256: result.settlementSha256, quiescent: true, falloutVerified: true,
    });
    const released = await observeImplementer(attempt.entry, { registry, action: "release-slot", release: proof });
    assert.equal(released.phase, "slot-released", released.reason);
    return readState(readClaim(id), "publication.json");
  }

  async function review(attempt, runtime, head, gates, label, overrides = {}) {
    const checkout = path.join(f.root, label + "-checkout");
    f.git(f.repo, "worktree", "add", "--detach", checkout, head);
    const { task, group, action, attempt: predecessor } = attempt.entry.request.identity;
    const { bind = true, session = attempt.reviewSession, ...options } = overrides;
    const handover = await containedHandover(f, checkout, head, gates, label, {
      identity: { task, group, action, predecessor, implementerSession: runtime.result.runtime.session },
      authority: attempt.entry.request.authority, work: attempt.entry.request, session, configurationSha256: reviewerConfiguration.sha256,
      ...(mode === "goal-first" ? { goalDigest: f.planDigest } : {}), ...options,
    });
    if (bind) {
      const { claimId } = await readState(readClaim(predecessor), "launch.json");
      handover.reviewSessionBinding = await retain(`review-session-${session}.json`, {
        schemaVersion: 1, kind: "exclusive-review-session", claimId, change, plan, planDigest,
        attempt: predecessor, candidate: head, orchestrator: base.orchestrator, originalSession: attempt.reviewSession, session,
        configurationSha256: reviewerConfiguration.sha256, inventorySha256: sha256(jsonBytes(pair.reviewer.inventory)),
        requestFileSha256: handover.requestFileSha256, expectFileSha256: handover.expectFileSha256, reviewAuthority: "synthetic single-run approval", maxRuns: 1,
      });
    }
    return handover;
  }
  return { registry, assignment, settled, decide, status, retain, release, review, readClaim, pair };
}
