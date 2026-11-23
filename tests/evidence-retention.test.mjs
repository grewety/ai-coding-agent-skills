import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { assessClaimSupport, createRepresentation, sealRepresentation, storedArtifactSha256, verifyRepresentation } from "../skills/software-development/openspec-delivery/scripts/evidence-retention.mjs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sha256 } from "../skills/software-development/openspec-delivery/scripts/evidence-cli.mjs";

const provenance = {
  source: "node --test fixture",
  command: ["node", "--test"],
  environmentScope: "synthetic fixture",
  exitStatus: 0,
  observedAt: "2026-11-10T00:00:00Z",
  revision: "0123456789abcdef0123456789abcdef01234567",
  scope: "synthetic fixture",
  pagination: "not-applicable",
  readbackType: "lossless-representation",
};

const labels = {
  representation: "lossless-representation",
  completeness: "not-applicable",
  confidentiality: "publishable",
};

const claim = (readbackType, pagination) => createRepresentation({
  original: Buffer.from("claim\n"),
  provenance: {
    ...provenance,
    readbackType,
    pagination,
    ...(readbackType === "historical-extract" ? { extractedAt: "2026-11-10T00:01:00Z" } : {}),
  },
  labels: { ...labels, representation: readbackType, completeness: pagination },
});
const expectedClaim = {
  mergedAt: "2026-11-10T12:00:00Z",
  expectedHead: "0123456789abcdef0123456789abcdef01234567",
  applicableCheckIds: ["build / test"],
};
const structuredClaim = ({
  readbackType = "original-response",
  pagination = "complete",
  observedAt = "2026-11-10T11:59:59.500Z",
  omitObservedAt = false,
  extractedAt,
  head = expectedClaim.expectedHead,
  checks = [{ id: "build / test", conclusion: "success", completedAt: "2026-11-10T11:59:59Z" }],
} = {}) => {
  const provenanceWithoutObservedAt = { ...provenance };
  delete provenanceWithoutObservedAt.observedAt;
  return createRepresentation({
  original: Buffer.from(JSON.stringify({ head, checks })),
  provenance: {
    ...provenanceWithoutObservedAt,
    readbackType,
    pagination,
    ...(omitObservedAt ? {} : { observedAt }),
    ...(extractedAt === undefined ? {} : { extractedAt }),
  },
  labels: { ...labels, representation: readbackType, completeness: pagination },
  });
};

test("represents UTF-8 CRLF bytes with trailing whitespace without normalization", () => {
  const original = Buffer.from("line one  \r\nline two\t\r\n", "utf8");
  const representation = createRepresentation({ original, provenance, labels });

  assert.equal(representation.encoding, "utf8");
  assert.equal(representation.content, "line one  \r\nline two\t\r\n");
  assert.deepEqual(verifyRepresentation(representation), original);
});

test("represents Unicode UTF-8 bytes losslessly", () => {
  const original = Buffer.from("snowman ☃ and café\n", "utf8");
  const representation = createRepresentation({ original, provenance, labels });

  assert.equal(representation.encoding, "utf8");
  assert.deepEqual(verifyRepresentation(representation), original);
});

test("round-trips empty and whitespace-only evidence bytes", () => {
  for (const original of [Buffer.alloc(0), Buffer.from("\r\n"), Buffer.from("  \t")]) {
    const representation = createRepresentation({ original, provenance, labels });
    assert.deepEqual(verifyRepresentation(representation), original);
  }
});

test("uses base64 for non-UTF-8 bytes and decodes the exact original", () => {
  const original = Buffer.from([0x00, 0xff, 0x80, 0x0a]);
  const representation = createRepresentation({ original, provenance, labels });

  assert.equal(representation.encoding, "base64");
  assert.deepEqual(verifyRepresentation(representation), original);
});

