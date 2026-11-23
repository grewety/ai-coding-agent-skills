# Spec Delta

## MODIFIED Requirements

### Requirement: Immutable review identity

The guard SHALL bind approval to committed Task-Guided planning content or to an immutable Goal-First contract, according to the verified delivery mode. It SHALL bind result review to an exact committed candidate in both modes.

#### Scenario: Changed task definition
- **WHEN** a task or gate changes after Task-Guided plan approval
- **THEN** the previous plan digest is rejected
- **AND** only task-checkbox progress changes preserve that digest

#### Scenario: Changed candidate
- **WHEN** the candidate SHA changes after review
- **THEN** the previous review cannot satisfy the candidate gate

#### Scenario: Changed Goal Contract
- **WHEN** an approved goal outcome, allowed scope, hard invariant, non-goal, acceptance gate, or local authority boundary changes
- **THEN** the previous approval cannot admit execution against the changed contract

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
- **AND** changed candidates require renewed gates and review, already merged implementation is not replayed, and branch deletion, bypass, release or another change remains unauthorized

#### Scenario: Next approved local goal
- **WHEN** the operator grants a local Goal-First run for the verified current change
- **THEN** the orchestrator advances the approved outcome through local verification, fresh independent review, and an authorized previewed local commit without mid-run task-keeping prompts
- **AND** the run stays in the same dedicated worktree and within held restrictions and budgets

### Requirement: Integrated opt-in for bounded approach review

The bounded approach gate SHALL apply only to a later change whose verified integrated plan parent explicitly selects it. It SHALL preserve the applicable approval, candidate review, publication and operator authority gates.

#### Scenario: Strict path retained
- **WHEN** a pre-execution review applies but the integrated parent has not selected convergence, including the change introducing it
- **THEN** the existing literal `Verdict: No findings` rule with empty findings and coverage limitations remains in force, and an unintegrated edit cannot select the new gate

#### Scenario: Readiness is not authority
- **WHEN** the bounded gate reports freeze-ready for a Task-Guided plan
- **THEN** freeze still requires separate commit authority, and exact-plan approval binds the frozen SHA and plan digest without granting execution or remote writes
- **AND** an explicitly reviewed Goal-First draft still requires exact Goal Contract approval and a local execution grant before work

## ADDED Requirements

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

Delivery SHALL require explicit authority per external or paid verification run and retry, tunnel, and external app automation. The grant SHALL identify target, test scope, exposed data, expected cost or credits and run count. External and irreversible actions SHALL remain outside local execution grants.

#### Scenario: Tunnels and vendor defaults
- **WHEN** a cloud check requests a temporary tunnel or a vendor skill requests auto-test or auto-retry
- **THEN** the orchestrator refuses unapproved work, serves only the approved built artifact during an authorized run, and tears down the tunnel immediately after success or failure
- **AND** raw source, credentials, account operations and live data stay outside the exposure, and a retry needs a new grant

#### Scenario: Publication and preview
- **WHEN** a separately authorized push or preview could trigger external automation
- **THEN** the orchestrator checks the triggers before activation and stops without the necessary additional grant
- **AND** a declared UI flow can offer a local-only try-out, semantic accessible-name checks and a separately approved deploy-preview review pause before merge

### Requirement: Exact candidate and bounded planning verification

Candidate guards SHALL include ignored content in cleanliness assessment and require gate evidence from a clean disposable checkout at the exact candidate SHA. Planning inventory callers SHALL share finite aggregate file, byte, depth and output budgets and refuse incomplete results.

#### Scenario: Candidate context contamination
- **WHEN** a candidate workspace contains unapproved ignored inputs or the gate checkout or evidence SHA differs from the candidate
- **THEN** candidate verification refuses admission until an isolated clean exact-SHA run is observed

#### Scenario: Inventory budget exceeded
- **WHEN** a planning tree exceeds any aggregate inventory limit or cannot be completely and safely read
- **THEN** the guard refuses the snapshot without accepting a partial digest or planting a fallback

### Requirement: Finish readiness for current specs

The orchestrator SHALL verify that the candidate's native delta requirements are promoted into the corresponding current specs with valid current-spec identity metadata before declaring finish ready.

#### Scenario: Missing or mismatched promotion
- **WHEN** a delta remains unapplied, is semantically mismatched, or its current spec has invalid identity metadata
- **THEN** readiness reports the exact deficiency and blocks terminal delivery until the implementation candidate is corrected and reverified
- **AND** record-only closure preserves product and current-spec content
