# Backup and Restore Notes

- Do not run destructive restore actions against live production data during QA.
- Verify backup selection, integrity checks, target workspace, and target environment before restore.
- Restore authorization should be limited to System Administrator or explicit owner-level restore authority.
- After deploying this build, confirm audit records are written through `/api/audit-log` for backup/restore actions.