test("fails closed on a corrupted stored or decoded hash", () => {
  const representation = createRepresentation({ original: Buffer.from("evidence\n"), provenance, labels });

  assert.throws(() => verifyRepresentation({ ...representation, storedArtifactSha256: "0".repeat(64) }), /wrapper SHA-256 mismatch/i);
  assert.throws(() => verifyRepresentation({ ...representation, decodedOriginalSha256: "0".repeat(64) }), /wrapper SHA-256 mismatch/i);
});

test("fails closed when immutable wrapper metadata changes", () => {
  const representation = createRepresentation({ original: Buffer.from("evidence\n"), provenance, labels });

  assert.match(representation.wrapperSha256, /^[a-f0-9]{64}$/);
  assert.throws(() => verifyRepresentation({ ...representation, provenance: { ...provenance, scope: "changed" } }), /wrapper SHA-256 mismatch/i);
  assert.throws(() => verifyRepresentation({ ...representation, labels: { ...labels, confidentiality: "restricted" } }), /wrapper SHA-256 mismatch/i);
  assert.throws(() => verifyRepresentation({ ...representation, encoding: "base64" }), /wrapper SHA-256 mismatch/i);
  assert.throws(() => verifyRepresentation({ ...representation, content: "changed" }), /wrapper SHA-256 mismatch/i);
});

test("requires truthful labels and structured gate provenance", () => {
  assert.throws(
    () => createRepresentation({ original: Buffer.from("evidence\n"), provenance, labels: { ...labels, representation: "original-byte-copy" } }),
    /labels\.representation/i,
  );
  assert.throws(
    () => createRepresentation({ original: Buffer.from("evidence\n"), provenance, labels: { ...labels, confidentiality: "unknown" } }),
    /labels\.confidentiality/i,
  );
  assert.throws(
    () => createRepresentation({ original: Buffer.from("evidence\n"), provenance: { ...provenance, command: [] }, labels }),
    /provenance\.command/i,
  );
  assert.throws(
    () => createRepresentation({ original: Buffer.from("evidence\n"), provenance: { ...provenance, exitStatus: "0" }, labels }),
    /provenance\.exitStatus/i,
  );
  assert.throws(
    () => createRepresentation({ original: Buffer.from("evidence\n"), provenance: { ...provenance, pagination: "unknown" }, labels }),
    /provenance\.pagination/i,
  );
});

test("derives claim limits from verified representations", () => {
  assert.equal(assessClaimSupport({ representation: claim("original-response", "partial"), ...expectedClaim }), "blocked");
  assert.equal(assessClaimSupport({ representation: claim("fresh-corroboration", "complete"), ...expectedClaim }), "blocked");
  assert.equal(assessClaimSupport({ representation: claim("merge-snapshot", "complete"), ...expectedClaim }), "blocked");
  assert.equal(assessClaimSupport({ representation: claim("historical-extract", "complete"), ...expectedClaim }), "blocked");
});

test("supports only verified structured PR-check payloads with source-capture semantics", () => {
  assert.equal(assessClaimSupport({ representation: structuredClaim({ observedAt: "2026-11-10T12:00:00Z" }), ...expectedClaim }), "blocked");
  assert.equal(assessClaimSupport({ representation: structuredClaim(), ...expectedClaim }), "supported");
  assert.equal(assessClaimSupport({ representation: structuredClaim({ readbackType: "historical-extract", extractedAt: "2026-11-10T12:01:00Z" }), ...expectedClaim }), "supported");
  assert.equal(assessClaimSupport({ representation: structuredClaim({ readbackType: "fresh-corroboration" }), ...expectedClaim }), "narrowed");
  assert.throws(() => structuredClaim({ readbackType: "historical-extract" }), /extractedAt/i);
  assert.equal(assessClaimSupport({ representation: structuredClaim({ readbackType: "historical-extract", omitObservedAt: true, extractedAt: "2026-11-10T12:01:00Z" }), ...expectedClaim }), "blocked");
  assert.equal(assessClaimSupport({ representation: structuredClaim({ head: "ffffffffffffffffffffffffffffffffffffffff" }), ...expectedClaim }), "blocked");
  assert.equal(assessClaimSupport({ representation: structuredClaim({ checks: [{ id: "build / test", conclusion: "failure", completedAt: "2026-11-10T11:59:59Z" }] }), ...expectedClaim }), "blocked");
  assert.equal(assessClaimSupport({ representation: structuredClaim({ checks: [{ id: "build / test", conclusion: "unknown", completedAt: "2026-11-10T11:59:59Z" }] }), ...expectedClaim }), "blocked");
  assert.equal(assessClaimSupport({ representation: structuredClaim({ checks: [{ id: "build / test", conclusion: "failure", completedAt: "2026-11-10T11:59:59Z" }] }), ...expectedClaim, completionTimes: ["2026-11-10T11:59:59Z"] }), "blocked");
});

