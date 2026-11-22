---
metadata_version: 1
artifact: design
change: planning-gate-convergence-01m81n2ejqxmh656nxgppy5dne
---
# Design

## Context

The integrated gate already binds complete draft hashes and retains review history, but requires a clean native verdict with no limitations. Keep that gate for this change and separate the new policy selection from review evidence.

## Goals / Non-Goals

Make a granted routine planning loop finite, auditable and self-contained. Do not automate freeze or approval, change worker or candidate review qualification, or introduce a second task authority.

## Decisions

- **Fixed terms and retained evidence.** The charter covers goal, authority, factual pins, consistency, affected-file inventory and testability, not style, helper mechanics or results assigned to later gates. Keep the binding, charter and zero starting count in `evidence/approach-review.json` from review #1. Keep original verdicts, ledger and dispositions; unlike a fresh checklist, this lets the next reviewer check actual progress without losing earlier findings. Do not admit a receipt against a different input or session. A charter change is an operator decision, not a budget reset.
- **Two kinds of repair.** A reviewer-identified `packet-gap` or packet-only metadata defect gets one packet-only re-review opportunity per unchanged planning snapshot; do not charge a plan cycle or loosen the gate. A plan byte change requires strict and metadata checks, new complete hashes and a fresh whole-plan review. Retain both counters across resume. A failed or timed-out launch may retry once on the same binding, never on a weaker route. Stop on persistent gaps, drift without explanation, non-routine or repeated/contradictory findings, or exhausted authority. Present one card with the stop, 2–4 options and a recommendation, not a relay prompt.
- **Use the integrated parent, not a working-tree switch.** Group 1 establishes the independently testable evidence contract; group 2 selects it and proves end-to-end behavior. Keep the compatibility path for existing strict records and plans; do not rewrite historical evidence. A rollback for later changes is a separately reviewed removal of the opt-in, not a retroactive change to a frozen plan's authority.

## Risks / Trade-offs

Misclassification could mask a planning defect: only the reviewer classifies; check task/gate and charter references, preserve severity and reject ambiguity. Unlimited free retries could defeat convergence: bound packet repairs and launch retries separately from plan corrections, and retain continuity across stops.

## Review charter for this change (pre-adoption)

Use the interim fresh Claude Code reviewer binding from the operator charter: minimal-rootfs `bwrap`, read-only candidate inputs and `Read` only, `dontAsk`, no built-in plugins, scrubbed environment and host-side credential relay. Review goal coverage, fail-closed invariants, evidence/schema consistency, version bumps and testability. Execution results, helper mechanics and style are out of scope. At a separately authorized review #1 start the record at zero; keep the binding fixed. A deferral-only limitation may be brought to the operator once for disposition, but does not waive the currently integrated strict rule or replace a fresh clean receipt. No review, freeze or implementation is authorized by this draft.
