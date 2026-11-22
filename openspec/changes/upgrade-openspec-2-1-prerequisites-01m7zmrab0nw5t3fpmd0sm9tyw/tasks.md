---
metadata_version: 1
artifact: tasks
change: upgrade-openspec-2-1-prerequisites-01m7zmrab0nw5t3fpmd0sm9tyw
---
# Tasks

## 1. Qualify in disposable scratch

- [x] 1.1 Qualify the pinned 2.1.1 CLI and exact seven-workflow Claude generation route without changing tracked adoption surfaces. Pass `node <scratch>/qualification/openspec-cli-compatibility.mjs` and retain read-back evidence of the artifact and Node checks, scratch isolation, selection/layout in both scopes, and validation, sync, archive and metadata controls in design.md. Stop on unqualified behavior; preserve 1.16.0 and leave dependent groups unchecked.

## 2. Adopt and reconcile the current contract

- [x] 2.1 After 1.1 passes, adopt the qualified behavior in the tracked compatibility probe and reconcile the current capability, metadata validator, current docs, package/version guidance and tests. Prove the tracked probe is self-contained, frontmatter-free delta policy is enforced independently, and all five companion packages and required version bumps are correct, with `npm run test:openspec`, `npm run validate:openspec` and affected focused tests passing.

## 3. Verify the final tree

- [x] 3.1 After 2.1, verify the final tree: run `npm run test:openspec` (including exact-CLI `validate --all --strict` on a disposable repository copy), `npm run validate:openspec`, `npm test`, and `npm run build`; run and retain the mandatory final-tree claim audit in design.md, including new shipping inputs. Verify the final scope and retained evidence; a failed gate blocks integration.

## Workflow follow-up

- Exact-plan approval and implementation authority are separate. Archive only through authorized protected closeout after actual integration and verification; preserve historical evidence.
