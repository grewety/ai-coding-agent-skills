---
metadata_version: 1
artifact: design
change: release-train-operations-skills-01m8dqv8kqjt236es3t80x0syh
---

# Design

## Context

The reference vault already uses Markdown for coordination and OpenSpec for plan, task and delivery evidence. The public distribution discovers canonical skill packages by category, while the Claude marketplace build validates an explicit bundle inventory and generates deterministic wrappers and downloads. The two current bundle selections are independent package boundaries.

## Goals / Non-Goals

- Expose two reusable playbooks with complete, synthetic templates and enough handoff context to recover an interrupted session or wiki write.
- Preserve existing package bytes, exact OpenSpec review identity and the adopting project's authority.
- Keep Markdown vault records usable without an Obsidian plugin, a server or a background synchronization service.

## Decisions

### Package the workflow as two portable skills

Use versioned, canonical skill directories under `skills/delivery-operations/` and a dedicated Claude bundle. Reuse discovery, package path validation and ZIP generation. Extend the exact marketplace contract, generated wrapper and download copy, tests, root and child contracts, README and affected installation/SDLC guides together. This keeps the optional workflows independently discoverable and consumable. A single combined package would make wiki upkeep depend on the dispatch playbook, while adding either package to an existing bundle would expand its activation surface.

### Keep host coordination behind verified adapter capabilities

Use a terminal route that can select a worktree, launch or resume a specific Driver and read it back. An operator-selected one-shot scheduler, or a verified in-session equivalent, owns wake-ups. Verify both routes before dispatch and rearm immediately after launch, unblock, or an in-flight observation. On uncertain request delivery or monitor loss after a launch, recover the same Driver and preserve its phase grant. Describe a verified Herdr example, including correct argument handling and SSH-agent setup through a trusted host-local mechanism when needed. Terminal-specific commands stay in the adapter example. Automatic, recurring schedules and pre-bundled authority would make later wake-ups depend on stale approvals.

### Transfer identity and checkpoint evidence through Markdown

Use the existing [Obsidian wiki pattern](https://github.com/Ar9av/obsidian-wiki) for the vault structure and curated navigation. Resolve the trusted `change-name.mjs` from the adopted OpenSpec delivery package before generating a new brief, pass the returned full identity into proposal, and verify GitHub and proposal readback before associating the issue with the brief. Installation of these skills alone does not provision the naming helper. On an interrupted creation or issue write, verify the prior result before retrying. The brief filename, frontmatter and lane links carry one identity. A parallel registry would add competing ownership for the same identity.

Give both roots portable `AGENTS.md` instructions that read their own gitignored `_meta/local.md` as data. The vault-local file maps the stable repository identity to the local checkout and the selected project notes. The opting-in repository's local file supplies the reverse pointer to the vault root and the same project identity. Tracked instructions carry the relative convention and stable identity only. Verify the Git ignore and tracked-file state before writing local values, then verify the canonical roots, repository identity and reciprocal association before using either pointer. Missing, stale or conflicting links stop routed writes until resolved. Neither file is sourced as a shell script or treated as a grant.

Once both sides agree, use the project notes to route authorized requirement intake to the matching release-train lane and brief, or resume the same full identity if the brief already exists. Apply the adopting repository's actual contributor policy and require the appropriate authority for writes to each root. Preserve existing `AGENTS.md` and ignore rules when a project opts in. This keeps machine-specific paths out of portable instructions and avoids maintaining a separate intake queue.

Derive the phase checkpoint and closeout from authoritative worktree, review, Git integration and archive records. Use consistent cross-file updates under one writer and reconcile only the targeted change against verified evidence after interruptions. A closeout replay checks the archived brief, shipped row and navigation by the full name before adding anything. Link to the adopting project's authoritative records where available. Track the exact shipped commit and receipt hash while leaving task progress, specs and evidence in OpenSpec.

### Keep fixtures and live operation separate

Exercise both packages through their documented entry procedures in temporary vaults and controlled terminal/scheduler fixtures. Cover paths and names with shell metacharacters, uncertain launch, rearming, duplicate/replayed evidence, missing receipt, reuse of a single identity, and tracked-content hygiene. Verify exact package selection, ZIP byte parity and deterministic rebuilds. Record the actual trusted Hermes source and scanner output before crediting the scanner gate. Use Claude with structured whole-file evidence for exact-candidate review. Live vault adoption and any native probe beyond authorized local fixtures need their applicable grants and actual readback.

## Risks / Trade-offs

- Stale pane or worktree state could launch the wrong phase. Read back exact identity and current grants before each launch or relay.
- A private setting could leak into a tracked note or shipped template. Verify Git ignore and tracked status before storing local settings and use synthetic values throughout the published content.
- Partial closeout can expose contradictory state. Use the full identity and immutable receipt to reconcile incomplete writes without adding duplicate history.
- The existing local bulk installer selects all canonical packages by design. Describe it as an explicit bulk install and document individual downloads/native copies and the separate marketplace selection for targeted adoption.

## Migration Plan

Adopters explicitly install the chosen packages, select a vault and add their own project contract and private host settings. Use a scratch vault or preserve existing local notes during first reconciliation. The reference vault can adopt the published packages under its own authority. If packaging requires a rollback after publication, use the normal reviewed revert and preserve operator-created wiki records.
