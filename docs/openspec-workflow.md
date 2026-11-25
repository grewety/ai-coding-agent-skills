# OpenSpec SDLC

This distribution supports one lifecycle: OpenSpec for specification and task
progress, plus five companion skills for the boundaries OpenSpec does not
enforce. Installing a package does not select the workflow for another project,
transfer that project's records, or grant Git or GitHub authority. Projects that
already keep older records leave those records in place.

OpenSpec's own CLI and native workflows remain a separate prerequisite. Follow
[Install the upstream OpenSpec prerequisites](openspec-installation.md) for the
authoritative seven-skill inventory, host-specific installation/enablement and
loading checks. This repository does not vendor them. Use OpenSpec 2.1.1 through
its npm package on Node 22.20.0+, with Git. Review upstream packages before
executing them. Verification is
a mandatory setup skill but an advisory workflow: `/openspec-verify-change` for
a direct Claude skill.
It is not an `openspec verify` CLI command and does not block archival by itself.

The picture and the field-notes walk-through below are unexecuted examples.
Displaying them grants no Git or GitHub authority.

## Short operator commands

For new and revised unfrozen plans, use
[minimum-outcome task authoring](../skills/software-development/openspec-delivery/references/task-authoring.md).
The fewest complete goal-oriented outcomes must still preserve scope, safety,
verification and necessary dependency/authority/ownership boundaries. Each outcome
includes its tests and documentation; no fixed task-count target applies. Carry
the rule through OpenSpec `rules.tasks` and planning review; inspect generated
instructions and reject both unnecessary fragmentation and harmful over-merging.
Strict CLI validation does not prove semantic minimality. Existing approved plans
remain unchanged; native `tasks.md` stays the sole mutable progress authority.

Apply [delivery policy](../skills/software-development/openspec-delivery/references/delivery-policy.md)
before freeze and execution. Read it from the verified integrated plan parent.
Review declared contributor-contract edits for alignment at the exact candidate.
Goal-First and low-touch markers apply through a verified adopting integrated
parent. Existing frozen approvals retain their original boundaries.
[Operator tutorial](openspec-operator-tutorial.md).

| Mode | Select when | Local approval and execution |
| --- | --- | --- |
| Goal-First | The verified integrated parent opts in, work is reversible and local, and the boundary has no prescribed method, ordered dependencies or staged authority. | Approve the exact committed Goal Contract and its digest. Record a separate bounded local grant. Advance one native local outcome checkbox through verification and independent result review. |
| Task-Guided | An ordered dependency, prescribed method or staged authority applies, or the verified parent has no valid opt-in. | Approve the frozen plan SHA and normalized digest and record the separate local grant. Advance the first eligible native group in order. Default to one group. Selected continuous-goal allows consecutive eligible groups within held budgets, declared stops and narrower operator restrictions. |

Selected pre-execution review requires the optional orchestration package's
matching whole-plan review before freeze and execution. When the parent also
selects charter-v1, use the bounded convergence procedure. The portable core
runs without Hermes or Herdr. Terminal dispatch requires a qualified adapter.

### Host spelling

Use the syntax for the way the skills were installed. These examples select
the same change and preserve the authority and restrictions below.

| Host | Continue | Inspect | Local delivery | Protected finish |
| --- | --- | --- | --- | --- |
| Codex CLI or IDE | `$openspec-next pin-note` | `$openspec-next inspect pin-note` | `$openspec-delivery pin-note` | `$openspec-delivery finish pin-note` |
| Hermes CLI | `/openspec-next pin-note` | `/openspec-next inspect pin-note` | `/openspec-delivery pin-note` | `/openspec-delivery finish pin-note` |
| Claude Code, direct personal or project skill | `/openspec-next pin-note` | `/openspec-next inspect pin-note` | `/openspec-delivery pin-note` | `/openspec-delivery finish pin-note` |
| Claude Code, enabled marketplace plugin | `/openspec-development:openspec-next pin-note` | `/openspec-development:openspec-next inspect pin-note` | `/openspec-development:openspec-delivery pin-note` | `/openspec-development:openspec-delivery finish pin-note` |

