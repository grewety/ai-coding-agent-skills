# Hermes role-profile preparation

Run this only under a separately authorized profile-preparation grant, after
`hermes` is qualified in `scripts/terminal-adapters.mjs`, and before any Hermes
role session is created. It is not pane-selection, packet, review, or
publication authority. If `hermes` is not qualified, `verifyHermesProfilePreparation`
refuses preparation and this procedure does not apply.

## Required values

Prepare every named Hermes profile that will orchestrate or execute a role.
Through `terminal`, set these explicit values with
`hermes --profile <name> config set`:

```text
auxiliary.background_review.enabled = false
curator.enabled = false
curator.consolidate = false
skills.write_approval = true
memory.write_approval = true
display.busy_input_mode = queue
model.default = <operator-selected exact role model>
model.provider = <matching provider>
```

The first three values disable automatic post-turn skill review and curator
maintenance. The approval values stage any remaining skill or memory write.
Queue mode is a persistent profile preference that keeps later operator input
as the next turn instead of redirecting active role work. Pin the exact role
model and provider here rather than switching them in a live pane.

Hermes `metadata.hermes.config` frontmatter fields are declarative non-secret
inputs only; they never select a Hermes profile or CLI operation mode implicitly.
External CLI adapters (`claude-code`, `codex`, `grok-build`) use their own
launch-scoped flags and config paths and never claim or inherit a Hermes profile.

## Verification

For each required key, use two fresh processes and require the same result from:

```text
hermes --profile <name> config get --json <key>
hermes --profile <name> config get --json --raw <key>
```

Pass the collected readbacks to `verifyHermesProfilePreparation` from
`scripts/orchestration-core.mjs`. Start fresh role sessions only after all
readbacks match. Under this profile-prepared terminal adapter route, do not
send `/busy queue`, `/model`, or `/status` into a live pane during setup. A
later config mismatch or package-hash drift is a profile-integrity stop, not a
repair warrant.

## Hermes skill maintenance

Under separate operator profile authority, verify the installed complete
upstream OpenSpec and companion inventories. On Hermes versions with user
skill locks, use `hermes --profile <name> curator lock <skill>` or the Desktop
lock switch for each upstream package. Confirm the selected profile's locks
with `hermes --profile <name> curator status`. A lock blocks Hermes agent
mutation paths. Preserve filesystem isolation for arbitrary local processes.
[Hermes lock implementation](https://github.com/NousResearch/hermes-agent/blob/a3e4e721e60f87319d272a50554cde8c11f22628/tools/skill_lock.py).

For companion packages independently verify
`skills.write_approval = true`, `skills.creation_nudge_interval = 0`,
`curator.enabled = false` and
`auxiliary.background_review.enabled = false` in the selected profile.
Read back the exact effective and raw values in fresh processes. An operator
update needs separate authority, collision checks and a complete backup
outside discovery. Start a fresh session and compare active package bytes
with the reviewed inventory after any approved update.

## Dedicated Codex and contained Claude

For the pending exclusive route, use the separate
[worker bindings](worker-runtime.md). An operator prepares the persistent,
pre-authenticated dedicated Codex home and isolated HOME/XDG directories
under separate setup authority. Package pins point to reviewed complete
bytes outside the mutable workspace. Preserve any replaced Codex package in
a private backup outside skill discovery. Compare the complete inventory
against fresh-session discovery before relying on a verified package pin.
The dedicated runner disables host skill discovery and ambient config.
Claude uses its own read-only reviewer configuration and fresh exact session.
Role binding and worker recovery read the pins. Profile installation, login,
update and removal require their own operator action.