test("narrows only validated structured partial, fresh, and merge readbacks", () => {
  assert.equal(assessClaimSupport({ representation: structuredClaim({ pagination: "partial" }), ...expectedClaim }), "narrowed");
  assert.equal(assessClaimSupport({ representation: structuredClaim({ pagination: "partial", observedAt: "2026-11-10T12:00:00.000Z" }), ...expectedClaim }), "blocked");
  assert.equal(assessClaimSupport({ representation: structuredClaim({ pagination: "partial", checks: [{ id: "build / test", conclusion: "success", completedAt: "2026-11-10T12:00:00.000Z" }] }), ...expectedClaim }), "blocked");
  assert.equal(assessClaimSupport({ representation: structuredClaim({ pagination: "partial", checks: [] }), ...expectedClaim }), "blocked");
  assert.equal(assessClaimSupport({ representation: structuredClaim({ pagination: "partial", checks: [{ id: "build / test", conclusion: "success", completedAt: "2026-11-10T11:59:59Z" }, { id: "build / test", conclusion: "success", completedAt: "2026-11-10T11:59:59Z" }] }), ...expectedClaim }), "blocked");
  assert.equal(assessClaimSupport({ representation: structuredClaim({ readbackType: "fresh-corroboration" }), ...expectedClaim }), "narrowed");
  assert.equal(assessClaimSupport({ representation: structuredClaim({ readbackType: "merge-snapshot" }), ...expectedClaim }), "narrowed");
  assert.equal(assessClaimSupport({ representation: structuredClaim({ readbackType: "fresh-corroboration", pagination: "partial" }), ...expectedClaim }), "blocked");
  assert.equal(assessClaimSupport({ representation: structuredClaim({ readbackType: "merge-snapshot", checks: [{ id: "build / test", conclusion: "failure", completedAt: "2026-11-10T11:59:59Z" }] }), ...expectedClaim }), "blocked");
});

test("blocks historical check claims with missing, ambiguous, or post-merge completion evidence", () => {
  const historical = (changes = {}) => structuredClaim({ readbackType: "historical-extract", extractedAt: "2026-11-10T12:01:00Z", ...changes });
  assert.equal(assessClaimSupport({ representation: historical({ pagination: "partial" }), ...expectedClaim }), "blocked");
  assert.equal(assessClaimSupport({ representation: historical(), mergedAt: "2026-11-10T12:00:00" }), "blocked");
  assert.equal(assessClaimSupport({ representation: historical({ checks: [{ id: "build / test", conclusion: "success", completedAt: "2026-11-10T12:00:00Z" }] }), ...expectedClaim }), "blocked");
  assert.equal(assessClaimSupport({ representation: historical({ checks: [{ id: "build / test", conclusion: "success", completedAt: "2026-02-30T11:59:59Z" }] }), ...expectedClaim }), "blocked");
});

test("requires provenance, completeness, and confidentiality labels", () => {
  assert.throws(
    () => createRepresentation({ original: Buffer.from("evidence\n"), provenance: { ...provenance, scope: "" }, labels }),
    /provenance\.scope/i,
  );
  assert.throws(
    () => createRepresentation({ original: Buffer.from("evidence\n"), provenance, labels: { ...labels, completeness: "" } }),
    /labels\.completeness/i,
  );
  assert.throws(
    () => createRepresentation({ original: Buffer.from("evidence\n"), provenance, labels: { ...labels, confidentiality: "" } }),
    /labels\.confidentiality/i,
  );
});

