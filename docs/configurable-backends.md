# External AI role configuration and backend pilots

Run the delivery or orchestration package's `scripts/detect-agents.mjs` with
Node. It reports canonical executable paths and probes versions only when
the executable and its path have trusted ownership and write permissions.
Untrusted matches are reported as present with `versionProbe: "untrusted-path"`
and an unknown version.
Auth readiness, permissions, available models and reasoning controls are
unknown unless observed. Discovery grants neither qualification nor run authority.
Grok discovery prefers the `grok` executable and falls back to an executable
`grok-build` on the discovery path. Both report the existing `grok-build`
client identifier. For trusted `grok` 1.0.92 the credential-free probe parses
`grok 1.0.92 (b06756fd6256)` with or without the trailing ` [stable]`.
Retained role configurations keep their original executable and version pins.

Prepare a JSON setup request with `schemaVersion: 1`, `directory` (an
existing private external Linux directory), `roles`, and `reviewer`.
The optional `worksetRoots` array lists the exact canonical directories
approved for attachment. If omitted, setup approves the current workspace
only. Include the workset's primary directory in any explicit list.
Under `roles`, specify `orchestrator`, `implementer`, `reviewer` and
`helper` (null when disabled). Each enabled role uses this shape.

```json
{
  "client": "codex",
  "provider": "openai",
  "model": "gpt-6.2-sol",
  "reasoningEffort": "high",
  "executable": {
    "path": "/absolute/path/to/native/codex",
    "sha256": "<SHA-256 of the executable>"
  },
  "versionPolicy": "gte",
  "maxVersion": "0.172.0"
}
```

Default `gte` floors are Codex 0.171.0, Claude Code 2.1.330 and Bubblewrap
0.9.0. Operators can raise the minimum, add an inclusive maximum, or use
`"versionPolicy":"exact"` and `exactVersion`. `"versionCheck":false`
records the observed version with comparison disabled. Executable and raw
configuration hashes, route qualification, containment, independent session
and provider identities, and provider-run authority are separate predicates.

Tier A `reviewer` choices include `bubblewrap` with the same executable and
version policy fields, `relay` with `route` and a nonsecret `credentialRef`
name, `interPacketDelayMs` and `timeoutMs`. New setup uses 96 turns and
defaults to USD 2.50 per invocation. Set `maxBudgetUsd` to choose a different
limit. Existing hosts continue to use their pinned bytes. For the Claude
pilot, supply `runtime.node` as an executable
file pin, `runtime.libraries` as file pins with explicit mount targets, and
`runtime.relayConfiguration` as a file pin. For `same-uid-key`, the pinned
relay configuration contains `schemaVersion: 1`, the same `credentialRef`
and `route`, `keyFile` and `keyFormat`. Store the credential at the separately
provisioned host path. Only the trusted relay reads it. A non-AI
`reviewer.localHarness` can share the same host file.

Run `node <skill>/scripts/setup.mjs REQUEST.json` to preview the three
files, their exact UTF-8 bytes, the raw host `configurationSha256` and
the `confirmationSha256`. After readback, adding
`--confirm PREVIEW_SHA256` authorizes only those external writes.
Existing differing files and symlinks block. For a partial write,
inspect reported destinations, reconcile them and run a new preview.
Reruns use the newly observed destination state, with matching files
reverified in place. The roles file contains the exact raw reviewer host pin.

The generated `openers.codex.args` includes the pinned role readback and the
native model, `model_provider` and `model_reasoning_effort` arguments with
workspace-write. Claude passes `--model` and `--effort` for Anthropic and
disables profile settings sources for that launch. The opener checks the raw
pins, audits the observed executable version and checks every appended
`--add-dir` member against the approved directory identities in the pinned
roles file. The primary member must be the actual launch directory. For an
older opener or a changed directory identity, preview and confirm fresh
external setup in a new private directory before updating the live OpenSpec
profile under separate authority. Hermes needs `hermes --profile <name>`
with pinned profile provider, model and `agent.reasoning_effort` readback.
Pi's native mapping is `--provider NAME --model MODEL --thinking LEVEL`.
Hermes profile readback and Pi workset attachment remain unverified.

## Admit an exact pilot

The paired worker host document uses the existing assignment, slots,
inventories and restrictions. Schema 2 adds an external `roleBindings`
file pin for the setup-produced `roles.json`. A bounded override supplies
its own `roleBindings` pin. The contained reviewer configuration pin in the
pair equals the `reviewerHost` pin in that file. The independently supplied
role qualification pins refer to the exact selected route.

Each qualification record has `schemaVersion: 1`, `kind: "explicit-route-qualification"`,
`role`, `route`, `supervisor`, `subject`, `effective`, and separate
`offline` and `live` evidence file pins. The subject binds
`runtimeSha256`, `configurationSha256`, `constraintsSha256` and the SHA-256
of the normalized role bytes, plus `relaySha256` for a reviewer.
The effective readback names the observed version, executable SHA-256,
client, provider, model, reasoning effort and selected profile or transport
overrides. The two records repeat this exact identity and report the
route's required controls by name. Live evidence also names the distinct
single-run grant and attempt and records positive and negative controls.
Use `run-implementer.mjs --runtime-identity` from the pinned package when
binding the runtime. The Implementer constraints digest covers its paired
role without the qualification pin or session. Reviewer constraints cover
its runtime pins and Bubblewrap version audit. See the required control
fields in [the admission contract](../skills/autonomous-ai-agents/autonomous-implementation-review/scripts/adapter-qualification.mjs).

Launch one Goal-First assignment with `run-implementer.mjs --run-standalone
INPUT INPUT_SHA256`, or use the same containment and handover with the
exclusive `--run` route. Worker evidence records the version audit and
qualification pins in `launch.json`. Follow the [reviewer runbook](claude-reviewer.md)
for the exact independent runtime and provider readback, paid grant and replay.

