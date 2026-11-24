---
name: openspec-delivery
description: Automate setup, execution and closeout of OpenSpec changes.
version: 1.5.0
author: Raphael (forgegod), Hermes Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [OpenSpec, Git, Review, Evidence]
    related_skills: [openspec-next, git-commit-message, capability-wireframes, autonomous-implementation-review]
---

# OpenSpec Delivery

Preserve a reviewed committed candidate and truthful post-merge evidence for one
OpenSpec change in a project that explicitly selects this workflow. This is an
orchestrator procedure, not a scheduler, distributed lock, approval service or
GitHub API client, and installing OpenSpec or this package never selects it.
The agent handles the plumbing; the operator selects scope and exceptions.
Use the local capture, seal and offline readback interfaces for byte-preserving
gate, readback and review evidence. [Evidence retention](references/evidence-retention.md).

## When to Use

- The project's contributor contract uses OpenSpec for the selected change.
  Installing this package does not select that workflow or transfer another
  project's records.
- An operator authorizes bounded specification, implementation, review,
  documentation or recovery. A planning-only request ends at
  proposal/spec/design/tasks plus a bounded issue write only when the project's
  explicitly selected proposal policy includes it.
- Do not use to create a second task tracker, or to require a GitHub issue
  before local specification can begin. The selected policy requires the verified
  issue before plan approval, not before drafting.

## Prerequisites

- Node 22+ and Git for the packaged read-only `scripts/change-guard.mjs` helper.
  Install the complete package: both Git helpers require `scripts/git-environment.mjs`.
  Read [references/git-environment.md](references/git-environment.md) for the child
  allowlist, trusted configuration selectors and native-platform acceptance limits.
- A separately reviewed OpenSpec CLI/native workflow installation; this package
  does not install it or assert host execution support.
- Explicit project policy naming target, required gates, evidence retention and
  source/deployment completion boundaries.
- For a documentation or review record: a real issue or pull request with explicit
  authority. A project may include one issue in an authorized new proposal;
  installation alone never grants that authority. Offline work leaves the link
  pending and the proposal unready for approval. Never invent remote state. Follow
  [references/ticket.md](references/ticket.md): one risk-focused issue, no task
  list. The full OpenSpec change name is the identity; reuse it exactly.

## Authority and writers

The orchestrator is the sole Git and task-progress writer for this change.
Implementers edit implementation/tests and report results; reviewers are read-only.
The stock OpenSpec apply action normally updates tasks: mediate that behavior in
its handoff so it cannot compete with the designated writer. A checked task means
implementation progress, not merge, deployment or acceptance.

Use operator-serialized starts and handoffs per change. Assignees, comments and
refs detect observed conflicts; they are not a lock. Missing authority or an
unknown write outcome blocks the mutation. A selection snapshot never grants
permission for a later action.

When project policy explicitly adopts the short-invocation contract below, sending
an execution invocation authorizes its bounded local operations, including
autonomous local commits through `git-commit-message`: preview exact batches and
continue without another confirmation. Operator restrictions override defaults,
including natural-language restrictions such as `inspect only`, `no commits`,
`group 1 only`, or `keep the worktree`. A missing policy is not implied consent:
present the bounded contract once for adoption, not a command-by-command quiz.
Exact Goal Contract or plan approval, risk acceptance, remote publication and
host permission checks remain separate from local authority. Never infer
approval from `next`.

Before freeze or execution, apply
[references/delivery-policy.md](references/delivery-policy.md): verify the
integrated plan parent, derive policy only from its contributor contracts, and
check declared contributor-contract paths and independent goal alignment, without
a separate approval checkpoint for in-scope edits. Retain exact planning identity. Verified
pre-adoption legacy plans defer only those integrity guards until refreeze.
Pre-execution review and continuous-goal continuation require explicit selection
at that parent and the available orchestration package. Otherwise preserve
single-group behavior and existing approval; later policy edits cannot widen it.
Working-tree and committed unintegrated contract changes remain inert for their
own change through integration, including authority, review, commits and continuation.
The [delivery runtime](references/delivery-runtime.md) supplies policy, preflight,
workspace, decision, status, handover and finish-readiness commands. Use the
verified integrated parent to select Goal-First for eligible reversible local
work when it explicitly opts in. Use Task-Guided for prescribed methods, ordered
dependencies, staged authority or an absent opt-in. Preserve frozen approvals.
Both paths require matching approval and separate bounded local execution authority.

