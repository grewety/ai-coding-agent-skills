---
metadata_version: 1
artifact: design
change: review-proof-levels-policy-01m8evnwasn9sct0hwapqfchkt
---

# Design

## Context

Direct-CLI replay already distinguishes `whole-file` coverage from `receipt-only`. On the verified baseline, the planning assessor, candidate decision, task-only protected finish and PR-fix lineage assume whole-file coverage. The baseline also already strips supported advisory events and carries fixed-enum native-output diagnostics in hotfix-supported streams. Extend the current paths and their evidence contracts.

## Goals / Non-Goals

- Make a single independently derived proof selection available wherever orchestration and delivery replay or rely on review evidence.
- Use the existing trust boundary for exact policy, pins, spend, isolation, settlement and evidence.
- Leave earlier frozen plans and profiles under their own pinned contracts. Keep the existing unsupported Hermes route and native-platform qualification boundaries.

## Decisions

### Policy and evidence

Use the root contributor policy at the verified integrated plan parent as the authority. A marker such as `<!-- openspec-review-proof: receipt-only -->` or `<!-- openspec-review-proof: whole-file-read -->` selects the level for subsequent plans. Document both values and the absent-marker strict default. The host file continues to pin runtime and spend inputs. If it carries a level, it must match the derived policy. An unauthenticated request or candidate file cannot downgrade it.

Use the same shared policy logic in both independently distributed skills. Derive the level before preparing or exposing a real review and rederive it from the original parent on admission and offline replay with the expected evidence. Preserve the original pins and formats for existing records. The default strict path for existing Direct-CLI records remains compatible.

Retain policy level and observed coverage as different facts. In Level 1 the verified result records `proofLevel: "receipt-only"` even when the chosen reviewer can provide extra structured evidence. In Level 2 it records `proofLevel: "whole-file-read"` only after every required paired byte read is verified. Missing, unauthenticated or mismatched level in newly governed evidence stops admission. Zero-waiver still requires the exact assigned inspection scope and no unresolved findings or waivers.

Apply the same proof decision across approach acceptance, delegated candidate handover, status, finish readiness, protected finish and closeout receipt replay. Bind the level to the true reviewed SHA, immutable replay pins, and review reference. An accepted task-completion child still requires the existing exact checkbox and separate child-gate proofs. The PR-fix path retains exact ordered lineage, fix scope and postimage evidence requirements. An unproved targeted route requires the ordinary exact-head route. An exact closure review is separately bound and sealed under the same plan policy. Closeout procedures and verification carry proof provenance in `evidence/receipt.json`, including validation against the anchored exact readbacks.

### Host authentication and diagnostics

Pass through only the approved native home or supported auth location for Claude, Codex and Pi during live review. Keep metadata probes credential-free, native restrictions and ambient configuration checks intact, and keep disposable auth profiles for the other supported routes. Exclude private values from prompts, payloads and evidence. Verify profile selection and login handling with synthetic fixtures and use the pinned exact runtime for any separately authorized live check.

Keep the deployed hotfix diagnostic classes and advisory stripping. Complete stable, bounded diagnostic classification for startup inventory, host-path redaction, coverage and stream schema failures, and prevent arbitrary native tags or messages from escaping on new paths. Keep replay deterministic for existing sealed logs. Express the exact frame-only rule in reviewer prompts and verify it in the existing parser.

Use the existing offline preparation and paid admission boundary for a tiny one-file compatibility probe with no repository payload. Reserve the exact attempt in the durable accounting path before dispatch. Apply a small finite cost target near $0.01 and a short finite deadline where the client can enforce them. Unsupported cost, timeout, authentication, sandbox or session guarantees block before paid exposure when detectable. The synthetic result is retained for diagnostics and is ineligible for workflow review or live role qualification.

### Exact scope and package synchronization

The Goal Contract in `proposal.md` is the implementation file allowlist. Include the child contributor contracts for their changed ownership and policy descriptions. Implementation may update them only within the approved change, with edits taking effect for later parents. Choose compatible version bumps for the four deliverables and synchronize every current pin found by the baseline scan.

| Deliverable | Baseline | Current pin locations |
| --- | --- | --- |
| `openspec-delivery` and `openspec-development` | `1.12.0` each | Delivery `SKILL.md`, marketplace manifest, README, OpenSpec workflow and installation guides, Claude installation guide, worker runtime guide, `tests/claude-packaging.test.mjs` and the delivery skill assertion in `tests/openspec-integration.test.mjs` |
| `autonomous-implementation-review` | `0.26.6` | Orchestration `SKILL.md`, README, OpenSpec workflow and installation guides, Claude installation and reviewer guides, worker runtime guide, `tests/claude-packaging.test.mjs` and the review skill assertion in `tests/openspec-routing.test.mjs` |
| `autonomous-orchestration` | `1.16.6` | Marketplace manifest, README, OpenSpec workflow and installation guides, Claude installation and reviewer guides, worker runtime guide, `tests/claude-packaging.test.mjs` |

The delta belongs solely to `contained-independent-review`. Use the native promotion semantics in disposable verification. Preserve the original historical promotion checks for unaffected requirements. The current promotion assertion for the intentionally modified Direct-CLI requirement must use the explicit superseding delta, while retaining exact historical verification and all byte caps. Build disposable distributions and verify canonical package and bundle inventories, shared policy parity and rendered metadata.

## Risks / Trade-offs

Receipt-only proof broadens supported client and model choices and can avoid the cost of reconstructing every Read. It verifies the receipt and integrity chain and provides no structured per-file byte guarantee. A false acceptance from drift or forged provenance would affect the finish boundary, so derive policy from the parent and test mismatches and weaker proofs through each accepting path.

Passing normal auth locations changes the live process environment. Keep the host credentials private and preserve client-specific safe invocation, configuration checks and environment redaction. A native upgrade can still break compatibility. The bounded opt-in probe detects and classifies a failure under an exact pin.

## Migration Plan

Keep current projects strict by default. Publish a synchronized release under the normal protected route after exact-candidate acceptance. Future adopter plans can bind Level 1 only once an independently authorized policy change is integrated. Keep the originating verifier and sealed records available for older plans. A later rollback uses a separately authorized integrated policy change for subsequent plans.
