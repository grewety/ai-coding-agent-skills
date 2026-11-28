---
metadata_version: 1
artifact: spec
capability: openspec-integration
---
# openspec-integration Specification

## Purpose
Defines the current OpenSpec integration contract for controlled change delivery.

## Requirements

### Requirement: Explicit workflow authority
The integration package SHALL act only for explicitly adopted OpenSpec scope and
SHALL NOT create a second CAP/CHG task tracker or infer authority from installation.

#### Scenario: Untransferred project
- **WHEN** a project already keeps older installed skills or records
- **THEN** this distribution does not transfer that project or rewrite those records

#### Scenario: Planning-only request
- **WHEN** the operator approves only planning
- **THEN** no executor, Git publication, integration or task execution is authorized

#### Scenario: Authorized short proposal setup
- **WHEN** an authorized short proposal proceeds to scaffolding
- **THEN** prepare the isolated workspace before scaffolding
- **AND** allow a plan-only commit only within the limits of the selected proposal policy

#### Scenario: Implementation and publication authority
- **WHEN** a proposal is ready for implementation or publication
- **THEN** check separate authority for implementation and for publication before proceeding with either action

### Requirement: Immutable review identity

The guard SHALL bind approval to committed Task-Guided planning content or an immutable Goal-First contract and bind result review to the exact reviewed candidate in both modes. Finish admission SHALL use an explicitly scoped verified task-completion or post-review PR-fix lineage proof when applicable.

#### Scenario: Changed task definition
- **WHEN** a task or gate changes after Task-Guided plan approval
- **THEN** the previous plan digest is rejected
- **AND** only task-checkbox progress changes preserve that digest

#### Scenario: Changed candidate
- **WHEN** the candidate SHA changes after review
- **THEN** the previous review cannot satisfy the new SHA's candidate gate
- **AND** finish admission can retain the original review and SHA only with the independent Native task completion admission or Verified post-review PR-fix lineage proof, as applicable

#### Scenario: Changed Goal Contract
- **WHEN** an approved goal outcome, allowed scope, hard invariant, non-goal, acceptance gate, or local authority boundary changes
- **THEN** the previous approval cannot admit execution against the changed contract

### Requirement: Truthful integrated evidence
The guard SHALL require successful exact-revision gate evidence, candidate integration
ancestry and conservative freshness before accepting a post-merge receipt structurally.

#### Scenario: Independent clone
- **WHEN** the required Git objects are present in another clone
- **THEN** evidence validation does not require a shared Git common directory

#### Scenario: Failed or stale verification
- **WHEN** a gate failed or unverified product content changed after verification
- **THEN** receipt validation fails without repairing or discarding work

### Requirement: Isolated package choice
The distribution SHALL ship OpenSpec, orchestration and opt-in delivery-operations. Existing bundles SHALL gain no prerequisites, selections or activation. No second phase skill set SHALL ship.

#### Scenario: Catalog inventory
- WHEN built
- THEN ship openspec-delivery, openspec-next, git-commit-message, capability-wireframes, autonomous-implementation-review, release-train-supervisor and wiki-delivery-sync, with complete ZIPs and endpoint packages per operations skill

#### Scenario: OpenSpec bundle inventory
- WHEN building the OpenSpec ZIP
- THEN include only delivery, next, commit and wireframe packages byte-for-byte

#### Scenario: Optional bundle inventories
- WHEN building marketplace and plugin ZIPs
- THEN autonomous-orchestration selects only autonomous-implementation-review and delivery-operations selects only release-train-supervisor and wiki-delivery-sync
- AND match canonical bytes and keep delivery-operations out of existing bundles

#### Scenario: Operations versions
- WHEN bumping delivery-operations or either skill
- THEN sync marketplace, skill metadata, packaging test and current doc versions together and generate complete canonical packages at source versions

### Requirement: Documentation records are not the task authority
GitHub issues and pull requests SHALL be documentation and review records. They
SHALL NOT be the specification authority, a task list, or an admission lock.
Independent OpenSpec changes MAY be specified concurrently.

#### Scenario: Offline or unauthorized issue creation
- **WHEN** local specification proceeds without authority or connectivity for its required issue
- **THEN** the proposal keeps `github_issue: null` and remains pending before plan approval, without creating a pull request or fabricating an issue

#### Scenario: Overlapping specifications
- **WHEN** two active changes modify the same capability spec
- **THEN** merge waits for explicit reconciliation

### Requirement: Risk-focused documentation issue
For projects selecting proposal-time documentation, an authorized new proposal
SHALL create or reuse one verified issue before approval. The issue body SHALL
follow the risk-focused template and SHALL NOT claim ISO/IEC 27001 conformity.
Installation and metadata migration SHALL NOT grant issue-write authority.

#### Scenario: Documented request
- **WHEN** the operator sends the documentation prompt
- **THEN** the issue records impact and authorization fields, and does not copy `tasks.md`

#### Scenario: Proposal issue content
- **WHEN** creating or updating the proposal issue
- **THEN** record request, blast radius, risk and authority
- **AND** exclude prospective review, merge and closure evidence and keep the issue editable

#### Scenario: Retained approval
- **WHEN** binding approval for a documented proposal
- **THEN** bind approval to the retained revisions

### Requirement: Change name is the identity

The full name identifies paths, issues, PRs and evidence. Adopters SHALL generate `<slug>-<lowercase-ulid>` once, use `change/<full-name>` through review and preserve existing names. A proposal explicitly supplied with a valid new pre-minted full name SHALL verify identity and absence of a conflict and reuse it verbatim.

#### Scenario: Short proposal
- **WHEN** a short proposal starts with a slug
- **THEN** generate the suffix before scaffolding without prompting. Naming grants no writes. The selected proposal policy supplies the authorized setup and planning boundary.

#### Scenario: Authorized proposal from a pre-minted brief
- **WHEN** a proposal explicitly supplies the new full name from a verified Change Brief
- **THEN** validate the lowercase ULID, confirm no conflicting active or archived change, and use the unchanged full name for the worktree, branch, OpenSpec change and proposal-time issue
- **AND** refuse a mismatch or collision without generating another suffix

#### Scenario: Resume
- **WHEN** resuming by slug or context
- **THEN** reuse the full name and ask on ambiguity.

#### Scenario: Naming helper
- **WHEN** naming or resolving active changes
- **THEN** report name, path and branch read-only and reject malformed input, repeated options and discovery symlinks.

#### Scenario: Second clone
- **WHEN** another checkout edits the capability
- **THEN** stop for reconciliation regardless of name.

