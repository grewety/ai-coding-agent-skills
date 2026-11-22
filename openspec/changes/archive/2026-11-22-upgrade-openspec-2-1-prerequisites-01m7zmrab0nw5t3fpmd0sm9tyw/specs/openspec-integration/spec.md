## MODIFIED Requirements

### Requirement: Queryable identity metadata
Proposals, designs, task files and current specs SHALL use versioned YAML
frontmatter. Delta specs SHALL remain native Markdown without frontmatter by
repository policy. Their identity is path-derived, and the local metadata checker
rejects delta frontmatter independently of upstream strict validation. Metadata
SHALL describe identity and navigation, not task
progress, approval or PR state, and SHALL remain included in the existing planning
digest.

#### Scenario: Stable proposal association
- **WHEN** the proposal's documentation issue is read back successfully
- **THEN** its full URL is recorded only on the proposal and remains unchanged by default
- **AND** correcting metadata after plan approval requires reapproval

#### Scenario: Archive and current spec identities
- **WHEN** OpenSpec moves a completed change to its archive and updates current specs
- **THEN** archived artifacts retain their original change identity and current specs carry only their capability identity
- **AND** a same-files vault can query the new location without a second mutable tracker

#### Scenario: Invalid metadata
- **WHEN** metadata has duplicate YAML keys, wrong types, unsupported fields, identities inconsistent with its native path, or delta-spec frontmatter
- **THEN** the read-only metadata check fails without repairing files or bypassing upstream validation
