---
metadata_version: 1
artifact: proposal
change: release-train-operations-skills-01m8dqv8kqjt236es3t80x0syh
github_issue: https://github.com/grewety/ai-coding-agent-skills/issues/77
---

# Proposal

## Why

Projects that run OpenSpec from a lightweight Markdown wiki need a portable way to hand work to a background Driver, keep it monitored, and retain release history across Supervisor sessions. The existing reference vault demonstrates the workflow. Packaging it makes adoption possible without transferring that project's records or host configuration.

## What Changes

- Add `release-train-supervisor` and `wiki-delivery-sync` under `skills/delivery-operations/`, with complete standalone packages and a dedicated opt-in Claude marketplace bundle, `delivery-operations`.
- Define fresh Supervisor startup, verified worktree-rooted dispatch, immediate one-shot monitoring, evidence-based escalation and consistent stop handoff.
- Define Markdown vault scaffolding, release lanes, Change Brief identity minted at creation, exact reuse at proposal time, and evidence-bound release distillation. Document bidirectional discovery through gitignored `_meta/local.md` pointers and portable `AGENTS.md` instructions so authorized requirement intake can start from either the wiki or an opting-in repository.
- Extend the public catalog and download inventory with both skills and the new bundle. Keep the two existing marketplace selections and their installation dependencies intact. Document installation separately from workflow adoption and host qualification.

## Capabilities

### New Capabilities

- `release-train-supervision`: Authorized dispatch, reactive monitoring, escalation and fresh-session handoff.
- `delivery-wiki`: Portable vault structure, release-train lanes, stable Change Brief identity and verified closeout records.

### Modified Capabilities

- `openspec-integration`: Add the separate release-operations bundle to the exact catalog contract and specify reuse of an explicitly supplied pre-minted name.

## Impact

The change covers canonical skill packages, distribution and test inventories, contributor contracts and affected current guides. Herdr is an example adapter. The reference vault is `grewety/ai-coding-agent-skills-wiki`. Adoption is opt-in, native OpenSpec remains the task authority, and live vault changes, profile installs and remote publication use their respective operator grants. This plan revision uses verified integrated policy parent `c02a4f3a648d1461ae806531687310a17f969d1e`.

## Local security verification

For issue #77, the operator accepted the recorded Hermes v16 `safe` verdicts for the complete `release-train-supervisor` and `wiki-delivery-sync` packages at candidate `039b482505a6f3243f720a81f3582867a8f85bcf`. At that same candidate, both existing companion plugin ZIPs matched the integrated baseline byte for byte. The retained gate capture has SHA-256 `aa0808d956ae9b4d235ecc594c117d496a22861d39e195f25f08e8e676f93f2c`. Reuse the verdicts after reapplication only when the final packages match the scanned bytes. Rescan any changed new package and verify both companion ZIPs against the baseline again.

The repo-wide scan returned `caution` for unchanged `openspec-delivery` and `autonomous-implementation-review`. Their findings matched the integrated baseline. Track them in a separate follow-up. The local security gate runs the trusted Hermes scanner fixture suite under `HERMES_SOURCE`, with the scanner source available on `PYTHONPATH` when required. Protected publication retains its separate release policy and authorization.

## Goal Contract

```openspec-goal-contract
{
  "schemaVersion": 1,
  "outcome": "Ship two portable release-train operations skills as complete public packages and a separate opt-in Claude bundle, with verified Supervisor handoff and evidence-bound Markdown wiki maintenance.",
  "scope": [
    "AGENTS.md",
    "README.md",
    "skills/AGENTS.md",
    "skills/delivery-operations",
    "scripts/AGENTS.md",
    "scripts/build-distribution.mjs",
    ".claude-plugin/marketplace.json",
    "docs/claude-installation.md",
    "docs/openspec-installation.md",
    "docs/openspec-workflow.md",
    "docs/delivery-operations.md",
    "tests",
    "openspec/specs/openspec-integration/spec.md",
    "openspec/specs/release-train-supervision/spec.md",
    "openspec/specs/delivery-wiki/spec.md"
  ],
  "invariants": [
    "Publish both complete new packages and a delivery-operations plugin containing just those packages. Preserve both existing marketplace bundles and their dependency behavior. Preserve deterministic safe packaging and scanner coverage.",
    "Use project-local authority and existing OpenSpec guards. Supervisor observations and wiki records grant no approval or execution authority. Native tasks.md remains the sole mutable task authority.",
    "Monitor every authorized active Driver through a verified one-shot timer or equivalent scheduler until a genuine governance stop or verified completion. Preserve exact identity and observed state when handing off.",
    "Mint the full Change Brief identity once through the trusted naming helper. Use it verbatim at proposal time and bind the verified issue without changing the name. Treat mismatches and uncertain mutations as reconciliation stops.",
    "Distil only verified integrated and archived delivery evidence, preserving historical identity and closeout provenance. Use only gitignored local pointers for bidirectional wiki/repository discovery and authorized requirement intake. Keep tracked files free of secrets, personal paths and private host settings.",
    "Synchronize affected inventories and installation guidance with actual source and package behavior. Preserve prior accepted archives, evidence and Git history."
  ],
  "nonGoals": [
    "Replace OpenSpec task tracking, create a custom UI, database or ticket synchronization daemon, or require a specific terminal multiplexer.",
    "Change the existing OpenSpec companion or orchestration package contents, pinned reviewer workflow or permissions.",
    "Modify the reference wiki repository or live agent profiles, deploy, publish branches, or exercise paid external routes outside their applicable grants."
  ],
  "adaptableAssumptions": [
    "Markdown playbooks and reusable synthetic templates are the preferred implementation. Use existing generic discovery and validation where they preserve the package contracts.",
    "Pick an equivalent one-shot scheduler and terminal adapter based on host capability. Treat local wiki conventions and elapsed-time bands as examples where they are not part of the portable behavior."
  ],
  "acceptance": [
    "Build the catalog, seven complete skill ZIPs and three plugin ZIPs. Verify the two new packages byte-for-byte against canonical inputs and the original bundle inventories against their established selection contracts.",
    "Use synthetic fixtures to verify bootstrap, launch and rearming, governance escalation, mint-once identity, exact issue binding, private-file exclusion, and repeat-safe verified archive and release updates. Test reciprocal pointer discovery from either root, correct routing of requirement intake, and missing, stale, conflicting or tracked pointers. Preserve existing records on uncertainty.",
    "Verify the strict OpenSpec inventory and metadata, documentation consistency and native install package contents in isolated targets where applicable. Pass the trusted Hermes scanner fixture suite and bind the safe verdicts for both new packages and the unchanged companion ZIP parity to the exact candidate as described under Local security verification.",
    "Obtain independent exact-candidate Direct-CLI review with no unresolved findings, full file coverage and zero waivers, then verify exact local finish readiness. Operational acceptance of any separately authorized live reference-vault trial remains evidence-bound."
  ],
  "gates": [
    ["npm", "test"],
    ["npm", "run", "build"],
    ["openspec", "validate", "--all", "--strict"],
    ["npm", "run", "validate:openspec", "--", "--require-issue"],
    ["python3", "-B", "tests/security_scan_test.py"],
    ["git", "diff", "--check"]
  ],
  "localAuthority": {
    "commits": true,
    "stop": "Stop at verified local finish readiness, unresolved goal or authority drift, missing required evidence, unqualified runtime or trusted scanner, or exhausted authority. Protected finish and cross-repository changes require separate authorization."
  },
  "budgets": {
    "minutes": 30,
    "corrections": 3
  }
}
```
