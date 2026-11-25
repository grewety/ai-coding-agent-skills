# OpenSpec review and finish configuration

Read the [workflow](openspec-workflow.md) for authorization and the
[operator tutorial](openspec-operator-tutorial.md) for the role and session
setup. The exact frozen plan's verified integrated parent governs these
settings. Changing a branch or host configuration cannot adopt a new policy
for work already governed by an earlier parent.

## Contained review mode and budget

The following root contributor-contract marker enables schema-agnostic
planning inventory, task-completion child admission and bounded reviews for
later plans. The defaults are shown explicitly. An empty object selects
these same values.

```html
<!-- openspec-low-touch: {"mode":"auto-approved","maxReviews":10,"maxTotalUsd":25,"phases":["planning","execution","finish"],"standingTriggers":[]} -->
```

`maxReviews` is a positive integer count and `maxTotalUsd` is a positive USD
amount with at most six decimal places. The count and cost are shared across
the change and all configured phases. A host-owned per-run
`"caps":{"maxReviews":3,"maxTotalUsd":8.50}` lowers the limits on admission.
An omitted cap uses the built-in default up to the integrated ceiling.
Increasing integrated ceilings requires an integrated policy revision for
later changes. Use `"mode":"explicit"` in the integrated marker to require
one distinct grant for every run, or place `"mode":"explicit"` in the
host admission file for one run under automatic policy. Every review mode
uses the integrated phase allowlist. A parent without
the marker follows its existing single-run approval and exact-head rules.
A denied automatic attempt stops at that bound.

Keep `host.json`, independently retained expectations and the admission
file outside the repo, review checkout and reviewer data. In adopting
policy, `configurationSha256` is the SHA-256 of the actual `host.json`
bytes, including whitespace and final newline. Pin it in the independently
retained expectation and the external admission file. Read back which
phase and applicable planning, local execution or finish authority covers
the run. `finish` requests bind `request.policy.finishReference` to the
retained finish grant. Review authorization has no effect on approval,
implementation, publication, profile sync or retries.

The following admission shape selects automatic mode by omission. Replace
the SHA and references with verified values for one exact run. Use one
stable host-owned mode-0700 ledger per repository across sessions and
phases. For explicit mode add a distinct `explicitGrant` with kind
`contained-review-single-run`, verified status, reference, `runs: 1` and all
fields from the computed spend scope. A retry additionally requires its own
same-scope `contained-review-retry` record. New contexts on a previously
reviewed exact target require retry authority for that purpose.

```json
{
  "schemaVersion": 1,
  "configurationSha256": "<raw host.json SHA-256>",
  "ledger": "/var/lib/operator/review-ledger/project",
  "phase": "execution",
  "caps": { "maxReviews": 3, "maxTotalUsd": 8.50 },
  "phaseGrant": {
    "kind": "contained-review-phase",
    "verified": true,
    "reference": "<independent review-phase record>",
    "change": "<full change name>",
    "phase": "execution",
    "policyRevision": "<verified integrated parent SHA>",
    "requestSha256": "<independently retained request SHA-256>",
    "authorityReference": "<local execution grant reference>"
  }
}
```

Offline preparation and checking use `--host-config HOST`. Set
`maxTurns >= 11` for low-touch packet feasibility. The ten-turn reserve
leaves at most `maxTurns - 10` whole-file reads per packet. The host schema
accepts 1–128 for standalone probes and retained legacy runs. Offline
`--check --admission ADMISSION` also checks the effective scope and
authority without claiming the reservation. The approved launch uses
`--mode ... --host-config HOST --admission ADMISSION`. Before contacting the
relay or reading credential material, it durably claims the run. The full
reservation is the host's per-invocation `maxBudgetUsd` multiplied by the
number of packets plus one probe. The ledger retains spent and uncertain
amounts conservatively and refuses replay or excess. A crashed or partially
written ledger stops future claims pending host reconciliation. Keep the
original entries when reconciling. A standalone diagnostic `--probe` is
outside automatic approval. Use `--probe --host-config HOST --admission
PROBE_GRANT --output PROBE_OUTPUT` with a separate host-owned
`standalone-review-probe` grant. It binds one invocation to the raw host
SHA-256, exact cost bound in USD millionths and stable host ledger path.
The runner reserves the grant's unique approval reference in that ledger
before opening the runtime or reading credentials. Keep that reservation
after a failed run.
[Packaged request and command schema](../skills/autonomous-ai-agents/autonomous-implementation-review/references/review-candidate.md).

## Optional local harness

Omit `localHarness` or set it to null to use normal review with no harness.
When configured, use a POSIX host and prepare a clean disposable checkout
detached at the exact committed candidate. A separately authorized operator calls the packaged
`delivery-cli.mjs run-harness --input REQUEST --json` with `repo`, `change`,
`plan`, `target`, `candidate`, `checkout`, `output`, `hostConfiguration`
(`file`, `sha256`) and the verified `local-candidate-harness` grant. The
grant binds change, policy revision, candidate, harness ID, checkout,
configuration hash and independently verified exposure (`exposureVerified: true`). Host-owned adapters are pinned by executable path
and SHA-256. CLI receives `--candidate SHA`. A local stdio MCP adapter
receives `{ "candidate": "SHA", "checkout": "/absolute/path" }` on its
configured tool. Both return JSON with `schemaVersion`, `harnessId`,
`candidate`, `verdict`, `findings` and `observedAt`. A passing result has
an empty findings list. The host writes a schema-version-2 seal with
`configurationSha256`, `executableSha256`, `harnessId`, `candidate`,
`resultSha256` and the schema-version-1 `result`. It checks the pinned
executable before invocation and again before sealing.

