---
name: wiki-delivery-sync
description: Route OpenSpec briefs and archive verified wiki releases.
version: 1.0.1
---

# Maintain a Markdown delivery wiki

Use plain Markdown links and one authorized writer for affected vault records. The adopting project's instructions and OpenSpec records govern scope, tasks, evidence and authority. A wiki lane, a pointer, or installation grants no authority to edit either root, run delivery or write to GitHub.

## 1. Scaffold and read back the vault

Confirm the operator-selected vault root, stable repository identity (such as provider owner/repository), project key and write scope. Inspect existing files and links first. Refuse conflicting mappings, case aliases, symlinks at owned paths, unexpected file types, and edits outside the designated roots. Create missing files with exclusive creation. Preserve existing instructions, ignore rules and unrelated notes; preview conflicts before changing a file. Use these templates as synthetic examples.

| Vault location | Content |
| --- | --- |
| `AGENTS.md` | [Portable vault instructions](templates/vault-agents.md) |
| `index.md` | Vault navigation to `hot.md`, `log.md`, project notes, decisions and runbooks |
| `hot.md` | [Hot context](templates/hot.md) |
| `log.md` | Append-only Markdown release events keyed by full change identity and receipt hash |
| `_meta/voice.md` | Public writing guidance, such as concise observed state and explicit open decisions |
| `_meta/local.md` | [Private vault settings](templates/vault-local.md), ignored and untracked |
| `projects/<repo>/PROJECT.md` | [Project index](templates/project-index.md), stable repository identity and adopted workflow reference |
| `projects/<repo>/STATE.md` | Project checkpoint, paired with vault hot context when selected |
| `projects/<repo>/TRAIN.md` | [Release lanes](templates/release-train.md) |
| `projects/<repo>/SHIPPED.md` | [Shipped history](templates/shipped.md) |
| `projects/<repo>/briefs/` and `briefs/archive/` under that project | Active and dated archived briefs |
| `decisions/index.md` and `runbooks/index.md` | [Durable decisions](templates/decisions.md) and runbook navigation |

For a new vault, give each simple page a title and links to its intended targets. Start the log and shipped history empty. Use the hot template's checkpoint fields in both project STATE and vault hot, with links relative to the file that contains them. Initialize both with the same observed checkpoint or an explicit ready-for-intake disposition if no Driver/change exists. Link `index.md` to PROJECT and PROJECT to STATE, TRAIN and SHIPPED, with return navigation. Read every target and lane before claiming bootstrap. A plain editor must be enough. If the project adopts the reciprocal route, merge the [repository instructions](templates/repository-agents.md) into the existing repository contract and use the [repository pointer template](templates/repository-local.md) only in its private location.

## 2. Resolve the same project from either root

At each root, first verify it is an operator-selected canonical Git root. Refuse symbolic links or unexpected file types on `_meta` or `_meta/local.md`, including before writing. With authority to change ignore rules, ensure each root's `.gitignore` has an effective root-anchored `/_meta/local.md` entry before storing any private values. Use the following read-only checks in each verified root. The command must succeed in full; an error discovering Git or its tracked paths blocks the check. A tracked pointer requires operator reconciliation even if an ignore entry exists.

```sh
# Check the exact private pointer before reading or writing it.
git -C "$root" check-ignore --quiet -- _meta/local.md &&
tracked_pointer=$(git -C "$root" ls-files --stage -- _meta/local.md) &&
test -z "$tracked_pointer"
```

Parse the local note's YAML frontmatter as data with duplicate keys rejected. Match a single declared project by exact `repository` and `project_key`; accept no command or shell expansion. Require absolute host-local paths for `repository_root` and `vault_root`, and the exact portable relative `project_path: projects/<project_key>` on both sides. Restrict the project key to lowercase letters/digits and hyphens with an initial letter. Confirm the counterpart is the expected canonical root, distinct from the starting root, and resolve the declared project inside the vault without symlink traversal. Confirm the repository root and its configured identity through local Git/config and the trusted project binding. If Git has multiple routes, compare the agreed provider/owner/name and selected remote; a same-named checkout alone proves nothing.

