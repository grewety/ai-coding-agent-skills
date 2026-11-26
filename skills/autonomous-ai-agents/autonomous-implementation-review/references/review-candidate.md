# Contained review command

Use this opt-in transport for candidate or charter-v1 approach exports under
separate authority for the exact export and paid inference. Use an independently
retained request, runtime and export binding, then replay the sealed handover
offline. Apply the existing candidate or charter admission rules before any
delivery decision. Run the standalone Linux command by absolute path with
Node 22 or later. For Codex Auto-review, invoke the live command directly and
retain platform permission checks. Substitute the absolute path of
this package's `scripts/review-candidate.mjs` in each command. Keep the export, publisher
output and trusted host configuration outside the reviewed checkout and
separate from each other. Use a
private, existing parent for new directories. The command reports execution
and receipt admission. The orchestrator retains authority for plan approval,
candidate acceptance, task state and publication.

```text
node review-candidate.mjs --prepare --request REQUEST --expect EXPECT --export EXPORT
node review-candidate.mjs --check --request REQUEST --expect EXPECT --export EXPORT
node review-candidate.mjs --probe --host-config HOST --admission PROBE_GRANT --output PROBE_OUTPUT
node review-candidate.mjs --mode candidate --request REQUEST --expect EXPECT --export EXPORT --host-config HOST --admission ADMISSION --output OUTPUT
node review-candidate.mjs --mode approach --request REQUEST --expect EXPECT --export EXPORT --host-config HOST --admission ADMISSION --output OUTPUT
node review-candidate.mjs --verify --request REQUEST --expect EXPECT --export EXPORT --output OUTPUT
```

All uppercase substitutions are absolute paths. The example mode commands
apply to adopting integrated policy. Include `--host-config HOST` on
`--prepare` and `--check` for these requests. Prepare reads the approved
inputs, writes a fresh export and returns its manifest SHA-256. Check validates
the current inputs and every sealed manifest member offline. Probe makes a
bounded inference call with a synthetic prompt and empty export. Either mode
makes an automatic separate probe, then sends only the assigned packet data
under the matching launch policy. The mode lines are alternatives. For offline
verify, reuse the same request, sealed export and original absolute `OUTPUT`
path bound to that run's request. Verify reads the complete sealed handover
and replays the native stream and receipt checks offline. Verify the exact
phase and applicable paid authority in the admission record before launching
either mode. An inherited parent uses the original single-run grant procedure.
A standalone probe uses its own grant.

For standalone `--probe`, `PROBE_GRANT` is the separately authorized
host-owned JSON record for one synthetic invocation. Keep it outside the
checkout and separate from the host config, runtime inputs, ledger and
output. The host operator must verify the authorization before recording
`verified: true`. Use the raw SHA-256 of the exact host file bytes and
`upperUsdMicros` equal to the configured `maxBudgetUsd` in integer
millionths of a dollar. This example authorizes one invocation at $1.

```json
{
  "schemaVersion": 1,
  "kind": "standalone-review-probe",
  "reference": "<unique independent probe approval reference>",
  "verified": true,
  "runs": 1,
  "configurationSha256": "<raw host.json SHA-256>",
  "upperUsdMicros": 1000000,
  "ledger": "/var/lib/operator/review-ledger/project"
}
```

Use the existing private mode-0700 host-owned ledger if one is configured
for review. Otherwise provision a stable private host ledger before issuing
the grant. The CLI consumes the approval reference in the grant's ledger
before opening runtime or accessing credentials. Retain the reservation
even if launch fails. Each new standalone probe needs a fresh independent
approval reference. Candidate and approach launches include their own
synthetic probe under their review authority.

Standalone probe and both launch modes can incur charges. The historical
standalone trial at `4eddbade12fab2a032755a446f9176005b7b04a1` qualified
candidate and charter-v1 modes on the tested Linux/WSL pairing of Bubblewrap
0.9.0 and Claude Code 2.1.330, using `claude-sonnet-4-6` with the
`same-uid-key` relay.

The separate sealed Group 3.1 trials at repair SHA
`9b909f9467ddea6b12f7ca77f959f39ef01e2702` qualified fresh read-only candidate
review with those reviewer pins, `dontAsk` permissions and `Read` as the sole
tool. The trials paired that reviewer with dedicated Codex 0.171.0, GPT-6.2-sol
and native named workspace-write for synthetic Task-Guided and Goal-First
changes on one Linux host. The evidence is bound to that runtime, host and
role pair. Other hosts, clients, versions and provider routes require matching
qualification.
[Paired runtime and role bindings](worker-runtime.md).

