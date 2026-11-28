## MODIFIED Requirements

### Requirement: Strict offline review receipt replay

The reviewer SHALL publish independently verifiable evidence for the approved request and native output. Offline `--verify` SHALL require a unique framed receipt per assigned packet and verify the bound identity, contents and disposition under the plan parent's proof policy.

#### Scenario: Verify a complete receipt
- **WHEN** a settled fresh session returns exactly one `BEGIN_REVIEW_RECEIPT` and `END_REVIEW_RECEIPT` frame with valid schema and a consistent verdict and findings
- **THEN** offline replay verifies the exact candidate SHA or the complete raw planning identity, assigned packet paths and digests, session, coverage claim, and finding paths against the independently retained expectation and sealed evidence
- **AND** only paired supported structured Read events reconstructing every assigned file byte substantiate whole-file coverage. A receipt alone satisfies an accepting gate only where a verified integrated parent explicitly selected receipt-only proof and the review has no unresolved findings or waivers.

#### Scenario: Reject adverse output
- **WHEN** a frame is absent, repeated, malformed, truncated, ambiguous, stale, preceded or followed by prose, or contains an unassigned path or inconsistent verdict or findings
- **THEN** offline replay refuses acceptance without network or profile access. It also rejects changed packet bytes, unverified settlement, dirty postflight, missing packets and unsupported coverage claims.

## ADDED Requirements

### Requirement: Integrated review proof level selection

A Direct-CLI project SHALL choose receipt-only proof explicitly in the verified integrated plan parent. Whole-file read proof SHALL remain the default when no level is selected, and previously frozen reviews SHALL retain their pinned interpretation.

#### Scenario: Admit explicitly selected receipt-only proof
- **WHEN** the original integrated plan parent selects Level 1 (`receipt-only`) and the pinned reviewer supplies a verified fresh receipt for every assigned packet
- **THEN** approach, candidate, finish and closure gates accept that proof level when all their existing identity, integrity, gates, authority and zero-waiver predicates also pass
- **AND** configured supported Direct-CLI adapters are eligible at this level subject to exact native runtime and host qualification.

#### Scenario: Enforce whole-file read proof
- **WHEN** the verified parent selects Level 2 (`whole-file-read`) or follows the original strict Direct-CLI default
- **THEN** a receipt without paired structured reads whose responses match each assigned file byte for byte cannot satisfy review acceptance
- **AND** unsupported clients or mismatched settings fail before exposure when detectable. Neither replay nor recovery retries under a weaker level.

#### Scenario: Refuse ambiguous or untrusted proof selection
- **WHEN** the requested level is unknown, duplicated, unverified, inconsistent across the bound inputs, or introduced only by the candidate, caller or host configuration
- **THEN** it cannot authorize weaker proof and inconsistent or invalid inputs block admission
- **AND** evidence sealed under an earlier verifier is replayed with that original policy, schema and pin.

### Requirement: Review proof provenance through protected finish

For a plan governed by the new selection contract, the verified review status, finish readiness and retained closeout `evidence/receipt.json` SHALL carry the level established from the original parent and actual sealed review evidence.

#### Scenario: Carry the level with the actual review identity
- **WHEN** a review is accepted for the exact approved identity at either level
- **THEN** record `proofLevel` as `receipt-only` or `whole-file-read` and retain the reviewed identity, seal and decision references
- **AND** a task-only child or eligible PR-fix lineage retains the actual reviewed SHA, the exact final head, existing ancestry and gate proofs, and the level of each required review. Closure retains its own distinct exact review.

#### Scenario: Reject unsupported provenance
- **WHEN** proof level is missing for a newly governed record, altered, weaker than policy, or inconsistent with the sealed review, finish or closeout evidence
- **THEN** admission or replay fails closed. Complete receipt-only review under Level 1 never claims whole-file evidence or waives findings.

### Requirement: Private host authentication for Direct-CLI reviewers

Claude, Codex and Pi SHALL have access to their approved normal host authentication during live review. Auth location and private configuration SHALL remain outside reviewer exports and retained output.

#### Scenario: Use an authenticated host profile safely
- **WHEN** a supported pinned client has a valid host login with no provider API key in the shell
- **THEN** it can access that login through the native home or supported auth location while retaining fresh sessions and the existing read-only, ambient tooling, workspace and settlement controls
- **AND** offline version and capability checks stay credential-free. The clients requiring disposable profiles retain those profiles and their approved auth requirements.

### Requirement: Actionable private native-output diagnostics

Direct-CLI review SHALL retain a fixed-enum, secret-free reason whenever native sanitization fails and SHALL provide clear strict framing instructions.

#### Scenario: Diagnose an incompatible CLI or invalid receipt
- **WHEN** startup inventory, host path redaction, read coverage or stream schema verification rejects native output
- **THEN** the sealed launch and diagnostic log identify the reason class without copying raw output, credentials, unvalidated labels or private paths
- **AND** the framed-only prompt requires exactly one frame without preamble or epilogue and the verifier rejects malformed framing.

### Requirement: Separately authorized reviewer smoke probe

The reviewer SHALL expose an opt-in bounded probe for the installed native client using only a tiny synthetic one-file packet.

#### Scenario: Check the compatibility of a pinned client
- **WHEN** the operator separately authorizes a probe for the exact runtime, proof level and finite low cost and deadline
- **THEN** the runner reserves the applicable amount, checks authentication, native output and the selected proof class using a fresh settled invocation, and returns a sealed compatibility result or actionable refusal
- **AND** unavailable safe bounds, missing authority or a repeat without distinct authority block the run. The probe never grants qualification or substitutes for approach, candidate or finish evidence.
