# Lossless evidence retention

## Scope and authority

Preserve evidence from authorized commands, API readbacks and independent review.
The representation library is not a command runner, scheduler, GitHub
client, polling loop, approval service, or publication authority.
The evidence CLI captures named authorized local gates in a disposable checkout
pinned to the exact candidate. Use the recorded command, revision, scope,
environment policy, stdout, stderr and exit status under the repository's
confidentiality policy. Collect remote readbacks through their separately
authorized surface before using the offline assertions.

Do not infer a historical fact from current prose or a fresh query. A fresh
corroboration is current evidence; it must say so and cannot establish earlier
thread absence, check conclusions, or review state by itself. An operator report
that checks finished allows one read of the same head and conclusions; it never
permits unattended polling, merge, or a changed head.

## Original bytes and representations

Keep an original-byte copy when repository policy safely permits it. When raw text
would be unsafe or rejected by repository whitespace rules, use the versioned
representation made by `scripts/evidence-retention.mjs`.

A representation has:

- `schemaVersion: 1` and `kind: "lossless-evidence-representation"`;
- `encoding` of `utf8` only when UTF-8 re-encoding returns exactly the original
  bytes, otherwise `base64`;
- `content`, the stored textual artifact;
- `storedArtifactSha256`, the SHA-256 of UTF-8 bytes of that stored content;
- `decodedOriginalSha256`, the SHA-256 of the decoded original bytes;
- `wrapperSha256`, the SHA-256 of the canonical immutable wrapper payload;
- provenance: source, command argv, environment scope, numeric exit status,
  UTC source-capture time in `observedAt`, revision, scope, pagination state, and
  verified readback type (`original-response`, `lossless-representation`,
  `redacted-transformed`, `historical-extract`, `fresh-corroboration`, or
  `merge-snapshot`). A `historical-extract` also has a distinct strict-UTC
  `extractedAt`; and
- fixed labels: that same readback type, completeness of `complete`, `partial`,
  or `not-applicable`, and confidentiality of `publishable`, `restricted`, or
  `redacted`.

The verifier compares all declared SHA-256 values and returns the exact decoded bytes. It
does not trim trailing whitespace, rewrite CRLF, normalize Unicode, execute a
command, contact an API, or write a file. Empty, CRLF-only, and whitespace-only
content are valid evidence bytes. Invalid UTF-8 is base64 represented; an invalid
wrapper, unsupported encoding, malformed base64, changed provenance/label/encoding/
content, or hash mismatch fails closed. `wrapperSha256` covers the canonical payload
other than itself, avoiding a recursive self-hash. Canonical JSON recursively
sorts object keys; unknown wrapper fields are rejected. Provenance/label coherence
is rechecked after deserialization: the readback type and completeness label must
agree with verified provenance. A
redacted-transformed representation must have a `redacted` confidentiality label,
and a redacted label must use `redacted-transformed` provenance. An original byte
copy is not a wrapper. A redacted or transformed artifact must never be described
as an original-byte copy.

## Provenance, completeness, and confidentiality

Name the real capture source, command argv, environment scope, numeric exit status,
observation time, revision, scope, and pagination/completeness state. Observation,
merge, and completion times are strict UTC instants: a valid calendar date and
clock time ending in `Z`, with either no fractional seconds or exactly three
fractional digits. A partial response cannot prove all threads were absent. A merge
response proves merge state only; it cannot replace retained check or review-thread
data.

For a claim that checks passed on a PR head, retain decoded JSON with a string
`head` equal to the expected head and a `checks` array. Each check must provide a
unique string `id`, a string `conclusion`, and a strict-UTC `completedAt`. Every
caller-supplied applicable check identity must occur exactly once, have conclusion
`success`, and have a completion instant before the merge instant. For an
`original-response`, `observedAt` is the source-capture time and must precede
merge. For a `historical-extract`, `observedAt` remains that original
source-capture time; `extractedAt` may be later and never substitutes for it. A
historical claim requires original captured output or a labeled historical extract
from it. If the original is unavailable, retain the gap and narrow or block the
claim rather than reconstructing a response from a narrative.

`assessClaimSupport` is a pure helper for this factual limit: it verifies and
decodes the retained representation, then compares its structured payload with a
caller-supplied expected head and applicable check identities. Caller-supplied
completion times, conclusions, or opaque bytes cannot establish a claim. Missing or contrary evidence blocks
before any narrowing. A supported claim
requires complete original-response or historical-extract evidence with a
successful exit status, publishable non-redacted labels, a strict UTC merge instant,
the applicable source-capture rule, and every applicable decoded check successful
and completed before merge. A partial `original-response` can only return
`narrowed` after that same decoded-payload, head, applicable-check, completion, and
pre-merge source-capture validation; it never becomes `supported`. A complete
`fresh-corroboration` or `merge-snapshot` can return `narrowed` only after the
decoded-payload, head, applicable-check, and completion validation. Partial
fresh-corroboration and merge-snapshot evidence blocks. It neither fetches nor
proves facts that were not retained.

