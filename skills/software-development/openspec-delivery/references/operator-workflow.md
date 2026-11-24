# Short proposal and operator checkpoints

This procedure applies to new plans whose verified integrated parent has exactly
one root contract marker `<!-- openspec-proposal: propose-to-freeze -->`.
`AGENTS.md` takes precedence over `CLAUDE.md`. Working files, a marker introduced
by the selected change, and caller preferences cannot select the policy.
Existing plans and the exact-identity approval and recovery route retain their
original authority. All observations below come from the orchestrator, which
authenticates the operator and checks the evidence before marking it verified.

Resolve `$delivery_runtime` to the installed delivery package's
`scripts/delivery-cli.mjs` and `$request` to the retained absolute JSON path.

```sh
node "$delivery_runtime" proposal --input "$request" --json
node "$delivery_runtime" approval-card --input "$request" --json
node "$delivery_runtime" record-approval-card --input "$request" --json
node "$delivery_runtime" approval-reply --input "$request" --json
node "$delivery_runtime" status --input "$request" --json
node "$delivery_runtime" checkpoint-relay --input "$request" --json
```

Use only the command for the current boundary and its matching request.
Recording a verified display or reply appends a local observation. The other
commands read observations. These examples supply no authority by themselves.

## Prepare, review and freeze

1. On a short proposal or `/goal draft`, read the inline goal or named note,
   verify the integrated target and relevant upstream facts, resolve existing
   changes, and generate a new full name once where the project selects ULIDs.
   Under authorized setup, use `proposal` with `proposal.phase: "prepare"` for
   the existing read-only worktree preview. Execute the authorized workspace
   setup and read back registration and exact HEAD before running native
   `openspec new change`. Bind the one verified proposal issue where authorized.
2. Check native status and apply/instruction artifact inventories. Author the
   eligible Goal-First outcome or the ordered Task-Guided plan. Review outcome,
   scope, hard invariants, exclusions, gates and bounded authority for Goal-First.
   Review task order, dependencies and staged authority for Task-Guided.
   For material uncertainty about a breaking upgrade, use authorized disposable
   scratch probes and retain observations before contract lock. Apply the
   [discovery boundary](external-verification.md) to profile isolation, paid
   work and evidence that must be captured again at the exact candidate.
3. Run native strict change validation and the project's metadata check. Retain
   the command outcomes and the corresponding raw inventory via
   `change-guard.mjs planning-worktree`. Run the parent-selected review or the
   expressly requested review on the complete artifact set. For charter-v1,
   use orchestration's existing `startConvergenceReview`, `convergencePacket`
   and `acceptConvergenceReview` with the fixed independent reviewer. Retain
   the admitted record, packet, observed packet-file hashes, receipt, correction
   ledger, original budgets and launch evidence. Recheck the complete raw
   planning inventory after review. A routine blocker goes through
   `proposal.phase: "correct"`, which replays charter acceptance and calls
   `convergenceDecision` over the retained ledger and authorized paths.
   Apply only an approved in-scope remedy, supply any newly required native
   artifacts, and repeat validation and independent review. Carry the same role
   and consumed cycles. A granted retry uses the same binding. Provider exposure
   and each paid launch or retry require their own existing single-run grant.
4. Call `proposal` with `phase: "assess"`. Only `freeze-ready` permits
   proceeding to the authorized plan-only commit. Preview the exact inspected
   planning paths and bytes, commit only those inputs, re-read the committed
   SHA, its single integrated parent, its complete raw planning hashes and its
   mode-specific digest. Preserve the assessment as a sealed local file. A
   missing opt-in, `draft only`, `no commits`, missing commit grant, or blocked
   review stops before the card. A reviewed draft can remain uncommitted.
   No implementation worker or publication follows planning.

