---
metadata_version: 1
artifact: proposal
change: direct-cli-reviewer-simplification-01m8deqc2446agfqswc0cb0gex
github_issue: https://github.com/grewety/ai-coding-agent-skills/issues/74
---

# Direct-CLI independent reviewer simplification

## Why

Independent review currently requires Linux-specific isolation, credential relay setup, and exact OS driver and library pins. A single Direct-CLI route will use the operator's installed clients and normal authentication across Linux, Windows and macOS.

## What Changes

- **BREAKING** Retire default sealed Tier A and dedicated-auth Tier B review, the corresponding setup and driver choices, and wrapped implementer pilots that depend on retired drivers. Preserve independently qualified native implementer isolation and supervision.
- Run fresh review sessions through `claude`, `codex`, `grok`, `pi`, `hermes`, `opencode`, `kilo` and `agy`. Require a disposable packet copy, unchanged worktree evidence, bounded process-tree settlement and strict offline receipt verification.
- Keep reviewer setup to client, model, optional reasoning effort, timeout and packet concurrency. Keep detection read-only and keep low-touch pacing and spend limits.
- Retire obsolete active code, tests, docs and current requirements. Preserve historical plan and receipt identity under the original policy. An exact legacy receipt field may remain only when removing it would break fail-closed delivery or finish replay and the minimal boundary is documented.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `contained-independent-review` replaces the transport contract and retains exact evidence acceptance.
- `exclusive-worker-runtime` separates Direct-CLI review from native implementer qualification and retires tier-bound routes.
- `openspec-integration` updates setup, authority, review and synchronized package acceptance.

## Impact

The packaging and documentation gate covers `README.md`, `AGENTS.md`, `docs/configurable-backends.md`, `docs/claude-reviewer.md`, `docs/worker-runtime.md`, `docs/claude-installation.md`, `docs/openspec-installation.md`, `docs/openspec-workflow.md`, `docs/openspec-review-configuration.md`, `docs/openspec-operator-runbook.md`, `docs/openspec-operator-tutorial.md`, `skills/AGENTS.md`, `skills/autonomous-ai-agents/AGENTS.md`, and `skills/software-development/AGENTS.md`. Retire `docs/containment-tiers.md`. Synchronize packaged references, tested command examples and advertised file inventories. Bump `autonomous-implementation-review` and `openspec-delivery` skill versions, plus `openspec-next` for its synchronized routing reference. Bump the `autonomous-orchestration` and `openspec-development` marketplace bundle versions.

Item 8 inherits policy at `7c3fbec282b58d2fa1227f76ab81fe8078067aec`. Its own reviews use the pinned 0.25.0 Claude 2.1.330 reviewer and the operator's external configuration, identified by SHA-256 `bb71a156d9c8e537cfe510401813cc88334456e213e9b314b67b1b2c48d03b0c`, concurrency 2, and `maxBudgetUsd: 2.5` per invocation. Budget for the automatic probe and every data-bearing packet before launch. One probe plus one packet reserves USD 5.00. Use the standalone Node review command under integrated low-touch ceilings of 10 reviews and USD 25. Retain three planning corrections separately from the ten proposed local corrections. Exact-plan approval, a separate local grant, protected finish and out-of-cap paid or external work stay with the operator.

## Goal Contract

```openspec-goal-contract
{
  "schemaVersion": 1,
  "outcome": "Replace active Tier A/B reviewer and setup machinery with one default Direct-CLI Independent Reviewer on Linux, Windows and macOS, preserving exact review evidence, delivery and finish integrity, and archive immutability.",
  "scope": [
    "AGENTS.md",
    "README.md",
    "docs/containment-tiers.md",
    "docs/configurable-backends.md",
    "docs/claude-reviewer.md",
    "docs/worker-runtime.md",
    "docs/claude-installation.md",
    "docs/openspec-installation.md",
    "docs/openspec-workflow.md",
    "docs/openspec-review-configuration.md",
    "docs/openspec-operator-runbook.md",
    "docs/openspec-operator-tutorial.md",
    "skills/AGENTS.md",
    "skills/autonomous-ai-agents/AGENTS.md",
    "skills/software-development/AGENTS.md",
    "skills/autonomous-ai-agents/autonomous-implementation-review",
    "skills/software-development/openspec-delivery",
    "skills/software-development/openspec-next/SKILL.md",
    "skills/software-development/openspec-next/references/routing.md",
    ".claude-plugin/marketplace.json",
    "tests",
    "openspec/specs/contained-independent-review/spec.md",
    "openspec/specs/exclusive-worker-runtime/spec.md",
    "openspec/specs/openspec-integration/spec.md"
  ],
  "invariants": [
    "Each reviewer invocation is fresh and independent, uses only the assigned disposable packet copy outside the repository as its review workspace, and verifies the real checkout was untouched before and after, including on failed launches.",
    "Every invocation has a finite wall-clock bound and requires proven process-tree settlement. Failed checks or uncertain settlement prevent acceptance.",
    "Strict offline --verify binds one BEGIN_REVIEW_RECEIPT / END_REVIEW_RECEIPT frame to the exact candidate SHA, packet inventory, verdict and findings. Claim whole-file coverage only for independently verified structured Read events.",
    "Keep packet concurrency 1–3, inter-packet pacing, durable low-touch spend accounting and inherited pending approval and finish authority intact.",
    "Preserve openspec/changes/archive/ and Git history byte-for-byte. Use synthetic, profile-isolated test fixtures with no ambient profile fallback.",
    "The verified integrated parent and pinned Claude govern Item 8's own reviews. Future defaults take effect only under an adopting integrated parent."
  ],
  "nonGoals": [
    "Change the exclusive implementer's native workspace-write, claim, ownership, evidence or settlement guarantees.",
    "Rewrite archived changes, prior evidence or Git history. Modify installed profiles, credentials or historic approvals.",
    "Grant execution, publication, protected finish or external trials outside applicable bounded review authority."
  ],
  "adaptableAssumptions": [
    "Tier A/B reviewer isolation, pinned libraries, auth relay, dedicated reviewer homes and driver identity cease to be active transport requirements. Retain an exact previously required receipt field only when a single-change migration cannot preserve delivery or finish integrity, and document the minimal fail-closed compatibility boundary.",
    "Choose adapter and OS supervision mechanics within the approved observable controls and platform evidence requirements."
  ],
  "acceptance": [
    "All five documented commands pass from the disposable exact candidate and the candidate patch also passes git diff --check against its base.",
    "Deterministic native tests on Linux, Windows and macOS cover all eight adapter command forms, fresh disposable packet/worktree checks, timeout and settlement, strict receipt replay and minimal setup. Distinguish fixture support from separately authorized live qualification.",
    "Remove obsolete active modules, fixtures, dependencies, tier assumptions and links. Verify package inventory, version bumps and every documented synchronization path. Reduce the integration spec to at most 63,488 UTF-8 bytes.",
    "Obtain the inherited exact-candidate independent Claude No findings verdict and 100% file coverage with zero waivers, followed by finishReadiness.ready === true on the eligible exact head."
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
    "stop": "Stop at verified local finish readiness or on failed environment preflight, unresolved safety/authority/goal conflict, unproved required verification or exhausted budget. Protected finish requires separate operator authority."
  },
  "budgets": {
    "minutes": 120,
    "corrections": 10
  }
}
```
