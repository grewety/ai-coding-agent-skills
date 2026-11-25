# Exclusive OpenSpec worker runtime

See [external AI roles and backend pilots](configurable-backends.md) for explicit role settings and route dispositions.

For a new explicit deployment, use a schema 2 pair backed by the pinned
`roles.json` and the exact qualification manifests. The standalone Goal-First
and exclusive commands use the same native Codex containment and supervision.

## Supported binding

The recorded synthetic qualification on one Linux host covers native
dedicated Codex **0.171.0** with `gpt-6.2-sol`, its named workspace-write
profile `worker` (`codex-native-named-workspace-write`), and a fresh
read-only Claude Code **2.1.330** reviewer with `claude-sonnet-4-6`,
Bubblewrap **0.9.0** and the `same-uid-key` relay. Retrieve the evidence for
`exclusive-worker-runtime-01m84dt53xh6x16nwwqebacz8m` at the recorded repair
SHA `9b909f9467ddea6b12f7ca77f959f39ef01e2702`. Qualification remains bound
to the pinned host, runtime and role files. A different host, client, model,
version or provider route requires its own qualified binding. Hermes
`advanced-delegation` with `profile_routes` is an optional unqualified
implementation route. Use the contained reviewer for its separate role.
[Role configuration](openspec-operator-tutorial.md#configure-the-three-roles).

## Install and bind

1. Follow the [OpenSpec prerequisites](openspec-installation.md). Install
   complete delivery 1.8.0 and next 0.8.0 packages from the
   `openspec-development` 1.8.0 bundle and the separately selected
   orchestration 0.22.0 package from `autonomous-orchestration` 1.12.0.
   Check the exact CLI and supporting file bytes outside the workspace before
   enabling the project route. Use the normal collision, backup and fresh
   session checks when updating or removing a package.
   [Claude installation](claude-installation.md),
   [Hermes and Codex profile controls](../skills/autonomous-ai-agents/autonomous-implementation-review/references/profile-preparation.md).
2. Use Node 22+, Git, Python 3, procfs and pidfds on Linux. Use one private
   host registry under the OS account's passwd home, shared by all known
   clones and worktrees. Create distinct physical roles with a dedicated
   persistent Codex home and isolated HOME and XDG config, plus a separate
   reviewer config slot. The operator provisions dedicated authentication
   separately and protects the pinned package, binaries, qualification
   records, authority and evidence outside the mutable checkout.
   [Role binding schema](../skills/autonomous-ai-agents/autonomous-implementation-review/references/worker-runtime.md),
   [reviewer setup](claude-reviewer.md).
3. Pin the exact package inventories, role client, version, generating
   model, provider, native route and effective settings. Select an explicit
   project-default pair or independently approved bounded override. Fresh
   reviewer sessions and actual role observations are required for each
   attempt. With matching qualification, a project can select the runtime prospectively
   with `<!-- openspec-worker-runtime: exclusive -->` in its integrated root
   contributor contract. Keep a selected run's binding and restrictions
   through recovery and corrections. A missing, expired, changed or
   unqualified binding blocks delivery.
   [Delivery runtime inputs](../skills/software-development/openspec-delivery/references/delivery-runtime.md).

Codex's ordinary CLI state stays in its own `CODEX_HOME`. Use dedicated
pre-authentication and the pinned native executable with stdin transport,
`--ephemeral`, `--ignore-user-config`, `--ignore-rules` and
`--enable skip_host_skill_discovery`. The native named profile uses the
containing directories of allowed files as writable roots and separately
protects reserved paths. After settlement, delivery checks the observed changes
against the exact file allowlist before admitting outputs. The launch uses
isolated environment values and removes inherited parent, Hermes and foreign
runtime selectors, including `VIRTUAL_ENV`,
`PYTHONHOME` and `PYTHONPATH`. Preserve the native sandbox and use the
reviewer's separate OS-contained route. Run Codex directly under its native
sandbox. Hand authentication or approval waits to the operator in the
verified original native session.

## Sandbox checks

Run the route's native smoke checks before product edits. Require a benign
read and denied write in read-only mode, a disposable workspace
write/read/delete in workspace-write mode, denials for protected handoff, Git
and task paths, and a synthetic credential control. Compare checkout status
before and after and prove cleanup. Live qualification separately needs
positive and negative synthetic service connectivity and publisher denials.

For a separate Docker evaluation, use container-native absolute mount and checkout paths
and map the host UID/GID to the worker. The workbook uses the default Docker
seccomp baseline with a targeted allowance for native unprivileged user and
mount namespaces. The allowance covers `clone`, `clone3`, `mount`,
`mount_setattr`, `move_mount`, `open_tree`, `pivot_root`, `setns`,
`umount`, `umount2` and `unshare`. Keep the container unprivileged,
drop all capabilities and enable no new privileges with
`--cap-drop=ALL` and `--security-opt=no-new-privileges:true`. This is a host-specific
probe input. If native namespace creation, UID ownership or binary resolution
fails, check that the container uses the intended seccomp file and native
mount paths, or use a Linux host whose native containment can be verified.
Privileged, unconfined and unsandboxed routes are unsupported.

## Run, inspect and recover

`/openspec-next inspect` reads the resolved change, workspace, original
attempt and delivery status. A project-authorized `/openspec-next` or
`/openspec-delivery <full-name>` also requires exact approval and a separate
bounded local execution grant. It preserves restrictions such as no commits
or a named group. The applicable review authorization binds the exact export,
configuration, upper cost and output. A verified adopting parent can select
bounded automatic contained reviews. An external diagnostic or retry needs
separate permission. Branch publication and closeout require a named finish
grant. [Review and finish configuration](openspec-review-configuration.md).

Use the pinned CLI with protected assignment and hash inputs.
[Implementer command](../skills/autonomous-ai-agents/autonomous-implementation-review/references/run-implementer.md).

| Action | Effect |
| --- | --- |
| `--runtime-identity`, `--inspect` | Read the runtime inventory or positively identified original attempt. |
| `--run` | Check authority and checkout admission, publish the claim and launch record together, then reserve the role slot and run the authorized foreground attempt. |
| `--recover` | Read the same process or finish sealing its original settlement. The prompt is sent once. |
| `--cancel` | Request the verified original supervisor to stop its process tree. |
| `--release-slot`, `--release-claim` | Retire the exact owned record after verified settlement, fallout and applicable release authority. |

Retain the request, native report, launch, lifecycle, bounded stdout/stderr,
claim identity, settlement and sealed result. Treat heartbeat or pane
observations as advisory. Reconcile an interrupted or late result through
the original claim, process birth and native session. Unknown ownership or a
surviving writer blocks replacement and advancement. Keep the original
evidence, even after settlement and release. Use the same pair for an eligible
successor, retain elapsed time and correction history, and verify the fresh
session at handover. A verified native turn cap can allow one same-action
continuation under retained budget and authority.

The dedicated implementer makes the scoped edits. Delivery checks sealed output
scope before the orchestrator prepares the exact candidate. The orchestrator
alone owns task ticks and logical local commits.
The sealed execution grant governs local commit authority, task eligibility and
budgets. If commits are restricted, keep the restriction and stop where an
exact candidate cannot be produced. Verify executable gates and fresh
independent review on the exact SHA. Task-Guided unlocks the next eligible native group
only after accepted predecessor evidence. Goal-First evaluates the single
approved local outcome through the same evidence. Correct a confirmed
in-scope finding within retained budgets and repeat exact-SHA verification.
Every review needs a sealed session binding. If recording accepted native
progress changes the SHA, bind a fresh reviewer session to the same qualified
configuration and new candidate under a separate single-run grant.
[Delegated review session binding](../skills/software-development/openspec-delivery/references/delivery-runtime.md#configured-exclusive-worker-runtime).
Stale or missing evidence, invalid coverage, a wider correction or exhausted
authority leaves the result pending or blocked.
