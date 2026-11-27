# Release-train supervision delta

## Purpose

Make authorized Driver dispatch and reactive monitoring recoverable across Supervisor sessions using verified worktree state and a portable wiki handoff.

## ADDED Requirements

### Requirement: Reconcile a fresh session
A Supervisor SHALL read the vault's `hot.md`, `_meta/voice.md`, private `_meta/local.md`, and the selected project's `PROJECT.md` and `STATE.md`. It SHALL reconcile the exact change, phase, worktree and Driver identity with current observations before dispatch or resume. It SHALL verify the reciprocal wiki/repository association before following a configured reverse pointer.

#### Scenario: Existing Driver after a handoff
- **WHEN** the recorded working Driver and actual pane, checkout and phase agree
- **THEN** resume monitoring that Driver without launching another

#### Scenario: Missing or stale context
- **WHEN** the required project or host context is unavailable, or the recorded identity conflicts with the reciprocal project association, live checkout or pane
- **THEN** gather read-only evidence and stop at any unresolved conflict before a write or launch

### Requirement: Verify an authorized Driver launch
The Supervisor SHALL verify phase authority and root the Driver in the verified worktree for that phase. It SHALL use only configured authentication, check launch delivery on the selected pane, and reconcile uncertain launches before retry.

#### Scenario: Worktree dispatch
- **WHEN** a phase grant and dedicated worktree are verified
- **THEN** launch or relay into the intended Driver, initialize SSH agent access only where required by the approved local setup, and observe the expected cwd, session and request
- **AND** keep host configuration and authentication material outside tracked wiki files

#### Scenario: Adapter cannot prove delivery
- **WHEN** the host cannot confirm correct launch, request delivery or capable monitoring
- **THEN** do not assume the Driver started or send a duplicate request
- **AND** retain verified observations for recovery

### Requirement: Maintain reactive monitoring
The Supervisor SHALL arm a one-shot schedule in the same turn as an authorized launch or unblock, inspect the identified Driver and relevant repository evidence at each wake, and rearm while work is active. It SHALL keep ownership through verified completion or a genuine governance stop.

#### Scenario: Routine progress
- **WHEN** the scheduled check finds work or a routine recoverable failure within the granted phase
- **THEN** handle the diagnostics internally, report concise observed progress and schedule the next check before yielding

#### Scenario: Monitoring fails after launch
- **WHEN** the active Driver cannot be attached to the intended timer
- **THEN** switch to a verified in-session monitoring route when available
- **AND** preserve the active session and escalate the unresolved monitoring failure if no verified route remains

### Requirement: Record a real stop
The Supervisor SHALL relay exact phase decisions and escalate material scope, authority, budget, safety and unresolved evidence conflicts using a numbered Decision Card. It SHALL update `STATE.md` and `hot.md` with the same verified checkpoint at a governance stop or terminal completion.

#### Scenario: Approval or protected finish is pending
- **WHEN** the Driver reaches a phase requiring operator authority
- **THEN** present the precise identity and relevant evidence with numbered choices and the recommended option first
- **AND** retain the unconsumed grant boundary and synchronize both checkpoint files

#### Scenario: Terminal completion
- **WHEN** the authoritative delivery evidence and applicable cleanup readback agree
- **THEN** stop the timer and record completion and the next safe action consistently in both files

#### Scenario: Interrupted checkpoint write
- **WHEN** only one of the two checkpoint files records the new stop
- **THEN** reconcile both from the authoritative phase and evidence before any later dispatch