#### Scenario: Archive reference
- **WHEN** citing a change
- **THEN** cite full name and optional artifact role. Claim archive lookup only if performed.

#### Scenario: Proposal issue
- **WHEN** documenting the proposal
- **THEN** use the same full name as the stable issue reference and avoid moving active or guessed archive links.

### Requirement: Independent reviewer before merge

A pull request SHALL require an independent review with dispositioned findings for the exact candidate SHA before merge or branch deletion. Finish admission using a prior reviewed SHA SHALL verify the Native task completion admission or Verified post-review PR-fix lineage requirements, as applicable.

#### Scenario: Implementer reviews itself
- **WHEN** the only available reviewer is the session that implemented the candidate
- **THEN** merge and branch deletion stop

### Requirement: Queryable identity metadata
Proposals, designs, task files and current specs SHALL use versioned YAML
frontmatter. Delta specs SHALL remain native Markdown without frontmatter by
repository policy. Their identity is path-derived, and the local metadata checker
rejects delta frontmatter independently of upstream strict validation. Metadata
SHALL describe identity and navigation, not task
progress, approval or PR state, and SHALL remain included in the existing planning
digest.

#### Scenario: Stable proposal association
- **WHEN** the proposal's documentation issue is read back successfully
- **THEN** its full URL is recorded only on the proposal and remains unchanged by default
- **AND** correcting metadata after plan approval requires reapproval

#### Scenario: Archive and current spec identities
- **WHEN** OpenSpec moves a completed change to its archive and updates current specs
- **THEN** archived artifacts retain their original change identity and current specs carry only their capability identity
- **AND** a same-files vault can query the new location without a second mutable tracker

#### Scenario: Invalid metadata
- **WHEN** metadata has duplicate YAML keys, wrong types, unsupported fields, identities inconsistent with its native path, or delta-spec frontmatter
- **THEN** the read-only metadata check fails without repairing files or bypassing upstream validation

### Requirement: Short bounded delivery invocations

Projects explicitly adopting the invocation contract SHALL let the orchestrator perform workspace setup, bootstrap, verification, task updates and previewed autonomous local commits within one eligible approved outcome or the applicable Task-Guided continuation boundary. Operator restrictions SHALL override defaults and remain effective on continuation.

#### Scenario: Next approved local group
- **WHEN** the operator sends `/openspec-next` in verified current-change context for Task-Guided delivery
- **THEN** the orchestrator resolves actual tasks, approval, dependencies and interrupted work and advances one eligible unfinished group within the inherited continuation policy
- **AND** it does not infer plan approval, perform remote writes or start another change

#### Scenario: Inspect or restricted execution
- **WHEN** the operator requests inspect-only assessment or excludes commits
- **THEN** inspect performs no mutations and a no-commit execution preserves its uncommitted boundary without claiming a clean candidate
- **AND** ambiguous selection, missing approval or conflicting ownership blocks execution

#### Scenario: Explicit terminal delivery
- **WHEN** the operator sends `/openspec-delivery finish <name>` under the adopted contract
- **THEN** the orchestrator resumes that candidate's protected publication, integrated verification, factual receipt/archive closure, acceptance-bound issue closure and clean-worktree retirement within the named grant
- **AND** changed candidates require renewed gates and review except for independently proved native task-completion admission, which requires renewed exact-head gates
- **AND** already merged implementation is not replayed, and branch deletion, bypass, release or another change remains unauthorized

#### Scenario: Next approved local goal
- **WHEN** the operator grants a local Goal-First run for the verified current change
- **THEN** the orchestrator advances the approved outcome through local verification, fresh independent review, and an authorized previewed local commit without mid-run task-keeping prompts
- **AND** the run stays in the same dedicated worktree and within held restrictions and budgets

### Requirement: Recoverable isolated workspace lifecycle

The delivery package SHALL supply read-only creation, reuse, location, same-change inventory reconciliation, and retirement previews, leaving execution and exact readback to the authorized orchestrator.

#### Scenario: Automatic workspace preparation
- **WHEN** authorized setup begins from a captured clean base without collisions
- **THEN** the helper emits exact worktree creation arguments outside existing checkouts without writing files or refs
- **AND** preparation precedes parallel proposal scaffolding and bootstrap uses the project's actual documented recipe

#### Scenario: Resume and retirement
- **WHEN** the selected branch already has one verified registered dedicated worktree
- **THEN** the agent reuses it and preserves dirty or interrupted work
- **AND** removal requires exact clean head and reachable closure evidence, ignored-file inspection, no force and verified absence. Branch refs remain recoverable and earlier worktrees are individually reconciled against the same-change ownership evidence

### Requirement: Prospective proposal-to-freeze adoption

Only explicit verified integrated-parent adoption SHALL enable `propose-to-freeze`, with one authorized plan-only freeze and card per accepted revision.

#### Scenario: Freeze a short proposal
- **WHEN** a short proposal or `/goal draft` with inline goal or readable note passes policy and gates
- **THEN** verify baseline and upstream facts, select mode, prepare the ULID worktree before scaffolding, bind the authorized issue and validate native artifacts
- **AND** run the packaged charter when selected or explicitly permitted and requested. Revalidate and re-review grounded corrections and new artifacts within authority and budget.
- **AND** commit accepted planning only and show full SHA and mode digest. Exclude implementation, launch and publication.

#### Scenario: Draft-only or absent adoption
- **WHEN** adoption is absent or self-selected, or draft-only or no commits applies
- **THEN** stop uncommitted without a card. Allow separately authorized review and report missing bindings, blockers, scope conflict or exhausted budget.

#### Scenario: Breaking upgrade
- **WHEN** material upgrade uncertainty remains
- **THEN** record authorized disposable probes before lock to distinguish invariants from adaptable legacy layouts, flags or assertions. Exclude real profiles, paid verification and exact-candidate gate credit.

#### Scenario: Revise a draft
- **WHEN** authorized feedback arrives, including `changes: <feedback>`
- **THEN** revise, revalidate and re-review native planning. Replace the card at authorized freeze. Ask on scope changes.

### Requirement: Bound short approval decisions

The card SHALL bind repo, change, mode, integrated policy revision, registered worktree, frozen SHA and mode digest. Retain card, reply, scope and restrictions.

#### Scenario: Approval only
- **WHEN** authenticated `approve` matches one current card, HEAD and frozen bytes
- **THEN** record exact plan or Goal Contract approval. Stop before execution.

#### Scenario: Approve and run
- **WHEN** `approve and run` matches that context
- **THEN** durably record exact approval and a separate bounded local grant before dispatch
- **AND** reuse qualified bindings for finite local gates, corrections, independent review and previewed commits within restrictions. Stop before external work.

