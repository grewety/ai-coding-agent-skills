## MODIFIED Requirements

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

#### Scenario: Report the observed Grok version

- **WHEN** a trusted installed `grok` reports `grok 1.0.92 (b06756fd6256) [stable]`
- **THEN** discovery reports version `1.0.92` under the existing `grok-build` configuration identity
- **AND** supported legacy `grok-build` output still works. Untrusted paths or malformed and ambiguous output stay unverified.

#### Scenario: Stage an explicit alternative reviewer

- **WHEN** an operator selects a non-Claude contained Reviewer binding
- **THEN** setup validates the exact client, provider, model, relay, effective settings, runtime and limits and reports an explicit qualification disposition
- **AND** incomplete or mismatched offline and bounded live proof keeps that binding unsupported for real review, without ambient profile fallback or changing the default reviewer.