test("rejects unverified wrapper fields and malformed encoded representations", () => {
  const representation = createRepresentation({ original: Buffer.from("evidence\n"), provenance, labels });
  assert.throws(() => verifyRepresentation({ ...representation, originalByteCopy: true }), /unknown representation field/i);
  assert.throws(() => verifyRepresentation({ ...representation, encoding: "rot13" }), /wrapper SHA-256 mismatch|unsupported encoding/i);
  assert.throws(() => verifyRepresentation({ ...representation, encoding: "base64", content: "?" }), /wrapper SHA-256 mismatch|base64 content is invalid/i);
});

test("requires readback type and coherent completeness semantics", () => {
  assert.throws(
    () => createRepresentation({ original: Buffer.from("evidence\n"), provenance: { ...provenance, readbackType: "historical-extract", extractedAt: "2026-11-10T00:01:00Z" }, labels: { ...labels, completeness: "complete" } }),
    /readback type|pagination|completeness/i,
  );
});

test("rejects re-sealed deserialized provenance, label, and redaction mismatches", () => {
  const representation = createRepresentation({
    original: Buffer.from("evidence\n"),
    provenance: { ...provenance, readbackType: "original-response", pagination: "complete" },
    labels: { ...labels, representation: "original-response", completeness: "complete" },
  });
  const reseal = (changes) => {
    const candidate = { ...representation, ...changes };
    return { ...candidate, wrapperSha256: sealRepresentation(candidate) };
  };

  assert.throws(
    () => verifyRepresentation(reseal({ provenance: { ...representation.provenance, readbackType: "fresh-corroboration" } })),
    /readback type must match labels\.representation/i,
  );
  assert.throws(
    () => verifyRepresentation(reseal({ provenance: { ...representation.provenance, pagination: "partial" } })),
    /pagination must match labels\.completeness/i,
  );
  assert.throws(
    () => verifyRepresentation(reseal({
      provenance: { ...representation.provenance, readbackType: "redacted-transformed" },
      labels: { ...representation.labels, representation: "redacted-transformed" },
    })),
    /redacted-transformed.*redacted/i,
  );
  assert.throws(
    () => verifyRepresentation(reseal({ labels: { ...representation.labels, confidentiality: "redacted" } })),
    /redacted.*redacted-transformed/i,
  );
});

test("requires strict UTC observation, merge, and completion instants", () => {
  for (const observedAt of ["", "2026-02-30T00:00:00Z", "2026-11-10T24:00:00Z", "2026-11-10T00:00:00.1234Z"]) {
    assert.throws(
      () => createRepresentation({ original: Buffer.from("evidence\n"), provenance: { ...provenance, observedAt }, labels }),
      /provenance\.observedAt/i,
    );
  }

  const representation = claim("historical-extract", "complete");
  for (const timestamp of ["2026-02-30T12:00:00Z", "2026-11-10T24:00:00Z", "2026-11-10T12:00:00.1234Z"]) {
    assert.equal(
      assessClaimSupport({ representation, mergedAt: timestamp, completionTimes: ["2026-11-10T11:59:59Z"] }),
      "blocked",
    );
    assert.equal(
      assessClaimSupport({ representation, mergedAt: "2026-11-10T12:00:00Z", completionTimes: [timestamp] }),
      "blocked",
    );
  }
});

