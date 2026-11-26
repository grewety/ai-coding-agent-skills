---
metadata_version: 1
artifact: proposal
change: configurable-worker-and-reviewer-backends-01m8a1cfak28znhgw126kzxye4
github_issue: https://github.com/grewety/ai-coding-agent-skills/issues/62
---
# Proposal

## Why

Current worker and reviewer admission hardcodes specific Codex, Claude Code and Bubblewrap releases, and the Anthropic relay is the only qualified reviewer route. Operators need to choose the tools and models for every role, see what their host can support, and adopt qualified configurations without editing skills or relying on ambient agent settings.

## What Changes

- Use one external role contract for the workset orchestrator, standalone and exclusive implementers, contained reviewers, and enabled optional AI helpers and pre-PR harnesses. Bind client, provider, model, reasoning effort and version policy explicitly. Default to a minimum tested version with optional maximum or exact policy and an explicit audited version-check opt-out.
- Add read-only `detect-agents` and moderated `setup` for redacted host discovery, dry-run previews, and confirmed external writes of reviewer host JSON, role bindings and OpenSpec opener arguments with a raw-byte configuration SHA-256 pin.
- Qualify Implementer candidates Codex, Claude Code, Hermes via `hermes --profile <name>`, OpenCode, Pi, `agy` and `grok-build`, and contained Bubblewrap Reviewer candidates Claude Code and Codex. Record an exact `unsupported` disposition for an absent binary or failed invariant. Kilo, Gemini and OpenRouter or other OpenAI-compatible relay routes are discovery or adapter-contract only.
- Require authorized CLI and MCP pre-PR harnesses to run from a standalone detached clone of the exact candidate. Preserve sealed evidence and external-run authority.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `exclusive-worker-runtime` admits multiple evidence-backed native workspace-write Implementer routes.
- `contained-independent-review` admits explicitly selected and qualified contained Reviewer routes.
- `openspec-integration` covers shared role configuration, moderated setup, detached-clone harnesses and support documentation.

## Impact

Affects the delivery and orchestration skills, their mirrored contracts, runtime tests and both Claude bundles. Update the five operator guides and affected README, SDLC, installation and package inventories together. Preserve historical evidence and replay under the original bindings. New launches require explicit settings. Provide a migration path for older configurations without guessing missing model or reasoning settings. The verified integrated parent is `07ba01436fb09f9186808fc1a102ff007dcf6cab`, including `low-touch-autonomous-delivery-01m88zpkktr16z02dh3wne3ppy`.

The planning review uses the pinned orchestration 0.21.0, Claude Code 2.1.330, `claude-sonnet-4-6`, Bubblewrap 0.9.0 and same-UID key relay under the integrated low-touch limits of ten admitted reviews and USD 25 per change. The host configuration SHA-256 is `fb9e342101445b9ca4220751d7bca22e4341bffc229952e350e2ede01fafef35`. It sets 96 turns, 3,000 ms inter-packet pacing, USD 5 per invocation and 300,000 ms per-invocation timeout. Charter-v1 planning review covers goal, scope and authority, invariants, qualification fallback, verifiability, contradictions, pinned facts and the affected inventory. Execution results, implementation mechanics and style are outside its scope. Declared containment boundaries are read-only access with supervisor-verified hashes, offline isolation from remote queries, and out-of-scope repository files. Allow three automatic correction cycles. Open High or Medium findings block freeze. Low findings retain IDs and are advisory. Only declared deferrals and charter-declared containment boundaries can pass as limitations. Packet gaps consume zero correction cycles and follow the existing bounded admission and separate retry authority.

## Goal Contract

