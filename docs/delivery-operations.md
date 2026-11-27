# Delivery operations

Adopt these playbooks when an operator wants a Supervisor to coordinate an
authorized OpenSpec Driver or a Markdown vault to carry requirements and release
history across sessions. The adopting project owns approval, phase grants, and
source of truth. Native OpenSpec retains specifications, `tasks.md` and
delivery evidence.

## Install and verify

- In Claude's [marketplace or ZIP installer](claude-installation.md), select
  `delivery-operations` 1.0.0, containing only `release-train-supervisor` and
  `wiki-delivery-sync`, both 1.0.0. The standalone ZIPs carry one complete
  package each. The OpenSpec and orchestration bundles have their own selections.
- For Hermes, use the [published endpoint and normal scanner](../README.md#install-with-hermes).
- For a targeted native install, select the client's user or project skills
  directory in the [copy guide](../README.md#advanced-native-directory-installation).
  Copy the complete reviewed `skills/delivery-operations/<skill-name>/`
  directory into it as `<skill-name>/`. Check every selected destination for a
  collision or symlink before copying. The repository bulk recipes select all
  seven packages.
- Review complete package contents before enabling. Verify discovery in a fresh
  session in the intended execution host. Installation, account sync and live
  execution require separate readback. Use the host's enable/update/remove
  procedure, preserving local modifications through the documented backup rules.
- Adopt the workflow explicitly in project and vault instructions. Consult the
  [upstream prerequisites](openspec-installation.md) for this project's SDLC.
  Nothing in either operations package creates an additional required workflow
  or selects a specific terminal multiplexer.

## Run the Supervisor

1. Start with the [Supervisor playbook](../skills/delivery-operations/release-train-supervisor/SKILL.md).
   Read hot context, voice guidance, private settings and project state. Check
   the adopting policy and actual worktree, Driver, phase, request and grant.
2. Qualify the selected terminal and one-shot monitoring routes with harmless
   fixtures on the actual host. [Herdr](../skills/delivery-operations/release-train-supervisor/references/herdr.md)
   is an example. Verify scheduler arm, delivery, and retirement; preserve any
   existing Driver and reconcile uncertain submissions before retrying.
3. Relay only the granted phase action. In this project's SDLC an inspect
   invocation is read-only, local delivery has its own bounded grant, and
   protected finish requires exact-candidate readiness and separate authority.
   Use the [invocation and authority table](openspec-workflow.md#short-operator-commands)
   for phase semantics. A launch request or timer cannot widen them.
4. Read back the Driver request and arm the monitor in the same turn. At each
   wake, inspect the Driver and repository and rearm before yielding while work
   remains in flight. Use a Decision Card for a genuine governance stop. At a
   stop or terminal completion, one authorized writer reconciles `STATE.md`
   and `hot.md` from the same evidence and reads both back.

## Run wiki intake and closeout

1. Follow the [wiki playbook](../skills/delivery-operations/wiki-delivery-sync/SKILL.md)
   to scaffold or reconcile a vault with plain Markdown. Verify reciprocal
   `_meta/local.md` pointers are gitignored and untracked before storing
   private data or resolving the project from either root. Preserve existing
   instructions and get write authorization for each affected root.
2. Select Now, Next, Later or Parked and find or create the Change Brief. New brief
   minting uses Node 22+ and the adopting project's trusted `openspec-delivery`
   naming helper. Proposal and issue steps require the relevant policy and grant.
   Reuse the same full name through lane moves, native proposal, issue readback
   and archive. Treat uncertain writes and conflicting identity as reconciliation
   stops.
3. After verified delivery, follow the [closeout procedure](../skills/delivery-operations/wiki-delivery-sync/references/closeout.md).
   With vault write authority, apply the verified integration and archive
   evidence once per change. Match the shipped commit and raw receipt SHA-256,
   reconcile partial updates, preserve newer notes and read back navigation and
   history.

The packaged templates use Sample Widget and synthetic evidence. Local fixture
coverage exercises the documented flow in disposable roots with a mocked
terminal and scheduler. Live adoption, Driver qualification, wiki changes and
remote actions require their applicable operator grants and observed results.
