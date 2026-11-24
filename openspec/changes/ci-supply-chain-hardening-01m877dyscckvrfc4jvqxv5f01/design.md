---
metadata_version: 1
artifact: design
change: ci-supply-chain-hardening-01m877dyscckvrfc4jvqxv5f01
---

# Design

## Context

At the integrated base, `ci.yml` has two external action uses and `publish-skills.yml` has five. Both check out source before running the Node checks. Existing `tests/publishing.test.mjs` parses the Pages workflow and tests the archive command against a generated site. Pages needs the explicit tar step because the standard Pages upload action filters hidden directories.

## Goals and non-goals

Add a workflow policy check that runs in the existing Node suite and can diagnose which workflow, job, and step failed. Preserve the existing workflow topology and permission boundaries. A dedicated workflow, dependency, or package release is outside the design.

## Decisions

- Adopt the five upstream commits in the Goal Contract at all seven call sites and keep each major-version comment. During proposal preparation, GitHub resolved each live upstream major tag to its listed full commit. Recheck provenance before editing and stop for operator disposition if a tag cannot be verified or has moved. Future roll-forward requires deliberate per-pin review.
- Use the existing YAML and Node test tooling to check both workflows structurally. Bind the test to real action-bearing workflow locations, so a comment or an unrelated value cannot satisfy the rule. Validate the action reference and the checkout input on the step where they occur. Cover both production workflows and use table-driven or equivalent mutation fixtures with the same validation code to prove rejection for non-SHA refs and absent or enabled credential persistence. Test file location and helper shape remain adaptable.
- Keep the existing `verify`, `build`, and `deploy` jobs, events, permission maps, Node version, dependency cache setting, archive step, artifact name and deployment dependencies. Preserve the existing archive regression test and verify the unchanged effective job permissions in review. Document the hardening policy and how it is verified in `.github/AGENTS.md`.
- Promote the new CI capability delta within the later implementation candidate so the protected finish guard can verify current-spec identity and semantic coverage. Keep the active delta frontmatter-free and use the repository's identity frontmatter on the current spec.

## Risks and trade-offs

- A syntactically valid SHA could point to the wrong commit. Compare the proposed pins with the actual read-only upstream resolution and retain that evidence. The recurring tests can remain offline.
- A YAML check that only searches the file as text could accept a comment or miss a checkout step. Use parsed workflow structure and keep the positive and negative cases connected to the same check.
- Disabling persistence changes behavior for authenticated Git operations. The observed workflows use checkout for source reads and the Pages artifact handoff for deployment. Exact-candidate review and protected CI verify the resulting behavior, and a Pages run confirms deployment separately.

## Migration plan

After separate exact approval and a bounded local grant, use qualified implementation and independent reviewer sessions under the selected parent policy. Run the Goal Contract gates from an exact-SHA disposable checkout, retain gate output and require a complete no-findings candidate review. The orchestrator advances the single local outcome only when its evidence passes. Preserve both gate and review evidence for the separately authorized protected finish. A failed protected check or Pages integration requires an operator repair or revert decision through the protected route.
