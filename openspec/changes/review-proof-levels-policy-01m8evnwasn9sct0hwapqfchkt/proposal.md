---
metadata_version: 1
artifact: proposal
change: review-proof-levels-policy-01m8evnwasn9sct0hwapqfchkt
github_issue: https://github.com/grewety/ai-coding-agent-skills/issues/89
---

# Proposal

## Why

The current Direct-CLI finish gate requires structured whole-file read evidence. Projects that accept an exact receipt with workspace integrity and process settlement cannot currently use receipt-only clients through the full workflow.

## What Changes

- Add two selectable review proof levels. Level 1 (`receipt-only`) accepts verified receipts from supported clients. Level 2 (`whole-file-read`) additionally requires paired structured reads of every assigned file and remains the strict default.
- Apply the selection from the verified integrated plan parent through planning, execution, protected finish, closure and offline evidence replay. Include the actual proof level with review status, finish readiness and the closeout receipt.
- Use normal host authentication for Claude, Codex and Pi within the existing reviewer boundaries. Preserve and complete the fixed-enum native-output diagnostics, strengthen strict receipt-only framing guidance, and offer an opt-in bounded synthetic probe for reviewer upgrades.
- Update both skill packages and both affected marketplace bundles, including all current guide and test version pins.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `contained-independent-review` defines proof selection and replay, finish provenance, host authentication, diagnostic classification and the bounded probe.

## Impact

The verified planning baseline is `eb95501b39a8446ae25888c5f72a24ebda484413` on `main`. The exact local implementation file boundary is listed in the Goal Contract. The current `openspec-integration` export is 62,787 bytes with 701 bytes available. The review requirements reside in `contained-independent-review`, which starts at 13,813 bytes against 65,536 bytes. Planning acceptance includes disposable promotion and a byte-budget check.

The repository will document the selection and retain its strict default. The pre-minted brief identity and verified issue bind this proposal. The current authority covers planning, the one issue, independent planning review and one local plan freeze. Exact operator approval, bounded execution and protected finish each have their own authority.

## Goal Contract

