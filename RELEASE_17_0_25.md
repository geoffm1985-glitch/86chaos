# 86 Chaos 17.0.25

## Schedule Builder Delete Reliability and Delta Baseline Repair

17.0.25 is a surgical repair of the two Schedule Builder deletion defects reported after 17.0.24 plus the failed+new delta-gate baseline defect.

Schedule Builder **Clear Month** now performs its authoritative deletion on the server after normal Schedule Builder authorization. The server scans the restaurant's shift records across the canonical `restaurantId` identity and the legacy `workspaceId` / `tenantId` identities, deletes only records belonging to the selected month, and relies on the successful Firestore batch commit instead of repeatedly rescanning the whole tenant after the write. The three tenant-alias reads run concurrently, and the browser no longer makes a separate server preview request before confirmation. Events, Request Off records, availability, staff, templates, presets, and other restaurant data are not part of the operation.

Deleting an individual shift chip now uses the same authenticated server boundary rather than a direct browser Firestore delete. The operation is tenant-bound and removes hidden duplicate records that represent the same employee/date/time shift so a duplicate cannot immediately reappear after a successful delete. The tenant scan is performed once, its legacy alias queries run in parallel, and successful batch commits are not followed by redundant full-tenant verification scans. Another employee's shift at the same time is not included.

Both destructive actions now hide the confirmed shift(s) immediately in Schedule Builder while the server request finishes. If the server mutation fails, only those optimistic hide markers are rolled back so the UI accurately restores the shift(s).

The failed+new delta gate now accepts a completed full Playwright run with zero failed or timed-out tests as a valid baseline. When earlier release-gate evidence collection lost the preflight files, delta baseline version identity can be recovered from the surviving source-identity and deployment-identity evidence. `npm run test:play-store:delta` also runs the current release targeted regressions before its scoped Playwright selection, so the current implementation is tested even when it is represented by Node regression tests rather than a new Playwright identity.

The 17.0.23 Request Off cutoff/blackout policy is preserved. No POS Bridge, inventory, financial, recipe, payroll, or unrelated application behavior was intentionally changed.
