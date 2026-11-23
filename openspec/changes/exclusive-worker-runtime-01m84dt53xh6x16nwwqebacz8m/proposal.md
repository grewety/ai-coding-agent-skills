---
metadata_version: 1
artifact: proposal
change: exclusive-worker-runtime-01m84dt53xh6x16nwwqebacz8m
github_issue: https://github.com/grewety/ai-coding-agent-skills/issues/49
---
# Proposal

## Why

A delivery session can verify a reviewed commit today, but competing worktrees and a supervisor restart can leave worker ownership uncertain. A packaged runtime must bind each delegated attempt to one host-wide assignment and a verified handover before delivery can advance.

## What Changes

- Ship `scripts/run-implementer.mjs` with exclusive host-wide change claims, independent paired role bindings, checked checkout containment, bounded foreground supervision, file handovers and recovery of the original worker.
- Use the existing delivery decision and exact-candidate gates for Task-Guided continuation and Goal-First acceptance. `openspec-next` resolves the change and preserves restrictions for delivery. Once delegation is configured, unavailable or unqualified bindings stop execution.
- Fix the three live failures observed in reviewer 0.19.0. Use a short private temporary Unix-socket root, seal candidate receipt identity rejections, and admit verified byte-identical planning moves on record-only archive closure commits.
- Document persistent dedicated Codex worker authentication, role qualification and operator recovery, and update the affected skill and marketplace versions. Keep Hermes `advanced-delegation` an optional separately qualified implementer route.
- Select Task-Guided for this change. Review the local runtime first, then its delivery integration and documentation, then qualify the resulting route under separate live-run authority. The plan and its approach review do not grant execution.

## Capabilities

### New Capabilities

- `exclusive-worker-runtime` owns host-level claims, role isolation, bounded worker supervision and original-attempt reconciliation.

### Modified Capabilities

- `contained-independent-review` covers the Unix-socket, rejected-receipt and archive-preparation fixes.
- `openspec-integration` binds configured delegated delivery and ordered advancement to verified worker observations and exact-candidate evidence.

## Impact

The integrated baseline is `97a9f0afa64a435d41c36e45733645a031bfb6fe`, with Items 0, 0.5, 1 and 2 already integrated. The change affects the canonical orchestration, delivery and next skills, their test fixtures, applicable contributor ownership contracts, operator guides and the two existing marketplace bundles. Existing packaged reviewer commands and sealed handover contracts remain compatible with valid records. Projects without a selected delegated runtime keep their inherited policy.

The initial supported route must be proved on one Linux host with a dedicated sandboxed Codex implementer and a fresh OS-contained Claude reviewer. Other client/version/route/role combinations remain unsupported until qualified. Live tests, credentials or profile provisioning, relaxation of containment, an inline exception, `finish` and publication each require their applicable separate authority. This scope excludes a scheduler, distributed claims, new packages, installed-profile edits and automatic publication.
