# OpenSpec operator runbook

See [external AI roles and backend setup](configurable-backends.md) for explicit role settings and route dispositions.
Confirm setup's exact external bytes separately from any profile update.
Match qualification to the current runtime bytes before admitting a pilot.

The [workflow](openspec-workflow.md) defines repository authority. Read the
integrated parent of the selected plan to determine the applicable policy.
The root `openspec-proposal: propose-to-freeze` marker applies prospectively
after integration. Retained plans keep their existing mode, policy and
approval. Installation does not select the workflow in another repository. Use the
[visual tutorial](openspec-operator-tutorial.md) for exact replies and the
[review configuration](openspec-review-configuration.md) for integrated policy,
review budgets, host pins and harness bindings.

## Prepare, approve and deliver

1. Use `$openspec-next inspect <full-change>` in Codex for P1–P8, exact HEAD,
   stopping predicate and evidence paths. Use `/openspec-next inspect
   <full-change>` in Hermes or a direct Claude install. For a marketplace
   skill in Claude Code use its `/openspec-development:` namespace. Inspect
   performs read-only checks. Resolve a missing or drifting prerequisite or
   reviewer through its qualified route before execution.
2. For a new change enter `/openspec-propose <slug>` or `/goal draft` with
   the goal or a readable note. The orchestrator verifies the baseline,
   chooses mode, generates the change name once, prepares the isolated
   checkout, and uses native planning. Include applicable native validation,
   issue readback and independent charter review. An opted-in and authorized
   proposal freezes one plan-only commit with its exact approval card.
   Append `draft only` or `no commits` to preserve the uncommitted stop.
3. Reply `changes: <feedback>` to revise within scope, `approve` to approve
   the displayed freeze only, or `approve and run` to also record a
   separately bounded local grant. A replacement freeze needs its own card.
   If identity, reply context or a prior handoff cannot be verified, use the
   explicit exact-identity approval and grant route.
4. After approval-only, use `$openspec-next <full-change>` with the bounded
   local grant. Under the selected policy local delivery works through
   eligible native scope, executable gates, exact independent review, and
   previewed commits and task progress. Retain restrictions such as
   `group 1`, `no commits`, and `keep the worktree`. Preserve original
   settlement evidence and finite budgets across corrections.

