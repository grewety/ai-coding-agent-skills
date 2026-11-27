# Spec Delta

## ADDED Requirements

### Requirement: Intent-first operator prompting guidance
The public tutorial SHALL teach intent-first prompts, bounded goals and Change Briefs, exceptions and verified resumption.

#### Scenario: Short turns
- WHEN following proposal and local delivery
- THEN show 3–4 typical turns through protected finish with authority per stop, including approval alone and a separate bounded local grant
- AND explain policy for `draft only`, `no commits`, `group 1`, `keep the worktree`, `task-guided` and `explicit`, and agent policy and SHA checks without pasting or lookups

#### Scenario: Briefs
- WHEN drafting a brief
- THEN put fail-closed fallback in the goal, distinguish hard invariants from adaptable legacy assumptions and limit mechanisms to essential boundaries
- AND separate planning and execution acceptance, verify pins read-only before proposing, explain Goal-First and Task-Guided eligibility and distinguish stops from permitted, budgeted recovery

#### Scenario: Exceptions
- WHEN facing failure or handoff
- THEN pair existing visuals with plain-language exception flow and a Never Auto-Approves list for exact approval, material scope or safeguard changes, separate spend and external work grants, protected publication and post-release profile changes
- AND cover bounded fixes, evidence-backed escalation and resumption, fresh sessions at settled phases or ~60% context, and skill bytes and fresh-session loading after authorized sync

### Requirement: Codex CLI approval ergonomics
The runbook SHALL link to portable Codex CLI launch and approval troubleshooting in the tutorial.

#### Scenario: Scoped launch
- WHEN launching Codex
- THEN show `codex --approve-for-me -C "$CHANGE_WORKTREE" --add-dir "$CHANGE_RECORDS"`, `/status` for writable roots and sandbox approvals versus delivery authority
- AND prefer `apply_patch` and direct `review-candidate.mjs` calls and explain prefix mismatches from heredocs, redirects and compound wrappers
- AND show approval-based rechecks of misleading `gh auth status` failures in network-blocked workspace-write before auth changes

## MODIFIED Requirements

### Requirement: Isolated package choice
The distribution SHALL ship OpenSpec, orchestration and opt-in delivery-operations. Existing bundles SHALL gain no prerequisites, selections or activation. No second phase skill set SHALL ship.

#### Scenario: Catalog inventory
- WHEN built
- THEN ship openspec-delivery, openspec-next, git-commit-message, capability-wireframes, autonomous-implementation-review, release-train-supervisor and wiki-delivery-sync, with complete ZIPs and endpoint packages per operations skill

#### Scenario: OpenSpec bundle inventory
- WHEN building the OpenSpec ZIP
- THEN include only delivery, next, commit and wireframe packages byte-for-byte

#### Scenario: Optional bundle inventories
- WHEN building marketplace and plugin ZIPs
- THEN autonomous-orchestration selects only autonomous-implementation-review and delivery-operations selects only release-train-supervisor and wiki-delivery-sync
- AND match canonical bytes and keep delivery-operations out of existing bundles

#### Scenario: Operations versions
- WHEN bumping delivery-operations or either skill
- THEN sync marketplace, skill metadata, packaging test and current doc versions together and generate complete canonical packages at source versions
