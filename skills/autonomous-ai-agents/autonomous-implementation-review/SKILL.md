---
name: autonomous-implementation-review
description: Implement changes with an independent review loop.
version: 0.26.6
author: Hermes Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [multi-agent, implementation, code-review, worktrees, verification]
    config:
      - key: autonomous_ai_agents.reviewer
        description: Hermes `/model` selector used for the review phase.
        default: grok
        prompt: Reviewer model key
      - key: autonomous_ai_agents.implementer
        description: Hermes `/model` selector used for implementation work.
        default: astra
        prompt: Implementer model key
---

# Autonomous Implementation Review

One authorized OpenSpec change, one named task group per worker; no GitHub writes.

## Portable core

Use [portable core](references/portable-core.md) without Hermes or Herdr.
Integrated-parent charter-v1 readiness grants no freeze, approval, execution or remote writes.

## Optional worker runtime and reviewer

Bind roles with `scripts/detect-agents.mjs` and `scripts/setup.mjs`.
[Worker runtime](references/worker-runtime.md) and [Direct-CLI review](references/review-candidate.md)
require qualification and separate inference authority. For Codex Auto-review,
use the direct command with retained admission.

```text
node "$review_cli" --mode candidate --request REQUEST --expect EXPECT --export EXPORT --host-config HOST --admission ADMISSION --output OUTPUT
```

## Legacy host execution

`replacementReadiness` is satisfied. `resolveLegacyRouteRequest` stops
[`code-tab-phase-roles`](references/claude-code-roles.md) and `herdr-pane-dispatch` with `status: "retired-route"`,
without fallback or `.claude/agents` edits. `HERDR_ENV` selects no role transport;
[references/herdr.md](references/herdr.md) and `references/lifecycle-watch.md`
govern only the Herdr interaction fallback.

## Preconditions and roles

- Read the contributor contract, `openspec/changes/<name>/` artifacts,
  code/tests, branch/status, gates and authority. Load `references/openspec.md`
  before dispatch. A planning-only request stops after proposal/spec/design/tasks;
  do not dispatch implementation.
- Require explicit execution authority before step 1. The orchestrator is the sole
  Git and `tasks.md` writer through `openspec-delivery`. The executor
  must not edit `tasks.md`, stage, commit, integrate, or retire checkouts.
  Reviewers are read-only.
- Dispatch roles via an explicitly selected qualified terminal adapter
  (`hermes`, `claude-code`, `codex`, `grok-build`) in `references/terminal-adapters.md`.
  Apply the route's session, provider and model independence rules. No implicit consent, `delegate_task`,
  subagent, or multiplexer fallback.
- Use model keys as session selectors; preserve global configuration.
- Isolate writers/services; use finite budgets; no secrets or destructive tasks.
- Compare installed skill version to source once; source edits do not update profiles.

## Goal and repository truth

Under short-invocation policy, `/openspec-next` or `/openspec-delivery <name>`
selects one approved group. Local setup/commits exclude push/PR/merge; restrictions win.

Optional persisted-goal launch (display grants no authority):

```text
/goal draft /openspec-delivery <name>
```

`/goal draft` starts execution; inspect `/goal show`. Resume from repository truth.

Use `/goal`, not `/loop`. The operator controls pause/resume/clear and `/subgoal`.
For earlier compression the operator runs `/goal pause`, `/compress here 2`,
`/context`, then `/goal resume`.

Reuse evidence. Stop discovery once authority, ownership and gates resolve.

## Procedure

1. Confirm recovery and an isolated checkout through `openspec-delivery`.
   Do not start a second writer for the same change.
2. Via `references/terminal-adapters.md` (`references/profile-preparation.md` for
   `hermes`), bind role config (`resolveRoleConfiguration`), prepare non-argv
   transport (`preparePromptTransport`), and launch a fresh implementer session
   (`superviseWorkerLaunch`, `createAttempt`) with outcome, scope/non-goals,
   workspace/base, paths, gates and budget; require focused tests and a report.
3. Admit worker output via `readHandoff` (`references/worker-handoff.md`).
   On human-input waits, `exposeOperatorInteraction` exposes the same session
   natively or via a fresh Herdr fallback pane (`references/herdr.md`,
   `references/lifecycle-watch.md`, `--resume-from` once on `inconclusive`). Worker
   caps use turn-cap recovery below. Use the worker runtime reference for
   an eligible Goal-First supervisor timeout; other incomplete outcomes stop.
   Dispatch failed prerequisites to a fresh implementer session;
   the orchestrator does not edit worker code.
4. Freeze the clean committed candidate via `openspec-delivery`. Dispatch a
   fresh read-only reviewer via the selected qualified terminal adapter with
   base/digest, paths/diff, acceptance, gate evidence and implementation report.
5. Apply candidate review criteria in `references/portable-core.md`; require
   actionable findings or literal `Verdict: No findings` with empty findings and
   empty coverage limitations.
6. Reproduce findings; send confirmed fixes to a fresh implementer role in the
   checkout with the original contract. Changed content needs renewed gates and
   review. Limit to eight fix/review cycles (two for already-frozen legacy work).
7. Delivery owns publication/completion; commits use `git-commit-message`.
   Push/PR/merge require separate authority and remote-ref readback.
8. Continue only unfinished work in the named task group. Stop after that group or
   a blocker; a new change needs a request.

## Executor turn-cap recovery

`Iteration budget exhausted` is incomplete. The worker stops; it never self-continues or
switches role.
The orchestrator alone decides via delivery's `workerContinuationDecision`
before every cap handoff: once per native task in the existing checkout.
Never split, relabel or change sessions to reset it; a second cap stops.
Preserve identity, budget, review and native-input gates; follow
`references/portable-core.md`. Legacy handoff approvals still apply.

## Pitfalls and verification

- Conflicting checkout changes block; preserve them, never reset or pick a side.
- Require acceptance evidence, actual gates and frozen review. Report verified
  results, skips and blockers separately; integration/docs need separate authority.
