# Direct-CLI independent review

Install core skill 0.27.0 from the optional `autonomous-orchestration` 1.17.0 bundle. The [exclusive worker runtime](worker-runtime.md) keeps its own native qualification.

Under an adopting integrated parent, the independent reviewer runs the selected installed CLI in a fresh session for each assigned packet. Prepare, capability checks and replay remain offline. Linux supervises a kernel subreaper. On macOS the launcher starts an unprivileged session with a hard process creation limit of zero before executing the client. The host probe must observe both `fork` and `posix_spawn` refused. Clients that require child processes to start or complete a turn fail on this route. [Darwin kernel process creation](https://github.com/apple-oss-distributions/xnu/blob/main/bsd/kern/kern_fork.c).

The Windows launcher assigns the suspended client to a no-breakaway Job Object before resuming it. After leader exit, the supervisor checks a complete bounded Job PID list, revalidates process membership and exit by handle, and checks pipe EOF separately. Descendants get up to 250 ms to exit within the original run deadline. A surviving tree is terminated and the review refused. Incomplete observations cannot establish settlement. [Windows Job process ID list](https://learn.microsoft.com/windows/win32/api/winnt/ns-winnt-jobobject_basic_process_id_list).

The selected installed build must expose the required native CLI controls. The offline probe reads version and help in an isolated home without credentials. The worker retains the executable, capability and supervisor pins, then binds the exact argument form, stdin or attachment, and any per-packet settings into each launch. Synthetic fixtures exercise the transport and evidence contract on the native operating systems. Live qualification requires separate evidence for the installed build and platform.

| Client | Native input and configured effort | Admission and evidence |
| --- | --- | --- |
| `claude` | Print-mode stdin with `--effort` when selected | Fresh UUID, safe and restricted mode, structured whole-file Read or receipt-only proof |
| `codex` | `exec` stdin with `model_reasoning_effort` when selected | Ephemeral read-only exec, isolated configuration controls, receipt-only |
| `grok` | One bounded `--single` argument with `--effort` when selected | `XAI_API_KEY` with a disposable profile, Read-only tool selection, receipt-only |
| `pi` | Print-mode stdin with `--thinking` when selected | In-memory UUID, JSON model and terminal evidence, extensions and MCP disabled, receipt-only |
| `hermes` | One-shot `--query-file -` stdin | Current `chat` delegates to a gateway outside the supervised tree. Dispatch is blocked and no one-shot reasoning pin is exposed. |
| `opencode` | V2 standalone run with a text attachment and `model#variant` when selected | Supported provider environment key, private server and tool-deny policy, receipt-only |
| `kilo` | Headless run with a text attachment and `--variant` when selected | Supported provider environment key, embedded runtime with daemon discovery disabled, receipt-only |
| `agy` | A single JSONL user message with `--effort` when selected | `GEMINI_API_KEY`, native `--settings` support with strict permissions and no interactive approvals, strict-mode and model readback, receipt-only |

Claude, Codex and Pi can use their normal host authentication. The disposable profiles for Grok, OpenCode, Kilo and Antigravity use their supported environment credentials and never copy authenticated profiles. The provider-qualified OpenCode and Kilo routes accept `anthropic`, `openai`, `openrouter`, `xai`, `google`, `opencode` and `opencode-go` where the selected CLI supports that provider. A configured variant must exist for the selected model. [Grok headless](https://docs.x.ai/build/cli/headless-scripting), [Hermes classic CLI gateway](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/developer-guide/gateway-classic-cli.md), [OpenCode models and variants](https://opencode.ai/docs/models/), [Kilo CLI reference](https://kilo.ai/docs/code-with-ai/platforms/cli-reference), [Antigravity headless](https://antigravity.google/docs/cli/headless/), [Antigravity authentication](https://antigravity.google/docs/cli/install/).

Use Node 22+, native Git and Python 3 on the review host. Linux requires procfs and Python with pidfd support. Windows requires native `.exe` launchers, an NTFS evidence location, Windows PowerShell for read-only access checks and a process that can enter a nested Job Object. macOS requires unprivileged execution and `/usr/bin/git` with the Command Line Tools available. Keep the Git checkout, host configuration, evidence, and disposable packet directories at distinct canonical locations. The reviewer has ordinary host permissions. The packet boundary, capability restrictions and before/after comparisons detect specific integrity failures under those permissions.

## Select review proof

Whole-file read is the Direct-CLI default. For future plans, an integrated root
contributor contract can select exactly one of these standalone markers.

```markdown
<!-- openspec-review-proof: whole-file-read -->
<!-- openspec-review-proof: receipt-only -->
```

Level 2 (`whole-file-read`) requires paired structured Read calls and responses
whose file bodies match the assigned export. Level 1 (`receipt-only`) requires
each assigned packet receipt and verifies the same exact identity, file
digests, read-only invocation, workspace and export integrity, fresh sessions,
process settlement and findings. Level 1 reports receipt-only coverage.
Zero-waiver acceptance at either level also requires a complete review and no
unresolved findings or waivers.

Only the verified integrated plan parent can select Level 1. An optional
`proofLevel` on the exact external host configuration must agree with the
parent. Unknown, repeated or conflicting selections stop admission. Retain
`proofLevel` from preparation with the independent expectation for an explicitly
selected level. A change to the parent selection affects only later plans.

## Prepare and launch

Use [external AI roles and backend setup](configurable-backends.md) to preview the client, model, optional effort, timeout and concurrency. The host pin binds the resulting bytes. Start with an independent schema 2 expectation holding `requestSha256`, `exportSha256` (initially null), `configurationSha256` and `model`. Retain `runtime` and `maxBudgetUsd` from offline preparation together with the manifest digest. Retain the expectation separately from the attempt.

For Codex Auto-review, run these commands with absolute paths and the standalone packaged script. The first two operations prepare and validate the export. The third sends only assigned packet inputs for paid inference after verifying the exact phase grant and claiming the complete reservation. The final command replays the sealed result offline. Add the returned `statusSha256` to the independently retained expectation before replay.

```text
node "$review_cli" --prepare --request REQUEST --expect EXPECT --export EXPORT --host-config HOST
node "$review_cli" --check --request REQUEST --expect EXPECT --export EXPORT --host-config HOST --admission ADMISSION
node "$review_cli" --mode candidate --request REQUEST --expect EXPECT --export EXPORT --host-config HOST --admission ADMISSION --output OUTPUT
node "$review_cli" --mode approach --request REQUEST --expect EXPECT --export EXPORT --host-config HOST --admission ADMISSION --output OUTPUT
node "$review_cli" --verify --request REQUEST --expect EXPECT --export EXPORT --output OUTPUT
```

Use `--mode approach` for an authorized charter-bound review. Use the [operator runbook](openspec-operator-runbook.md#launch-independent-review) and the [review configuration](openspec-review-configuration.md) for exact phase authority, pacing, retries and signed caps. Scope checks and worktree snapshots run on failed launches and timeouts. Preserve any changed checkout for the operator.

## Read back evidence

Replay validates the independently pinned status, candidate or planning identity, packet files and digests, fresh sessions, supervisor observations, verdict and finding paths. Each final assistant message must contain exactly one `BEGIN_REVIEW_RECEIPT` and `END_REVIEW_RECEIPT` frame, with the verdict, identity and JSON inside and no surrounding prose. Readbacks retain the selected proof, coverage and zero-waiver decision with the actual reviewed SHA or raw plan identity.

Earlier frozen parents retain their original pinned package and sealed captures, including the original transport and receipt schemas. Use the originating verifier for those records. An adopting parent requires Direct-CLI evidence. No profile changes follow from installing or using the reviewer.

## Probe an installed reviewer

`--probe-check --host-config HOST` performs credential-free version and help
checks and emits the proposed runtime pin. For one separately authorized paid
probe use `--probe --host-config HOST --expect EXPECT --admission GRANT --output OUTPUT`.
Keep all paths absolute and external. Retain the offline pin as the private
expectation without its derived `explicitRuntimeSha256` field. Bind that digest
and the host SHA-256 in a single-run `standalone-review-probe` grant with
`verified: true`, `runs: 1`, a distinct `reference`, a private `ledger`, and
`upperUsdMicros` equal to the configured cost bound in millionths of a dollar.
The probe requires an explicit level, native cost enforcement, at most $0.01
and 30 seconds, and one fresh invocation. The current cost-enforced route is
Claude. The result covers a single synthetic file and is ineligible for
qualification, workflow review and delivery acceptance. A repeat consumes
distinct authority. Fixed diagnostic classes cover native output, auth and
settlement failures.

Run `node --test tests/review-direct.test.mjs` on each native platform. The Windows fixture compiles a synthetic native launcher with the .NET Framework v4.0.30319 `csc.exe` and uses native `python.exe`, Node and Git from trusted PATH locations. It checks rapid Python exits and refusal of a sleeping Python child that signals readiness before its leader exits. The macOS fixture exercises native process-group settlement and separately proves the dispatch guard denies descendants. These runs exercise synthetic clients in disposable profiles. [Claude Code CLI](https://code.claude.com/docs/en/cli-reference), [Codex CLI](https://developers.openai.com/codex/cli/reference), [Pi JSON mode](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/json.md).
