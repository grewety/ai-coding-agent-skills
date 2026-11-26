---
metadata_version: 1
artifact: design
change: testing-overhaul-and-low-touch-friction-01m8b4nava84t4qbzm550nwy5n
---
# Design

## Context

The integrated baseline uses Node's native test runner. The launcher recovery fixture observes a readiness signal from a foreground launcher before killing it, then checks the surviving supervisor's late handover. Those events can race. Worker supervision and grant admission also contain ten-minute limits. The contained reviewer currently launches packets serially after an automatic probe, and its host ledger already holds the full upper price across phases. Finish can currently replay an independently reviewed parent for a checkout whose sole change is a verified task tick. Discovery currently selects the executable name `grok-build`.

## Goals and non-goals

Retain existing assertions, immutable historical evidence and safe defaults while making bounded progress and admission decisions within the held grant. Keep the source delivery reversible and later adoption prospective. The proposal's Goal Contract defines execution boundaries and exclusions.

## Decisions

- **Check test synchronization and isolation together.** The recovery test must prove the original process identity and verified late result even when startup, exit and termination happen close together. An exited launcher cannot satisfy a fixture that is supposed to test killing a live one. Isolate each shard's fixture HOME, Git settings, temporary state, registry, paths and subprocesses. Keep the complete local and CI assertion inventory, measure comparable runs using the same Node version and runner class, and retain a serial path with an explicit isolation or determinism blocker where necessary.
- **Keep authority at the original worker boundary.** A 30-minute Goal-First default leaves the exact runtime override, aggregate budget and stricter retained limits in control. A productive timeout grants one bounded successor to the same outcome after the supervisor seals settlement and the orchestrator verifies the authorized checkout delta. Timing, progress, quiescence and claim ownership are independently checked. Counters carry forward across resume. Treating every timeout as either harmless or automatically retryable would lose those distinctions.
- **Keep the ledger authoritative for review spend.** At the new setup guidance of USD 2.50 per invocation, a probe and six or seven packets reserve USD 17.50 or 20.00. A grant can increase an already lowered applicable count or dollar cap only up to verified integrated ceilings. The signed file scopes the trusted operator, unique reference, effective period, exact change and plan, and one existing ledger identity. Preserve replay evidence and consumed or uncertain amounts under the ledger's claim boundary. Existing host files keep their byte pins. A possible later USD 40 project ceiling stays optional and prospective.
- **Give finish reservations event-level identity.** Verify live exact-head inventory and cost immediately before each activation. Tie consumption to the named finish grant and protected PR chapter, including partial or unknown results. Treat a retry as a separate consumed action within the cap. It requires a verified transient event and successful unchanged-SHA equivalent push check, both established before triggering the retry.
- **Retain review lineage and gate the actual head.** A targeted post-review fix requires an independently established range and dispositions. Only unaffected evidence may derive from the exact accepted ancestor. Changed and impacted coverage must be verified at the final head, with successful disposable gates for the exact head in all cases. Record and replay the real ancestry, review identities and gates through integration and archive. Full exact-head re-review remains the route when coverage or lineage cannot be proved. Preserve today's narrow native task-tick proof and legacy receipt interpretation.
- **Keep concurrent reviewer packets independent.** Run the automatic probe before any review packet. Pacing is between launches at higher concurrency and between settled and successive packets in legacy serial mode. Any failure prevents queued launches and requires active sibling settlement with captured evidence. Keep result and audit association by packet identity. Prefer serial operation if any isolation proof fails. Document the direct Node command and its existing approval/admission inputs in the maintained workflow examples.
- **Separate discovery and suitability from qualification.** Resolve the real `grok` binary with supported discovery while preserving existing `grok-build` IDs and command fallbacks. Describe observed host/tool versions and limits from the dated matrix. Claude is the qualified baseline for the pinned host. Grok and Pi are Tier 1 candidates pending separately authorized live qualification. Hermes and Codex are medium for this review role. OpenCode, Kilo and agy are unsuitable for the present minimal-rootfs model.

## Affected surfaces

