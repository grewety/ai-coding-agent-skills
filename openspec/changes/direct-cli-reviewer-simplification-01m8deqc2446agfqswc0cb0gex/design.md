---
metadata_version: 1
artifact: design
change: direct-cli-reviewer-simplification-01m8deqc2446agfqswc0cb0gex
---

# Design

## Context

The review entry point already separates packet preparation, launch, replay, and delivery acceptance. Its current host and receipt schema couples these stages to sealed Linux runtime pins or an explicit dedicated-auth driver. Both installable packages ship matching setup and policy modules. The Claude ZIP and well-known endpoint tests assert specific files, versions and command examples.

## Goals / Non-Goals

Use one portable review transport and preserve exact, independently replayable evidence for planning, candidate and closure consumers. The worktree remains under orchestrator ownership. Exclusive implementer admission retains its distinct native workspace-write and settlement controls, and active approvals retain their original policy.

## Decisions

- Keep transport selection in a trusted installed-client adapter registry. The selected launch gets a fresh session and a separate inventory-verified disposable packet copy outside the repository. Run in the copy, allow only the supported review capabilities, and keep credentials, host paths and unrelated files out of the packet and durable evidence. Setup previews normal host authentication and refuses incompatible settings and unsafe external destinations.
- The run supervisor owns the preflight state, finite deadline, termination and postflight check, including starts that fail and cases where the leader exits before children settle. Compare HEAD, index/worktree status and the content identity needed to detect edits that keep the same status. Preserve and report a changed checkout for operator disposition. Native implementation mechanics can vary by OS if the same controls are proved.
- Separate receipt validation from coverage evidence. Verify the complete native frame, exact candidate or approach identity, assigned file inventory, effective session, verdict, findings, and settlement against the retained expectation. Use structured whole-file Read assertions where supported and label other acceptances receipt-only. Review-dependent gates that require audited coverage still require it.
- Keep phase authority, reservation and replay separate. Reserve the known applicable provider cost before contact and retain caps through concurrent launches, failures and recovery. Preserve the exact existing gate lineage, evidence identities and task-completion exception. If a receipt field remains indispensable, isolate and verify that minimal compatibility adapter. A verified earlier parent continues to use its original pinned runner and original sealed captures outside the new active transport.

## Risks / Trade-offs

- Direct CLI uses normal user permissions and authentication. Packet scoping, restricted review capabilities and pre/post validation give isolation of assigned inputs and detect checkout drift. They do not enforce an OS sandbox or prove that a malicious process never acted outside the packet. Design tests around the claims made.
- A process can outlive its leader or a receipt can overstate coverage. Require positive and negative native process-tree tests and independent receipt replay. Refuse an unsettled process or incomplete evidence.
- Adapter flags, version discovery and host authentication vary. Use deterministic fake clients with isolated profiles for the matrix and native process controls on all three OSes. Report any unavailable or unsupported live route with its exact blocker. Live client trials outside the inherited review authority require a separate grant.

## Migration Plan

- Retire reviewer-only `review-relay.mjs`, `review-sandbox-bridge.mjs`, `review-runtime-scratch.mjs`, `review-grok-offline.mjs` and `containment-linux-offline.mjs` where the replacement supersedes them. Remove `containment-tier.mjs` and `windows-containment-preflight.mjs` from both packages, including obsolete Bubblewrap, minimal-rootfs shared library, relay, Windows container/WSL2, macOS Seatbelt and dedicated-reviewer-auth interfaces. Reduce legacy Pi relay qualification and shared Pi/setup, worker bindings, admission, handoff, recovery and replay to their supported current responsibilities. Replace the reviewer transport in `review-runtime.mjs` and `review-candidate.mjs` and retire unused helpers and imports. Preserve native implementer qualification and stop driver-only assignments before product dispatch.
- Replace `tests/containment-tiers.test.mjs`, `tests/review-runtime-socket.test.mjs`, `tests/review-tier1-fixture.mjs`, `tests/tier1-review.test.mjs`, `tests/tier1-native-pi.test.mjs` and tier-only cases in `tests/tier1-qualification.test.mjs`, `tests/review-candidate.test.mjs`, `tests/agent-setup.test.mjs`, `tests/implementer-runtime.test.mjs` and delivery/low-touch fixtures. Update `tests/claude-packaging.test.mjs` and `tests/well-known-skills.test.mjs`, `tests/documentation.test.mjs`, and any runner inventory. Preserve unrelated assertions and shared evidence contracts.
- Retire `docs/containment-tiers.md`. Check the proposal's synchronized guide inventory, the operator workflow and tutorial, reviewer and openspec-next routing references, launch commands, and package links. Keep `docs/claude-reviewer.md` as the documented reviewer guide path to preserve existing inbound links. Prune expired pilot narratives in active files. Sync all three capability deltas at the exact candidate, retain current spec identity frontmatter and prove the integration spec size against the explicit budget.
- Activate this default prospectively at protected integration. Existing pinned reviews and receipts retain their original full identity and route. A recovery or rollback uses the authorized protected path and retained package or evidence. Local implementation preserves the entire archive tree. Any eventual closeout that would write there is a separate operator decision under the original policy.
