---
metadata_version: 1
artifact: spec
capability: lossless-closeout-evidence
---
# lossless-closeout-evidence Specification

## Purpose

Define portable, lossless evidence retention for OpenSpec delivery closeout so
reviewers can verify factual completion claims without rewriting original output.

## Requirements

### Requirement: Lossless evidence representation
The delivery procedure SHALL preserve original captured evidence bytes unchanged
when they can be retained safely, and SHALL use a versioned representation when
repository rules prevent unchanged retention. The representation SHALL identify
its encoding, stored-artifact SHA-256, decoded-original SHA-256, and provenance.

#### Scenario: UTF-8 output with trailing whitespace and CRLF
- **WHEN** a captured gate output is valid UTF-8 and cannot be committed as raw text
- **THEN** the retained representation round-trips to exactly the captured bytes,
  including trailing whitespace and original line endings
- **AND** verification reports matching stored-artifact and decoded-original hashes

#### Scenario: Non-UTF-8 output
- **WHEN** captured evidence contains bytes that are not valid UTF-8
- **THEN** the procedure uses an explicitly byte-safe encoding or refuses retention
  without decoding or newline normalization
- **AND** it does not label a transformed text value as the original bytes

#### Scenario: Corrupt retained representation
- **WHEN** a retained wrapper or its decoded content does not match its declared hash
- **THEN** integrity verification fails
- **AND** the evidence cannot support a completion claim

### Requirement: Actual gate evidence retention
The delivery procedure SHALL retain the actual command, revision, environment
scope, exit status, and unmodified output for every named gate it claims. Failed
gates and rejected reviews SHALL remain byte-identical records bound to their
original candidate and SHALL be supplemented, not rewritten, by later outcomes.

#### Scenario: Named gate fails
- **WHEN** a required gate exits nonzero
- **THEN** its real output and exit status are retained as failed evidence
- **AND** a later successful successor gate does not alter or relabel that failure

#### Scenario: Bootstrap is incomplete
- **WHEN** documented workspace bootstrap is incomplete before validation
- **THEN** bootstrap output is recorded separately from acceptance evidence
- **AND** the procedure completes only authorized bootstrap and reruns the named validation

### Requirement: Readback provenance and completeness
The delivery procedure SHALL distinguish original captured responses, historical
extracts, and fresh corroborating responses. Any retained API/check/thread
readback SHALL identify source command, observation time, revision, scope, and
pagination or completeness state.

#### Scenario: PR check conclusion claim
- **WHEN** closure prose claims that required checks passed for a reviewed PR head
- **THEN** retained readbacks identify that exact head, relevant check identities,
  conclusions, and completion times
- **AND** historical corroboration verifies the applicable completion times precede merge

#### Scenario: Original-response observation after merge
- **WHEN** a complete original PR-check response was observed at or after merge
- **THEN** it does not establish earlier check conclusions and factual support is blocked

#### Scenario: Historical extract has later extraction time
- **WHEN** a historical extract is produced after merge from an original response
  captured before merge
- **THEN** it retains distinct strict UTC source-capture and extraction times
- **AND** only the source-capture time is compared with merge for historical support
- **AND** missing source-capture time blocks factual support rather than treating the
  extract time or filesystem metadata as the original observation

#### Scenario: Partial or current-only query
- **WHEN** a readback is truncated, partially paginated, or obtained after merge
- **THEN** the retained evidence labels its limitation and does not establish
  historical thread absence or earlier check conclusions

#### Scenario: Original response is unavailable
- **WHEN** the original response cannot be recovered
- **THEN** the procedure records missing evidence or narrows or blocks the claim

- **AND** it does not reconstruct an original response from a narrative summary

#### Scenario: Fail-closed claim eligibility
- **WHEN** a completion claim has failed, redacted, non-publishable, incoherent,
  invalid-timestamp, missing, or post-merge evidence
- **THEN** verification blocks the claim rather than reporting it supported
- **AND** a supported claim uses a verified representation with coherent provenance
  and labels, a successful exit status, strict UTC instants, applicable pre-merge
  observation and completion times, and a decoded structured payload proving the
  expected PR head, applicable check identities, and successful conclusions

### Requirement: Factual closure review and successor evidence
The delivery procedure SHALL require a fresh independent factual review for the
exact closure SHA after local closure gates and before authorized publication.
It SHALL preserve review identity and correction history across successors.

#### Scenario: Record-only closure review
- **WHEN** a closure branch contains receipt, evidence, and archive movement
- **THEN** a new independent reviewer verifies retained hashes, representation
  round-trips, archive identity, and factual claim completeness at that closure SHA
- **AND** the review does not reuse the implementation-review session, packet, or JSON

#### Scenario: Closure correction successor
- **WHEN** a closure finding requires a correction
- **THEN** the prior review and its disposition remain retained
- **AND** the successor receives applicable real gates and independent review at its exact SHA
- **AND** the correction does not reset the existing correction budget

### Requirement: Bounded authority and confidentiality
Evidence retention SHALL not add a scheduler, gate runner, API polling loop, or
publication authority. It SHALL retain confidentiality decisions honestly and
shall not claim a redacted artifact is a byte-identical original.

#### Scenario: Operator-reported check completion
- **WHEN** an operator reports that protected checks have completed
- **THEN** the procedure reads the same PR head and conclusions once
- **AND** it does not use unattended polling or treat the notification as merge authority

#### Scenario: Sensitive captured material
- **WHEN** captured output contains data that repository confidentiality policy
  forbids publishing
- **THEN** the procedure blocks publication or records an authorized transformation
  and its limitation
- **AND** it does not expose the sensitive original or claim byte-identical retention

### Requirement: Runnable lossless evidence commands

The delivery package SHALL expose runnable commands to capture actual command outcomes, seal and verify the existing lossless representations, and produce structured results. Commands SHALL preserve evidence boundaries and MUST NOT infer authorization from execution instructions.

#### Scenario: Capture successful or failed command
- **WHEN** an already authorized command is captured in a named checkout
- **THEN** the command record preserves its argument vector, stdout, stderr, exit status and observation time with byte-faithful hashes and source revision when applicable
- **AND** a nonzero exit remains observable and cannot become passing gate evidence

#### Scenario: Verify a sealed representation
- **WHEN** a caller verifies retained evidence offline
- **THEN** verification reports its exact identity and rejects modified, truncated, misplaced or incomplete evidence
- **AND** sensitive payloads remain subject to the original retention and export restrictions

### Requirement: Runnable closeout readback assertions

The delivery package SHALL expose structured checks for retained pull request, applicable checks, check-runs, review-thread and closure readbacks. Assertions SHALL reuse the existing claim eligibility rules and leave network queries and remote writes to their separately authorized caller.

#### Scenario: Complete matching head and review
- **WHEN** the retained readbacks bind the expected pull request and exact head to successful applicable checks and resolved review threads
- **THEN** the command reports the supported assertions, their source evidence references and any remaining closure predicates

#### Scenario: Incomplete or stale readback
- **WHEN** readback is missing, partial, tied to a different head, contains unresolved threads or cannot support a claimed historical fact
- **THEN** the command emits the failing predicate and rejects the unsupported claim
- **AND** it performs no automatic remote write, repair or publication
