# QA Checklist: 13.1.44 Restaurant Logo Upload Fix

## Settings → Branding

- Log in as the account owner, Super Admin, workspace admin, or a user with Branding/Settings permission.
- Open Settings → Branding.
- Confirm 86 Chaos branding is visible and there is no control that can hide it.
- Upload a restaurant logo PNG/JPG/WebP/GIF/SVG under 8MB.
- Confirm the upload succeeds without the `Firebase Storage: User does not have permission` toast.
- Confirm the restaurant logo preview appears and the checkbox says it controls only the restaurant logo beside locked 86 Chaos branding.
- Click Save Branding & Display.
- Refresh the app and confirm 86 Chaos still displays.
- Confirm the restaurant logo appears beside it when the restaurant-logo checkbox is on.
- Turn the restaurant-logo checkbox off, save, refresh, and confirm only the restaurant logo disappears.

## Permission Checks

- Try as a normal staff user without Branding/Settings permission and confirm upload/save is blocked.
- Try as a permitted branding manager and confirm upload/save works.
- Confirm demo mode does not expose private customer or employee data through branding fields.

## Deploy / Firebase Checks

- Deploy the Vercel app so `/api/brand-logo` is available.
- Confirm the Vercel Firebase Admin credentials point to the same Firebase project as the app environment.
- Publish `storage.rules` to Firebase.
- Confirm uploaded logo files land under `{restaurantId}/brandAssets/`.

## Regression Checks

- Accent color, restaurant/group name, login/help message, Help Center contact, timezone, date format, time display, currency, week start, and default staff landing tab still save.
- Help Center search still works.
- Voice command dock still shows the BETA tag and follows permissions.
- System Administrator branding/display text still says 86 Chaos is locked and customer logos cannot replace it.
