---
metadata_version: 1
artifact: design
change: goal-oriented-delivery-01m83rmrajvyr504ehszs5yrkc
---
# Design

## Context

The current delivery policy reads authority from the integrated plan parent. The guard inventories the native planning inputs, hashes a frozen plan, and identifies the exact committed candidate. The workspace helper already produces read-only lifecycle previews. Evidence retention is a library. Item 0.5 provides charter-v1 planning convergence and Item 1 provides the packaged read-only reviewer and sealed role handovers. See proposal.md for the intended change.

The verified parent for this plan is 147f34bc7a66d8b3489a590eb28314deb315c086. Its Task-Guided exact-plan, pre-execution charter-v1, and continuous-goal boundaries govern this change. The future opt-in is scoped to this repository and becomes eligible for later changes only after integration. A skill installation or upstream CLI setting grants no authority.

## Goals / Non-Goals

**Goals**

- Make mode selection, approval identity, candidate acceptance and stop decisions explicit and testable across the two delivery paths.
- Package the existing evidence and workspace contracts for reproducible command-line use and the next-action interface for later callers.
- Keep external exposure, ignored inputs and aggregate planning resource use bounded.

**Non-Goals**

- New reviewer or implementer backends, automatic parallel dispatch, the Item 4 operator footer and resumed-run retirement work, changes to OpenSpec itself, or any automatic paid test, tunnel, printout of secrets, publisher or installed-profile write.

## Decisions

1. **Read policy from the integrated parent.** Select Goal-First for eligible reversible local work only when the active parent contract explicitly selects it. Select Task-Guided for mandated implementation guidance, ordered dependencies, staged grants, or the absence of a valid opt-in. Keep previously frozen decisions fixed. All invocations preserve one orchestrator, one implementation writer and the native task record. `/openspec-next inspect` reads state only. A verified Task-Guided group uses its existing exact-plan approval and continuation gates. Goal-First dispatch uses an approved Goal Contract and distinct local execution grant, even when one reply expresses both.
2. **Bind the required local result.** Put the Goal Contract in native proposal and spec artifacts with explicit scope, hard invariants, non-goals, acceptance criteria and gates, adaptable legacy assumptions, local authority, time and correction budgets. Compute a deterministic digest over the approved contract inputs and policy identity. A changed contract, authority boundary or acceptance gate needs new approval. Internal implementation choices, adapted legacy assumptions that do not change the contract promise, and the native checkbox progress do not invalidate that approval. Task-Guided preserves the full normalized plan digest. A selected charter-v1 review still covers all raw planning inputs, before any applicable freeze. An optional reviewed Goal-First draft reuses that convergence procedure. It does not confer approval or revive a stale grant.
3. **Check exact candidate identity.** At every phase boundary and after every correction, compare within-scope adaptation and evidence to the approved contract. For Task-Guided, retain current group and ordered authority checks. Enter the bounded normal correction loop for reversible routine defects, retaining prior attempts. Return `DIRECTION_DRIFT_CHOICE` with the conflicting clause when scope, invariants, acceptance or grant would change. The orchestrator previews any local commit it is authorized to create. Passing gate evidence from a clean disposable checkout and fresh independent read-only result review must both bind the final accepted SHA. Any later candidate SHA change requires renewed exact evidence, including changes after progress bookkeeping. Completion has no implied push or acceptance of remote state.
4. **Enforce guard boundaries at shared entry points.** Use ignored-file-aware cleanliness before trusting a candidate checkout. Run gates from a disposable checkout pinned to its exact SHA, bootstrapping known disposable dependencies there after the clean input check. Keep generated output isolated and identifiable. Distinguish known generated outputs from ambient ignored inputs and fail closed on unclassified inputs or evidence mismatch. Share finite aggregate file-count, bytes, depth and output accounting across draft, committed, approval/policy and candidate planning inventory callers so refused or partial reads cannot produce an accepted digest. Preserve existing path, symlink, UTF-8 and Git topology restrictions. The two Aikido findings have future regression coverage in group 1.1.
5. **Expose versioned, observation-driven commands.** The delivery package owns the CLI for policy/preflight, workspace reconciliation, change status, sealed handover verification and finish readiness. Reuse existing guards, portable handover readers and workspace previews. Status inputs are a selected change and verified repository, authority and evidence observations. In schema version 1, emit one stable JSON object with the following fields. Leave all identity fields explicit when unavailable. Use fixed ordering and controlled vocabulary. Avoid wall-clock values, ambient session state and unverified guesses in the status envelope.

   | Field | Contract |
   | --- | --- |
   | schemaVersion | Integer 1. |
   | change | Full stable change name, or null if unresolved. |
   | mode | `goal-first`, `task-guided`, or null if missing verified policy. |
   | state | One of `unresolved`, `draft`, `approval-pending`, `local-ready`, `active`, `result-review-pending`, `local-verified`, `finish-ready`, `closed`, `blocked`. |
   | candidateSha | Full observed candidate SHA, or null. |
   | planDigest | SHA-256 planning identity for the selected mode, which means Goal Contract digest in Goal-First and normalized plan digest in Task-Guided, or null if unknown. |
   | activeAttemptId | Verified active attempt identity, or null. |
   | stopPredicate | Stable reason code, including `DIRECTION_DRIFT_CHOICE` where applicable, or null. |
   | contextHint | `same-session`, `fresh-session`, or null, from known phase-boundary observations. |
   | recommendedNextAction | Advisory object with stable action code and verified subject, or null. Execution requires independent authority. |

   The read-only preflight reports P1–P8 separately, compares main with live target and checks companion drift. A fresh paid reviewer probe requires its own grant. If evidence is absent, inspection reports it as pending. One verified dedicated implementation worktree is reused. Reconciliation identifies separate closure and detached verification worktrees. Status only consumes a role handover after identity, sealed bytes and provenance checks. Finish readiness checks compatible current-spec promotion and valid current-spec metadata in the exact candidate before recommending a separately authorized finish.
