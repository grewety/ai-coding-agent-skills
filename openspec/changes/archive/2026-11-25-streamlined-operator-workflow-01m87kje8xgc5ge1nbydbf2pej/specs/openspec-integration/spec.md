# Spec Delta

## ADDED Requirements

### Requirement: Prospective proposal-to-freeze adoption

Delivery SHALL enable `propose-to-freeze` only when the verified integrated plan parent explicitly selects it. The orchestrator SHALL produce one plan-only freeze and approval card per accepted draft revision within the held authority and SHALL preserve the existing draft-only path and all narrower restrictions.

#### Scenario: Short proposal reaches an approval card
- **WHEN** an opted-in project receives a short proposal or `/goal draft` with an inline goal or a readable note, and the selected planning gates pass
- **THEN** the orchestrator verifies the baseline and relevant upstream facts, selects Goal-First or Task-Guided from the actual delivery boundary, prepares the ULID worktree before native scaffolding, binds the proposal-time issue where authorized, and validates the complete native artifacts
- **AND** it runs the packaged charter gate when selected or explicitly requested under the applicable policy, revalidates and re-reviews grounded corrections within the inherited authority and finite budget, and supplies any newly required native artifacts
- **AND** it freezes only the exact accepted planning inputs in one local plan-only commit and displays its full SHA and mode-specific digest. Planning leaves implementation untouched and does not launch an implementation worker or publish a branch

#### Scenario: Draft-only or absent adoption
- **WHEN** the parent lacks explicit selection, a contract change would adopt the policy for itself, or the operator requests `draft only` or `no commits`
- **THEN** the proposal stops at the applicable uncommitted boundary without issuing an approval card for a frozen plan
- **AND** an explicitly requested review can proceed within its own authority, with a compact stop decision on a missing binding, uncovered blocker, scope conflict, or exhausted budget

#### Scenario: Resolve breaking-upgrade assumptions
- **WHEN** accepted sources leave material uncertainty about a breaking upgrade
- **THEN** the orchestrator uses authorized disposable-scratch empirical probes before contract lock, records observed behavior, and keeps hard invariants distinct from adaptable legacy layouts, flags or assertions
- **AND** a probe does not reuse real profile state, grant paid verification, or satisfy a later exact-candidate gate

#### Scenario: Revise a draft
- **WHEN** the operator answers a planning question or replies `changes: <feedback>` with a clear, authorized revision
- **THEN** the orchestrator directly revises the planning artifacts, runs applicable validation and review again, and presents a replacement card for the newly authorized freeze when eligible
- **AND** an earlier card cannot authorize the revised plan, and feedback outside the existing scope raises a concise decision

### Requirement: Bound short approval decisions

An approval card SHALL identify exactly one repository, change, mode, integrated policy revision, registered workspace, frozen SHA, and mode-specific digest. The displayed card and operator reply SHALL be retained with scope and restrictions. Short replies SHALL fail closed on ambiguity, stale identity, mismatched context or an unverifiable operator decision.

#### Scenario: Approval only
- **WHEN** an authenticated operator reply `approve` unambiguously follows one current displayed card and the frozen planning bytes and HEAD still match
- **THEN** delivery records exact-plan or exact Goal Contract approval and stops without starting local execution

#### Scenario: Approval and local execution
- **WHEN** the operator replies `approve and run` to the same verified context
- **THEN** delivery binds exact approval and the separately bounded local execution grant as distinct durable records before dispatch
- **AND** local execution reuses matching qualified role bindings, proceeds through the already approved finite local gates, corrections, independent reviews and previewed commits, and stops before external work
- **AND** `group 1`, `no commits`, and other retained restrictions continue to govern the run

#### Scenario: Stale, unbound or cross-change reply
- **WHEN** the card was not displayed, the reply is ambiguous, identity or planning bytes changed, the HEAD differs, or competing changes prevent unique binding
- **THEN** the reply records neither approval nor an execution grant and starts no worker
- **AND** delivery explains the exact failed predicate and preserves the explicit exact-identity approval route for recovery

### Requirement: Context-aware next steps

Every non-terminal operator stop SHALL include a compact Next-Step Footer derived from the packaged versioned status output and retained observations. It SHALL offer one ready-to-send next input or two to four concrete choices for a genuine decision, with no routine policy relay.

#### Scenario: Inspect a checkpoint
- **WHEN** the operator or another session inspects the selected change or an authorized phase stops
- **THEN** deterministic output reports change, mode, branch and exact HEAD, frozen digest and active attempt when applicable, checkpoint or handoff location, PR and check state when applicable, P1–P8 observations and first unresolved predicate, restriction and invariant or drift state, and the legal next action
- **AND** absent evidence is visible, inspect/init perform read-only assessment, and any paid probe or profile update stays pending separate authority

