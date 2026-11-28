---
metadata_version: 1
artifact: design
change: operator-prompting-docs-01m8fezeakft1fhnsjxjp1md27
---

# Design

## Context

The tutorial walks through change delivery, the role setup and the optional planning workflow. The runbook covers approval and protected closeout. The optional operations packages already ship a synthetic Change Brief and a qualified Herdr example. The new guidance needs to be useful across both surfaces without duplicating the underlying authority contracts.

The proposal-time Git readback verified `main` at `115db08d0ea972069565456fa5b527095a6334a5` and the [#84 implementation merge](https://github.com/grewety/ai-coding-agent-skills/pull/84) at `586970d246545846e57063a7f413c0523e25b593` as its ancestor. The [#85 archive merge](https://github.com/grewety/ai-coding-agent-skills/pull/85) at that main revision contains the archived proposal linking [#77](https://github.com/grewety/ai-coding-agent-skills/issues/77). Both merges name `release-train-operations-skills-01m8dqv8kqjt236es3t80x0syh`. The combined scope is pinned at proposal time.

## Goals / Non-Goals

Help a new adopter understand what to say, what the agent may handle, when the agent must stop, and what evidence to carry forward. Preserve the authoritative approval, local execution, finish and profile-sync contracts.

## Decisions

| Verified target on `main` | Role in the outcome |
| --- | --- |
| `docs/openspec-operator-tutorial.md` | Own the prompting rhythm, brief authoring, plain-language exceptions and Never Auto-Approves list, session and skill-loading advice, and Codex ergonomics. Keep the examples next to the existing walkthrough. |
| `docs/openspec-operator-runbook.md` | Link to the tutorial's Codex guidance from the operational flow. Keep the exact review and finish controls in the runbook and canonical references. |
| `skills/delivery-operations/wiki-delivery-sync/templates/change-brief.md` | Model a reviewable one-page brief with synthetic content and unchanged identity fields. |
| `skills/delivery-operations/release-train-supervisor/references/herdr.md` | Place the Local-CLI Trust-Boundary Filter and up-to-two-packet PR-fix planning tip beside the existing launch and monitoring example. State the portable decision logic with Herdr as the example adapter. |
| `skills/delivery-operations/wiki-delivery-sync/SKILL.md`, `skills/delivery-operations/release-train-supervisor/SKILL.md`, `.claude-plugin/marketplace.json` | Bump both canonical skill versions and the `delivery-operations` marketplace bundle from `1.0.0` to `1.0.1`. Verify complete bytes, metadata and membership from disposable build output. |
| `tests/claude-packaging.test.mjs` | Update the expected `delivery-operations` bundle version and preserve the existing inventory and package assertions. |
| `README.md`, `docs/openspec-workflow.md`, `docs/delivery-operations.md`, `docs/claude-installation.md` | Synchronize the current-source version pins for the bundle and both skills. Preserve the distinction between the source version and published availability. |
| `openspec/specs/openspec-integration/spec.md`, `openspec/specs/delivery-wiki/spec.md`, `openspec/specs/release-train-supervision/spec.md` | Promote the approved documentation requirements in the eventual candidate for protected finish, preserving unrelated requirements and spec identity. |

A docs-only rollout with the operations guidance deferred was the brief's fallback if #77 had been absent on the baseline. The verified dependency makes the public tutorial and its package examples a single reversible documentation outcome. Layout and phrasing remain adaptable within the Goal Contract. Exact command syntax in guidance is a user-facing example. The plan leaves editing techniques to the implementer.

## Risks / Trade-offs

- Readers may mistake a launch option, automatic review eligibility, example modifier or packet allowance for new authority. Check examples against the integrated workflow, preserve the standing trigger and paid-run boundaries, and require exact-candidate review.
- Local-CLI triage could be read as permission to dismiss findings. Keep concrete verifier integrity and custody failures actionable, preserve evidence and use the existing disposition process.
- The docs and packages may drift. Keep the tutorial and cross-link consistent. Compare the current-source pins and packaging test expectation with the canonical metadata, then verify the two skills and bundle from the same generated build.

## Migration Plan

No data migration or installed-profile changes are necessary for local acceptance. The separately authorized protected finish handles integration and closeout. Any later profile sync requires its own authority. If a published documentation problem needs repair, use the project's authorized revert or forward-correction workflow.

## Acceptance Boundaries

- **Planning.** Verify the source brief's exact change identity, the issue binding, the integrated dependency and the target paths above. Keep the native artifacts valid and limited to the agreed documentation, package metadata, test fixture and corresponding spec scope. Independently review the complete planning inventory under the integrated policy before the plan-only freeze.
- **Execution.** Demonstrate the three documentation deltas against the changed guides and generated packages. Pass `npm test`, `npm run build`, `openspec validate --all --strict`, `npm run validate:openspec -- --require-issue` and `git diff --check` on the exact candidate using the repository's gate procedure. Require independent exact-candidate review with zero findings. Publication, archive and issue closure belong to a separately authorized phase.
