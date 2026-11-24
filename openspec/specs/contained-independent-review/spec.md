---
metadata_version: 1
artifact: spec
capability: contained-independent-review
---
# contained-independent-review Specification

## Purpose

Let operators run independent Claude Code reviews of exact, approved exports and verify the resulting evidence without exposing the checkout or trusting terminal prose.

## Requirements

### Requirement: Exact data-only review requests
The packaged reviewer SHALL accept a versioned data-only request and bind every run to a complete, immutable, manifest-verified export and distinct reviewer identity. Requests MUST NOT select executable commands, argv, environment, credentials, relay destination or permission overrides.

#### Scenario: Prepare and check an exact review
- **WHEN** `--prepare` and `--check` receive an authorized candidate review request
- **THEN** they produce and verify the approved diff/files, acceptance and gate evidence bound to full base, candidate and plan identities without contacting the provider
- **AND** approach mode instead binds every planning input digest, the fixed charter, packet identity and retained ledger.

#### Scenario: Reject unsafe or changed exports
- **WHEN** input is invalid or stale, a file is unapproved, suspect export content is detected, or the export contains a symlink or unsafe path
- **THEN** no review launches and the tool reports the failed predicate without disclosing suspect bytes.

#### Scenario: Bounded oversized diff
- **WHEN** an authorized diff exceeds a single review packet limit
- **THEN** bounded packets account for all diff entries and required files with a stable manifest and full target identity; missing, failed or inconsistent packet evidence prevents acceptance.

### Requirement: Probed OS containment
The reviewer SHALL use a fresh process with an isolated filesystem, private scratch, no direct network and only the approved Anthropic inference route. The real run SHALL use the same pinned runtime and containment configuration as its successful automatic empty-input `--probe`.

#### Scenario: Verify runtime and strict Read coverage
- **WHEN** a successful synthetic `--probe` precedes a review
- **THEN** the probe has zero tool calls and exact `Read` inventory with empty plugins, MCP servers, skills and slash commands
- **AND** the real run proves matching runtime and session, only whole-file `Read` calls to inventoried review paths, 100% successful assigned-file coverage and a successful native terminal result.

#### Scenario: Stop on unavailable or degraded isolation
- **WHEN** namespaces, pin, startup inventory, provider route, policy, native terminal state or coverage cannot be verified
- **THEN** the tool does not start a data-bearing review after a failed probe or publish a completed review from a failed run, and does not widen permissions or fall back.

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

### Requirement: Short private reviewer socket

The Linux reviewer SHALL derive its relay socket from a short owner-private temporary runtime root independent of the persistent evidence path and verify its UTF-8 byte length is below 108 before binding. The scratch root SHALL be cleaned after verified settlement.

#### Scenario: Long retained review path works
- **WHEN** a short relay root is available and the retained request, capture and evidence paths include long change and attempt names
- **THEN** the probe and the real run use the same pinned containment with a private socket below the Linux limit
- **AND** runtime teardown removes owned scratch while retaining review evidence at its requested path.

#### Scenario: Unsafe or too-long relay root
- **WHEN** the scratch root is unsafe or the resolved socket path cannot fit
- **THEN** the runtime reports the failed length or privacy predicate before relay bind or provider launch and does not weaken containment.

### Requirement: Sealed candidate receipt rejection

A candidate receipt identity or schema validation failure SHALL yield a structured, sealed `receipt-invalid` status identifying the offending packet and preserve its captures. Offline verification SHALL reproduce the non-accepting outcome from the retained evidence.

#### Scenario: Candidate SHA mismatch after successful reads
- **WHEN** a candidate packet has full successful read coverage and a native result but its receipt repeats a different SHA
- **THEN** the runner seals a non-accepting status with the offending packet identity, retains its report and raw capture, and stops further packets
- **AND** offline readback verifies the rejection against the same request and export without a thrown reconstruction error or an admissible candidate handover.

### Requirement: Verified planning-path relocation for record-only closure

Candidate preparation and offline readback SHALL recognize a verified OpenSpec archive move for the exact change on a record-only closure commit while preserving frozen raw planning identity, the normalized plan digest and exact candidate binding.

#### Scenario: Byte-identical archive closure
- **WHEN** a record-only closure moves the complete tracked active planning inventory into one canonical dated archive path for the same identity and preserves its bytes and modes
- **THEN** `--prepare`, `--check`, `--mode candidate` and `--verify` can use the moved inventory and review the actual closure diff and exact target SHA
- **AND** archived tasks may retain previously reviewed completion ticks under the existing normalization, while the move itself preserves task bytes.

#### Scenario: Archive ambiguity or changed content
- **WHEN** the move changes a planning byte or mode, omits or adds planning inputs, mixes active and archived copies, is ambiguous, uses an unsafe path, or includes out-of-scope source or current-spec edits
- **THEN** archive preparation fails before launch and cannot substitute a different change, predecessor, plan digest or candidate.
