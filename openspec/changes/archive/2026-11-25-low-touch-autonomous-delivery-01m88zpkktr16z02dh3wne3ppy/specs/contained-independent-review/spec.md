# Spec Delta

## MODIFIED Requirements

### Requirement: Verified planning-path relocation for record-only closure

Candidate preparation and offline readback SHALL recognize a verified OpenSpec archive move for the exact change on a record-only closure commit while preserving frozen raw planning identity, the normalized plan digest and exact candidate binding.

#### Scenario: Byte-identical archive closure
- **WHEN** a record-only closure moves the complete tracked active planning inventory, including any admitted custom schema artifacts, into one canonical dated archive path for the same identity and preserves its bytes and modes
- **THEN** `--prepare`, `--check`, `--mode candidate` and `--verify` can use the moved inventory and review the actual closure diff and exact target SHA
- **AND** archived tasks may retain previously reviewed completion ticks under the existing normalization, while the move itself preserves task bytes.

#### Scenario: Archive ambiguity or changed content
- **WHEN** the move changes a planning byte or mode, omits or adds planning inputs, mixes active and archived copies, is ambiguous, uses an unsafe path, or includes out-of-scope source or current-spec edits
- **THEN** archive preparation fails before launch and cannot substitute a different change, predecessor, plan digest or candidate.

## ADDED Requirements

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

The trusted host SHALL support bounded pacing between successive packets and retain sanitized upstream response classifications in host-private status evidence. Containment and the sandbox's sanitized relay failure response SHALL remain unchanged on upstream failure.

#### Scenario: Multi-packet pacing
- **WHEN** the trusted configuration enables pacing and another eligible packet follows a settled packet
- **THEN** the host waits for the configured bounded interval within the run deadline. Single packets require no delay, and cancellation, failure and exhausted time stop further launches.

#### Scenario: Classified upstream refusal
- **WHEN** the upstream returns HTTP 429, 529, or 401 or 403
- **THEN** the host retains the bounded class `upstream-rate-limited`, `upstream-overloaded`, or `upstream-auth-failed` respectively, associated with the relevant attempt and packet
- **AND** upstream failure headers, body, credentials and private diagnostic class stay out of sandbox input and output. The failure yields no admissible success and makes no automatic retry.
