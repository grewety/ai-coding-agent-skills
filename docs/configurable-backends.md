# External AI roles and backend setup

Use either complete companion package's `scripts/detect-agents.mjs` to inspect installed clients and OpenSpec. Detection is read-only and reports absent clients and unknown capabilities. The operator chooses effective role settings and owns all grants and credentials.

## Preview and confirm Direct-CLI setup

Create a private canonical directory outside the repository, live client profiles and authority or evidence destinations. Provide a schema 2 setup request. It takes only the reviewer selection and a directory when no other roles or harness are required.

```json
{
  "schemaVersion": 2,
  "directory": "/absolute/private/host-directory",
  "reviewer": {
    "client": "claude",
    "model": "claude-sonnet-4-6",
    "reasoningEffort": "medium",
    "timeoutMs": 300000,
    "packetConcurrency": 1
  }
}
```

Run the packaged setup script by its absolute path. The first command previews exact files, bytes, hashes, destination state and confirmation digest. The second writes only the confirmed files and reads them back. Setup uses normal client authentication. A review run requires its own applicable authority.

```text
node PACKAGE/scripts/setup.mjs REQUEST.json
node PACKAGE/scripts/setup.mjs REQUEST.json --confirm PREVIEW_SHA256
```

Timeout defaults to 300000 ms and has a 600000 ms ceiling. Packet concurrency is 1–3 and defaults to 1. Add optional trusted accounting fields `maxBudgetUsd`, `interPacketDelayMs`, and a tighter `runTimeoutMs` beside `reviewer`. The cost value must be an independently supportable upper bound for one selected session. An optional `localHarness` stays pinned to the same host configuration. The review preflight binds the available native client controls and exact supervisor. Environment credentials for approved disposable-profile routes stay outside the configuration. [Reviewer client and host requirements](claude-reviewer.md), [accounting and harness configuration](openspec-review-configuration.md).

## Other role bindings and OpenSpec openers

Optionally include `roles` with `orchestrator`, `implementer` and `helper` (null when unused) and the approved `worksetRoots`. Their tuples retain explicit client, provider, model, reasoning effort, file pin, and version policy. Normal version comparison uses the audited floor and any supplied maximum or exact pin. An explicit comparison opt-out still requires the observed version, containment and effective settings. Setup emits pinned `roles.json` and an OpenSpec opener snippet with the approved root identities. Import the snippet only under the operator's OpenSpec configuration authority.

The separately qualified [exclusive worker runtime](worker-runtime.md) admits native Codex workspace-write under the exact executable, private implementer state, authority and original-process settlement controls. Its paired reviewer uses the independently pinned Direct-CLI configuration. Frozen earlier assignments keep their original pinned package and evidence.
