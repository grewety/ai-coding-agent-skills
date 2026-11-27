# Exclusive worker runtime delta

## MODIFIED Requirements

### Requirement: Qualified paired worker bindings

The exclusive runtime SHALL use a data-only request, a qualified external Implementer and a separately bound independent Direct-CLI Reviewer. It SHALL verify effective role settings, identity, permission scope and fresh independent sessions. Project policy SHALL retain any distinct provider or model requirement.

#### Scenario: Reuse a verified project pair
- **WHEN** project-default bindings or an authorized override pass the original assignment and preflight checks
- **THEN** reuse the exact resolved pair for eligible work and corrections. Unavailable, changed or ambiguous bindings block dispatch without inline fallback or adapter substitution.

#### Scenario: Persistent Codex worker authentication
- **WHEN** the selected Implementer is qualified Codex
- **THEN** keep its verified dedicated worker `CODEX_HOME`, isolated home and XDG settings, pinned executable and native workspace-write boundary, including suppression of ambient skill and profile discovery
- **AND** surface auth failure on the same route without copying credentials or touching profiles.

#### Scenario: Verify actual role boundaries
- **WHEN** qualifying the Implementer and checking the Reviewer binding
- **THEN** verify the Implementer's existing native write, protected-path access, credential, claim and supervision controls with benign positive and negative evidence
- **AND** admit the Reviewer through fresh Direct-CLI sessions, the disposable packet boundary, untouched-worktree checks and exact receipt replay. The review client has the operator's normal host authentication and process access.

## REMOVED Requirements

### Requirement: Tier-bound implementer containment
**Reason:** Removing the shared tier and driver machinery retires driver-only Implementer bindings.
**Migration:** Use separately qualified native workspace-write routes under Implementer adapter qualification and the existing claim, protected-path, preflight, handover and settlement requirements. Block driver-only configurations before product dispatch.
