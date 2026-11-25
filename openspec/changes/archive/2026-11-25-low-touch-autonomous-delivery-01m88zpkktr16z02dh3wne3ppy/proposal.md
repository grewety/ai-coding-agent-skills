---
metadata_version: 1
artifact: proposal
change: low-touch-autonomous-delivery-01m88zpkktr16z02dh3wne3ppy
github_issue: https://github.com/grewety/ai-coding-agent-skills/issues/59
---
# Proposal

## Why

Item 4 exposed repeat reviews and operator stops for task completion, doomed packets, already-bounded work and routine repository automation. Item 4.5 addresses their deterministic causes while keeping exact-candidate evidence, contained review and operator decisions intact.

## What Changes

- Include bounded custom OpenSpec schema artifacts, such as `adr/*.md`, in planning, review, freeze, verification and archive. Preserve existing approval identity and exclude evidence and unsafe paths.
- Support finish readiness for a proven direct-child task checkbox commit over a zero-waiver reviewed parent. Keep exact-head checks for all other changes.
- Default paid contained-review authorization to `auto-approved`, with `explicit` available as a per-run override. Built-in defaults are 10 reviews and USD 25 total per change across `["planning", "execution", "finish"]`. Integrated-parent repository policy controls the mode, allowed phases, cap ceilings and standing $0 trigger allowlist. External host-owned configuration supplies the `host.json` `configurationSha256` pin and optional local harness binding.
- Add a tool-agnostic pre-PR security and logic harness for the exact committed candidate. Accept local CLI or MCP checks that emit sealed JSON before final review and PR push. Prepare Aikido as this repository's first local harness and standing $0 trigger example. Explain intentional issue non-auto-close in the closure PR body.
- Add offline reviewer packet and acceptance checks, repository-relative finding paths, bounded inter-packet pacing, and host-private upstream failure classes.
- Add a visual operator tutorial and a top-level README guide index. Document external role configuration and Intent-Driven schema interoperability. Prune obsolete active-document history while preserving live compatibility guidance and archived OpenSpec records.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `openspec-integration` covers bounded planning inventory, task acceptance, review authorization, the local harness, protected-finish triggers and operator guidance.
- `contained-independent-review` covers offline review feasibility, findings and acceptance scope, pacing and host-private diagnostics.

## Impact

Delivery and orchestration retain separate package ownership. Set the affected source and bundle versions together in the implementation candidate: `openspec-delivery` and `openspec-development` 1.7.0, `autonomous-implementation-review` 0.21.0 and `autonomous-orchestration` 1.11.0. Existing native schema and worker pins remain supported. Earlier frozen approvals keep their original policy and interpretation. The integrated dependency is `streamlined-operator-workflow-01m87kje8xgc5ge1nbydbf2pej` at `870cb731755a22a0eadde9e935418a7d142a4f94`.

The planning review covers inventory bounds, exact acceptance, review cap and configuration boundaries, the local harness and trigger admission, sandbox opacity, reviewer preflight, version synchronization and the documentation scope. Apply charter-v1 with three automatic plan correction cycles, no open in-scope High or Medium findings, and advisory Low findings. Stage 2, new reviewer backends and helper structure are outside that review scope. The integrated baseline requires separate single-run authorization for every live or paid launch on Item 4.5, including planning. The policy proposed here takes effect only for work governed by a verified adopting integrated parent.

## Goal Contract

