# 86 Chaos 17.0.16

## Schedule Publish Result Accuracy Repair

This release is limited to the Schedule Builder publish completion summary plus required version and regression metadata.

The server now returns authoritative counts for newly published shifts, verified visibility repairs, already-current shifts, and shifts needing employee-identity review. The browser completion toast uses only those server results. It no longer combines pre-publish browser estimates with post-publish verification results.

The 17.0.15 roster-parity repair, server-authoritative candidate selection, stale-write protections, role checks, leases, verification, notifications, and unrelated product behavior are unchanged.
