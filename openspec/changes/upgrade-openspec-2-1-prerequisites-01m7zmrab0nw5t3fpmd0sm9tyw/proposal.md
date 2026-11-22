---
metadata_version: 1
artifact: proposal
change: upgrade-openspec-2-1-prerequisites-01m7zmrab0nw5t3fpmd0sm9tyw
github_issue: https://github.com/grewety/ai-coding-agent-skills/issues/37
---
# Proposal

## Why

The distribution still documents and tests OpenSpec 1.16.0. The 2026-11-22 scratch probe showed that 2.1.1 can select the seven required workflows noninteractively, uses a different Claude layout, and passes strict validation of all three current specs. Those observations guide the plan; they are not a substitute for the qualification gate.

## What Changes

- Qualify `@fission-ai/openspec@2.1.1`, tag commit `0c737dc1b543249b38b0f4716816fcf493d894dd`, and Node `>=22.20.0` from the verified tarball in credential-minimized scratch fixtures, with lifecycle scripts disabled. Qualify only the `--tools claude` generation route, not real client discovery or execution.
- Adopt only if the noninteractive custom-profile route selects exactly the seven required workflows and retains validation and conflict detection. Otherwise retain the failure evidence and the 1.16.0 contract; do not edit adoption surfaces or apply the delta.
- If qualified, reconcile the tracked compatibility probe, the repository metadata rule, and all affected current installation, workflow, and package/version guidance. Keep all five shipped companion packages and their bundle membership. Bump affected skills and bundling plugins when shipped bytes change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

`openspec-integration`: Delta specs remain frontmatter-free by repository policy, not because 2.1.1 strict validation rejects frontmatter.

## Impact

The plan freezes the version-neutral metadata rule in `openspec/config.yaml`. Later adoption touches the current `openspec-integration` requirement, metadata validator/tests, compatibility probe, companion and marketplace assertions, and affected current guidance. Final verification audits the final tree for stale version, layout, and validation claims. No real-profile access, `openspec update`, archive rewrites, Item 1 work, or remote writes are in scope. The local plan-only freeze is not execution authority.

Issue #37 is the existing proposal record. The live body was read back and matched the single modified requirement, retained repository policy, and conditional version impact; no edit was needed. The [historical issue snapshot](evidence/planning-sources/context/issue-37-historical-readback.json) predates that wording. The [npm metadata capture](evidence/planning-sources/release/npm.json) records the artifact pin; it is not execution evidence.
