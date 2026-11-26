---
metadata_version: 1
artifact: design
change: tier1-non-claude-contained-reviewer-01m8by1bvkhr053edzgtt5t0cm
---
# Design

## Context

At integrated main `5cc3f27b4b527576de2e6a59489b3f93376ff182`, the reviewer command, relay, bridge and stream verifier implement the qualified Claude path. Setup and adapter qualification have a Claude reviewer route, and the shared discovery code maps the modern `grok` executable to the legacy `grok-build` configuration identity. Local `grok --version` returned `grok 1.0.92 (b06756fd6256) [stable]` and Pi reported `1.5.2`. The shared parser accepts only one version token after the legacy label. The local discovery entry also refused to probe the installed path as untrusted. Preserve that guard and use a trusted fixture to verify the parsing fix.

## Goals and non-goals

Keep the host relay, isolated reviewer process, whole-file audit and offline admission independently verifiable for the exact optional binding. Preserve the current default and existing Claude host and capture formats. The proposal's Goal Contract defines the approved design boundaries and scope.

## Decisions

- Keep real authentication in the trusted host, outside the reviewer process and evidence. The isolated root receives read-only scoped inputs, the minimal pinned runtime, a private socket and disposable state. Allow only the selected provider inference protocol via that socket. Credential, profile, raw-header or diagnostic exposure prevents qualification.
- Prefer Grok 1.0.92 with grok-4.7 over host-side xAI OAuth. Test its `streaming-messages-json` against the actual `Read` contract. If routing subscription inference requires ambient profiles, direct egress or credential exposure, retain the exact blocker. A separately granted host-side key relay or Pi 1.5.2 with Hermes proxy xAI OAuth or host-side key relay may qualify. Pi's `json` and read-only tool mode require a relay request cap and deadline since the observed CLI has no turn cap. Treat provider routing as unproved until the trial.
- Verify exact Read requests, corresponding results and assigned file bytes before trusting a framed terminal receipt. Require complete coverage under tool-call concurrency and replay the original sealed stream offline. Reject shortened or partially covered results, foreign paths and any disallowed tool. Preserve legacy replay, supervision and spend semantics.
- Keep an explicit role unsupported until matching offline and live qualification prove the full effective binding. Inspect setup and qualification in both packages and preserve their shared-module parity. Extend setup discovery and reviewer dispositions within the existing role model and preserve exclusive worker assignment and implementer admission behavior.

## Risks and trade-offs

- Subscription routing may depend on upstream behaviors the installed CLI cannot isolate. Fail closed and document the exact runtime and first violated condition before considering a separately authorized fallback.
- Tool acceptance can look correct while an output contains clipped data or a misplaced parallel result. Use positive whole-file controls and replay negatives for range omissions, mixed tool calls, mismatched outputs, malformed framing and wrong bindings.
- New runtime branches can regress earlier pins and replay. Exercise unchanged Claude schemaVersion 1 fixtures, pacing, concurrency and budget accounting. Use synthetic credentials and profile-free test fixtures.

## Migration plan

Current Claude configurations continue unchanged. Stage a new binding as unsupported and enable it only with exact offline and bounded live qualification. A changed or withdrawn binding fails closed while the operator can keep using the established Claude route. Synchronize the two capability specs, README, owning contributor contracts, `docs/configurable-backends.md`, `docs/claude-reviewer.md`, `docs/openspec-review-configuration.md`, affected skill references, package versions and marketplace bundle versions.

## Verification boundaries

The fixed independent planning reviewer is Claude Code 2.1.330, claude-sonnet-4-6, Bubblewrap 0.9.0 and the same-UID host-only relay. The operator supplied the external `claude-2.1.330-turns96-p2-b25.json` pin with SHA-256 `bb71a156d9c8e537cfe510401813cc88334456e213e9b314b67b1b2c48d03b0c`, packet concurrency 2, 96 turns, USD 2.50 per invocation, 3,000 ms pacing and 300,000 ms invocation timeout. Its use is bounded by the verified integrated low-touch policy. Review the complete planning inventory under charter-v1 with up to three planning corrections. The Goal Contract separately proposes ten local execution corrections.

Live alternative-provider qualification remains a later, separately granted trial on benign synthetic input. An exact candidate needs the Goal Contract gates, qualified-or-unsupported evidence, zero-waiver independent Claude review and finish-readiness readback.
