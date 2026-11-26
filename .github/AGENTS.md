# GitHub automation

## Purpose

Verify skill packages and publish the tested static distribution site to GitHub Pages.

## Ownership

- `workflows/ci.yml` owns credential-free pull-request and branch verification.
- `workflows/publish-skills.yml` owns tested builds and Pages deployment on main or manual dispatch.

## Local Contracts

- Both workflows run `npm ci`, `npm test`, and `npm run build` on Node 22.
- `npm test` retains every test file and uses separate Linux processes, private HOME and temporary paths, and neutral Git configuration for the seven fixture suites selected in `tests/test-shards.mjs`. `npm test -- --serial` runs the full inventory in the native serial runner. Direct `node --test` invocations can run individual suites without sharding.
- The approximately 8–12 second target is unproved on the Item 5.5 worker host. A sharded run reported 560 individual native cases in 38.0 seconds with one compactness failure, subsequently addressed in the skill. Under comparable load one full-coverage fixture alone took 25.78 seconds. Keep the full assertion inventory and the serial path. Compare exact baseline and candidate timings on the same runner before crediting the target.
- Pin each third-party action to a verified full 40-character lowercase hexadecimal commit SHA. Keep its corresponding major-version comment on the `uses` field and verify each new SHA against the upstream action before updating it.
- Set `persist-credentials: false` explicitly on each `actions/checkout` step.
- Workflow-level permissions are `contents: read`. Only the Pages deploy job receives `pages: write` and `id-token: write`.
- Deploy only dist/ via the Pages artifact; include `.well-known/` dot-directory explicitly and retain `downloads/` ZIPs, HTML, and checksum inventory. The source marketplace is versioned in Git, not deployed as a Pages registry.
- Pull requests do not deploy. Serialize Pages deployments; retain the previous successful deployment if build checks fail.

## Work Guidance

Keep local commands, root verification, and workflows aligned. No personal tokens or stored deployment secrets are needed.

## Verification

Run `npm test` for offline checks of action pins, version comments, checkout settings, and the contents of the Pages archive. Verify the deployment run and public endpoint before declaring publishing complete.

## Child DOX Index

No child DOX documents. Parent: `../AGENTS.md`.
