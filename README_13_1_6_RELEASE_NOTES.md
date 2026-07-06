# 86 Chaos 13.1.6 - Voice Navigation + Help Search

This build keeps the existing component structure from 13.1.5 and focuses on 86 Voice navigation polish.

## Changed

- Added permission-aware voice navigation for common "show me" commands.
- Voice can now open:
  - Full Schedule
  - Month View
  - My Schedule
  - Trade Board
  - Time Off
  - Schedule Builder, only for users with schedule access
  - Staff Roster, only for users with team access
  - Inventory, Prep, Recipes, Messages, Maintenance, Financials, Settings, System Administrator where permitted
- Schedule-related voice commands now route to the proper Time Clock & Schedule subview instead of dumping everything into Schedule Builder.
- Added microphone Help Center search:
  - "search help center for missed punch"
  - "help me with geofence"
  - "how do I add employees"
- Help Center opens with the voice search phrase filled in.
- Voice navigation checks permissions and enabled modules before opening a screen.
- Version updated to 13.1.6.

## Important behavior

Voice cannot bypass hidden tabs. If a user does not have permission, they get an Access Blocked toast and the tab does not open.

## Files touched

- src/components/common.jsx
- src/App.js
- src/features/schedule.jsx
- src/features/management.jsx
- src/core/appCore.js
- public/version.json
