# Protected finish checkpoints

The orchestrator holds the explicit named finish grant, serializes operations
for the change, reads authoritative sources, and performs authorized actions.
The helpers evaluate local Git objects and retained evidence. Use
[integration](integration.md) for the protected route, receipt and fresh review
procedure. Keep the exact implementation review and gate binding from
[finish readiness](delivery-runtime.md#handover-and-finish-readiness).

```sh
node <delivery-runtime> finish --input <finish-request.json> --json
node <next-runtime> inspect --input <finish-request.json> --json
node <next-runtime> continue --input <resume-request.json> --json
node <delivery-runtime> sync-skills --input <sync-request.json> --json
```

## Retained records

Pass `repo`, the full `change`, its reviewed implementation `head`, and
`finishCheckpoint` and `finishRemote` file references. A reference is
`{file, sha256}` over complete file bytes. Keep canonical absolute paths,
owner-private evidence outside the checkouts, and append-only revisions of
observations. Read back each new record before using it. Preserve prior records
and the original absolute deadline across handoffs and replies.

The v1 `protected-finish-checkpoint` has `records`, `identity`, `grant` and
`anchor` references, `observedAt`, `deadline`, `keepWorktree`, and `prs`
with `implementation` and `closure` URLs or null. Once a PR exists retain its
URL, and for closure retain `closureHead` as well. The identity includes
`repo`, GitHub `repository` (owner/name), target branch `target`, original
verified `targetRevision`, full
`change`, `candidate`, `branch`, `workspace`, `mode`, `plan`,
`planDigest`, `policyRevision` and verified `issue` URL or null.
Each verified observation has `verified: true` and an evidence `reference`.
Bound observations also repeat the exact `identity` and `grantReference`.
Use UTC timestamps with milliseconds.

- The sealed `protected-finish` grant repeats the identity. It carries a
  reference, `startedAt`, `deadline` (at most one hour after start),
  `keepWorktree`, the exact required `integratedGates` and `closureGates`
  argv lists, and `uiDeclaration` (null or the approved UI contract).
- The bound `finish-readiness-readback` anchor records `ready: true`,
  original `keepWorktree`, the implementation `implementationReview`
  observation with its session, exact disposable `implementationGate` file
  and `implementationGateSha256`, the accepted gate wrapper digest. For first publication include the original delivery
  evaluation inputs for live exact candidate finish-readiness verification.
- A contextual `continue` passes a sealed `finishReply`, a bound
  `finish-reply` with `reply: "continue"`, `checkpointSha256`,
  `pullRequest` for the retained active PR, and `observedAt`. Read back the
  same PR after the reply. Use a new bounded grant if the original watch
  expired. Preserve the same reviewed head, PR identity and prior restrictions.
  A changed candidate goes through fresh applicable gates, review and authority.

## Protected chapters

1. At each decision read repository, target, branch and PR inventory, using
   complete pagination. Refresh decision observations within one minute.
   In `finishRemote` record a fresh bound observation and
   a bound `implementation` or `closure` entry with `complete`, `target`,
   `observedAt`, `url`, `head` and `state`. A verified `ABSENT` entry
   has `url: null` and identifies the exact head intended for publication.
   Resolve unknown push/PR outcomes before continuing. A publication preview
   also requires a bound `beforePublication` observation with exact candidate
   `head`, `target`, actual `targetRevision`, `observedAt`, `complete`,
   `routeVerified`, and `specsReconciled`, plus `triggers` in the existing
   [trigger decision format](external-verification.md),
   with the push grant bound to this repository and `finishReference`.
   Before sending a write, acquire only the reservations for its actual
   external triggers and record consumption. Preserve all prior attempts.
2. For an `OPEN` PR, supply `mergeability` and `protectionReadback`. Read
   official branch protection and applicable rulesets on every decision. Derive
   stable required check IDs including required app/source identities. The
   `protection` observation includes `target`, `routeVerified`,
   `branchProtection` and `rulesets`. Each source includes `complete`
   and a `required` ID list. Record a complete `checks` observation with
   `entries` of `{id, head, state}`, and a complete `review` observation
   covering reviews and human requirements. Bind each observation to
   `pullRequest`, exact `head`, `observedAt` and its evidence reference.
   Review states are passed, pending, human-required or failed. Mergeability
   is ready, pending or blocked. Check states are passed, pending, failed
   or stalled. Missing required checks remain pending. A pending optional
   check neither delays a ready merge nor counts toward protection. A stalled
   optional check needs a fresh `optionalDisposition` for the exact sorted
   IDs with `decision: "proceed-without"`, or separate retry authority.
   If `watch` is returned, retain the observation, wait until `pollAt`,
   and read all authoritative inputs again. Pause for a failed required check,
   unknown protection/mergeability, changed head, deadline or human action.
   For a declared preview, retain its `reserve-external` run-once result as
   `preview.reservation` and keep its reservation file in the change records.
   Surface the preview URL and retain distinct exact-candidate review
   before merge. A failed deployment is a pause. Local try-out uses loopback.
3. After protected merge record `MERGED`, `mergeCommit`, `mergedAt`, the
   exact `requiredCheckIds`, and `assertion` for the packaged
   `assert-closeout` PR, check, run and thread assertions. Keep their
   original evidence. The bound `integrated` observation identifies actual
   `mergeCommit`, containing `head` and exact disposable `gate` reference.
   Reuse a completed chapter only on verified readback. An unverified merge
   outcome remains pending.
4. After integrated gates pass, prepare the receipt and record-only archive.
   The bound `closureCandidate` identifies the `integrated` verification SHA,
   closure `head`, exact `archive` path, `receipt` file reference, `receiptPath`
   in the archive, committed
   `receiptSha256`, and
   `gate` reference once complete. Use the
   [receipt guard](guard.md) and full archive `npm test` plus declared
   gates through the packaged exact-SHA disposable gate procedure. Retain
   the distinct bound `closureReview` of kind `independent-closure-review`
   with `head`, `gateSha256` (file-byte hash), `session`, `observedAt`,
   `verdict: "pass"`, `factual: true` and satisfied findings before publishing.
   Apply the same protected check, review and exact readback procedure to the
   closure PR. The containing revision must preserve the exact archived tree
   movement and receipt evidence. If an issue applies, its bound readback
   names `url`, OPEN or CLOSED `state`, and `acceptance` of
   `{archive, closureMerge, receiptSha256}`. Only close an open issue when
   this acceptance is verified and the finish grant covers it.
5. Supply bound, complete `worktrees` with `entries` from creation or handoff
   records and a verified `writers` observation with `idle` canonical paths.
   Each entry carries its evidence reference, exact repository/change,
   canonical `workspace` and Git `commonDirectory`, `head`, `role` of
   implementation, closure or verification, and attached full branch `ref`
   or null for detached verification. Recheck eligibility immediately before
   removing each worktree without force. Confirm path and registration absence
   and retained branch head after each removal. Keep original ownership records
   so removed entries remain visible on resume. Preserve primary and unrelated
   checkouts, ambivalent ownership, active writers, locked or dirty entries,
   ignored content and submodules. Archive/issue acceptance survives a partial
   cleanup. Carry `keep the worktree` in the retained grant. If added later,
   retain a bound sealed `keepDecision` of kind `keep-worktree` with
   `observedAt` and set `keepWorktree: true` on the new checkpoint.
   Avoid reopening
   completed PRs, replaying merges or creating a replacement checkout.

## Post-release sync

A verified `release` names the same `identity` and `acceptance`, publication
state (`published` or `deployment-inapplicable`), immutable `source`
with `revision` and `route`, and exact `packages`. For native copies record
`reviewed: true`, route `reviewed-native-copy`, and `nativeUpdatePackages`
matching the full package scope the established installer will touch. Verify
that scope with its dry run in the selected Codex context. For Hermes use
`scanner-managed` after publication. Propose `skillSync` with `client`,
selected `profile`, source and exact package scope. Use the Hermes profile
name or the absolute Codex user-home path selected by the installer
`--user-home` option. Each package entry
includes `name`, complete inventory SHA-256, top-level `version` and
`metadataVersion` for applicable upstream metadata (null if absent).

The separate sealed `authority` is an operator observation of kind
`post-release-skill-sync`, with exact `identity`, `acceptance` and
`selection` (client, profile, immutable source and packages). Carry out an
approved update from an operator-controlled context outside the project
session. Use normal Hermes hub discovery and scanning, or the distribution's
reviewed native Codex update from the named source with collision preflight
and backups. Keep backups outside discovery. Use a commit-pinned source for
upstream packages and keep its native provenance. Retain a sealed
`observation` with exact `selection`, `authorityReference`,
`collisionFree`, `backupOutsideDiscovery`, scanner verdict or native
provenance, `installedPackages` inventory and `freshSession` readback.
Preserve installed packages on blocked scanner or collisions. Use isolated
scratch homes and profiles for tests.
