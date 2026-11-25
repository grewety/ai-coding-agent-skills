# OpenSpec integration delta

## MODIFIED Requirements

### Requirement: Optional candidate-bound local pre-PR harness

Delivery SHALL support an optional declarative CLI or MCP harness in external host configuration. Before final review and PR push, the configured harness SHALL check the exact committed candidate in a standalone detached clone and retain sealed JSON with `schemaVersion`, `harnessId`, `candidate`, `verdict`, `findings` and `observedAt`.

#### Scenario: Configured harness for the committed SHA
- **WHEN** delivery prepares final review and protected publication for a committed candidate and a local harness is configured
- **THEN** the authorized check runs with its working directory and scan target bound to the same clean, standalone detached clone at that SHA, and the host verifies the sealed result's schema, configured identity, committed SHA and verdict
- **AND** final review and pre-push checks consume that verified result. Missing, invalid, stale or non-passing evidence blocks progress and a changed SHA requires a new result.

#### Scenario: Reject a linked or mismatched checkout
- **WHEN** the proposed clone is a linked worktree, attached to a branch, dirty, aliases the mutable source checkout, or is at another SHA
- **THEN** refuse both CLI and MCP invocation and refuse a passing seal if the required checkout identity or cleanliness no longer holds on return.

#### Scenario: Harness disabled
- **WHEN** there is no configured harness
- **THEN** delivery proceeds under the existing independent review and protected finish requirements.

#### Scenario: Configured check needs separate authority
- **WHEN** a configured harness would expose data externally, invoke a paid service or trigger external automation
- **THEN** delivery requires the applicable separate authority before activation. A harness result cannot substitute for independent review.

#### Scenario: Repository-local harness example
- **WHEN** the project presents its local harness and standing $0 trigger examples
- **THEN** its guides show Aikido local scan and `aikido_deep_review` using the generic detached-clone and result contracts, including the linked-worktree `git ls-files` failure mode
- **AND** the portable skills contain no Aikido-specific adapter or dependency.

### Requirement: Operator workflow guidance

The distribution SHALL publish a top-level index of active guides and a visual tutorial covering prompt and authority boundaries, fresh-session checkpoints, external role configuration and native schema interoperability. Protected closure guidance SHALL explain explicit issue closure after accepted integrated verification and record readback.

#### Scenario: Current role and schema setup
- **WHEN** an operator configures a workset opener, standalone or exclusive Implementer, optional AI helper or harness, or contained Reviewer host
- **THEN** synchronized guides show explicit client, provider, model, reasoning-effort and version configuration, the supported and unsupported route matrix, native argument or config examples, moderated setup and separately authorized decisions using the maintained lifecycle diagram, chat sequence and reply examples
- **AND** optional custom schemas remain governed by the same frozen identity and evidence requirements. Active upgrade guidance is preserved when obsolete history is pruned.

#### Scenario: Review and closeout text
- **WHEN** an operator follows the protected finish guidance
- **THEN** the guidance explains how to bind the optional local pre-PR harness, verify its sealed exact-candidate evidence and configure the repository-local Aikido examples for the local check and standing $0 triggers
- **AND** the closure PR template explains deliberate omission of an auto-close keyword and requires explicit issue closure after verified integration and archival evidence.

## ADDED Requirements

### Requirement: Explicit external AI role configuration

The workflow SHALL use a validated external binding for every enabled AI role, including the orchestrator, Implementer, contained Reviewer and optional AI helper or harness. The binding SHALL identify `client`, `provider`, `model`, `reasoningEffort` and version policy.

#### Scenario: Resolve a supported explicit binding
- **WHEN** an operator selects an enabled role and supported values
- **THEN** the same declared tuple maps deterministically to the client's native arguments or configuration, including the OpenSpec `openers.<tool>.args` path for the orchestrator
- **AND** the effective configuration is verified before use with no ambient model or reasoning defaults. Non-AI harnesses need no fabricated AI tuple.

#### Scenario: Reject missing or unsupported role settings
- **WHEN** a required value is absent, unsupported, ambiguous or overridden at launch
- **THEN** block that AI invocation and report the failed mapping or admission predicate without falling back to global defaults or substituting another adapter.

### Requirement: Flexible audited runtime version policy

External role configuration SHALL apply a default `versionPolicy: "gte"` with an inclusive tested-version floor, permit an inclusive `maxVersion` with that policy or an explicit `"exact"` match, and support explicit `versionCheck: false` to skip version comparison only.

#### Scenario: Compare observed versions
- **WHEN** a role is started with checking enabled
- **THEN** admit a supported version at the floor or within the configured range, reject versions below the floor or above the configured maximum, and reject a mismatch under exact policy
- **AND** apply the same policy to relevant pinned runtimes such as Bubblewrap. A satisfying version cannot replace required qualification or hash and runtime checks.

#### Scenario: Audit an explicit opt-out
- **WHEN** the operator opts out of comparison
- **THEN** retain the observed version and the disabled check state in audit evidence
- **AND** refuse unverifiable runtime identity, failed containment or mismatched runtime, relay or configuration pins even under opt-out.

### Requirement: Moderated external host discovery and setup

`detect-agents` SHALL report read-only, redacted host observations. `setup` SHALL preview exact external role configuration and the reviewer host file SHA-256 before any operator-confirmed write. Discovery and setup SHALL avoid credential values, inference, automatic installation, and repository or live-profile mutation.

#### Scenario: Discover installed or unavailable tools
- **WHEN** discovery checks Codex, Claude Code, Gemini, Hermes, OpenCode, Kilo, Pi, `grok-build`, `agy`, Bubblewrap and OpenSpec
- **THEN** report presence, executable path and observed version where available, and safe local evidence for auth readiness, containment and supported model and reasoning options
- **AND** mark unobservable capabilities unknown and absent binaries unavailable. Discovery status neither authenticates a provider nor qualifies a route.

#### Scenario: Dry-run approved role choices before writing
- **WHEN** an operator selects role tuples and reviewer limits
- **THEN** setup previews exact output paths and bytes for reviewer host JSON including `maxTurns: 96` and `interPacketDelayMs`, external role-binding JSON, an OpenSpec opener snippet, and the raw-byte `configurationSha256`
- **AND** dry runs or canceled confirmations write nothing. A matching explicit confirmation writes only to the chosen external host configuration directory and verifies the written bytes and pin.

#### Scenario: Refuse conflicting or changed destinations
- **WHEN** a preview changes, a destination aliases a repository or live profile, a symlink redirects an output, or an existing file would be overwritten without matching confirmation
- **THEN** refuse the write and report the conflict without exposing credentials or presenting unverified configuration as usable.
