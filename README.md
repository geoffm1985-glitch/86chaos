# 86 Chaos

Current Version: 15.0.32 - AI Support Manual and Production Hardening

## 15.0.32 focus
- Rebuilt the private System Administrator Manual into a question-driven support console.
- Added support playbooks for login, permissions, time clock/GPS, push, AI scans, blank screen, Firebase rules, MFA recovery, and account deletion.
- Added Security Center review controls for account deletion requests.
- Hardened account deletion, Super Admin, backup, MFA recovery, and rules behavior.
- Removed personal-email fallbacks from Firebase rules. Super Admin access now needs a real claim/profile flag for Firestore and Storage rules.

## Before you publish Firebase rules
- Make sure your own account has one of these in Firebase/Firestore:
  - Firebase Auth custom claim `superAdmin=true`
  - `users/{yourUid}.isSuperAdmin=true`
  - `users/{yourUid}.systemAccess.superAdmin=true`
- Vercel env vars can help API routes, but Firebase rules cannot read Vercel env vars.
- If you skip this, you can lock yourself out after publishing rules.

## Vercel environment variables
Set these in the correct Vercel environment before redeploying:
- `RECOVERY_CODE_SECRET`: required for MFA recovery codes. Use a random value at least 32 characters long.
- `MASTER_ADMIN_EMAIL` or `MASTER_ADMIN_EMAILS`: server-side System Administrator fallback for API routes.
- `REACT_APP_MASTER_ADMIN_EMAIL`: frontend menu visibility fallback, if you still use it.
- Keep existing Firebase, Gemini, cron, push, and App Check variables exactly as they already are.

Set `RECOVERY_CODE_SECRET` in both Preview/testing and Production if you use both.

## Firebase rules
Publish these files manually in Firebase Console:
- Firestore Database -> Rules: paste the contents of `firestore.rules`.
- Storage -> Rules: paste the contents of `storage.rules`.

Do not paste `firebase.json` into the rules editor. `firebase.json` only tells tools where the rule files live.

## Recommended deployment order
1. Upload this source to GitHub.
2. Set/update Vercel env vars, especially `RECOVERY_CODE_SECRET`.
3. Redeploy the testing/preview Vercel app.
4. Confirm `/version.json` reports `15.0.32`.
5. Log in as System Administrator on testing.
6. Open System Administrator -> Manual and test the support console.
7. Open System Administrator -> Security Center and confirm account deletion requests load.
8. Publish Firestore rules and Storage rules to the testing Firebase project.
9. Log out and back in, then retest login, schedule, inventory, menu scan, invoice scan, push token save, account security, backups, and restore drill status.
10. Only after testing passes, repeat the Vercel env, deploy, and Firebase rules steps on production/main.

## Do not turn on MFA enforcement yet
Keep `MFA_ENFORCE_ELEVATED_ROLES=false` until:
- At least one owner and one System Administrator have enrolled MFA.
- They have logged out and completed a fresh MFA login.
- Recovery codes generate successfully.
- MFA reset/recovery has been tested on a non-critical account.