test("blocks unsupported claims for failed, confidential, missing, or post-merge evidence", () => {
  const factual = ({ exitStatus = 0, confidentiality = "publishable", readbackType = "original-response" } = {}) => createRepresentation({
    original: Buffer.from("claim\n"),
    provenance: {
      ...provenance,
      exitStatus,
      readbackType,
      pagination: "complete",
      ...(readbackType === "historical-extract" ? { extractedAt: "2026-11-10T00:01:00Z" } : {}),
    },
    labels: { ...labels, representation: readbackType, completeness: "complete", confidentiality },
  });

  assert.equal(assessClaimSupport({ representation: factual({ exitStatus: 1 }), ...expectedClaim }), "blocked");
  assert.equal(assessClaimSupport({ representation: factual({ confidentiality: "restricted" }), ...expectedClaim }), "blocked");
  assert.equal(assessClaimSupport({ representation: factual({ readbackType: "redacted-transformed", confidentiality: "redacted" }), ...expectedClaim }), "blocked");
  assert.equal(assessClaimSupport({ representation: factual() }), "blocked");
  for (const readbackType of ["original-response", "historical-extract", "fresh-corroboration", "merge-snapshot"]) {
    assert.equal(
      assessClaimSupport({
        representation: factual({ readbackType }),
        mergedAt: "2026-11-10T12:00:00Z",
        completionTimes: ["2026-11-10T12:00:00Z"],
      }),
      "blocked",
    );
  }
});

test("rejects unknown nested provenance and label fields", () => {
  assert.throws(
    () => createRepresentation({ original: Buffer.from("evidence\n"), provenance: { ...provenance, claimedOriginal: true }, labels }),
    /unknown provenance field/i,
  );
  assert.throws(
    () => createRepresentation({ original: Buffer.from("evidence\n"), provenance, labels: { ...labels, claim: "complete" } }),
    /unknown labels field/i,
  );
});

test("reaches direct hash and decoding failure paths after resealing", () => {
  const representation = createRepresentation({ original: Buffer.from([0xff]), provenance, labels });
  const reseal = (changes) => {
    const candidate = { ...representation, ...changes };
    return { ...candidate, wrapperSha256: sealRepresentation(candidate) };
  };
  assert.throws(() => verifyRepresentation(reseal({ storedArtifactSha256: "0".repeat(64) })), /stored artifact SHA-256 mismatch/i);
  assert.throws(() => verifyRepresentation(reseal({ decodedOriginalSha256: "0".repeat(64) })), /decoded original SHA-256 mismatch/i);
  assert.throws(() => verifyRepresentation(reseal({ content: "?", storedArtifactSha256: storedArtifactSha256("?") })), /base64 content is invalid/i);
  assert.throws(() => verifyRepresentation(reseal({ encoding: "rot13", storedArtifactSha256: storedArtifactSha256(representation.content) })), /unsupported encoding/i);
});

test("derives claim limits from a verified representation and refuses free inputs", () => {
  assert.equal(assessClaimSupport({ representation: claim("fresh-corroboration", "complete"), ...expectedClaim }), "blocked");
  assert.throws(() => assessClaimSupport({ kind: "fresh-corroboration", pagination: "complete" }), /representation/i);
});

const cli = fileURLToPath(new URL("../skills/software-development/openspec-delivery/scripts/evidence-cli.mjs", import.meta.url));
async function evidenceFixture(t) {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), "lossless-cli-")));
  t.after(() => rm(root, { recursive: true, force: true }));
  let index = 0;
  const save = async (name, value) => {
    const file = path.join(root, name);
    const bytes = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value));
    await writeFile(file, bytes);
    return { file, sha256: sha256(bytes) };
  };
  const run = async (command, value) => {
    const request = await save(`request-${++index}.json`, value);
    const result = spawnSync(process.execPath, [cli, command, "--input", request.file], {
      encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    });
    assert.equal(result.error, undefined);
    return { status: result.status, value: JSON.parse(result.stdout) };
  };
  return { root, save, run };
}

