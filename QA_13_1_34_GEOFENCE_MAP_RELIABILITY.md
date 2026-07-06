# QA Checklist: 13.1.34 Geofence Map Reliability

## Desktop
- Open Settings → Workspace → Global Config.
- Enable Strict Geofencing if needed.
- Confirm the map loads full-size instead of half gray/blank.
- Resize the browser window and confirm the map fills its panel again.
- Click the map and confirm latitude/longitude update.
- Click Refresh Map and confirm the map redraws without losing saved coordinates.

## Mobile
- Open the same screen on a phone.
- Confirm the map loads full-width and full-height inside the panel.
- Rotate or background/return to the browser and confirm the map repairs itself.
- Tap the map and confirm the pin/coordinates update.
- Use Refresh Map if tiles look gray or partial.

## Safety
- Confirm Find GPS still fills coordinates.
- Confirm existing coordinates are not wiped out by map tile problems.
- Confirm saving Global Config still saves address, latitude, longitude, radius, and geofence settings.