## Parallel specification and documentation

When project policy selects collision-resistant naming, follow
[references/naming.md](references/naming.md) before upstream proposal scaffolding:
the operator supplies a slug; the agent runs `scripts/change-name.mjs` to generate
one `<slug>-<lowercase-ulid>` name. Use `change/<full-name>` for the authorized
branch through specification, implementation and review. Resolve existing changes
without generating another suffix; ambiguous short names require selection.
Existing names and branches stay unchanged. This is a project-instruction step,
not an upstream CLI hook, adapter modification, branch grant or second tracker.

OpenSpec owns the proposal, delta specs, design and `tasks.md`. This skill does
not author a second specification. For new or revised unfrozen plans, apply
[references/task-authoring.md](references/task-authoring.md) to generation and
planning review: the fewest complete outcomes, not procedural checklists or a
fixed task-count target. Never automatically rewrite an approved frozen plan.
Independent changes may be specified and
implemented concurrently in separate checkouts, one orchestrator each. A
dependent change may be specified against an explicit prerequisite; its
implementation waits for that prerequisite's accepted integrated revision, not
for a ticket state.

When two active changes touch the same capability spec, reconcile the overlap
before either merges. A clean Git merge is not compatibility evidence.

GitHub issues and pull requests are documentation and review records. Proposal-time
creation or reuse of one issue requires both explicit project adoption of that step and
an operator-authorized proposal that includes the bounded issue write.
Otherwise use the separately authorized `document <name>` invocation
in `references/ticket.md`. PR creation and later issue updates need separate
authority. Link the OpenSpec change and, for a review, the exact
candidate SHA. Do not put the task list in the issue, and do not invent a ticket so a helper command will run. Do not write that the issue is ISO/IEC
27001 compliant. Closing an issue does not archive a change. Archiving a change
does not close an issue unless that documentation write is separately authorized.
For metadata-enabled projects, bind the verified issue URL in proposal frontmatter
before approval and keep it unchanged by default. No PR metadata or second index
is needed. Follow the project's metadata validator; keep identity metadata covered
by the plan digest. An authorized correction after approval requires reapproval.
Archive moves preserve change identity; current specs must not inherit it.
When the project requires frontmatter-free deltas, keep their identity
path-derived and run its metadata checker independently of upstream validation.
Proposal/design/tasks and current specs can carry the project's identity schema. After spec sync, add the schema to newly created current specs
under the same authorized scope and revalidate; native OpenSpec does not add it.

Before a pull request is merged, and before its branch is deleted, require a
verdict from `/autonomous-implementation-review` by a reviewer that did not
implement that candidate. The verdict binds the exact SHA. Disposition every
finding. The implementer cannot review its own candidate. That verdict is not
a GitHub approving review and not risk acceptance. If the host cannot run a
different reviewer, stop.

The helper's review and receipt commands cite a documentation issue URL when
those evidence records are produced. That URL is not admission. Do not call
those commands without a verified, authorized issue.

## Short invocation

Use the installed client's spelling. These examples select `pin-note` under
the same project authority boundary:

| Host | Local delivery | Protected finish |
| --- | --- | --- |
| Codex | `$openspec-delivery pin-note` | `$openspec-delivery finish pin-note` |
| Hermes or direct Claude Code skill | `/openspec-delivery pin-note` | `/openspec-delivery finish pin-note` |
| Claude Code with the marketplace plugin enabled | `/openspec-development:openspec-delivery pin-note` | `/openspec-development:openspec-delivery finish pin-note` |

The Hermes/direct forms show the available verbs:

```text
/openspec-delivery <name>
/openspec-delivery prepare <name>
/openspec-delivery finish <name>
/openspec-delivery document <name>
```

`<name>` may be the full name or an unambiguous short slug. With no name, or
`next`, reuse only verified current-change context; otherwise select through
`openspec-next`. A longer prompt is not required. Never ask the operator to type
a ULID or remember a worktree path. Load [references/continuation.md](references/continuation.md).

