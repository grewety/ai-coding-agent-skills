# Exclusive worker runtime delta

## MODIFIED Requirements

### Requirement: Qualified paired worker bindings

`scripts/run-implementer.mjs` SHALL use a data-only request and a qualified external implementer when a project selects delegated execution. The resolved implementer and reviewer SHALL have separately verified role, client, model, reasoning effort, provider, version, settings, permissions and session identities. Pair admission SHALL verify independent sessions and providers.

#### Scenario: Reuse a verified project pair
- **WHEN** project-default bindings pass preflight and stay pinned, or an explicitly authorized per-run override passes the same checks
- **THEN** the assignment reuses the resolved pair and auth routes for its eligible groups and corrections
- **AND** an unavailable, changed, unqualified or ambiguous binding blocks dispatch and reports the failed predicate without inline fallback or backend substitution.

#### Scenario: Persistent Codex worker authentication
- **WHEN** the selected client is the qualified Codex implementer
- **THEN** it uses a persistent pre-authenticated dedicated worker `CODEX_HOME`, isolated home and XDG config, a pinned executable path and native `workspace-write` containment
- **AND** worker auth failure is surfaced on the same verified route, with host skill discovery and ambient user configuration disabled and no copied credentials or operator profile edits.

#### Scenario: Verify actual role boundaries
- **WHEN** qualification uses benign files and a synthetic publish credential with positive controls at an isolated test service
- **THEN** both real launch routes show the intended permissions and permitted connectivity, deny out-of-scope access and publishing, and leave the role package inventories unchanged
- **AND** the reviewer is fresh and OS-confined read-only, and the implementer cannot mutate protected handoffs, credentials, task state, or Git state outside the orchestrator boundary.

## ADDED Requirements

### Requirement: Implementer adapter qualification

Standalone Goal-First and exclusive Implementer routes SHALL bind an allowlisted adapter to the verified effective settings and require offline and bounded live qualification for the selected route. An absent or unqualified route SHALL return `unsupported` with its exact blocker before product dispatch.

#### Scenario: Promote an Implementer backend
- **WHEN** evaluating Codex, Claude Code, Hermes with an explicitly named `--profile`, OpenCode, Pi, `agy` or `grok-build` using separately admitted positive and negative controls
- **THEN** promote only a route that proves native OS workspace-write containment without interfering nested sandboxing, isolated HOME and XDG configuration, effective skill-discovery suppression and intended model, provider and reasoning-effort mapping
- **AND** prove exclusive host claims, protected-path denials, non-interactive bounded supervision, process-group quiescence and sealed file-based handover from the original attempt.

#### Scenario: Absent binary or failed control
- **WHEN** a target binary is absent on the qualification host or containment, non-interactive handover or another required invariant cannot be demonstrated
- **THEN** retain the backend's `unsupported` disposition with the specific failed or unavailable prerequisite
- **AND** refuse product dispatch through that backend while independently passing routes remain eligible.

#### Scenario: Discover a contract-only Implementer route
- **WHEN** an operator selects Kilo, Gemini or another unqualified adapter for a real Implementer assignment
- **THEN** return `unsupported` before dispatch even when the CLI was discovered and its version satisfies policy.