```openspec-goal-contract
{
  "schemaVersion": 1,
  "outcome": "Deliver the Item 5 local outcome: explicit external configuration for all AI roles, moderated discovery and setup, standalone detached-clone pre-PR harnesses, and qualified Implementer and contained Reviewer backends with evidence-backed unsupported dispositions for absent or unsafe candidates.",
  "scope": [
    "README.md",
    "AGENTS.md",
    "docs",
    "skills/AGENTS.md",
    "skills/software-development/AGENTS.md",
    "skills/autonomous-ai-agents/AGENTS.md",
    "skills/software-development/openspec-delivery",
    "skills/software-development/openspec-next",
    "skills/autonomous-ai-agents/autonomous-implementation-review",
    ".claude-plugin/marketplace.json",
    "openspec/specs/exclusive-worker-runtime/spec.md",
    "openspec/specs/contained-independent-review/spec.md",
    "openspec/specs/openspec-integration/spec.md",
    "tests"
  ],
  "invariants": [
    "Require explicit client, provider, model and supported reasoning effort for every enabled AI role. Verify effective bindings and fail closed on unsupported, absent, ambiguous or changed settings.",
    "Use gte by default with a known inclusive tested-version floor, optional inclusive maxVersion, or exact policy. versionCheck false disables comparison only and retains the observed version and opt-out state. Preserve executable, configuration, containment and relay checks.",
    "Implementers retain verified native workspace-write containment, isolated HOME and XDG config, suppression of ambient skill and profile discovery, exclusive host claims, process-group quiescence and sealed non-interactive file handover. Preserve protected paths and one orchestrator for Git and task writes.",
    "Contained review retains minimal-rootfs Bubblewrap unshare-all, read-only containment and host-side approved Unix-socket inference relay. Keep credentials, upstream diagnostic headers and bodies outside the sandbox. Verify full stream-proved whole-file Read coverage, a strict BEGIN_REVIEW_RECEIPT and END_REVIEW_RECEIPT handover, offline replay and independent cross-session and cross-provider role pairing.",
    "Discover without accessing secret values or running inference. Preview exact external output and its hash before operator-confirmed writes. Do not mutate repository or live profiles as part of setup. Run enabled pre-PR CLI and MCP harnesses in an exact-SHA standalone detached clone and preserve existing sealed evidence and external authority.",
    "Keep approval, bounded local execution, provider-run authority, protected finish and profile changes separate. Retain all integrated parent caps, retry rules, pins and archived identities. A proposed binding or version range supplies no qualification or run authority."
  ],
  "nonGoals": [
    "Promotion of Kilo, Gemini, or OpenRouter and other generic OpenAI-compatible relay routes. Provide discovery or adapter-contract coverage where applicable.",
    "Automatic tool installation, login, live profile edits, hosted test setup, expansion of standing triggers, publication, integration or approval by this planning invocation.",
    "An uncontained fallback, weakened audit, alternate reviewer for this planning review, or a change to authority for already frozen plans."
  ],
  "adaptableAssumptions": [
    "The exact Codex 0.171.0, Claude Code 2.1.330 and Bubblewrap 0.9.0 launch constraints are legacy assumptions for new runtime development. The stated planning review pin and existing retained bindings stay exact.",
    "Single-client worker checks, an Anthropic-only runtime and relay, and single-provider examples can evolve. Adapter shape, mapping details and qualification fixture organization remain implementer choices within the specified boundaries."
  ],
  "acceptance": [
    "Cover all four roles with explicit external bindings and documented native argument or configuration mapping. Accept supported overrides for role, transport and version policy only after validation, and test reasoning passthrough, floor, upper bound, exact match, opt-out audit and independent pin failures.",
    "Test detection, setup preview and write guards, exact raw-byte hash readback, adapter refusal and standalone detached-clone checks for both CLI and MCP harnesses. Reject linked, dirty, attached or wrong-SHA checkouts before invoking a harness.",
    "Retain bounded offline tests and positive and negative live qualification for Codex, Claude Code, Hermes, OpenCode, Pi, agy and grok-build Implementers and Claude Code and Codex contained Reviewers, or the exact absent-binary or failed-invariant unsupported disposition for each affected route. A passing route meets all unchanged role boundaries.",
    "Promote the three valid deltas, synchronize all affected active docs, bump affected skills and both Claude bundle versions, and validate complete package bytes. Run npm test and npm run build on a disposable checkout at the exact candidate SHA.",
    "Retain zero-waiver independent review of the exact candidate with Verdict: No findings and 100 percent whole-file coverage. Require finishReadiness.ready equal to true before offering protected finish."
  ],
  "gates": [
    ["npm", "test"],
    ["npm", "run", "build"],
    ["openspec", "validate", "--all", "--strict"],
    ["npm", "run", "validate:openspec", "--", "--require-issue"],
    ["git", "diff", "--check", "07ba01436fb09f9186808fc1a102ff007dcf6cab", "HEAD"]
  ],
  "localAuthority": {
    "commits": true,
    "stop": "Stop at accepted local outcome, failed shared environment preflight, material goal, scope, authority or safety conflict, an ungranted live run, or exhausted budget. Preserve evidence and return one operator decision. Handle an individual absent backend or failed invariant through the specified unsupported disposition."
  },
  "budgets": {
    "minutes": 240,
    "corrections": 10
  }
}
```
