import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { change, current, currentSpec, exec, fixture, own } from "./delivery-runtime-setup.mjs";
import { containedHandover, gateFixture, workerRequest } from "./delivery-runtime-fixtures.mjs";
import { buildExport, jsonBytes, prepareExport } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-inputs.mjs";
import { bubblewrapVersion, claudeVersion } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-runtime.mjs";
import { runReview } from "../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-candidate.mjs";
import { createRepresentation, sha256 } from "../skills/software-development/openspec-delivery/scripts/evidence-retention.mjs";
import { committedPostimages, prFixRange } from "../skills/software-development/openspec-delivery/scripts/change-guard.mjs";
import { verifyPrFixIntegration } from "../skills/software-development/openspec-delivery/scripts/pr-fix-lineage.mjs";

async function scopedHandover(f, workspace, head, gates, attempt, {
  base, declaration, source, configurationSha256, determination = "verified",
} = {}) {
  const session = randomUUID();
  const root = path.join(f.root, attempt);
  await mkdir(root, { mode: 0o700 });
  const output = path.join(root, "output");
  const exportDirectory = path.join(root, "export");
  const request = path.join(root, "request.json");
  const expect = path.join(root, "expect.json");
  const evidence = "fixture-gate-evidence.json";
  const evidenceBytes = await readFile(gates.gateRun.file);
  await writeFile(path.join(workspace, evidence), evidenceBytes);
  const diff = exec("git", ["-C", workspace, "diff", "--no-color", "--no-ext-diff", "--no-textconv", "--no-relative",
    "--find-renames=50%", "--diff-algorithm=myers", "--no-indent-heuristic", "--patch", "--text", "--full-index", "--unified=3",
    "--src-prefix=a/", "--dst-prefix=b/", base, head, "--"]);
  assert.equal(diff.status, 0, diff.stderr);
  const worker = workerRequest(f, head, gates.captured.value.wrapperSha256, attempt, output);
  worker.acceptance.push(`goal-contract:${f.planDigest}`);
  const planDigest = f.evaluated.context.planDigest;
  Object.assign(worker.identity, { workspace, planDigest });
  const prFix = { declaration: "fix.json", source: "check-source.json", impacted: [current] };
  await writeFile(path.join(workspace, prFix.declaration), await readFile(declaration.file));
  await writeFile(path.join(workspace, prFix.source), await readFile(source.file));
  const record = { schemaVersion: 1, mode: "candidate", session, worker, policy: { parent: f.base, target: f.base },
    snapshot: { base, target: head, plan: f.plan, planDigest, diffSha256: sha256(diff.stdout), prFix,
      gates: [{ command: "Check widget", commit: head, exitCode: 0, evidence }] },
    attachments: { [evidence]: sha256(evidenceBytes), [prFix.declaration]: declaration.sha256, [prFix.source]: source.sha256 },
    limits: { diffBytes: 65536 } };
  const bytes = jsonBytes(record);
  await writeFile(request, bytes, { mode: 0o400 });
  const prepared = await buildExport(record);
  const binding = { schemaVersion: 1, requestSha256: sha256(bytes), exportSha256: await prepareExport(exportDirectory, record, null),
    configurationSha256, model: "claude-fixture" };
  const replay = await runReview({ request: record, expect: binding, prepared, directory: output, excluded: [exportDirectory],
    run: async ({ files, prompt, session }) => {
      const events = [];
      const emit = (event) => events.push({ ...event, session_id: session });
      const runtime = { session, model: binding.model, version: claudeVersion, bubblewrapVersion, maxTurns: f.evaluated.context.lowTouch ? 64 : 4, maxBudgetUsd: 1,
        configurationSha256: binding.configurationSha256, route: "same-uid-key" };
      emit({ type: "system", subtype: "init", model: runtime.model, claude_code_version: runtime.version, cwd: "/review",
        tools: ["Read"], permissionMode: "dontAsk", mcp_servers: [], skills: [], slash_commands: [], plugins: [] });
      for (const [name, data] of files) {
        const id = `read-${events.length}`;
        const file_path = `/review/${name}`;
        const content = data.toString("utf8");
        const numLines = content ? content.split("\n").length : 0;
        emit({ type: "assistant", message: { content: [{ type: "tool_use", id, name: "Read", input: { file_path } }] } });
        emit({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: id, content }] },
          tool_use_result: { type: "text", file: { filePath: file_path, content, startLine: 1, numLines, totalLines: numLines } } });
      }
      const packet = Number(/^Packet: (\d+) of/m.exec(prompt)?.[1]);
      const report = files.size ? ["Verdict: No findings", `Target: ${head}`, JSON.stringify({ target: head, packet,
        findings: [], coverageLimitations: determination === "verified" ? [] : ["Impact unknown"],
        prFix: { declarationSha256: declaration.sha256, determination } })].join("\n") : "REVIEW_PROBE_OK";
      emit({ type: "assistant", message: { content: [{ type: "text", text: report }] } });
      emit({ type: "result", subtype: "success", is_error: false, num_turns: 1, total_cost_usd: 0, permission_denials: [], result: report });
      return { runtime, proc: { code: 0, signal: null, outcome: "exit", quiescent: true,
        stdout: Buffer.from(events.map(JSON.stringify).join("\n") + "\n"), stderr: Buffer.alloc(0) } };
    },
  });
  assert.equal(replay.phase, "complete");
  const containedVerifier = fileURLToPath(new URL("../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-candidate.mjs", import.meta.url));
  const expectationBytes = jsonBytes({ ...binding, statusSha256: replay.statusSha256 });
  await writeFile(expect, expectationBytes, { mode: 0o400 });
  return { kind: "review-candidate", verifier: containedVerifier, verifierSha256: sha256(await readFile(containedVerifier)),
    request, requestFileSha256: sha256(bytes), expect, expectFileSha256: sha256(expectationBytes), exportDirectory, output };
}

