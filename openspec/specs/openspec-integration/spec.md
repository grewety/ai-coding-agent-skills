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

### Requirement: Immutable review identity

The guard SHALL bind approval to committed Task-Guided planning content or an immutable Goal-First contract and bind result review to the exact reviewed candidate in both modes. A verified native task-completion child can satisfy finish admission solely under the Native task completion admission requirement.

#### Scenario: Changed task definition
- **WHEN** a task or gate changes after Task-Guided plan approval
- **THEN** the previous plan digest is rejected
- **AND** only task-checkbox progress changes preserve that digest

#### Scenario: Changed candidate
- **WHEN** the candidate SHA changes after review
- **THEN** the previous review cannot satisfy the new SHA's candidate gate
- **AND** finish admission can use the original review and its original SHA only with the independent task-completion proof

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
The distribution SHALL publish the OpenSpec companion packages and the separate
orchestration package only, and SHALL NOT publish a second phase skill set.

#### Scenario: Catalog inventory
- **WHEN** the distribution is built
- **THEN** the packages are openspec-delivery, openspec-next, git-commit-message, capability-wireframes, and autonomous-implementation-review

#### Scenario: OpenSpec bundle inventory
- **WHEN** the OpenSpec plugin ZIP is built
- **THEN** it contains delivery, next-step execution, commit and wireframe packages only, byte-for-byte

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

### Requirement: Change name is the identity
The full OpenSpec change directory name SHALL identify the change across the issue,
pull request and evidence. Projects selecting the naming convention SHALL generate
`<slug>-<lowercase-ulid>` once at creation, automatically from a short proposal
request. The authorized branch SHALL be `change/<full-name>` through specification,
implementation and review. Existing names SHALL remain valid and unchanged.

#### Scenario: Short proposal request
- **WHEN** the operator requests `/openspec-propose add-dark-mode` for a new change
- **THEN** the agent generates the suffix before OpenSpec scaffolding and reuses the returned name without requiring the operator to type a ULID
- **AND** naming alone does not authorize writes; the selected proposal invocation includes isolated setup, not implementation, commits or publication

#### Scenario: Resume and ambiguous selection
- **WHEN** an operator resumes by a short slug or current change context
- **THEN** the agent resolves the existing full name without generating another suffix
- **AND** ambiguous matches require operator selection, never newest-change guessing

#### Scenario: Read-only naming helper
- **WHEN** the helper generates an identity or resolves active change directories
- **THEN** it emits the full name, path and branch without writing files, refs or installed profiles
- **AND** malformed input, repeated options and symlinked discovery paths are refused

#### Scenario: Second clone
- **WHEN** another checkout already edits the same capability spec
- **THEN** work stops for reconciliation even if a new change name could be chosen

#### Scenario: Durable reference across archive movement
- **WHEN** a ticket or another document refers to an OpenSpec change
- **THEN** it cites the full change name and optional artifact role, not the moving active/archive path
- **AND** locating an archived package preserves that identity and does not invent a new name or claim that an active-only helper searches archives

#### Scenario: Proposal-time documentation
- **WHEN** the documentation issue is created during a proposal
- **THEN** it records the request, blast radius, risk and authorization boundary without prospective review, merge or closure evidence
- **AND** any later approval binds retained input revisions rather than treating an editable issue body as immutable

### Requirement: Independent reviewer before merge

A pull request SHALL require an independent review with dispositioned findings for the exact candidate SHA before merge or branch deletion. A verified native task-completion child can satisfy finish admission using the independently reviewed parent solely under the Native task completion admission requirement.

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
Hardening acceptance SHALL require safe community verdicts for all five complete
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

Delivery SHALL require explicit authority for each external or paid run and retry, tunnel and external app automation. Bounded `auto-approved` contained reviews and verified standing $0 finish triggers under an adopting integrated parent SHALL be the only standing exceptions introduced by this policy. Verification authority SHALL identify target, scope, exposed data, cost or credits and run count. External and irreversible actions SHALL remain outside ordinary local execution grants.

#### Scenario: Tunnels and vendor defaults
- **WHEN** a cloud check requests a temporary tunnel or a vendor skill requests auto-test or auto-retry
- **THEN** the orchestrator refuses unapproved work, serves only the approved built artifact during an authorized run, and tears down the tunnel immediately after success or failure
- **AND** raw source, credentials, account operations and live data stay outside the exposure, and a tunnel or vendor retry needs a new grant

#### Scenario: Publication and preview
- **WHEN** a separately authorized push or preview could trigger external automation
- **THEN** the orchestrator checks the triggers before activation and stops without the necessary additional grant or verified standing authority
- **AND** a declared UI flow can offer a local-only try-out, semantic accessible-name checks and a separately approved deploy-preview review pause before merge

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

Under an adopting integrated parent, delivery SHALL default to `auto-approved` for eligible paid contained reviews and support `explicit` per-run approval. Integrated-parent policy SHALL govern mode, phases, cap ceilings and the standing $0 trigger allowlist. External host-owned configuration SHALL supply the `host.json` `configurationSha256` pin and optional local harness binding.

