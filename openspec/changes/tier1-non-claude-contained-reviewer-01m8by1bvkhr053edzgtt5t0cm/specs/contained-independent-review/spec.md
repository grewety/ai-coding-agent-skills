## MODIFIED Requirements

### Requirement: Contained Reviewer adapter and relay qualification

Planning, candidate and closure review SHALL admit a Reviewer only after offline and bounded live verification of the selected client, provider, relay and effective settings. The configured reviewer session and provider SHALL be independent of the generating session and provider.

#### Scenario: Promote a Reviewer backend

- **WHEN** evaluating Claude Code or Codex with its explicit model, provider and reasoning effort and pinned host limits for turns, spend, timeout and pacing
- **THEN** positive and negative controls prove Bubblewrap isolation, approved inference through a host-side Unix socket and denied direct network, unauthorized tools and writes
- **AND** controls prove credentials and upstream diagnostic headers and bodies stay outside the sandbox, the exact assigned content is exposed only through the approved route, and whole-file read coverage and native result are stream-verifiable.

#### Scenario: Qualify the Tier 1 alternative

- **WHEN** an operator separately grants a bounded live trial against benign synthetic input and offline controls pass
- **THEN** evaluate Grok 1.0.92 with grok-4.7 and host-only xAI OAuth subscription inference through a private host-side `inference.sock`
- **AND** seal the exact client, binary, model, provider, relay, effective settings and limits with offline and live qualification evidence before enabling the route for real review data.

#### Scenario: Refuse the primary route and evaluate an authorized fallback

- **WHEN** the pinned Grok subscription route cannot meet any containment, authentication, or audit invariant
- **THEN** fail closed and retain the exact blocker before selecting any fallback
- **AND** evaluate a separately authorized host-side api.x.ai key relay or pinned Pi 1.5.2 with Hermes proxy xAI OAuth or a host-side api.x.ai key relay under the same controls
- **AND** if no route qualifies, seal the exact unsupported disposition and available options and retain the qualified Claude route. A missing trial grant keeps qualification pending.

#### Scenario: Prove the non-Claude trust boundary

- **WHEN** synthetic controls exercise any proposed Tier 1 route
- **THEN** prove minimal-rootfs Bubblewrap `--unshare-all`, read-only `/review`, no host profile mounts, no direct network, and provider access solely through the host-side Unix socket
- **AND** prove real credentials, refresh tokens and raw auth headers stay outside the sandbox, its arguments and environment, and captured evidence
- **AND** allow only `Read` or `read`, deny writes, shell, external tools and ambient context, bound requests or turns and elapsed time, and reject actionable or unaudited output if any control fails.

#### Scenario: Admit the exact receipt offline

- **WHEN** the real run finishes and the native stream proves all assigned files were read in full
- **THEN** the retained handover contains a valid mode-specific `BEGIN_REVIEW_RECEIPT` and `END_REVIEW_RECEIPT` receipt, and offline `--verify` checks the identity, raw captures, receipt and independent pins
- **AND** verify rejects a partial read, stale binding, omitted file or malformed receipt even if the provider returned a successful terminal response
- **AND** parallel read events preserve exact request and result association. Truncation, omitted ranges and disallowed tools cause rejection.

#### Scenario: Candidate unavailable or relay unqualified

- **WHEN** a candidate binary is absent, permission, stream audit or handover controls fail, or an unqualified Gemini, OpenRouter or generic OpenAI-compatible relay is selected
- **THEN** record `unsupported` with the exact blocker and refuse any real review through that route before export exposure
- **AND** preserve the already qualified routes and their independently verified bindings.

#### Scenario: Replay existing Claude evidence

- **WHEN** a schemaVersion 1 Claude Code 2.1.330 host pin or a retained capture is used
- **THEN** validate and replay the original bytes under the original pins with no migration
- **AND** preserve packet concurrency 1 through 3, omitted-concurrency serial default, durable low-touch spend accounting and default reviewer selection. Use isolated fixtures without ambient profile fallback.