- Default / `next`: deliver the single approved Goal-First outcome or resume the
  next unfinished task group in approved Task-Guided delivery. Create/reuse its isolated checkout,
  bootstrap, implement, verify, independently review, record native progress,
  and preview authorized local commits. Task-Guided stops after one group by
  default; selected continuous-goal policy rechecks eligibility and authority for
  consecutive groups until its declared stop.
  Local execution does not authorize push, a pull request, merge, issue closure or retirement.
  Recover an already integrated change from
  actual readbacks under held finish authority.
- `prepare`: workspace setup/bootstrap only. No implementation, commits or remote
  writes. For a new proposal the project's selected proposal policy can invoke
  this recipe internally after naming and before upstream scaffolding.
- `finish`: explicitly authorizes this change's branch publication, implementation
  and record-only closure PRs through the protected route, integrated gates,
  factual receipt/archive commits, issue closure when acceptance is satisfied,
  and removal of clean dedicated worktrees. No direct target push, bypass,
  force-push, release, branch deletion or next change. Require exact candidate acceptance and current-spec
  promotion through `finish-readiness` first; do not implement missing groups under `finish`.
- `document`: load `references/ticket.md`, create/reuse one issue, read it back,
  bind its verified URL, then stop. No implementation, commits or PR. Reuse
  does not authorize rewriting an existing issue. No second task list.

For narrower work, append only the exception: `group 1`, `no commits`, or
`keep the worktree`. Persist no permission flag in task frontmatter. Earlier
restrictions continue until explicitly lifted; a bare `next` never cancels them.

## Procedure

