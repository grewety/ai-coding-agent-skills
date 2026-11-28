---
metadata_version: 1
artifact: proposal
change: operator-prompting-docs-01m8fezeakft1fhnsjxjp1md27
github_issue: https://github.com/grewety/ai-coding-agent-skills/issues/86
---

# Proposal

## Why

External adopters need a public walkthrough for writing short operator prompts, authoring reviewable goals and briefs, responding to exceptions, and launching Codex with the right scope. The operator tutorial can make these decisions visible without requiring the project's private wiki.

## What Changes

- Expand the tutorial with a three- or four-turn intent-first rhythm, exception modifiers, brief-writing rules, a plain-language exception flow and Never Auto-Approves list, and fresh-session rollover and skill-loading checks. Add Codex CLI approval ergonomics and link to it from the operator runbook.
- Include the optional operations guidance. Read-only live Git verified `main` at `115db08d0ea972069565456fa5b527095a6334a5`. The archived proposal binds `release-train-operations-skills-01m8dqv8kqjt236es3t80x0syh` to [#77](https://github.com/grewety/ai-coding-agent-skills/issues/77). Its implementation merge [#84](https://github.com/grewety/ai-coding-agent-skills/pull/84) is an ancestor of that head, which is the archive merge [#85](https://github.com/grewety/ai-coding-agent-skills/pull/85). The verified brief's fail-closed alternative is to ship the two docs standalone and defer package alignment if that dependency is absent at proposal time. The verified baseline selects the combined scope.
- Update the Change Brief template and the Supervisor reference. Bump both skill versions and the `delivery-operations` bundle from `1.0.0` to `1.0.1`. Synchronize the packaging test and all current documentation that states these versions, and verify the generated packages.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `openspec-integration` adds public operator prompting, exception handling, rollover and Codex CLI guidance.
- `delivery-wiki` adds outcome and review criteria for the portable Change Brief template.
- `release-train-supervision` adds guidance on local verifier findings and bounded PR-fix delta review planning.

## Impact

| Purpose | Exact target files verified on the integrated baseline |
| --- | --- |
| Operator guidance | `docs/openspec-operator-tutorial.md`, `docs/openspec-operator-runbook.md` |
| Portable brief and package metadata | `skills/delivery-operations/wiki-delivery-sync/templates/change-brief.md`, `skills/delivery-operations/wiki-delivery-sync/SKILL.md` |
| Supervisor reference and package metadata | `skills/delivery-operations/release-train-supervisor/references/herdr.md`, `skills/delivery-operations/release-train-supervisor/SKILL.md` |
| Bundle version | `.claude-plugin/marketplace.json` |
| Packaging test version expectation | `tests/claude-packaging.test.mjs` |
| Current-source version documentation | `README.md`, `docs/openspec-workflow.md`, `docs/delivery-operations.md`, `docs/claude-installation.md` |
| Current-spec promotion in the eventual candidate | `openspec/specs/openspec-integration/spec.md`, `openspec/specs/delivery-wiki/spec.md`, `openspec/specs/release-train-supervision/spec.md` |

The scope covers documentation, packaging metadata and the corresponding test fixture. It preserves installed commands, policy, runtimes and package membership. Verify generated artifacts in disposable build output. The refreeze authority covers independent planning review and a local plan-only freeze for the existing issue binding. Exact operator approval, bounded local execution and protected finish have separate authority.

## Goal Contract

```openspec-goal-contract
{
  "schemaVersion": 1,
  "outcome": "Publishable operator prompting and Codex ergonomics guidance with the verified delivery-operations template and Supervisor reference aligned.",
  "scope": [
    "docs/openspec-operator-tutorial.md",
    "docs/openspec-operator-runbook.md",
    "skills/delivery-operations/wiki-delivery-sync/templates/change-brief.md",
    "skills/delivery-operations/wiki-delivery-sync/SKILL.md",
    "skills/delivery-operations/release-train-supervisor/references/herdr.md",
    "skills/delivery-operations/release-train-supervisor/SKILL.md",
    ".claude-plugin/marketplace.json",
    "tests/claude-packaging.test.mjs",
    "README.md",
    "docs/openspec-workflow.md",
    "docs/delivery-operations.md",
    "docs/claude-installation.md",
    "openspec/specs/openspec-integration/spec.md",
    "openspec/specs/delivery-wiki/spec.md",
    "openspec/specs/release-train-supervision/spec.md"
  ],
  "invariants": [
    "Preserve existing OpenSpec authority, exact-plan approval, protected finish and independent review rules.",
    "Keep tracked artifacts and packaged examples free of machine-local paths, usernames, credentials and private host configuration.",
    "Preserve all archived records and keep generated build output untracked.",
    "Synchronize the two affected skill versions and the delivery-operations bundle at 1.0.1 across source metadata, the packaging test and current documentation in the same candidate. Preserve package membership and existing packaging assertions."
  ],
  "nonGoals": [
    "Runtime, review transport, change-guard, protected-finish or policy enforcement changes.",
    "Superseded Tier A/B containment or unbuilt Stage 2 dispatcher documentation.",
    "Remote publication, release, wiki edits or live profile installation and sync under local execution authority."
  ],
  "adaptableAssumptions": [
    "Existing operator tutorial and runbook section order, headings and phrasing may change to make the guidance clear and minimize duplication."
  ],
  "acceptance": [
    "The public tutorial and runbook cross-link cover all approved guidance and keep consequences and approvals accurate.",
    "The portable wiki template and Supervisor reference contain the selected operations guidance. The marketplace version expectation, current documentation and generated package metadata match the canonical source versions at 1.0.1, and the complete generated package bytes and bundle membership are verified.",
    "The matching native deltas are promoted without changing unrelated requirements.",
    "All declared exact-candidate commands pass and independent exact-candidate review has zero findings under the pinned review policy."
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
    "stop": "Stop at an exact accepted local candidate ready for separately authorized protected finish, or at material drift, an unresolved verification or authority boundary, or exhausted budget."
  },
  "budgets": {
    "minutes": 30,
    "corrections": 3
  }
}
```