#### Scenario: Invalid reply
- **WHEN** a reply is unbound, ambiguous, stale, mismatched or unverifiable
- **THEN** withhold approval, grant and dispatch. Report the predicate and retain the exact-identity approval route.

### Requirement: Context-aware next steps

Non-terminal stops SHALL use versioned status and retained observations for a compact Next-Step Footer with one ready input or two to four genuine choices, without policy relay.

#### Scenario: Inspect a checkpoint
- **WHEN** inspecting a change or stopping a phase
- **THEN** report change, mode, branch, exact HEAD, frozen digest, attempt/checkpoint/handoff location, PR/checks, P1–P8, first unresolved predicate, restrictions, invariants/drift, missing evidence and next action
- **AND** keep inspect/init read-only. Paid probes and profile updates require separate authority.

#### Scenario: Resume in context
- **WHEN** a phase boundary, context limit or wait needs a new session
- **THEN** offer a self-contained starter with exact change, state and scoped worktree and record access
- **AND** retain the predecessor until the successor confirms exact HEAD, digest, ownership, pane and grant. Rotate only at a safe checkpoint with separate authority and original settlement checks.

#### Scenario: Blocked route
- **WHEN** a package or binding is absent or mismatched, or the phase is blocked
- **THEN** report predicate, safe choice and evidence. Exclude substitutes, launchers and profile edits.

### Requirement: Bounded protected closeout resume

Under `finish`, delivery SHALL bound waits for exact reviewed PR head checks, reuse PRs and advance eligible chapters once. `continue` reuses grant and verified remote state.

#### Scenario: Same-head checks complete
- **WHEN** authorized PR checks and reviews pass on the reviewed SHA
- **THEN** perform protected merge, integrated gates, scope-bound spec promotion, record-only archive, acceptance-bound issue closure and cleanup
- **AND** run full tests and fresh exact-closure review before archive publication. Skip completed merges.

#### Scenario: Wait stops
- **WHEN** a required check or deploy gate fails, human action is needed, head changes or time expires
- **THEN** pause with exact head, evidence, reason and checks required by protection and rulesets. Seek bounded disposition for optional queues without requiring them or rerunning.

#### Scenario: External verification and preview
- **WHEN** a push could trigger external automation, external or paid tests are requested, or a deploy preview needs review
- **THEN** require a per-run grant before activation with target, cases, built-artifact-only exposure and cost/credits
- **AND** show the preview URL, honor human pauses, use loopback, tear down tunnels immediately and separately authorize retries.

### Requirement: Retire verified worktrees across resumed runs

Authorized `finish` SHALL retire proven eligible same-change worktrees after verified archive and authorized issue closure where applicable, preserving evidence, refs and restrictions.

#### Scenario: Retire earlier worktrees
- **WHEN** finish finds earlier dedicated worktrees
- **THEN** match repository, change, canonical path, role and ref/detached SHA to live registration and creation/handoff evidence
- **AND** check exact HEAD, containing closure reachability, no writers, tracked/untracked cleanliness, ignored data and submodules. Remove without force, verify path and registration absence and refs.

#### Scenario: Preserve protected worktrees
- **WHEN** ownership is unproved, or a worktree is primary, independent, unrelated, live, locked, dirty, unmerged, holds valuable ignored data or is operator-retained
- **THEN** preserve it and its refs. Suffix, role or ancestry alone cannot prove ownership.
- **AND** report removed, retained and blocked paths with reasons, separately from archive/issue state. Resume cleanup without publication or new checkouts.

### Requirement: Separate post-release skill sync

After canonical release or accepted non-deployed integration, `sync-skills` SHALL require explicit client/profile, revision and scope authority.

#### Scenario: Approved sync
- **WHEN** authorized
- **THEN** use the supported route with collision checks, backups and Hermes scanning or Codex copy provenance
- **AND** verify complete bytes and versions against immutable source and load in a fresh session. Test with scratch profiles/homes and commit-pinned upstream.

#### Scenario: Blocked sync
- **WHEN** authority is absent or drift, curator conflict, scanning or collisions block sync
- **THEN** retain installation and report options. Target-project work SHALL NOT edit shared installations.

### Requirement: Restricted Git child environment
The evidence and workspace helpers SHALL read and forward inherited environment
values only from a documented execution allowlist. They SHALL refuse inherited
topology and command-config injection overrides before launching Git, even when
those overrides have empty values.

#### Scenario: Forbidden override presence
- **WHEN** any previously refused Git override is present, including an empty value or a Windows case variant
- **THEN** either helper fails before launching Git without reading the override value or silently dropping it and continuing

#### Scenario: Unrelated inherited values
- **WHEN** the inherited environment includes unrelated credential or execution-injection values
- **THEN** neither helper reads those values or forwards them to a Git child
- **AND** synthetic getter tests and actual child-environment tests demonstrate that restriction without accessing real credentials

#### Scenario: Platform-specific names
- **WHEN** a supported platform resolves inherited allowlisted names
- **THEN** Windows matching is case-insensitive and ambiguous aliases are refused; Linux and macOS matching is case-sensitive
- **AND** simulated Windows matching alone does not establish native Windows support

### Requirement: Explicit Git configuration compatibility
Both helpers SHALL retain present `GIT_CONFIG_GLOBAL`, `GIT_CONFIG_SYSTEM` and
`GIT_CONFIG_NOSYSTEM` values as trusted configuration selectors. Absent selectors
SHALL remain absent. Configuration selection SHALL NOT permit topology or
command-config injection overrides or be described as a sandbox.

#### Scenario: Explicit fixture configuration
- **WHEN** isolated fixtures select synthetic global/system configuration or disable its use through the documented selectors
- **THEN** both helpers preserve those values, including empty values, for Git to interpret rather than silently reverting to host configuration

#### Scenario: Default configuration discovery
- **WHEN** configuration selectors are absent
- **THEN** both helpers leave them absent and retain documented runtime/home configuration discovery inputs
- **AND** executable search paths, home/config locations and Git configuration remain explicit trust inputs

### Requirement: Preserved Git integrity controls
Environment hardening SHALL preserve fixed replacement-object and optional-lock
controls, fsmonitor neutralization, and existing topology, identity, ancestry and
dirty-work protections in both helpers. It SHALL NOT turn a refusal into permission
to repair, discard or redirect repository state.

#### Scenario: Conflicting inherited controls
- **WHEN** inherited values conflict with replacement-object or optional-lock safety settings or the fixed output locale
- **THEN** Git children receive `GIT_NO_REPLACE_OBJECTS=1`, `GIT_OPTIONAL_LOCKS=0` and `LC_ALL=C` independently of those values, with fsmonitor still neutralized