Secrets and confidential material remain subject to repository policy. Stop
publication or retain an authorized transformation with its limitation. Neither a
hash nor base64 makes sensitive material publishable.

## Failures, reviews, and successors

Retain a named gate failure with its actual exit status and unmodified output. Keep
rejected review output byte-identical and bound to its original candidate. A later
successful candidate, disposition, or closeout record supplements those facts; it
does not rewrite the failure into a pass.

Every changed candidate receives its applicable real gates and an independent
review at that candidate's exact SHA. A factual closure review is a fresh reviewer
role after local closure gates and before authorized publication. It verifies
retained hashes, representation round trips, archive identity, and claim
completeness without relabeling candidate gates as closure gates or reusing the
implementation-review session.

## Routing

Use [guard.md](guard.md) for immutable plan/candidate/review/receipt identity. For an explicitly selected Direct-CLI level, retain the finish checkpoint and readback so archive replay can verify the receipt's `reviewProof` against the sealed handover and recover the separate closure proof. Use the receipt guard's `--policy-target` to name the original exact integrated target when replaying an explicitly governed receipt.
Use [integration.md](integration.md) for protected publication, actual named-gate
retention, and target readbacks. Use [recovery.md](recovery.md) when evidence is
missing, a gate fails, or a review is rejected. Use [continuation.md](continuation.md)
to select the next authorized delivery boundary. Those references retain their
existing authority rules; this file does not widen them.

## Runnable capture and offline assertions

The separate `scripts/evidence-cli.mjs` command consumes one request JSON.
The lossless representation library remains the verifier for the captured
content. Paths are absolute and canonical. Approve execution and bind the
checkout before using a capture command. Command output is retained in a fresh
restricted file outside the checkout; the CLI emits its reference and hashes.

```sh
node <evidence-cli> capture --input <capture.json>
node <evidence-cli> gate-capture --input <gate-run.json>
node <evidence-cli> seal --input <seal.json>
node <evidence-cli> verify --input <verify.json>
node <evidence-cli> assert-closeout --input <readbacks.json>
```

- `capture` takes `argv`, `cwd`, `timeoutMs`, `scope`, `environmentScope`,
  `output` and optional exact `revision`; use `detached: true` for a named
  detached checkout. Store the exact argument array, observation UTC time,
  exit status and sealed stdout and stderr. Timeouts and overflow retain
  partial bytes and an interruption. An actual failed exit cannot pass a gate.
- `gate-capture` takes `implementation`, separate detached `checkout`,
  `change`, `base`, `plan`, `head`, applicable `mode`, `target`,
  `planDigest`, and fresh `output`. Supply `bootstrap` and `gates` as
  command arrays of `{argv, timeoutMs}` objects, and `generated` as explicit
  checkout-relative ignored output paths. It verifies an initially clean,
  exact checkout, retains captured streams and checks the workspace
  after each command. Retain the raw file hash and inner gate wrapper hash
  independently. Commands and local dependencies are trusted under the
  existing grant. Pass only the full gate set required by the approved plan.
- `seal` takes an `original` file, `provenance`, `labels`, and fresh
  `output`. `verify` takes the independently retained `{file, sha256}`
  reference and, for a disposable gate run, `expected` with `head`, `tree`,
  `implementation` and any required gate argv arrays. Include the expected
  change, mode, plan and plan digest when asserting a local result. A file pin complements
  the wrapper seal. A successful representation read does not upgrade partial
  or failed evidence into acceptance.

For `assert-closeout`, supply `pullRequest`, `expectedHead`,
`applicableCheckIds`, `observedNotBefore` and the `readbacks` map of
independently retained `{file, sha256}` references. Use complete successful
source readbacks for the same PR scope, revision and requested observation
window. The decoded JSON for each key carries matching `pullRequest` and
`head`, plus these observed fields:

| Key | Provenance source | Decoded readback fields |
| --- | --- | --- |
| `pr` | `github-pull-request` | `state` is `OPEN` or `MERGED`, with matching `mergedAt` (null when open) and `mergeCommit` when merged. |
| `checks` | `github-applicable-checks` | The applicable `checks` array with IDs, conclusions and completion instants. |
| `checkRuns` | `github-check-runs` | The `checks` array with each run also bound to its exact `head`. |
| `threads` | `github-review-threads` | All `threads` with stable `id` and resolved state. |
| `closure` | `github-closure-readback` | `integrated`, `verifiedRevision`, closed `issue` and `issueState`, `archive`, `receiptSha256`, and verified `recordOnly`. |

For a merged claim, supply the expected `mergedAt`. To claim closure supply
`closureExpected` with the separately observed `verifiedRevision`, canonical
`issue`, archive identity and receipt SHA-256. The checks reuse the historical
claim eligibility above and emit supported assertions with source wrapper
references, any remaining predicates, or the precise refused assertion.
Capture actual command output and preserve provenance when extracting fields;
keep incomplete, restricted and incompatible historical observations explicit.
This command performs no collection, polling, repair, publication or remote write.
