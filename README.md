# 86 Chaos

Current Version: 15.0.26 - MFA Recovery & Safer Enforcement

## 15.0.26 focus

This build keeps Google sign-in out of scope and finishes the practical MFA safety rails needed before elevated-role enforcement is turned on.

## Included in this build

- Backup MFA phone enrollment from Account Security.
- Super Admin-only MFA Recovery for lost/broken phones.
- MFA recovery inspection with masked factor display.
- MFA reset with required recovery reason and audit log entry.
- Clearer guidance that MFA enforcement is for owners, managers, admins, and System Administrators; regular employees may enroll optionally.
- Better Firebase MFA error messages for SMS region, authorized domain, provider, reCAPTCHA, throttling, and phone-format issues.
- Updated `/api/account-security` to support MFA recovery actions.

## Deployment checklist

1. Deploy the app through GitHub/Vercel.
2. Confirm `/version.json` reports `15.0.26`.
3. In Firebase Authentication / Identity Platform, confirm SMS MFA is enabled and the correct SMS region is selected.
4. Keep these Vercel values off while testing:

```env
MFA_ENFORCE_ELEVATED_ROLES=false
FIREBASE_MFA_ENFORCE_ELEVATED_ROLES=false
REACT_APP_MFA_ENFORCE_ELEVATED_ROLES=false
```

5. Enroll one elevated account.
6. Add a backup phone if available.
7. Test Super Admin MFA Recovery by checking a user and resetting MFA with a reason.
8. Only after recovery is proven, consider turning elevated-role MFA enforcement on.

## Separate publishing

- Firestore rules: no changes.
- Storage rules: no changes.
- API routes: changed `/api/account-security`, so Vercel redeploy is required.
- Vercel env vars: no new variables.
