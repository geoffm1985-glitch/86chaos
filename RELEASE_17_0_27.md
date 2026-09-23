# 86 Chaos 17.0.27

## Emergency Schedule Assignment Reliability Repair

17.0.27 is a surgical emergency repair for Schedule Builder shift assignment. The assignment action no longer writes shift documents directly from the browser. It submits the already-validated Schedule Builder assignments to an authenticated, App Check-aware server route that enforces Schedule permission, canonicalizes tenant and draft-publication fields, commits the selected dates atomically, and uses one operation identity to make an accidental request replay idempotent.

The Schedule Builder now shows a visible Assignment Failed message when the server does not confirm the write. Successful assignments also clear matching local delete tombstones before adding the server-confirmed local echo, preventing a newly re-added shift from remaining hidden after Clear Month or single-shift deletion activity.

A browser release-gate regression now assigns a future QA shift through the actual Schedule Builder UI and removes it afterward. The failed+new delta scope is advanced to 17.0.27 and includes both the Phase 1 Spanish browser regression and this emergency shift-assignment browser regression on desktop and mobile Chromium. The current-release targeted suite runs the new server/source regression before the scoped Playwright delta selection.

No POS, inventory, financial, time-clock, schedule publishing, Request Off policy, or unrelated application behavior was redesigned. Phase 1 Spanish and the 17.0.25 deletion/delta repairs are preserved.
