---
metadata_version: 1
artifact: design
change: low-touch-autonomous-delivery-01m88zpkktr16z02dh3wne3ppy
---
# Design

## Context

The integrated planning guard admits native metadata, proposal, design, tasks and spec deltas. The draft and committed walkers and the contained reviewer's archive projection each have coverage decisions. The Goal-First digest uses a narrower input set than the raw planning review. All these surfaces need consistent custom-artifact identity.

Finish readiness currently requires equality between the accepted result SHA and finish HEAD before it checks complete tasks and promoted specs. Candidate admission and its sealed gate and review readbacks already establish the exact reviewed SHA. Review packet construction is offline, while trusted host configuration is currently checked on live launch. The relay reports generic refusal to the sandbox when an upstream error occurs.

## Goals / Non-Goals

Keep one reproducible planning inventory, explicit provenance between a reviewed parent and a narrowly admitted task-completion child, and a deterministic reservation check before paid exposure. Keep reviewer diagnostics inside the trusted host, and keep optional schemas and client settings below the delivery governance boundary. Stage 2 dispatch, automatic retry, provider expansion, schema installation, and hosted qualification are outside the local implementation outcome.

## Decisions

### Inventory and compatibility

Use one path policy and bounded inventory across planning worktree readback, committed object traversal, digests, scope checks, exports and archive projection. Admit safe regular outputs under the exact active change root without a hardcoded schema, capability, directory or Markdown-extension catalog. Use native status and instruction artifact paths to verify the full required closure during planning. Include custom outputs in both delivery modes' approval identity and in the complete raw snapshot for approach review. Only native task progress receives existing normalization. Include exact relative paths with stable ordering and handle modes consistently across freeze, candidate and archive checks.

Exclude the reserved evidence tree and hidden path components, with the required root `.openspec.yaml` exception. Reuse finite file, entry, byte, individual size, depth and output limits. Reject path aliases, symlinks, submodules and non-regular entries in the admitted inventory. An export statement and closure relocation each reconcile against the same inventory. Record-only closure moves the full tracked planning set without content or mode changes. Digests and approval readback for legacy plans follow their verified integrated policy. Direct code changes in the current change cannot authorize its own proposal or reinterpret older archives. Extending only a hardcoded `adr/` list would leave additional native schemas unsupported. Running schema code during verification would compromise reproducibility and the trust boundary.

### Task-completion commit provenance

Use exact Git objects to compare one direct parent with the proposed finish head. First replay the sealed accepted result against its original reviewed SHA and its exact gate evidence. Derive allowed task IDs from the accepted native outcome or group. Compare the full tree change and the two raw task blobs, require unchanged file mode, and accept only lowercase unchecked-to-checked transitions on the eligible IDs. Reject a merge child, ambiguous task syntax, unrelated checkbox matches, reversals, mode changes, extra paths, a waiver, changed plan identity or unverified task ownership.

Verify the real finish head's cleanliness, exact disposable gate evidence, task completion and promoted current specs. Keep parent review identity, child SHA and task IDs in finish and integration evidence. Protected finish and its later checks consume this proof without rewriting the result or changing the default exact-candidate path. A comparison of normalized digests alone cannot establish a safe tree difference.

### Paid authority and trigger evidence

Read mode, allowed phases, cap ceilings and the standing $0 trigger allowlist from the verified integrated parent. Default to `auto-approved` with `maxReviews: 10` and `maxTotalUsd: 25` per change across `["planning", "execution", "finish"]`. Resolve omitted overrides to the built-in defaults and require positive finite effective caps within the integrated ceilings. Operators can configure effective caps within those ceilings or change the ceilings in integrated policy. Unreviewed branch changes and host config cannot expand authority, raise ceilings or authorize standing triggers. Keep the expected `host.json` `configurationSha256` pin and local harness binding in trusted host-owned configuration outside the checkout. Compare the pin to the actual host config bytes for each launch.

The `explicit` mode or per-run override requires a separate single-run grant bound to the exact attempt, scope, exposed data and cost. Automatic consent applies only within the authorized planning, execution or finish phase. It supplies no plan approval, local execution grant, finish authority, profile sync or retry authorization. Item 4.5 follows the baseline's single-run policy through integration.

Each automatic reservation binds the exact candidate or raw planning snapshot, change, phase, purpose, data, pinned configuration and attempt. Compute a conservative upper cost with explicit monetary precision from the verified per-invocation host cap and all potentially billable invocations, including the probe and every packet. Reserve one review and its full upper cost in a durable serialized per-change ledger before provider contact. Share the ledger across configured phases and preserve spent and uncertain reservations across resume. A replay or overlap cannot spend twice on the same reservation. Missing or mismatched pins, absent or invalid effective caps, unproved cost, exhausted capacity or unavailable reservation storage block launch without automatic fallback. A separately authorized retry consumes its own reservation where the automatic budget applies.