From the vault, use the selected project entry to locate the checkout and read its reverse note. From the repository, use the reverse note to locate the vault and find the matching registered entry. In either direction, read the proposed `PROJECT.md` identity and check that both pointers return to the same canonical roots and the same project path and repository identity. Check ignore/tracked status on both roots before reading their local values, and on replay before any write. Stop routed writes if a pointer is missing, stale, ambiguous, unsafe, tracked, or mismatched. State the failed check without publishing private values. Never source either file. Do not copy private paths, client bindings, runtime pins or credentials into tracked notes or packaged examples.

## 3. Route authorized intake and mint once

1. Read the repository's applicable contributor rules and confirm its adopted planning and naming policy. If it has not adopted this intake/naming convention, stop this route and use the repository's own intake process. Confirm the operator's separate permission for each affected root and each side effect. Intake may authorize only a wiki brief. A routed request neither authorizes a native proposal nor grants Git, issue, implementation or finish actions by itself.
2. Locate the selected project's `TRAIN.md` and read Now, Next, Later and Parked plus matching active or archived briefs and native OpenSpec identities. Clarify an ambiguous requirement or lane. Compare the requested outcome, exact selected identity and prior creation/evidence for a retry. Reuse a matching brief and full identity; multiple matches, a competing active/archive identity, or missing prior write readback require reconciliation. A lane change updates brief frontmatter and moves the exact link, never renames the brief.
3. For a genuinely new brief, resolve the operator-trusted `scripts/change-name.mjs` from the adopted `openspec-delivery` package or its approved source, and verify it is the expected file before running it. Node 22+ and the helper are required for minting; installing this playbook does not supply them. With wiki creation authorized, generate once for the approved slug:

   ```sh
   node "$naming_helper" generate --slug "$slug"
   ```

   Require success and JSON `ok: true`. Validate the slug and full returned name, and check the returned path and branch against the same full name. A new full name has a lowercase kebab-case slug starting with a letter, excluding `archive`, up to 173 characters, followed by `-[0-7][0-9a-hjkmnp-tv-z]{25}` in lowercase Crockford base32. Retain that result in the authorized local operation record before any mutation. Hold the writer through collision checks and writes. If the result or write is uncertain, inspect the intended path, native inventory and retained operation before retrying; never mint again to repair an interrupted intake. Escalate if that identity cannot be established.
4. Create `briefs/<full-name>.md` exclusively from the [Change Brief](templates/change-brief.md). Set exact `slug`, `change_id`, `github_issue: null`, selected `lane`, `status` and `updated` UTC date. Record the requested outcome, acceptance, exclusions and dependencies without copying native tasks. Add one relative link under that lane. If interrupted, verify the retained identity and existing content first, then add only the missing half. Reopen brief and train and verify the link, filename, frontmatter and lane agree and no competing link exists.

## 4. Propose and bind the verified issue

1. With separate proposal authority, validate filename/frontmatter/full name and confirm no conflicting native active or dated archive entry or competing worktree/branch for the identity. Inspect both inventories explicitly; the naming resolver only searches active changes. If a prior proposal already exists, resume/read it under the same identity and adopt its verified state. Stop on ambiguity or collision instead of choosing a new name.
2. Pass the full name verbatim to the adopting proposal workflow as an explicitly pre-minted identity. For hosts with slash commands, the synthetic invocation is `/openspec-propose pin-note-01arz3ndektsv4rrffq69g5fav`. Under the adopting policy this can prepare the dedicated workspace, scaffold native planning, and create or reuse a proposal-time issue only within the held grant. Follow the selected draft/freeze boundary. Read back the actual worktree, full change directory and proposal metadata before advancing.
3. If issue authorization is pending or offline, preserve `github_issue: null` and mark binding pending. Otherwise read the issue from the authoritative provider using the approved route, and confirm the issue repository, number/URL and complete change identity in its documentation against the proposal's exact `change` and `github_issue`. The proposal and provider must agree before setting the wiki link. On uncertain issue creation, read back proposal and matching issues first; reuse a verified result and stop on multiple or mismatched results. Never create a second issue to repair wiki state. With wiki write authority, set the link only from null to the verified URL or leave the matching value unchanged. A different existing issue or unexpected loss of the proposal binding stops the write. Reopen all affected records and confirm the exact full name and URL. A bound issue remains a documentation link.

## 5. Distil shipping history

Use the [closeout procedure](references/closeout.md) only with verified integrated and archived evidence and authorized vault writes. Preserve history, keep proposal/implementation/closure evidence in OpenSpec, and report the verified change and any pending repair or decision.