#### Scenario: Existing integrity failure
- **WHEN** a repository fails an existing replacement-ref/graft, topology, identity, ancestry or dirty-work check
- **THEN** the relevant helper continues to refuse the operation and preserves the work

### Requirement: Equivalent workspace path rejection
Workspace validation SHALL reject C0 control characters and DEL without broadening
or weakening the existing character restriction. Absolute, normalized and canonical
path requirements, symlink refusal and workspace-overlap checks SHALL remain intact.

#### Scenario: Control-character equivalence
- **WHEN** every UTF-16 code unit and representative multicharacter Unicode paths are compared against the original character restriction
- **THEN** the replacement predicate has identical results, rejecting character codes below 32 or equal to 127
- **AND** other path-validation failures remain failures independently of the character predicate

### Requirement: Complete-package security acceptance
Hardening acceptance SHALL require safe community verdicts for all seven complete
packages using the unchanged trusted scanner with negative controls. It SHALL NOT
rely on exclusions, suppressed findings, bypass flags or a prototype-only scan.
Authorization wording changes SHALL preserve existing side-effect boundaries.

#### Scenario: Safe prototype but blocked distribution
- **WHEN** a scratch prototype scans safe but a complete package remains blocked
- **THEN** the security gate and hardening acceptance remain incomplete, and historical failures are retained rather than rewritten

#### Scenario: Clarified authorization wording
- **WHEN** scanner-flagged issue-authorization prose is clarified
- **THEN** explicit project adoption and bounded issue-write authority remain required, and installation or a planning-only request grants no additional side effects

#### Scenario: Candidate acceptance evidence
- **WHEN** a hardened candidate is presented for completion
- **THEN** its complete package inventory, affected versions/documentation, native Linux/macOS/Windows results, full-package scanner output and independent exact-candidate review are verified
- **AND** missing native platform evidence or unresolved findings block completion rather than being replaced with simulated results or release claims

### Requirement: Integrated opt-in for bounded approach review

The bounded approach gate SHALL apply only to a later change whose verified integrated plan parent explicitly selects it. It SHALL preserve the applicable approval, candidate review, publication and operator authority gates.

#### Scenario: Strict path retained
- **WHEN** a pre-execution review applies but the integrated parent has not selected convergence, including the change introducing it
- **THEN** the existing literal `Verdict: No findings` rule with empty findings and coverage limitations remains in force, and an unintegrated edit cannot select the new gate

#### Scenario: Readiness is not authority
- **WHEN** the bounded gate reports freeze-ready for a Task-Guided plan
- **THEN** freeze still requires separate commit authority, and exact-plan approval binds the frozen SHA and plan digest without granting execution or remote writes
- **AND** an explicitly reviewed Goal-First draft still requires exact Goal Contract approval and a local execution grant before work

### Requirement: Fixed independent approach review and retained finding history
Before review #1 the orchestrator SHALL fix a review charter, pass rule, budget and qualified independent read-only reviewer binding. It SHALL admit that binding before launch and retain a change-owned record from review #1 with a zero initial correction count. Each accepted receipt SHALL bind the complete, unchanged planning inputs and expected fresh reviewer session.

#### Scenario: Unqualified route or stale evidence
- **WHEN** the requested route is a subagent, unknown, or broader than allowed, or the receipt has wrong identity, partial coverage or input drift
- **THEN** the route is refused before launch or the receipt is rejected, respectively; no substitute or backfilled credit is allowed

#### Scenario: Fresh review carries the ledger
- **WHEN** a later reviewer receives the retained ledger
- **THEN** the reviewer first checks open stable IDs for resolution, persistence or regression, then reports new findings with stable IDs, severity, path and line, impact, trigger and remedy
- **AND** an empty verdict does not erase unresolved findings and any applied finding retains its re-review reference

### Requirement: Charter-based approach acceptance
The reviewer SHALL classify each coverage limitation as `packet-gap`, `declared-deferral`, `containment-boundary`, or `unclassified`. The newest complete receipt SHALL pass only for `Verdict: No findings` or a verdict with only advisory Low findings, no open in-scope High or Medium findings, and only verified `declared-deferral` or `containment-boundary` limitations. Neither the operator nor the orchestrator may reclassify a limitation or downgrade a finding.

#### Scenario: Advisory findings and verified exceptions
- **WHEN** a fresh receipt reports only Low findings with stable IDs, and all limitations are `declared-deferral` entries citing existing reviewed task IDs or their named executable gates, or `containment-boundary` entries matching the fixed charter
- **THEN** retain the Low findings without reopening the loop; retain the deferrals for closure by later task evidence before candidate acceptance and allow freeze readiness

#### Scenario: Out-of-scope observation
- **WHEN** a reviewer records a High or Medium observation outside the charter with no violated in-scope clause
- **THEN** retain it as advisory in the ledger with original severity and explicit scope disposition; the reviewer records it separately from in-scope verdict findings, and a failing native verdict is not rewritten

#### Scenario: Blockers and invalid exceptions
- **WHEN** an in-scope High or Medium finding remains open, a deferral lacks an existing task or executable gate, a containment boundary is undeclared, a limitation is `unclassified`, or a report contradicts its verdict or classifications
- **THEN** readiness is rejected without rewriting the report or weakening the pass rule

#### Scenario: Packet-only failure
- **WHEN** the reviewer classifies a limitation as `packet-gap`: missing packet evidence needed for an in-scope claim, or inconsistent packet-only metadata (for example, conflicting disposition references in the evidence packet rather than in the planning artifacts)
- **THEN** readiness stays blocked until a fresh review verifies the repair. Allow one packet-only repair and re-review per unchanged planning snapshot without consuming a plan correction cycle; if the rerun still identifies a packet gap, stop without charging a plan cycle.

### Requirement: Finite routine planning corrections
Within an existing grant the orchestrator SHALL apply only grounded routine draft corrections in authorized planning paths, run native strict and metadata validation, re-hash the complete inputs, and re-review without an operator relay. The default ceiling is three automatic plan correction cycles; narrower grants prevail and resuming never resets a count.

#### Scenario: Convergent draft
- **WHEN** a synthetic chartered draft has only routine blockers and verified repairs within budget
- **THEN** it reaches freeze-ready within three automatic corrections without intervening operator turns

#### Scenario: Stop without fallback
- **WHEN** budget is exhausted, a non-routine or repeated unresolved conflict occurs, validation or preflight fails, or the same binding fails to launch twice in succession
- **THEN** stop with one decision card and preserve authority restrictions, work and evidence; a failed launch is an attempt, not a correction, and a different route or fourth cycle is not implied

