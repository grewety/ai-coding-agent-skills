# Contained Claude reviewer

The optional `autonomous-implementation-review` 0.21.0 skill and
`autonomous-orchestration` 1.11.0 bundle ship a standalone command for candidate
review and charter-v1 approach review. Use the complete package from a reviewed
checkout or the [Claude installation guide](claude-installation.md). Resolve
`scripts/review-candidate.mjs` inside that package. This command runs locally
from a terminal and requires neither account skill sync nor a plugin loaded
in the reviewer process.

## Supported binding

The recorded Linux/WSL qualification at
`4eddbade12fab2a032755a446f9176005b7b04a1` used Bubblewrap **0.9.0**,
Claude Code **2.1.330**, `claude-sonnet-4-6` and the `same-uid-key` relay.
Qualification follows the exact published role and host settings.
Use the [worker runtime](worker-runtime.md) for exclusive worker pairing
and [review configuration](openspec-review-configuration.md) for policy,
approved exposure and single-run exceptions.

## Host setup and credential routes

- Use Linux (or WSL with the required Linux facilities), working Bubblewrap
  namespaces, Python 3 with pidfd support, Node 22+ and Git for candidate
  preparation. The command checks Bubblewrap **0.9.0** and audits Claude Code
  **2.1.330**. Use known runtime binaries and minimal required shared libraries.
- Keep trusted host configuration, reviewed checkout, export, publisher output
  and independent expectations separate. Use private, existing parents for
  fresh output and export directories. Use absolute paths throughout. The
  runner allocates separate private runtime scratch and checks the Unix socket
  path in UTF-8 bytes before binding. Teardown keeps the retained review output.
- In the schema-version-1 host JSON, pin the absolute `bwrap`, `claude` and
  `node` binaries by `path` and SHA-256. Pin each entry in `libraries` by
  source path, SHA-256 and exact sandbox `target`. Use regular files owned by
  the caller or root and protected from group/other writes. Bind the exact
  `model` and explicit `relay` to the approved configuration. Set
  `timeoutMs` (1,000–300,000), `maxTurns` (1–128) and `maxBudgetUsd`
  (greater than zero, up to 10) within the live grant. These are per-launch
  settings. Account for the probe and every packet when granting spending.
- Set `requirePreExposureAttestation` to false only if policy permits a
  synthetic probe followed by a post-run audit of each data-bearing process.
  If policy requires attestation of that process before exposure, stop.

| Route | Host configuration and qualification |
| --- | --- |
| `same-uid-key` | Relay used in the historical standalone trial and the exclusive Linux pair. Set `keyFile` and `keyFormat` explicitly. Use a host-owned single-link 0400 regular file with only the key for `raw`, or a host-owned single-link 0600 regular file with one literal `ANTHROPIC_API_KEY` assignment for `assignment`. The relay parses text without sourcing it and keeps the key host-side. Same-UID protection depends on isolation and trust in host processes running under that UID. |
| `dedicated-uid-broker` | Implemented interface pending independent qualification. Set `socket` to an absolute `inference.sock` and `ownerUid` to the distinct non-root broker UID. The socket must be mode 0660 and its parent must be owned by that UID and protected from group/other writes. The separately operated broker needs its own route and policy evidence. |
| `scoped-oauth` | Unavailable under the pinned inference and startup constraints. The command rejects the route. Ambient login, cloud-provider sign-in and account sync are unqualified. |

The sandbox exposes the assigned export packet and pinned runtime read-only,
private writable scratch and the approved Unix socket. It leaves the original
checkout, Git metadata, live home/config, credential files and publisher output
outside. The same-UID relay sends approved Anthropic inference traffic over
verified TLS. Provider exposure includes the review prompt and the full files
read from the packet. Approve those bytes before launch and keep secrets and
unrelated context out of the export, including gate attachments and old file
versions. Treat raw captures and extracted reports as sensitive review data.

## Prepare, run and verify

Use the [packaged CLI reference](../skills/autonomous-ai-agents/autonomous-implementation-review/references/review-candidate.md)
for the exact request, expectation and host schemas. In candidate mode, bind
the exact base, target, plan, canonical diff and passing gate evidence. Review
changed whole files, including deleted and renamed sources, plan inputs and
approved attachments. In approach mode, bind the raw plan inputs, charter-v1
record, correction if present, authority, fixed model and ledger. Use a fresh
reviewer session and a declared publisher evidence root.

Replace uppercase operands with absolute paths, including `REVIEW_CLI` for
the packaged script and `NODE` for Node 22+. These examples describe the
command's effects. Run live forms only within the applicable exact review
authority. For adopting plans add `--host-config HOST` to the two offline
commands and `--admission ADMISSION` to the mode command.
The mode lines are alternatives. For each run, `OUTPUT` is a fresh absolute
path declared in that request's `worker.evidenceRoots`. Use the same request,
sealed export and original `OUTPUT` path for `--verify`.

