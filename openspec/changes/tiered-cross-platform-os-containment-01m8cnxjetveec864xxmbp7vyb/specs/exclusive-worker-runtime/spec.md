# Exclusive worker runtime delta

## ADDED Requirements

### Requirement: Tier-bound implementer containment

Exclusive implementer assignments SHALL bind the exact containment tier and OS driver in new host, launch, status and receipt evidence. Admission SHALL require a qualified native or driver-contained workspace-write route, with dedicated authentication and hidden ambient home for Tier B. Routing SHALL preserve the exclusive claim, supervision, scope validation and settlement guarantees.

#### Scenario: Prove the pinned native Codex implementer
- **WHEN** a separately authorized benign Linux trial evaluates Codex 0.172.0
- **THEN** it uses Codex native workspace-write and its exact pinned, dedicated worker authentication without outer Bubblewrap nesting
- **AND** positive and negative controls verify named workspace writes, denied access outside scope, hidden ambient home and skill suppression, exact effective identity, original process settlement and sealed handover. A failed control yields the exact sealed `unsupported` disposition and leaves product dispatch blocked.

#### Scenario: Prove wrapped non-Codex implementer containment
- **WHEN** an eligible non-Codex implementer explicitly selects Tier B `linux-bwrap`
- **THEN** admission verifies hidden ambient home and XDG configuration, a dedicated 0700 auth-only directory, read-only system inputs and named workspace-write containment with private scratch
- **AND** it refuses writes to governed task state, Git, claims, protected evidence and paths beyond the permitted workspace, and gates real dispatch on the exact offline and bounded live proof for that route.

#### Scenario: Refuse changed identity or failed startup
- **WHEN** the driver or tier differs between qualification and launch or the runtime cannot establish its OS controls
- **THEN** fail closed before product dispatch and retain the exact blocker
- **AND** the runtime never silently selects a weaker tier, swaps the driver or falls back to an ambient profile or unqualified adapter.
