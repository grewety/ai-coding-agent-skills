---
metadata_version: 1
artifact: spec
capability: ci-supply-chain
---
# ci-supply-chain Specification

## Purpose

Keep skill verification and Pages publishing reproducible and limit the credentials available to build steps. The repository's workflow checks make these controls verifiable offline.

## Requirements

### Requirement: Immutable action references

The verification and Pages workflows SHALL pin each third-party action to a verified, full 40-character lowercase hexadecimal commit SHA and retain its major-version comment.

#### Scenario: Both committed workflows use pinned actions

- **WHEN** the workflow checks in `npm test` inspect the committed workflow YAML
- **THEN** every third-party action passes the full-SHA policy

#### Scenario: A mutable or malformed reference is proposed

- **WHEN** a representative workflow fixture uses a tag, branch, abbreviated hash, or malformed full hash for an external action
- **THEN** the same workflow check used on the committed workflows rejects that reference

### Requirement: Checkout does not persist credentials

Every `actions/checkout` step in either workflow SHALL explicitly configure `persist-credentials: false`.

#### Scenario: A checkout step opts out

- **WHEN** the workflow checks inspect a checkout step with that explicit setting
- **THEN** the credential-persistence check passes

#### Scenario: A checkout step can persist credentials

- **WHEN** a representative fixture omits the setting or sets it to true
- **THEN** the same credential-persistence check used on the committed workflows rejects the step

### Requirement: Preserve verification and least-privilege Pages publishing

Both workflows SHALL retain workflow-level `contents: read` and run `npm ci`, `npm test`, and `npm run build` on Node 22. Only the Pages deploy job SHALL have `pages: write` and `id-token: write`. Pages SHALL deploy only from the publishing workflow after a successful build.

#### Scenario: Pull-request verification

- **WHEN** a pull request triggers the verification workflow
- **THEN** the `verify` job runs the existing Node 22 checks with read-only contents access and cannot deploy Pages

#### Scenario: Pages archive retains the complete distribution

- **WHEN** the Pages build packages the checked `dist/` directory
- **THEN** the archive includes the `.well-known/` skill endpoint and the `downloads/` ZIPs, HTML, and checksum inventory
