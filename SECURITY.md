# 86 Chaos Security Notes

## Permission boundary changes

Team Management is limited to staff/roster-style authority. Financials, wages, scans, inventory, invoices, and system security require their own explicit permissions or owner/admin authority.

## Server-only records

The frontend no longer writes `auditLogs` or `crashReports` directly. These records should be created by authenticated API routes so the server can validate the user, workspace, App Check setting, rate limits, and safe payload shape.

## Firebase rules deployment required

Deploy both:

```bash
firebase deploy --only firestore:rules
firebase deploy --only storage
```

## App Check and MFA

Production should keep App Check enforcement enabled for protected API routes and MFA enforcement enabled for elevated roles/permissions.

## Service account key

This release intentionally leaves generic complete JSON `FIREBASE_SERVICE_ACCOUNT_KEY` support intact. Keep the value in the active Vercel environment as the full service-account JSON for the active Firebase project.
