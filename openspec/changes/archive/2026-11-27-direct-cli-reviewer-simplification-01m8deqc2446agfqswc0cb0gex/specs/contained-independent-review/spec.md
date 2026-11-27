# Independent review delta

## ADDED Requirements

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

The reviewer SHALL publish independently verifiable evidence for the approved request and native output. Offline `--verify` SHALL require a unique framed receipt per assigned packet and verify the bound identity, contents and disposition.

#### Scenario: Verify a complete receipt
- **WHEN** a settled fresh session returns exactly one `BEGIN_REVIEW_RECEIPT` and `END_REVIEW_RECEIPT` frame with valid schema and a consistent verdict and findings
- **THEN** offline replay verifies the exact candidate SHA or the complete raw planning identity, assigned packet paths and digests, session, coverage claim, and finding paths against the independently retained expectation and sealed evidence
- **AND** only supported structured Read events that reconstruct whole-file reads substantiate whole-file coverage. Other supported routes report `receipt-only` and cannot satisfy a whole-file or zero-waiver coverage requirement.

#### Scenario: Reject adverse output
- **WHEN** a frame is absent, repeated, malformed, truncated, ambiguous, stale, or contains an unassigned path or inconsistent verdict or findings
- **THEN** offline replay refuses acceptance without network or profile access. It also rejects changed packet bytes, unverified settlement, dirty postflight, missing packets and unsupported coverage claims.

## MODIFIED Requirements

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

### Requirement: Bounded reviewer timeout configuration

Each invocation SHALL enforce a finite wall-clock timeout and verified process-tree settlement. Reviewer setup SHALL default `timeoutMs` to 300000 and cap it at 600000. Tighter held deadlines SHALL prevail.

#### Scenario: Validate the timeout boundary
- **WHEN** setup or runtime sees the default, an explicit 600000 value, or a value above the ceiling
- **THEN** retain the default and valid tighter pins, accept 600000 subject to tighter enclosing limits, and reject values above 600000.

#### Scenario: Timeout or cancellation leaves descendants
- **WHEN** the deadline expires, the worker stops, or its leader exits with children
- **THEN** the supervisor settles the original tree, checks the worktree again and preserves the bounded outcome. Unproved settlement prevents receipt acceptance or replacement launch.

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

## REMOVED Requirements

### Requirement: Probed OS containment
**Reason:** The default Reviewer uses portable Direct-CLI packet and process integrity controls.
**Migration:** Use the Direct-CLI reviewer session and receipt requirements.

### Requirement: Short private reviewer socket
**Reason:** Direct CLI uses normal host authentication.
**Migration:** Remove review relay and socket configuration from active setup.

### Requirement: Contained Reviewer adapter and relay qualification
**Reason:** Review adapters use direct invocation and are verified on the named host.
**Migration:** Apply Direct-CLI session and offline receipt requirements and distinguish fixture evidence from live qualification.

### Requirement: Exact containment tier and driver identity
**Reason:** Active reviewer selection is independent of a tier or OS containment driver.
**Migration:** Bind the exact configured client and evidence schema. Preserve historical identity under its original verifier.

### Requirement: Tier B dedicated-auth read-only review
**Reason:** Direct CLI uses the operator's normal authentication.
**Migration:** Configure the selected installed reviewer and verify its scoped disposable packet and receipt.
