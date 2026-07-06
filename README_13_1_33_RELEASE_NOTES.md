# 86 Chaos 13.1.33 Release Notes

## Geofence GPS Lookup Repair
- Repaired the Workspace / Global Config **Find GPS** flow so address lookup runs through the app's Vercel API instead of relying only on the mobile browser reaching the map service directly.
- Added a second map lookup provider and a safe Cheers Chilton fallback for the known Highway 57 address pattern.
- The app now keeps existing latitude/longitude values when the lookup service is unavailable instead of throwing a vague "Failed to reach map service" error.
- Geofence coordinates are saved with six-decimal precision for better time-clock boundary accuracy.
- The embedded geofence map now uses a more mobile-friendly tile source.

## Administrator Manual
- Added admin guidance for Workspace geofence setup, map lookup failures, manual coordinate entry, and preview deployment API route checks.

## Deployment Notes
- Vercel must deploy the new `api/geocode-address.js` route.
- No Firestore rules, Storage rules, or Vercel environment variable changes are required.
