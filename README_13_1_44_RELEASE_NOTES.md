# 86 Chaos 13.1.44 Release Notes

## Restaurant Logo Upload Fix + Locked 86 Chaos Brand

- Restaurant logo uploads now use a secure app API route first instead of relying only on browser-to-Firebase Storage rules.
- This fixes the `storage/unauthorized` upload failure seen on `{restaurantId}/brandAssets/restaurant-logo...` paths when deployed browser rules or user-doc matching are stale.
- Restaurant/customer logos are still supported and can appear beside 86 Chaos branding.
- The 86 Chaos logo/brand remains locked and always visible. There is no setting that hides or replaces it.
- The Firebase Storage rules were tightened and clarified for restaurant brand assets, owner/admin/branding permission checks, and the legacy Cheers branding path.
- The Help Center and Administrator wording were updated for the current branding behavior.

## Deployment Notes

- Deploy the app through GitHub/Vercel so the new `/api/brand-logo` route is live.
- Make sure the Vercel project has Firebase Admin credentials and `FIREBASE_STORAGE_BUCKET` set for the same Firebase project used by the site.
- Publish the included `storage.rules` to Firebase. The secure API route should handle logo uploads, but the rules are still the fallback and the long-term browser protection.
- No Firestore rule changes are required for this fix.
