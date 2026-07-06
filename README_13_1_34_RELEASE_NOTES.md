# 86 Chaos 13.1.34 Release Notes

## Geofence Map Loading Reliability
- Improved the pin-drop geofence map in Settings → Workspace → Global Config for both desktop and mobile.
- Added a map stabilizer that forces Leaflet to recalculate its size after the settings panel renders, after browser resize events, and after returning to the tab.
- Added a Refresh Map button for gray, partial, or stuck tile loads.
- Added automatic tile-provider rotation if a provider fails to return tiles.
- Added Leaflet CSS guards so map tiles do not inherit app image sizing rules.

## Administrator Manual / Help Center
- Updated the Administrator Manual geofence troubleshooting article.
- Added the current public Help Center release note for 13.1.34.

## Deployment Notes
- No Firebase rules changes.
- No Storage rules changes.
- No Vercel environment variable changes.
- No new API routes.