In Codex, `/skills` also opens the skill picker. If a Hermes built-in command
collides with an installed skill, use `/skill openspec-next inspect pin-note`
or `/skill openspec-delivery pin-note`. [Codex skill invocation](https://learn.chatgpt.com/docs/build-skills#how-chatgpt-and-codex-use-skills), [Hermes dynamic CLI commands](https://hermes-agent.nousresearch.com/docs/reference/slash-commands#dynamic-cli-slash-commands), [Claude Code skill locations and namespacing](https://code.claude.com/docs/en/skills#choose-where-skills-load).

The agent owns the Git plumbing. This project explicitly selects the following
invocation contract; other projects must adopt it in contributor instructions.
Installing skills, displaying examples or approving a plan does not execute it.
Operator restrictions override defaults and remain effective on a bare `next`.

| Request | Agent behavior and authority |
| --- | --- |
| `/openspec-propose add-dark-mode` | Generate the name, prepare/reuse an isolated workspace before native scaffolding, draft the plan and bind the proposal-time issue. No implementation or commits. |
| `/openspec-next` | Resolve the current change and advance its approved local outcome or eligible Task-Guided group through setup, bootstrap, implementation, gates, independent review, task updates and autonomous local commits with previews. Publication needs separate authority. |
| `/openspec-next pin-note` | The same, selecting an unambiguous short slug; no operator-typed ULID. |
| `/openspec-next inspect` | Read-only selection and evidence/approval/dependency assessment. No setup, bootstrap, dispatch or Git writes. |
| `/openspec-delivery pin-note` | The same bounded local continuation as next, for the selected change. |
| `/openspec-delivery prepare pin-note` | Only prepare/reuse and bootstrap its workspace; no implementation, commits or remote writes. |
| `/openspec-delivery finish pin-note` | Separately authorize that change's frozen candidate publication, protected implementation/closure PRs, integrated gates, receipt/archive commits, acceptance-bound issue closure and clean dedicated worktree retirement. |
| `/openspec-delivery document pin-note` | Create/reuse one documentation issue, read it back and bind its URL; no implementation, commits or PR. |

Normally propose, approve the exact identity selected by policy and grant the
local run through `/openspec-next`. Task-Guided can resume another eligible
group of the same change. The agent does not stop between worktree
creation, bootstrap, testing and local commits to ask for the same authority
again. It stops for missing approval, ambiguous selection/ownership, failed gates,
review findings needing disposition, unsupported roles, or a new side-effect
boundary. It offers the short `finish` invocation after exact-candidate readiness
verifies completed native work and promoted current specs. A bare next never
grants remote authority.
With existing finish authority, resume remaining closure steps automatically;
never ask again for each receipt, archive or clean-worktree removal.
A published pull request that is only waiting for review or checks is a normal
pause under that same finish, not a new exception. When the wait ends, resume
with the same finish invocation if that authority is not already held. Read
the actual pull request and continue. Do not open another pull request or
replay merged work. A changed head, failed required check, or missing
protection is the exception: report it, then resume the same finish after it
is cleared. `/git-commit-message` does not push. Implementation commits do
not use a closing keyword. The next push does not close the issue or the pull
request. Use the protected route and explicit issue closure after the verified
receipt and archive readback.

A direction change needs only the exception, for example
`/openspec-delivery pin-note group 1 no commits` or
`/openspec-delivery finish pin-note keep the worktree`.
Finish does not approve findings/risk, bypass protection, push the target directly,
force-push, delete branches, release or start another change. Earlier conflicting
restrictions need an explicit change, not silent cancellation. Host/tool approval
controls and reviewer pane-selection requirements remain in force.

The workspace recipe and read-only helper validate canonical paths, exact base,
branch registration, creation/reuse and clean retirement; the orchestrator runs
and verifies their argument arrays. Worktrees isolate the directory/index, not
shared Git refs, services, caches or agent identity. Bootstrap uses the target
project's documented recipe, not invented dependency commands. Existing dirty
work, detached/locked trees, collisions or missing plan ancestry require recovery,
not reset/copy/another ULID. Independent clones remain supported for evidence.
See [workspace](../skills/software-development/openspec-delivery/references/workspace.md)
and [continuation](../skills/software-development/openspec-delivery/references/continuation.md).

The canonical lifecycle package is `openspec-delivery`; `openspec-change-integration`
is no longer distributed. Installed copies are unchanged by source edits. Do not
load old and new lifecycle instructions together. A separate operator-authorized
installation/retirement must preserve local customizations and old hub registration.
The local installer never interprets a new package name as deletion permission;
only its explicit reviewed `--purge` manifest can retire a matching old package,
after preserving the package and matching registration in a backup. No running
shared-profile skill removes itself.

## Lifecycle picture

OpenSpec skills own the change package. The five companion skills own the
boundaries OpenSpec does not enforce. Under the selected metadata policy, an
authorized new proposal includes its documentation issue before approval. A pull
request still needs separate authority. Neither becomes the task list.

An isolated checkout is an agent-managed workspace, not a lifecycle phase or a
manual prerequisite. The operator does not create it: after an authorized proposal
request the agent creates or reuses it before drafting, and later invocations
reuse it. The same applies to bootstrap and authorized clean-worktree retirement.
If ownership, tooling or permissions block that work, the agent reports the
specific decision needed instead of handing the operator a Git checklist.

The two lanes show a Task-Guided example with **operator actions** and
**automatic agent work within the selected invocation's authority**. Arrows
crossing into the operator lane mark decisions or authorizations. Goal-First
uses the same lifecycle with one local outcome and one exact contract approval.
Independent review is `/autonomous-implementation-review` on the exact candidate
SHA. Under `/openspec-next` the agent loads that skill; pane handoff and finding
disposition remain operator checkpoints.

```mermaid
flowchart TB
  subgraph operator["Operator actions"]
    idea["Describe the desired outcome<br/>Optional: /openspec-explore"]
    propose["Request a proposal<br/>/openspec-propose pin-note"]
    approve["Review the plan and proposal visuals<br/>Approve scope or request changes"]
    next["Start or continue local work<br/>/openspec-next"]
    finish["Authorize terminal delivery<br/>/openspec-delivery finish pin-note"]
    decision["Resolve a reported blocker or provide<br/>a required human or host approval"]
  end

  subgraph agent["Agent work - automatic within authority"]
    workspace["Generate the identity and create or reuse<br/>the isolated worktree"]
    plan["Draft native planning artifacts and issue link<br/>Add proposal wireframes when needed"]
    ready["Check plan approval and dependencies<br/>Reuse the workspace and bootstrap"]
    implement["Implement one task group via native apply<br/>Gates, task updates, /git-commit-message<br/>No closing keyword and no push"]
    review["Independent review via /autonomous-implementation-review<br/>Exact candidate SHA, bounded corrections, renewed verification"]
    groups{"More approved<br/>implementation groups?"}
    publish["Publish or reuse one PR<br/>Exact reviewed SHA, valid spec promotion, checked triggers"]
    reviewWait{"Protected checks, human review<br/>and any declared preview satisfied?"}
    pause["Report that open PR and stop<br/>Waiting is normal, not a new authority"]
    verify["Read back the integrated revision<br/>Verify the final revision and current specs"]
    closure["Commit factual receipt<br/>Native archive and the closure PR"]
    cleanup["Read back closure and archive<br/>Explicitly close issue and retire clean worktrees"]
    done(["Change complete<br/>Stop; no next change"])
  end

  idea --> propose --> workspace --> plan --> approve
  approve -->|Approved plan| next
  approve -->|Request changes| plan
  next --> ready --> implement --> review --> groups
  groups -->|Yes: wait for next invocation| next
  groups -->|No: wait for finish authority| finish
  finish --> publish --> reviewWait
  reviewWait -->|Yes: merge the same SHA| verify --> closure --> cleanup --> done
  reviewWait -->|Not yet: typical wait| pause
  pause -->|Same finish, later| finish
  workspace -.->|If blocked| decision
  ready -.->|If blocked| decision
  review -.->|If disposition or approval is needed| decision
  reviewWait -.->|Blocked: failed check, changed SHA, or missing permission| decision
  decision -->|That PR block is cleared| finish
  verify -.->|If verification fails| decision
  cleanup -.->|If preservation or cleanup is blocked| decision
```

### When the operator acts

| Checkpoint | Operator action | What the agent handles automatically |
| --- | --- | --- |
| Before the first run | Review/install the required tools and skills, select the project workflow, and authorize any host/role configuration. | Inspect the actual project contracts, tooling and configured execution roles; report missing prerequisites. Installation alone does not start work. |
| A new request | Describe the outcome and send `/openspec-propose pin-note`; exploration is optional. | Generate the full name, prepare the isolated workspace, draft native artifacts, bind the authorized proposal-time issue and add proposal wireframes when needed. |
| Plan review | Approve the exact Goal Contract or frozen Task-Guided plan, or request changes. Approval binds the immutable revision and mode-specific digest presented by the agent. | Validate the planning artifacts and present the approval boundary. Execution requires a separate grant. |
| Local implementation | Send `/openspec-next`, or select a change once with `/openspec-next pin-note`. | Resolve and execute the approved local outcome or eligible Task-Guided group through setup/bootstrap, implementation, gates, `/autonomous-implementation-review`, task updates and previewed local commits. Publication and issue closure require separate authority. |
| Terminal delivery | Send `/openspec-delivery finish pin-note` for the reviewed candidate after positive finish readiness. | Publish or reuse one implementation PR. Pause for outstanding checks, human review or declared preview acceptance. Resume the same PR under held finish authority. After protected integration and named-revision gates, file the factual receipt and native archive in a record-only closure PR, then verify issue closure and clean-worktree retirement at acceptance. |
| Pull-request wait | Leave the open pull request. When review or checks finish, or a real block is cleared, send the same `/openspec-delivery finish pin-note` only if that authority is not already held. | Read the actual head, checks and reviews. An unchanged reviewed SHA with satisfied protection continues into merge and closeout. Do not open a second pull request, replay implementation, bypass protection, or ask for a different authority. A changed head needs renewed gates and `/autonomous-implementation-review`. |
| An exception | Resolve ambiguous ownership/selection, changed scope, failed verification, findings needing disposition, a pull-request head that changed, missing protection, or host/tool permission prompts when asked. | Preserve work and evidence, state the exact blocker and needed decision, then resume the interrupted step under the retained authority. Do not replay merged work or silently skip a gate. |

The diagram is not a promise of unattended execution: required human PR approvals,
host/tool permission controls and the configured role protocol still apply. In
particular, role execution requires a qualified terminal adapter (with Herdr
used only as a prequalified same-session human-input fallback). Routine Git
commands are automated; these decisions are not.
Operator restrictions such as `no commits` or `keep the worktree` override the
automatic actions shown. An ordinary `next` never supplies finish authority.

Waiting for protected checks and human review is the normal pause after a pull
request is opened, not an exception and not a failed finish. The agent reports
that pull request and stops. It does not poll unattended, open a second pull
request, or ask for a new kind of authority. There is no scheduler. When the
review lands or a block is cleared in the meantime, the same
`/openspec-delivery finish` resumes from the actual pull request. The return
to finish in the picture is only for that pull-request wait; other blockers
resume the step that reported them. Continue only if that head is still the
reviewed SHA and required checks and reviews are satisfied. A changed head
invalidates the previous review and needs renewed gates and
`/autonomous-implementation-review` before merge. Do not bypass protection,
replay implementation, or merge under `next`. The same pause and same-finish
resume apply to the record-only closure pull request; do not open a second
one while that pull request is waiting.

Implementation and closure commits and PR bodies use factual issue
references. Under protected explicit closure, omit a closing keyword such as
`Fixes #<issue>`. The next push does not close a documentation issue. A
keyword on the default branch could close it before finish reads back the
actual integrated gates, record-only merge and archive receipt. Finish verifies
those records, explicitly closes the issue under the named grant, and reads the
result back. [Protected finish](../skills/software-development/openspec-delivery/references/protected-finish.md).

Parallel changes are two of these pictures at once, in separate checkouts.
They share neither an index nor a `tasks.md`. A parent issue may list both
links. It does not own either task list.

Host spelling differs. The documented direct-directory Claude Code and Hermes
routes use `/openspec-<action>` with the exact skill names below. Codex uses
`/skills` to select the skill or `$openspec-<action>` with the same exact name.
The qualified Claude generation route writes the same named skills under
`.agents/skills` and links them from `.claude/skills`. Verify actual loading in the
intended client separately.

This SDLC assumes all seven setup skills in the
[authoritative prerequisite inventory](openspec-installation.md#required-upstream-inventory).
Examples use the direct Claude Code/Hermes spelling. Codex users select the
same skill through `/skills` or use the skill mention below.

| Action | Direct-directory Claude Code / Hermes | Codex skill mention |
| --- | --- | --- |
| Think before a plan | `/openspec-explore` | `$openspec-explore` |
| Create the change and its planning artifacts | `/openspec-propose` | `$openspec-propose` |
| Revise planning artifacts | `/openspec-update-change` | `$openspec-update-change` |
| Implement tasks | `/openspec-apply-change` | `$openspec-apply-change` |
| Merge accepted delta specs into current specs | `/openspec-sync-specs` | `$openspec-sync-specs` |
| Move the finished change to the archive | `/openspec-archive-change` | `$openspec-archive-change` |
| Review completeness, correctness and coherence | `/openspec-verify-change` | `$openspec-verify-change` |

Verification is required at setup but advisory in use. It does not replace project
gates, independently block archive, or archive the change. It is not an
`openspec verify` CLI gate.

## Short operator checkpoints

For a later plan whose verified integrated parent explicitly selects
`propose-to-freeze`, a short proposal or `/goal draft` can reach a validated
plan-only commit and one current approval card. The [packaged operator workflow](../skills/software-development/openspec-delivery/references/operator-workflow.md)
defines the parent marker, native validation and review readbacks, and card
records. Under prior policy or `draft only` / `no commits`, stop at the
uncommitted draft after applicable review. Apply clear `changes: …` feedback
within scope, revalidate and review, and replace the card only after an
authorized refreeze. A consumed or superseded card cannot authorize the new
revision.

A verified immediate `approve` records exact approval only. `approve and run`
also records a separate bounded local grant for the displayed scope, gates,
role pair and restrictions. Both records must read back before combined
dispatch. This authorizes bounded local execution under the selected contract.
Finish publication, each paid or external run, retry, tunnel and preview, and
any profile write need their applicable separate authority.

Use `$openspec-next inspect <full-name>` in Codex for read-only inspection. Use
the rendered Next-Step Footer to find the current stop, retained evidence and
legal next input. At a verified clean checkpoint, use its concrete paths to
start a fresh session:

```sh
codex --approve-for-me -C "$change_worktree" --add-dir "$change_records"
```

The [operator runbook](openspec-operator-runbook.md) covers the exact short
inputs, bounded protected waits, partial cleanup, and optional profile sync.

The flag selects workspace-write with automatic approval review. The starter
points to an exact sealed checkpoint and keeps the original restrictions,
budgets and role bindings. Sending `$openspec-next <full-name>` authorizes only
the selected bounded local route and still requires exact approval and a
separate execution grant. Sending `$openspec-delivery finish <full-name>`
separately authorizes protected publication and closeout after finish readiness.
An existing qualified Herdr route may rotate only with separate checkpoint
authority, predecessor timer cancellation, exact successor readback and a
matching file-backed `HANDOFF_ACK`. Keep the predecessor until handoff and
original-attempt settlement are verified.

## Identity and path conventions

The full change name is the stable reference in tickets, dependencies, handoffs
and other documents. For example, cite `pin-note-01arz3ndektsv4rrffq69g5fav`, or
`proposal of pin-note-01arz3ndektsv4rrffq69g5fav` when the artifact matters. Do not
embed its active directory as the durable reference. The archive keeps the same
identity; the date prefix belongs to the storage directory, not the change name.
For cross-project references, include the repository identity as well.

Names do not automatically become clickable links. An agent resolves the name
against the selected checkout before using filesystem tools. The packaged naming
helper resolves active changes only; for historical work, inspect dated archive
directories for that exact name and reject ambiguous or duplicate locations.
An active lookup miss is not permission to create a replacement change. Dataview
can query the unchanged `change` field and generate the link to its current file.
Bare `[[proposal]]` links are ambiguous because many changes use that filename.

The following are layout patterns for tool use, not cross-document identities.
Unless explicitly labeled distribution source, they are relative to the adopting
project's root. `<name>` means the full existing change name; `<capability>` is
the capability's stable key, which may contain nested path segments.

| Owner | Location pattern | Meaning |
| --- | --- | --- |
| Native OpenSpec | `openspec/config.yaml` | Selected project configuration |
| Native OpenSpec | `openspec/changes/<name>/.openspec.yaml` | Change metadata |
| Native OpenSpec | `openspec/changes/<name>/proposal.md`, `design.md`, `tasks.md` | Change-owned artifacts; bare filenames here share that package root |
| Native OpenSpec | `openspec/changes/<name>/specs/<capability>/spec.md` | Proposed requirement delta, not the current spec |
| Native OpenSpec | `openspec/specs/<capability>/spec.md` | Current capability behavior |
| Native OpenSpec | `openspec/changes/archive/YYYY-MM-DD-<name>/` | Archived package, with its internal layout preserved |
| Companion convention | `wireframes/` within the selected change package | Review-only proposal assets, if that project selects this subdirectory |
| Companion convention | `docs/product/wireframes/` | Current visual generator and output root; not an OpenSpec requirement |
| Companion convention | `evidence/` within the selected change package | Git-tracked integration evidence; moves with the package |
| Git ref, not a directory | `change/<full-name>` | Branch naming convention; not an artifact location |

Project-local visual layouts win over the companion's default. This distribution
ships the playbook, not a field-notes product tree or a ready-made screen generator.
Support-file links in this document resolve relative to this document. A skill's
`references/` and `scripts/` resolve relative to that installed skill package,
not the target repository or an assumed agent-profile path.

Use package-relative links only when source and target move together, such as a
proposal linking its own wireframe. For references outside that package, use the
full change name plus artifact role, or an optional verified immutable commit
permalink for a specific published revision. Do not use a guessed future archive
path, and do not push merely to obtain a URL. Before syncing a delta into a current
spec, resolve visual references by stable capability/screen key and write links
relative to the current spec's location; a copied delta-relative link has a
different base. Fix links before final verification, not by editing a frozen
archive. Link edits inside approved planning files require reapproval, just like
other planning edits. The receipt guard permits only byte-identical package movement.

## Change names and branches

The operator supplies a readable slug, not an identifier:

```text
/openspec-propose add-dark-mode
```

Before scaffolding, the agent automatically generates one lowercase ULID and
uses `<slug>-<ulid>` as the full OpenSpec change name. For example, the following
is a synthetic identity, not a command to create work:

```text
Name:   add-dark-mode-01arz3ndektsv4rrffq69g5fav
Branch: change/add-dark-mode-01arz3ndektsv4rrffq69g5fav
```

The branch convention is `change/<full-name>`. Keep the same branch through
specification, implementation and review; do not add phase numbers, developer
names, or status prefixes. Naming alone does not authorize branch creation;
the selected proposal/delivery invocation supplies bounded setup authority. Check
existing local/remote branches and worktrees before an authorized creation;
reuse the confirmed branch or stop on conflicting ownership, never reset it.

The full name stays immutable even if the proposal title changes. Reuse it for
issues, pull requests, evidence, handoffs and retries. Do not generate a second
ULID for those actions. Collaborators on one change share its identity and
coordinate writers; independently created changes receive different identities.
Existing change names and branches remain unchanged; no bulk rename is required.

On resume, use an explicitly selected existing change or verified current change
context. A short slug resolves only if unambiguous. If multiple packages match,
show their full names and proposal summaries and ask the operator to select one.
Never choose the newest automatically. No match is an error on resume, not
permission to create another change. An explicitly new proposal may share a
slug, but first inspect visible matching requests to avoid duplicating work.
Unique names do not eliminate overlapping-spec reconciliation or acquire a lock.

This is project policy, not stock OpenSpec behavior. The root `AGENTS.md` directs
the agent to the packaged [naming procedure](../skills/software-development/openspec-delivery/references/naming.md)
before `openspec new change`. The helper generates/resolves names without writes;
OpenSpec still owns proposal scaffolding. Config artifact instructions alone
are not a pre-creation hook. Other projects must explicitly adopt the same rule
in their contributor instructions; installation alone does not activate it.
Do not patch installed adapters or add another propose skill.

## Demo: field-notes

`field-notes` is a synthetic notes application. It is not this repository, and
the issue and pull-request numbers below are placeholders. Do not create them
unless the operator of that project asks.

The narrative uses short labels for readability. Durable references and later
commands use the full identity, not a moving directory. The suffixes below are synthetic examples;
actual proposals receive freshly generated ULIDs. Existing unsuffixed packages
remain valid and are not renamed.

The operator wants two deliveries that can be specified at the same time:

| Label | Full change name | What it is | Depends on |
| --- | --- | --- | --- |
| `pin-note` | `pin-note-01arz3ndektsv4rrffq69g5fav` | A person can pin one note from the note screen | nothing |
| `export-notes` | `export-notes-01arz3ndektsv4rrffq69g5faw` | A command writes the notes to a file | nothing |
| `pin-note-sync` | `pin-note-sync-01arz3ndektsv4rrffq69g5fax` | A second device receives the pin | integrated `pin-note` |

`pin-note` and `export-notes` are parallel. `pin-note-sync` may be specified
immediately, against the `pin-note` proposal, but its implementation waits for
the accepted integrated revision of `pin-note`. A closed issue is not that
revision.

### Specify `pin-note`

Start with `/openspec-explore` if needed, then send
`/openspec-propose pin-note`. Use the full generated name for later commands
and records. The orchestrator prepares the isolated checkout before native
scaffolding and tracks the proposal, delta, design and native tasks.
For a primary human-facing surface, use `/capability-wireframes` and keep
proposal HTML/PNG in the change package. Maintain current product visuals
under their stable capability and screen keys. Update and verify their
current-spec links before the candidate is frozen for review. For this synthetic
screen the stable generated paths are
`docs/product/wireframes/notes/html/note-screen.html` and
`docs/product/wireframes/notes/exports/note-screen.png`.
[Wireframe procedures](../skills/software-development/capability-wireframes/SKILL.md).

The authorized proposal policy includes one documentation issue. An existing
draft with a pending link can use
`/openspec-delivery document pin-note-01arz3ndektsv4rrffq69g5fav`
with separate permission. The risk-focused issue body covers the scope,
authorization, exposure and recovery. It does not establish ISO/IEC 27001
conformity. Bind the verified issue URL before approval and keep task
progress in `tasks.md`.
[Ticket template](../skills/software-development/openspec-delivery/references/ticket.md).

### Implement one Task-Guided group

In this Task-Guided example, the operator has approved the frozen plan and wants
to grant execution for the next local group. They send:

```text
/openspec-next pin-note
```

It resolves the existing full name, confirms recovery, prepares/reuses and
bootstraps the dedicated worktree, and refuses a second writer for that change.
It selects task group 1 from the actual tasks and approval, not this example.
The branch is `change/pin-note-01arz3ndektsv4rrffq69g5fav`.
Keep it through specification, implementation and review.

The implementer follows `/openspec-apply-change` for that group and reports
commands, paths and results. The orchestrator verifies exact-SHA gates and
independent review before recording the proved boxes in `tasks.md`. Verify and
review the final SHA again if recording progress changes it. The orchestrator
mediates any checkbox write by stock apply.

Commits use `/git-commit-message`: preview the exact batch, verify its staged
content and commit automatically under the selected local execution contract.
No extra confirmation is required unless the operator restricts commit authority. The implementation batch does not include a
later evidence file or the issue text.

Before a pull request may be merged, and before its branch may be deleted, a
reviewer that did not implement the candidate must review that exact SHA.
The operator starts that review with `/autonomous-implementation-review`:

```text
/autonomous-implementation-review
Review only candidate abc1111 of change pin-note-01arz3ndektsv4rrffq69g5fav.
Use a reviewer session and model that did not implement this candidate.
Read-only. Do not merge the pull request and do not delete the branch.
```

The loop stops after the named group. It does not open a pull request and it
does not start `export-notes`. If no different reviewer can run, stop. The
implementer must not review its own candidate.

### Deliver a Goal-First outcome

For an eligible later change, the native proposal holds one v1
`openspec-goal-contract` JSON block and the change has native delta specs.
Include the outcome, allowed paths, hard invariants, exclusions, adaptable legacy
assumptions, verifiable acceptance and exact gate argument arrays, local commit
scope and stop, and finite time and correction budgets. Use one native outcome
checkbox. Keep external closeout predicates outside that checkbox. If breaking
CLI, runtime or dependency behavior is uncertain, a separately scoped local
scratch probe before contract lock can inform the contract. [Goal Contract and authority fields](../skills/software-development/openspec-delivery/references/delivery-policy.md#mode-selection-and-local-result), [scratch discovery](../skills/software-development/openspec-delivery/references/external-verification.md#scratch-discovery).

After approval of the exact committed contract and digest, the same next or
delivery invocation grants the bounded local run. The agent uses one dedicated
workspace. At dispatch, each phase boundary, correction and result, it checks
held authority and alignment. An evidenced legacy assumption may adapt inside
the contract. In-scope routine failures consume the held budget. A material
conflict returns `DIRECTION_DRIFT_CHOICE` and names the clause needing a decision.
Local verification uses a clean disposable checkout pinned to the final
candidate SHA and fresh independent read-only review of that SHA. A progress
commit after acceptance needs fresh evidence. The orchestrator owns progress.

### Review on a pull request

When the candidate is a clean commit, for example `abc1111`, and the operator
asks for review, open a pull request whose body names that SHA and the change:

```text
Title: Pin a note
Body:  Change: pin-note-01arz3ndektsv4rrffq69g5fav
       Candidate: abc1111
       Documents: https://github.com/example/field-notes/issues/40
```

The pull request is the review record of `abc1111`. It is not a copy of
`tasks.md`. If the candidate becomes `def2222`, the previous review does not
count. Do not put a closing keyword in an implementation commit or in the
implementation pull-request body while later acceptance is still required.
Use factual receipt links and retain the acceptance readback for explicit issue closure.

`/openspec-delivery` then uses its read-only guard. The review record
cites issue 40 because the operator already created that documentation issue.
The citation is not a reason to create an issue, and the guard does not call
GitHub.

Terminal delivery is one short authorization after the independent verdict on the
actual frozen SHA, disposition of every finding, and positive finish readiness.
It includes protected publication, integration and verified closeout:

```text
/openspec-delivery finish pin-note
```

The agent verifies the bound candidate, promoted current specs and actual
repository/target first. Before an authorized push, it checks for external app
automation. When a deploy preview is declared, it waits for the separately
authorized artifact-only preview and the operator's pre-merge review. If
that pull request is still waiting on review or checks, stop and report it.
That wait is typical. When it is later satisfied for the same SHA, send the
same finish again if that authority is not already held. The agent reads that
pull request and continues. It does not open another. A changed head or a
failed required check is the exception; resume the same finish only after it
is cleared. Branch
deletion remains excluded unless separately authorized; clean dedicated worktree
retirement is included after verified closure. One change retains its implementation
branch through review. Integrated verification uses an exact-revision isolated tree;
record-only closure uses `closure/<full-name>` from the verified target and its own
protected PR. These are the same change, not additional task trackers.

### Integrate, sync, archive

The finish invocation supplies integration and terminal-closeout authority.
The agent continues automatically: read back the merge and the containing
target revision. Run the project's required gates on that named revision and
keep the output. A failed gate keeps the change open. It does not close issue
40, and it does not mean the merge should be replayed.

Before closing the change:

1. `/openspec-sync-specs` updates the current `notes` capability spec only if the
   delta is not already there. Do not reapply a delta over a newer spec. Add the
   project-owned `spec`/capability frontmatter to a newly created current spec;
   keep deltas frontmatter-free and validate links from their final document base.
   Run the target project's metadata check and `openspec validate --all --strict`.
   `npm run validate:openspec` is this distribution's check, not a script installed
   into field-notes by copying a skill.
2. If spec sync, metadata or link correction changed the integrated tree, obtain
   the authorized integrated revision and re-run required gates on it before
   recording the receipt. `/git-commit-message` commits the factual receipt as
   its own authorized batch; it names that actually verified revision.
3. `/openspec-archive-change` moves the completed package into
   the dated archive layout. Continue referring to it as
   `pin-note-01arz3ndektsv4rrffq69g5fav`; no cross-document path rewrite is needed.
   Verify byte-identical movement and re-run metadata/upstream checks. Current
   specs must already be correct for a record-only archive; use native
   `--skip-specs` only for that verified case. If archival needs further spec or
   link changes, stop the record-only closure and return to integrated verification.
4. Close issue 40 only if the operator authorizes that documentation write and
   the declared acceptance boundary is met. Archival does not close it.
   Closing it does not archive the change.

`export-notes` continues in its own checkout through the same picture. It does
not wait for issue 40. `pin-note-sync` may now be implemented, because the
integrated revision of `pin-note` exists. Its specification did not need to
wait for that revision, and it still does not share `pin-note`'s `tasks.md`.

If `pin-note` and another active change both edit `openspec/specs/notes/spec.md`,
stop before either merges and reconcile the overlap. A clean Git merge of the
two files is not combined-system evidence.

## Authorities

| Concern | Authority |
| --- | --- |
| Current behavior | `openspec/specs/<capability>/spec.md`, backed by code and tests |
| Proposed scope and behavior | Proposal and delta specs of the selected full change name |
| Technical approach | Change-owned `design.md` where needed |
| Implementation progress | Change-owned `tasks.md`, written only by the orchestrator |
| Specification actions | OpenSpec propose, apply, sync and archive |
| Commits | `/git-commit-message`; no push. Use factual receipt links. Explicit close follows accepted archive readback. |
| Human-facing visuals | `/capability-wireframes` |
| Independent review before merge | `/autonomous-implementation-review` |
| Workspace lifecycle, candidate identity, recovery and integrated evidence | `/openspec-delivery` |
| Grounded next local outcome or group, and read-only inspection | `/openspec-next` |
| Documentation and human review | Proposal-time issue under explicit project policy; PR and later updates separately authorized |

One concern has one authority. `tasks.md` is the only mutable task list. An
issue is not a second plan. A pull request is not a progress file. A checked
task is implementation progress, not a merged or deployed result.

A change is one independently mergeable delivery. A larger feature is several
changes. A parent issue may group them as documentation. Each change keeps its
own identity, scope, gates and acceptance boundary.

## What each skill adds

The [companion skills table](../README.md#sdlc) identifies each package's
boundary. Keep Git and native task writes with one orchestrator. After
exact gate and review evidence, update native progress in the same change.
Use the delivery runtime for policy, worktree reconciliation and status, and
independently recheck actual candidate, integrated and closure evidence at
the applicable boundary. Package installation supplies no project authority.

## Parallel specification

Independent changes may be specified and implemented at the same time.

1. Each change gets its own OpenSpec package and its own checkout. Changes do
   not share an index, working directory or mutable test environment.
2. One operator-designated orchestrator owns each change. Starts and handoffs
   for that change are operator-serialized. Two sessions that both observe no
   active run have not acquired a lock. Comments, assignees and refs only show
   a conflict that was already observed.
3. A dependent change may be specified before its prerequisite is integrated.
   Its implementation waits for the prerequisite's accepted integrated revision,
   not for a checked task or a closed issue.
4. Two changes that edit the same capability spec must reconcile that overlap
   before either merges. Record the source revision they were specified against.
   A later rebase does not silently redefine that baseline. A clean Git merge
   is not combined-system evidence.
5. One implementation writer per change. Parallelism is across changes, not
   across writers inside one change.

## Documentation and review

When the verified integrated parent explicitly selects charter-v1 approach
convergence, follow the bounded operator procedure. A change introducing a new
policy retains its inherited approach and candidate gates. After planning
review, freeze authority, exact approval in the selected mode, the local grant
and any qualified reviewer launch each keep their own boundary.
[Charter-v1 procedure](../skills/autonomous-ai-agents/autonomous-implementation-review/references/portable-core.md).

GitHub is the documentation and review surface. It is not the specification
system and not an execution lock.

- During an authorized new proposal, create or reuse one documentation issue
  under the explicitly selected proposal-time policy. Read it back and record
  its URL before plan approval. Offline or unauthorized drafts use a null link
  and remain pending. Later issue updates need separate authority. Link the
  OpenSpec change. Do not copy `tasks.md` into the issue or invent a ticket.
- Open a pull request only when the operator asks to review or integrate a
  frozen candidate. The review binds the exact commit, not the evolving request
  body. A changed candidate invalidates review.
- Closing an issue does not archive a change. Archiving a change does not close
  an issue unless that documentation write is separately authorized.
- Protected checks and a merge queue, where the project uses them, are
  repository settings. This package neither creates nor proves them. If they
  are missing, stop. Do not change protection to make a pull request mergeable.
- The helper's review and receipt commands cite a documentation issue URL when
  those evidence records are produced. That citation is not permission to
  specify, and it is not a reason to create an issue.

## Integration and completion

1. Run exact-candidate `finish-readiness` before offering protected finish.
   Verify native progress, promoted delta requirements and capability identity.
   Refresh against the current target and shared capability specs. Reconcile
   overlaps. Include implemented behavior, tests, specs and current visuals
   together.
2. Integrate only with explicit authority. Read back the exact result and the
   containing target revision. Squash or rebase mapping is unsupported by the
   packaged guard; do not weaken that check to force a merge style.
3. Run the required acceptance gates on a named integrated revision. Retain the
   commands, environment, exit statuses and output. Failure blocks completion
   and needs an explicit repair or revert decision. Never replay an already
   merged implementation.
4. After successful integrated verification, commit the factual receipt and
   archive the change. Do not reapply delta specs that are already in current
   specs. A receipt names completed verification. It does not predict the merge
   of the commit that contains it.
5. Under finish authority, verify issue acceptance/closure and retire clean dedicated
   worktrees automatically unless the operator retains them. Stop at the authorized
   change. No next change, release or branch deletion is implied.

Planning permission ends at the requested artifacts and the bounded proposal-time
issue write when explicitly selected by project policy. Approval of a plan is not
permission to implement, commit, open a pull request or merge.

### Optional UI and external acceptance

When UI acceptance is declared, test the exact candidate on a loopback URL
and retain try-out and role/accessibility-name interaction results. Use the
`ui` decision for `LOCAL_UI_ACCEPTANCE_PENDING`, `PREVIEW_AUTHORITY_PENDING`
and `PREVIEW_REVIEW_PENDING`. A deploy preview has its own approval and
operator review before protected merge. Local acceptance and local execution
authority stop at their respective boundaries.

For any paid or external test, tunnel, deploy preview or app trigger, submit a
single-run card that binds the exact candidate, target, test scope, data,
expected cost or credits and run count. Use only the approved built artifact
for a tunnel or preview, with source, credentials, live data and account actions
outside the exposure. Reserve the separate grant before activation. Tear down
the tunnel immediately on success or failure and retain the cleanup. A retry
requires a new grant. Before any separately authorized push, verify the trigger
inventory and obtain additional consent for any external app run. Vendor
defaults do not authorize runs or retries. [External and UI request schemas](../skills/software-development/openspec-delivery/references/external-verification.md).

## Metadata and vault views

Follow [OpenSpec metadata and Obsidian](openspec-metadata.md) for identity-only
YAML frontmatter, one stable `github_issue` on the proposal, validation commands
and same-files vault integration. No PR list or progress properties are stored.
Metadata stays covered by the plan digest; corrections after approval require
reapproval. Archive moves retain the change identity. Current specs use their
capability identity, not the originating change. A Dataview dashboard is a view,
not another task authority or proof of client filesystem synchronization.

## Guard

The [delivery runtime](../skills/software-development/openspec-delivery/references/delivery-runtime.md)
exposes read-only policy, preflight, workspace reconciliation, handover, status,
decision and finish readiness. The preflight subcommand reports P1–P8 observations
and missing or drifted evidence without starting a reviewer probe. For a selected change,
the [next router](../skills/software-development/openspec-next/references/routing.md)
returns the versioned status and advisory next action from retained observations.
Use the exact blocker to reconcile a changed candidate, missing review, unmet
authority or current-spec promotion. A ready status leaves protected publication
subject to the separate named finish grant.

`/openspec-delivery` ships the read-only package-relative `scripts/change-guard.mjs`
helper. Its [guard](../skills/software-development/openspec-delivery/references/guard.md),
[integration](../skills/software-development/openspec-delivery/references/integration.md)
and [recovery](../skills/software-development/openspec-delivery/references/recovery.md)
references own the commands and recovery table.

The helper validates committed identities, plan continuity, review binding and
receipt structure. It does not authenticate a reviewer, discover every required
gate, execute tests, call GitHub, acquire a lock or authorize a write. Full
object IDs must already be local. Independent clones are supported. Preserve
dirty work and uncertain API outcomes. Read back before retrying a write.

The packaged Git environment contract governs allowlisted paths, explicit
config selectors, protected object topology and Windows path handling.
[Git child environment](../skills/software-development/openspec-delivery/references/git-environment.md).

The separate `references/evidence-retention.md` and
`scripts/evidence-retention.mjs` pair is local representation support, not a Git
helper or runtime lifecycle validator. Ship both complete in well-known output,
skill/plugin ZIPs and native copies. Stored/original hashes, wrapper round-trips,
archive identity and source/claim completeness belong in factual closure review;
structural or synthetic procedure assertions cannot authenticate that review.
Evidence-only additions, checkbox-only progress and covered planning-text drift
are distinct. An owner plan may be absent from a lagging target; incomplete
authorized bootstrap is not implementation. Plan drift requires separately
approved recovery. `--plan` equal to `--head` computes identity only, granting
neither approval nor commit authority nor restriction/correction-budget reset.

## Optional exclusive worker runtime

For an integrated project selection, both delivery modes use a qualified
external implementer and a fresh independently contained reviewer.
`openspec-next` resolves the full change and registered workspace and hands
the held restrictions to delivery. Inspection reads original-attempt evidence
and reports its state. The orchestrator uses sealed settlement and exact
post-worker scope to decide whether to prepare the candidate, then requires
exact-SHA executable gates and independent review with a sealed single-run
session binding. A Task-Guided successor
needs the predecessor's accepted evidence. Goal-First uses its exact Goal
Contract and single outcome. Missing qualification, uncertain ownership or
stale evidence keeps the boundary closed. Exact approval and the bounded
local grant govern delivery. A verified adopting parent can select bounded
contained reviews. Finish requires its own authorized invocation.
[Qualification, setup and operator recovery](worker-runtime.md).

## Packages

| Plugin | Skills |
| --- | --- |
| `openspec-development` | `/openspec-delivery`, `/openspec-next`, `/git-commit-message`, `/capability-wireframes` |
| `autonomous-orchestration` | `/autonomous-implementation-review` |

Orchestration is optional. It requires the workflow plugin, explicit role and
model configuration, and a supported host. Package installation does not create
those roles.

Current source versions are delivery 1.7.0 and `openspec-next` 0.7.0 in
`openspec-development` 1.7.0, and core skill 0.21.0 in
`autonomous-orchestration` 1.11.0.
Representation support adds no upstream workflow, runtime dependency or
installation route. Package availability/byte checks do not establish account
sync, host execution, native client discovery, Desktop acceptance or scanner approval.

The [contained Claude reviewer](claude-reviewer.md) is an opt-in transport for exact candidate
and charter-v1 approach review. Check the exact approved export and applicable
review authority before paid inference. A verified low-touch parent selects
the per-change defaults and the explicit override. Replay the original
request-bound output offline before applying candidate or charter admission.
[Review authority and configured harness](openspec-review-configuration.md).

Complete copies and generated packages preserve delivery's policy/task-authoring
references, `scripts/delivery-policy.mjs` and `scripts/delegated-delivery.mjs`, plus orchestration's
`references/portable-core.md`, `scripts/orchestration-core.mjs`,
`references/worker-handoff.md`, `scripts/worker-handoff.mjs`,
`references/terminal-adapters.md`, `scripts/terminal-adapters.mjs` and
`references/profile-preparation.md`, `scripts/run-implementer.mjs` and
its runtime helpers.
The handoff pair is required portable support; it does not qualify a client or
replace protected publication, independent review or delivery acceptance.

## Verification

Changes to required skills or their prerequisite relationships, CLI/runtime
versions, companion dependencies or supported installation routes include the
affected current documentation updates in the same change, before completion,
not a follow-up. The author assesses and updates inventories, required/optional
distinctions, commands, version/source pins, host prerequisites,
installation/enablement/update/removal guidance, verification steps, counts and
cross-links. The reviewer compares the resulting prerequisites/dependencies with
the instructions and actual gate/probe evidence; stale, missing or contradictory
affected guidance blocks completion before integration/publication. Rerun
affected verification after the final edit. See the
[maintenance contract](openspec-installation.md#keep-prerequisites-and-instructions-in-the-same-change).
This is an author/reviewer obligation, not automated enforcement. Do not rewrite
archived plans/evidence or infer uninstall/installed-profile modification
authority from a prerequisite removal; retain backup, collision and scanner
boundaries.

Run `npm test` and `npm run build`. Tests cover Git fixtures, package inventories
and native-copy collision safety. Artifact validation does not prove model
execution, protected integration or deployment acceptance. Publication, live
issues, protection settings and installed profiles need separate authorization.

For Git environment hardening, also run the focused command in the
[environment contract](../skills/software-development/openspec-delivery/references/git-environment.md)
on native Linux, macOS and Windows and retain each platform's actual command/results.
WSL is Linux evidence, not native Windows evidence; case simulations and scratch
plugin validation are supplementary. Missing native results block hardening
completion. Require the unchanged trusted scanner's negative controls and safe
community verdicts for all five complete packages, followed by independent review
of the exact candidate. Do not replace retained failures with prototype results.

## References

Local authority is defined above, not attributed to upstream:

- [OpenSpec skill actions by host](#lifecycle-picture) for the direct-directory Claude Code and Hermes routes and Codex skill mentions.
- [OpenSpec verification skill](https://github.com/Fission-AI/OpenSpec/blob/0c737dc1b543249b38b0f4716816fcf493d894dd/skills/openspec-verify-change/SKILL.md)
- [OpenSpec configuration](https://github.com/Fission-AI/OpenSpec/blob/0c737dc1b543249b38b0f4716816fcf493d894dd/docs/customization.md)