`proposal` takes the normal policy inputs plus `parent` and the registered
worktree for assessment/correction. Its `proposal` object has `verified`,
`reference`, `kind` (`short-proposal` or `goal-draft`), `phase`, exactly one of
`goal` or absolute `note`, and optional `draftOnly` or `review`.
`baseline` names the verified parent `head` and `upstreamVerified: true`.
`issue` provides the verified `change`, `bound: true` and its `reference`.
For a project whose verified policy does not require an issue, record that
decision with `required: false`, `bound: false` and null `issueReference`.
`validation` is a `{file, sha256}` observation sealing `verified`, `reference`,
`change`, `policyRevision`, `inputs`, `nativeReady`, both zero
`strictExitCode`/`metadataExitCode`, and `issueReference`. The retained
`planningGrant` binds `change`, `policyRevision`, `workspace`, `reference`,
`write`, `validate`, `commits`, `minutes`, `minutesUsed`, `corrections`, `stop`,
and `stopReached`. Charter calls also bind `review: true`, `reviewBinding` and
authorized `paths` in the grant. Use a trusted, pinned orchestration
`charter.verifier` (absolute `orchestration-core.mjs`), its `verifierSha256`,
the verified matching package `inventory` observation, and
`charter.observation` sealing the arguments to `acceptConvergenceReview`.
For strict review use the existing `reviewAcceptance` interface. Retain matching
accepted review on the subsequent frozen policy request.

## Display and consume a card

Use an owner-private records directory outside both checkouts, with one serialized
journal per authenticated operator conversation. Preserve its original directory
and all numbered records through fresh sessions. Read the actual host message
and reply identity. If the host cannot prove the display, immediate reply and
unique conversation context, use the explicit exact-identity approval route.

1. Run `approval-card` with the committed policy request, sealed `freeze`
   assessment, and verified `repositoryObservation` naming the canonical `repo`
   and repository. `cardSummary` includes `outcome`, `gates`, `exclusions` and
   explicit `restrictions` (`inspect: false`, `noCommits`, `group`, `keepWorktree`).
   For Task-Guided supply a verified `cardScope` with the frozen `planDigest`
   and the exact `summary` read from the plan. To offer `approve and run` include
   `local` terms with the bounded `budgets`, `stop`, `commits`, and both
   qualified `roles`. Task-Guided also requires ordered `eligibleGroups` and
   `budget`. For each role supply its verified `reference`, `route`,
   `bindingSha256`, and the reviewer read-only marker. `roleBindings` maps each
   role to the sealed qualification readback with its exact `role` and route.
2. Display the returned `markdown` card, including the full SHA, digest,
   restrictions and local terms. Use `record-approval-card` with the
   same request after confirming that display. `operator` carries the original
   `records`, `thread`, `operator`, unique `card`, UTC `displayedAt`,
   `expiresAt` (at most 24 hours), and the verified `turn` naming the
   conversation, operator, unique message `id`, `reference`, `kind: "display"`,
   `at`, `card` and returned `displaySha256`. A printed preview alone is
   insufficient. Use one current card in the conversation. A successor display
   invalidates the previous short reply route.
3. On `approve`, `approve and run` or `changes: <feedback>`, call
   `approval-reply` with that original card's `operator.cardSha256` and a
   verified reply turn. It carries the same conversation/actor fields, a new
   message `id`, `kind: "reply"`, `at`, `immediate: true`, `inReplyTo`
   matching the actual display message and the literal reply `text`. If
   clear feedback stays in scope, record `scope: "routine-in-scope"`. Apply
   it directly to the draft. For feedback on a frozen plan, carry
   `revision: {plan, operator, reviewAcceptance}` into proposal assessment
   with the feedback's `replySha256`. Revalidate and review the successor.
   Refreeze only with explicit local authority naming `planningGrant.refreezeFrom`
   and `predecessorUnpublished: true` for a confirmed unpublished, unapproved
   plan under the same parent.
   Retain the predecessor observation and restrictions. Ask for disposition
   if feedback materially changes scope or authority.
4. The reply transaction retains separate exact approval and local grant
   records, linked by reference. Both must read back for `approve and run`.
   `approve` stops at approval. Supply a separately authorized sealed
   `shortDecision.localGrant` before execution, using the normal local grant
   schema and the qualified role pair. For `decision` and `status`, pass the
   original `shortDecision` context with its `replySha256` and current UTC
   `at`. Do not pass copied short records as long-form approval. For a later
   dispatch after settlement, supply the sealed `shortDecision.resumeCheckpoint`
   with the original `resumeAttempt` when recorded. Include the checkpoint's
   `restrictions` and `budgets` (elapsed counters and `correctionHistory`)
   for resume. Continue through the existing delivery decision, gate and
   correction interfaces. Preserve a fixed group, no commits and worktree
   retention when a later invocation omits them.

