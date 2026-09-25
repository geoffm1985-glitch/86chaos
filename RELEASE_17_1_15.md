# 86 Chaos 17.1.15 - Authenticated App Shell Hook-Order Repair

## Root cause

The 17.1.13 reference redesign introduced `openVoiceFromShell` as a new React `useCallback` near the bottom of `App`. `App` already has legitimate conditional returns for label printing, cached-session hydration, and the signed-out login screen. Because the new hook sat below those returns, React could render fewer hooks while signed out/hydrating and more hooks immediately after authentication. That violates React's hook-order contract and can take down the app shell during the login/session transition even though the production build compiles successfully.

Vercel confirms the 17.1.14 deployment itself is `READY`, while the failing browser sessions immediately generated repeated successful `/api/report-bug` calls. The repair therefore targets the client runtime rather than Vercel build infrastructure.

## Repair

- Moves the shared `openVoiceFromShell` callback above every App-level conditional return, immediately after the existing `addToast` callback.
- Adds a source regression that rejects any App hook below the first conditional App return.
- Adds an authenticated Playwright regression that signs in and requires the real desktop/mobile shell to appear without React hook-order errors.
- Restores the visible 86Voice button in the shared `DrawerMenu` implementation actually imported by `App.js`; the 17.1.13 code had added the new Voice prop to a different unused DrawerMenu file.

## Preservation

No page, subpage, route, schedule workflow, inventory workflow, financial workflow, admin tool, permission boundary, data model, or approved visual-reference styling is removed. The 17.1.14 Vercel-safe reference-image repair remains unchanged.
