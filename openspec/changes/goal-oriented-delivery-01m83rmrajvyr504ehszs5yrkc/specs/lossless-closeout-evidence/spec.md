# Spec Delta

## ADDED Requirements

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
