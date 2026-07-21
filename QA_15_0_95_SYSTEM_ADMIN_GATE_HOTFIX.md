# QA — 15.0.95 System Admin Gate Hotfix

## Playwright
Run the auth permission matrix:

```powershell
cd C:\Users\geoff\Documents\GitHub\86chaos
npx.cmd playwright test tests/86chaos-deep-suite/01-auth-permission-matrix.spec.js --project=chromium --headed --workers=1
```

## Manual checks
1. Log in as STAFF.
2. Directly open `?tab=godmode`.
3. Confirm the page shows:
   - `Plan & Permission Gate`
   - `Your role does not include this tool`
4. Confirm the STAFF page does **not** show:
   - signed-in email diagnostic card
   - Firebase UID card
   - server/admin/env status
   - MASTER_ADMIN_EMAIL / MASTER_ADMIN_EMAILS / REACT_APP_MASTER_ADMIN_EMAIL guidance
5. Log in as the verified System Administrator/Super Admin.
6. Open System Administrator and confirm the actual admin tool still loads.

## Build check
`npm run build` completed successfully in the patch workspace.