Select a route under the project's approved reviewer procedure and obtain the
separate per-run grant before any future live review or probe. Operator setup
details are in the source repository’s `docs/claude-reviewer.md`.

## Retained inputs

The request is strict JSON. The outer fields are `schemaVersion` (1), `mode`,
`session` (fresh UUID), `worker` (the portable read-only worker request),
`snapshot`, `attachments` (workspace-relative path to SHA-256 map), and
`limits` (an object with integer `diffBytes` from 256 through 65536). Use the
portable worker identity, authority and required restrictions. The output
directory must be a declared `worker.evidenceRoots` entry. Completed candidate handoffs
provide the required `native.txt` and `lifecycle.jsonl` captures.

- Candidate snapshot fields are `base`, `target`, `plan` (full Git commit
  identities), `planDigest`, `diffSha256` and `gates`. Each gate carries
  `command` (descriptive evidence text), `commit` (exact target), `exitCode`
  (0), and `evidence` (a path in the attachment inventory). The canonical diff
  is Git's full-index text patch with three context lines, no external diff,
  text conversion or indentation heuristic, and 50% rename detection. The
  changed paths, exact plan files and all required context are packed together
  under both diff and whole-file scope limits. A deletion includes its base
  file and a rename includes both sides. For a record-only archive closure,
  review the exact closure target and immediate active predecessor. The
  complete change must move to one canonical dated archive for the same
  identity with identical bytes and modes, including task ticks. Pin any
  newly authorized archive JSON receipt as an attachment. Review exports
  keep frozen planning inputs in active-path coordinates and the actual
  diff in its committed paths.
- Approach snapshot fields are `record` (the retained charter-v1 convergence
  record), `correction` (null or the verified correction), `authority`
  (`reference`, `write`, `validate`, `review`), and `priorLaunches` (empty or
  one retained `request`, `expect`, `export`, `output` path set). Bind the raw
  plan input hashes and the fixed model, charter and ledger.

The independent expectation has `schemaVersion` (1), `requestSha256`,
`exportSha256`, `configurationSha256`, and `model`. Compute JSON hashes
over compact JSON with recursively sorted object keys and a final LF.
Review the approved request and pin its hash before preparation. A null
`exportSha256` is allowed only for preparation. Independently retain the
approved manifest hash for subsequent calls, then retain the run's
`statusSha256` in the expectation for verify. Retain the expectation through
a separate authority from the publisher. Replaying with a hash computed
from an already suspect output cannot establish authenticity.

## Trusted launch configuration

For a new explicitly qualified binding, use the schema 2 host produced by
`scripts/setup.mjs`. Retain the raw file hash, separately pinned
`expect.qualification`, and `expect.generator` provider and session.
Offline `--prepare` and `--check` return the explicit runtime readback.
Bind it as `expect.explicit` and include its scope in a separate single-run
grant before execution. Sealed replay checks the retained readback,
complete native Read content and framed receipt.

The legacy host configuration has `schemaVersion` (1), `bwrap`, `claude`,
and `node` pins (`path` and `sha256`), `libraries` (pins with exact absolute
sandbox `target` paths), `model`, `relay`, `timeoutMs`, `maxTurns`,
`maxBudgetUsd`, and `requirePreExposureAttestation` (false for this route).
The runtime is Linux with working namespaces, Python 3 with pidfd support,
Bubblewrap 0.9.0, and Claude Code 2.1.330. Use absolute regular-file pins and
the minimal runtime dependencies. The automatic probe precedes exposure.
The data-bearing audit confirms startup and coverage after that process runs.

The `same-uid-key` relay selects `keyFile` and `keyFormat` explicitly. `raw`
requires a host-owned single-link 0400 regular file containing only the key.
`assignment` requires a host-owned single-link 0600 regular file containing
one literal `ANTHROPIC_API_KEY` assignment, optionally exported and quoted.
Other assignments are ignored as text. The relay keeps the key host-side.
Same-UID filesystem protections rely on the sandbox and trust in host-side
processes for that UID. The `dedicated-uid-broker` route selects `socket` and
`ownerUid` for the separately operated, pinned inference service. Scoped
OAuth fails closed under this release's pinned inference and startup policy.
Alternative routes require independent qualification.

The sandbox exposes private scratch, the read-only packet and runtime, and
the approved Unix socket. The relay socket lives in short owner-private
temporary scratch separate from the output, with a UTF-8 path shorter than
108 bytes. The runner checks path length and privacy before binding and
removes owned scratch after process and relay settlement. Review evidence
stays at its approved destination. Startup must report only `Read` as a tool and empty
plugin, MCP, skill and slash-command inventories. Native agent labels may
appear as startup metadata. Agent invocation and child activity fail the
audit. Every assigned file must have a successful whole-file `Read`.

