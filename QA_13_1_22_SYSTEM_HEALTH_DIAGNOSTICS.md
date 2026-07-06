# QA Checklist — 86 Chaos 13.1.22 System Health & Diagnostics

## Deploy / Smoke

- [ ] Push the full ZIP contents to GitHub.
- [ ] Confirm Vercel redeploys successfully.
- [ ] Confirm `/api/full-system-diagnostics` exists after deployment.
- [ ] Confirm `/api/firestore-backup` still responds for Super Admin manual backup.
- [ ] Confirm no Firebase rules publish is needed for this version.

## Health Dashboard

- [ ] Log in as Super Admin.
- [ ] Open System Administrator → Health Dashboard.
- [ ] Click Refresh Health.
- [ ] Confirm Firestore latency displays in milliseconds.
- [ ] Confirm Backup Storage shows file count and storage size.
- [ ] Confirm API Response Times shows Whoami, Security Diagnostics, and Backup Storage List.
- [ ] Confirm Last Successful Sync shows the latest backup/sync time when available.
- [ ] Confirm Backup Integrity shows verified / failed / not checked.

## Full System Diagnostics

- [ ] Click Run Full System Diagnostics.
- [ ] Confirm a JSON report downloads.
- [ ] Confirm a toast says diagnostics completed.
- [ ] Confirm the report includes client health, server checks, storage usage, and backup integrity.
- [ ] Confirm an audit record appears for `FULL_SYSTEM_DIAGNOSTICS_RUN`.

## Backup Integrity

- [ ] Open System Administrator → Forensics & Backups.
- [ ] Click Run Backup Now.
- [ ] Confirm backup completes.
- [ ] Confirm toast includes an integrity status.
- [ ] Confirm Command Deck / Health Dashboard shows backup integrity after the backup finishes.
- [ ] Refresh Backup Center and confirm listed backups show integrity status when metadata exists.

## Audit Timeline

- [ ] Open System Administrator → Forensics & Backups.
- [ ] Confirm Administrator Session Timeline appears above Review Stamps.
- [ ] Confirm recent admin actions are grouped by session or actor/time window.
- [ ] Create a Review Stamp and confirm it appears inside the same recent session group.
- [ ] Run Full System Diagnostics and confirm the server-side audit appears in the audit log.

## Regression

- [ ] Time Clock button still switches Clock In / Clock Out immediately and uses correct loading labels.
- [ ] Live Activity still shows online/recent users.
- [ ] Backup Center restore still requires typing RESTORE.
- [ ] Help Center release note remains public-facing and generic.
