# 86 Chaos 15.0.11 Release Notes

## Kitchen Alerts & Simple Voice

This release fixes the kitchen 86 alert flow and makes voice navigation less picky.

## Changes

- 86 Voice now refreshes Inventory and Menu Intelligence context on demand when an 86 command runs.
- 86 Voice has stronger shorthand matching for kitchen language, including burger/hamburger/patty/ground beef/product-code style inventory names.
- 86 alert posts now include the requested phrase, the matched inventory item, and unavailable menu items when Menu Intelligence can identify them.
- Kitchen Command Center 86 posts now include Menu Intelligence menu impact.
- Kitchen Command Center now watches alert posts while open so the tab is not stale.
- Voice navigation recognizes more direct phrases and renamed tabs.
- Command center wording was simplified for faster half-awake kitchen use.
- Help Center and Administrator Manual were updated.

## Deploy notes

Deploy through GitHub/Vercel. No new Firestore rules, Storage rules, Vercel environment variables, or separate Firebase publishing are required for this build.