### Requirement: Explicit Goal-First adoption

Delivery SHALL derive Goal-First eligibility from the verified integrated parent. It SHALL use Task-Guided for mandated sequence, prescribed method or staged authority, and SHALL preserve existing frozen plan authority.

#### Scenario: Future parent opts in
- **WHEN** a later reversible local change has an integrated parent explicitly selecting Goal-First and no ordered or staged boundary
- **THEN** Goal-First is the default
- **AND** the orchestrator requires an approved Goal Contract and a bounded local execution grant

#### Scenario: Parent lacks opt-in or boundary requires order
- **WHEN** opt-in is absent, appears only in the change's own contract edits, or the change requires ordered or staged control
- **THEN** exact frozen plan approval and the applicable Task-Guided group gates remain required
- **AND** a later review, continuation request or contract edit cannot widen an already frozen change's grant

### Requirement: Bounded Goal Contract

A Goal Contract SHALL state the outcome, allowed scope, hard operator invariants, explicit non-goals, adaptable legacy assumptions, executable acceptance and finite time and correction budgets. Native tasks SHALL hold one local outcome checkbox as the sole mutable progress record, with any explicit external closeout gate kept separate from local authority.

#### Scenario: Valid local approval
- **WHEN** the integrated parent permits Goal-First and approval binds every required contract field with an explicit local execution grant
- **THEN** the orchestrator can advance the verified outcome with adaptations confined to the approved boundary

#### Scenario: Missing or altered contract field
- **WHEN** a required invariant, exclusion, acceptance gate, budget or exact approval binding is missing or changed
- **THEN** execution is refused until the contract and required authority are resolved

### Requirement: Goal alignment and correction

Delivery SHALL verify goal alignment at every phase boundary and after each correction. It SHALL enter bounded correction automatically for actionable in-scope routine failures, and SHALL stop for material drift, exhausted budgets, unknown ownership, missing authority or unrecoverable environment failures.

#### Scenario: Routine failure or obsolete assumption
- **WHEN** a gate or review finds a correctable in-scope defect, or empirical evidence invalidates an adaptable legacy assumption, and correction budget remains
- **THEN** the orchestrator corrects locally, revalidates and re-reviews without an operator turn or refreezing an unchanged Goal Contract

#### Scenario: Material conflict
- **WHEN** continuing would change a hard invariant, exclusion, acceptance boundary or authority
- **THEN** delivery returns `DIRECTION_DRIFT_CHOICE` with the affected contract clause and stops before further mutation

#### Scenario: Result verification
- **WHEN** final tests pass but independent review is missing, stale, limited or has unresolved findings
- **THEN** the result remains unverified and the outcome checkbox is not completed
- **AND** positive verification binds the executable gate evidence and a fresh independent read-only result review to the same exact candidate

### Requirement: Bounded breaking-upgrade discovery

Planning SHALL allow bounded, disposable-scratch empirical verification of declared breaking dependency, runtime and CLI assumptions before contract lock, within local planning authority and disposable configuration.

#### Scenario: Observe real behavior
- **WHEN** static sources disagree or are incomplete about a breaking upgrade
- **THEN** an authorized bounded probe uses isolated scratch home, configuration and caches, with no repository or installed-profile writes
- **AND** observations inform planning and cannot satisfy execution acceptance or grant external action

### Requirement: Structured preflight and delivery status

Delivery SHALL provide runnable preflight, policy, workspace reconciliation, status and verified handover commands with deterministic JSON results. Read-only inspection SHALL preserve repository, profile, remote and worker state and SHALL report paid or write-dependent checks as explicit pending steps unless separate authority and verified evidence are available.

#### Scenario: Read-only status
- **WHEN** an operator or consumer inspects the selected change with `--json`
- **THEN** the versioned envelope reports the change, mode, state, candidateSha, planDigest, activeAttemptId, stopPredicate, contextHint and recommendedNextAction from verified observations
- **AND** missing or uncertain evidence is explicit, identical observations yield identical output, and no recommendation executes automatically

#### Scenario: Startup and recovery
- **WHEN** the operator invokes read-only preflight or reconciles resumed work
- **THEN** the command reports each P1–P8 observation and readiness, validates integrated-parent and skill identity, and reports candidate, ownership or unfinished-attempt uncertainties before dispatch
- **AND** any fresh paid probe stays subject to its separate execution grant

#### Scenario: Sealed handover
- **WHEN** a consumer reads role handover or active-attempt evidence
- **THEN** it verifies the exact identity and sealed files before reporting state or eligibility, and blocks on incomplete or mismatched evidence

### Requirement: External verification authority and data boundary

Delivery SHALL require exact authority for external or paid runs and retries, tunnels and external automation. Only eligible bounded automatic review and verified standing zero-cost finish triggers are exceptions. Authority SHALL bind target, exposure, cost or credits and run count.

#### Scenario: Tunnels and vendor defaults
- **WHEN** a vendor asks for a tunnel, auto-test or retry
- **THEN** refuse an unapproved run. Serve only an authorized built artifact and tear down its tunnel after either outcome. Source, credentials, live data and account operations stay outside that exposure.

#### Scenario: Publication and preview
- **WHEN** an authorized push or preview can trigger external automation
- **THEN** inspect trigger authority before activation, including any required local-only UI checks and separately approved pre-merge preview pause.

### Requirement: Exact candidate and bounded planning verification

Candidate guards SHALL include ignored content in cleanliness assessment and require gate evidence from a clean disposable checkout at the exact candidate SHA. Planning inventory callers SHALL share finite file, entry, byte, depth and output budgets. For new identities the verified inventory SHALL cover safe applicable custom schema artifacts throughout drafting, freeze, review, readback and archive.

#### Scenario: Candidate context contamination
- **WHEN** a candidate workspace contains unapproved ignored inputs or the gate checkout or evidence SHA differs from the candidate
- **THEN** candidate verification refuses admission until an isolated clean exact-SHA run is observed

#### Scenario: Inventory budget exceeded
- **WHEN** a planning tree exceeds any aggregate inventory limit or cannot be completely and safely read
- **THEN** the guard refuses the snapshot without accepting a partial digest or planting a fallback

#### Scenario: Intent-Driven artifact
- **WHEN** a native custom schema produces a safe regular planning artifact such as `adr/0001-decisions.md` under the change directory
- **THEN** draft and committed inventories agree on its coverage and include it in independent review, exact planning hashes and mode-bound approval
- **AND** adding, dropping, changing or substituting that artifact after freeze invalidates identity, and record-only archive preserves its relative location and bytes

