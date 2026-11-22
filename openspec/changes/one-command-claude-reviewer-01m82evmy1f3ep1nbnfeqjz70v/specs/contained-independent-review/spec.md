# Spec Delta

## Purpose

Let operators run independent Claude Code reviews of exact, approved exports and verify the resulting evidence without exposing the checkout or trusting terminal prose.

## ADDED Requirements

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
