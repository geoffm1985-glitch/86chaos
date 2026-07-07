# 86 Chaos 13.1.43 Release Notes

## Restaurant Logo Restore + Locked 86 Chaos Brand

- Restored restaurant/customer logo support in Settings → Branding. Owners and users with Branding permission can paste a restaurant logo URL or upload a logo image.
- The 86 Chaos logo is now locked as the required header brand and is not treated as an optional display setting. The restaurant logo can only appear beside it, never replace it.
- Saving Branding & Display now preserves `restaurantLogoUrl` and `showRestaurantLogo` instead of clearing them.
- System Administrator branding tools now label the customer logo as Restaurant logo URL and keep the app name locked to 86 Chaos.
- Firebase Storage rules now allow restaurant brand-asset uploads for Super Admin, the workspace owner email, admins, and users with Branding/Settings permission. The legacy Cheers upload path remains guarded for older preview clients.

## Deployment Notes

- Deploy the app through GitHub/Vercel.
- Publish `storage.rules` to the same Firebase project used by the deployment. This is required for the logo upload permission fix.
- No Firestore rule changes are required for this fix.
- No Vercel environment variables changed.
