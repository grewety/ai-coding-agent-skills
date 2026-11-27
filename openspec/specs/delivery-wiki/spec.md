---
metadata_version: 1
artifact: spec
capability: delivery-wiki
---
# delivery-wiki Specification

## Purpose

Keep a portable Markdown release train and evidence-bound shipping history that an adopting project can navigate in Obsidian or a text editor.

## Requirements

### Requirement: Scaffold a portable vault
The wiki skill SHALL scaffold and maintain the vault index, hot context, log, voice guidance, private local settings, per-project navigation, release lanes and shipped history. It SHALL preserve existing user content and keep host-local values outside tracked files.

#### Scenario: New project vault
- **WHEN** the operator selects an empty vault root and project
- **THEN** scaffold `index.md`, `hot.md`, `log.md`, `_meta/voice.md`, gitignored `_meta/local.md`, `projects/<repo>/{PROJECT,STATE,TRAIN,SHIPPED}.md`, the project's `briefs/` and `briefs/archive/`, and navigable `decisions/` and `runbooks/`
- **AND** the tracked examples and navigation work without private paths or a vault plugin

#### Scenario: Existing or public vault
- **WHEN** the selected vault contains some or all of the expected files
- **THEN** preserve unrelated content, report conflicts before overwriting, and verify ignore and tracked-file state before putting local values in `_meta/local.md`
- **AND** keep personal paths, credentials and runtime pins out of tracked content and templates

### Requirement: Discover the linked wiki and repository
The wiki skill SHALL document portable `AGENTS.md` instructions at the wiki and in an opting-in repository. Each root SHALL read its own gitignored `_meta/local.md` for the local pointer and verify the reciprocal project identity before routing requirement intake. Tracked files SHALL contain only portable instructions and identifiers.

#### Scenario: Start intake from either root
- **WHEN** the operator starts authorized requirement intake from the wiki or an opting-in target repository
- **THEN** read the current root's private pointer and confirm the canonical counterpart root, registered project identity and reciprocal mapping
- **AND** locate the same project notes, release-train lane and Change Brief workflow from either root, reusing a matching brief when one exists

#### Scenario: Untrusted or conflicting discovery
- **WHEN** a local pointer is missing, stale, tracked, or disagrees with the counterpart repository or project identity
- **THEN** preserve both roots and stop routed writes until the association is verified
- **AND** do not execute pointer contents or treat their presence as write authority

### Requirement: Keep release lanes and stable brief identity
The wiki skill SHALL maintain Now, Next, Later and Parked lanes and one-page Change Briefs with standard frontmatter. It SHALL generate a full lowercase ULID name once per newly created brief and retain it through lane moves, proposal, issue binding and archive.

#### Scenario: Create and move a brief
- **WHEN** the operator creates a genuinely new brief with a readable slug
- **THEN** invoke the trusted OpenSpec naming helper once and create `briefs/<slug>-<ulid>.md` without overwriting a collision
- **AND** set `slug`, `change_id`, `github_issue`, `lane`, `status` and `updated`, initialize the issue as null, and keep lane navigation in agreement with the brief
- **AND** a subsequent lane move or retry reuses the same identity

#### Scenario: Propose from a brief
- **WHEN** an operator authorizes a proposal for the new pre-minted identity
- **THEN** verify filename, frontmatter identity, ULID and absence of a conflicting active or archived change, then supply the exact name to the proposal workflow
- **AND** bind the verified proposal-time issue to the brief after readback, preserving null when issue binding is pending and stopping on conflicting identity or issue state

### Requirement: Distil verified closeout
The wiki skill SHALL derive closeout from verified integration and archive evidence. It SHALL preserve brief identity, capture the shipped commit and receipt SHA-256, update wiki navigation and project history, and promote only durable decisions. OpenSpec retains progress, specifications and evidence.

#### Scenario: Verified release
- **WHEN** the immutable delivery records confirm the exact change, shipped commit, receipt and archive
- **THEN** move the brief to `briefs/archive/YYYY-MM-DD-<slug>-<ulid>.md` with `status: archived`, `shipped_commit` and `receipt_sha256`
- **AND** add a single exact-change row in `SHIPPED.md`, update `TRAIN.md`, `STATE.md`, `log.md`, `hot.md` and `index.md`, and retain durable decisions in `decisions/` when warranted

#### Scenario: Repeated or interrupted closeout
- **WHEN** the same evidence is applied again or an earlier update stopped partway
- **THEN** reconcile each file against the same verified identity and repair the incomplete update without duplicate archive entries, shipped rows or log entries

#### Scenario: Stale or conflicting closeout evidence
- **WHEN** the receipt is absent, changed, or inconsistent with the integrated and archived record
- **THEN** preserve the active brief and existing history and surface the discrepancy before claiming completion
