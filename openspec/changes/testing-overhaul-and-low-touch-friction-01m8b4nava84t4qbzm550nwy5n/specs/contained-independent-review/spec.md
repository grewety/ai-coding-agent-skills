# Contained independent review delta

## MODIFIED Requirements

### Requirement: Bounded inter-packet pacing and private diagnostics

The trusted host SHALL support bounded concurrency and pacing for review packets within the run deadline. It SHALL retain sanitized upstream response classifications in host-private status evidence and preserve containment and the sandbox's sanitized failure response.

#### Scenario: Multi-packet pacing
- **WHEN** a valid existing host configuration omits `packetConcurrency` or explicitly sets it to 1
- **THEN** default to serial execution and preserve existing raw configuration pins, held reservations and offline readback compatibility
- **AND** when pacing is enabled, wait the configured interval before launching an eligible successor after settlement. A single packet needs no delay.

#### Scenario: Pinned concurrent execution
- **WHEN** the exact pinned configuration sets `packetConcurrency` to integer 2 or 3, the automatic probe passes and the approved run can launch
- **THEN** launch at most that many packets concurrently and space successive packet starts by at least `interPacketDelayMs`
- **AND** reserve the full probe and packet budget before provider contact, preserve an independent session, relay isolation, bounded capture and exact whole-file audit per packet, and preserve packet identity in offline verification regardless of completion order.

#### Scenario: Invalid configuration or unproved isolation
- **WHEN** the cap is nonintegral, outside 1 through 3, unpinned, or incompatible with packet isolation
- **THEN** refuse the unsafe run before new exposure. If safe concurrency cannot be proved, ship the conservative serial route and document the exact blocker.

#### Scenario: Classified upstream refusal
- **WHEN** the upstream returns HTTP 429, 529, or 401 or 403
- **THEN** the host retains the bounded class `upstream-rate-limited`, `upstream-overloaded`, or `upstream-auth-failed` respectively, associated with the relevant attempt and packet
- **AND** upstream failure headers, body, credentials and private diagnostic class stay out of sandbox input and output. Failure, cancellation or exhausted time stops new launches, and the supervisor settles any active siblings and retains available evidence. A partial or failed run is never admissible success and makes no automatic retry.