test("evidence CLI captures both byte streams, the literal argv and a failed exit", async (t) => {
  const { root, save, run } = await evidenceFixture(t);
  const cwd = path.join(root, "checkout");
  await mkdir(cwd);
  const output = path.join(root, "capture.json");
  const bytes = Buffer.from([0xff, 0x00, 0x0d, 0x0a]);
  const argv = [process.execPath, "-e", "const fs=require('node:fs');fs.writeSync(1,Buffer.from([255,0,13,10]));fs.writeSync(2,'error\\r\\n');process.exitCode=7", ""];
  const captured = await run("capture", { cwd, output, argv, timeoutMs: 5_000, scope: "synthetic gate", environmentScope: "fixture-clean" });
  assert.equal(captured.status, 1);
  assert.equal(captured.value.exitStatus, 7);
  const record = JSON.parse(await readFile(output, "utf8"));
  assert.deepEqual(record.argv, argv);
  assert.deepEqual(verifyRepresentation(record.stdout), bytes);
  assert.deepEqual(verifyRepresentation(record.stderr), Buffer.from("error\r\n"));
  assert.equal(record.stdout.decodedOriginalSha256, sha256(bytes));
  assert.equal(new Date(record.observedAt).toISOString(), record.observedAt);
  const pin = { file: output, sha256: captured.value.fileSha256 };
  assert.deepEqual((await run("verify", pin)).value, { ok: true, passed: false, revision: null, fileSha256: pin.sha256 });
  const altered = await save("altered", { ...record, exitStatus: 0 });
  assert.match((await run("verify", altered)).value.error, /provenance/);
  await writeFile(output, (await readFile(output)).subarray(0, -3));
  assert.match((await run("verify", pin)).value.error, /identity/);
});

test("evidence CLI seals original bytes and verifies independently pinned identity", async (t) => {
  const { root, save, run } = await evidenceFixture(t);
  const original = await save("original", Buffer.from([0x80, 0xff, 0x0a]));
  const output = path.join(root, "sealed.json");
  const sealed = await run("seal", { original: original.file, provenance, labels, output });
  assert.equal(sealed.status, 0, JSON.stringify(sealed));
  const pin = { file: output, sha256: sealed.value.fileSha256 };
  const verified = await run("verify", pin);
  assert.deepEqual(verified.value, { ok: true, fileSha256: pin.sha256, wrapperSha256: sealed.value.wrapperSha256,
    originalSha256: original.sha256, revision: provenance.revision });
  assert.equal((await run("seal", { original: original.file, provenance, labels, output })).status, 1);
  const wrong = await save("wrong.json", { ...JSON.parse(await readFile(output)), decodedOriginalSha256: "0".repeat(64) });
  assert.match((await run("verify", wrong)).value.error, /wrapper SHA-256 mismatch/);
});