#### Scenario: Excluded or unsafe inputs
- **WHEN** a change contains `evidence/`, hidden paths other than native root `.openspec.yaml`, path aliases, symlinks or non-regular entries
- **THEN** evidence and excluded hidden paths stay outside approval and provider exports, and an unsafe entry in the included inventory causes closed failure
- **AND** an existing approved plan retains its original inventory interpretation and digest

### Requirement: Finish readiness for current specs

The orchestrator SHALL verify that the candidate's native delta requirements are promoted into the corresponding current specs with valid current-spec identity metadata before declaring finish ready.

#### Scenario: Missing or mismatched promotion
- **WHEN** a delta remains unapplied, is semantically mismatched, or its current spec has invalid identity metadata
- **THEN** readiness reports the exact deficiency and blocks terminal delivery until the implementation candidate is corrected and reverified
- **AND** record-only closure preserves product and current-spec content

### Requirement: Evidence-backed delegated delivery

For a project selecting delegated execution, delivery SHALL use qualified paired role bindings and verified claim, settlement and handover observations before applying existing gate, exact-candidate and continuation policy. The orchestrator SHALL remain the only Git and native task writer.

#### Scenario: Next hands the request to delivery
- **WHEN** the operator uses `openspec-next` to resume a delegated change
- **THEN** it resolves the full change and workspace and passes the original restrictions to delivery
- **AND** read-only inspection launches nothing, and delivery alone decides the eligible outcome or group using approved identity, authority, dependencies, budget and stops.

#### Scenario: Continue in native order
- **WHEN** a settled implementer handover matches the assignment and post-worker scope and hard invariants pass
- **THEN** the orchestrator runs the required gates, controls task progress and commit batches, and obtains fresh independent read-only acceptance for the exact candidate
- **AND** a permitted dependent Task-Guided group starts only after the predecessor's accepted evidence, while Goal-First returns its approved local outcome through the same gates.

#### Scenario: Evidence or authority is missing
- **WHEN** ownership is uncertain, the handover fails, review is missing or stale, gate evidence is invalid, or a narrower restriction or separate grant prevents advancement
- **THEN** delivery preserves the relevant candidate and attempt and reports the stop predicate with zero dependent starts
- **AND** it never treats process completion as review or acceptance, widens the grant, substitutes an inline writer or publishes by implication.

#### Scenario: Exact candidate receives an in-scope finding
- **WHEN** verified evidence identifies a routine in-scope defect within the held grant
- **THEN** delivery consumes the existing cumulative group correction budget or its narrower inherited limit and reruns exact-SHA gates and independent review for the successor
- **AND** a missing evidence record, exhausted budget, material direction drift or failed containment stops without manufactured acceptance.

#### Scenario: Advertise a runtime only after qualification
- **WHEN** an operator reads the distributed role configuration and supported-route documentation
- **THEN** it reflects the exercised version, client, route and roles and current package versions, with unqualified routes identified as unsupported
- **AND** the live qualification record uses separate bounded authority and an independently controlled supervisor and demonstrates both successful delivery and fail-closed behavior without publication.

### Requirement: Native task completion admission

Under verified adopting policy, protected finish SHALL accept a task-completion child only after re-verifying the sealed zero-waiver result for its exact parent and the child's one permitted native task edit. It SHALL keep the original review SHA and gate the actual finish head independently.

#### Scenario: Accepted checkbox transition
- **WHEN** the proposed finish head has exactly one parent which is the admitted zero-waiver reviewed and gated SHA, and the orchestrator flipped one or more previously unchecked accepted native task IDs to lowercase `[x]`
- **THEN** the guard verifies that the sole changed path is that change's `tasks.md`, mode and every other byte match, and both snapshots have the same approved plan digest
- **AND** finish requires complete native tasks, promoted current specs, a clean exact-head disposable gate readback, and separate finish authority bound to the child SHA
- **AND** retained evidence identifies the exact reviewed parent, acceptance child and changed task IDs without rewriting the review as a child review

#### Scenario: Unproved checkbox claim
- **WHEN** a parent, review, waiver, task ID, status transition, mode, exact byte difference, digest, current spec or exact-head gate fails verification
- **THEN** admission stops. A change outside the exception follows the ordinary exact-candidate review and gate route.

### Requirement: Bounded paid contained-review authorization

Eligible independent reviews SHALL retain integrated-parent mode, phase and ceiling checks, pinned external host configuration, and durable accounting. Both automatic and separately granted explicit launches SHALL be supported.

#### Scenario: Default mode and configured ceilings
- **WHEN** the integrated parent adopts defaults
- **THEN** apply automatic limits of 10 reviews and USD 25 shared across planning, execution and finish. Use a complete provable upper bound for all invocations. Existing pins and prospective project ceilings retain their applicability.

#### Scenario: Concurrent or resumed automatic use
- **WHEN** an eligible automatic launch is proposed
- **THEN** verify exact review identity, phase, host hash and scope, then serialize a reservation for the entire bounded cost before provider contact. Retain spent and uncertain amounts and reject replay or over-allocation.

#### Scenario: Missing or exceeded automatic bounds
- **WHEN** a phase, pin, effective bound or reservation cannot be verified or is exceeded
- **THEN** refuse launch without fallback. Only a matching signed extension can raise an eligible cap within the integrated ceiling.

#### Scenario: Single-run authority
- **WHEN** a run uses explicit admission, is a retry, or is governed by inherited single-run policy
- **THEN** require distinct exact authority with the applicable cost and exposure. Review authority cannot grant plan approval, execution, finish or profile updates.

### Requirement: Standing zero-cost finish triggers

Under separately granted protected finish, delivery SHALL recognize only named, verified zero-cost repository triggers explicitly adopted by integrated-parent policy. It SHALL match repository, event, target, trigger identity, configuration and authorized exposure against a current complete inventory before activation.

#### Scenario: Verified standing repository automation
- **WHEN** an authorized push or integration event will activate solely matching configured zero-cost repository jobs within their verified standing exposure
- **THEN** finish can proceed without requesting a second grant for those jobs and retains the inventory and match
- **AND** repository-local bindings can document a verified example such as this repository's Aikido PR/main checks using the same tool-agnostic contract.

#### Scenario: Scope or cost is unknown
- **WHEN** any live trigger differs from the verified standing entry or is paid, unknown, a tunnel, or a deploy preview
- **THEN** it needs separate single-run authority before activation unless the exact action qualifies under Bundled finish trigger reservations. Missing or stale inventory blocks activation.

### Requirement: Optional candidate-bound local pre-PR harness

