# 86 Chaos 17.0.17

## Schedule Builder Navigation and Legacy Publish Identity Repair

This release is limited to the two real-device defects reported after 17.0.16, plus required version and regression metadata.

### Schedule Builder navigation

Top-level tab changes now commit synchronously. The Schedule Builder can no longer keep its heavy render tree mounted merely because React deferred the route update after the drawer closed. Schedule subtab behavior is otherwise unchanged.

### Schedule publication employee identity

The server now mirrors the Schedule Builder's legacy shift-only roster fallback when no real roster identity matches. The fallback is derived only from the authoritative saved shift already loaded by the server and requires the same named shift identity the browser requires. Real inactive, revoked, or ambiguous roster identities are not overridden.

Canonical workspace-member rows continue to take priority, and matched account display identity is preserved when membership display fields are blank.

The 17.0.14 authoritative candidate checks, 17.0.15 tenant-user fallback, 17.0.16 server-authoritative result summary, role checks, publish leases, stale-write fencing, verification, and notification boundaries remain intact.
