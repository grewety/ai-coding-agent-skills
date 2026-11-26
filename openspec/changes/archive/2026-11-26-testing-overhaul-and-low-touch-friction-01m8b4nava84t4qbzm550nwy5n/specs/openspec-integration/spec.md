# OpenSpec integration delta

## MODIFIED Requirements

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

### Requirement: Independent reviewer before merge

A pull request SHALL require an independent review with dispositioned findings for the exact candidate SHA before merge or branch deletion. Finish admission using a prior reviewed SHA SHALL verify the Native task completion admission or Verified post-review PR-fix lineage requirements, as applicable.

#### Scenario: Implementer reviews itself
- **WHEN** the only available reviewer is the session that implemented the candidate
- **THEN** merge and branch deletion stop

### Requirement: Bounded paid contained-review authorization

Under an adopting integrated parent, delivery SHALL default to `auto-approved` for eligible paid contained reviews and support `explicit` per-run approval. Integrated-parent policy SHALL govern mode, phases, cap ceilings and the standing $0 trigger allowlist. External host-owned configuration SHALL supply the `host.json` `configurationSha256` pin and optional local harness binding.

#### Scenario: Default mode and configured ceilings
- **WHEN** the applicable integrated parent adopts this policy and supplies no overrides
- **THEN** `auto-approved` applies with `maxReviews: 10` and `maxTotalUsd: 25` per change, shared across `["planning", "execution", "finish"]`
- **AND** permitted overrides stay within integrated ceilings, and unreviewed candidate files and host settings cannot expand authority or raise those ceilings. New setup guidance defaults to 96 turns and USD 2.50 per launch. The upper bound includes the probe and every applicable packet. Existing pins keep their configured values. An explicitly adopted higher project ceiling applies prospectively.

#### Scenario: Concurrent or resumed automatic use
- **WHEN** an eligible automatic paid review is proposed
- **THEN** admission verifies the exact snapshot or candidate, phase, scope and host pin, and durably reserves one review and the full upper USD cost of the probe and applicable packets before provider contact
- **AND** the per-change ledger serializes reservations across phases, retains spent or uncertain amounts and rejects replay or over-allocation on resume or concurrent use. A retry still needs separate authority and a new reservation when covered by the automatic budget.

#### Scenario: Missing or exceeded automatic bounds
- **WHEN** the phase is ineligible, the host is unpinned or mismatched, effective caps are absent, invalid or exceeded, or an upper cost or durable reservation cannot be verified
- **THEN** automatic admission stops before launch and grants no fallback or cap increase. Only Operator-signed review cap extension can grant an eligible prospective increase.

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
- **THEN** it needs separate single-run authority before activation unless the exact action qualifies under Bundled finish trigger reservations. Missing or stale inventory blocks activation.

### Requirement: Operator workflow guidance

The distribution SHALL publish a top-level index of active guides and a visual tutorial covering prompt and authority boundaries, fresh-session checkpoints, external role configuration and native schema interoperability. Protected closure guidance SHALL explain explicit issue closure after accepted integrated verification and record readback.

#### Scenario: Current role and schema setup
- **WHEN** an operator configures a workset opener, standalone or exclusive Implementer, optional AI helper or harness, or contained Reviewer host
- **THEN** synchronized guides show explicit client, provider, model, reasoning-effort and version configuration, the supported and unsupported route matrix, native argument or config examples, moderated setup and separately authorized decisions using the maintained lifecycle diagram, chat sequence and reply examples
- **AND** optional custom schemas remain governed by the same frozen identity and evidence requirements. Active upgrade guidance is preserved when obsolete history is pruned. The repository suitability matrix identifies Claude as the qualified Tier 1 baseline, Grok and Pi as Tier 1 candidates, Hermes and Codex as medium, and OpenCode, Kilo and agy as unsuitable for the current minimal-rootfs contained route, with dated evidence and qualification limits.

#### Scenario: Review and closeout text
- **WHEN** an operator follows the protected finish guidance
- **THEN** the guidance explains how to bind the optional local pre-PR harness, verify its sealed exact-candidate evidence and configure the repository-local Aikido examples for the local check and standing $0 triggers
- **AND** the closure PR template explains deliberate omission of an auto-close keyword and requires explicit issue closure after verified integration and archival evidence.

### Requirement: Moderated external host discovery and setup

`detect-agents` SHALL report read-only, redacted host observations. `setup` SHALL preview exact external role configuration and the reviewer host file SHA-256 before any operator-confirmed write. Discovery and setup SHALL avoid credential values, inference, automatic installation, and repository or live-profile mutation.

#### Scenario: Discover installed or unavailable tools
- **WHEN** discovery checks Codex, Claude Code, Gemini, Hermes, OpenCode, Kilo, Pi, `grok`, legacy `grok-build` references, `agy`, Bubblewrap and OpenSpec
- **THEN** report presence, executable path and observed version where available, and safe local evidence for auth readiness, containment and supported model and reasoning options
- **AND** mark unobservable capabilities unknown and absent binaries unavailable. Discovery status neither authenticates a provider nor qualifies a route. Resolve the real `grok` executable through supported discovery paths, retain the legacy client identity, and report absence or ambiguity without installation, inference or profile changes.

#### Scenario: Dry-run approved role choices before writing
- **WHEN** an operator selects role tuples and reviewer limits
- **THEN** setup previews exact output paths and bytes for reviewer host JSON including `maxTurns: 96` and `interPacketDelayMs`, external role-binding JSON, an OpenSpec opener snippet, and the raw-byte `configurationSha256`
- **AND** dry runs or canceled confirmations write nothing. A matching explicit confirmation writes only to the chosen external host configuration directory and verifies the written bytes and pin.

#### Scenario: Refuse conflicting or changed destinations
- **WHEN** a preview changes, a destination aliases a repository or live profile, a symlink redirects an output, or an existing file would be overwritten without matching confirmation
- **THEN** refuse the write and report the conflict without exposing credentials or presenting unverified configuration as usable.

## ADDED Requirements

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

The operator and reviewer guides SHALL show the packaged review runner as a standalone Node command with its exact inputs and existing authority prerequisites.

#### Scenario: Review invocation in Codex
- **WHEN** an operator follows a documented candidate or approach review example
- **THEN** the live launch invokes `node …/review-candidate.mjs` directly, without a compound shell wrapper, and retains the separate admission, replay and readback steps. The guidance preserves platform review and permission enforcement.