| Surface | Expected scope |
| --- | --- |
| Test gate | `package.json`, verification workflows if needed, the seven named suites and shared synthetic fixtures they use. |
| Worker | Implementer runtime, supervisor, policy and recovery interfaces in `autonomous-implementation-review`, and delivery-side continuation admission. |
| Review | `review-candidate.mjs`, packet runtime and input validation, `review-spend.mjs`, low-touch policy and the paired setup/configuration modules. |
| Finish | `finish-readiness.mjs`, `protected-finish.mjs`, `change-guard.mjs` and archive `receipt.json` schema, fixtures and operator guidance. |
| Discovery and documentation | `role-config.mjs`, `agent-discovery.mjs`, `detect-agents.mjs` and shared copies, affected skill playbooks, `docs/configurable-backends.md`, `docs/claude-reviewer.md`, `docs/worker-runtime.md`, `docs/openspec-review-configuration.md`, `docs/openspec-operator-runbook.md` and affected contributor contracts. Check all current installation and SDLC docs for affected references. |
| Distribution | Three promoted current specs, affected skill versions, companion copies and `openspec-development` and `autonomous-orchestration` marketplace versions. Touch `openspec-next` only for required routing and update its version if changed. |

## Risks and trade-offs

- Fixture concurrency can expose shared state or saturate the runner. Retain parallelization evidence, full inventory and repeated isolated recovery evidence. Do not trade coverage for runtime.
- An unsettled worker can write after the successor begins. Fail closed during reconciliation and retain the original claim or slot while ownership or quiescence is unresolved.
- A replayed cap extension or unknown trigger outcome can double-spend. Preserve durable uniqueness, checked arithmetic, reservations and unknown usage across restart.
- Parallel packet completion can reorder records or expose more data after an error. Require exact packet correlation, full independent audit and strict offline replay, and stop launching on failure.
- A scoped fix can invalidate earlier review outside its touched files. Verify affected evidence and use full exact-head review if a bounded disposition cannot prove coverage.

## Migration plan

Use additive inputs and compatibility readers for existing host pins, client identifiers, sealed runs and receipts. Keep reviewer packet concurrency at one unless a separately pinned host opts in. Higher caps and new finish rights apply only where already integrated and separately authorized. Gate and review the actual source candidate before protected finish. If performance or concurrency isolation cannot be shown, preserve serial operation for that component, record the precise blocker, and retain all other verified deliverables.

## Verification evidence

| Control | Successful case | Refused or adverse case |
| --- | --- | --- |
| Recovery and sharding | Repeat the killed-launcher fixture in isolated runs and check original session, exact-once result publication and stable replay. Compare the full test inventory and timings before and after on comparable runners. | Force adverse scheduling and exercise an exited launcher, shared fixture state and failing shards. A race or leaked fixture cannot be recorded as a pass. |
| Worker limits and timeout | Confirm the default, explicit override, tighter aggregate deadline, and one same-outcome continuation with verified progress and settled processes. | Reject invalid limits, no or out-of-scope progress, stale identity, active descendants, occupied claims and exhausted count or time after resume. |
| Review spend | Admit a signed exact-plan extension after previous reservations and compare outstanding holds before and after it. Exercise concurrent claim/extension and probe-plus-packet accounting. | Refuse expired, wrong-signer, tampered, reused, cross-plan, cross-ledger and over-ceiling grants, and protect uncertain charges. |
| Finish grant | Match two separately observed Aikido chapter events within one grant, plus one verified transient identical-SHA zero-cost retry where granted. | Reject ungranted, stale, unknown-cost, duplicate, wrong-SHA and over-cap events and real test failures. Test interrupted or concurrent reservations. |
| PR-fix lineage | Replay the reviewed ancestor, final exact-head evidence, integrated revision and archive receipt, including a scoped delta and all affected postimages. | Fail on unrelated hunks, missing review coverage, altered evidence, false or ambiguous ancestry, wrong gate SHA or unresolved finding. Exercise the full-review fallback and existing task-tick and historical receipt cases. |
| Review launcher and packets | Check documented direct launch examples, legacy pin readback, bounds 1–3, pacing, unique sessions, reordered completion, all reads and sealed offline replay. | Reject unsafe configuration, cross-packet evidence, missing reads and tampered receipts. Simulate 429 and 529 during concurrent runs and verify halted launches, sibling settlement, no acceptance and no automatic retry. |
| Discovery and versions | Resolve `grok` on an isolated fixture PATH while accepting legacy `grok-build` IDs and supported fallback discovery. Verify the matrix links and affected package version declarations. | Exercise absent and ambiguous/rejected candidates without ambient profile discovery, inference or promotion. |
