# Integrated low-touch delivery

Read the root contract at the frozen plan's verified integrated parent.
Only a top-level `<!-- openspec-low-touch: {} -->` marker selects this policy.
Legacy plans and sealed reviews retain their original interpretation.
The marker can carry `mode`, `phases`, `maxReviews`, `maxTotalUsd` and
`standingTriggers`. Defaults are `auto-approved`, all of
`["planning","execution","finish"]`, 10 reviews and USD 25 per change,
and an empty standing list. The file is authoritative only for a verified
integrated parent. A candidate marker confers no authority for its own change.

## Planning and approved identity

Run native status and apply instructions in the actual change worktree.
Retain their JSON as `status` and `instructions` in the sealed validation
record, together with the complete planning `inputs` and `modes`.
Match every completed native artifact and all apply context files against
the bounded draft inventory. Retain the raw inventory for independent
approach review, including the file modes for adopting drafts. Recheck it
before committing and when emitting the approval card. The schema may
produce safe regular inputs at any supported relative path under its
change root. Exclude its root `evidence/` and hidden paths other than the
root `.openspec.yaml`. Excluded files never enter the provider export.
Commit only the admitted plan paths. The guard rejects aliases, symlinks,
submodules, non-regular inputs and incomplete scan or budget evidence.

The command `planning-worktree` takes `--parent` and `--target` together for
adopting drafts. Committed `planning` takes the exact `--plan` and verified
integrated `--target` together. Without these observations the standalone
inventory commands keep the legacy interpretation. The normalized Task-Guided
digest hashes included paths, modes and bytes, with only real native task
checkbox state normalized. The adopting Goal-First identity also binds each
path, mode and normalized hash. The raw inventory still identifies exact
bytes for planning review and mode-bound approval. For closure, preserve
the full relative layout and Git modes, including custom artifacts.

## Exact task child

For an adopted finish candidate whose direct parent has the accepted
contained zero-waiver result, retain `taskCompletion.reviewedParent` and
`taskCompletion.childGate` (a sealed `{file, sha256}` reference) in the
normal `finish-readiness` input. Keep the parent handover and its gate run
in the regular `handover` and `gateRun` fields. Use the child's actual SHA
in `head`. The original result is replayed against the parent and the
accepted action supplies the eligible task IDs. The verifier compares the
single parent and both raw blobs, rejects mode, syntax, unrelated checkbox
or other changes, and independently verifies the exact child gate run,
native completion and current spec promotion. The finish grant binds the
child. Avoid rewriting any parent evidence.

An adopted finish anchor retains `taskCompletion` with `reviewedParent`,
`acceptanceChild`, changed `taskIds`, `acceptedTaskIds`,
`reviewedGateReference`, the original `reviewedGate` descriptor, and the
original `handover` and expectation seals. The anchor's normal
`implementationGate` is the independent child gate. Keep the actual reviewed
SHA in `implementationReview.head` and the original review identity in the anchor and receipt, and keep the narrow
`{ reviewedParent, acceptanceChild, taskIds }` proof in the receipt.
Any other change follows the ordinary exact-candidate review route.

## Host configuration and finish triggers

A separately authorized planning, local execution or protected finish phase
must be in force before a paid review. For an adopting parent, the contained
runner uses the external host configuration hash and a durable pre-launch
claim shared across that change's configured phases. A run can select
`explicit` with its own separate exact single-run grant. A retry always
requires a fresh distinct grant. See `references/review-candidate.md` inside the separate
`autonomous-implementation-review` package.

For an adopting parent, the protected-finish remote readback supplies
`eventInventories` per PR chapter. The before-publication readback binds the
actual `sourceRef`. Before publication supply current complete `push`
inventory at the source ref and `pull_request` inventory at the exact target.
Before merge supply `merge` and `push` at the exact target. The observed
inventory binds candidate, repository, event, target, observation time,
reference, `verified: true`, `complete: true` and all activated trigger rows.
Each per-event push grant binds that same candidate, event and target plus
the protected finish reference. The decision expires after the bounded
readback window.

A standing row is `{id, repository, event, target, configurationSha256,
exposure, kind: "repository-check", costUsd: 0}`. Name the source by stable
identity including its installation and check where relevant. Compare the row
byte-for-field to a verified current observation. An unknown cost is
represented as null. Any nonmatch, paid job, deploy preview, tunnel or retry
requires the applicable distinct single-run approval and reservation. Keep the
complete inventory and the observed matches. Local execution does not
authorize activation.

## Optional candidate harness

Configure the host-owned `localHarness` in the external reviewer
`host.json`. Supply its exact raw file descriptor
`hostConfiguration: {file, sha256}` to delivery. The host-owned, pinned
CLI or local stdio MCP adapter receives the clean isolated checkout SHA.
Use `delivery-cli.mjs run-harness` only with the exact
`local-candidate-harness` grant. A binding with external exposure also needs
a distinct exact reservation. The adapter emits a generic schema-version-1
result with `harnessId`, `candidate`, `verdict`, `findings` and `observedAt`.
The host writes a schema-version-2 seal binding the result and its digest,
the exact host configuration digest, the pinned executable digest, the
harness ID and the candidate SHA. Retain the original seal as a read-only
file in a private host-owned directory outside the checkout, export,
request and worker evidence. Give delivery the `harness: {file, sha256}`
reference and independently pin the reviewer expectation with
`handover.expectFileSha256`. The private reviewer expectation's
`harness` must match delivery's reference. The reviewer gets a copy of the
seal through the attachment named in `snapshot.harness`.

When the task-only child becomes the head, seal a new result for that SHA
before pushing. A configured closure needs a fresh seal for its current
head in both absent and open PR states. Retain its reference in the host
finish readback as `closureCandidate.harness` and bind the independent
closure review to its digest in `closureReview.harnessSha256`. The
contained independent result and executable gates remain separately required.