6. **Keep evidence and external checks on their own boundaries.** Expose argument-array command capture, representation seal/verify, and offline assertion over retained GitHub readbacks. Capture preserves both byte streams, exit status, observation time, named revision and hashes. Assertion consumes source evidence and checks head, applicable checks, check-runs, review threads and closure predicates. It preserves history and refuses incomplete or stale evidence. The caller owns separate grants for remote collection and mutations. The approval card for any external verification discloses scope, target, data, expected cost or credits and one run. Credentials, live data, source and account actions stay outside any tunnel. Isolate the approved built artifact, shut the tunnel down immediately on completion or failure, and require new authority before retry. Vendor auto-test rules yield to this boundary. Inspect external app triggers before activating an approved push, and require additional consent for such automation. Optional declared UI acceptance uses local-only try-out, accessible-name interactions and a separately approved deploy-preview review pause.
7. **Keep empirical discovery disposable.** Where breaking CLI, runtime or dependency facts are uncertain, record the probe's target, limits, commands, observations and cleanup in disposable scratch before the Goal Contract is locked. Use isolated home, configuration and caches. Write neither the repository nor installed profiles during the probe. Separate authorization still governs any paid or external execution. Candidate evidence must come from the later exact-SHA gates.

## Risks / Trade-offs

- Misclassified authority or changed planning inputs can admit the wrong run. Use integrated-parent readback, exact mode-specific identities, persistent restrictions and tests that reject material drift and unauthorized alternate paths.
- Ignored build output and real-profile state can contaminate evidence. Use clean exact-SHA gate worktrees, bounded input inventory, isolated scratch and synthetic fixtures.
- A status recommendation can be mistaken for dispatch authority. Keep status deterministic and observational, report blocking predicates, and require separate authorization at actionable boundaries.
- Historic GitHub assertions can be wrong after state changes. Reuse the evidence model's provenance, completeness and claim eligibility checks, with original observations retained and tested.

## Migration Plan

Promote both deltas into current specs during implementation and verify their metadata in the candidate. Update root AGENTS.md, the owning child contracts as needed, canonical package guidance, operator docs, version inventories and synchronized launch examples. Release packaging uses the existing route with the three planned version bumps. Current profile installations, toolchain pins and existing approved plans retain their identity. If integration needs correction, stop the affected path and land a separately authorized revert or forward repair through the protected route. Record-only closure carries evidence and archive movement after actual integrated verification.
