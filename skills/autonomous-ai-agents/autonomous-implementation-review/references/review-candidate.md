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
node review-candidate.mjs --probe --host-config HOST --output PROBE_OUTPUT
node review-candidate.mjs --mode candidate --request REQUEST --expect EXPECT --export EXPORT --host-config HOST --output OUTPUT
node review-candidate.mjs --mode approach --request REQUEST --expect EXPECT --export EXPORT --host-config HOST --output OUTPUT
node review-candidate.mjs --verify --request REQUEST --expect EXPECT --export EXPORT --output OUTPUT
```

All uppercase substitutions are absolute paths. Prepare reads the approved
inputs, writes a fresh export and returns its manifest SHA-256. Check validates
the current inputs and every sealed manifest member offline. Probe makes a
bounded inference call with a synthetic prompt and empty export. Either mode
makes an automatic separate probe, then sends only the assigned packet data
under the matching launch policy. Verify reads the complete sealed handover
and replays the native stream and receipt checks offline. The two launch
forms require explicit permission for data exposure and provider use.

Standalone probe and both launch modes can incur charges. The packaged live
trial is pending task 3.1. An earlier interim launcher probe and synthetic
fixtures provide no qualification of this package or alternative routes.
Keep the existing approved review route until the selected package and credential
route are qualified.

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
  file and a rename includes both sides.
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
the approved Unix socket. Startup must report only `Read` as a tool and empty
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
satisfy the existing candidate acceptance rules. Approach replay returns
charter admission with ledger changes, preserving advisory findings,
deferrals and packet-gap handling. A verified malformed receipt can be
referenced once with a fresh session and predecessor on the same binding,
subject to the existing convergence decision. The retry consumes zero
correction cycles. A packet-gap decision remains the charter's separate
packet repair path.
