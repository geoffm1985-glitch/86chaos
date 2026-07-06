# QA 13.1.17 Admin Operations + Privacy

## Command Deck backup countdown

1. Log in as Super Admin.
2. Open System Administrator.
3. Confirm Command Deck shows Last Backup plus Next Automatic Backup.
4. Confirm countdown is visible and changes after about a minute.
5. Click Next Automatic Backup and confirm it opens Forensics.
6. Run Backup Now and confirm the countdown/backup status does not break.

## Forensics tools

1. Open System Administrator → Forensics.
2. Confirm Diagnostic & Forensic Toolkit appears.
3. Click Forensic JSON and confirm a JSON file downloads.
4. Click Client CSV and confirm a CSV downloads.
5. Click Stamp Review and confirm the success toast.
6. Click Clear This Cache and confirm only local temp cache is cleared.
7. Confirm Backup Center still lists, downloads, and restores backups with RESTORE confirmation.

## Operations options

1. Open System Administrator → Operations.
2. Confirm the new cards are visible: Forensic Bundle, Client Directory Export, Ops Review Stamp, This Device Cache.
3. Test each safe download/action.
4. Confirm Global Lockdown still requires explicit confirmation.

## Privacy policy

1. Log out.
2. Click Privacy Policy & Terms of Service on the login screen.
3. Confirm Last Updated is July 6, 2026.
4. Confirm it mentions web/PWA use, location only for punch verification, no background location tracking, invoice scanning, uploads, diagnostics, push notifications, backups, and employer control.

## Help Center release notes

1. Open Help Center.
2. Search 13.1.17.
3. Confirm release note is generic and does not expose administrator-tab implementation details.
