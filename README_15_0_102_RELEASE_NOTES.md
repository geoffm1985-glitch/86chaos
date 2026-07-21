# 86 Chaos 15.0.102 Release Notes

## Desktop Shell Clipping + Header Chrome Cleanup

This patch fixes the desktop shell after the premium UI pass. It keeps the app-style sidebar and removes the remaining webpage-like header chrome that looked like boxed buttons or pills.

## Changed

- Fixed desktop content clipping caused by the left rail plus full-width main content.
- Added explicit desktop content width calculation so the main work area fits beside the sidebar.
- Added safer right padding so browser scrollbars do not crowd or cover the menu/action area.
- Removed the square/rounded button backgrounds behind the menu icon, report-bug icon, and queue/action header buttons.
- Removed the oval/pill background behind the version label.
- Removed the pill background behind the workspace switcher chip.
- Kept the icons/actions clickable, but visually cleaner and more app-like.
- Improved Inventory desktop containment so count rows and tabs do not disappear off the right side.

## Preserved

- Existing React/Firebase/Vercel structure.
- Existing routes, permissions, data flows, and API files.
- 15.0.98 push duplicate fixes.
- Desktop left rail only and mobile bottom nav only.
- Dark 86 Chaos brand style.

## Test env

```env
CHAOS_EXPECTED_VERSION=15.0.102
```
