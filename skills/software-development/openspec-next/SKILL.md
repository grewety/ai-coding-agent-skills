---
name: openspec-next
description: Inspect or advance an approved OpenSpec goal or task group.
version: 0.5.0
author: Raphael (forgegod), Hermes Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [OpenSpec, Continuation, Recovery]
    related_skills: [openspec-delivery]
---

# OpenSpec Next

Resolve the real unfinished boundary of one change and advance its approved local
goal or Task-Guided group within the selected continuation policy.
The operator need not remember its full name, worktree or Git recipe.
This is repository-grounded selection and recovery, not a scheduler or another
specification/task authority. OpenSpec owns native artifacts and `tasks.md`.

## When to Use

Use the installed client's spelling in verified OpenSpec context:

| Host | Continue the selected change | Inspect the selected change |
| --- | --- | --- |
| Codex | `$openspec-next pin-note` | `$openspec-next inspect pin-note` |
| Hermes or direct Claude Code skill | `/openspec-next pin-note` | `/openspec-next inspect pin-note` |
| Claude Code with the marketplace plugin enabled | `/openspec-development:openspec-next pin-note` | `/openspec-development:openspec-next inspect pin-note` |

A bare invocation or `next` reuses verified current-change context.
Task-Guided advances one task group by default. Report a verified closure with
no next change.

- Do not use to invent a new proposal, prioritize several independent changes,
  approve a plan, infer remote authority or start the next change after closure.

## Prerequisites and authority

Read the project's contributor contract and selected short-invocation policy.
Installation alone grants nothing. In an explicitly adopting project, the normal
invocation grants the same bounded local execution/commit authority as
`openspec-delivery <name>`; `inspect` is read-only. Operator restrictions override
defaults and persist across a bare `next`. Require the selected mode’s exact
approval and separate local grant. Do not push, open PRs, merge, close an
issue, remove a worktree or start another change under this invocation alone.
An existing explicitly authorized finish operation can be resumed, but do not
convert a local-only request into finish authority.

Apply delivery's `references/delivery-policy.md` before execution: derive policy
from the verified integrated parent of the frozen plan, using a retained readback.
Goal-First requires that parent’s opt-in and an eligible reversible local
boundary. Task-Guided preserves the applicable ordered groups, existing approval
and single-group default or selected continuous-goal continuation. New integrity
guards still apply unless retained legacy evidence defers them until refreeze.
Selected policies require the available orchestration package and, for approach
review, the matching complete frozen planning hashes. Never infer approval.
Unintegrated contract edits are inert for their own change through integration.
Use delivery's `workerContinuationDecision` only for one fresh bounded same-role
session after a verified iteration cap, keyed to the existing group/native task.
A changed session or action label never resets the allowance. Group/authority
budget exhaustion, native waits, failed gates or a second cap stop instead.
Before any fresh continuation, require the adapter's retained exact-process-tree
quiescence proof: immediate positive identity readback followed by verified
termination, or proof it cannot still write. Failed readback preserves the process
and forbids continuation; idle or cap output alone is insufficient.

## Procedure

1. Through the host terminal, batch root, branch, full HEAD, status, worktree inventory
   and relevant local refs. Read the root/owning contracts. Confirm the named
   repository/target instead of inferring them from a skill-installation path.
2. Resolve an explicit full name or unique short slug with delivery's packaged
   naming helper. Otherwise inspect the current branch and its actual package;
   if that is not verified context, inspect active packages and registered change
   workspaces. Prefer the known current change over other independent work. If
   several remain plausible, show their full names and proposal summaries and
   ask once. Never select newest. No match does not authorize new scaffolding.
3. Read the selected workspace's proposal/design/deltas/`tasks.md`, committed
   approval/digest, gate/review evidence and actual PR/receipt state when relevant.
   Inspect exact archived identity if the active package is absent; reject duplicate
   active/archive copies or conflicting ownership. Do not require GitHub for local
   task discovery, but do not call an unreachable remote "not merged".
4. Establish one concrete boundary: missing plan/approval, owned interrupted group,
   pending implementation group, frozen candidate awaiting verification/review,
   already merged implementation awaiting closeout, open pull request awaiting
   checks or human review, closure awaiting cleanup,
   or fully complete. Read native task syntax and headings, not a scratch task list.
   Retain exact group, target/base, workspace and evidence. Missing task grouping,
   ambiguous approval or unknown ownership blocks execution.
5. Follow [routing](references/routing.md). Use the packaged `scripts/next.mjs`
   with delivery's retained observations. For `inspect`, report deterministic
   status, verified workspace/approval/evidence and the blocking predicate or
   advisory next action. End without setup, bootstrap, role dispatch or writes.
6. For execution, load `openspec-delivery`. Goal-First uses the approved Goal
   Contract and its single native outcome. Task-Guided resumes incomplete
   checks/review first, then selects the first eligible unfinished approved group
   in dependency order. Preserve the held restrictions and budgets. Require
   artifact-first handover admission and exact-SHA gates and independent review.
   A routine in-scope correction uses the existing bounded loop. Material drift
   stops with the affected clause; Task-Guided rechecks inherited stops at every
   eligible continuation.
7. For declared UI acceptance, route local loopback try-out and accessible-name
   results through delivery, and preserve the separate deploy-preview authority
   and review pause. Offer the protected finish invocation only on positive
   exact-candidate finish readiness. With an existing finish grant, resume the
   observed PR or closeout boundary. A pending check or human review stays
   pending. A verified closure ends the change.

## Pitfalls

- A matching branch name is not ownership, plan approval or a distributed lock.
- A copied task file, stale target or remote timeout is not absence/completion.
- `next` does not cancel `no commits`, `group 1 only` or other operator restrictions.
- Do not print a long authorization paragraph as the normal next step; the selected
  project contract already defines the short invocation's effects.

## Verification

Report the selected full identity, mode, outcome or group, workspace,
approval/dependency checks and exact verification and review identities or blocker.
In inspect mode report no mutations. In execution mode preserve uncompleted work,
keep `tasks.md` as the sole task authority and stop at the authorized boundary.

For parent-selected charter-v1 convergence, follow delivery policy and the bounded operator procedure in `autonomous-implementation-review/references/portable-core.md`; stop at a decision card when its limits or authority require it. Readiness is not freeze, approval, execution or remote authority.
