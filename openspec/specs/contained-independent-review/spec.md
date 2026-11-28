---
metadata_version: 1
artifact: spec
capability: contained-independent-review
---
# contained-independent-review Specification

## Purpose

Run independent reviews of exact, approved exports through supported installed CLI clients in disposable packet workspaces and verify the resulting evidence offline.

## Requirements

### Requirement: Exact data-only review requests

Every request SHALL be versioned, data-only, and bound to an immutable manifest, distinct session and exact planning or candidate identity. A trusted local binding SHALL own executable and effective CLI settings.

#### Scenario: Prepare and check an exact review
- **WHEN** the orchestrator uses `--prepare` and `--check` for a candidate, closure or charter-bound approach review
- **THEN** prepare and verify the exact diff, full base, plan and candidate identities, assigned files and approved gates and attachments offline. Approach mode instead binds the complete planning inventory, fixed charter, packet and retained ledger.

#### Scenario: Reject unsafe or changed exports
- **WHEN** input is invalid or stale, a file is unapproved, suspect content is detected, or the export contains a symlink or unsafe path
- **THEN** refuse launch and identify the failed check without exposing suspect bytes.

#### Scenario: Bounded oversized diff
- **WHEN** the exact review exceeds the limit for a single packet
- **THEN** account for every diff entry and required file in the bounded packet inventory. Missing, failed or inconsistent packets prevent complete acceptance.

#### Scenario: Reject request-controlled authority
- **WHEN** review content attempts to select a command, argument vector, credentials, environment, access override or unrelated path
- **THEN** reject the invalid request or treat content as review data according to the schema. A request cannot enlarge the allowed export or trusted launch settings.

### Requirement: Sealed and independently verifiable handovers
The reviewer SHALL retain raw captures separately from the extracted report and publish immutable, no-clobber `report.md`, `result.json` and `status.json` outside the checkout. `--verify` SHALL perform offline readback against independently retained identity and hashes before a handover can inform a delivery decision.

#### Scenario: Native verdict and exact binding
- **WHEN** a candidate or approach attempt completes
- **THEN** the handover preserves its literal native verdict and mode-specific receipt with exact target identity, and separates exit/completion, findings and acceptance
- **AND** readback refuses stale, partial, altered or contradictory results rather than deriving a clean verdict from an exit code or missing findings.

#### Scenario: Retry a malformed approach receipt
- **WHEN** a verified approach attempt has malformed receipt data and the retained same-binding launch retry is unused
- **THEN** it is retained but not admitted to the `charter-v1` ledger, and the orchestrator can start one fresh bounded attempt on identical inputs for zero correction cycles
- **AND** a second failure stops; packet-gap repair remains the existing separate charter decision.

### Requirement: Bounded safe worker capture
The shared adapter SHALL bound runtime and stdout/stderr, positively verify exact process-tree quiescence where termination is required, and refuse unsafe capture roots, existing destinations and oversized or non-byte publisher captures without overwriting retained evidence.

#### Scenario: Deadline or quota cannot imply completion
- **WHEN** a synthetic process tree survives a leader exit, breaches a deadline or exceeds either stream quota
- **THEN** capture remains bounded, native and supervisor outcomes stay distinct, and no completed result or replacement is allowed without the required termination or non-writing proof.

#### Scenario: Transport or publisher rejection
- **WHEN** a sink is an alias, symlink, non-regular or pre-existing destination, or publication is handed invalid or over-limit buffers
- **THEN** the adapter fails closed without modifying another file or publishing an admissible success.

### Requirement: Sealed candidate receipt rejection

A candidate receipt identity or schema validation failure SHALL yield a structured, sealed `receipt-invalid` status identifying the offending packet and preserve its captures. Offline verification SHALL reproduce the non-accepting outcome from the retained evidence.

