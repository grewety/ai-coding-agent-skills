# Containment tiers

Claude Code 2.1.330 remains the default Linux reviewer. Tier A uses pinned
Bubblewrap 0.9.0, a minimal read-only runtime, private scratch and read-only
`/review`. A private Unix relay owns authentication and inference. The
reviewer receives zero real credentials and the OS denies direct networking.
Original schemaVersion 1 host pins and captures retain their original reader
and evidence layout. Existing explicit Claude and Pi routes retain their
separate qualification contracts.

The frozen `tiered-cross-platform-os-containment-01m8cnxjetveec864xxmbp7vyb`
delta supersedes the historical **Probed OS containment** requirement from
`configurable-worker-and-reviewer-backends-01m8a1cfak28znhgw126kzxye4`.
The historical body remains in that change's archived delta.

## Preview and confirm

Run `node PACKAGE/scripts/setup.mjs --tier a REQUEST.json` from the workset.
Use the existing external setup request with `reviewer.runtime` containing
`node`, `libraries` and a pinned `relayConfiguration`. For role executables,
Bubblewrap, Node and library sources, a canonical trusted `{ "path": "…" }`
requests a SHA-256 pin. A supplied SHA-256 is checked against the file. Supply
the library mount targets and complete runtime inventory for that binary.
Preview displays proposed host, roles and opener bytes, their digests, driver,
qualification disposition and a confirmation digest. Add
`--confirm PREVIEW_SHA256` to authorize those external configuration writes.
Each destination must be private and distinct from the checkout and installed
profiles. Setup writes only the confirmed configuration outputs.

Tiered reviewer hosts use schemaVersion 4 with `containmentTier` and `osDriver`.
Keep the same pair in the independent review expectation and its qualification
evidence. A new host defaults to a 300000 ms invocation timeout, with a
600000 ms ceiling, subject to tighter run and authority deadlines. Scheduling,
turns and spend still use their existing controls.

## Dedicated authentication

For an offline Tier B preview choose `--tier b`, the `linux-bwrap` driver,
and Grok 1.0.92 with `grok-4.7`, `xai-oauth` and `provider-https`. Replace
the Tier A relay fields with `reviewer.authDirectory`. The preview checks a
private 0700 directory with a single private 0600 `auth.json` by metadata.
This layout is an offline boundary. Exact native layout, scoped provider-only
HTTPS and sole `read_file` startup still need qualification. The dedicated
credential and qualified network route are intended Tier B exposures.
Real Grok review remains blocked. The offline replay contract checks full
sealed file bytes, unique request IDs, parallel result association, terminal
settlement and strict receipt framing. Native stream mapping and live proof
require a separate bounded trial using benign fixtures.

Tier B Codex uses `linux-codex-native` and exact 0.172.0 with native named
workspace-write. Independently pinned offline and live records must bind the
same tier, driver, runtime and role. The exclusive worker owns native smoke
checks, claim custody and settlement. Non-Codex Tier B wrapped implementers
have an offline mount plan and remain gated on exact role and provider proof.

## Optional platform contracts

`linux-bwrap` is the primary portable containment driver. Windows selects
`windows-container`. From native Windows Node or WSL2 interop, run
`node PACKAGE/scripts/windows-containment-preflight.mjs --enable claude-code codex`
with the Windows clients required by the selected tests. Preflight confirms
Windows-side PE executables and reports `missing-windows-client` for absent
clients, `unsupported-on-host` for unavailable Windows interop, or
`unqualified` with pending controls. Tests stay gated on native container,
job, filesystem and exact qualification proof. The supplied preflight reports
those controls pending.

`macos-seatbelt` reports `unsupported-on-host` outside native macOS and
`unqualified` on macOS pending matching native profile, network, filesystem,
authentication and role proof. Platform selection never falls back.
