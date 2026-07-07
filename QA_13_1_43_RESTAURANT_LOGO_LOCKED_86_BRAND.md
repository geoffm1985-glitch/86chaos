# QA Checklist: 13.1.43 Restaurant Logo + Locked 86 Chaos Brand

## Settings → Branding

- Log in as the account owner or a user with Branding permission.
- Open Settings → Branding.
- Confirm the 86 Chaos logo preview is visible and there is no setting that hides it.
- Upload a restaurant logo image under 8MB.
- Confirm the upload succeeds and the restaurant logo preview appears beside the 86 Chaos preview.
- Click Save Branding & Display, then refresh the app.
- Confirm the top header always shows 86 Chaos branding.
- Confirm the restaurant logo appears beside it when the restaurant-logo checkbox is on.
- Turn the restaurant-logo checkbox off, save, refresh, and confirm only the restaurant/customer logo disappears, not the 86 Chaos logo.

## Firebase Storage Rules

- Publish `storage.rules` to the correct Firebase project.
- Confirm uploads work on the new restaurant-scoped path: `{restaurantId}/brandAssets/...`.
- Confirm the legacy `cheers-restaurant-assets/...` path no longer throws `storage/unauthorized` during rollout.

## System Administrator

- Open System Administrator → Platform Operations → Branding / Display.
- Confirm the app name is locked as 86 Chaos.
- Confirm the editable logo field is labeled Restaurant logo URL.
- Confirm saving a workspace branding record does not hide or replace the 86 Chaos brand.

## Regression Checks

- Accent color, login/help message, Help Center contact, timezone, date/time, currency, week start, and default staff landing tab still save.
- Settings permissions still control who can access Branding.
- Help Center remains public-facing and does not expose System Administrator or Forensics details.
- Voice command dock still shows the BETA tag and follows permissions.
