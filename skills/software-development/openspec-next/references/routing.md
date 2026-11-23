# Route a selected change

Resolve the change from its full name, unique slug or verified workspace before
building an observation request. Read the applicable contributor contracts,
native proposal, design, tasks and deltas, and retained approvals and results.
Reuse delivery's naming and workspace helpers. Report ambiguity, duplicate
active/archive copies, or conflicting ownership before attempting execution.

## Read observations

Resolve `<next>` to this package's `scripts/next.mjs`. Use Node 22+ and the
complete `openspec-delivery` companion. The CLI uses the sibling package by
default. If the packages are installed in different locations, pass
`--runtime <absolute-path-to-delivery-cli.mjs>` from the trusted companion
installation. Choose that path from the installed skill, never from request data
or an untrusted target checkout. Pass absolute paths for retained request files.

```sh
node <next> inspect --input <request.json> --json
node <next> next --input <request.json> --json
node <next> ui --input <ui-observations.json> --json
node <next> external --input <external-card.json> --json
node <next> push-triggers --input <push-observations.json> --json
node <next> finish-readiness --input <request.json> --json
```

The request and response schemas are those of delivery's
`references/delivery-runtime.md` and `references/external-verification.md`.
`inspect` invokes `status`, and `next` invokes `decision` with the retained
`deliveryPhase`. The other routes use the same-named delivery commands.
The helper returns their JSON and exit status. Even an affirmative result is an
observation. The helper creates no worktree, writes no tasks or reservations,
launches no worker or gate, and performs no external operation.

## Apply the decision

1. Derive mode and policy from the verified integrated plan parent. Inspect
   reports the observed state and ends there. Use the selected mode's approval
   identity and separate local grant on execution. Examine pending P1–P8
   observations, ownership and unfinished attempts before dispatch.
2. Goal-First advances the single approved local outcome in its dedicated
   workspace. Apply the retained scope, invariants, acceptance gates and
   budgets at dispatch, boundaries, correction and result. A routine in-scope
   correction keeps the same contract. A material conflict returns
   `DIRECTION_DRIFT_CHOICE` and stops at the affected clause.
3. Task-Guided advances the first eligible unfinished native group in document
   and dependency order. Use the frozen SHA and plan digest, retained group
   evidence, selected continuation policy and restrictions. Keep the existing
   one-group default or the verified continuous-goal boundary. Report an
   externally gated or interrupted group with its actual state.
4. For a declared UI flow, gather exact-candidate loopback try-out and
   accessible-name results and check `ui`. A deploy preview held for separate
   authority or operator review remains pending. Complete the local result at
   its own boundary when a separate external gate is deferred. Discovery,
   external reservation, execution and teardown belong to delivery under their
   respective explicit grants.
5. Reconcile exact-SHA disposable gates and independent review before trusting
   a result. Task-Guided can use a sealed contained candidate review of the full
   frozen-plan-to-candidate diff from an isolated checkout. Pass its retained
   `review-candidate` handover to delivery with the matching gate run. Goal-First
   uses a qualified portable-role reviewer with its Goal Contract digest. Only
   the orchestrator records native progress. Any later commit
   requires fresh evidence. Before offering the protected finish invocation,
   require `finish-readiness` for the exact accepted candidate and both the
   native progress and current-spec promotion checks. If finish is already
   authorized, recover from actual PR and receipt readbacks under that grant.
   Run the external trigger check before any authorized push. A changed PR head
   returns to exact verification and review.