```openspec-goal-contract
{
  "schemaVersion": 1,
  "outcome": "Let operators explicitly choose receipt-only or whole-file read proof for Direct-CLI review from planning through protected finish, with verifiable proof provenance and bounded reviewer diagnostics.",
  "scope": [
    "AGENTS.md",
    "skills/AGENTS.md",
    "skills/autonomous-ai-agents/AGENTS.md",
    "skills/software-development/AGENTS.md",
    "skills/autonomous-ai-agents/autonomous-implementation-review/SKILL.md",
    "skills/autonomous-ai-agents/autonomous-implementation-review/scripts/low-touch-policy.mjs",
    "skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-inputs.mjs",
    "skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-candidate.mjs",
    "skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-direct-adapters.mjs",
    "skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-direct-receipt.mjs",
    "skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-runtime.mjs",
    "skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-admission.mjs",
    "skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-stream.mjs",
    "skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-preflight.mjs",
    "skills/autonomous-ai-agents/autonomous-implementation-review/scripts/review-spend.mjs",
    "skills/autonomous-ai-agents/autonomous-implementation-review/references/review-candidate.md",
    "skills/software-development/openspec-delivery/SKILL.md",
    "skills/software-development/openspec-delivery/scripts/low-touch-policy.mjs",
    "skills/software-development/openspec-delivery/scripts/change-guard.mjs",
    "skills/software-development/openspec-delivery/scripts/delivery-policy.mjs",
    "skills/software-development/openspec-delivery/scripts/delivery-cli.mjs",
    "skills/software-development/openspec-delivery/scripts/delivery-status.mjs",
    "skills/software-development/openspec-delivery/scripts/operator-status.mjs",
    "skills/software-development/openspec-delivery/scripts/operator-planning.mjs",
    "skills/software-development/openspec-delivery/scripts/finish-readiness.mjs",
    "skills/software-development/openspec-delivery/scripts/protected-finish.mjs",
    "skills/software-development/openspec-delivery/scripts/pr-fix-lineage.mjs",
    "skills/software-development/openspec-delivery/references/low-touch.md",
    "skills/software-development/openspec-delivery/references/protected-finish.md",
    "skills/software-development/openspec-delivery/references/delivery-policy.md",
    "skills/software-development/openspec-delivery/references/evidence-retention.md",
    ".claude-plugin/marketplace.json",
    "README.md",
    "docs/claude-reviewer.md",
    "docs/configurable-backends.md",
    "docs/openspec-review-configuration.md",
    "docs/openspec-workflow.md",
    "docs/claude-installation.md",
    "docs/openspec-installation.md",
    "docs/worker-runtime.md",
    "docs/openspec-operator-runbook.md",
    "docs/openspec-operator-tutorial.md",
    "tests/claude-packaging.test.mjs",
    "tests/openspec-integration.test.mjs",
    "tests/openspec-routing.test.mjs",
    "tests/openspec-metadata.test.mjs",
    "tests/review-direct.test.mjs",
    "tests/review-direct-fixture.mjs",
    "tests/low-touch-review.test.mjs",
    "tests/low-touch-delivery.test.mjs",
    "tests/openspec-policy.test.mjs",
    "tests/planning-boundary.test.mjs",
    "tests/delivery-status.test.mjs",
    "tests/delivery-runtime.test.mjs",
    "tests/delivery-runtime-fixtures.mjs",
    "tests/protected-finish.test.mjs",
    "tests/item55-pr-fix-lineage.test.mjs",
    "tests/review-candidate.test.mjs",
    "openspec/specs/contained-independent-review/spec.md"
  ],
  "invariants": [
    "Recognize receipt-only solely through an explicit valid marker in the verified integrated plan parent. Keep whole-file read as the default for Direct-CLI parents and preserve the original pinned verifiers and schemas for legacy and earlier frozen records. An unknown, duplicate, inconsistent or unverified selection stops admission.",
    "At both levels require a fresh independent session, exact candidate SHA or complete raw planning identity, complete assigned packet digests, read-only invocation and unchanged workspace/export, verified process-tree settlement, strict receipt framing, and truthful findings. At Level 2 also require paired structured whole-file Read calls and responses matching every assigned file byte for byte.",
    "Retain the existing task-only child, PR-fix, protected finish, closure, gate, authorization and zero-waiver conditions. Evaluate completeness against the selected level only for adopting parents, never claim whole-file coverage for receipt-only proof, and link each actual reviewed SHA or plan to the sealed proof level.",
    "Use private host authentication without exposing host paths or credentials in packets or evidence and without relaxing reviewer capability or profile isolation. Probes are synthetic, separately authorized and bounded, and cannot qualify or accept a real review.",
    "Preserve archived plans and evidence, package membership, existing verification assertions and byte budgets. Keep delivery and review copies of shared policy logic byte-identical. Keep generated output untracked."
  ],
  "nonGoals": [
    "Changing the strict workflow for this proposal or any already frozen change, enabling a client that cannot meet native containment, or treating a probe or synthetic fixture as live qualification.",
    "Rewriting archived artifacts or installed profiles, using real provider credentials in tests, publishing, deploying, editing wiki records, or running live paid implementation probes under the local grant."
  ],
  "adaptableAssumptions": [
    "Evidence schema evolution, internal helper placement inside the enumerated file scope, diagnostic enumerations and the probe command shape may adapt if all proof, replay, privacy and authority guarantees still hold.",
    "Choose compatible version increments for both skills and bundles together. Update every listed baseline version pin and verify generated packages."
  ],
  "acceptance": [
    "Fixtures exercise successful receipt-only planning and exact-head and protected-finish paths for qualified Direct-CLI adapters, including Grok, Codex and Antigravity, and retain strict Claude whole-file acceptance. Reject receipt-only at Level 2, marker or host-pin mismatches, missing, stale or forged proof, weaker lineage and closure claims, and invalid receipt framing. Preserve legacy offline replay.",
    "Review status, finish readiness and the emitted and replayed closeout evidence/receipt.json retain the bound proof level and true reviewed identity, including accepted task-only children and any eligible PR-fix lineage. Distinguish missing proof, zero-waiver verdict and whole-file coverage.",
    "Host-auth Claude, Codex and Pi use their normal authentication without disclosing host information. Diagnostics remain actionable, fixed-enum and secret-free. A separately authorized one-file probe detects incompatible CLI/auth/output at a small finite cost and cannot substitute for full review. Framed-only prompts and parsing reject extraneous prose.",
    "Public documentation explains both levels, explicit selection, strict default, exact host pins, live qualification and probe boundaries. Both affected skills and both bundles publish synchronized versions across canonical manifests, all pinned guides and the assertions in tests/claude-packaging.test.mjs, tests/openspec-integration.test.mjs and tests/openspec-routing.test.mjs.",
    "Promote the contained-independent-review delta exactly. Verify every exported current spec fits its own byte cap, including openspec-integration at 63,488 and contained-independent-review at 65,536 bytes. Pass all declared commands on the exact candidate and obtain independent exact-candidate review with zero unresolved findings or waivers."
  ],
  "gates": [
    [
      "npm",
      "test"
    ],
    [
      "npm",
      "run",
      "build"
    ],
    [
      "openspec",
      "validate",
      "--all",
      "--strict"
    ],
    [
      "npm",
      "run",
      "validate:openspec",
      "--",
      "--require-issue"
    ],
    [
      "git",
      "diff",
      "--check"
    ]
  ],
  "localAuthority": {
    "commits": true,
    "stop": "Stop at the exact independently accepted local candidate ready for separately authorized protected finish, or at material drift, an unresolved verification or authority boundary, or exhausted budget."
  },
  "budgets": {
    "minutes": 30,
    "corrections": 3
  }
}
```
