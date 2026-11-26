---
metadata_version: 1
artifact: proposal
change: tiered-cross-platform-os-containment-01m8cnxjetveec864xxmbp7vyb
github_issue: https://github.com/grewety/ai-coding-agent-skills/issues/71
---
# Tiered cross-platform OS containment

## Why

The current contained reviewer relies on a sealed host-side relay, which some subscription-authenticated clients cannot use. Operators need a simpler way to set up that sealed route and an explicit dedicated-auth route with enforceable filesystem and review boundaries.

## What Changes

- Keep the current default Claude Tier A route and byte-compatible replay. Add opt-in Tier B, with hidden ambient home, scoped dedicated authentication and the same review integrity guarantees.
- Put `linux-bwrap` first. Expose optional `windows-container` test wiring callable from WSL2 or native Windows with required Windows-client checks before tests start. Document `macos-seatbelt` as an optional fail-closed native contract. Raise the reviewer `timeoutMs` ceiling to 600000 with a 300000 default.
- Add one-command `setup.mjs` tier previews and exact confirmation. During separately granted execution, qualify pinned Grok 1.0.92 as a Tier B reviewer and Codex 0.172.0 as a native implementer, or preserve sealed unsupported dispositions with the exact failing controls. Make Tier B OS workspace-write available to eligible non-Codex implementers subject to exact qualification.
- Synchronize both complete packages, both Claude bundle versions, current specs and owning contributor contracts. Cover `docs/containment-tiers.md`, `docs/configurable-backends.md`, `docs/claude-reviewer.md`, `docs/worker-runtime.md`, `docs/claude-installation.md`, `docs/openspec-installation.md`, `docs/openspec-workflow.md`, `docs/openspec-review-configuration.md`, `README.md` and `AGENTS.md`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `contained-independent-review` adds tier-bound containment, driver admission, exact dedicated-auth review and evidence replay.
- `exclusive-worker-runtime` adds tier-bound implementer containment and native Codex qualification without nested sandboxing.
- `openspec-integration` adds tier-aware external setup, synchronized publication documentation and native platform qualification gates.

## Impact

The orchestration and delivery packages share setup and role configuration. Candidate acceptance includes the built packages and updated installation and workflow guides. Legacy pins and captures stay under their original reader and admission semantics. The integrated parent is `39606f64b148ffad3b7fa7d268f5eb64a7868097`. Goal-First execution has one native outcome and ten corrections. Charter-v1 planning has three convergence cycles. The operator retains decisions about changing the goal, weakening hard invariants, replacing the default reviewer, granting local execution, approving paid trials outside integrated limits, accepting budget exceptions and authorizing protected finish.

## Goal Contract

