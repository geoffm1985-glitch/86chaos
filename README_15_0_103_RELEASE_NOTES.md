# 86 Chaos 15.0.103 Release Notes

## Navigation Chrome Purge

This release removes the remaining webpage-like chip, pill, square, and badge-style backgrounds from the app navigation chrome.

### Changed

- Removed header pill background behind the version label.
- Removed square/rounded backgrounds behind header icon actions, including report problem and menu.
- Removed chip background behind the workspace switcher.
- Removed drawer role/workspace pill backgrounds.
- Removed drawer menu active row gradient/background shapes.
- Removed drawer footer button boxes for Report Problem and Log Out.
- Removed active/hover rounded blocks from desktop and mobile nav buttons.
- Kept real content panels, inputs, cards, and operational controls intact so the app stays usable.

### Preserved

- Existing React/Firebase/Vercel structure.
- Existing app routes and permissions.
- Push duplicate notification hotfixes.
- Desktop left rail and mobile bottom navigation separation.

## Testing

Run after deploy:

```powershell
cd C:\Users\geoff\Documents\GitHub\86chaos
npx.cmd playwright test tests/86chaos-deep-suite/06-mobile-layout.spec.js --project=chromium --headed --workers=1
```

Set:

```env
CHAOS_EXPECTED_VERSION=15.0.103
```
