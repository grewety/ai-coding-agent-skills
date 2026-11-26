# Exclusive worker runtime delta

## ADDED Requirements

### Requirement: Bounded Goal-First attempt deadline

The Goal-First implementer supervisor SHALL default a new attempt to 30 minutes before applying tighter authorization. An explicit host setting SHALL provide a finite validated override. The effective attempt deadline SHALL fit both the runtime's finite limits and the exact grant's remaining wall clock.

#### Scenario: Default and valid override
- **WHEN** a new Goal-First attempt has no explicit deadline or supplies a valid finite override
- **THEN** admission reports the effective default or selected override and the supervisor enforces it without extending the original execution budget
- **AND** a tighter remaining local deadline is honored, and retained explicit legacy limits remain valid.

#### Scenario: Invalid or unavailable time authority
- **WHEN** an override is malformed, out of bounds, conflicting, or the grant has no verified positive time remaining
- **THEN** the attempt is refused before launch and the runtime reports the failed condition.

### Requirement: Bounded progress-based timeout continuation

The runtime SHALL allow at most one automatic same-outcome continuation after a verified supervisor timeout. It SHALL reconcile the original attempt, verify preserved in-scope progress, and account against the original authority before dispatching a fresh attempt.

#### Scenario: Safe continuation after productive timeout
- **WHEN** the original attempt timed out, its process tree and adapter settled with identity-bound evidence, and a before/after checkout comparison proves attributable in-scope progress
- **THEN** the orchestrator rechecks unchanged plan, checkout and role identity, native workspace-write containment, exclusive claim and idle slot, and the original scope and restrictions
- **AND** it durably records the predecessor, verified progress and consumed time and correction authority, then admits one bounded successor for the same outcome with a fresh attempt identity.

#### Scenario: Timeout without a defensible successor
- **WHEN** evidence is missing or stale, the checkout has no attributable progress or contains disallowed changes, the prior process can still write, ownership conflicts, authority has expired, or the automatic continuation was already consumed
- **THEN** recovery preserves work and evidence, refuses a successor and never resets budgets or releases an unsettled slot.
- **AND** neither a timeout nor a progress checkpoint can tick tasks or substitute for an accepted handover. Existing native approval waits and native turn-cap continuation retain their separate checks and share the original execution budgets.