For protected publication and integration, compare each observed trigger to the prospective integrated allowlist using a stable source identity, repository, event, exact target scope, version or configuration and verified exposure. The baseline workflow inventory includes Verify skills on push and pull request and Publish skills on a push to main or manual dispatch. Prepare Aikido PR and main checks as the first repository-local standing trigger example, with identity, events, target, pinned configuration, existing exposure and $0 cost verified before admission. A display name or previous successful check alone provides insufficient evidence. A privileged or paid path, an unverified trigger, a tunnel, and a deploy preview retain separate authority. Repeat the inventory before each actual event in protected finish. The closure PR body explains that explicit issue closure follows the verified record-only merge and acceptance readback.

### Optional local pre-PR harness

Define a portable declarative binding for a host-configured `cli` or `mcp` check. It identifies the harness and local invocation, and receives the exact committed candidate SHA from a clean isolated checkout. Run it before final candidate review and before PR push. Use applicable local authority for the check. Network exposure, a paid invocation or an external app action still needs its applicable separate authority. Selecting no harness leaves normal final review and protected finish available.

The host retains a sealed JSON result containing `schemaVersion`, `harnessId`, `candidate`, `verdict`, `findings`, and `observedAt`. Verify its integrity, configured identity, schema and committed SHA, and include the result in final review and protected-finish evidence. A configured check with absent, mismatched, malformed or non-passing evidence blocks those steps. A new candidate requires a new result. Apply the existing findings and correction rules. The harness supplements the required independent contained review.

Document and prepare Aikido's local scan / `aikido_deep_review` as the first repository-local binding example. Its adapter emits the generic result and its standing PR/main example uses the integrated allowlist contract. Portable skills contain no Aikido names, dependency, provider-specific branching or preinstalled adapter. Test the contract with synthetic CLI and MCP bindings.

### Offline reviewer feasibility and host-private operation

Have offline `--prepare` and `--check` verify the supplied trusted host configuration or equivalent sealed budget readback and compute each packet's whole-file read count from its actual manifest. Reserve ten turns. Repeat at launch against the same pin. Maintain offline readback for retained legacy attempts. Reject an infeasible packet before a probe, credentials or provider access. Preserve file coverage and accept smaller packets only if inventory and diff coverage remain complete.

Represent file-specific acceptance with validated packet membership. Apply common criteria across packets and send file-specific criteria only with their reviewed paths. Validate receipt paths against the same manifest and require repository-relative paths in the prompt. Keep an optional, finite host-owned inter-packet delay inside the same run deadline and cancellation boundary. Classify upstream errors by status only in the host relay and seal the allowlisted classification in private attempt status. Deliver the current generic failure to the sandbox. Verify offline that altered statuses, errors and incomplete packet sets confer no acceptance. Host configuration stays externally owned and trusted. Under the inherited review policy, bind the current planning and delivery review route to packaged reviewer 0.20.0, Claude Code 2.1.330, Claude Sonnet 4.6, Bubblewrap 0.9.0 and host configuration SHA-256 `80440cdb9f8b26530f209893274bac05167e82ee753e79c92dfe81a54328c3a7`. Any change to that pin needs separate approval and same-binding readback.

### Operator documentation and release inventory

Add a concise visual guide using the Item 4.5 tutorial as an authoring reference. Show lifecycle and chat sequence diagrams, literal commands and replies, checkpoint handoffs, and decisions reserved for the operator. Index the tutorial and all active guides near the top of README. Audit all eight existing docs, README and AGENTS. Remove completed-change callouts, repeated retired-route narratives and one-time transfer history with no active operational role. Preserve valid former-URL upgrade and compatibility rules. Align documentation, links, current specs and relevant assertions in the same candidate.

Describe interactive orchestrator selection, including OpenSpec 2.1.1 workset `openers.codex.args`; standalone implementers admitted under applicable local policy and the pinned exclusive Codex route; and the pinned OS-contained reviewer with model, `maxTurns`, `maxBudgetUsd` and `timeoutMs` configured by trusted `host.json`. Optional host-native drafting and QA configuration supplies no gate admission. Show the Intent-Driven artifact workflow and retain isolated delivery and protected closeout. Bump shipped packages and both affected marketplace versions together.

## Risks / Trade-offs

- Legacy evidence compatibility depends on honoring the integrated parent. Fixtures must exercise earlier plans as well as new custom artifacts.
- Review-cost accounting is deliberately conservative. Uncertain usage remains reserved, which can exhaust the per-change budget sooner than final billed totals suggest.
- Trigger names and prices can change independently of Git. Fail closed on incomplete event inventory or an unproved standing match.
- The exact host config, provider and packet width can affect launch feasibility. A newly selected host config, including a 96-turn configuration, requires separate approval and pinning.
- Documentation changes remain part of the exact candidate. Keep changed files below 65,536 bytes and retain active compatibility rules while shortening current guides.

## Migration Plan

Ship the guards and prospective policy through the current integrated rules, including exact-head gates and review for this change. Verify package and guide consistency and promote both deltas into their current specs. Existing plan identities, archived changes and retained review records keep their original interpretation. A later verified adopting integrated parent enables the new defaults and standing trigger policy. Existing integrated parents retain their original exact-candidate and single-run rules. Attempts governed by the new policy stop on failed admission. A protected rollback or forward repair needs its own authority.
