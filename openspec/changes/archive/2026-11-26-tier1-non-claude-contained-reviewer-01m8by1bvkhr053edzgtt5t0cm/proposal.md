---
metadata_version: 1
artifact: proposal
change: tier1-non-claude-contained-reviewer-01m8by1bvkhr053edzgtt5t0cm
github_issue: https://github.com/grewety/ai-coding-agent-skills/issues/68
---
# Tier 1 non-Claude contained reviewer

## Why

Claude Code is the sole qualified contained reviewer. A second independently qualified route would let operators choose a different reviewer provider while preserving the same isolation and receipt evidence.

## What Changes

- Evaluate Grok 1.0.92 with grok-4.7 and host-side xAI OAuth first. Qualify a host-side api.x.ai key relay or Pi 1.5.2 with Hermes proxy xAI OAuth or an api.x.ai key relay if the primary route fails closed. Require a separate bounded live qualification grant and seal exact unsupported dispositions for failed routes.
- Bind role qualification to the exact client, provider, model, effective settings and runtime. Require a private host-side inference socket, minimal-rootfs Bubblewrap, single-tool read-only operation, complete whole-file audits and strict offline receipt replay.
- Report the actual Grok version for the legacy grok-build discovery identity and preserve existing pins, captures, spending and scheduling behavior.
- Synchronize the current specs, documentation, owning contracts and affected distribution versions.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `contained-independent-review` gains optional Grok and Pi qualification with host-only authentication and complete native stream replay.
- `openspec-integration` extends explicit reviewer role setup and fixes reported version discovery for modern and legacy Grok binaries.

## Impact

The affected surfaces are the orchestration reviewer runtime and audit, shared external discovery/setup and qualification modules in orchestration and delivery, deterministic fixture tests, the two current capability specs, and installation and workflow guidance in the README and owning documentation. Version both affected skill packages and their Claude bundles. The existing exclusive worker assignment requirements and default Claude route continue to apply. The charter's external host pin remains outside the repository.

## Goal Contract

```openspec-goal-contract
{
  "schemaVersion": 1,
  "outcome": "Deliver and live-qualify an opt-in Tier 1 non-Claude contained read-only reviewer, preferring pinned Grok with host-only xAI OAuth, or retain an exact unsupported disposition after the authorized qualification routes fail closed.",
  "scope": [
    "skills/autonomous-ai-agents/autonomous-implementation-review",
    "skills/software-development/openspec-delivery",
    "tests",
    "docs/configurable-backends.md",
    "docs/claude-reviewer.md",
    "docs/openspec-review-configuration.md",
    "docs/claude-installation.md",
    "docs/openspec-installation.md",
    "docs/openspec-workflow.md",
    "docs/worker-runtime.md",
    "README.md",
    "AGENTS.md",
    "skills/AGENTS.md",
    "skills/autonomous-ai-agents/AGENTS.md",
    "skills/software-development/AGENTS.md",
    ".claude-plugin/marketplace.json",
    "openspec/specs/contained-independent-review/spec.md",
    "openspec/specs/openspec-integration/spec.md"
  ],
  "invariants": [
    "Pin Grok 1.0.92 and grok-4.7 for the primary route. Attempt subscription inference through host-only xAI OAuth over a private inference.sock. If the primary route cannot meet all controls, refuse it and evaluate a separately authorized host-side api.x.ai key relay or pinned Pi 1.5.2 with Hermes proxy xAI OAuth or host-side api.x.ai key relay. Keep the existing Claude route as the sole qualified reviewer if no alternative passes.",
    "Require a pinned minimal-rootfs Bubblewrap --unshare-all reviewer, no direct internet, read-only /review, isolated scratch, and a host-owned Unix-socket inference relay as the only provider path. Host HOME, Grok and Pi profiles, credentials, refresh tokens, and raw auth headers never enter the sandbox, its argv or environment, or retained captures. A non-secret sentinel may identify the loopback bridge. Sanitize upstream diagnostics.",
    "Expose only Read or read. Disable shell, writes, web search, MCP, plugins and extensions, skills, memory, subagents, and ambient context and session files. Enforce finite turn or relay request ceilings, bounded wall-clock and capture, and fail-closed supervision. Require each assigned file to be read completely, including with parallel Reads, and verify the exact mode-specific BEGIN_REVIEW_RECEIPT and END_REVIEW_RECEIPT offline against raw sealed evidence.",
    "Already qualified Claude Code 2.1.330 schemaVersion 1 host pins claude-2.1.330-turns96.json and claude-2.1.330-turns96-p2-b25.json and retained captures remain valid and byte-compatible without migration or baseline replacement. Preserve concurrency 1 through 3, legacy serial default, packet isolation and existing low-touch spend accounting. Keep tests isolated from ambient profiles.",
    "A non-Claude role stays unsupported unless exact binding proves effective offline and bounded live controls. The new route is opt-in; preserve the current default, independent role selection, and existing authority boundaries."
  ],
  "nonGoals": [
    "Changing the project default reviewer, altering frozen approvals, migrating existing Claude pins or historical captures, client or profile installation, and unrelated worker role changes.",
    "Implementation, task changes, publication, integration, release, or any live xAI or Grok qualification under the planning invocation. Qualification requires a later explicit trial grant for each applicable route; plan approval and local execution authority alone do not grant it."
  ],
  "adaptableAssumptions": [
    "Claude-specific runtime, relay, stream and bridge internals may evolve within the existing compatibility, isolation and replay invariants. The host-side relay implementation and supported fallback selection depend on evidence from the pinned clients.",
    "The legacy grok-build identity remains valid. Its version parser may evolve to accept Grok 1.0.92's observed suffixed output.",
    "Claude-only reviewer setup and qualification assumptions may evolve for explicit non-Claude bindings. Synchronized shared setup modules remain compatible and byte-identical across both distributed packages."
  ],
  "acceptance": [
    "Exercise synthetic positive and negative controls for minimal-rootfs isolation, read-only input, exclusive socket egress, zero credential leakage, single-tool operation, turn or request limits and deadline, whole-file concurrent stream audit, valid and malformed receipts, fail-closed fallback and exact qualification. Cover Grok and legacy grok-build discovery without installs or inference, including the observed stable version format.",
    "Under an explicit bounded live trial grant, retain synthetic proof for actual Grok 1.0.92 grok-4.7 with host xAI OAuth or a permitted key-relay or Pi 1.5.2 fallback. Prove containment, whole-file reads and strict offline --verify on the same handover. If permitted routes fail, seal exact unsupported dispositions with the observed blockers and report options. Absence of authority pauses qualification.",
    "Replay established Claude host and capture fixtures unchanged and prove concurrency 1, 2 and 3 and durable spend compatibility. Promote the deltas to current specs, synchronize affected documentation and contributor contracts, and bump both affected skills and Claude bundles.",
    "Run all command gates in a disposable exact-SHA checkout. Require zero-waiver independent Claude review with Verdict: No findings and 100 percent whole-file coverage, and finishReadiness.ready === true before offering protected finish."
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
      "5cc3f27b4b527576de2e6a59489b3f93376ff182",
      "HEAD"
    ]
  ],
  "localAuthority": {
    "commits": true,
    "stop": "Stop at verified local outcome, environment preflight failure, material goal, authority or safety conflict, ungranted live trial, or exhausted budget. Retain evidence and present one operator decision."
  },
  "budgets": {
    "minutes": 240,
    "corrections": 10
  }
}
```
