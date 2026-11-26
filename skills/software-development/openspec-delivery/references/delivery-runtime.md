# Delivery runtime

Resolve `<runtime>` to this package's `scripts/delivery-cli.mjs`. The runtime
uses Node 22+ and local Git. It consumes independently retained observations
from the orchestrator and uses the matching companion verifier when handover
verification is requested. Keep the verified companion package complete.

```sh
node <runtime> policy --input <request.json> --json
node <runtime> preflight --input <request.json> --json
node <runtime> workspace --input <request.json> --json
node <runtime> decision --input <request.json> --json
node <runtime> status --input <request.json> --json
node <runtime> handover --input <request.json> --json
node <runtime> finish-readiness --input <request.json> --json
```

Use canonical absolute local paths, a single request file, and literal full
commit IDs. The commands print one JSON object. A nonzero exit signals a failed
invocation. Read the structured state or predicate even on a successful
invocation. These inspection commands execute no worktree, task, commit,
reviewer, profile, or remote mutation. Positive decisions are advisory.

## Policy and workspace inputs

`policy` takes `repo` (the primary checkout), `change`, `plan`, `target`,
`selection`, and `deliveryBoundary`. The target is a separately verified locally
available target revision. The committed context checks the plan's single
integrated parent, inventories raw planning bytes, and computes the Task-Guided
digest. The runtime derives mode from that context and the declared delivery
boundary. The selection carries `revision`, `reference`, `preExecutionReview`,
`continuousGoal`, and optional `approachConvergence`. Pass applicable
`declaredContractPaths`, `contractDesignations`, `orchestrationAvailable`, and
matching `reviewAcceptance`. The existing narrowly scoped `legacy` and
`recovery` inputs remain supported. For a draft use `phase: "freeze"`, the
checkout with the draft, `parent`, and `target`, with no `plan`. The draft
exposes its raw inventory and any prospective `goalContractDigest`. The
approved plan digest is still null. See [delivery-policy.md](delivery-policy.md).

`workspace` takes `repo`, `change`, and `base`. It reports at most one
registered implementation worktree and one registered closure worktree using
`change/<change>` and `closure/<change>` by default. Pass `branch` or
`closureBranch` for a project-selected branch. An optional `workspace` must
match the verified implementation checkout. Detached entries have their own
inventory. Select one by matching `verificationWorkspace` and `verificationSha`.
A missing, repinned, locked or ambiguous selected workspace needs recovery. See
[workspace.md](workspace.md) for authorized lifecycle commands.

## Preflight observations

Supply a `preflight` object of independently retained observations. With a
frozen plan, include the policy inputs. Before a proposal, P7 verifies the
observed integrated policy revision against the retained live target. Each supplied item uses `verified: true` and a stable `reference`.
Omit an observation to report `pending`. A supplied observation with a mismatch
reports `blocked`.

| ID | Input | Required observed fields |
| --- | --- | --- |
| P1 | `live` | `head`, `branch`, `remote`, and canonical repository identity. |
| P2 | `auth` | Matching `repository`, `authenticated`, `requiredScopesPresent`. Retain no credential material. |
| P3 | `local` | `activeChangeInventoryVerified`. The command compares primary HEAD, local target branch and tracking ref with the retained live target and checks local tracked/untracked cleanliness. |
| P4 | `reviewer` | Passing `outcome`, observed and expected reviewer configuration hashes, and the matching reviewer package hash from P8. |
| P5 | `relay` | `ready`, `materialRetained: false`, and the reviewer configuration hash. |
| P6 | `runtime` | Observed and expected `node` and `openspec` versions. |
| P7 | `checkpoint` | Matching live `head`, `policyRevision`, and `prerequisitesVerified`. |
| P8 | `companions` | Complete `actual` and `expected` maps from package names to source inventory hashes, including the `reviewer` entry if P4 applies. |

The summary contains a fixed-order item list, `ready`, the first unresolved
item in `followUp`, and the reviewer probe authority observation. Missing or
drifted reviewer evidence stays pending or blocked. A fresh paid probe requires
a separate grant. Supply local authentication and relay readbacks without account
details or secrets.

## Local decisions and status

