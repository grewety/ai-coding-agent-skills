# Exclusive worker runtime bindings and recovery

[run-implementer.md](run-implementer.md) describes the local implementation
assignment and authority. A verified adopting parent binds the qualified native
Codex Implementer and independently selected Direct-CLI Reviewer. Older
frozen assignments use the pinned original runtime and retained evidence.

## Pair and sandbox

Use a schema 4 paired host with `runtimeSha256`, `pair`, `override`, `restrictions`
and a pinned schema 2 `roleBindings` record. A bounded override names the exact
attempt, approved expiry, complete pair and role binding pin. Each role provides
client, model, provider, version, route, configuration and pinned file inventory.

- The Implementer uses route `codex-native-named-workspace-write`, the
  exact approved native executable, `codexHome`, isolated `home` and `xdg`,
  and independent offline and live qualification. The physical `slot` equals
  `codexHome`. Its configuration enables dedicated auth, suppressed ambient
  discovery and named workspace-write.
- The Reviewer uses route `direct-cli`, the effective selected client and
  exact schema 3 configuration, minimum two inventory pins and a fresh
  `session` UUID. Keep reviewer and implementer evidence and grants independent.
  [Review launch and replay](review-candidate.md).

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
identities. Initial admission publishes the claim and its launch record
together. A failed check before publication leaves the claim available.
A published claim remains occupied until a verified explicit release.
An incomplete published record or unknown owner blocks reuse. Preserve the registry
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

## Goal-First supervisor timeout

Under the prospective integrated policy, read back the original delivery
boundary and sealed handover. A productive timeout has a protected
`timeout-progress.json` with the exact checkout HEAD, settlement hash, and
before and after output fingerprints. The runtime verifies those bytes, the
sealed result, Git state and current output scope again before dispatch.

Use the existing protected slot-release receipt and retain the assignment
claim. The successor's `exclusive-runtime-continuation` record uses
`reason: "supervisor-timeout"`, `verifiedProgress: true`, and
`progressSha256` over the protected progress record. Include the existing
prior result and settlement hashes and exact attempt, action, plan and
orchestrator bindings. The same checkout and qualified role bindings must
pass fresh native preflight. A fresh attempt and independently bounded
inference grant are still required.

The launch record retains its predecessor, progress seal, elapsed and
remaining wall time, and consumed correction count. A second supervisor
timeout stops. Native turn-cap recovery remains separate and shares held
correction authority in an assignment that uses timeout continuation.
A timeout or checkpoint leaves the native outcome pending.