Delivery SHALL support an optional declarative CLI or MCP harness in external host configuration. Before final review and PR push, the configured harness SHALL check the exact committed candidate in a standalone detached clone and retain sealed JSON with `schemaVersion`, `harnessId`, `candidate`, `verdict`, `findings` and `observedAt`.

#### Scenario: Configured harness for the committed SHA
- **WHEN** delivery prepares final review and protected publication for a committed candidate and a local harness is configured
- **THEN** the authorized check runs with its working directory and scan target bound to the same clean, standalone detached clone at that SHA, and the host verifies the sealed result's schema, configured identity, committed SHA and verdict
- **AND** final review and pre-push checks consume that verified result. Missing, invalid, stale or non-passing evidence blocks progress and a changed SHA requires a new result.

#### Scenario: Reject a linked or mismatched checkout
- **WHEN** the proposed clone is a linked worktree, attached to a branch, dirty, aliases the mutable source checkout, or is at another SHA
- **THEN** refuse both CLI and MCP invocation and refuse a passing seal if the required checkout identity or cleanliness no longer holds on return.

#### Scenario: Harness disabled
- **WHEN** there is no configured harness
- **THEN** delivery proceeds under the existing independent review and protected finish requirements.

#### Scenario: Configured check needs separate authority
- **WHEN** a configured harness would expose data externally, invoke a paid service or trigger external automation
- **THEN** delivery requires the applicable separate authority before activation. A harness result cannot substitute for independent review.

#### Scenario: Repository-local harness example
- **WHEN** the project presents its local harness and standing $0 trigger examples
- **THEN** its guides show Aikido local scan and `aikido_deep_review` using the generic detached-clone and result contracts, including the linked-worktree `git ls-files` failure mode
- **AND** the portable skills contain no Aikido-specific adapter or dependency.

### Requirement: Operator workflow guidance

The distribution SHALL publish a current guide index and visual walkthrough of prompt authority, checkpoints, external settings, native schemas and protected closure.

#### Scenario: Current role and schema setup
- **WHEN** an operator sets up a role or optional native schema
- **THEN** the synchronized guides show effective settings, supported routes and limits, fixture versus live evidence and operator decisions. Native schema inputs stay within the same frozen identity and evidence checks.

#### Scenario: Review and closeout text
- **WHEN** an operator follows protected finish guidance
- **THEN** show optional exact-candidate pre-PR harness setup and evidence, repository-local Aikido checks and trigger examples, and explicit issue closure after accepted integration and archive readback. The closure PR template omits auto-close keywords.

### Requirement: Explicit external AI role configuration

Enabled roles SHALL use validated external bindings. Non-review roles retain their supported role tuples and version policy. The Direct-CLI Reviewer uses client, model, optional reasoning effort, timeout and packet concurrency with trusted accounting settings.

#### Scenario: Resolve a supported explicit binding
- **WHEN** an operator selects an enabled role and supported values
- **THEN** map the approved settings deterministically into the selected CLI or OpenSpec opener and verify the effective binding. Non-AI harnesses require only their own settings.

#### Scenario: Reject missing or unsupported role settings
- **WHEN** a required setting is absent, ambiguous, overridden or unsupported
- **THEN** refuse dispatch and report the failed predicate without substituting global settings or another adapter.

### Requirement: Flexible audited runtime version policy

External role configuration SHALL keep audited version floors and inclusive optional maximums, exact pins and explicit version comparison opt-outs on applicable routes.

#### Scenario: Compare observed versions
- **WHEN** comparison is enabled
- **THEN** accept the configured version or range and reject a mismatch. Required runtime identity and qualification checks still apply.

#### Scenario: Audit an explicit opt-out
- **WHEN** comparison is explicitly disabled
- **THEN** retain the observed version and audit state. Identity, effective settings and applicable boundary failures still block launch.

### Requirement: Moderated external host discovery and setup

Discovery SHALL be fast, redacted and read-only across supported desktop OSes. Setup SHALL preview exact external paths, bytes and raw SHA-256 before writing only on matching confirmation.

#### Scenario: Discover installed or unavailable tools
- **WHEN** discovery inspects installed clients and OpenSpec
- **THEN** report available paths, observed versions and locally observable options. Mark unavailable tools missing and unverifiable facts unknown.

#### Scenario: Dry-run approved role choices before writing
- **WHEN** the operator selects reviewer client, model, optional reasoning effort, timeout and packet concurrency
- **THEN** preview the minimal host settings and any other requested role-binding or opener outputs. Normal host authentication needs no relay, tier or cloned auth-home setup.

#### Scenario: Refuse conflicting or changed destinations
- **WHEN** a confirmation is stale, output would touch a repository or live profile, or the destination is unsafe or unapproved
- **THEN** refuse writes and preserve existing files, profiles and credentials. Discovery and setup perform no inference or installation.

#### Scenario: Report the observed Grok version
- **WHEN** a trusted installed Grok produces recognized version output
- **THEN** report its observed version. Supported legacy output remains recognized for the Implementer identity.

#### Scenario: Stage an explicit alternative reviewer
- **WHEN** the operator chooses any supported reviewer
- **THEN** verify the exact client and effective settings, and surface any host or capability blocker before launch without fallback.

### Requirement: Deterministic isolated distribution verification

The local and CI test gates SHALL preserve existing assertions, test inventory, isolated mutable fixture state and explicit fixture HOME. The launcher recovery test SHALL prove the original supervisor can settle and publish exactly one handover after its launcher is killed.

#### Scenario: Recovery under repeated execution
- **WHEN** isolated runs exercise launcher startup, termination, original-attempt recovery and replay
- **THEN** test synchronization distinguishes a live launcher from one that has already exited, the same supervisor publishes one sealed late handover, and recovery replay returns the same result without an `ESRCH` failure or a false pass.

#### Scenario: Isolated performance comparison
- **WHEN** the seven slow suites are scheduled across parallel or sharded isolated fixture runs
- **THEN** the gate retains every assertion, aggregates all failures and completes once for each required test
- **AND** comparable baseline and candidate timings on the same documented runner class test the approximately 8–12 second target. If optimization cannot preserve deterministic isolation, retain serial scheduling for the affected component and record the blocker.

### Requirement: Operator-signed review cap extension

The integrated workflow SHALL accept a host-retained operator-signed grant for mid-execution review count or USD cap extension only against the exact approved plan, change and durable ledger. The extension SHALL operate prospectively within the original integrated ceilings and retained scope.

