# 86 Chaos 14.0.6 Release Notes

## Client Save & Roster Cleanup

### Fixed
- System Administrator → Workspaces → Manage Client saves now sanitize nested Firestore update data before saving.
- This prevents the `Function updateDoc() called with invalid data. Unsupported field value: undefined` error when an older or partially edited workspace has empty nested settings.
- Workspace settings history snapshots are sanitized too, so before/after audit history cannot reintroduce unsupported values.

### Changed
- Removed the read-only notice banner from Staff Roster for regular staff.
- Staff Roster editing is still restricted to managers/admins/owners. Regular staff can view the roster and live activity, but they still cannot add, edit, reset, or remove staff.

### Deployment
- No new API routes.
- No new Vercel environment variables.
- No Firestore rule change required for this fix.
- No Storage rule change required for this fix.
