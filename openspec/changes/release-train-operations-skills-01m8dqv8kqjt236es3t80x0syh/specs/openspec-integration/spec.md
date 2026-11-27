# OpenSpec integration delta

## MODIFIED Requirements

### Requirement: Isolated package choice
The distribution SHALL publish the existing OpenSpec companion and orchestration bundles and the separate delivery-operations bundle. The new bundle SHALL be opt-in and SHALL NOT add a prerequisite, package selection, or activation step to either existing bundle. The distribution SHALL NOT publish a second phase skill set.

#### Scenario: Catalog inventory
- **WHEN** the distribution is built
- **THEN** the public packages are openspec-delivery, openspec-next, git-commit-message, capability-wireframes, autonomous-implementation-review, release-train-supervisor and wiki-delivery-sync
- **AND** both new packages are available as complete individual ZIPs and complete endpoint packages

#### Scenario: OpenSpec bundle inventory
- **WHEN** the OpenSpec plugin ZIP is built
- **THEN** it contains delivery, next-step execution, commit and wireframe packages only, byte-for-byte

#### Scenario: Optional bundle inventories
- **WHEN** the marketplace and plugin ZIPs are built
- **THEN** autonomous-orchestration selects only autonomous-implementation-review and delivery-operations selects exactly release-train-supervisor and wiki-delivery-sync
- **AND** generated package bytes match the selected canonical packages and neither existing bundle pulls in delivery-operations

### Requirement: Change name is the identity

The full name identifies paths, issues, PRs and evidence. Adopters SHALL generate `<slug>-<lowercase-ulid>` once, use `change/<full-name>` through review and preserve existing names. A proposal explicitly supplied with a valid new pre-minted full name SHALL verify identity and absence of a conflict and reuse it verbatim.

#### Scenario: Short proposal
- **WHEN** a short proposal starts with a slug
- **THEN** generate the suffix before scaffolding without prompting. Naming grants no writes. The selected proposal policy supplies the authorized setup and planning boundary.

#### Scenario: Authorized proposal from a pre-minted brief
- **WHEN** a proposal explicitly supplies the new full name from a verified Change Brief
- **THEN** validate the lowercase ULID, confirm no conflicting active or archived change, and use the unchanged full name for the worktree, branch, OpenSpec change and proposal-time issue
- **AND** refuse a mismatch or collision without generating another suffix

#### Scenario: Resume
- **WHEN** resuming by slug or context
- **THEN** reuse the full name and ask on ambiguity.

#### Scenario: Naming helper
- **WHEN** naming or resolving active changes
- **THEN** report name, path and branch read-only and reject malformed input, repeated options and discovery symlinks.

#### Scenario: Second clone
- **WHEN** another checkout edits the capability
- **THEN** stop for reconciliation regardless of name.

#### Scenario: Archive reference
- **WHEN** citing a change
- **THEN** cite full name and optional artifact role. Claim archive lookup only if performed.

#### Scenario: Proposal issue
- **WHEN** documenting the proposal
- **THEN** use the same full name as the stable issue reference and avoid moving active or guessed archive links.
