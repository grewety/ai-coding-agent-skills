# Contained reviewer

See [external AI roles and backend pilots](configurable-backends.md) for explicit role settings and the
[observed backend suitability matrix](configurable-backends.md#observed-backend-suitability).

The optional `autonomous-implementation-review` 0.24.0 skill and
`autonomous-orchestration` 1.14.0 bundle ship a standalone command for candidate
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

Claude remains the default. The explicit Pi 1.5.2 route has offline evidence
against synthetic inference and needs matching live host qualification before
real review. Grok 1.0.92 is unsupported. The credential-free investigation
left host-only xAI OAuth routing for `streaming-messages-json` through
`inference.sock` unverified, so admission refuses the route before export
exposure. No live xAI call was made with Grok. The only permitted fallback
for this change is Pi through Hermes proxy xAI OAuth under a separate trial grant.

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
  settings. New setup uses 96 turns and defaults to USD 2.50 per invocation.
  Keep the exact host pin for an existing change. Account for the probe and
  every packet when granting spending.
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

## Prepare and qualify the Pi route

Prepare these inputs on the trusted host outside the checkout, exports, output,
ledger and live profiles. Use the same private directory protections as the
Claude route. Pass the resulting pins through the external role setup preview
and confirm the exact preview only under operator authority.

1. Stage the existing, independently verified `@earendil-works/pi-coding-agent`
   1.5.2 release and its runtime dependencies in a release-only directory. Its
   sole top-level entry is `node_modules`. Include the package metadata and
   `dist/bundle/cli.js`. Use canonical paths, trusted ownership and no group or
   other write bits. Use only internal relative symlinks. `REVIEW_SCRIPTS` is
   the absolute packaged scripts directory and `PI_RELEASE` is the absolute
   directory containing `node_modules`. This command reads the release and
   prints the pin for `reviewer.runtime.piRelease`.

   ```sh
   node --input-type=module -e '
     const { piReleaseInventory } = await import(process.argv[1] + "/agent-pi-runtime.mjs");
     const path = process.argv[2];
     console.log(JSON.stringify({ path, ...await piReleaseInventory(path) }));
   ' "$REVIEW_SCRIPTS" "$PI_RELEASE"
   ```

   Pin the Pi executable as provenance in `roles.reviewer.executable` and
   select `client: "pi"`, `provider: "xai-oauth"`, `model: "grok-4.7"`,
   `reasoningEffort: "off"`, `transport: "unix-socket"`, `versionPolicy: "exact"`,
   `versionCheck: true` and `exactVersion: "1.5.2"`. The sandbox runs the
   fixed release entry from a verified read-only snapshot with the pinned Node
   and libraries. It mounts `/review` read-only and uses disposable state,
   disabled ambient discovery and only `read`. The host relay caps requests at
   the schema 2 host's `maxTurns: 96` and the supervisor applies `timeoutMs`.

2. Provision a trusted host-side broker for the selected Hermes xAI OAuth
   backend. It must serve streamed `POST /v1/chat/completions` for `grok-4.7`
   on a canonical `hermes-xai.sock` owned by the invoking UID, mode `0600`, in
   a directory owned by that UID, mode `0700`. Authenticate upstream and keep
   the credentials and refresh state entirely on the host. An HTTP health
   response or a local SSE test establishes only transport behavior. Verify
   upstream protocol and OAuth identity separately. The review runner verifies
   socket identity and forwards only allowed inference. The isolated process
   receives the separate per-invocation `inference.sock`.

   With `HERMES_SOCKET` set to the absolute broker socket path, read its pin:

   ```sh
   node --input-type=module -e '
     const { lstat } = await import("node:fs/promises");
     const path = process.argv[1];
     const stat = await lstat(path, { bigint: true });
     if (!stat.isSocket()) throw Error("Expected the host Hermes proxy socket");
     console.log(JSON.stringify({ path, device: String(stat.dev), inode: String(stat.ino) }));
   ' "$HERMES_SOCKET"
   ```

   In setup choose `reviewer.relay.route: "hermes-proxy-xai-oauth"` and a
   nonsecret `credentialRef`. Store the relay JSON with `schemaVersion: 1`,
   the same `route` and `credentialRef`, and the socket pin as `upstreamSocket`.
   Pin its exact bytes and path as `reviewer.runtime.relayConfiguration`.
   A re-created socket changes its inode and requires a matching new pin and
   evidence for the changed binding.

3. Retain independent offline control evidence for the exact released package,
   raw schema 2 host bytes, runtime constraints, role and relay. Use the
   [packaged trial procedure](../skills/autonomous-ai-agents/autonomous-implementation-review/references/review-candidate.md#pi-qualification-trial)
   with the separate synthetic one-run grant. Replay the sealed trial offline
   and retain the independent status hash, canonical grant digest and complete
   captures. The live proof must identify the approved Hermes OAuth route and
   record actual containment, credential custody, request/deadline bounds,
   whole-file parallel coverage and strict receipt replay. A matching sealed
   qualification plus independently pinned `expect.explicit`, `expect.generator`
   and `expect.qualification` are required before running a real review.

## Prepare, run and verify

Use the [packaged CLI reference](../skills/autonomous-ai-agents/autonomous-implementation-review/references/review-candidate.md)
for the exact request, expectation and host schemas. In candidate mode, bind
the exact base, target, plan, canonical diff and passing gate evidence. Review
changed whole files, including deleted and renamed sources, plan inputs and
approved attachments. In approach mode, bind the raw plan inputs, charter-v1
record, correction if present, authority, fixed model and ledger. Use a fresh
reviewer session and a declared publisher evidence root.

For an explicitly qualified reviewer, use the setup-produced schema 2 host and
independently pin the qualification manifest as `expect.qualification`
(`path` and `sha256`). Also pin the generating `provider` and `session` in
`expect.generator`. The candidate generator is the settled Implementer.
The planning generator is the author. Retain the `explicit` runtime readback
from `--prepare` or `--check` in the independently held expectation before
launch. Use a separate single-run grant for the exact readback, export,
scope and cost. For an explicit standalone probe, pass
`--qualification PATH --qualification-sha256 SHA` and bind the canonical
runtime readback hash as `explicitRuntimeSha256` in the probe grant.
Replay uses the retained expectation, export and captures, including the
original version audit. Older runs use their original bindings.

Use Node 22+ and substitute the absolute packaged
`scripts/review-candidate.mjs` path in each command. Use absolute paths for the
uppercase operands. The mode examples apply to adopting integrated policy. Include
`--host-config HOST` on `--prepare` and `--check` for these requests. Run a
live mode only within the exact review authority verified by `ADMISSION`.
For Codex Auto-review, run the mode line directly as a standalone Node command
with platform permission checks in effect.
The mode lines are alternatives. For each run, `OUTPUT` is a fresh absolute
path declared in that request's `worker.evidenceRoots`. Use the same request,
sealed export and original `OUTPUT` path for `--verify`.

```text
node review-candidate.mjs --prepare --request REQUEST --expect EXPECT --export EXPORT
node review-candidate.mjs --check --request REQUEST --expect EXPECT --export EXPORT
node review-candidate.mjs --probe --host-config HOST --admission PROBE_GRANT --output PROBE_OUTPUT
node review-candidate.mjs --mode candidate --request REQUEST --expect EXPECT --export EXPORT --host-config HOST --admission ADMISSION --output OUTPUT
node review-candidate.mjs --mode approach --request REQUEST --expect EXPECT --export EXPORT --host-config HOST --admission ADMISSION --output OUTPUT
node review-candidate.mjs --verify --request REQUEST --expect EXPECT --export EXPORT --output OUTPUT
```

1. Independently approve and pin the request and host configuration hashes.
   The request digest is compact JSON with recursively sorted object keys
   and a final LF. The host pin for adopting policy hashes raw file bytes.
   Legacy review records keep their original configuration identity. For
   initial preparation, set `exportSha256` to null. Offline `--prepare` creates
   a sealed export and reports its manifest hash. Inspect the whole manifest,
   file bytes and packet scopes. Retain the approved hash in the independent
   expectation, then use offline `--check` to confirm the sealed inventory and
   packet count. Set `maxTurns >= 11` for low-touch packet feasibility.
   Each packet can assign at most `maxTurns - 10` whole-file reads. Legacy
   hosts accept 1–128 for standalone probes and retained runs. Configure optional `interPacketDelayMs`
   from 0 to 30000 and `runTimeoutMs` from 1000 to 3600000 in the pinned host.
   Optional `packetConcurrency` accepts integers 1 through 3 and defaults to 1.
   For 2 or 3, pin the raw host bytes, match the value in the independent
   expectation, and use the same-UID relay and durable full-run admission.
   Each invocation gets a separate relay, scratch directory and supervised
   process. Pacing applies between settlement and the next serial packet,
   or between launches for concurrent packets.
2. With a separately authorized `PROBE_GRANT`, `--probe` first reserves the
   approved host configuration and single-invocation cost in the host-owned
   ledger. It then sends a synthetic prompt with an empty packet and records
   `probe-passed` or `probe-failed` with separate captures. For
   each approved mode run, use a fresh output root and an expectation without
   `statusSha256`. The mode run performs its own separate probe before sending
   any packet. The native audit checks the model and session, the pinned
   startup inventory, and 100% whole-file coverage for every assigned packet.
   Claude offers only `Read` with empty plugin, MCP, skill and slash-command
   inventories. Pi offers only `read` and the audit matches each parallel
   result to its call ID and exact file bytes.
   After a failure, active siblings settle and queued packets stop. Offline
   verification checks the sealed launch and settlement order and each
   packet's capture. A failed or incomplete run cannot be accepted.
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
