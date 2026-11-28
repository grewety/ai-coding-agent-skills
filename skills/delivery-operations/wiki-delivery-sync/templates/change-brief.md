---
slug: pin-note
change_id: pin-note-01arz3ndektsv4rrffq69g5fav
github_issue: null
lane: Now
status: ready-to-specify
updated: "2026-01-12"
---

# Pin note

## Outcome

A widget owner can pin one note to the top of the widget's list and find it
there after reopening. If read-only baseline checks cannot verify stable
note identity, stop at planning and record the missing prerequisite.

## Hard invariants

Each owner can pin at most one note per widget. A pin affects only that
owner's view. Keep shared ordering and migration outside this brief.

## Adaptable legacy assumption

The list currently orders notes by last edit. The implementation may change
how it computes the owner's display order while preserving shared ordering.

## Planning acceptance

Verify stable note identity on the integrated baseline. Confirm the exact
change identity and any issue binding the project requires. Review the native
plan's scope, exclusions, gates and authority and verify any required planning
checks before requesting exact approval.

## Execution acceptance

Pinning puts the chosen note first immediately. Reopening preserves the
pin. Unpinning restores ordinary ordering. Other owners' views stay the
same. Verify the declared gates and obtain independent review of the exact
candidate under the applicable policy.

## Planning and evidence

Proposal and issue binding are pending. Use this full identity for the
native proposal and any later archive. Keep execution tasks and delivery
evidence with native OpenSpec.