test("offline GitHub readbacks prove current and historical predicates with original evidence references", async (t) => {
  const { save, run } = await evidenceFixture(t);
  const pullRequest = "https://github.com/example/project/pull/12";
  const head = expectedClaim.expectedHead;
  const integrated = "b".repeat(40);
  const verifiedRevision = "c".repeat(40);
  const observedNotBefore = "2026-11-10T11:00:00Z";
  const mergedAt = "2026-11-10T12:00:00Z";
  const check = { id: "ci", head, conclusion: "success", completedAt: "2026-11-10T11:59:40Z" };
  const issue = "https://github.com/example/project/issues/4";
  const archive = "openspec/changes/archive/2026-11-10-example";
  const receiptSha256 = "e".repeat(64);
  const source = { pr: "github-pull-request", checks: "github-applicable-checks", checkRuns: "github-check-runs", threads: "github-review-threads", closure: "github-closure-readback" };
  const pin = (key, payload, options = {}) => save(`${key}-${Object.keys(options).length}-${sha256(JSON.stringify(payload)).slice(0, 8)}.json`,
    createRepresentation({ original: Buffer.from(JSON.stringify({ pullRequest, head, ...payload })),
      provenance: { ...provenance, source: source[key], scope: pullRequest, revision: head,
        readbackType: "original-response", pagination: "complete", observedAt: "2026-11-10T11:59:50Z", ...options },
      labels: { ...labels, representation: options.readbackType ?? "original-response", completeness: options.pagination ?? "complete" } }));
  const readbacks = {
    pr: await pin("pr", { state: "OPEN", mergedAt: null }),
    checks: await pin("checks", { checks: [check] }),
    checkRuns: await pin("checkRuns", { checks: [check] }),
    threads: await pin("threads", { threads: [{ id: "r1", resolved: true }] }),
  };
  const request = { pullRequest, expectedHead: head, applicableCheckIds: ["ci"], observedNotBefore, readbacks };
  const assertReadback = async (change, predicate) => {
    const result = await run("assert-closeout", { ...request, readbacks: { ...readbacks, ...change } });
    assert.equal(result.status, 1, JSON.stringify(result));
    assert.equal(result.value.predicate, predicate);
  };
  const ready = (await run("assert-closeout", request)).value;
  assert.deepEqual(ready.assertions.map((entry) => entry.predicate), ["EXACT_PR_HEAD", "APPLICABLE_CHECKS_PASSED", "REVIEW_THREADS_RESOLVED"]);
  assert.ok(ready.assertions.every((entry) => entry.sources.every((ref) => /^[a-f0-9]{64}$/.test(ref.wrapperSha256))));
  assert.deepEqual(ready.pending, ["PROTECTED_MERGE_PENDING", "CLOSURE_PREDICATES_PENDING"]);
  await assertReadback({ pr: await pin("pr", { head: "a".repeat(40), state: "OPEN", mergedAt: null }) }, "PR_IDENTITY_OR_STATE");
  await assertReadback({ checks: await pin("checks", { checks: [check] }, { pagination: "partial" }) }, "APPLICABLE_CHECKS_INCOMPLETE_OR_FAILED");
  await assertReadback({ checkRuns: await pin("checkRuns", { checks: [{ ...check, head: "a".repeat(40) }] }) }, "CHECK_RUNS_INCOMPLETE_OR_STALE");
  await assertReadback({ threads: await pin("threads", { threads: [{ id: "r1", resolved: false }] }) }, "REVIEW_THREADS_INCOMPLETE_OR_UNRESOLVED");
  const afterMerge = { observedAt: "2026-11-10T12:01:00Z" };
  readbacks.pr = await pin("pr", { state: "MERGED", mergedAt, mergeCommit: integrated }, afterMerge);
  readbacks.closure = await pin("closure", { integrated, verifiedRevision, archive, issue, receiptSha256, issueState: "CLOSED", recordOnly: true }, afterMerge);
  const closureExpected = { verifiedRevision, issue, archive, receiptSha256 };
  const closed = { ...request, mergedAt, closureExpected };
  assert.equal((await run("assert-closeout", closed)).value.assertions.at(-1).predicate, "CLOSURE_PREDICATES_MET");
  const stale = await pin("checks", { checks: [check] }, { ...afterMerge, readbackType: "fresh-corroboration" });
  assert.equal((await run("assert-closeout", { ...closed, readbacks: { ...readbacks, checks: stale } })).value.predicate,
    "HISTORICAL_CHECK_CLAIM_UNSUPPORTED");
  assert.equal((await run("assert-closeout", { ...closed, closureExpected: { ...closureExpected, receiptSha256: "0".repeat(64) } })).value.predicate,
    "CLOSURE_PREDICATES_UNVERIFIED");
});

test("capture retains partial bytes and refuses timed-out commands as complete evidence", async (t) => {
  const { root, run } = await evidenceFixture(t);
  const cwd = path.join(root, "checkout");
  await mkdir(cwd);
  const output = path.join(root, "interrupted.json");
  const argv = [process.execPath, "-e", "require('node:fs').writeSync(1,'before wait');setTimeout(()=>{},30000)"];
  const captured = await run("capture", { cwd, output, argv, timeoutMs: 500, scope: "synthetic gate", environmentScope: "fixture-clean" });
  assert.equal(captured.status, 1);
  const record = JSON.parse(await readFile(output, "utf8"));
  assert.equal(record.interruption, "TIMEOUT");
  assert.equal(record.stdout.labels.completeness, "partial");
  assert.equal(verifyRepresentation(record.stdout).toString(), "before wait");
  const verified = await run("verify", { file: output, sha256: captured.value.fileSha256 });
  assert.equal(verified.status, 1);
  assert.equal(verified.value.passed, false);
});
