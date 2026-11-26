# Contained independent review delta

## MODIFIED Requirements

### Requirement: Probed OS containment
The reviewer SHALL use a fresh process confined by minimal-rootfs Bubblewrap `--unshare-all` with an isolated read-only filesystem, private scratch, no direct network and only the approved provider inference route through a host-side Unix-socket relay. The real run SHALL use the same pinned runtime, effective binding and containment configuration as its successful automatic empty-input `--probe`.

#### Scenario: Verify runtime and strict Read coverage
- **WHEN** a successful synthetic `--probe` precedes a review
- **THEN** the probe has zero tool calls and exact `Read` inventory with empty plugins, MCP servers, skills and slash commands
- **AND** the real run proves matching runtime and fresh session, only successful whole-file `Read` calls to inventoried review paths, 100 percent assigned-file coverage from the native stream and a successful native terminal result.

#### Scenario: Stop on unavailable or degraded isolation
- **WHEN** namespaces, pin, startup inventory, provider route, policy, native terminal state or coverage cannot be verified
- **THEN** the tool does not start a data-bearing review after a failed probe or publish a completed review from a failed run, and does not widen permissions or fall back.

## ADDED Requirements

### Requirement: Contained Reviewer adapter and relay qualification

Planning, candidate and closure review SHALL admit a Reviewer only after offline and bounded live verification of the selected client, provider, relay and effective settings. The configured reviewer session and provider SHALL be independent of the generating session and provider.

#### Scenario: Promote a Reviewer backend
- **WHEN** evaluating Claude Code or Codex with its explicit model, provider and reasoning effort and pinned host limits for turns, spend, timeout and pacing
- **THEN** positive and negative controls prove Bubblewrap isolation, approved inference through a host-side Unix socket and denied direct network, unauthorized tools and writes
- **AND** controls prove credentials and upstream diagnostic headers and bodies stay outside the sandbox, the exact assigned content is exposed only through the approved route, and whole-file read coverage and native result are stream-verifiable.

#### Scenario: Admit the exact receipt offline
- **WHEN** the real run finishes and the native stream proves all assigned files were read in full
- **THEN** the retained handover contains a valid mode-specific `BEGIN_REVIEW_RECEIPT` and `END_REVIEW_RECEIPT` receipt, and offline `--verify` checks the identity, raw captures, receipt and independent pins
- **AND** verify rejects a partial read, stale binding, omitted file or malformed receipt even if the provider returned a successful terminal response.

#### Scenario: Candidate unavailable or relay unqualified
- **WHEN** a candidate binary is absent, permission, stream audit or handover controls fail, or an unqualified Gemini, OpenRouter or generic OpenAI-compatible relay is selected
- **THEN** record `unsupported` with the exact blocker and refuse any real review through that route before export exposure
- **AND** preserve the already qualified routes and their independently verified bindings.
