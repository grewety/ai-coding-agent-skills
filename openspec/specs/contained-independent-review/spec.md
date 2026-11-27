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
- **WHEN** a record-only closure moves the complete tracked active planning inventory, including any admitted custom schema artifacts, into one canonical dated archive path for the same identity and preserves its bytes and modes
- **THEN** `--prepare`, `--check`, `--mode candidate` and `--verify` can use the moved inventory and review the actual closure diff and exact target SHA
- **AND** archived tasks may retain previously reviewed completion ticks under the existing normalization, while the move itself preserves task bytes.

#### Scenario: Archive ambiguity or changed content
- **WHEN** the move changes a planning byte or mode, omits or adds planning inputs, mixes active and archived copies, is ambiguous, uses an unsafe path, or includes out-of-scope source or current-spec edits
- **THEN** archive preparation fails before launch and cannot substitute a different change, predecessor, plan digest or candidate.

### Requirement: Offline review packet feasibility

Review preparation, checking and launch admission SHALL verify the trusted host configuration and reject each packet whose required whole-file reads exceed the configured `maxTurns` minus a ten-turn reserve. The offline path SHALL perform this check without credential access, a runtime probe or provider contact.

#### Scenario: Packet at or beyond the configured boundary
- **WHEN** a candidate or approach packet requires at most `maxTurns - 10` whole-file reads under the matching host configuration
- **THEN** the packet passes this predicate and remains subject to all other admission checks.

#### Scenario: Invalid host budget or oversized packet
- **WHEN** the required configuration pin is missing, differs at readback, or any packet requires more than the host budget permits
- **THEN** the tooling reports the offending budget and packet where applicable before probe or provider exposure, and refuses execution without dropping any required file.

### Requirement: Trusted host binding before paid automatic exposure

For a review governed by `auto-approved` admission, the contained runner SHALL verify the trusted external `host.json` `configurationSha256` pin and the durable delivery reservation bound to the exact review input and host configuration before any billable invocation. Its bounding cost SHALL cover the automatic probe and all planned packets. Legacy and `explicit` launches SHALL retain the applicable separate single-run authority.

#### Scenario: No matching pre-launch binding
- **WHEN** the host pin is absent or mismatched or the required reservation is absent, mismatched, stale or already redeemed
- **THEN** the runner refuses provider contact, including the probe, without falling back to a different authority mode
- **AND** reservation and host configuration data stay outside the reviewer sandbox.

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

The trusted host SHALL support bounded concurrency and pacing for review packets within the run deadline. It SHALL retain sanitized upstream response classifications in host-private status evidence and preserve containment and the sandbox's sanitized failure response.

#### Scenario: Multi-packet pacing
- **WHEN** a valid existing host configuration omits `packetConcurrency` or explicitly sets it to 1
- **THEN** default to serial execution and preserve existing raw configuration pins, held reservations and offline readback compatibility
- **AND** when pacing is enabled, wait the configured interval before launching an eligible successor after settlement. A single packet needs no delay.

#### Scenario: Pinned concurrent execution
- **WHEN** the exact pinned configuration sets `packetConcurrency` to integer 2 or 3, the automatic probe passes and the approved run can launch
- **THEN** launch at most that many packets concurrently and space successive packet starts by at least `interPacketDelayMs`
- **AND** reserve the full probe and packet budget before provider contact, preserve an independent session, relay isolation, bounded capture and exact whole-file audit per packet, and preserve packet identity in offline verification regardless of completion order.

#### Scenario: Invalid configuration or unproved isolation
- **WHEN** the cap is nonintegral, outside 1 through 3, unpinned, or incompatible with packet isolation
- **THEN** refuse the unsafe run before new exposure. If safe concurrency cannot be proved, ship the conservative serial route and document the exact blocker.

#### Scenario: Classified upstream refusal
- **WHEN** the upstream returns HTTP 429, 529, or 401 or 403
- **THEN** the host retains the bounded class `upstream-rate-limited`, `upstream-overloaded`, or `upstream-auth-failed` respectively, associated with the relevant attempt and packet
- **AND** upstream failure headers, body, credentials and private diagnostic class stay out of sandbox input and output. Failure, cancellation or exhausted time stops new launches, and the supervisor settles any active siblings and retains available evidence. A partial or failed run is never admissible success and makes no automatic retry.

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