## Pi qualification trial

The optional route is exact Pi 1.5.2, `grok-4.7`, `xai-oauth`, thinking `off`
and `hermes-proxy-xai-oauth`. It uses the same namespace and read-only packet
boundary with a pinned release-only snapshot and Node entry point. The only
native tool is `read`. The host broker owns the OAuth credential lifecycle.
The relay validates chat-completion requests and streamed frames, caps the
invocation at 96 requests and keeps upstream diagnostics host-side. The
supervisor settles the process tree by the configured deadline. Audit matches
parallel tool results by call ID and verifies the full bytes of every assigned
file and the mode-specific framed receipt. Grok 1.0.92 remains unsupported
because its `streaming-messages-json` route has no verified host-only xAI OAuth
routing through `inference.sock`.

For the Pi trial, use independently sealed offline controls for the exact
package, schema 2 host, runtime constraints, role, release and relay pins. The
offline control record uses `kind: "offline"` and the qualification subject,
effective identity, supervisor and controls defined by
`scripts/adapter-qualification.mjs`. Its controls include
`finiteRelayRequestsAndDeadline` and `parallelWholeFileResults` in addition to
the contained reviewer controls. The synthetic fixture suite and retained
native Pi replay establish offline behavior on synthetic data. Qualification
also requires separately observed correct behavior on the intended host.

The separate `standalone-review-probe` grant binds `explicitRuntimeSha256` to
the SHA-256 of the canonical JSON bytes of `runtimeBinding(...).explicit`,
including the offline control hash. Use `requireReviewHost` with that offline
pin, the raw configuration hash and current `runtimeIdentity()` to derive the
binding. Hash it using `hash(jsonBytes(explicit))` from `review-inputs.mjs`.
The grant also binds one invocation, the raw host hash, cost bound and ledger
as in the standalone example above. The first command consumes that grant and
runs the two-file synthetic trial. The second reads back the original sealed
trial offline. Set `review_cli` to the absolute packaged script path.

```sh
node "$review_cli" --probe --host-config "$HOST" --admission "$PROBE_GRANT" --output "$TRIAL_OUTPUT" --tier1-offline "$OFFLINE" --tier1-offline-sha256 "$OFFLINE_SHA256"
node "$review_cli" --verify-tier1-trial --host-config "$HOST" --output "$TRIAL_OUTPUT" --tier1-offline "$OFFLINE" --tier1-offline-sha256 "$OFFLINE_SHA256" --status-sha256 "$STATUS_SHA256"
```

Retain the independently observed status hash and original captures. After a
successful replay, the independent supervisor records actual live positive and
negative controls, the approval reference and attempt, `trialStatus` (the
sealed `status.json` file pin), and `trialGrantSha256` (the grant digest from
the status, over canonical grant JSON bytes). Seal this live file and the
matching offline file under the `explicit-route-qualification` manifest with
route `pi-bubblewrap-read-only`. Bind the manifest in `expect.qualification`
and the returned explicit runtime readback in `expect.explicit` before candidate
or approach review. Each review requires its own authority and a generating
provider and session independent of the reviewer. Claude host and archive
pins continue to replay with their original schemas.

## Readback and decisions

Mode runs retain indexed stdout, stderr and supervisor metadata under
`raw/` in the publisher output. Index 0 is the automatic probe. A standalone
probe writes its captures and `status.json` directly under its output root.
Mode runs seal `request.md`, `result.json`, `status.json`, and the extracted
`native.txt` plus `lifecycle.jsonl` for a completed candidate, or `report.md`
for approach or failure outcomes. Keep all files and the independent status hash.
A failed automatic probe retains its raw captures and prevents packet launches.
Runtime and receipt failures retain available bytes with a nonzero CLI exit. An interrupted or partial
output without the complete verified status is inadmissible. Use fresh
directories for any authorized successor.

Candidate replay preserves packet verdicts, findings and limitations, and
checks completed candidate results through the portable `readHandoff`.
Only a complete literal no-findings candidate with zero limitations can
satisfy the existing candidate acceptance rules. A rejected candidate
receipt seals `receipt-invalid`, the one-based packet number, packet hash,
expected target and packet session. Replay verifies the same rejection
using the retained stream and export. Approach replay returns
charter admission with ledger changes, preserving advisory findings,
deferrals and packet-gap handling. A verified malformed receipt can be
referenced once with a fresh session and predecessor on the same binding,
subject to the existing convergence decision. The retry consumes zero
correction cycles. A packet-gap decision remains the charter's separate
packet repair path.

