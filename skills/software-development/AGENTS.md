# OpenSpec companion skills

## Purpose

Own the portable boundaries OpenSpec does not enforce: one orchestrator for Git and task progress, logical commits, and stable visual review.

## Ownership

| Path | Owns |
| --- | --- |
| `openspec-delivery/` | Naming, integrated-parent mode and authority checks, delegated worker evidence admission, local evidence capture and status, exact-candidate review, finish readiness and protected integration/recovery. |
| `openspec-next/` | Grounded change selection, read-only inspection and routing for the approved local goal or ordered native group with retained restrictions. |
| `git-commit-message/SKILL.md` | Dependency-aware logical Git batches, a preview before apply, and tiered Conventional Commit messages. |
| `capability-wireframes/SKILL.md` | Static HTML/PNG wireframes for primary human-facing surfaces, with stable screen keys. |

## Local Contracts

- Candidate CLI and MCP harnesses require a verified standalone detached clone before and after invocation.

- OpenSpec `openspec/specs/` and native change `tasks.md` are the specification and task authorities. These skills do not add a second mutable plan.
- GitHub issues and pull requests are documentation and review records. A project may explicitly include one issue in an authorized new proposal; otherwise require `/openspec-delivery document <name>`. PRs and later issue updates need separate authority. A new issue uses the risk-focused body in `openspec-delivery/references/ticket.md`; read it back and bind its stable URL before plan approval. It is not an admission lock, not the task list, and not an ISO/IEC 27001 certificate. Identity frontmatter never duplicates progress or PR state and remains hashed. The full OpenSpec change name is the identity; documentation reuses it without generating another suffix.
- Projects selecting the naming convention generate `<slug>-<lowercase-ulid>` once before proposal scaffolding, using the packaged naming helper. The authorized branch is `change/<full-name>` through specification, implementation and review. Existing names remain valid and unchanged; short-name ambiguity requires operator selection. Naming is not a lock, branch permission, or a substitute for spec reconciliation. Do not fork or modify installed OpenSpec adapters.
- `openspec-delivery` owns the Git and progress boundary. Its read-only guard checks committed planning, candidate and evidence inputs. A selected exclusive runtime owns the atomic host claim and physical role reservation. Delivery rechecks original settlement, sealed output scope, exact gates and the paired independent reviewer before acceptance or ordered advancement. Otherwise the operator serializes starts and handoffs per change. Independent changes may run in separate checkouts. Overlapping capability specs require explicit reconciliation.
- `openspec-delivery/references/delivery-policy.md` and `scripts/delivery-policy.mjs` own integrated-parent selection, declared contributor-contract alignment, selected approach-review gating, group continuation and once-only native-task worker continuation decisions. `change-guard.mjs` also owns complete draft/committed planning inventories and integrated-parent context. `openspec-next` delegates these gates; single-group remains the default unless the integrated parent selected continuous-goal. Worker evidence first passes orchestration's artifact admission; only the orchestrator decides acceptance. Helpers check observations, not operator authenticity or remote state. Unintegrated contract edits are inert for their own change through integration.
- `openspec-delivery/scripts/delivery-cli.mjs` exposes preflight, workspace, decision, deterministic status, sealed handover and exact-candidate finish readiness. Goal-First requires verified integrated opt-in and exact contract approval plus a local grant. Task-Guided keeps exact-plan approval, ordered dependencies and retained restrictions. `openspec-next/scripts/next.mjs` routes to those observations without writes. Declared local UI gates bind loopback and accessible-name evidence to the exact candidate. External verification, preview, tunnel and app-trigger reservations require distinct single-run grants.
- Its Git evidence-guard/workspace helpers share the package-local `scripts/git-environment.mjs` constructor and `references/git-environment.md` contract: name-only override refusal, explicit value allowlist, preserved global/system selectors and fixed Git controls. Configuration remains trusted, not sandboxed. Ship the complete support files; retain native-platform completion blockers instead of substituting case simulations or package validation.
- `openspec-delivery/references/evidence-retention.md`, `scripts/evidence-retention.mjs` and `scripts/evidence-cli.mjs` own lossless representation, authorized exact-SHA gate capture and offline readback assertions. Preserve complete packages in distributions and copies. Review admission, retry budgets and actual publication authority remain orchestrator obligations.
- The orchestrator is the only Git and `tasks.md` writer. Implementers report evidence. Reviewers are read-only. Stock OpenSpec apply checkbox writes are mediated.
- `openspec-next` forwards the full change, registered workspace, sealed delegated evidence and original restrictions to delivery. Inspection reads state only. Missing qualification, ownership or proof of the exact predecessor blocks the configured route.
- `openspec-delivery/scripts/protected-finish.mjs` and `references/protected-finish.md` own finite exact-head checkpoints, protected-closeout decisions, recovery and the separate profile-sync offer. Workspace inventory previews reconcile each retained ownership proof independently. Only the authorized orchestrator reads live remote sources and performs finish actions. Profile updates stay under separate operator control. `openspec-delivery/scripts/finish-trigger-credits.mjs` owns separate named finish-trigger grant validation and the append-only chapter reservation and outcome journal. The orchestrator proves provider identity and cost independently of the current complete event inventory before reserving or activating a bundled trigger.
- `openspec-delivery/scripts/pr-fix-lineage.mjs` owns exact reviewed-ancestor, fix-range and final-head evidence validation through finish and integration receipt replay. Require verified ancestry, complete zero-waiver coverage and final-head gates. For Task-Guided fixes, pin the gate authority from accepted readiness in the protected finish anchor and replay the exact verified run at archive. The ordinary exact-head review path remains available when lineage cannot be verified.
- `git-commit-message` shapes and commits accepted batches. An OpenSpec change alone does not enable autonomous commits. Local commit authority excludes push, pull-request creation and merge. A project-selected short delivery/next invocation explicitly enables autonomous local commits with previews; a finish invocation separately authorizes its named protected publication and terminal closeout.
- `capability-wireframes` owns stable capability/screen keys and change-owned proposal assets. Its default current-product layout is `docs/product/wireframes/<capability>/`, not an OpenSpec requirement; existing target-project layouts win. Cross-document change references use the full name, not moving active/archive paths. Package-relative links must move with both endpoints; archive closure never repairs frozen content. Visual artifacts never replace executable behavior evidence. Two changes do not share a working manifest.
- Planning ends at the requested artifacts. Approval is not execution or publication authority.
- `openspec-delivery/references/task-authoring.md` owns minimum-outcome task generation and planning review: preserve the complete outcome and necessary dependency/authority/ownership/safety boundaries, not a fixed task count. Carry it into authorized project `rules.tasks` and SDLC adoption; never rewrite frozen plans automatically.
- A package installed in a shared profile must not update or remove its installed copy while operating in a project.
- Launch examples state the exact operator-authorized local Git scope and stay identical in the README and `autonomous-implementation-review`. Displaying a template is not authorization.

- Under the verified adopting parent, the planning inventory includes safe custom schema paths and preserves reserved exclusions. Delivery owns exact task-completion parent/child proof, separately sealed child gates, local harness invocation and protected standing trigger admission. Keep the inventory, low-touch policy and harness result contracts identical in both independently distributable packages.

## Work Guidance

Use `openspec-delivery` for an authorized change. Use `git-commit-message` when committing. Use `capability-wireframes` when a primary human-facing surface changes. Do not reimplement OpenSpec propose, apply or archive.

## Verification

Run `npm test` and `npm run build`. Check changed frontmatter, related skill names, and support-file references.

## Child DOX Index

No child DOX documents. Parent contract: `../AGENTS.md`.