For prospective proposal assessment, durable short decisions and file-backed
operator checkpoints, use [the operator workflow](operator-workflow.md).
`init` is a read-only alias of `status`. The existing status fields remain
available, and `operatorSchemaVersion: 1` identifies the additional footer
facts and rendering. Only `record-approval-card` and `approval-reply` write
operator records. The proposal, card preview, status and relay-decision routes
perform read-only assessment.

`decision`, `status` and `finish-readiness` take the policy inputs and use the
registered implementation workspace. For `decision`, supply `deliveryPhase`
of `dispatch`, `boundary`, `correction`, or `result`. They consume

- Separate `approval` and `grant` records binding the selected `change`, frozen
  `plan`, mode-specific `planDigest`, `mode`, `policyRevision` and absolute
  `workspace`. Supply the stable references and normalized fields in
  [delivery-policy.md](delivery-policy.md). For exclusive delegation, supply the
  approval and grant references. Delivery derives the normalized authority fields
  from the sealed assignment.
- `restrictions` with explicit `inspect`, `noCommits` and `group` (selected
  native group or null). Keep the narrower retained restrictions on every call.
  Supply P1–P8 observations at dispatch.
- `observed` with matching plan identity, `ownership: "exclusive"`,
  `host: "ready"`, `humanInput: "none"`, `remoteRequired: false`,
  `stopReached: false`, phase alignment and, for Goal-First, `adaptations`.
  Supply `minutesUsed`, `groupMinutesUsed`, `correctionsUsed`, and the
  cumulative `correctionHistory`. Name actionable failures with
  `failure: "routine-in-scope"` and `failureReference`. Each correction
  record retains its `group` (`goal` in Goal-First), rejected SHA, successor
  SHA and unique reference. Ancestry is checked against the frozen plan and
  selected candidate. A bookkeeping commit requires fresh result evidence.
- For Task-Guided, `taskGuidance` is a verified retained interpretation
  (`reference`, `planDigest`, `groups`, `acceptedGroups`). Each group supplies
  `id`, ordered `taskIds`, earlier `requires`, `authority` (`local` or
  `external`), declared `stop`, gate argv arrays in `gates`, and a
  `resultBudget` with `minutes` and `corrections`. Supply the applicable
  inherited dispatch and continuation observations in
  [delivery-policy.md](delivery-policy.md). Each accepted-group record binds its `id`,
  `candidateSha`, `planDigest`, `gateReference`, and `reviewReference` with
  `verified: true`. The reviewed SHA must carry the group's native checkbox
  progress and be an ancestor of the current candidate. A checkbox alone leaves
  the group pending.
- At result verification, name the full `head`, the pinned `gateRun` reference
  (`{file, sha256}`), the independently observed `activeAttempt.group` and
  `activeAttempt.implementerSession` in `observed`, and `attempt.id` plus
  `handover` for the exact reviewer attempt. The sealed reviewer request lists
  `gate-run:<wrapperSha256>` in its acceptance list. The runtime matches the
  reviewer to the candidate, plan, authority and held attempt. Portable-role
  reviews bind the registered implementation checkout and the candidate's raw
  planning input hashes.
  Same-SHA executable evidence and an independent, read-only, complete
  no-findings review are required even after accepted corrections.

Inspection uses the same evidence checks. The v1 status object always has
`schemaVersion`, `change`, `mode`, `state`, `candidateSha`, `planDigest`,
`activeAttemptId`, `stopPredicate`, `contextHint` and
`recommendedNextAction`, in that order. Unknown identity is `null`.
States are `unresolved`, `draft`, `approval-pending`, `local-ready`,
`active`, `result-review-pending`, `local-verified`, `finish-ready`,
`closed` and `blocked`. A matched retained `phaseBoundary` can supply
`same-session` or `fresh-session` for the verified active attempt. A proposed
exclusive-runtime dispatch also checks the grant deadline. Status recommends
a stable `code` and the selected `subject`. It performs no action.

For an already selected change, `openspec-next` routes inspect to `status` and
local continuation assessment to `decision`. Preserve the retained request's
mode, authority, phase, restrictions and evidence when invoking either entry.
A pending or blocked predicate identifies the next evidence to reconcile.

## Handover and finish readiness

### Configured exclusive worker runtime