#### Scenario: Candidate SHA mismatch after successful reads
- **WHEN** a candidate packet has full successful read coverage and a native result but its receipt repeats a different SHA
- **THEN** the runner seals a non-accepting status with the offending packet identity, retains its report and raw capture, and stops further packets
- **AND** offline readback verifies the rejection against the same request and export without a thrown reconstruction error or an admissible candidate handover.

### Requirement: Verified planning-path relocation for record-only closure

Candidate preparation and offline readback SHALL recognize a verified OpenSpec archive move for the exact change on a record-only closure commit while preserving frozen raw planning identity, the normalized plan digest and exact candidate binding.

#### Scenario: Byte-identical archive closure
- **WHEN** a record-only closure moves the complete tracked active planning inventory, including any admitted custom schema artifacts, into one canonical dated archive path for the same identity and preserves its bytes and modes
- **THEN** `--prepare`, `--check`, `--mode candidate` and `--verify` can use the moved inventory and review the actual closure diff and exact target SHA
- **AND** archived tasks may retain previously reviewed completion ticks under the existing normalization, while the move itself preserves task bytes.

#### Scenario: Archive ambiguity or changed content
- **WHEN** the move changes a planning byte or mode, omits or adds planning inputs, mixes active and archived copies, is ambiguous, uses an unsafe path, or includes out-of-scope source or current-spec edits
- **THEN** archive preparation fails before launch and cannot substitute a different change, predecessor, plan digest or candidate.

### Requirement: Offline review packet feasibility

Verify trusted launch settings and complete packet feasibility offline before exposure. Where a native turn cap applies, required whole-file reads SHALL fit within it with the applicable reserve. Every packet SHALL fit the wall-clock and evidence budgets.

#### Scenario: Packet at or beyond the configured boundary
- **WHEN** a whole-file audit is required and the CLI exposes a native turn cap
- **THEN** admit packets within the bound and required reserve. The existing pinned route keeps its ten-turn reserve.

#### Scenario: Invalid host budget or oversized packet
- **WHEN** limits or the independently pinned settings are missing, differ, or cannot accommodate a packet
- **THEN** report the offending packet and failed bound before provider exposure without dropping required inputs.

### Requirement: Trusted host binding before paid automatic exposure

Verify the external host configuration SHA-256 and durable reservation for the exact phase, input and effective settings before any billable invocation. The cost bound SHALL cover every planned session and any applicable probe. Other runs require the applicable separate authority.

#### Scenario: No matching pre-launch binding
- **WHEN** the trusted host input or reservation is absent, mismatched, stale or redeemed
- **THEN** refuse provider contact and preserve the original authority mode. Host settings and accounting data stay outside the packet.

### Requirement: Packet-scoped acceptance and finding paths

Review inputs SHALL bind file-specific acceptance to the approved packet files. Global acceptance SHALL apply across packets. Review prompts and receipt checks SHALL require canonical repository-relative finding paths for the applicable packet.

#### Scenario: Cross-packet correction context
- **WHEN** a multi-packet run includes file-specific correction criteria
- **THEN** offline admission requires those criteria to be scoped to their actual packet files. A global file list or an out-of-packet reference blocks review before launch.
- **AND** every packet retains the common outcome and applies only its scoped file criteria.

#### Scenario: Absolute or unrelated finding path
- **WHEN** a reviewer emits an absolute sandbox path such as `/review/plan/`, a traversal alias, or a path outside its approved packet
- **THEN** the receipt stays non-accepting. Prompts explicitly instruct the reviewer to use canonical repository-relative paths.

### Requirement: Bounded inter-packet pacing and private diagnostics

Paid review SHALL retain a durable budget reservation before launch, bounded concurrency of one to three packet sessions, optional `interPacketDelayMs`, and private sanitized diagnostics.

#### Scenario: Multi-packet pacing
- **WHEN** concurrency is omitted or set to 1
- **THEN** run serially and apply pacing before the next eligible start after settlement. A single packet needs no delay.