If the project selected the exclusive worker runtime, use the sealed
assignment and original-attempt readback in
[references/delivery-runtime.md](references/delivery-runtime.md#configured-exclusive-worker-runtime).
Proceed only with the pinned pair, atomic claim and role admission,
native containment and verified settlement. Check the exact file allowlist
when admitting settled worker outputs from the native containing-directory roots
before forming the candidate. Both modes require exact gates and contained
review from the bound independent session. Ordered successors replay
predecessor acceptance. Goal-First review binds the candidate and approved
Goal Contract digest. Corrections retain authority, restrictions and consumed
budgets. Missing or uncertain evidence stops the selected route. The pinned
dedicated Codex and read-only Claude pair passed sealed synthetic qualification
on one Linux host. Verify the exact runtime and role records and require separate
authority for each provider run.

1. If the request is `document <name>`, perform only the short invocation above.
   Read back the issue. Stop. Do not continue this procedure.
2. Read the contributor contract and selected native change artifacts. Confirm
   explicit authority, approved scope, dependencies, risk and gates. Do not invent
   a second task table or a GitHub ticket. The native `tasks.md` is the task authority.
3. Check recovery first: use `references/recovery.md` for dirty/unowned work,
   competing activation, an existing PR, an uncertain API outcome or a prior merge.
   Preserve work; do not start another executor or replay merged implementation.
4. Automatically prepare/reuse a separate clone/worktree through
   [references/workspace.md](references/workspace.md); do not require manual setup.
   `prepare` stops after bootstrap. Isolate mutable test resources per change.
   Independent changes may run concurrently; dependent execution waits for accepted
   integrated prerequisite evidence. One implementation writer per change initially.
5. Prepare native proposal/spec/design/tasks. Task-Guided approval binds the
   immutable plan commit and normalized digest. Goal-First approval binds the
   committed Goal Contract and its mode-specific digest, with one native local
   outcome checkbox. For uncertain breaking upgrades before contract lock, use
   the [bounded scratch discovery procedure](references/external-verification.md)
   when explicitly authorized. Before freezing, run the policy/contract checks
   above and, when selected, retain an independent approach review of the complete
   planning hash set through orchestration's `references/portable-core.md`.
   Re-hash after approach review. Freeze readiness precedes exact approval.
   Task-Guided only normalizes native checkbox progress. Goal-First can adapt
   implementation choices and declared legacy assumptions within the approved
   promise. Changes to covered identity or authority require renewed approval.
   Only the orchestrator may create commits, with explicit local commit authority.
6. Use the runtime `decision` at dispatch, each boundary, correction and result.
   Check retained P1–P8 inputs before dispatch. Implement only the authorized
   outcome or task group. A routine in-scope failure consumes the held correction
   budget. Stop on `DIRECTION_DRIFT_CHOICE` and report the conflicting clause. `finish` skips implementation
   and resumes at its actual publication/integration/closure boundary. Retain actual
   gate output and report failed prerequisites. When the project's role loop is selected,
   load `autonomous-implementation-review` and its OpenSpec reference; unsupported
   hosts stop rather than inventing model/session commands. For terminal workers,
   validate the artifact-first handoff with orchestration's `readHandoff` before
   using its report as evidence. Completion, review verdict and delivery acceptance
   are distinct; neither worker output nor a missing result advances tasks.
7. Freeze a clean committed candidate. Capture gates from a clean disposable
   checkout at that exact SHA. For a declared UI flow verify local-only try-out
   and accessible-name checks. Route a separately authorized deploy preview to
   its own pre-merge review pause. Use `references/guard.md` for candidate
   and review checks. Independently review its exact full SHA, delta specs,
   implementation, executable evidence and current-behavior changes. Review is a
   gate within this change, not a new change for every comment. Use orchestration's
   canonical correction loop: eight cumulative automatic cycles or a narrower
   inherited group/authority limit, never reset on refreeze or role change. A changed
   candidate invalidates review; confirmed defects are not silently waived.
8. Before an authorized publication, load `references/integration.md` and
   require positive exact-SHA `finish-readiness` with valid promoted current
   specs. Use the [external verification boundary](references/external-verification.md)
   for trigger inventory, distinct single-run approval, reservation, artifact-only
   exposure and immediate teardown. Re-read the
   actual target and shared capability specs. Reconcile semantic overlap. Include
   implemented behavior, specs and current visuals in the review record. A clean
   Git merge alone is not compatibility proof. A pull request is that review
   record, not the task list.
9. Publish or integrate only with separately explicit authority. When the project
   uses a protected pull request or merge queue, required up-to-date checks are
   project prerequisites, not supplied by this skill. The initial guard requires
   reviewed candidate ancestry: squash or rebase integration is unsupported, not
   a reason to weaken checks or silently change repository settings.
10. Read back the real integrated commit and containing target. Execute the actual
   required gates on a named integrated/containing revision and retain output.
   Failure blocks completion and requires an explicit repair/revert decision.
11. Only after successful integrated verification, prepare an append-only truthful
    receipt and record-only archive PR. Use the receipt check and independently
    review factual claims. Do not reapply deltas already incorporated in current
    specs; reconcile differing current specs explicitly. An archive requiring new
    current-spec changes needs renewed verification, not a record-only exception.
12. Under `finish` authority, retire clean dedicated worktrees using `workspace.md`
    and verify closure and cleanup by exact readback. A documentation issue closes
    only when that write is authorized and its acceptance boundary is satisfied.
    Evidence publication ends here: no extra pull request solely attesting the
    previous receipt, no next change, automatic release or implied cleanup.

## Pitfalls

- Plan digests and JSON validate structure, not human approval or test truth.
  The helper does not authenticate a reviewer, execute gates or inspect GitHub.
- The helper fails closed on planning bytes that are not UTF-8, on replace refs,
  graft files and similar Git topology rewriting, and on task syntax it cannot
  classify unambiguously; fix the input instead of relaxing the check.
- OpenSpec verification is not a substitute for executable project gates,
  independent review or protected integration. Config guidance is not enforcement.
- Do not commit prospective merge results or put closing keywords on an
  intermediate implementation commit or pull request while later acceptance is
  still required. After acceptance, the receipt or archive commit carries
  `Fixes #<issue>` and `Closes #<pull-request>` only for an already merged pull
  request. That trailer does not push. It takes effect only when the commit is
  merged into the default branch.
- Preserve exact IDs, failures and rejected candidates. Never rename a conflicting run, unassign an operator or discard dirty work.
- A shared-profile package must not update/remove its installed copy while
  operating in a project. Source adoption is not installed-profile permission.

## Verification

Report the actual candidate/plan digest, independent review and executed gate
references. After authorized integration, report verified target SHA, post-merge
receipt/archive, the receipt file's SHA-256 and closure readbacks separately. A
local `ok: true` means only that the helper's structural checks passed; incomplete
or unperformed remote steps remain explicitly pending. Stop at the operator's
authorized boundary.

Parent-selected charter-v1 convergence uses the bounded operator procedure in `autonomous-implementation-review/references/portable-core.md`; strict review remains the fallback and readiness grants no freeze, approval, execution or remote writes.
