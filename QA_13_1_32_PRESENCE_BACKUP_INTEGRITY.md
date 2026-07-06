# QA Checklist: 13.1.32 Presence + Backup Integrity

## Live Presence
- Log in on a phone as a regular staff/test account.
- Open Staff Roster and wait 30 seconds.
- Confirm My Live Presence Check says the heartbeat saved through the API or client fallback.
- Confirm the signed-in staff row does not falsely show Online Now unless the heartbeat is confirmed.
- Open System Administrator → Live Activity from an admin account and confirm regular staff appear within the live window.
- Refresh the staff phone browser and confirm the heartbeat recovers after Firebase Auth restores.
- If My Live Presence Check says Firebase login is not active, log out and back in on that device.

## Backup Integrity
- Run System Administrator → Health Dashboard → Run Full System Diagnostics.
- Confirm backupIntegrity is verified or warning, not failed with incorrect header check, when the backup data is readable.
- Run System Administrator → Forensics & Backups → Backup Now.
- Confirm system/backupStatus stores backupIntegrity with storageFormat and no false decompression failure.
- Confirm Backup Center can still list backups.

## Administrator Manual
- Open System Administrator → Admin Manual.
- Search for Live Activity and confirm the article explains auth session, Firestore rules, and Preview/Production Firebase mismatch checks.
- Search for backup integrity and confirm the article explains the .json.gz / readable JSON behavior.
