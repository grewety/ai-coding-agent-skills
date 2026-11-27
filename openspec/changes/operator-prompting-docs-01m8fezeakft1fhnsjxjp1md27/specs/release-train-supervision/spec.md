# Spec Delta

## ADDED Requirements

### Requirement: Supervisor guidance for verifier findings and PR fixes

The Supervisor reference SHALL explain how to triage findings against the local verifier trust model and plan targeted PR-fix delta review within existing authority.

#### Scenario: Triage a local verifier finding
- **WHEN** a finding concerns a local CLI verifier
- **THEN** the Local-CLI Trust-Boundary Filter distinguishes actual verifier logic, integrity and evidence-custody defects from objections that assume a remote trust service outside the declared model
- **AND** the reference directs the Supervisor to preserve evidence, repair genuine defects with regression coverage, route any required disposition through existing authority, and avoid treating a trust-model objection as blanket clearance for a real finding

#### Scenario: Allow bounded packet spillover
- **WHEN** a targeted PR-fix delta review may spill into a second packet
- **THEN** the reference explains how to request up to two packets in the original scoped grant, within the applicable cap and the existing review and finish admission rules
- **AND** it preserves exact scope, spend reservation and proof requirements, including separate authority for retries
