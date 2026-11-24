---
metadata_version: 1
artifact: proposal
change: ci-supply-chain-hardening-01m877dyscckvrfc4jvqxv5f01
github_issue: https://github.com/grewety/ai-coding-agent-skills/issues/32
---

# CI supply-chain hardening

## Why

Mutable action tags can change what runs in CI and Pages builds without a corresponding repository diff. Checkout also currently retains credentials by default, although later steps do not need authenticated Git. GitHub issue #32 tracks the exposure identified by Aikido findings 1151615154, 1151570769, and 1151570772.

## What Changes

- Pin the five third-party actions across verification and Pages publishing to the verified commits below, keeping the major-version comments.
- Disable credential persistence for both checkout steps and exercise the workflow rules through positive and negative tests in `npm test`.
- Record the automation contract in `.github/AGENTS.md`.

## Capabilities

### New Capabilities

- `ci-supply-chain` defines the action and checkout policy that the Node test suite enforces for both workflows, and the permissions and artifact behavior that policy preserves.

### Modified Capabilities

None.

## Impact

The two GitHub workflows, their contributor contract and tests, and the new CI capability spec are in scope. Node and package dependencies, distributed skill and plugin bytes, and the public Pages layout retain their existing behavior.

## Goal Contract

The operator selected Goal-First for one reversible local outcome on integrated `main` at `772150e7dfa6b5f1d7758c707d6b9ca39a44fc5a`. The approach review uses charter-v1 with up to three routine planning corrections. This invocation stops at readiness for a separately authorized plan-only freeze. The execution budget and commit boundary below are proposed bounds for a later grant.

```openspec-goal-contract
{
  "schemaVersion": 1,
  "outcome": "Harden both GitHub Actions workflows against mutable action references and persisted checkout credentials, with offline CI regression coverage and an updated automation contract.",
  "scope": [
    ".github/workflows/ci.yml",
    ".github/workflows/publish-skills.yml",
    ".github/AGENTS.md",
    "tests/publishing.test.mjs",
    "tests/ci-supply-chain.test.mjs",
    "openspec/specs/ci-supply-chain/spec.md"
  ],
  "invariants": [
    "Every third-party action uses a verified full 40-character lowercase hexadecimal commit SHA and retains the corresponding major-version comment.",
    "actions/checkout@v6 resolves to d23441a48e516b6c34aea4fa41551a30e30af803. Use that exact commit at every existing call site. Stop on an unverifiable or changed upstream pin.",
    "actions/setup-node@v5 resolves to a0853c24544627f65ddf259abe73b1d18a591444. Use that exact commit at every existing call site. Stop on an unverifiable or changed upstream pin.",
    "actions/configure-pages@v5 resolves to 983d7736d9b0ae728b81ab479565c72886d7745b. Use that exact commit at every existing call site. Stop on an unverifiable or changed upstream pin.",
    "actions/upload-artifact@v4 resolves to ea165f8d65b6e75b540449e92b4886f43607fa02. Use that exact commit at every existing call site. Stop on an unverifiable or changed upstream pin.",
    "actions/deploy-pages@v4 resolves to d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e. Use that exact commit at every existing call site. Stop on an unverifiable or changed upstream pin.",
    "Every actions/checkout step sets persist-credentials to false explicitly.",
    "Preserve workflow-level contents: read, with pages: write and id-token: write restricted to the Pages deploy job. Preserve PR verification without deploy or privileged secrets.",
    "Preserve Node 22, npm ci, npm test, npm run build, current workflow triggers, Pages build/deploy sequencing and serialization, and complete dist/ artifact coverage including .well-known and downloads.",
    "Keep the sole native outcome unchecked until the orchestrator verifies the exact local candidate and independent result review. Only the orchestrator writes Git and task progress."
  ],
  "nonGoals": [
    "Changes to shipped skills, marketplace or package versions, runtime/dependency versions, protected branch configuration, signing, triggers or deployment architecture.",
    "Implementation, a frozen plan commit, approval, publication, live CI or Pages execution, issue mutation or closure by the present proposal request. A later exact approval and separately bounded local execution grant are required for implementation.",
    "Remote pushes, pull requests, merges, live deployment or scanner clearance within the local outcome. A later named finish invocation supplies the protected publication boundary, with separately authorized paid or external runs."
  ],
  "adaptableAssumptions": [
    "Place regression coverage in a new tests/ci-supply-chain.test.mjs or the existing tests/publishing.test.mjs. The implementer may choose the helper structure."
  ],
  "acceptance": [
    "Read-only GitHub provenance for the five pinned commits is retained. Both actual workflows pass structural checks in npm test and negative fixtures reject tag/branch/short or malformed SHA references and absent or enabled checkout credential persistence.",
    ".github/AGENTS.md reflects the pinning, credential and unchanged permissions contract. The ci-supply-chain delta is promoted with current-spec identity at the candidate before protected finish.",
    "Capture passing gates in a clean disposable checkout at the exact candidate SHA. Independent packaged candidate review returns Verdict: No findings with complete coverage and no waivers before marking the local outcome complete. Verify finishReadiness.ready before publication."
  ],
  "gates": [
    [
      "npm",
      "test"
    ],
    [
      "npm",
      "run",
      "build"
    ],
    [
      "openspec",
      "validate",
      "--strict",
      "--all"
    ],
    [
      "npm",
      "run",
      "validate:openspec"
    ]
  ],
  "localAuthority": {
    "commits": true,
    "stop": "After separately authorized local execution, stop at the verified local candidate before publication. Stop sooner on host/preflight failure, drift in the upstream pins, exhausted budget or a goal, authority or safety conflict."
  },
  "budgets": {
    "minutes": 60,
    "corrections": 3
  }
}
```

## External acceptance

After the local outcome is accepted and the named protected finish is separately authorized, require protected CI `verify`, integrated gate readback, a successful Pages publish on `main`, and factual Aikido readback for issue #32 (including findings 1151570769 and 1151570772) before acceptance-bound closure. Follow the integrated receipt and archive procedure. Treat external results as pending until read back and do not infer clearance from local tests.