For exclusive delegation retain the normal pinned runtime authority files
and paired qualifications. The role observation names the corresponding
`runtimeBindingSha256` and route. `runtimeAuthority` cites the verified link
between the assignment authority and the short approval and grant references.
Read the assignment back through the existing exclusive-runtime admission.
The derived local grant must fit the retained budgets, stop, groups and commit
restriction. A role pin identifies a qualified route. Each live provider run
still needs separate authority.

## Read-only status and checkpoint relay

Use `openspec-next inspect` or the packaged `init`/ `inspect` routes to
assess retained state. `status` returns the same JSON facts used by the Markdown
footer, with exact branch/HEAD, frozen identity, attempt, P1–P8, restrictions,
alignment, stop, evidence and known PR/check observations. Unknown facts stay
pending. Use the reported next input only within the held authority. A missing
package or failed qualification calls for evidence or operator disposition.

For a fresh session seal a `checkpointFile` in the change records directory.
It records `schemaVersion: 1`, `kind: "delivery-checkpoint"`, `verified`,
`reference`, `records`, `identity` (delivery command identity plus exact branch
and HEAD), attempt or null, verified original settlement for a recorded attempt,
`grantReference` and canonical stable-JSON `grantSha256` (both null before a
grant), `safeBoundary` and sealed `evidence` inside the same records directory.
Verify original settlement and ownership again before using it. The footer
can supply concrete shell assignments and the supported Codex CLI launch:

```sh
codex --approve-for-me -C "$change_worktree" --add-dir "$change_records"
```

This uses workspace-write with automatic approval review and adds the named
records directory. The launch and starter carry forward only the original
authority. In Codex `$openspec-next inspect <full-name>` is read-only.
`$openspec-next <full-name>` or `$openspec-delivery <full-name>` invokes the
bounded local route only under the adopting contract with exact approval and a
separate grant. `$openspec-delivery finish <full-name>` is a distinct protected
publication and closeout decision. Copy the footer's sealed checkpoint path
and digest in a new session. Retain the original worker/claim when settlement
is unresolved.

For a project with an already qualified Herdr checkpoint relay, request a
separate one-rotation grant for the exact checkpoint and predecessor pane.
Use the existing pane inspection and identity readback in orchestration's
`references/herdr.md`. Feed sealed checkpoint evidence and the verified Herdr
`qualification` to `checkpoint-relay` with `checkpointRelay.authority`
(`kind: "checkpoint-only-rotation"`, `oneRotation: true`, `checkpointSha256`,
`predecessor`, `qualificationReference`). The qualification names
`route: "herdr"` and `checkpointRotation: true`. Follow the read-only sequence:

1. Verify the predecessor pane, checkpoint identity and preserved process/claim
   in `predecessor`. Cancel its timer with the existing qualified relay and
   retain `timerCancelled` and the readback `timerReference` before opening
   the successor. Reuse any already opened successor for the same rotation.
   When none is known, require a verified `successorInventory` with
   `absent: true` and the exact `authorityReference` before opening one.
2. Let the successor read the retained files. Verify its exact pane,
   `identity`, `grantReference` and `ownership` observation. Wait for its
   sealed `ack` with `kind: "HANDOFF_ACK"`, pane and predecessor, exact
   `identity`, `checkpointSha256`, `authorityReference`, `ownershipReference`,
   `grantReference` and `grantSha256`.
3. Close only the verified predecessor view after
   `predecessor-close-ready` and an immediate identity readback. Preserve and
   report uncertain transitions, and stop on unverifiable ACK or settlement.
   Retain the verified `closure` with absent predecessor, both pane IDs,
   `ackSha256` and `authorityReference` to report the completed rotation.
   A rotation adds no worker, external verification or profile authority.

The helper reads and validates these observations and returns the next legal
chapter. The qualified relay owns any authorized timer or pane action. Retain
its action receipts in the checkpoint records. Status and routing require no
relay mutation and remain usable without a qualified relay.