```openspec-goal-contract
{
  "schemaVersion": 1,
  "outcome": "Deliver explicit Tier A and Tier B OS containment with easy setup, a Linux-first driver model, fail-closed optional Windows and macOS contracts, and exact Linux pilot qualification or sealed unsupported dispositions.",
  "scope": [
    "skills/autonomous-ai-agents/autonomous-implementation-review",
    "skills/software-development/openspec-delivery",
    "tests",
    "docs/containment-tiers.md",
    "docs/configurable-backends.md",
    "docs/claude-reviewer.md",
    "docs/worker-runtime.md",
    "docs/claude-installation.md",
    "docs/openspec-installation.md",
    "docs/openspec-workflow.md",
    "docs/openspec-review-configuration.md",
    "README.md",
    "AGENTS.md",
    "skills/AGENTS.md",
    "skills/autonomous-ai-agents/AGENTS.md",
    "skills/software-development/AGENTS.md",
    ".claude-plugin/marketplace.json",
    "openspec/specs/contained-independent-review/spec.md",
    "openspec/specs/exclusive-worker-runtime/spec.md",
    "openspec/specs/openspec-integration/spec.md"
  ],
  "invariants": [
    "Keep Claude Code 2.1.330 Tier A as the default contained reviewer. Tier A exposes zero real credentials to the reviewer, uses private scratch and read-only review input, denies direct network access, and reaches inference only through the independently pinned host-owned relay. Both original schemaVersion 1 host files and retained captures remain valid byte-for-byte under their original pins. Preserve already qualified routes and existing scheduling, spend and authority rules.",
    "Require explicit Tier B opt-in. Both tiers bind containmentTier and osDriver in newly generated host.json, launch.json, status.json and receipt.json. Reject mismatches, unknown or unqualified drivers, and every silent downgrade. Existing schemaVersion 1 inputs and receipts need no added bytes.",
    "Tier B uses OS-enforced masking of the ambient home, credentials, configuration and skills, read-only system inputs, role-scoped scratch, and only a verified private 0700 auth-only directory for dedicated client authentication. A reviewer sees an OS-read-only /review export. An implementer may write its named worktree within approved scope and must protect task state, Git state and handoffs. Only the qualified provider route is allowed for direct HTTPS and necessary auth, and secret values stay out of argv, environment, exports, diagnostics and retained evidence.",
    "Reviewers expose a single native whole-file read tool (Claude Read, Grok read_file). Deny shell, writes, web search, memory, planning, subagents, ambient skills and external tools. Bound turns, elapsed time and capture. Require 100 percent whole-file native-stream coverage with exact request-result and packet association and strict framed offline --verify. Fail closed before export exposure if preflight or binding fails, and withhold acceptance on failed runtime audit, receipt replay or settlement.",
    "Prioritize linux-bwrap, then optional windows-container, then optional macos-seatbelt. Windows integration checks are callable from WSL2 interop or native Windows only with explicit enablement and verified installed Windows AI clients and host prerequisites before test execution. macOS and Windows require exact native proof before real use. Recognize unsupported-on-host, missing-windows-client and unqualified as applicable. Never double-box Codex. Maintain the 300000 ms default and admit a configured per-invocation timeoutMs up to 600000 within enclosing authority."
  ],
  "nonGoals": [
    "Change the default reviewer, alter prior approvals or host pins, install or update client profiles, or qualify an untested backend by discovery alone.",
    "Ship or claim native Windows or macOS qualification without native evidence. The optional Windows test wiring and macOS contract remain fail closed pending qualification.",
    "Use the planning invocation for implementation, task progress, a branch push, protected finish, release or live Grok or Codex qualification. Paid or external qualification requires its own bounded grant."
  ],
  "adaptableAssumptions": [
    "The single-tier minimal-rootfs Linux assumption for all review routes may evolve within the chosen tier's OS, network, tool, capture and replay controls.",
    "Manual pin assembly can give way to safe local discovery with exact preview and confirmation. Driver interface, sandbox construction and stream normalization may evolve within the observable tier and audit contracts."
  ],
  "acceptance": [
    "Prove setup.mjs --tier a and --tier b preview exact pins, external output bytes and confirmation digest. Test no-write preview, stale confirmation, unsafe auth directories, absent platform clients, mismatched tier or driver, denied host paths and reviewer writes, and timeout default and upper boundary. Keep tests isolated from ambient profiles.",
    "Use positive and negative synthetic offline tests for both Linux tiers, Windows and macOS refusal, role boundaries, full-file audits including partial, failed, parallel and misassociated reads, exact receipt replay, and backward compatibility of the pinned Claude host files and retained captures.",
    "With separate bounded live authority, use benign synthetic inputs for Grok 1.0.92 grok-4.7 via xai-oauth as a Tier B linux-bwrap read-only reviewer and Codex 0.172.0 in its native workspace-write route. Retain exact pins, offline and live evidence and strict replay. Seal exact unsupported dispositions for observed blockers, or missing-windows-client for an enabled Windows prerequisite check that fails. A missing trial grant leaves qualification pending. A fail-closed pilot still permits the verified architecture and docs where the mandatory gates pass.",
    "Promote the three delta specs, synchronize the full documentation and contributor-contract inventory, bump both affected skill and Claude bundle versions, and verify complete package outputs. Require the four executable gates on the disposable exact candidate, zero-waiver independent Claude review with native Verdict: No findings and 100 percent coverage, and finishReadiness.ready === true before offering protected finish."
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
      "39606f64b148ffad3b7fa7d268f5eb64a7868097",
      "HEAD"
    ]
  ],
  "localAuthority": {
    "commits": true,
    "stop": "Stop at verified local outcome, failed mandatory environment preflight, material goal, authority or safety conflict, pending authority at the affected boundary, or exhausted budget. Preserve evidence and present one operator decision."
  },
  "budgets": {
    "minutes": 240,
    "corrections": 10
  }
}
```
