## ADDED Requirements

### Requirement: Integrated opt-in for bounded approach review
The bounded approach gate SHALL apply only to a later change whose verified integrated plan parent explicitly selects it. It SHALL NOT widen any operator grant or alter existing approval, candidate review, or publication gates.

#### Scenario: Strict path retained
- **WHEN** a pre-execution review applies but the integrated parent has not selected convergence, including the change introducing it
- **THEN** the existing literal `Verdict: No findings` rule with empty findings and coverage limitations remains in force; an unintegrated edit cannot select the new gate

#### Scenario: Readiness is not authority
- **WHEN** the new gate reports freeze-ready
- **THEN** freeze still requires separate commit authority; exact-plan approval binds the frozen SHA and plan digest and does not grant execution or remote writes

### Requirement: Fixed independent approach review and retained finding history
Before review #1 the orchestrator SHALL fix a review charter, pass rule, budget and qualified independent read-only reviewer binding. It SHALL admit that binding before launch and retain a change-owned record from review #1 with a zero initial correction count. Each accepted receipt SHALL bind the complete, unchanged planning inputs and expected fresh reviewer session.

#### Scenario: Unqualified route or stale evidence
- **WHEN** the requested route is a subagent, unknown, or broader than allowed, or the receipt has wrong identity, partial coverage or input drift
- **THEN** the route is refused before launch or the receipt is rejected, respectively; no substitute or backfilled credit is allowed

#### Scenario: Fresh review carries the ledger
- **WHEN** a later reviewer receives the retained ledger
- **THEN** the reviewer first checks open stable IDs for resolution, persistence or regression, then reports new findings with stable IDs, severity, path and line, impact, trigger and remedy
- **AND** an empty verdict does not erase unresolved findings and any applied finding retains its re-review reference

### Requirement: Charter-based approach acceptance
The reviewer SHALL classify each coverage limitation as `packet-gap`, `declared-deferral`, `containment-boundary`, or `unclassified`. The newest complete receipt SHALL pass only for `Verdict: No findings` or a verdict with only advisory Low findings, no open in-scope High or Medium findings, and only verified `declared-deferral` or `containment-boundary` limitations. Neither the operator nor the orchestrator may reclassify a limitation or downgrade a finding.

#### Scenario: Advisory findings and verified exceptions
- **WHEN** a fresh receipt reports only Low findings with stable IDs, and all limitations are `declared-deferral` entries citing existing reviewed task IDs or their named executable gates, or `containment-boundary` entries matching the fixed charter
- **THEN** retain the Low findings without reopening the loop; retain the deferrals for closure by later task evidence before candidate acceptance and allow freeze readiness

#### Scenario: Out-of-scope observation
- **WHEN** a reviewer records a High or Medium observation outside the charter with no violated in-scope clause
- **THEN** retain it as advisory in the ledger with original severity and explicit scope disposition; the reviewer records it separately from in-scope verdict findings, and a failing native verdict is not rewritten

#### Scenario: Blockers and invalid exceptions
- **WHEN** an in-scope High or Medium finding remains open, a deferral lacks an existing task or executable gate, a containment boundary is undeclared, a limitation is `unclassified`, or a report contradicts its verdict or classifications
- **THEN** readiness is rejected without rewriting the report or weakening the pass rule

#### Scenario: Packet-only failure
- **WHEN** the reviewer classifies a limitation as `packet-gap`: missing packet evidence needed for an in-scope claim, or inconsistent packet-only metadata (for example, conflicting disposition references in the evidence packet rather than in the planning artifacts)
- **THEN** readiness stays blocked until a fresh review verifies the repair. Allow one packet-only repair and re-review per unchanged planning snapshot without consuming a plan correction cycle; if the rerun still identifies a packet gap, stop without charging a plan cycle.

### Requirement: Finite routine planning corrections
Within an existing grant the orchestrator SHALL apply only grounded routine draft corrections in authorized planning paths, run native strict and metadata validation, re-hash the complete inputs, and re-review without an operator relay. The default ceiling is three automatic plan correction cycles; narrower grants prevail and resuming never resets a count.

#### Scenario: Convergent draft
- **WHEN** a synthetic chartered draft has only routine blockers and verified repairs within budget
- **THEN** it reaches freeze-ready within three automatic corrections without intervening operator turns

#### Scenario: Stop without fallback
- **WHEN** budget is exhausted, a non-routine or repeated unresolved conflict occurs, validation or preflight fails, or the same binding fails to launch twice in succession
- **THEN** stop with one decision card and preserve authority restrictions, work and evidence; a failed launch is an attempt, not a correction, and a different route or fourth cycle is not implied
