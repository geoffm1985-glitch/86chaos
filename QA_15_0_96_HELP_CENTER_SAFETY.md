# QA 15.0.96 Help Center Safety

## Manual checks

1. Log in as STAFF.
2. Open Help Center.
3. Confirm Help Center does not show:
   - System Administrator
   - Back Office Suite
   - QuickBooks Integration Hub
   - Python Automation
   - Backup Center
   - Security Center
   - Forensics
   - Pay Rates
4. Search Help Center for `admin`, `backup`, `security`, `quickbooks`, and `pay` as STAFF.
5. Confirm internal setup/diagnostic material is not visible.
6. Open `?tab=godmode` as STAFF.
7. Confirm it shows only a generic Plan & Permission Gate.
8. Log in as a real Super Admin.
9. Confirm System Administrator route and internal manuals are still available.

## Playwright checks

Run after deployment:

```powershell
cd C:\Users\geoff\Documents\GitHub\86chaos
npx.cmd playwright test tests/86chaos-deep-suite --project=chromium --headed --workers=1
```

Expected local env after deployment:

```env
CHAOS_EXPECTED_VERSION=15.0.96
```
