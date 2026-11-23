---
metadata_version: 1
artifact: design
change: exclusive-worker-runtime-01m84dt53xh6x16nwwqebacz8m
---
# Design

## Context

The integrated orchestration package already has a role resolver, terminal adapter admission, process supervision, sealed handovers and a packaged contained reviewer. Delivery already owns policy, scope checks, Git and native task progress. The missing integration is durable ownership across checkouts and supervisor lifetimes, a packaged implementer entry point and a live qualification of the combined behavior.

This change uses Task-Guided delivery because the locally testable runtime must be accepted before integration and operator documentation, and live qualification requires a later separate grant. The parent at `97a9f0afa64a435d41c36e45733645a031bfb6fe` selects pre-execution review, charter-v1 and continuous-goal, subject to the held restrictions. The conjunctive approval and execution checks remain applicable at each boundary.

## Goals / Non-Goals

**Goals** are identity-bound launch and recovery, independent role configuration, enforced sandbox boundaries and a verified delivery handover. The same runtime observations support ordered Task-Guided continuation and one Goal-First outcome.

**Non-goals** are a dispatcher, retries across unrelated changes, a distributed lock, automatic profile provisioning, new required packages, or authority to publish. Additional clients and optional Hermes profile delegation stay behind route-specific qualification. Human-facing UI and pane dispatch are outside scope.

## Decisions

### One host claim and a separate role reservation

Use one owner-private host registry shared by the operator's worktrees and clones on the qualified host. Normalize the verified repository identity across SSH/HTTPS and checkout locations, then combine it with the full OpenSpec change name. Unresolved repository identity or inability to resolve the same registry blocks launch. Use atomic non-blocking admission and durable owner/attempt state with exclusive, no-follow evidence paths. Checkout-scoped locks permit competing clones, and an ephemeral lock alone loses the identity needed after a crash.

Record intended and admitted assignment state before mutation or prompt delivery. Under the claim, verify the checkout, branch, approved plan SHA/digest or Goal Contract, eligible task or outcome, current authority, constraints, grant scope, budgets and required locator hashes. Check relevant active specs in known worktrees/clones for overlapping ownership. Reserve the actual physical role home and slot separately. Bind stable repo/change, workspace, role, group/action, attempt/predecessor, process birth and session/turn identity to the reserved state. Only the same verified owner can use the claim for implementation and independent review across an eligible transition. A loser does not touch checkout or profile, dispatch or publish a result.

Preserve an assignment with an unresolved owner even if a lock, leader PID or pane disappears. Distinguish original active, verified settled, and unknown or conflicting state. Recover the original attempt or its late result without re-delivering the prompt. Verify descendants and outstanding writes before releasing a claim or reusable slot, with process birth checks to avoid signalling a reused PID. A crash at reserve, spawn, delivery, collection or release either yields readback of the same attempt or blocks. Retain predecessor receipts and consumed budgets, including any single same-action continuation allowed by delivery after a verified native turn cap. Native approval or authentication stays with the operator in the verified waiting session. Herdr can expose that session, but its status is advisory.

### Dedicated workers and qualification

Package `scripts/run-implementer.mjs` with typed data-only input and bounded foreground invocation, using the existing terminal adapter, `bounded-worker`, handoff and portable core. Resolve the implementer and reviewer as a project-default pair with a bounded, independently validated per-run override. Pin actual startup and completion observations for the client, generating model/provider, containment, effective permissions, role session and per-role package inventory. Verify each role's own package bytes before and after use. Persist the qualified pair and non-interactive auth route across eligible phases and correction cycles. Explicitly selected delegation fails closed on missing, failed or drifted bindings, including with an available inline session. Worker inputs cannot choose executable argv, credentials, network or mutable paths outside the verified grant.

Start with standalone Codex using its native `exec -s workspace-write --ephemeral` route with `--enable skip_host_skill_discovery` and `--ignore-user-config`, isolated `HOME` and `XDG_CONFIG_HOME`, and a persistent, separately provisioned/pre-authenticated dedicated worker `CODEX_HOME`. Keep ordinary CLI runtime state inside that home. Never copy credentials or databases, reuse the user's normal profile, install or repair profiles, print secrets, or automate login. Launch with pinned binaries and an allowlisted PATH. Remove inherited parent-session, Hermes and foreign runtime variables, including `VIRTUAL_ENV`, `PYTHONHOME` and `PYTHONPATH`. Run Codex directly under its own verified sandbox to avoid breaking its native namespace or binary resolution. Keep the reviewer on the pinned fresh Claude Code process in OS-enforced read-only Bubblewrap containment with only the approved inference relay and exact tool inventory.

Do the checkout smoke check through the actual role route before real edits on a new checkout/host/container. Exercise a safe read and denied write in read-only mode, a disposable write/read/delete in workspace-write mode, and required denials at protected handoff, Git/task and synthetic credential locations. Compare Git status before and after, verify the scratch file is gone, and block on namespace, UID, dependency path or permission drift. Use positive and negative synthetic connectivity and credential controls in route qualification. For Docker, document the workbook's minimal verified seccomp allowance for native sandboxing, container-native paths, host UID mapping, dropped capabilities and no new privileges. Report the failed containment predicate on unsupported configurations, with concrete corrective options. Privileged, unconfined and unsandboxed fallback paths are excluded.

