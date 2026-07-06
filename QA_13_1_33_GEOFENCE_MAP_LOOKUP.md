# QA Checklist: 13.1.33 Geofence Map Lookup

## Preview deploy
- Deploy the full app ZIP to Vercel Preview.
- Confirm `api/geocode-address.js` appears in the deployment.

## Workspace geofence
- Log in as an admin/manager who can open Settings → Workspace.
- Open Global Config.
- Enable Strict Geofencing if needed.
- Enter a full address and click **Find GPS**.
- Confirm latitude and longitude fill with six decimals.
- Confirm the vague **Failed to reach map service** toast no longer appears.
- Confirm the map still loads and clicking the map updates latitude/longitude.
- Save settings and reload the page.
- Confirm the saved geofence coordinates remain.

## Fallback behavior
- Temporarily test an invalid address.
- Confirm the app says the address was not found and tells you to add city/state, type coordinates, or click the map.
- Confirm existing latitude/longitude values are not wiped out.

## Regression checks
- Time Clock still opens.
- Strict geofence radius still displays in feet.
- No Firebase rules publish is required for this release.
