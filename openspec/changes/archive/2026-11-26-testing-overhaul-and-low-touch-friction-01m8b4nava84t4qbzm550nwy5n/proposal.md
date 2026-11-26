---
metadata_version: 1
artifact: proposal
change: testing-overhaul-and-low-touch-friction-01m8b4nava84t4qbzm550nwy5n
github_issue: https://github.com/grewety/ai-coding-agent-skills/issues/65
---
# Testing overhaul and low-touch delivery

## Why

Launcher recovery flakiness and slow fixtures make the local gate costly to rerun. Worker timeouts, review spending limits and small post-review corrections can interrupt delivery even when the operator's approved outcome and safety boundaries still hold.

## What Changes

1. Make the killed-launcher recovery fixture deterministic. Parallelize independent work in the seven slow suites and target an approximately 8–12 second full test run under comparable conditions.
2. Set a 30-minute default Goal-First implementer attempt deadline, bounded by external configuration and the grant. Permit a bounded continuation only after a timed-out attempt leaves verified progress and settles safely.
3. Guide new reviewer setup to 96 turns and USD 2.50 per probe or packet. Support operator-signed mid-execution cap extensions against exact verified identities under integrated ceilings. A higher prospective project ceiling, such as USD 40, is optional and cannot increase this change's spending.
4. Allow a separately held named finish grant to reserve finite Aikido Deep Review credits across implementation and closure PRs and at most one verified zero-cost CI retry after a passed identical-SHA push check.
5. Verify post-review PR fixes and their disposition or delta re-review from a zero-waiver ancestor through finish readiness, protected finish and archive receipt readback.
6. Document the direct `node …/review-candidate.mjs` launch in skill and operator guidance for Codex Auto-review.
7. Support pinned `packetConcurrency` from 1 through 3, with a default of 1, staggered launches and independent read, relay and offline-audit evidence.
8. Discover the actual `grok` executable while preserving `grok-build` client references. Move the empirical backend suitability matrix into the repository and link it from the reviewer and worker guides.

Keep the conservative serial path for any optimization whose determinism, mutable-state isolation or reviewer isolation cannot be proved. Record the specific blocker and deliver the remaining verified behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `exclusive-worker-runtime` covers the bounded Goal-First attempt deadline and verified timeout continuation.
- `contained-independent-review` covers bounded packet concurrency and fail-closed review execution.
- `openspec-integration` covers test-gate stability, the review budget and finish grants, replayable PR-fix evidence, launch guidance and Grok discovery.

## Impact

Affected areas include the fixture suites and CI gate, paired runtime and reviewer packages, external setup and discovery, protected finish and evidence replay, and current project/operator documentation. The two affected Claude marketplace bundles and any affected skill versions change with their packaged sources. Existing reviewer pins, legacy client references and frozen evidence remain compatible. The source is Item 5.5 of the operator's charter. Its Item 5 predecessor is integrated at 2b5483033e693fbb3cb5402fb8374d085266e755.

## Goal Contract

