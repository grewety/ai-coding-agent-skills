# Discovery, external verification and optional UI acceptance

The following commands accept an absolute local request JSON through this
package's `scripts/delivery-cli.mjs`. They consume independently retained
observations. They do not call a vendor, start a tunnel, push, run an external
test or grant permission.

```sh
node <runtime> discovery --input <probe.json> --json
node <runtime> external --input <external-card.json> --json
node <runtime> reserve-external --input <external-card.json> --json
node <runtime> push-triggers --input <push-observations.json> --json
node <runtime> ui --input <ui-observations.json> --json
```

## Scratch discovery

Before Goal Contract lock, use a specifically approved disposable probe for
uncertain breaking CLI, runtime or dependency behavior. The request identifies
`target`, `repository`, `planLocked: false`, `limitMs`, `commands` of
`{argv, timeoutMs}` and a fresh evidence `output` outside the repository.
Its matching v1 `grant` has `kind: "local-planning-probe"`, `verified: true`,
`scope: "scratch-only"`, `external: false`, `reference`, and exact target,
commands and limit. The command uses at most eight trusted local argument
vectors in at most two minutes of probing. It isolates cwd, home, temp,
configuration and caches under one disposable directory, removes it after
success or failure and retains the observed streams, outcomes and cleanup.
The child environment provides isolation for cooperative local tools. Use a
qualified confinement surface when the chosen tool is untrusted. Discovery
evidence informs planning and cannot satisfy candidate acceptance.

## Single-run approval and cleanup

Describe each external check before approval. The card binds the exact
`candidate`, `target`, test `scope`, approved `data`, `expectedCost` as
`{amount, unit}`, `kind`, `runs: 1`, `artifact`, `trigger`, and
`retryOf`. Use synthetic fixtures, approved built artifacts, or public test
metadata. Raw source, credentials, live data and account actions remain
outside the exposure. A tunnel or deploy preview requires a built artifact.
Whenever a card includes a built artifact, identify its isolated canonical
`root`, SHA-256 inventory, candidate and verified exposure boundary.
Cards using only synthetic fixtures or public test metadata use `artifact: null`. An app
trigger names its stable `trigger`; other kinds use `trigger: null`.
Use `displayCard: true` on the read-only `external` request to return the
validated card with the decision. In the footer name the target, cases,
artifact/data exposure, expected cost or credits, and one-run scope.

Supply a verified v1 `grant` of kind `external-single-run`, with the exact
`card`, distinct `reference`, `localOnly: false` and a fixed absolute
`reservation` path named `<SHA-256-of-grant-reference>.json` in the
protected evidence directory. Carry the existing `history`, including
failed attempts and cleanup. `external` is read-only. The already authorized
`reserve-external` call creates an exclusive restricted reservation file
before dispatch and returns a single-use action to the holding orchestrator.
Preserve that file even if the launch fails or is abandoned. A repeated call
or vendor auto-retry cannot redeem the reservation. A retry names its
`retryOf` and needs verified prior failure/cleanup and a distinct grant.

Serve only the approved built artifact. The authorized executor owns
immediate teardown on success or failure and retains closure evidence.
Exclude tunnels with unproved exposure or cleanup. Provider defaults cannot
authorize additional runs. Before a separately authorized push, supply
`pushGrant`, exact `candidate`, a verified trigger inventory in `observed`,
and the candidate-bound external reservations covering every trigger. App
trigger authority and push authority are distinct.

## Optional UI gates

Pass a `declaration` of null to omit optional UI acceptance. A declared
flow supplies `localTryOut`, `interactions` with role and accessible
name, and `deployPreview`. Local results bind the exact `candidate`,
a loopback URL, `localOnly`, `tryOutPassed`, and the passing interactions
with `matchedBy: "accessible-name"`. A declared deploy preview requires
its own single-run authority, artifact-only exposure and matched preview
readback. Preserve the review pause and separately retain the operator's
preview decision before merge.
The protected finish route requires an HTTPS preview URL and matching
`reviewedUrl` with passed deployment. Surface the URL at the human pause.

Check declared local UI gates during local exact-candidate verification. Evaluate
the separately declared deploy-preview gate at the protected pre-merge boundary.
A pending preview never makes a successful local gate result into preview
acceptance. Report the returned pending predicate and retain the local evidence.