#### Scenario: Default mode and configured ceilings
- **WHEN** the applicable integrated parent adopts this policy and supplies no overrides
- **THEN** `auto-approved` applies with `maxReviews: 10` and `maxTotalUsd: 25` per change, shared across `["planning", "execution", "finish"]`
- **AND** permitted overrides stay within integrated ceilings, and unreviewed candidate files and host settings cannot expand authority or raise those ceilings.

#### Scenario: Concurrent or resumed automatic use
- **WHEN** an eligible automatic paid review is proposed
- **THEN** admission verifies the exact snapshot or candidate, phase, scope and host pin, and durably reserves one review and the full upper USD cost of the probe and applicable packets before provider contact
- **AND** the per-change ledger serializes reservations across phases, retains spent or uncertain amounts and rejects replay or over-allocation on resume or concurrent use. A retry still needs separate authority and a new reservation when covered by the automatic budget.

#### Scenario: Missing or exceeded automatic bounds
- **WHEN** the phase is ineligible, the host is unpinned or mismatched, effective caps are absent, invalid or exceeded, or an upper cost or durable reservation cannot be verified
- **THEN** automatic admission stops before launch and grants no fallback or cap increase.

#### Scenario: Single-run authority
- **WHEN** `explicit` is selected for the run, or the verified integrated parent predates the adoption of this policy
- **THEN** the run requires a distinct single-run grant for its exact target, scope, exposure and cost
- **AND** neither mode grants plan approval, local execution, finish, profile sync or retries.

### Requirement: Standing zero-cost finish triggers

Under separately granted protected finish, delivery SHALL recognize only named, verified zero-cost repository triggers explicitly adopted by integrated-parent policy. It SHALL match repository, event, target, trigger identity, configuration and authorized exposure against a current complete inventory before activation.

#### Scenario: Verified standing repository automation
- **WHEN** an authorized push or integration event will activate solely matching configured zero-cost repository jobs within their verified standing exposure
- **THEN** finish can proceed without requesting a second grant for those jobs and retains the inventory and match
- **AND** repository-local bindings can document a verified example such as this repository's Aikido PR/main checks using the same tool-agnostic contract.

#### Scenario: Scope or cost is unknown
- **WHEN** any live trigger differs from the verified standing entry or is paid, unknown, a tunnel, or a deploy preview
- **THEN** it needs separate single-run authority before activation. Missing or stale inventory blocks activation.

### Requirement: Optional candidate-bound local pre-PR harness

Delivery SHALL support an optional, declarative, tool-agnostic local harness bound in external host-owned configuration as `cli` or `mcp`. A configured harness SHALL check the exact committed candidate SHA before final review and PR push, and retain a sealed JSON result containing `schemaVersion`, `harnessId`, `candidate`, `verdict`, `findings`, and `observedAt`.

#### Scenario: Configured harness for the committed SHA
- **WHEN** delivery prepares final review and protected publication for a committed candidate and a local harness is configured
- **THEN** the applicable authorized local check runs in an isolated checkout of that SHA and the host verifies the sealed result's schema, configured identity, committed SHA and verdict
- **AND** final review and pre-push checks consume that verified result. Missing, invalid, stale or non-passing evidence blocks progress and a changed SHA requires a new result.

#### Scenario: Harness disabled
- **WHEN** there is no configured harness
- **THEN** delivery proceeds under the existing independent review and protected finish requirements.

#### Scenario: Configured check needs separate authority
- **WHEN** a configured harness would expose data externally, invoke a paid service or trigger external automation
- **THEN** delivery requires the applicable separate authority before activation. A harness result cannot substitute for independent review.

#### Scenario: Repository-local harness example
- **WHEN** this repository prepares its first harness and standing $0 trigger examples
- **THEN** its local bindings and guides use Aikido, including `aikido_deep_review` / local scan, through the generic contracts
- **AND** the portable skills contain no Aikido names or dependency.

### Requirement: Operator workflow guidance

The distribution SHALL publish a top-level index of active guides and a visual tutorial covering prompt and authority boundaries, fresh-session checkpoints, external role configuration and native schema interoperability. Protected closure guidance SHALL explain explicit issue closure after accepted integrated verification and record readback.

#### Scenario: Current role and schema setup
- **WHEN** an operator configures a workset opener, implementer role binding, optional authoring helper or contained reviewer host
- **THEN** the guides show the affected role, current supported client and version boundaries, and separately authorized decisions using a lifecycle diagram, chat sequence and reply examples
- **AND** optional custom schemas remain governed by the same frozen identity and evidence requirements. Active upgrade guidance is preserved when obsolete history is pruned.

#### Scenario: Review and closeout text
- **WHEN** an operator follows the protected finish guidance
- **THEN** the guidance explains how to bind the optional local pre-PR harness, verify its sealed exact-candidate evidence and configure the repository-local Aikido examples for the local check and standing $0 triggers
- **AND** the closure PR template explains deliberate omission of an auto-close keyword and requires explicit issue closure after verified integration and archival evidence.