An integrated root contributor contract can select
`<!-- openspec-worker-runtime: exclusive -->`. An explicit retained selection
or local grant can also require it with `delegatedRuntime: true`. Include a
`delegation` object in the retained delivery request for every phase:

- `verifier` is the absolute installed path to `scripts/run-implementer.mjs`,
  with `verifierSha256` and the qualified full `runtimeSha256`. Choose this
  complete trusted installation outside both checkouts, the registry and
  publisher output. Resolve the inventory hash through `--runtime-identity`.
  Delivery reads and hashes the complete transitive runtime inventory before
  importing any companion module.
- `assignment: {path, sha256}` locates an independently retained sealed
  single-assignment input to the packaged runtime. Its approval and grant
  paths must match the normalized delivery references. Delivery checks the
  role pair, qualification, effective settings, scope, plan, authority and
  restrictions against that original input. The sealed grant supplies delivery's
  stop, budgets and eligible native tasks. An explicit sealed `commits: true`
  allows local commits only within the applicable Goal Contract and retained
  restrictions. Encode a no-commit restriction
  as `no commits`, or a fixed group as `group:<id>`, in the portable
  restrictions as applicable, and preserve the outer restrictions.
- For successor dispatch, add `predecessor: {path, sha256}` pointing to the
  sealed inputs of the preceding delivery decision. An ordered successor
  replays the predecessor's exact result phase, including executable gates
  and fresh contained review, and matches the accepted group to its
  reviewed SHA, gate wrapper hash and review report hash. A correction
  replays the exact, scoped failed gate or review finding. Its runtime
  continuation record uses `review-correction` and pins the offending
  evidence hash. For a native turn cap, read back the prior `boundary`
  phase and preserve its verified native progress hash with the on-track
  check. The same-action attempt reserves the available cap allowance.
  Its actual distinct native session is checked on settlement.
- For a productive Goal-First supervisor timeout under adopting integrated
  policy, retain the prior `boundary` observation with `SUPERVISOR_TIMEOUT`.
  Use its `progressSha256` with the protected `supervisor-timeout` continuation
  record and the original settlement, result and slot-release identities.
  One successor may inherit the exact verified dirty checkout. Delivery
  checks the retained authority and on-track observation before advising
  dispatch. The runtime rechecks scope, remaining time and corrections, and
  slot ownership before native preflight. Keep the native outcome pending.

`dispatch` for this route is advisory and returns
`requiresExclusiveAdmission: true`. Run the pinned implementer under its
separate bounded authority. The runtime checks admission and atomically
publishes the initial claim with its launch record. Publication failures before
that boundary leave the claim available. The runtime then reserves the slot and
passes its native sandbox probe before providing input. A subsequent
`boundary` reads the same registry attempt. Delivery verifies process-tree
quiescence, sealed publication and matching workspace outputs. The
orchestrator may then prepare the exact candidate within held authority.
A missing publication after settlement is a recovery predicate. Use the
separately authorized original-attempt recovery before rechecking delivery.

`result` checks the output bytes in the exact candidate and uses the
normal gate and review requirements. The `handover` must be the pinned
companion's `review-candidate` handover. Set its `predecessor` to the
implementer attempt, its `implementerSession` to the verified native
session, and its native group/task to the same action. Use the reviewer
configuration pinned by the pair and a session bound to this review. Retain the same
outcome, acceptance criteria, scope and exclusions in the review request.
Pin the independent expectation file as `expectFileSha256`. For either delivery
mode, the contained reviewer uses the normalized Git plan digest and
frozen planning inputs to reconstruct the full diff from the frozen plan.
For Goal-First include `goal-contract:<approvedGoalContractDigest>` in
the review acceptance list. The gate record uses the selected delivery
mode's digest and the review request also carries its `gate-run:<wrapperSha256>`
tag. Delivery joins both identities on the exact candidate.

Inspection uses original-attempt and evidence readback. Running, native
input wait, unknown or unsettled ownership, a native turn cap, failed
handover or scope mismatch blocks advancement. Missing qualification
blocks the selected route. Policies that did not select the runtime
continue to use their applicable evidence paths.