```openspec-goal-contract
{
  "schemaVersion": 1,
  "outcome": "Deliver the Item 4.5 local outcome: reduce routine OpenSpec delivery stops with bounded custom-schema planning, verified task-tick finish readiness, bounded automatic paid review with a per-run override, contained reviewer preflight and diagnostics, a configurable local pre-PR harness, prospective standing $0 trigger admission, and current operator guides.",
  "scope": [
    "AGENTS.md",
    "README.md",
    "docs",
    "skills/AGENTS.md",
    "skills/software-development/AGENTS.md",
    "skills/software-development/openspec-delivery",
    "skills/autonomous-ai-agents/AGENTS.md",
    "skills/autonomous-ai-agents/autonomous-implementation-review",
    ".claude-plugin/marketplace.json",
    "openspec/specs/openspec-integration/spec.md",
    "openspec/specs/contained-independent-review/spec.md",
    "tests"
  ],
  "invariants": [
    "Only admit a single direct child of an independently reviewed and gated zero-waiver result as a completion commit when its sole byte edit is [ ] to [x] on accepted native task IDs, with identical file mode and unchanged plan digest. Preserve original review identity and run exact disposable gates on the finish head.",
    "Use the verified integrated parent for policy. Prospective trigger and paid-review policy stays inert for this change. Preserve exact plan approval, separate local execution and protected finish authority, and separate profile sync.",
    "Keep existing planning limits and path safety. Exclude evidence and dotfiles except native .openspec.yaml. Refuse incomplete, ambiguous or unsafe inventory. Preserve legacy approved identities and archived change packages.",
    "Default to 'auto-approved' for adopting integrated policy with finite per-change caps, defaulting to maxReviews 10 and maxTotalUsd 25 across planning, execution and finish. Repository mode, allowed phases, cap ceilings and the standing $0 trigger allowlist come from the integrated parent. Require the externally owned host.json configurationSha256 pin and durable pre-launch reservations. Fail closed on an absent or mismatched pin, missing effective caps, invalid or exceeded caps, or an unverified reservation. The optional 'explicit' override requires per-run approval.",
    "When configured, run the externally bound local CLI or MCP harness on the committed SHA before final review and PR push and verify its sealed JSON against that SHA. Keep Aikido integration in repository-local bindings and examples and keep portable skills vendor-neutral.",
    "Maintain OS containment, manifest-bound read-only review, whole-file coverage, and host-only sanitized status classes. Prevent provider error headers, bodies, credentials and diagnostic details from reaching the reviewer sandbox.",
    "Preserve the existing package roster and governance. Keep archived OpenSpec changes byte-identical, and synchronize affected skill and marketplace bundle versions and active documentation."
  ],
  "nonGoals": [
    "Stage 2 supervisor, autonomous retries, bot-thread adjudication, multi-change relay rotation, new reviewer or exclusive-worker backends, and mandatory external authoring schemas.",
    "Packaged agents, hooks or connectors, native in-process gate review, unguarded bulk apply, and proposal merges to main before implementation.",
    "Remote publication, integration, paid provider calls or profile sync through this local grant. Keep separate authority for each under the applicable integrated policy."
  ],
  "adaptableAssumptions": [
    "Helper and record field names, schema inventory representation within the specified bounds, bounded inter-packet delay value, local harness invocation shape, tutorial filename and placement, and fixture organization can change without changing admission or trust boundaries."
  ],
  "acceptance": [
    "Positive and negative tests cover custom-artifact coverage and vault exclusions, task-tick proofs, review modes, cap defaults and overrides, count/cost/pin reservations and phase boundaries, offline packet and acceptance validation, pacing and opaque provider error handling, local CLI and MCP result admission, and the integrated standing $0 trigger allowlist with a repository-local Aikido example.",
    "The visual guide includes Mermaid lifecycle and chat flows, reply examples, fresh-session guidance and human decisions. README indexes active guides. Role 1/2/3 configuration and schema interoperability are documented with supported pins and limits. Obsolete history is pruned while active upgrade and compatibility rules remain.",
    "Promote both capability deltas into valid current specs. Keep each changed file below 65,536 bytes, and keep the workflow guide comfortably below that ceiling. Ship openspec-delivery and openspec-development at 1.7.0 and autonomous-implementation-review at 0.21.0 with autonomous-orchestration at 1.11.0.",
    "Capture exact-SHA gates with disposable-gate-run and a sealed gate-run digest. Require a sealed zero-waiver exact-candidate independent Claude Code review, plus the narrowly verified direct-child proof and a fresh exact gate run if applicable under an already-integrated policy. For this change follow its inherited exact-head rules."
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
      "870cb731755a22a0eadde9e935418a7d142a4f94",
      "HEAD"
    ],
    [
      "python3",
      "-c",
      "import subprocess, sys\npaths = subprocess.check_output(['git', 'diff', '--name-only', '--diff-filter=ACMRT', '-z', sys.argv[1], 'HEAD']).split(b'\\0')\nfor path in filter(None, paths):\n    size = int(subprocess.check_output([b'git', b'cat-file', b'-s', b'HEAD:' + path]))\n    if size >= 65536:\n        sys.exit(f'{path!r}: {size} bytes exceeds changed-file ceiling')",
      "870cb731755a22a0eadde9e935418a7d142a4f94"
    ]
  ],
  "localAuthority": {
    "commits": true,
    "stop": "Stop at verified local outcome or on failed environment preflight, material goal, authority or safety conflict, missing separate run authority, or budget exhaustion. Preserve evidence and return one decision card."
  },
  "budgets": {
    "minutes": 240,
    "corrections": 10
  }
}
```
