---
metadata_version: 1
artifact: design
change: configurable-worker-and-reviewer-backends-01m8a1cfak28znhgw126kzxye4
---
# Design

## Context

OpenSpec workset openers already accept external argument lists. The current exclusive worker pair binds Codex 0.171.0 and a Claude reviewer. The reviewer launch pins Claude Code 2.1.330 and Bubblewrap 0.9.0, uses an Anthropic-specific relay and audits native Read events. The optional CLI/MCP harness validates a detached exact-SHA checkout but can currently receive a linked worktree. Those are the existing entry points for the three delta specs.

## Goals / Non-Goals

Use the same explicit role vocabulary for interactive openers, standalone or exclusive implementers, contained review, and enabled AI helpers. Keep provider configuration, role qualification and execution authority independently verifiable. Keep installed profiles, archived evidence and the current change's pinned planning reviewer outside the migration.

## Decisions

### Bind role settings and qualification independently

Host-owned configuration selects the four role tuples and versions. The selected adapter maps and verifies the tuple in the actual launch environment. OpenSpec opener examples cover explicit CLI, provider, model and effort where each client supports them, including Codex `model_reasoning_effort`, Claude Code, Hermes and Pi. Optional helpers use the same explicit contract where enabled. Report unsupported native controls clearly, including the case where a CLI cannot confirm it applied the selected reasoning level. An explicit adapter-mapped value that disables thinking is a choice when supported.

Compare observed versions against the adapter's tested floor by default. Support a narrower operator-specified upper bound or exact version and record the actual comparison state. An executable byte pin, role-specific qualification and runtime containment continue to be independently checked. This separates numeric version tolerance from qualification of actual permissions, controls and output streams.

### Qualify real launch routes

Keep the existing dispatch, scope, quota, settlement and review admission boundaries around a pluggable Implementer and contained Reviewer contract. Put role-specific mapping and validation at adapter boundaries. Reuse unrelated candidate, review, current-spec and evidence gates. An adapter is promotable only when it demonstrates all role invariants. Exercise positive and negative controls with benign files, synthetic credentials and separately admitted bounded live exposure. Approve actual session and provider independence before a paired launch, including pair combinations where both clients can exist but their selected provider is the same. An absent or failing candidate remains visibly unsupported regardless of discovery status or version comparison.

Keep the approved provider transport and its credentials on the trusted side of the Unix socket. Approve the manifest-bound request, exact provider route and cost before exposure. Only the approved inference protocol and model output may cross the socket. Provider credentials, raw upstream diagnostic responses and provider headers remain host-side. Require evidence for every substantive review phase and retain offline replay under the verified effective settings. Preserve old native captures and receipt semantics for already-sealed evidence.

### Preview and verify external setup

Discovery uses bounded local probes that can run without login or inference. Auth readiness and model, effort or sandbox capabilities may be unknown when safe local metadata is unavailable. A reported capability is an observation only. Setup previews complete output bytes and their destinations before approval, including the raw reviewer file hash, using named references for separately provisioned authentication. The preview contains no secret values. Bind confirmation to the preview, detect replaced targets and collisions, and check final bytes. If a write fails partway, report which outputs exist and leave enough information to reconcile a retry without falsely presenting a complete configuration.

### Bind the harness to a standalone detached clone

Keep the existing exact-SHA CLI/MCP harness contract and tighten pre/post invocation checkout checks. The independent clone has its own Git metadata and detached HEAD. Pass the same canonical root as the execution and scan target, so an MCP wrapper cannot quietly scan the primary checkout. This addresses the reported Opengrep `git ls-files` failure with linked worktrees. Keep Aikido scan and deep-review examples repo-local and preserve separate authorization for vendor calls or paid checks.

## Risks / Trade-offs

- Newer versions can change native controls or event streams. Require continued pin, identity, containment and coverage checks and retain the exact unsupported reason when a route cannot be proved.
- One provider can serve both clients. Validate independence using effective providers and sessions, with eligibility evaluated per binding and pair.
- Discovery can overstate readiness. Report unknown observations and keep discovery, setup, qualification and actual run admission distinct.
- An independent clone costs extra disk and setup time. Bind each harness invocation to verified clean source identity and use disposable storage without sharing live role profiles.
- Bounded live trials require operator-approved exposure and a finite budget. Record absent tools and invariant failures as specified. Missing run authority stops at the authority boundary. It does not count as a test result.

## Migration Plan

Ship the complete affected packages and updated plugin versions together. Synchronize the five operator guides and README, installation and SDLC references wherever current pins, package versions or usage change. Identify the supported route matrix and list the exact qualification blockers before advertisement. Existing deployments can preserve their old verified binding for retained replay. New executions use previewed explicit configuration and matching qualified pins. Leave archived approvals and evidence intact. Operators can return to a previously verified compatible package and binding under its original authority.
