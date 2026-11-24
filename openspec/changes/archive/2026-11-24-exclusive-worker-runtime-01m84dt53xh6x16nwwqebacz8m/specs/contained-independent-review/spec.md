## ADDED Requirements

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
