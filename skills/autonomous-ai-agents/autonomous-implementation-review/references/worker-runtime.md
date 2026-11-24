# Exclusive worker runtime bindings and recovery

[run-implementer.md](run-implementer.md) describes the CLI and its approval
and grant records. The sealed synthetic trials for
`exclusive-worker-runtime-01m84dt53xh6x16nwwqebacz8m` at repair SHA
`9b909f9467ddea6b12f7ca77f959f39ef01e2702` qualified the exact pair on one
Linux host. The implementer was dedicated standalone Codex 0.171.0 with
OpenAI GPT-6.2-sol and native named workspace-write. The fresh read-only
reviewer was Claude Code 2.1.330 with Anthropic Claude Sonnet 4.6 on pinned
Bubblewrap 0.9.0 via `same-uid-key`. [Contained reviewer requirements](review-candidate.md).

The trials verified original recovery without a replay launch, ordered
Task-Guided continuation and blocking on missing or stale review evidence,
and Goal-First candidate review bound to the approved Goal Contract digest.
Four Codex starts and four Claude review invocations yielded three accepted
sealed independent reviews. The original Group 2 finding was retained, and a
separately approved review of corrected context used the unchanged candidate.
This evidence covers the pinned synthetic runs. Verify both exact role records
and the bound runtime before dispatch. Paid attempts, profile provisioning and
publication depend on separate authority.

## Pair and sandbox

Both roles declare `client`, `model`, `provider`, `version`, `route`,
`configuration`, `qualification`, `inventory` and physical `slot`.
Configuration and qualification are protected path/hash locators.
Inventory is the corresponding role’s pinned package file list, with at
least two entries and each entry carrying a path and SHA-256. Use actual
no-symlink regular file pins. Inventory files are rechecked after the
original attempt settles.

- The implementer sets route `codex-native-named-workspace-write`,
  client `codex`, provider `openai`, version `0.171.0`, the qualified model
  and an absolute native executable pin. Supply separate, persistent, owner-private
  `codexHome`, `home` and `xdg` directories. `slot` equals `codexHome`.
  The configuration record has `schemaVersion: 1`,
  `role: "implementer"`, `auth: "dedicated-file"`,
  `disableHostDiscovery: true` and
  `permissionMode: "named-workspace-write"`.
- The reviewer sets route `claude-bubblewrap-read-only`, client
  `claude-code`, provider `anthropic`, version `2.1.330`, the qualified model,
  an independent fresh `session` UUID and a separate private configuration
  slot. Its configuration is the pinned contained reviewer host record. The implementer
  runner validates and retains this binding for the orchestrator’s separate
  reviewer dispatch.

Each `exclusive-runtime-qualification` record has `schemaVersion: 1`,
`status: "qualified"`, `role`, `client`, `route`, `version`, `model`,
`provider`, `runtimeSha256`, `configurationSha256`, `inventorySha256`,
`bindingSha256` (the canonical role hash excluding its qualification locator
and fresh reviewer session)
and an independent `supervisor` identity. The control fields
`positiveControl`, `deniedPublication`, `protectedPaths`,
`settlementVerified` and `inventoryUnchanged` are true only for
verified observations. Retain the underlying supervision evidence
independently. Synthetic tests exercise record admission without
supplying a qualification record for the distributed route.

Provision the worker authentication separately. Keep the dedicated Codex home
free of ambient `config.toml`, rules and skill discovery. The runner executes
the pinned native binary directly with `exec --json --ephemeral`,
`--ignore-user-config`, `--ignore-rules` and
`--enable skip_host_skill_discovery`. The named profile `worker` uses the containing
directories of allowed files as workspace write roots, denies writes to frozen
tasks and protects Git, publisher and profile locations. After settlement,
delivery admits changes against the exact file allowlist. The launch clears
inherited session, Python, provider and publishing variables and uses a fixed
PATH and isolated HOME and XDG config.
The controller never opens the worker’s credential file. An authentication
failure stays on the selected dedicated route and requires operator handling.
Do not share `CODEX_HOME` with a parent session or copy credentials into
a package or handover.

Selection of the native named profile requires its configuration to
take precedence over legacy `-s workspace-write`. The runtime passes
the named settings explicitly. Its preflight checks version, read-only
write denial, disposal of a writable workspace control, and denied
access to protected benign paths. It compares checkout status before and
after. Unsupported namespaces, path resolution, UID or capability settings
block launch. Keep the tested security controls at the operator boundary.
Other hosts, clients, versions and routes require independent qualification.
Hermes `advanced-delegation` is unqualified for this runtime and ineligible
for contained review.

## Ownership and replay

The fixed registry is `~/.exclusive-worker-runtime-v1` under the OS account’s
passwd home. Every worktree and clone on the qualified host must see
the same private registry. SSH and HTTPS origin spellings normalize to
one repository key, with the full change name as the other claim component.
Physical slots separately fence canonical profile paths and device/inode
identities. An occupation remains until a verified explicit release.
An incomplete record or unknown owner blocks reuse. Preserve the registry
and handover bytes for read-only diagnosis and any separately authorized
repair. Designate one OS user and shared host registry per qualification.

The original attempt has a protected launch record, preflight proof,
native leader and supervisor birth identities, delivery and session markers,
and the bounded supervisor’s raw settlement. OS process birth includes PID,
session ID, kernel boot ID, namespace and start time. A supervisor arms
this binding before streaming the request over stdin. The supervisor
records natural exit, timeout, quotas, cancellation and descendant
settlement separately from native report status. Recovery can observe the
original attempt after interruption and replay a late sealed result.
Process, scope or handover drift blocks admission. A process observed as
waiting may only receive an operator decision through its verified
original native surface. If that surface is unavailable, let the bound
expire or use authorized cancellation. The runner sends no credentials
or approval input.

For a successor, `continuation` pins an
`exclusive-runtime-continuation` record with `schemaVersion: 1`, `change`,
`plan`, `planDigest`, `orchestrator`, `previousAttempt`, `attempt`, `task`,
`priorResultSha256`, `priorSettlementSha256` and `reason`. Use the same
pinned role configurations, a fresh reviewer session and verified slot release. A `native-turn-cap` continuation
needs `verifiedProgress: true` and the matching `progressSha256` of the
retained native progress capture. A `review-correction` names the exact
`rejectedCandidate`, `reviewSha256` and `inScopeFinding: true`.
An `ordered-successor` names the `acceptedCandidate` for its predecessor.
Delivery replays the ordered predecessor's exact gate and review observations
or the correction's exact failure before advising dispatch. Native cap
continuation also requires delivery's once-only policy check. Keep the
new role attempt bounded and verify its distinct returned session.
One native cap continuation is available per native task. Wall-clock or
supervisor-limit stops cannot supply a native-cap continuation.

Release uses an `exclusive-runtime-release` record with
`schemaVersion: 1`, `action` (`release-slot` or `release-claim`),
`claimId`, `change`, `attempt`, `orchestrator`, `settlementSha256`,
`quiescent: true` and `falloutVerified: true`. Claim release also requires
`assignmentClosed: true` after a verified slot release. A process that
survived leader exit, unsettled probe or unknown identity requires
reconciliation before any replacement. Result publication records the
original association and never advances tasks or delivery state.