At dispatch, delivery matches the retained target repository and reviewer
probe configuration to the assignment. Use the hash of the paired
reviewer's canonical inventory in P4 and P8. A changed source inventory
needs fresh applicable verification.

For every review, retain `handover.reviewSessionBinding` as a protected
`{path, sha256}` locator. Seal it once as `review-session-<session>.json`
beside the sealed execution grant. The v1 `exclusive-review-session` record
binds `claimId`, `change`, `plan`, `planDigest`, implementer `attempt`,
exact `candidate`, `orchestrator`, the pair's `originalSession`, reviewer
`session`, `configurationSha256`, `inventorySha256`, `requestFileSha256`,
`expectFileSha256`, `reviewAuthority` and `maxRuns: 1`. The first review can
bind the session pinned by the pair. Re-review uses a distinct session with a
new binding, including when the candidate changes after recording progress.
Readback can replay the same exact bound review. For pre-adoption plans obtain a separate paid-run
grant before launching each reviewer.
Keep the native task pending while a scoped product correction may still
be needed. A verified finding or failed gate requires a fresh bounded worker
attempt under the same action and accepted scope.

### Portable handovers

A `portable-role` handover takes an absolute path to the trusted companion
`worker-handoff.mjs` in `verifier`, its independently pinned
`verifierSha256`, plus `expected` and `runtime` from the companion's handover
contract. It delegates sealed request, native verdict, lifecycle, output hashes
and independent runtime checks to the companion. For a `review-candidate`
handover, pin the companion's `review-candidate.mjs` and supply its `request`,
`requestFileSha256`, `expect`, `exportDirectory` and `output` for replay through
`--verify`. These paths point to the existing complete read-only reviewer package
and retained files. Caller-owned verifier code and its package are trusted.

Task-Guided result verification can consume a sealed contained candidate review.
Set the review snapshot's `base` and `plan` to the frozen plan SHA and its
`target` to the exact candidate SHA. The verifier rebuilds the complete diff
and verifies packet coverage and independent read-only sessions. Supply the
frozen plan's raw planning hashes, including the pre-progress `tasks.md`, and
the Task-Guided digest, which normalizes only native checkbox progress. Use a
canonical review checkout isolated from both the primary and implementation
checkouts. Bind the held approval and grant references and the selected native
group and task. Report exclusive ownership and the group's implementer session
in `observed`. The exact disposable gate run and its matching acceptance tag
remain required. For inherited non-delegated Goal-First policy, use a qualified
portable-role reviewer with the distinct Goal Contract digest. The contained
renderer uses the normalized Git plan format described above.

Before a terminal handover exists, the `active-attempt` variant reads the
companion's sealed request and a separately pinned `active.json` in that same
evidence root. Provide `expected`, `runtime`, `activeFile` and `activeSha256`.
The record carries v1 `kind: "active-attempt-observation"`, matching
`identity`, `requestSha256`, `session`, and state `working` or `waiting`.
A missing, misplaced, changed or contradictory handover blocks admission.
Handover verification never accepts the delivery on its own.

Finish readiness requires local acceptance and completed native tasks at the
exact candidate. It checks each native delta against its corresponding committed
current spec. The portable checker expects the identity-only plain YAML header
(`metadata_version: 1`, `artifact: spec`, exact `capability`). Copy added or
modified requirement blocks and scenarios into the current spec, preserve
renamed content, and remove declared removals. A mismatch reports the capability,
file and reason. The result requires separate finish authority. A `closeout`
request may additionally prove the selected candidate's closure using the
offline assertions in [evidence-retention.md](evidence-retention.md).

For Task-Guided PR-fix readiness, the accepted result carries
`approvedTaskGates` from the verified frozen group decision. Lineage
verification checks those exact ordered argv against both the accepted
ancestor and final-head captures. A wrapper digest identifies a capture.
The frozen group decision supplies the gate authority that readiness seals
for [protected finish and receipt replay](protected-finish.md).

Adopting projects use [integrated low-touch delivery](low-touch.md) for
exact native inventory closure, the final candidate harness and the
task-completion child path. The verified integrated parent selects the
prospective rules. The `run-harness` command is the explicit local adapter
invocation. Use the retained result on the applicable review and finish
inputs. Read-only status and finish readiness verify observations without
launching a harness or reviewer.
