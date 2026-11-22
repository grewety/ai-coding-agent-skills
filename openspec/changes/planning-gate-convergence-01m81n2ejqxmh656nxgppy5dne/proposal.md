---
metadata_version: 1
artifact: proposal
change: planning-gate-convergence-01m81n2ejqxmh656nxgppy5dne
github_issue: https://github.com/grewety/ai-coding-agent-skills/issues/38
---
# Proposal: Planning-gate convergence

## Why

Repeated planning reviews can discover new acceptance rules and require operator relays without reaching freeze readiness. Establish a fixed review charter and finite correction budget so a routine draft can converge in at most three automatic cycles, without weakening the independent gate.

## What Changes

- Admit the fixed independent reviewer route before launch; start the change-owned record at review #1. Preserve stable findings and their dispositions across fresh reviews.
- For selected later changes, accept advisory Low findings and verified coverage exceptions; separate packet-only defects from plan changes. Automatically validate and re-review routine authorized corrections within budget. Stop with one concise decision card when judgment or new authority is needed.
- Select the rule only for later changes through an integrated parent. This change uses the existing strict approach gate; freeze, exact-plan approval, execution and publication remain separate decisions. This invocation authorizes the local draft and one documentation issue only, not review or freeze.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `openspec-integration`: add an opt-in, bounded pre-freeze approach review with a fixed charter, evidence continuity and explicit stop conditions.

## Impact

Verified baseline: clean `main` at `27a126d8117b45ebe2838ffd38bbff0e779ac6b5`, OpenSpec 1.16.0. No upgrade or new prerequisite. `upgrade-openspec-2-1-prerequisites-01m7zmrab0nw5t3fpmd0sm9tyw` remains parked and follows this change's integration; reconcile overlapping capability deltas before either merge. No packaged reviewer backend, Goal Contract workflow, profile changes, or changes to candidate review or publication gates.

Affected sources: `autonomous-implementation-review` (approach gate and record), `openspec-delivery` (policy and task authoring), `openspec-next` (stop guidance), `docs/openspec-workflow.md`, the `openspec-integration` delta, and policy, planning, orchestration and documentation tests. The only planned contributor-contract edit is root `AGENTS.md`, inert for this change. Bump all three affected skill versions and both `openspec-development` and `autonomous-orchestration` plugin versions in `.claude-plugin/marketplace.json`; keep the five-package inventory unchanged.
