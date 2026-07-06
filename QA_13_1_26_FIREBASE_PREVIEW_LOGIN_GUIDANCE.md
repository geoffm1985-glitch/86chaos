# QA Checklist: 86 Chaos 13.1.26 Firebase Preview Login Guidance

## Login error clarity

- Open a Vercel preview URL that is not authorized in Firebase.
- Attempt login.
- Confirm the error explains that Firebase blocked the preview link.
- Confirm the message says login, push-token repair, and owner tabs can fail from that preview.
- Confirm the message includes the exact domain.
- Confirm the message includes the exact `https://domain/*` referrer pattern.
- Confirm the error renders with readable line breaks on mobile.

## Production login

- Open the normal production app URL.
- Log in as platform Super Admin.
- Confirm Settings → Workspace is visible.
- Confirm Settings → Integrations is visible.
- Confirm Settings → Alerts can repair/connect push.

## Preview testing after Firebase update

- Add the preview domain to Firebase Auth authorized domains.
- Add the matching referrer pattern to the Google Cloud API key restrictions.
- Reload the preview URL.
- Confirm login succeeds.
- Confirm owner-level Settings tabs load for the authorized account.
