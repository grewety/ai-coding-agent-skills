---
metadata_version: 1
artifact: spec
capability: exclusive-worker-runtime
---
# exclusive-worker-runtime Specification

## Purpose

Run an approved implementation assignment through a dedicated worker and reconcile the original attempt after interruption. Give delivery verified ownership and settlement evidence across worktrees and clones on one execution host.

## Requirements

### Requirement: Exclusive host assignment and role reservation

The packaged runtime SHALL acquire a non-blocking host-wide claim before any checkout or profile mutation and retain the assignment across implementation, review, interruption and recovery. It SHALL reserve the actual role slot separately and release it only after verified settlement and quiescence.

#### Scenario: Two checkouts compete for one change
- **WHEN** two invocations in separate worktrees or clones of the same repository request the same full change name
- **THEN** one canonical repository-and-change claim wins and only its owner can begin delegation
- **AND** the loser reports occupied without touching the checkout, profile or worker.

#### Scenario: Authority changes at claim time
- **WHEN** the winner rereads the workspace, approved plan or Goal Contract, allowed paths, group or outcome, restrictions, budgets and required inputs under the claim
- **THEN** a mismatch, unresolved overlapping contract, unexpected dirty checkout or unverified required locator blocks reservation and launch
- **AND** the durable assignment binds the exact approved identity, checkout and role attempt before delivery of its request.

#### Scenario: Idle-looking role slot
- **WHEN** a worker leader exits, a persisted claim is missing or a PID is reused
- **THEN** the adapter requires the original process birth identity, owned session, process-tree settlement and explicit release before it can reuse the canonical physical profile or configuration slot
- **AND** unknown ownership remains occupied or blocked.

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

### Requirement: Verify checkout containment before dispatch

The runtime SHALL smoke-test the selected implementer sandbox in a new checkout or execution environment before product edits, and block the assignment if it cannot prove the expected permissions.

#### Scenario: Read and disposable write checks
- **WHEN** an operator first uses the qualified route in a new host, container or checkout
- **THEN** a benign file is readable in read-only mode with a denied write, a unique disposable workspace file can be created, read back and removed in workspace-write mode, protected-path access is denied as required, and checkout status matches its pre-probe state.

#### Scenario: Native containment unavailable
- **WHEN** namespace, UID, path or binary resolution prevents the smoke check from proving isolation
- **THEN** the runtime reports the failed predicate and a bounded operator decision without starting product work or widening permissions.

### Requirement: Bounded foreground supervision and sealed handover

The adapter SHALL bound worker and independently admitted parallel-batch runs with explicit deadlines, stream quotas and structured milestone progress. The adapter SHALL bind its sealed file handover to the original request, process, session and generated result.

#### Scenario: One foreground run yields admissible evidence
- **WHEN** the native worker settles within its limits
- **THEN** the verified request and native report are retained outside checkouts and profiles as `request.md` and `report.md`, with adapter-only no-clobber publication of `result.json` and verified capture hashes
- **AND** foreground milestones support progress display while only sealed readback may inform delivery.

#### Scenario: An unrelated terminal signal resembles completion
- **WHEN** a prompt echo, Herdr side-thread `done`, apparent uptime, unsent draft or unverifiable terminal exit is observed
- **THEN** it cannot publish or admit a result, tick a task or advance delivery
- **AND** a worker-authored, tampered, truncated, mismatched or incomplete handover is rejected.

#### Scenario: Parallel foreground batch
- **WHEN** an authorized batch contains independently admitted assignments
- **THEN** every assignment first owns its own claim and idle slot, and the batch remains foreground and bounded with an identity-bound outcome per attempt
- **AND** a conflicting assignment or a dependent group cannot use a batch to bypass claim or delivery order.

### Requirement: Original-attempt recovery and process-tree quiescence

Restart, timeout and cancellation SHALL reconcile the original attempt before any replacement or advancement. Where termination is required the adapter SHALL verify identity-bound process-tree quiescence, including descendants, before releasing the claim or slot.

#### Scenario: Supervisor crashes after request delivery
- **WHEN** the operator resumes and the original worker or late result is positively identified
- **THEN** recovery observes that same session or admits its verified terminal handover exactly once
- **AND** missing, contradictory or uncertain identity preserves evidence and stops without replay, budget reset, overwrite or termination of an unrelated process.

#### Scenario: Leader exit leaves a child or the session identity drifts
- **WHEN** the leader exits, the wall-clock deadline expires or a surviving child can still write
- **THEN** the adapter retains separate native and supervisor outcomes, proves the identified process tree quiescent or reports a blocker, and denies replacement while ownership or fallout is uncertain.

#### Scenario: Native input wait and native turn cap
- **WHEN** the adapter verifies a native approval or credential wait
- **THEN** only the operator can answer in the original session, and an unverifiable or unresolved wait stops
- **AND** a native turn cap, as distinct from a timeout, allows at most one separately recorded same-action continuation with verified progress, quiescence and remaining authority.

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