At a verified checkpoint use the footer's starter and concrete paths. The
Codex launcher is `codex --approve-for-me -C "$change_worktree" --add-dir
"$change_records"` with workspace-write and automatic approval review. Read back
the original grant, HEAD, plan digest, ownership and settlement before
resuming. For a qualified Herdr relay, use the separately authorized
[checkpoint rotation](../skills/software-development/openspec-delivery/references/operator-workflow.md#read-only-status-and-checkpoint-relay)
with the predecessor preserved through successor acknowledgement.

## Launch independent review

For Codex Auto-review under adopting integrated policy, prepare and check
the sealed export offline. Set `review_cli` to the absolute packaged
`scripts/review-candidate.mjs` path and replace the uppercase operands with
absolute paths. Run the selected line as a standalone Node command.

```text
node "$review_cli" --mode candidate --request REQUEST --expect EXPECT --export EXPORT --host-config HOST --admission ADMISSION --output OUTPUT
node "$review_cli" --mode approach --request REQUEST --expect EXPECT --export EXPORT --host-config HOST --admission ADMISSION --output OUTPUT
```

The live launch sends scoped export packets for
paid inference under the exact phase and cost authority verified by
`ADMISSION`. Codex still applies its permission checks. Replay the sealed
result offline before reading back acceptance. See the [reviewer runbook](claude-reviewer.md)
for inputs, inherited single-run authority and replay.
If automatic candidate execution reaches a lower review cap, a signed
extension can raise that cap within the original integrated limits and
existing ledger. Follow the [signed extension procedure](openspec-review-configuration.md#signed-execution-cap-extension).

## Finish and recover

After exact-candidate finish readiness, enter
`$openspec-delivery finish <full-change>` in Codex. This authorizes named
branch publication and protected implementation and record-only closure PRs,
integrated gates, receipt/archive, acceptance-bound issue closure and verified
dedicated-worktree retirement. Direct target push, force, bypass, branch
deletion, release, profile writes and subsequent changes require their own
authority. From another host use the equivalent activation syntax above.

1. Capture current target, exact reviewed PR head, official protection and
   rulesets, mergeability and review status. Inspect external trigger
   inventory immediately before each authorized push, PR event or merge.
   Only an exact verified $0 standing match under the integrated policy can
   proceed on standing authority. A separately authorized bundled finish
   grant can cover named events at their verified cost. Reserve each event
   by chapter and exact head before activation. Other paid or unknown triggers,
   external tests, retries, previews and tunnels need their own permission. See target,
   cases, approved built-artifact exposure, cost or credits, and one run
   before approving. Use loopback for local try-out. For an authorized
   tunnel, expose the built artifact only and verify immediate teardown.
2. Watch applicable required checks within the retained deadline. A pending
   optional app suite does not hold required protection. Resolve a stalled
   optional suite by recording an exact disposition or separately
   authorizing one retry. A bundled retry entry covers one verified transient
   $0 failure when the same check passed in a verified equivalent push run
   for the identical SHA. A required failure, unknown protection, human
   review, changed head, failed deployment or elapsed deadline pauses. Review
   the exact preview at the displayed URL when declared.
3. When the footer asks for `continue`, reply in the verified finish context.
   The orchestrator checks the same exact PR/head and grant against a new
   remote readback. Preserve the original deadline and restrictions. If it
   expired, authorize a new bounded wait for the same PR and head. A changed
   head needs fresh applicable gates and review and a matching grant.
   For a scoped PR fix after a zero-waiver review, verify the exact reviewed
   ancestor, ordered fix range and independent final-head disposition with
   complete coverage. Retain the lineage through integration and archive.
   Use full exact-head review when the targeted evidence is insufficient.
   Unknown write outcomes require readback before any retry.
4. Once protected merge is verified, run the declared integrated gates on
   the actual containing revision. Prepare the receipt and record-only
   archive. Run full `npm test` on the exact archived tree using the packaged
   disposable gate procedure and obtain a fresh independent factual review
   bound to its SHA and gates before publishing the closure PR. Use a factual
   issue link and explain that the issue will be closed explicitly after
   protected merge and archive readback. Automatic closure could precede that
   evidence. Verify the accepted receipt, close explicitly, and read back the
   issue state. A failure pauses for
   evidence, repair or revert within its own authority.
5. Reconcile all verified dedicated worktrees from this and earlier runs.
   Remove individually without force only when the fresh preview permits it.
   Recheck registration and path absence and retained refs after each removal.
   Leave locked, dirty, ambiguous or retained worktrees in place. A repeated
   finish resumes pending cleanup and preserves accepted archive and issue
   evidence. Start from the primary checkout and retained records if the
   original checkout has already been removed.

The packaged [protected finish reference](../skills/software-development/openspec-delivery/references/protected-finish.md)
defines the evidence passed to the read-only helpers.

## Optional profile sync

After applicable publication or accepted integration with deployment
inapplicable, `$openspec-delivery sync-skills <full-change>` presents the
update for a named client/profile, immutable source revision and selected
scope. Give an explicit separate authorization for that selection. Perform
the approved update in an operator-controlled session outside the project.
For scanner-managed Hermes packages use normal hub discovery and scanning.
For reviewed native Codex copies use
`npm run install:local -- --update --client codex --user-home "$selected_user_home"`
from the named revision. Use the operator-approved absolute user-home path.
Preflight collisions and check installer scope before proceeding. Use the
regular backup behavior. Keep backups outside discovery, compare the full
installed package bytes and current top-level and applicable upstream
`metadata.version`, then load the updated skill in a fresh session. If a
scanner or collision check blocks the path, preserve the installed copy and
report the cause. For rollback, review and restore the intended backed-up
copy from an operator-owned context, then repeat the inventory and fresh-session
verification. Pin upstream sources by commit and preserve provenance.

For repository development in Hermes, use `skills.write_approval = true`,
`skills.creation_nudge_interval = 0`, `curator.enabled = false`, and
`auxiliary.background_review.enabled = false` in a selected scratch profile.
These settings protect actively edited canonical packages against unintended
skill writes and automatic maintenance. A curator lock or a change to live
profile settings requires its own operator action. Use scratch homes and
profiles for package, installer and deployment verification. A running skill
session preserves the shared installed package.