#### Scenario: Extend a partially consumed cap
- **WHEN** the host verifies a trusted operator signature, grant identity, validity window, exact frozen plan and digest, change, execution authority and ledger identity, and requested count or USD cap
- **THEN** admission records the extension once and applies the new caps to subsequent reservations within the verified integrated ceilings
- **AND** previous reservations, uncertain spend, original authority, existing restrictions and exact-candidate evidence requirements carry forward, with no plan refreeze.

#### Scenario: Refuse invalid or competing extensions
- **WHEN** the signature or authority is invalid, the grant is expired, stale, replayed or cross-change, ledger state is missing or ambiguous, the plan or ledger binding differs, or caps exceed permitted bounds
- **THEN** refuse any increase. Competing reservations and claims are serialized, and unavailable budget stops inference with ledger evidence. Each retry still needs its applicable separate authority.

### Requirement: Bundled finish trigger reservations

A separate named finish grant SHALL support finite, explicitly selected credit reservations for verified paid triggers across both protected PR chapters and at most one authorized zero-cost CI retry for the same SHA under the verified transient-failure predicate.

#### Scenario: Reserve paid PR trigger credits
- **WHEN** a finish grant specifies a positive finite credit cap for an identified paid trigger and current complete inventory confirms identity, configuration, exposure, repository, chapter, event, target, exact SHA and cost
- **THEN** durably reserve the matching credits before activation and account for both implementation and closure PRs against the same cap, including across resume and uncertain outcomes.
- **AND** a grant can cover two Aikido Deep Review credits across the two PRs if the observed inventory matches. Membership in the cap supplies no authority for unrelated triggers or other product operations.

#### Scenario: Retry a proved transient CI failure
- **WHEN** the grant includes `maxZeroCostCiRetries: 1`, a known zero-cost check has a verified transient failure, and a verified equivalent push run for the identical expected SHA has passed
- **THEN** reserve and perform one specifically scoped retry of that check and verify exact-head results before progress. A changed SHA, unknown cost, exceeded balance, repeated retry, missing evidence or deterministic test failure blocks the bundled action.

### Requirement: Verified post-review PR-fix lineage

Protected finish SHALL verify post-review PR corrections through exact non-waived review coverage, Git ancestry and candidate evidence. The original reviewed SHA SHALL remain truthful through finish readiness, protected finish and archived receipt readback.

#### Scenario: Exact-head disposition or delta re-review
- **WHEN** a narrowly scoped PR security or CI fix follows an independently accepted zero-waiver ancestor on the same approved plan
- **THEN** verify the exact ancestor and ordered SHA chain, real fix reasons and finding dispositions, and an independent evidence-backed determination for the exact delta and final head
- **AND** require complete postimage coverage and re-review of changed or impacted evidence where necessary, zero unresolved or waived findings, the actual final head's disposable gates, promoted specs and separately held finish authority for that head
- **AND** retain the exact ancestor, final head, range and verification references in the finish and receipt chain, and replay them against actual integration and archive custody.

#### Scenario: Insufficient or mismatched lineage
- **WHEN** ancestry is ambiguous, changes escape the fix scope, a disposition tries to waive a finding, or exact evidence or coverage cannot be verified
- **THEN** the targeted route fails closed. An eligible changed head requires ordinary full exact-candidate re-review before it can advance.

### Requirement: Direct contained review launch guidance

Published examples SHALL use standalone Node launch and identify exact input bindings and held authority.

#### Scenario: Review invocation in Codex
- **WHEN** following a documented candidate or approach launch
- **THEN** invoke `node …/review-candidate.mjs` directly, preserve host permission checks, and keep offline preparation, live admission, replay and readback as separate steps.

### Requirement: Synchronized Direct-CLI review distribution

The packaged workflow SHALL use one default Direct-CLI review route, synchronized setup and documentation across both complete skills and their Claude bundles, and a prospective policy boundary for existing plans.

#### Scenario: Verify the exact build and documentation inventory
- **WHEN** the exact candidate is verified
- **THEN** check the advertised package file sets, shared script parity, required version bumps, current links and executable launch examples. Synchronize README, root and owning skill contracts, Claude and OpenSpec installation, workflow, review configuration, external backends, worker runtime, reviewer, operator runbook and tutorial guides.
- **AND** the integration spec occupies at most 63,488 UTF-8 bytes, the archive tree is unchanged, and current references to retired components are removed except for any indispensable, documented receipt compatibility field.

#### Scenario: Review governed by an existing plan parent
- **WHEN** a planning, execution or finish review is governed by an integrated parent whose policy selected the original reviewer
- **THEN** keep that exact review policy, pins, captures, zero-waiver checks and approved authority. A new default takes effect only under the adopting integrated parent.
- **AND** if a receipt field cannot be migrated without breaking an active admission or finish reader, preserve and verify the exact minimal field and document its applicability. A mixed or unknown schema does not establish successful replay.

### Requirement: Intent-first operator prompting guidance
The public tutorial SHALL teach intent-first prompts, bounded goals and Change Briefs, exceptions and verified resumption.

#### Scenario: Short turns
- WHEN following proposal and local delivery
- THEN show 3–4 typical turns through protected finish with authority per stop, including approval alone and a separate bounded local grant
- AND explain policy for `draft only`, `no commits`, `group 1`, `keep the worktree`, `task-guided` and `explicit`, and agent policy and SHA checks without pasting or lookups

#### Scenario: Briefs
- WHEN drafting a brief
- THEN put fail-closed fallback in the goal, distinguish hard invariants from adaptable legacy assumptions and limit mechanisms to essential boundaries
- AND separate planning and execution acceptance, verify pins read-only before proposing, explain Goal-First and Task-Guided eligibility and distinguish stops from permitted, budgeted recovery

#### Scenario: Exceptions
- WHEN facing failure or handoff
- THEN pair existing visuals with plain-language exception flow and a Never Auto-Approves list for exact approval, material scope or safeguard changes, separate spend and external work grants, protected publication and post-release profile changes
- AND cover bounded fixes, evidence-backed escalation and resumption, fresh sessions at settled phases or ~60% context, and skill bytes and fresh-session loading after authorized sync

### Requirement: Codex CLI approval ergonomics
The runbook SHALL link to portable Codex CLI launch and approval troubleshooting in the tutorial.

#### Scenario: Scoped launch
- WHEN launching Codex
- THEN show `codex --approve-for-me -C "$CHANGE_WORKTREE" --add-dir "$CHANGE_RECORDS"`, `/status` for writable roots and sandbox approvals versus delivery authority
- AND prefer `apply_patch` and direct `review-candidate.mjs` calls and explain prefix mismatches from heredocs, redirects and compound wrappers
- AND show approval-based rechecks of misleading `gh auth status` failures in network-blocked workspace-write before auth changes
