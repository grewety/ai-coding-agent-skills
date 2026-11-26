import path from "node:path";
import { ancestor, candidate, changedFiles, committedPostimages, goalSnapshot, planning, policyContext, prFixRange } from "./change-guard.mjs";
import { withinScope } from "./delivery-control.mjs";
import { readBounded, scopedPath, separate, sha256, verifyGateRun, verifyRepresentation } from "./evidence-retention.mjs";
import { need, privateRecords, same, text } from "./operator-records.mjs";
import { safePlanningPath } from "./planning-inventory.mjs";

const digest = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const decoder = new TextDecoder("utf-8", { fatal: true });
const canonicalPr = /^https:\/\/github\.com\/[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+\/pull\/[1-9][0-9]*$/;
const retained = (ref, limit) => {
  const bytes = readBounded(ref?.file, limit);
  need(digest(ref.sha256) && sha256(bytes) === ref.sha256, "PR-fix evidence seal mismatch");
  return JSON.parse(decoder.decode(bytes));
};
const fields = (value, keys) => value && same(Object.keys(value).sort(), [...keys].sort());

export function readPrFixBundle(ref, repo, workspace, records) {
  const bundle = retained(ref, 1024 * 1024);
  need(fields(bundle, ["schemaVersion", "workspace", "reviewedAncestor", "ancestorGate", "finalGate",
    "ancestorReview", "deltaReview", "declaration", "source"]) && bundle.schemaVersion === 1 &&
    (workspace === undefined || bundle.workspace === workspace) && path.isAbsolute(bundle.workspace) &&
    path.normalize(bundle.workspace) === bundle.workspace, "Invalid PR-fix evidence bundle");
  const root = privateRecords(records ?? path.dirname(ref.file), [repo, bundle.workspace]);
  const paths = (review) => ["request", "expect", "exportDirectory", "output"].map((key) => review?.[key]);
  for (const file of [ref.file, bundle.declaration.file, bundle.source.file, bundle.ancestorGate.file, bundle.finalGate.file,
    ...paths(bundle.ancestorReview), ...paths(bundle.deltaReview)]) {
    need(scopedPath(file).startsWith(root + path.sep), "PR-fix evidence is outside retained records");
  }
  return bundle;
}

function verifySource(ref, input, range, declaration, expectedPr) {
  const source = retained(ref, 1024 * 1024);
  const record = JSON.parse(decoder.decode(verifyRepresentation(source)));
  const { provenance } = source;
  const { pullRequest, head, checks } = record;
  need(canonicalPr.test(pullRequest) && (expectedPr === undefined || pullRequest === expectedPr) &&
    provenance.scope === pullRequest && provenance.revision === head && head === range.reviewedAncestor &&
    provenance.source === "github-check-runs" && provenance.exitStatus === 0 && provenance.pagination === "complete" &&
    provenance.readbackType === "original-response" &&
    Array.isArray(checks) && checks.every((check) => check.head === head && text(check.id)) &&
    new Set(checks.map((check) => check.id)).size === checks.length,
  "PR-fix reasons lack exact original check evidence");
  need(declaration.pullRequest === pullRequest && declaration.change === input.change &&
    declaration.plan === input.plan && declaration.planDigest === input["expect-plan"] &&
    declaration.sourceSha256 === ref.sha256 && same(declaration.range, range),
  "PR-fix declaration differs from the approved plan or exact Git range");
  const findings = declaration.findings;
  need(Array.isArray(findings) && findings.length > 0 && new Set(findings.map(({ id }) => id)).size === findings.length &&
    findings.every((finding) => fields(finding, ["id", "kind", "reason", "disposition", "files"]) &&
      ["security", "ci"].includes(finding.kind) && text(finding.reason) && finding.disposition === "fixed" &&
      checks.some((check) => check.id === finding.id && ["failure", "action_required"].includes(check.conclusion)) &&
      Array.isArray(finding.files) && finding.files.length && new Set(finding.files).size === finding.files.length &&
      finding.files.every((file) => range.files.includes(file))) &&
    same([...new Set(findings.flatMap(({ files }) => files))].sort(), range.files),
  "PR-fix findings are unresolved, waived or omit changed paths");
  return pullRequest;
}

function checkReview(handoff, snapshot, context, gate, base, host, kind) {
  const { result, request, reviewSnapshot: review } = handoff;
  const id = result.identity;
  const session = result.runtime.session;
  need(handoff.phase === "complete" && result.status === "completed" && result.verdict === "no_findings" &&
    result.nativeVerdict === "Verdict: No findings" && result.findings.length === 0 &&
    result.coverageLimitations.length === 0 && result.waivers === undefined &&
    result.runtime.readOnly === true && text(session) && text(id.implementerSession) &&
    ![id.implementerSession, request.authority.authorSession, request.authority.orchestrator,
      request.authority.writer].includes(session) &&
    review.base === base && review.target === snapshot.head && id.candidate === snapshot.head &&
    id.change === context.change && review.plan === snapshot.plan && review.planDigest === context.planDigest &&
    same(id.inputs, context.inputs) && handoff.reviewPolicyBinding?.parent === context.parent &&
    handoff.reviewPolicyBinding.target === context.target && handoff.reviewConfigurationSha256 === host &&
    request.acceptance.includes(`gate-run:${gate.reference}`), `Invalid zero-waiver PR-fix ${kind} review`);
  return { session, reference: result.report.sha256 };
}

export async function verifyPrFixLineage(input, ref, verifyHandover, options = {}) {
  need(typeof verifyHandover === "function", "PR-fix lineage requires sealed review replay");
  const { repo, change, head, plan, mode, target } = input;
  const bundle = readPrFixBundle(ref, repo, options.workspace, options.records);
  const context = policyContext({ repo, change, plan, target });
  const range = prFixRange(repo, bundle.reviewedAncestor, head);
  const active = `openspec/changes/${change}/`;
  need(range.files.every((file) => !file.startsWith(active) && file !== "openspec/config.yaml"),
    "PR-fix lineage cannot change frozen planning inputs or native task progress");
  const final = candidate(input, false);
  const original = candidate({ ...input, head: range.reviewedAncestor }, false);
  need(context.lowTouch && original.tasksComplete && final.tasksComplete && original.planDigest === final.planDigest,
    "PR-fix lineage needs an applicable integrated parent and completed native tasks");
  const declaration = retained(bundle.declaration, 65536);
  need(fields(declaration, ["schemaVersion", "change", "plan", "planDigest", "sourceSha256", "pullRequest",
    "range", "findings", "impacted", "postimages"]) && declaration.schemaVersion === 1, "Invalid PR-fix declaration");
  const pullRequest = verifySource(bundle.source, input, range, declaration, options.pullRequest);
  const impacted = declaration.impacted;
  need(Array.isArray(impacted) && impacted.length <= 256 && same(impacted, [...new Set(impacted)].sort()) &&
    impacted.every((file) => safePlanningPath(file) && !file.startsWith(active) && !range.files.includes(file)),
  "Invalid impacted postimage inventory");
  const coverage = [...range.files, ...impacted].sort();
  const postimages = committedPostimages(repo, head, coverage);
  need(same(postimages, declaration.postimages) && impacted.every((file) => postimages[file]),
    "PR-fix postimages are missing or changed");
  const gate = (ref, snapshot, gates) => {
    const run = verifyGateRun(retained(ref), { implementation: bundle.workspace, head: snapshot.head, tree: snapshot.tree,
      mode, change, plan, planDigest: snapshot.planDigest, gates });
    need(run.passed, "PR-fix disposable gates failed");
    return run;
  };
  const { gateAuthority, acceptedAncestorGate } = options;
  const taskGuided = mode === "task-guided";
  if (taskGuided) {
    need(digest(gateAuthority?.ancestorGate ?? acceptedAncestorGate), "Missing approved Task-Guided PR-fix gate authority");
  }
  const declaredGates = taskGuided ? gateAuthority?.gates :
    goalSnapshot(repo, head, change, context.parent, planning(repo, head, change, true)).contract.gates;
  const originalGate = gate(bundle.ancestorGate, original, declaredGates);
  // Readiness has already checked the accepted wrapper against the approved
  // group. Later replay requires the independently retained readiness record.
  const authority = taskGuided ? { schemaVersion: 1, kind: "task-guided-pr-fix-gates", change, plan,
    planDigest: original.planDigest, policyTarget: target, workspace: bundle.workspace, reviewedAncestor: original.head,
    ancestorGate: originalGate.reference, gates: originalGate.gateCommands } : undefined;
  if (taskGuided) {
    need(gateAuthority ? same(gateAuthority, authority) : acceptedAncestorGate === originalGate.reference,
      "Task-Guided PR-fix gate authority differs from the accepted ancestor");
  }
  const finalGate = gate(bundle.finalGate, final, originalGate.gateCommands);
  const { ancestorReview, deltaReview } = bundle;
  need([ancestorReview, deltaReview].every((review) => review.kind === "review-candidate" &&
    digest(review.expectFileSha256) && digest(review.requestFileSha256) && review.waivers === undefined) &&
    ancestorReview.verifier === deltaReview.verifier && ancestorReview.verifierSha256 === deltaReview.verifierSha256,
  "PR-fix reviews need matching verifier pins and independent expectation seals");
  const parent = await verifyHandover(ancestorReview);
  const delta = await verifyHandover(deltaReview);
  const host = options.hostConfigurationSha256 ?? parent.reviewConfigurationSha256;
  need(digest(host) && !parent.reviewSnapshot.prFix &&
    [parent, delta].every((review) => [repo, bundle.workspace].every((root) => separate(root, review.result.identity.workspace))) &&
    range.files.every((file) => withinScope(file, parent.request.scope)) &&
    ["approvalReference", "executionReference", "authorSession", "orchestrator", "writer"]
      .every((key) => parent.request.authority[key] === delta.request.authority[key]) &&
    ["group", "task", "action"].every((key) => parent.result.identity[key] === delta.result.identity[key]) &&
    (mode !== "goal-first" || [parent, delta].every((review) =>
      review.request.acceptance.includes(`goal-contract:${final.planDigest}`))),
  "PR-fix scope, review isolation or retained authority differs");
  const reviewed = checkReview(parent, original, context, originalGate, plan, host, "ancestor");
  const reReview = checkReview(delta, final, context, finalGate, original.head, host, "delta");
  const special = delta.reviewSnapshot.prFix;
  need(special && same(special.impacted, impacted) &&
    delta.reviewAttachments[special.declaration] === bundle.declaration.sha256 &&
    delta.reviewAttachments[special.source] === bundle.source.sha256 &&
    reviewed.session !== reReview.session && reviewed.session !== delta.result.identity.implementerSession &&
    reReview.session !== parent.result.identity.implementerSession,
  "Independent exact-delta scope and impacted postimage determination is missing");
  const proof = { schemaVersion: 1, bundleSha256: ref.sha256, reviewedAncestor: original.head, head, pullRequest, policyTarget: target,
    revisions: range.edges.map(({ revision }) => revision), impacted, declarationSha256: bundle.declaration.sha256,
    ancestorReview: reviewed, deltaReview: reReview, ancestorGate: originalGate.reference, finalGate: finalGate.reference };
  return { proof, gateAuthority: authority };
}

export function verifyPrFixIntegration(input, proof, integrated, verified) {
  const { repo, plan, head } = input;
  ancestor(repo, proof.reviewedAncestor, head);
  ancestor(repo, head, integrated);
  ancestor(repo, integrated, verified);
  // Carry forward the original full review only where integrated trees preserve its coverage.
  const reviewedPaths = [...new Set([...changedFiles(repo, plan, proof.reviewedAncestor),
    ...changedFiles(repo, proof.reviewedAncestor, head), ...proof.impacted])];
  const expected = committedPostimages(repo, head, reviewedPaths);
  for (const revision of new Set([integrated, verified])) {
    need(same(committedPostimages(repo, revision, reviewedPaths), expected),
      "Integrated history changed a reviewed PR-fix postimage");
  }
}