| Route | Current disposition |
| --- | --- |
| Pinned Claude Tier A reviewer | Claude Code 2.1.330 remains the default. Original package, host and authority pins govern the frozen review. Retained captures replay under the same schema. |
| Codex Implementer pilot | Admission supports exact-binding offline and bounded live manifests. Fresh live proof must cover the current runtime bytes, effective settings, native workspace-write, protected paths and sealed handover. |
| Claude Code Implementer pilot | Requires native OS workspace-write and protected-path denial evidence. |
| Hermes, OpenCode, Pi, agy, grok-build Implementer pilots | Discovery reports local absence where applicable. A present tool still needs effective settings, native isolation and original-attempt handover evidence. |
| Claude Code Tier A Reviewer pilot | Admission supports independently pinned same-UID Anthropic relay and whole-file stream readback. Fresh live proof must cover the actual native effort request, containment, full Read results and receipt replay. The dedicated UID broker lacks verified explicit effort readback. |
| Grok 1.0.92 Tier A Reviewer pilot | Unsupported. `streaming-messages-json` has no verified host-only xAI OAuth routing through `inference.sock`. Admission stops before export exposure. The version probe was credential-free and made no live xAI call. |
| Grok 1.0.92 Tier B Reviewer pilot | Explicit opt-in on `linux-bwrap` via dedicated `xai-oauth` and `provider-https`, with `grok-4.7`. Offline preview is available. Real review stays blocked pending exact offline and separately authorized bounded live qualification of the auth layout, provider-only HTTPS, sole `read_file`, whole-file stream audit and receipt replay. |
| Pi 1.5.2 Tier A Reviewer pilot | Opt-in via the host relay `hermes-proxy-xai-oauth`, model `grok-4.7`, thinking `off`. An offline synthetic SSE control proved native parallel `read` stream replay. Real review requires independently pinned offline and bounded live qualification for the release inventory, host, exact socket, provider and limits. |
| Codex contained Reviewer pilot | Requires a qualified host relay and stream-proved whole-file audit and receipt mapping. |
| Kilo, Gemini, OpenRouter and generic OpenAI-compatible relays | Discovery or adapter contract only. |

Pilot configuration is staged until qualification. Set `helper` to null
when disabled. Enabled AI helpers and AI harnesses declare the same role
tuple, with a harness using `aiRole`. Their execution stops at the
effective-binding gate until a native adapter is verified.
Separately authorize bounded live positive and negative controls on benign
inputs. Preserve native capture, exact executable and configuration pins,
tier-specific auth evidence and relay pins where applicable, settlement and
readback, and the exact unsupported predicate for each unavailable or failing
route. A legacy binding follows its original frozen authority.

## Observed backend suitability

Role fit reflects the 2026-11-26 host observations. The pinned Claude Code
2.1.330 Tier A route remains the default contained reviewer.

| Backend and observed version | Contained reviewer | Implementer | Orchestrator |
| --- | --- | --- | --- |
| Claude Code 2.1.330 and 2.1.332 | 2.1.330 is the qualified pinned Tier A baseline. The route uses a single executable, `stream-json`, `dontAsk`, Read as the sole tool, no session persistence, empty settings sources, strict MCP configuration and finite turn and spend limits. A version change needs exact qualification. | Strong candidate with OS workspace-write proof. | Strong. |
| Grok 1.0.92 | The observed CLI has native headless streaming and tool and turn controls. Tier A is unsupported because host-only xAI OAuth inference through the Unix relay remains unverified. The explicit Tier B dedicated OAuth route is blocked pending exact offline and bounded live qualification. | Strong candidate with OS workspace-write proof. | Strong. |
| Pi 1.5.2 | Opt-in Tier A host-relay candidate with synthetic offline evidence. The pinned release runs JSON streaming with only `read` and disabled ambient discovery. The host relay enforces the 96-request limit and the supervisor enforces the deadline. Real review requires independently pinned offline and bounded live evidence for the exact host Hermes proxy xAI OAuth binding. See [Pi host setup and qualification](claude-reviewer.md#prepare-and-qualify-the-pi-route). | Medium. | Strong. |
| Hermes 0.23.4 | Medium. The Python environment and toolset granularity complicate the minimal rootfs and single-tool boundary. A host-only proxy may help a separately qualified route. | Medium. | Strong. |
| Codex 0.172.0 | Medium, pending a compatible relay and exact whole-file Read audit. | Native workspace-write is appropriate under its qualified route. | Strong. |
| OpenCode 2.3.2 and Kilo 7.8.27 | Unsuitable for the observed Tier A minimal rootfs. Client/server and state dependencies, with insufficient single-Read allowlist and turn controls. | Requires separate qualification. | Requires separate qualification. |
| agy 1.5.16 | Unsuitable for the observed Tier A minimal rootfs. Relies on a local daemon and lacks the single-Read and finite-turn controls. | Requires separate qualification. | Requires separate qualification. |

Both tiers require a pinned runtime, read-only review inputs, private scratch,
separate sessions, finite bounds and a native-stream audit of the single
allowed read tool and its complete whole-file results. Tier A uses a minimal
rootfs and a host-only Unix relay with zero reviewer-visible credentials and no
direct networking. Tier B masks ambient home and profiles and limits auth to a
private 0700 dedicated directory and networking to qualified provider-only
HTTPS. Bind the exact tier, driver and effective role in qualification and
replay. Evaluate each route under its own live authority.

Use `setup.mjs --tier a` for a Linux sealed relay preview or `--tier b` for a
dedicated-auth preview. Review the exact pins, output bytes and qualification
disposition before applying a confirmation digest. See [Containment tiers](containment-tiers.md).