test("sealed PR-fix lineage reaches finish, rejects stale evidence and replays from committed archive", async (t) => {
  const f = await fixture(t, { lowTouch: true });
  const records = path.join(f.root, "records");
  await mkdir(records, { mode: 0o700 });
  const retained = { ...f, root: records };
  const save = async (name, value) => {
    const file = path.join(records, name + ".json");
    const bytes = jsonBytes(value);
    await writeFile(file, bytes, { mode: 0o600 });
    return { file, sha256: sha256(bytes) };
  };
  const hostConfiguration = await save("host", { schemaVersion: 1, localHarness: null });
  await f.write(f.workspace, "widget.txt", "new");
  await f.write(f.workspace, current, currentSpec);
  await f.write(f.workspace, own + "/tasks.md", "# Tasks\n\n## 1. Widget\n- [x] 1.1 Pass the widget gate\n");
  const reviewedAncestor = f.commit(f.workspace, "Reviewed outcome");
  const ancestorGate = await gateFixture(retained, reviewedAncestor, "ancestor");
  const reviewer = path.join(f.root, "ancestor-checkout");
  f.git(f.repo, "worktree", "add", "--detach", reviewer, reviewedAncestor);
  const configurationSha256 = hostConfiguration.sha256;
  const ancestorReview = await containedHandover(retained, reviewer, reviewedAncestor, ancestorGate, "ancestor-review",
    { configurationSha256, goalDigest: f.planDigest });
  await chmod(path.join(f.workspace, "widget.txt"), 0o755);
  const head = f.commit(f.workspace, "Fix CI executable mode");
  const finalGate = await gateFixture(retained, head, "final");
  const pullRequest = "https://github.com/Example/Fixture/pull/1";
  const issue = "https://github.com/Example/Fixture/issues/2";
  const observedAt = new Date().toISOString();
  const source = await save("source", createRepresentation({
    original: jsonBytes({ pullRequest, head: reviewedAncestor,
      checks: [{ id: "fixture-ci", head: reviewedAncestor, conclusion: "failure" }] }),
    provenance: { source: "github-check-runs", revision: reviewedAncestor, scope: pullRequest,
      command: ["synthetic", "read"], environmentScope: "fixture", exitStatus: 0, pagination: "complete",
      observedAt, readbackType: "original-response" },
    labels: { representation: "original-response", completeness: "complete", confidentiality: "publishable" },
  }));
  const range = prFixRange(f.repo, reviewedAncestor, head);
  const declarationValue = { schemaVersion: 1, change, plan: f.plan, planDigest: f.planDigest, pullRequest,
    sourceSha256: source.sha256, range, impacted: [current],
    postimages: committedPostimages(f.repo, head, [...range.files, current]),
    findings: [{ id: "fixture-ci", kind: "ci", reason: "The check could not execute the widget.",
      disposition: "fixed", files: ["widget.txt"] }] };
  const declaration = await save("declaration", declarationValue);
  const deltaCheckout = path.join(f.root, "delta-checkout");
  f.git(f.repo, "worktree", "add", "--detach", deltaCheckout, head);
  const deltaReview = await scopedHandover(retained, deltaCheckout, head, finalGate, "delta-review",
    { base: reviewedAncestor, declaration, source, configurationSha256 });
  const bundle = { schemaVersion: 1, workspace: f.workspace, reviewedAncestor, declaration, source,
    ancestorReview, deltaReview, ancestorGate: ancestorGate.gateRun, finalGate: finalGate.gateRun };
  const prFixLineage = await save("bundle", bundle);
  const input = { ...f.request, head, hostConfiguration, deliveryPhase: "result", handover: ancestorReview,
    gateRun: ancestorGate.gateRun, attempt: { id: "ancestor-review" }, prFixLineage };
  const readiness = (await f.run("finish-readiness", input)).value;
  assert.equal(readiness.ready, true, JSON.stringify(readiness));
  const proof = readiness.prFixLineage;
  assert.equal(proof.reviewedAncestor, reviewedAncestor);
  assert.equal(readiness.reviewReference, proof.ancestorReview.reference);
  assert.equal(readiness.gateReference, finalGate.captured.value.wrapperSha256);
  assert.equal((await f.run("status", input)).value.state, "finish-ready");
  for (const [label, replacement] of [
    ["wrong-gate", { finalGate: ancestorGate.gateRun }],
    ["waiver", { declaration: await save("waived", { ...declarationValue,
      findings: [{ ...declarationValue.findings[0], disposition: "waived" }] }) }],
    ["postimage", { declaration: await save("missing-image", { ...declarationValue, postimages: {} }) }],
    ["unrelated", { declaration: await save("incomplete-range", { ...declarationValue, range: { ...range,
      edges: [{ ...range.edges[0], patch: "" }] } }) }],
    ["tampered-review", { deltaReview: { ...deltaReview, expectFileSha256: "0".repeat(64) } }],
  ]) {
    const bad = (await f.run("finish-readiness", { ...input, prFixLineage: await save(label, { ...bundle, ...replacement }) })).value;
    assert.equal(bad.predicate, "FULL_EXACT_HEAD_REVIEW_REQUIRED", JSON.stringify(bad));
  }
  const fullCheckout = path.join(f.root, "full-checkout");
  f.git(f.repo, "worktree", "add", "--detach", fullCheckout, head);
  const full = await containedHandover(retained, fullCheckout, head, finalGate, "full-review",
    { configurationSha256, goalDigest: f.planDigest });
  assert.equal((await f.run("finish-readiness", { ...input, prFixLineage: undefined, gateRun: finalGate.gateRun,
    handover: full, attempt: { id: "full-review" } })).value.ready, true);
  const identity = { repo: f.repo, workspace: f.workspace, repository: "Example/Fixture", branch: "change/" + change,
    change, candidate: head, policyRevision: f.base, targetRevision: f.base, target: "main", mode: f.policy.mode,
    plan: f.plan, planDigest: f.planDigest, issue };
  const now = Date.now();
  const deadline = new Date(now + 50000).toISOString();
  const grantReference = "fixture-finish";
  const bound = (fields) => ({ verified: true, reference: "synthetic", observedAt, identity, grantReference, ...fields });
  const grant = await save("finish-grant", bound({ schemaVersion: 1, kind: "protected-finish", reference: grantReference,
    startedAt: new Date(now - 40000).toISOString(), deadline, keepWorktree: false, uiDeclaration: null }));
  const anchor = await save("finish-anchor", bound({ kind: "finish-readiness-readback", ready: true, keepWorktree: false,
    implementationReview: { verified: true, ...proof.ancestorReview, head: reviewedAncestor },
    implementationGate: finalGate.gateRun, implementationGateSha256: proof.finalGate, prFixLineage,
    hostConfigurationSha256: configurationSha256 }));
  const finishCheckpoint = await save("finish-checkpoint", bound({ schemaVersion: 1, kind: "protected-finish-checkpoint",
    records, grant, anchor, deadline, keepWorktree: false, prs: { implementation: pullRequest, closure: null } }));
  const finishRemote = await save("finish-remote", bound({ implementation: bound({
    state: "OPEN", url: pullRequest, head: reviewedAncestor, complete: true, target: "main",
  }) }));
  const finish = (await f.run("finish", { repo: f.repo, change, head, finishCheckpoint, finishRemote })).value;
  assert.equal(finish.reason, "PR_HEAD_CHANGED", JSON.stringify(finish));
  assert.deepEqual(finish.prFixLineage, proof);
  const archive = "openspec/changes/archive/2026-11-26-" + change;
  const receiptPath = archive + "/evidence/receipt.json";
  const gates = (revision) => [{ command: "fixture gate", commit: revision, exitCode: 0, evidence: "retained fixture gate" }];
  const receipt = { schemaVersion: 1, change, issueUrl: issue, base: f.base, plan: f.plan, mode: f.policy.mode,
    planDigest: f.planDigest, head, integrated: head, verified: head, integrationReference: pullRequest, gates: gates(head),
    prFixLineage: proof, review: { schemaVersion: 1, change, issueUrl: issue, head: reviewedAncestor, planDigest: f.planDigest,
      verdict: "pass", findings: [], reviewer: proof.ancestorReview.session, reference: proof.ancestorReview.reference,
      gates: gates(reviewedAncestor) } };
  const receiptRef = await save("receipt", receipt);
  await mkdir(path.dirname(path.join(f.workspace, archive)));
  await rename(path.join(f.workspace, own), path.join(f.workspace, archive));
  await f.write(f.workspace, receiptPath, await readFile(receiptRef.file));
  const archived = f.commit(f.workspace, "Archive exact change and receipt");
  const guard = fileURLToPath(new URL("../skills/software-development/openspec-delivery/scripts/change-guard.mjs", import.meta.url));
  const args = [guard, "receipt", "--repo", f.workspace, "--change", change, "--target", archived,
    "--receipt", receiptRef.file, "--issue", issue, "--receipt-path", receiptPath];
  assert.equal(exec(process.execPath, args).status, 1);
  const replay = exec(process.execPath, [...args, "--pr-fix-lineage", prFixLineage.file, "--pr-fix-lineage-sha256", prFixLineage.sha256]);
  assert.equal(replay.status, 0, replay.stdout);
  assert.deepEqual(JSON.parse(replay.stdout).prFixLineage, proof);
  assert.throws(() => verifyPrFixIntegration({ repo: f.repo, plan: f.plan, head }, proof, head, reviewedAncestor), /ancestry/);
});
