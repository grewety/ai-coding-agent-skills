# Contained independent review delta

## MODIFIED Requirements

### Requirement: Probed OS containment

The reviewer SHALL use a fresh OS-confined process with private scratch and read-only review inputs. The real run SHALL use the same pinned runtime, effective binding and containment configuration as its successful automatic empty-input probe. Tier A SHALL deny direct network and expose inference solely through the host-owned relay. Tier B SHALL require explicit dedicated-auth opt-in and a qualified provider route.

#### Scenario: Verify runtime and strict Read coverage
- **WHEN** a successful synthetic probe precedes a review
- **THEN** the probe has zero tool calls, the exact single native read-tool inventory and empty plugins, MCP servers, skills and slash commands
- **AND** the real run proves matching runtime and fresh session, only successful whole-file reads of inventoried files, 100 percent assigned-file coverage from the native stream and a successful native terminal result.

#### Scenario: Stop on unavailable or degraded isolation
- **WHEN** driver, namespaces, pin, startup inventory, provider route, policy, native terminal state or coverage cannot be verified
- **THEN** the tool does not start a data-bearing review after a failed probe or publish a completed review from a failed run
- **AND** it refuses to widen permissions, fall back or select a different tier.

#### Scenario: Preserve the Linux sealed route
- **WHEN** Tier A runs under linux-bwrap
- **THEN** it uses pinned minimal-rootfs Bubblewrap with isolated namespaces, no real worker-visible credential, no direct network and only the approved provider inference route through a private host-side Unix socket
- **AND** read-only review access, private scratch and the original Claude startup, capture and replay requirements hold.

## ADDED Requirements

### Requirement: Exact containment tier and driver identity

New reviewer host, launch, status and receipt records SHALL bind `containmentTier` and `osDriver`. Admission and replay SHALL verify the selected pair and exact runtime qualification. Tier A SHALL remain the Claude default. Readers SHALL continue to admit original schemaVersion 1 Claude host pins and retained sealed captures under their original bytes and interpretation.

#### Scenario: Reject cross-tier reuse or implicit downgrade
- **WHEN** a host pin, launch, status, receipt or qualification changes tier or driver, omits the explicit Tier B opt-in or names an unknown or unsupported pair
- **THEN** refuse before real exposure or withhold receipt admission at replay, as applicable
- **AND** no alternative driver or tier runs implicitly.

#### Scenario: Replay legacy sealed evidence
- **WHEN** either original Claude Code 2.1.330 schemaVersion 1 host pin or its retained captures are supplied
- **THEN** original validation, scheduling, low-touch spend and offline replay remain valid without a rewrite or injected fields.

### Requirement: Tier B dedicated-auth read-only review

Tier B review SHALL use OS-enforced masking of the ambient user home, read-only runtime data, OS-read-only review export, private scratch and a verified private 0700 dedicated auth-only directory. Tier B SHALL allow only the qualified provider connectivity and single native read tool. Whole-file native-stream coverage and strict offline receipt verification SHALL be required.

#### Scenario: Qualify the linux-bwrap Grok reviewer
- **WHEN** a separately authorized benign trial evaluates Grok 1.0.92 with grok-4.7 via xai-oauth and the dedicated auth home
- **THEN** certify exact binary, adapter, provider, model, tier, driver, effective settings and caps only after positive and negative OS controls demonstrate read-only `/review`, inaccessible ambient home, host skills and unrelated credentials, and scoped dedicated authentication and provider access
- **AND** native startup permits only `read_file`, denies shell, writes and external tools, and disables web search, memory, planning and subagents. Credential values stay out of argv, environment, prompts, exports and retained evidence.

#### Scenario: Replay exact whole-file stream evidence
- **WHEN** an admitted Tier B review reads its assigned files
- **THEN** validate native request, result, file identity and packet association, including parallel reads, and compare complete returned bytes to the sealed export
- **AND** reject offsets, truncation, wrong bytes, omitted files, disallowed calls, failed native terminal result, unverified settlement or malformed `BEGIN_REVIEW_RECEIPT` / `END_REVIEW_RECEIPT` framing even when an exit status indicates success. Strict offline `--verify` binds the exact reviewed inputs and runtime from sealed evidence.

#### Scenario: Preserve unsupported or pending qualification
- **WHEN** a required Tier B control fails or the trial cannot prove an exact matching live binding
- **THEN** seal `unsupported` with the blocking predicate and retain the supported Tier A default. If trial authority is absent, retain a pending decision.

### Requirement: Bounded reviewer timeout configuration

Reviewer configuration SHALL default per-invocation `timeoutMs` to 300000 for the new setup path and permit at most 600000. An enclosing run limit, retained authority or deadline SHALL still apply.

#### Scenario: Validate the timeout boundary
- **WHEN** setup or runtime validation sees the default, an explicit 600000 value or a value above the ceiling
- **THEN** preserve the default and existing explicit valid pins, accept 600000 subject to tighter enclosing limits, and refuse values above 600000.
