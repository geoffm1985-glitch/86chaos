# 86 Chaos 13.1.42 Release Notes

## Branding Upload Guardrail

- Removed restaurant-logo upload/display controls from Settings → Branding so the app header stays locked to 86 Chaos branding only.
- The main header no longer renders saved `restaurantLogoUrl`, `branding.restaurantLogoUrl`, or `branding.logoUrl` values from older settings.
- Saving Settings → Branding now clears older restaurant-logo URL/display flags from workspace branding settings while keeping accent color, help contact, login/help message, timezone, date/time, currency, week-start, and default staff landing-tab controls.
- System Administrator branding tools no longer offer a Logo URL field and save logo display as disabled.
- Added a guarded legacy Firebase Storage rule for the old `cheers-restaurant-assets/` upload path so older deployed clients do not hit `storage/unauthorized` while this build is rolling out.

## Deployment Notes

- Deploy the app through GitHub/Vercel.
- Publish `storage.rules` to the same Firebase project used by the deployment. This is required for the legacy upload-path permission fix.
- No Firestore rule changes are required for this fix.
- No new Vercel environment variables are required.