The fields below are the optional object in `host.json`. For a CLI adapter
use `"kind":"cli"` and omit `tool`. For tools with external contact,
including outbound findings or metadata, use `"exposure":"separate-run"`
and supply the bound external single-run reservation. A zero-cost local
binding requires an independently verified local-only adapter.

```json
{
  "localHarness": {
    "id": "local-security-logic",
    "kind": "mcp",
    "executable": "/var/lib/operator/harness-adapter",
    "executableSha256": "<SHA-256 of the adapter executable>",
    "args": [],
    "tool": "check_candidate",
    "exposure": "local-only",
    "timeoutMs": 90000,
    "maxAgeMs": 900000
  }
}
```

Bind a byte-for-byte copy of the seal as an approved attachment and name
it in `snapshot.harness`. Retain the original sealed file in a private
host-owned directory. Record its absolute path and digest as
`expect.harness: {file, sha256}` in the private host expectation supplied to
reviewer preparation, offline checks and live admission. Pass that same
reference as `harness` in the delivery input and independently pin the
reviewer's expectation with `handover.expectFileSha256`. Keep the private
seal and its path outside the checkout, request, export and worker evidence.
Admission verifies the original seal against the exact host configuration,
current executable pin, candidate and freshness window, and checks the
exported copy against it before runtime.

When an adopted checkbox-only finish route produces a new head, run the
harness for that SHA before pushing. For the record-only closure, retain
the seal reference as `closureCandidate.harness` and record its digest as
`closureReview.harnessSha256` in the host finish readback. The same
current-head and freshness checks apply while the closure PR is absent
and while it is open. Independent review and exact disposable gates
remain required.

## Repository binding examples

For `grewety/ai-coding-agent-skills`, use a reviewed host adapter around
Aikido **Local Scanner** for code scanning. The vendor's command family is
`aikido-local-scanner scan <isolated-checkout>`. Use the operator-selected
repository name and exact commit and keep the temp directory outside the
checkout. For the MCP scan route, `aikido_scan_paths` accepts concrete
files from the exact checkout and reports paths relative to the configured
root. The documented authenticated integration can send scan results
to Aikido, so bind it as a CLI harness with `"exposure":"separate-run"`
where that behavior is enabled. A host wrapper needs to verify the checked
out SHA, normalize report findings and emit the generic JSON. Keep keys
in the trusted host credential path. [Aikido Local Scanner CLI](https://help.aikido.dev/code-scanning/local-code-scanning/cli-options-for-local-scanner).

For logic and security review from the local checkout, use a host-owned
stdio bridge exposing a wrapper such as `check_candidate`. The bridge
checks detached HEAD and passes the exact checkout directory to
`aikido_deep_review` with `scope: committed` and the pinned approved
`base_ref`. Read the final result through `aikido_deep_review_status` and
then normalize it into the same JSON. Bind it with
`"exposure":"separate-run"`. The Deep Review start uses one credit, and a
new start requires new authority. Recheck scope because this service
analyzes repository context. A status or an agent ID alone cannot pass
the harness. [Aikido MCP tool contract](https://help.aikido.dev/ai-and-dev-tools/aikido-mcp/using-aikido-mcp),
[Aikido local Deep Review](https://help.aikido.dev/deep-review/run-deep-review-locally).

For protected finish, enumerate the repo's live events before each
operation. The versioned inventory includes **Verify skills** on push and
pull request, and **Publish skills** on a push to main (manual dispatch is a
separate event). Ordinary CI continues to run through its existing
workflow. Also inventory installed apps, repository rules and externally
hosted automation before activation.

Aikido's ordinary PR security check and default-branch scan illustrate two
separate standing entries. Substitute independently verified stable app,
installation and check/job identities, exact target strings and actual
configuration hashes for this repository. Verify the covered data and
**incremental $0** in the installed account and its billing configuration
before proposing an allowlist entry. The examples below are templates.
The repo ships an empty standing allowlist until that account evidence
and integrated policy select actual entries. Deep Review uses credits
and does not qualify based on the PR check display name.

```json
{
  "standingTriggers": [
    {
      "id": "<app/installation/check ID for Aikido PR security>",
      "repository": "grewety/ai-coding-agent-skills",
      "event": "pull_request",
      "target": "main",
      "kind": "repository-check",
      "configurationSha256": "<verified PR settings SHA-256>",
      "exposure": "<verified existing PR scan exposure>",
      "costUsd": 0
    },
    {
      "id": "<app/installation/check ID for Aikido main scan>",
      "repository": "grewety/ai-coding-agent-skills",
      "event": "push",
      "target": "main",
      "kind": "repository-check",
      "configurationSha256": "<verified default-branch settings SHA-256>",
      "exposure": "<verified existing main scan exposure>",
      "costUsd": 0
    }
  ]
}
```

Compare every activated trigger against its exact repository, event, target,
identity, configuration and data exposure. Preserve the current complete
inventory and standing matches with the finish evidence. Unknown or paid
triggers, previews, tunnels and retries require distinct single-run
approval. A missing or stale inventory blocks activation.
[Aikido GitHub PR gating](https://help.aikido.dev/code-scanning/local-code-scanning/pr-gating/github-pr-gating-using-local-scanner),
[Aikido default-branch scanning](https://help.aikido.dev/code-scanning/miscellaneous/scanned-branches-in-aikido),
[Aikido Deep Review credits](https://help.aikido.dev/deep-review/configure-deep-review).