#### Scenario: Pinned concurrent execution
- **WHEN** an authorized review has multiple packets
- **THEN** pace starts within the held deadline and reservations, enforce the concurrency limit, and bind each result to its packet regardless of completion order
- **AND** failure or cancellation stops new launches, settles siblings, suppresses sensitive diagnostics in exported evidence and cannot produce a partial accepted result or automatic retry.

#### Scenario: Invalid configuration or unproved isolation
- **WHEN** launch settings exceed the permitted range or packet isolation cannot be proved
- **THEN** refuse the unproved configuration. Independently admissible serial runs use their own matching settings.

#### Scenario: Classified upstream refusal
- **WHEN** the CLI exposes rate-limit, overload or authentication refusal
- **THEN** retain the bounded failure class, without exporting raw headers, bodies or credentials.

### Requirement: Bounded reviewer timeout configuration

Each invocation SHALL enforce a finite wall-clock timeout and verified process-tree settlement. Reviewer setup SHALL default `timeoutMs` to 300000 and cap it at 600000. Tighter held deadlines SHALL prevail.

#### Scenario: Validate the timeout boundary
- **WHEN** setup or runtime sees the default, an explicit 600000 value, or a value above the ceiling
- **THEN** retain the default and valid tighter pins, accept 600000 subject to tighter enclosing limits, and reject values above 600000.

#### Scenario: Timeout or cancellation leaves descendants
- **WHEN** the deadline expires, the worker stops, or its leader exits with children
- **THEN** the supervisor settles the original tree, checks the worktree again and preserves the bounded outcome. Unproved settlement prevents receipt acceptance or replacement launch.

### Requirement: Direct CLI reviewer sessions

The default independent Reviewer SHALL use a fresh non-interactive session with the selected installed CLI and normal host authentication on Linux, Windows and macOS. Launch SHALL use a trusted adapter and a manifest-verified disposable packet workspace outside the repository.

#### Scenario: Dispatch the selected supported CLI
- **WHEN** an authorized review selects `claude`, `codex`, `grok`, `pi`, `hermes`, `opencode`, `kilo` or `agy` with supported effective settings on the host
- **THEN** the adapter maps the approved model and supported reasoning effort into one fresh read-only review session per packet, without inherited session state, live checkout input, dedicated reviewer auth clones or relays
- **AND** unknown settings, an unavailable native invocation, or a mismatched session block the selected route without client or model substitution.

#### Scenario: Verify the real worktree across every outcome
- **WHEN** a reviewer starts against a verified copy of its assigned export members
- **THEN** capture the real worktree HEAD and complete Git status before launch and after process settlement, and verify tracked, staged and untracked review-relevant state against the preflight identity
- **AND** reject drift, missing observations, mutation of exported originals, or incomplete postflight on success, failure or timeout. Preserve diagnostic evidence without reverting operator files.

### Requirement: Strict offline review receipt replay

The reviewer SHALL publish independently verifiable evidence for the approved request and native output. Offline `--verify` SHALL require a unique framed receipt per assigned packet and verify the bound identity, contents and disposition under the plan parent's proof policy.

#### Scenario: Verify a complete receipt
- **WHEN** a settled fresh session returns exactly one `BEGIN_REVIEW_RECEIPT` and `END_REVIEW_RECEIPT` frame with valid schema and a consistent verdict and findings
- **THEN** offline replay verifies the exact candidate SHA or the complete raw planning identity, assigned packet paths and digests, session, coverage claim, and finding paths against the independently retained expectation and sealed evidence
- **AND** only paired supported structured Read events reconstructing every assigned file byte substantiate whole-file coverage. A receipt alone satisfies an accepting gate only where a verified integrated parent explicitly selected receipt-only proof and the review has no unresolved findings or waivers.

#### Scenario: Reject adverse output
- **WHEN** a frame is absent, repeated, malformed, truncated, ambiguous, stale, preceded or followed by prose, or contains an unassigned path or inconsistent verdict or findings
- **THEN** offline replay refuses acceptance without network or profile access. It also rejects changed packet bytes, unverified settlement, dirty postflight, missing packets and unsupported coverage claims.

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
