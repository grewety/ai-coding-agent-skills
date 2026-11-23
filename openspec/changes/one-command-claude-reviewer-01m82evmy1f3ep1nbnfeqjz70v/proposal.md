---
metadata_version: 1
artifact: proposal
change: one-command-claude-reviewer-01m82evmy1f3ep1nbnfeqjz70v
github_issue: https://github.com/grewety/ai-coding-agent-skills/issues/43
---
# Proposal

## Why

Independent Claude Code reviews currently need a project-specific launcher and manual evidence plumbing. Package the qualified containment pattern and bind results to exact inputs, without turning runtime success into review acceptance.

## What Changes

- Add a portable, data-driven `review-candidate.mjs` entrypoint with `--probe`, `--prepare`, `--check`, run `--mode candidate|approach`, and `--verify` for a fresh OS-contained, Read-only Claude Code session and sealed file-based evidence.
- Support exact candidate review and Item 0.5 `charter-v1` approach review, including bounded oversized-diff packets, strict receipt/ledger admission and a zero-correction same-binding retry for malformed launch output. Replace the need for interim glue on the packaged route, not its authority checks.
- Harden the shared terminal adapter's process-tree termination/quiescence, output quotas/buffer admission and capture path safety (Aikido `1151615162`, `1151615159`, `1151615150`). Preserve existing interfaces and qualification boundaries.
- Ship operator setup and verification guidance. The packaged live trial is group 3 only, conditional on a separate explicit launch grant; this plan does not authorize it.

## Capabilities

### New Capabilities
- `contained-independent-review`: approved-input export, bounded read-only Claude review and sealed, independently verifiable evidence for candidate and approach modes.

### Modified Capabilities
- None. The existing `openspec-integration` requirements governing independence, plan review readiness and publication remain unchanged; the new capability supplies an optional review transport, not a new delivery gate.

## Impact

- Requires integrated `planning-gate-convergence-01m81n2ejqxmh656nxgppy5dne` and `upgrade-openspec-2-1-prerequisites-01m7zmrab0nw5t3fpmd0sm9tyw`; integrated planning parent `89476c06ceb461952584f6409827ee175fb42ba5`.
- Initial reviewer runtime: Linux/WSL with working Bubblewrap namespaces and pinned Claude Code. Offline packaging and synthetic fixtures remain portable; other clients are not extended or qualified by this change.
- Affects the autonomous review skill, shared adapter/publisher, tests and operator docs. Bump `autonomous-implementation-review` 0.18.0 → 0.19.0 and `autonomous-orchestration` 1.8.0 → 1.9.0 together. Preserve all five canonical packages, both bundles and the unaffected bundle version.
- Excludes orchestration expansion, automatic publication, real profile or credential configuration writes, policy bypass and OpenSpec update. If any required containment or provider route cannot be proved, stop rather than weaken controls or fall back. Exact-plan approval, execution, the packaged live trial and `finish` are distinct authorities.