```text
NODE REVIEW_CLI --prepare --request REQUEST --expect EXPECT --export EXPORT
NODE REVIEW_CLI --check --request REQUEST --expect EXPECT --export EXPORT
NODE REVIEW_CLI --probe --host-config HOST --output PROBE_OUTPUT
NODE REVIEW_CLI --mode candidate --request REQUEST --expect EXPECT --export EXPORT --host-config HOST --output OUTPUT
NODE REVIEW_CLI --mode approach --request REQUEST --expect EXPECT --export EXPORT --host-config HOST --output OUTPUT
NODE REVIEW_CLI --verify --request REQUEST --expect EXPECT --export EXPORT --output OUTPUT
```

1. Independently approve and pin the request and host configuration hashes.
   The request digest is compact JSON with recursively sorted object keys
   and a final LF. The host pin for adopting policy hashes raw file bytes.
   Legacy review records keep their original configuration identity. For
   initial preparation, set `exportSha256` to null. Offline `--prepare` creates
   a sealed export and reports its manifest hash. Inspect the whole manifest,
   file bytes and packet scopes. Retain the approved hash in the independent
   expectation, then use offline `--check` to confirm the sealed inventory and
   packet count. The bound `maxTurns` allows at most `maxTurns - 10` assigned
   whole-file reads per packet. Configure optional `interPacketDelayMs`
   from 0 to 30000 and `runTimeoutMs` from 1000 to 3600000 in the pinned host.
2. With live authority, `--probe` sends a synthetic prompt with an empty packet,
   and records `probe-passed` or `probe-failed` with separate captures. For
   each approved mode run, use a fresh output root and an expectation without
   `statusSha256`. The mode run performs its own separate probe before sending
   any packet. It checks the model and session, only `Read` in the tool
   inventory, empty plugin, MCP, skill and slash-command inventories, and 100%
   successful whole-file Read coverage for every assigned packet.
3. Retain the reported `statusSha256` independently and add it to the
   expectation used for offline `--verify`. Keep the sealed export, request,
   expectation and complete output. Mode output contains raw captures under
   `raw/`, separate extracted `native.txt` and `lifecycle.jsonl` for a
   completed candidate or `report.md` otherwise, and sealed `request.md`,
   `result.json` and `status.json`. Replay checks bytes, inventories,
   runtime and session identities, and receipt admission. A successful replay
   can describe a failed launch, so inspect the returned phase and result.
4. Apply the existing [OpenSpec review rules](openspec-workflow.md). Candidate
   acceptance still requires a complete literal no-findings verdict with zero
   limitations. Approach admission retains the charter's ledger, findings,
   deferrals and packet-gap decisions. The command always reports
   `deliveryAccepted: false`. The orchestrator decides task state and delivery
   under the existing authority.

## Troubleshooting

- **Delivery reports a pending probe or result review.** Use the read-only
  delivery preflight for P4/P5 and P8 evidence, and reconcile the exact candidate,
  configuration and handover bindings. A verified adopting parent can grant
  bounded automatic mode. Every retry needs distinct authority.
  [Delivery runtime](../skills/software-development/openspec-delivery/references/delivery-runtime.md).
- **Preparation or check rejects the export.** Check absolute path separation,
  private parent ownership, fresh directory names, exact Git and input
  identities, and every manifest member. Whole files are capped at 64 KiB and
  a packet is capped at 96 files and 512 KiB. Resolve scope or identity errors
  with the approving authority. Keep whole-file coverage and retain the new
  approved binding if inputs change.
- **Probe or startup fails.** Inspect retained stdout, stderr and capture
  metadata for namespace or pidfd support, runtime hash and version mismatches,
  missing library mounts, broker ownership or permissions, and unexpected
  startup inventory. Keep containment and pins in force. Stop if the approved
  route cannot run and seek separate authority for any successor launch.
- **Runtime or receipt fails.** A failed probe, runtime failure or invalid
  receipt exits nonzero. Preserve the complete sealed output where available.
  An interrupted or partial output cannot establish acceptance. The same-UID
  relay retains only allowlisted upstream status classes in private evidence.
  Provider response details stay outside the sandbox.
  A candidate receipt rejection records `receipt-invalid` and the offending
  packet with its captures. Offline verification reproduces the rejection.
  One verified malformed approach receipt can be retried under the existing
  zero-correction-cycle convergence decision with a fresh session and output,
  matching binding and retained predecessor. A packet gap follows the
  charter's repair path. Neither outcome grants another paid launch.
- **Offline replay fails.** Compare the independently retained status hash,
  request, configuration, model and manifest bindings against the original
  retention record. Preserve the failed artifacts. Recomputing a hash from
  suspect output cannot recover its authenticity.