#### Scenario: Preserve context on resume
- **WHEN** a clean phase boundary, context limit, or long wait warrants a new session
- **THEN** the footer offers a short self-contained starter citing the exact change and retained state plus a supported host launch example scoped to the change worktree and records
- **AND** an opted-in, separately authorized relay rotates only at a safe checkpoint and retains the predecessor until the successor acknowledges exact HEAD, digest, ownership, pane identity, and bounded grant evidence
- **AND** rotation or a new session grants no new authority and cannot bypass original-attempt settlement

#### Scenario: Refuse an unqualified route
- **WHEN** a selected package is missing or drifted, a role binding is missing or mismatched, or a real planning or execution blocker remains
- **THEN** the footer supplies the failed predicate, next safe choice, and retained evidence reference without silently substituting a reviewer, creating a local launcher, or editing an installed profile

### Requirement: Bounded protected closeout resume

Under a valid `finish` grant, delivery SHALL watch applicable protected checks for a finite period on the exact reviewed PR head, reuse existing PRs, and advance eligible approved closeout chapters when their predicates pass. A contextual `continue` SHALL use the retained grant and verified remote state.

#### Scenario: Same-head checks complete
- **WHEN** an existing authorized PR still targets the exact reviewed SHA and applicable checks and required reviews pass
- **THEN** delivery continues under the same grant through protected merge, exact integrated gates, necessary scope-bound spec promotion, record-only archive closure, acceptance-bound issue closure, and cleanup
- **AND** it runs full project tests on the archived closure candidate before publishing that PR and requires fresh exact-closure review
- **AND** it performs each already authorized eligible chapter once and does not open a duplicate PR or replay a completed merge

#### Scenario: Bounded wait encounters a stop
- **WHEN** a required check fails, a human must review or perform a task, the head changes, a deployment gate fails, or the deadline expires
- **THEN** delivery retains exact head and required-check/review evidence and pauses with the actionable reason
- **AND** it derives applicable required checks from branch protection and rulesets, distinguishes optional external suites, and surfaces stalled optional automation as a bounded operator decision when it needs disposition. It does not treat optional queue state as required protection or automatically rerun it

#### Scenario: External verification and preview
- **WHEN** a pending push could trigger external automation, an operator requests external or paid testing, or a declared deploy preview needs review
- **THEN** delivery enforces the separate per-action grant before activation and presents a compact card for an external test naming target, cases, built-artifact-only exposure, expected cost or credits, and one-run scope
- **AND** it surfaces the preview URL and preserves a declared human review pause, uses loopback for a local try-out, tears down an authorized temporary tunnel immediately, and requires new authority for a retry

### Requirement: Retire verified worktrees across resumed runs

Delivery SHALL reconcile all live same-change registrations against retained ownership evidence before terminal cleanup. An authorized `finish` SHALL retire each eligible dedicated attached or detached worktree after verified archive and applicable authorized issue closure, while preserving evidence, refs, and operator restrictions.

#### Scenario: Resume closes all eligible worktrees
- **WHEN** a resumed finish finds dedicated worktrees from earlier runs
- **THEN** delivery matches repository, exact change identity, canonical path, role and ref or detached SHA against creation or handoff evidence and current registration
- **AND** it rechecks exact HEAD and reachability from the actual containing closure revision, absence of active writers, tracked and untracked cleanliness, ignored data and submodules, then removes eligible worktrees without force and verifies registration and path absence and retained refs

#### Scenario: Preserve protected or ambiguous worktrees
- **WHEN** a worktree is outside verified ownership, is primary, an independent clone, unrelated, live, locked, dirty or unmerged, contains valuable ignored files, or is retained by operator restriction
- **THEN** delivery leaves it and its refs intact. A path suffix, role nickname, or matching ancestry alone does not establish ownership
- **AND** it reports removed, retained and blocked paths with reasons separately from accepted archive and issue state. Repeated finish reconciles pending cleanup without reopening publication or creating a replacement checkout

### Requirement: Separate post-release skill sync

Delivery SHALL offer optional `sync-skills` after relevant canonical skill publication or accepted integration when deployment is inapplicable. It SHALL require explicit authority naming the client or profile, source revision and update scope.

#### Scenario: Approved sync respects the installation route
- **WHEN** the operator authorizes a selected post-release update
- **THEN** the operator-controlled update uses the existing supported path with collision checks and backups. Hermes scanner-managed packages retain normal scanner acceptance and Codex native copies retain local-copy provenance
- **AND** verification compares the complete installed package with the immutable source, checks relevant skill version metadata and loads it in a fresh session. Tests use isolated scratch homes and profiles, and upstream skill sources are commit-pinned

#### Scenario: No profile authority or scan failure
- **WHEN** delivery reaches finish, finds package drift or a curator conflict, lacks separate update authorization, or the selected update fails its scanner or collision checks
- **THEN** delivery leaves the installed package untouched and reports the available update or recovery choice. A shared installed package is never changed by the skill while it runs in a target project

## MODIFIED Requirements

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
