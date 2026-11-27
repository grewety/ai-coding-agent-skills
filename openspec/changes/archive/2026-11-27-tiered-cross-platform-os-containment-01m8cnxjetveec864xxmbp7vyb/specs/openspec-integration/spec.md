# OpenSpec integration delta

## ADDED Requirements

### Requirement: Confirmed containment setup preview

The packaged setup command SHALL offer a single-command preview for explicit `--tier a` and `--tier b` selection. It SHALL report the tier and driver, exact pins, external outputs, raw host configuration digest, confirmation digest and qualification disposition. It SHALL write only after matching explicit confirmation, within the already supported external setup boundary.

#### Scenario: Preview the default Linux sealed route
- **WHEN** an operator selects `--tier a` with trusted Linux runtime prerequisites
- **THEN** the preview resolves the exact pinned runtime and libraries, explains zero-credential sealed operation and reports exact proposed output bytes, selected driver and confirmation digest
- **AND** preview leaves configuration, credentials and profiles untouched. Matching confirmation admits only reviewed external output bytes.

#### Scenario: Preview dedicated-auth Linux setup
- **WHEN** an operator selects `--tier b` with an explicitly named dedicated authentication directory
- **THEN** the preview checks the 0700 auth-only boundary using redacted metadata, reports the provider-connectivity and credential trade-offs, and distinguishes preview readiness from exact route qualification
- **AND** it refuses unsafe directory identity or contents, missing prerequisites, conflicting outputs and stale confirmation without exposing credential values, copying ambient auth or writing outside the verified destination.

### Requirement: Fail-closed platform driver selection

The runtime SHALL expose `linux-bwrap` as primary and recognize optional `windows-container` and `macos-seatbelt` contracts in that order. Optional driver use SHALL require exact native proof of the advertised OS, filesystem, auth, network and role containment. An unavailable or unqualified driver SHALL be reported without fallback.

#### Scenario: Gate Windows tests before launch
- **WHEN** an operator explicitly enables an optional Windows integration test from native Windows or WSL2 interop
- **THEN** preflight verifies the actual Windows host, native AI CLI executables needed for the selected tests, container, job and filesystem controls before any Windows integration test runs
- **AND** return `missing-windows-client` for absent required clients, `unsupported-on-host` where native Windows or supported interop is unavailable, or `unqualified` when required native controls or exact qualification cannot be established. Linux executables or synthetic fixtures alone do not qualify Windows.

#### Scenario: Recognize the macOS contract
- **WHEN** an operator selects `macos-seatbelt`
- **THEN** return `unsupported-on-host` outside native macOS and `unqualified` until a matching native trial proves profile and network controls, scoped review or worktree access and the correct tier-specific auth boundary.

### Requirement: Synchronized containment distribution

Both affected complete skills and their Claude bundles SHALL ship synchronized role setup, supported and unsupported routes, compatibility and operator guidance. Their versions SHALL reflect bundled changes. Qualification claims SHALL reference exact evidence and distinguish local packaging, native discovery, and live qualification.

#### Scenario: Verify all affected packaging and documentation
- **WHEN** the candidate is built from its exact committed revision
- **THEN** the package inventories and shared setup stay synchronized and the new driver and verification materials are included wherever their owning package requires them
- **AND** verify the documentation scope explicitly covers `docs/containment-tiers.md`, `docs/configurable-backends.md`, `docs/claude-reviewer.md`, `docs/worker-runtime.md`, `docs/claude-installation.md`, `docs/openspec-installation.md`, `docs/openspec-workflow.md`, `docs/openspec-review-configuration.md`, `README.md`, `AGENTS.md` and owning child contributor contracts.
