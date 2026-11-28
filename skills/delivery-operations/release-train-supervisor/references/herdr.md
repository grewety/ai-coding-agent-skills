# Herdr observation example

Use an operator-approved Herdr instance on the intended host for read-only observation. Confirm these CLI and server forms with local help and a controlled fixture. Qualify the terminal adapter and the one-shot scheduler independently before dispatch.

## Observe the existing Driver

```sh
herdr workspace list
herdr pane list
herdr agent list
```

Select the pane ID from verified records and correlate it with the current inventory. Inspect that pane without sending input.

```sh
herdr pane get "$pane_id"
herdr pane process-info --pane "$pane_id"
herdr pane read "$pane_id" --source recent-unwrapped --lines 40
```

Treat pane output and process metadata as observations. Workspace, pane and agent names can outlive an attempt or be reused. Use fresh native adapter evidence to establish runtime identity and cwd. Reconcile an active or uncertain Driver before considering a launch or relay.

## Verify the adapter and deliver the phase request

1. Verify the dedicated worktree's canonical root, registered branch and HEAD against the expected change and phase. Verify the exact plan or candidate, the applicable phase grant and its restrictions, budget and deadline, and any separate host or authentication authority. Bind the request ID and exact request bytes to that worktree, change, phase and grant in approved private evidence.
2. Prepare the qualified terminal adapter for the authorized native launch or resume. Preserve argument boundaries with a structured argument list and the installed client's verified forms. Use a verified native session ID for resume and the client's new-session form for a fresh Driver. Prepare the phase request as literal data for the adapter's qualified private transport, such as a documented stdin or request-file route. Keep shell evaluation and sensitive request data out of launch arguments.
3. When SSH is required, use the operator's already approved host-local agent or session launcher. Verify the expected agent from the intended session, for example with an approved local `ssh-add -l` read, and keep the output private. Keep verification local to the existing socket. Avoid starting an extra agent, sourcing pointer files or passing private material in arguments. Stop if the required setup cannot be verified.
4. Use the adapter to launch or resume the Driver and seal the actual live native session, its process identity, observed runtime cwd and explicitly bound request transport. Immediately before delivery, recheck the registered worktree, branch and HEAD. Verify that the Driver is ready in that worktree, the live session and transport still match the seal, and the current grant authorizes the exact request. Require the transport to enforce the same binding when it accepts the request, including if delivery occurs during launch. Submit once using that bound transport. Stop at any mismatch, missing readback or unavailable session-bound route.

If the Driver enters a native human-input wait, use its qualified native decision surface. A Herdr fallback is limited to an independently qualified, documented human-input route bound to that exact waiting session. Verify the same session and the applicable decision authority before exposing it for human input. Keep phase requests on the adapter's bound request transport.

## Reconcile delivery and monitor

Arm and read back the verified one-shot or equivalent in-session monitor from the main playbook in the same turn as launch or unblock, including uncertain startup or delivery. Bind the check to the original Driver and request and keep at most one outstanding check. Rearm while work is active under the held authority.

Confirm acceptance and actual phase using native evidence tied to the same session and exact request. A transport acknowledgment, pane output or status change alone leaves delivery unproven. If startup or delivery is uncertain, treat the original Driver as potentially active and inspect the same session, request and relevant repository evidence. Retry only when positive evidence shows the action did not take effect, the original request cannot still run, and the same grant still permits retry.

## Local-CLI Trust-Boundary Filter

Use this triage with any qualified adapter. Read the pinned verifier's
declared trust model and trace the finding through its actual inputs, checks
and evidence custody. A local verifier that can accept changed evidence under
the original digest has an integrity defect. A request for independent remote
attestation may assume a trust service outside the declared local model.
Check each concrete claim against the local boundary before proposing a
disposition.

Preserve the finding, evidence and reasoning. Route any required disposition
through the adopting project's existing review authority. Have the authorized
implementer repair genuine logic, integrity or custody defects with regression
coverage, then reverify and obtain the applicable independent disposition.
A trust-model objection gives no clearance for a concrete defect.

## Plan for a second PR-fix review packet

If an eligible targeted PR-fix delta review might need a second packet, ask
for up to two packets in the original scoped grant, within the applicable cap.
Bind the grant to the exact approved fix scope, reviewed ancestor, ordered
fix range and final head under the adopting review and finish rules. Verify
packet feasibility offline and reserve the full cost of the admitted packet
set before provider contact. A second planned packet covers spillover within
that scope. A retry requires separate authority.

Require independent coverage of the complete postimage, zero unresolved or
waived findings and passing final-head gates. Preserve the verified lineage
and separate finish authority. If the scope, cap or proof cannot admit the
targeted review, stop that route and use the applicable full exact-candidate
review procedure once authorized.
