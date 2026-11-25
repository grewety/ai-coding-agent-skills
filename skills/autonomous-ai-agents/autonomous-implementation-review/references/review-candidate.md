# Contained Claude review command

Use this opt-in transport for candidate or charter-v1 approach exports under
separate authority for the exact export and paid inference. Use an independently
retained request, runtime and export binding, then replay the sealed handover
offline. Apply the existing candidate or charter admission rules before any
delivery decision. Run the standalone Linux command by absolute path with
Node 22 or later. Keep the export, publisher output and trusted host
configuration outside the reviewed checkout and separate from each other. Use a
private, existing parent for new directories. The command reports execution
and receipt admission. The orchestrator retains authority for plan approval,
candidate acceptance, task state and publication.

```text
node review-candidate.mjs --prepare --request REQUEST --expect EXPECT --export EXPORT
node review-candidate.mjs --check --request REQUEST --expect EXPECT --export EXPORT
node review-candidate.mjs --probe --host-config HOST --admission PROBE_GRANT --output PROBE_OUTPUT
node review-candidate.mjs --mode candidate --request REQUEST --expect EXPECT --export EXPORT --host-config HOST --output OUTPUT
node review-candidate.mjs --mode approach --request REQUEST --expect EXPECT --export EXPORT --host-config HOST --output OUTPUT
node review-candidate.mjs --verify --request REQUEST --expect EXPECT --export EXPORT --output OUTPUT
```

All uppercase substitutions are absolute paths. Prepare reads the approved
inputs, writes a fresh export and returns its manifest SHA-256. Check validates
the current inputs and every sealed manifest member offline. Probe makes a
bounded inference call with a synthetic prompt and empty export. Either mode
makes an automatic separate probe, then sends only the assigned packet data
under the matching launch policy. The mode lines are alternatives. For offline
verify, reuse the same request, sealed export and original absolute `OUTPUT`
path bound to that run's request. Verify reads the complete sealed handover
and replays the native stream and receipt checks offline. Obtain a separate
explicit grant for the approved export and paid inference before either
live mode or a standalone probe.

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

The separate host configuration has `schemaVersion` (1), `bwrap`, `claude`,
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
A configured local harness requires its candidate-bound sealed attachment
name in `snapshot.harness`. The prepared export checks the canonical
repo-relative `fileAcceptance` entries `{packet, path, criterion}` against
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

Optional `interPacketDelayMs` (0–30000) and `runTimeoutMs` (1000–3600000)
are part of the host pin. The bounded delay applies only before a successive
packet and consumes the same run deadline. Same-UID relay HTTP 429, 529
and 401/403 map to allowlisted private failure classes; the sandbox receives
the same generic refusal. Classification alone supplies no retry or
acceptance. The separately operated dedicated broker interface needs its
own qualification and private diagnostic evidence.
