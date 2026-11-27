# Herdr terminal adapter example

Use only an operator-approved Herdr instance on the intended host and a verified scheduler. Confirm the installed CLI and server support these forms with local help and a controlled fixture. A Herdr workspace, terminal or agent name can outlive a launch attempt; keep the native Driver session and request identity too.

## Observe and open an authorized shell

Use `herdr workspace list`, `herdr pane list` and `herdr agent list` to inspect existing targets. If there is an active or uncertain Driver, reconcile it first. For a new launch, the operator selects the host and an anchor pane. The first command below creates a shell pane under the already verified worktree. It requires explicit authority to dispatch on that host. The second and third only observe the returned pane after its ID has been recorded from `.result.pane.pane_id`.

```sh
herdr pane split "$anchor_pane" --direction right --cwd "$worktree" --no-focus
```

```sh
herdr pane get "$pane_id"
herdr pane process-info --pane "$pane_id"
```

Check the real shell cwd against the canonical registered worktree. If adapter metadata does not prove runtime cwd, with a confirmed idle shell and authority to use it, submit a fixed read-only probe such as `herdr pane run "$pane_id" 'pwd -P'` and read its output with `herdr pane read "$pane_id" --source recent-unwrapped --lines 40`. Correlate fresh output, pane and foreground process before starting. An argument passed to `--cwd` is a request, not cwd evidence.

If SSH is required, use the trusted host-local initialization already selected by the operator, in this pane's shell or through the approved session launcher. Verify the resulting agent availability from that shell before launching, for example with a local `ssh-add -l` read where approved; keep the output private. Do not establish network connectivity just to test a local socket. Avoid starting an extra agent, sourcing pointer files or passing private material as arguments. Stop if the required host-local setup cannot be verified.

## Start and relay

For a supported client and a ready shell, use Herdr's argument forwarding. Example variables below are structured inputs chosen and verified by the Supervisor. `driver_session` is the native session to resume; omit the resume arguments for a genuinely new Driver, and use the adopted client's verified argument forms. This example selects Codex's resume form. Start is an authorized local Driver launch; prompt submits only the held phase request. Use non-sensitive short request text or an approved private transport, and put the request identifier in the text so it can be observed. Never pass a shell-joined command as an argument list or use eval on paths, prompts or settings.

```sh
herdr agent start "$driver_name" --kind codex --pane "$pane_id" -- resume "$driver_session"
```

```sh
herdr agent get "$driver_name"
herdr agent read "$driver_name" --source recent-unwrapped --lines 80
```

After matching the live pane, cwd, native session and expected readiness, submit once. Prefix the text with its fixed request label, for example `Request D1`, and reject terminal control characters. A blocked approval UI requires its own verified decision and relay.

```sh
herdr agent prompt "$driver_name" "$request_text"
```

Read the same agent and pane again. Confirm the exact request and actual phase with native session/evidence, and arm the one-shot in this turn. A queued prompt, a start timeout or an agent status change alone cannot prove delivery. On uncertainty inspect existing pane/agent/session state before any further submission. `agent wait` is a status observation with a timeout, not a persistent scheduler. Use the verified one-shot or equivalent in-session route from the main playbook.
