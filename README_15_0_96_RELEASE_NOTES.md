# 86 Chaos 15.0.96 Release Notes

## Help Center safety hotfix

- Staff and other non-super-admin users no longer see internal System Administrator Help Center categories or articles.
- Public/customer Help Center filtering now removes internal-only terms including System Administrator, Back Office Suite, QuickBooks Integration Hub, Python Automation, Backup Center, Security Center, Forensics, and Pay Rates.
- The searchable training manual inside Help Center now uses the same customer-safe filtering for non-super-admin users.
- Super Admin / System Administrator users still keep the internal manuals and diagnostics material.
- The unauthorized System Administrator route remains a generic Plan & Permission Gate.

## Why this was changed

The Playwright permission matrix correctly caught that STAFF could open Help Center and see internal admin article names. That was an app documentation visibility issue, not a test issue.

## Deployment note

Deploy this app before judging the 15.0.96 Playwright suite. Update local `.env` to `CHAOS_EXPECTED_VERSION=15.0.96` after deploying this build.
