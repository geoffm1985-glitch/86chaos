# QA Checklist: 86 Chaos 15.0.77 Auth Network Login Hotfix

## Required Preview Checks
- Deploy ZIP to Vercel Preview.
- Open the preview URL in a clean/incognito browser.
- Confirm the login screen appears.
- Click Unlock System once with empty fields and confirm it asks for email/password.
- Enter valid test credentials and click Unlock System once.
- Confirm the button changes to `Unlocking...` immediately.
- Confirm repeated clicking does not fire repeated login attempts.
- Confirm login either succeeds or shows a detailed Firebase project/host error within 25 seconds.
- Confirm preview uses the test Firebase project `chaos-test-d1601`.

## Required Production Checks
- Deploy to production only after Preview login works.
- Open `app.86chaos.com`.
- Confirm production uses Firebase project `cheers-34b8d`.
- Confirm owner, manager, and staff accounts can log in.
- Confirm the system-update banner does not appear after one hard refresh.

## Browser Cache Reset If Needed
- DevTools → Application → Service Workers → Unregister.
- DevTools → Application → Storage → Clear site data.
- Close the tab and reopen the app.

## Validation Run Locally
- `npm ci --omit=optional --no-audit --no-fund --progress=false`
- `npm test`
- `NODE_OPTIONS=--max-old-space-size=4096 GENERATE_SOURCEMAP=false DISABLE_ESLINT_PLUGIN=true npm run build`

## Known Pre-existing Issue
- The uploaded production base has pre-existing TypeScript strictness errors in the Firebase Functions subproject. This hotfix did not modify Functions source because the requested repair was the browser login/Firebase Auth failure and service-account-key handling was left untouched.