```openspec-goal-contract
{
  "schemaVersion": 1,
  "outcome": "Deliver all eight Item 5.5 improvements to test determinism and throughput, bounded worker and review continuation, protected finish and PR-fix evidence, direct reviewer launch guidance, and Grok discovery and backend suitability documentation.",
  "scope": [
    "package.json",
    ".github/workflows",
    ".github/AGENTS.md",
    "tests",
    "AGENTS.md",
    "README.md",
    "docs",
    "skills/AGENTS.md",
    "skills/software-development/AGENTS.md",
    "skills/autonomous-ai-agents/AGENTS.md",
    "skills/software-development/openspec-delivery",
    "skills/autonomous-ai-agents/autonomous-implementation-review",
    "skills/software-development/openspec-next",
    ".claude-plugin/marketplace.json",
    "openspec/specs/exclusive-worker-runtime/spec.md",
    "openspec/specs/contained-independent-review/spec.md",
    "openspec/specs/openspec-integration/spec.md"
  ],
  "invariants": [
    "Preserve every test assertion and prove deterministic launcher recovery with isolated fixture HOME, Git configuration and mutable state, with no ambient fallback.",
    "Keep verified native OS workspace-write containment, exclusive claims and idle slots, one orchestrator for Git and tasks, identity-bound process-tree quiescence and sealed file handover. Continue only with verified in-scope progress and remaining wall-clock and correction authority.",
    "Keep pinned minimal-rootfs Bubblewrap unshare-all, read-only input, host-only Unix-socket credentials, independent packet sessions, complete whole-file Read audit and strict offline verification. Preserve existing host pins and historical evidence.",
    "Reserve the full upper charge atomically before any inference. An operator-signed extension of count and USD caps can apply only to the exact approved change, plan and durable ledger under integrated ceilings. Preserve accumulated use, holds, expiry, review scope and independent candidate acceptance.",
    "Finish caps require an exact separate authority, complete current trigger evidence and durable consumption. A zero-cost CI retry requires a verified transient failure and same-SHA successful push check and is capped at one. Require independently verified ancestry, exact gates and zero-waiver final coverage for PR fixes.",
    "Use the verified integrated parent for authority. Preserve all baseline protections and already frozen approvals. No plan or proposed default authorizes implementation, finish, external retries, new reviewer qualifications, or profile writes."
  ],
  "nonGoals": [
    "Item 5.2 live Grok or Pi qualification, OAuth or relay changes, runtime/provider replacement, tool installation and client profile changes.",
    "Publication, integration, release, deployment, branch push, or live proof of paid triggers under this planning invocation. Future live runs stay subject to their separately held authority.",
    "Broad test or workflow rewrites beyond the impacted suites and control boundaries, waived findings, approval bypass, or retroactive review-cap expansion."
  ],
  "adaptableAssumptions": [
    "The seven slow suites' serial fixture scheduling, the observed ten-minute implementer limit, and setup's five-dollar review guidance can evolve within verified bounds.",
    "Serial reviewer launch, launcher synchronization, sharding mechanics and evidence serialization may evolve within the required isolation and replay contracts. Retain serial operation with an exact blocker if safe parallel operation cannot be demonstrated.",
    "Ad hoc PR-fix notes and the grok-build executable assumption may change. Existing grok-build configuration identities and sealed historical records remain supported."
  ],
  "acceptance": [
    "Prove repeatable ESRCH-free launcher recovery and equal assertion coverage for all seven files. Measure comparable baseline and candidate npm test runs in isolated fixtures against the approximately 8–12 second target. Retain exact blockers and safe serial operation for unproved optimizations.",
    "Exercise a 30-minute Goal-First default, finite overrides and at most one same-outcome timeout continuation with verified progress, reconciled quiescence and retained authority. Reject stale or unsafe progress, overlap, scope drift and exhausted budgets.",
    "Verify new setup guidance at 96 turns and USD 2.50 per launch, including the probe in the upper bound. Test exact signed extensions, integrated ceilings, invalid signatures, mismatches, expiry, replay and concurrent reservations.",
    "Prove bundled finish credit use and one qualifying identical-SHA zero-cost CI retry, including refusal of unknown, non-transient, over-cap or mismatched events. Verify PR-fix ancestry, exact integration and archive replay, and zero-waiver coverage or full exact-head re-review.",
    "Show the direct Node review command, verify pinned serial compatibility and validated concurrency 1 through 3 with staggered launch, independent audits and HTTP 429/529 fail-closed evidence. Prove grok and legacy grok-build discovery and document Tier 1 suitability and qualification limits.",
    "Promote all three valid delta specs, synchronize affected current docs and owning contracts, bump affected skills and Claude bundles, and pass all command gates in a disposable exact-SHA checkout. Require zero-waiver independent candidate review with Verdict: No findings, 100 percent whole-file coverage and finishReadiness.ready equal to true before offering finish."
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
      "--check",
      "2b5483033e693fbb3cb5402fb8374d085266e755",
      "HEAD"
    ]
  ],
  "localAuthority": {
    "commits": true,
    "stop": "Stop at accepted local outcome, failed environment preflight, material goal, scope, authority or safety conflict, an ungranted live action, or exhausted budget. Retain evidence and present one operator decision."
  },
  "budgets": {
    "minutes": 240,
    "corrections": 10
  }
}
```