## Adopting integrated parents

The runner re-reads the verified frozen plan parent. Supply `request.policy`
with `parent` and independently verified integrated `target`. Draft
requests also supply `policy.planningModes` as the exact map of inventory
paths to Git modes and run in the verified draft or frozen predecessor.
Candidate requests exporting a record-only closure may list approved receipt
hashes in `snapshot.archiveEvidence` to verify closure without including
reserved evidence files in provider exports. Keep original sealed attempts
under their legacy schema and bindings.

For adopted policy, add `--host-config HOST` to both `--prepare` and
`--check`. The offline commands do not read keys or invoke a probe. They
verify the exact raw-byte `configurationSha256` and report a failing packet
if its manifest requires more than `maxTurns - 10` whole-file reads. Packet
feasibility requires `maxTurns >= 11` to preserve the ten-turn reserve.
Retain all changed preimages, postimages and hunks within the selected
coverage. Recheck the same manifest and configuration at live entry.
A configured local harness requires a candidate-bound attachment named in
`snapshot.harness` and an independent `expect.harness: {file, sha256}`
reference in the private host expectation. Keep the original seal in a
private host-owned directory and keep its path out of requests, exports and
worker evidence. Preparation, offline checks and live admission compare
the attachment bytes with the retained seal and verify its
schema-version-2 harness ID, candidate, configuration digest, executable
digest, result digest and freshness. The executable must still match the
pin in the exact host configuration.

The prepared export checks the canonical repo-relative `fileAcceptance` entries `{packet, path, criterion}` against
their actual one-based packet. Keep common criteria in `worker.acceptance`.
Each prompt includes only its scoped criteria and requires canonical
repository-relative finding paths.

Use `--admission ADMISSION` with the live mode command under adopting
policy. The private external JSON contains `schemaVersion: 1`, the raw
`configurationSha256`, the stable private host-owned `ledger` directory,
`phase` and its verified `phaseGrant`. The grant binds change, phase,
policyRevision, canonical request hash and the separate phase authority
reference. Use `policy.finishReference` to bind a finish-phase request to
its named protected finish grant. The default is `auto-approved` within
the integrated phase list and cap ceilings. The host can lower `caps`
(`maxReviews`, `maxTotalUsd`) or select the `explicit` per-run override
with an `explicitGrant`. The automatic upper bound counts the per-launch
`maxBudgetUsd` for the probe and every applicable packet. A stable
per-change ledger record is committed before runtime or inference and
holds the count and full amount across phases and resumes. In `explicit`
mode grant one exact target, scope, export, config and cost. Retrying an
attempt needs its own `retryGrant`. Use the original single-run authority
procedure for legacy parents. Standalone diagnostic probes use the separate
probe grant above.
A refused automatic claim grants no fallback.

New setup uses 96 turns and defaults to USD 2.50 per invocation. Preserve
the raw pin for an existing host. For automatic candidate execution under a
verified parent, use the direct Node command with `--operator-key KEY
--operator-key-sha256 SHA256` to bind the independently supplied operator
verification key. An offline `--check` with those options and the usual
host and admission files reads the existing `ledgerIdentity`. To consume an
operator-signed grant, add `--budget-extension GRANT` to the authorized
launch. The host verifies the Ed25519 signature over the canonical grant,
the exact change, plan commit and digest, integrated parent, approval and
execution references, existing ledger identity, lower caps and validity
window. The ledger seals the grant once with its first reservation, subject
to the integrated ceilings. Later execution launches use only the key options
with the same approved identity and lower caps to apply the retained grant
until expiry. Every prior charge or hold carries forward.

Optional `packetConcurrency` is an integer from 1 through 3 and defaults to 1.
For 2 or 3, pin the raw host bytes and retain the same `packetConcurrency`
in the independent expectation. This route requires durable reservation
for the automatic probe and all packets, and uses one scratch directory,
private same-UID relay and supervised process per invocation. A dedicated
UID broker is eligible only for the legacy serial route. The automatic
probe must pass and settle before any packet starts.

Optional `interPacketDelayMs` (0–30000) and `runTimeoutMs` (1000–3600000)
are part of the host pin. At concurrency 1 the delay starts after settlement
and applies before a successor. At 2 or 3 the delay spaces packet launches
within the same run deadline. Same-UID relay HTTP 429, 529 and 401/403 map
to allowlisted private failure classes. The sandbox receives the generic
refusal. A failure stops queued launches and drains active siblings.
Sealed status records launch, halt and settlement order, and offline
verification audits every retained capture by packet identity. Acceptance
requires all packets to verify. A failed run requires separate retry authority.