Keep Hermes `advanced-delegation` `profile_routes` an optional implementer evaluation. Its in-process delegation and depth-one boundary do not establish OS or role isolation. Qualification would have to prove the same claim, isolation, model and session, foreground, handover, and recovery outcomes with its own authorized run. In-process delegation cannot be a reviewer. Other installed backend records or banners likewise do not prove this runtime route.

### Handover and advancement

Supervise foreground single workers and independent batches with explicit wall-clock and stream bounds, bounded termination/settlement and structured milestone heartbeats. Persist claims before waiting. Admit independent batch entries individually and preserve the exact attempt mapping. Separate raw bounded transport captures from protected `request.md`, native `report.md` and adapter-only, atomic, no-clobber `result.json`, with byte/hash inventory and a verified attempt/session association. Arm lifecycle observation before delivery. Terminal text, uptime, prompt echoes and side-thread status cannot settle a worker. Delivery and status readers verify the sealed files with existing handoff readers, never infer from raw terminal output.

Delivery checks post-worker hard invariants and scoped edits before gates. The orchestrator owns Git, task ticks and exact-path commit previews. Use exact-SHA gate readback and `review-candidate.mjs` with a separate fresh review session. Supply verified observations to existing continuation and worker-cap decisions. A routine confirmed product finding consumes the inherited correction budget, with fresh exact-SHA evidence for the successor. Missing coverage, a stale SHA or unknown quiescence blocks rather than asking a worker to make speculative source edits. `openspec-next` only resolves selection and preserves restrictions. The same accepted, reviewed candidate can be reported as the Goal-First local outcome or provide predecessor evidence for the next eligible Task-Guided group.

### Close the three live reviewer failures

Keep persistent evidence at the requested private destination. Allocate short owner-private runtime scratch independently of that destination, check `Buffer.byteLength(socket) < 108` before bind, preserve the pinned relay and mounts, and clean only the owned runtime scratch on settled teardown. Test a realistic deep ULID record path, unsafe/oversized scratch and teardown failures.

Represent candidate receipt parsing failure explicitly in the mode-aware result and status path. Seal `receipt-invalid` and the exact packet index/identity, preserving captures and reports without a completed candidate handover. Offline verification reconstructs the same rejection. This prevents a candidate SHA mismatch from dereferencing an approach-only decision and losing status after a paid run.

In candidate prepare and readback, derive one canonical dated archive location for the exact change from the Git tree and verified immediate active predecessor. Require the entire active-to-archive mapping to be one-to-one with equal bytes and modes, verified real ancestry and a record-only diff, with only authorized receipt/archive records allowed. Keep the frozen planning inventory and normalized plan digest in logical active-path coordinates, including existing task-tick normalization. Export the actual changed paths for review. Refuse additions, duplicates, missing entries, unrelated source or current-spec changes, or a digest/ancestry mismatch. Moving evidence is not permission to substitute another plan or target.

## Risks / Trade-offs

- A crash can strand a claim or slot until identity is re-established. Preserve evidence and stop rather than risk concurrent writers or signal an unrelated process.
- Native sandbox behavior and auth differ by client, installation and host. Use offline real-runtime tests with synthetic local Unix-socket service and private binary pin fixtures before a paid trial. Include a negative control for group-writable pins, native waits, surviving descendants, late results, misleading status, incomplete receipts and denied publication. Record version/route/role evidence from a controlled supervisor outside the candidate's control.
- Role bindings and docs can drift after a valid run. Recheck effective model/provider, role inventories, route and versions after settlement and before advertising support.

## Migration Plan

The product changes are opt-in under the existing parent policy. Preserve compatibility for valid existing reviewer requests/records and inherited workflow boundaries. Recover active assignments with their original binding and evidence before changing routes or rolling back. If a later operator withdraws qualification, stop new configured launches while preserving evidence and use independently reviewed repair or a separately authorized rollback.

The planned minor bumps are `autonomous-implementation-review` 0.19.0 → 0.20.0, `openspec-delivery` 1.4.0 → 1.5.0, `openspec-next` 0.5.0 → 0.6.0, `autonomous-orchestration` 1.9.0 → 1.10.0, and `openspec-development` 1.4.0 → 1.5.0. Keep five skills, two bundles, the existing OpenSpec prerequisite set and the two untouched companion skills. Synchronize README, `docs/openspec-workflow.md`, `docs/openspec-installation.md`, `docs/claude-installation.md`, `docs/claude-reviewer.md`, the packaged profile/runtime/handoff references and a linked operator setup/recovery guide. Cover exact invocation authority, binding, auth, probe, evidence inspection, unsupported routes and recovery, as well as corresponding installation/verification guidance. Document Hermes upstream hard-locks and companion write-approval guards (`skills.write_approval = true`, `skills.creation_nudge_interval = 0`, `curator.enabled = false`, `auxiliary.background_review.enabled = false`), and Codex backup outside discovery with fresh-session byte verification. Distinguish those operator procedures from profile writes.

Declared contributor-contract paths are `skills/autonomous-ai-agents/AGENTS.md` for packaged runtime ownership and `skills/software-development/AGENTS.md` for the delivery/next handoff where the owning contract needs alignment. Apply any such edits only in their owning outcome, subject to exact-candidate alignment review. These edits cannot grant authority to this change.
