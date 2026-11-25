# Spec Delta

## MODIFIED Requirements

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

### Requirement: Independent reviewer before merge

A pull request SHALL require an independent review with dispositioned findings for the exact candidate SHA before merge or branch deletion. A verified native task-completion child can satisfy finish admission using the independently reviewed parent solely under the Native task completion admission requirement.

#### Scenario: Implementer reviews itself
- **WHEN** the only available reviewer is the session that implemented the candidate
- **THEN** merge and branch deletion stop

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

## ADDED Requirements

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
