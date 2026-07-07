# QA Checklist: 13.1.42 Branding Upload Guardrail

## Settings → Branding

- Log in as the account owner.
- Open Settings → Branding.
- Confirm the Restaurant Logo upload button is gone.
- Confirm there is no checkbox to show a restaurant logo beside 86 Chaos branding.
- Save Branding & Display.
- Refresh the app and confirm the top header still shows only the 86 Chaos branding.
- Confirm accent color, help contact, login/help message, timezone, date/time, currency, week start, and default staff landing tab still save correctly.

## Existing Logo Cleanup

- If the workspace previously had a restaurantLogoUrl saved, save Settings → Branding once.
- Confirm the restaurant logo does not appear in the header after refresh.
- Confirm the workspace systemSettings now keeps restaurant logo display disabled.

## System Administrator

- Open System Administrator → Platform Operations / Branding Display tools.
- Confirm the Logo URL field is no longer offered.
- Save a workspace branding record and confirm it does not re-enable logo display.

## Firebase Storage Rules

- Publish `storage.rules` to the correct Firebase project.
- Confirm old preview deployments no longer throw `storage/unauthorized` on the legacy `cheers-restaurant-assets/` path while this rollout finishes.

## Regression Checks

- Settings permissions still show/hide Branding correctly.
- Help Center still opens and searches normally.
- Voice command dock still stays visible with the BETA tag.
- No new Firestore or Vercel environment variable setup is required.
