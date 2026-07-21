# 86 Chaos 15.0.99 Release Notes

## Native App Shell Polish

This release makes the app feel less like a webpage and more like a native-feeling PWA while preserving the existing React/Firebase/Vercel structure, routes, data model, permissions, and feature modules.

## What changed

- Added a persistent mobile bottom navigation bar for the primary day-to-day tools: Today, Schedule, Prep, 86, and More.
- Added a compact desktop shortcut rail so the desktop browser experience feels more like a management console instead of stacked webpages.
- Tightened the app chrome with a smaller status/footer treatment and a version pill in the header.
- Improved the lazy-route loading state with an app-style skeleton loader.
- Kept the existing drawer menu as the full tool menu, with the new bottom/rail navigation acting as shortcuts rather than a replacement.
- Updated PWA manifest metadata for a more app-like installed experience.
- Preserved the 15.0.98 duplicate push-notification protections.

## Safety notes

- No Firebase rules, storage rules, API auth, accounting posting behavior, QuickBooks routes, or System Administrator permissions were intentionally changed.
- QuickBooks remains review-first and guarded.
- System Admin/Python automation remains scan-and-alert only and cannot apply restaurant changes directly.

## Version

- App version: 15.0.99
- Public version file: 15.0.99
