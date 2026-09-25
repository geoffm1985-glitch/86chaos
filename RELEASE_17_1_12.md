# 86 Chaos 17.1.12

## Android PWA 86Voice Visible Panel Repair

17.1.12 repairs the mobile case shown on the physical Android device where tapping 86Voice successfully starts microphone capture but the 86Voice controller itself never becomes visible.

### Evidence from the physical-device failure

- Android/Chrome reports that the site is actively using the microphone, proving the toolbar tap reaches the Voice controller and microphone startup.
- The missing piece is the visible 86Voice controller surface after that startup.
- In 17.1.11 the mobile panel still lived as a fixed descendant of a legacy dock that mobile CSS intentionally collapses and disables for pointer interaction. Desktop does not use that mobile geometry, which explains why the same controller works correctly there.
- The installed-web-app notification that offers to copy the app URL is Chrome UI and is not used as the 86Voice interaction surface.

### Repair

- Keeps the 17.1.11 physical touch activation and browser callout suppression on the bottom-toolbar microphone.
- Keeps the restored production 17.0.29 `SpeechRecognition` / `webkitSpeechRecognition` lifecycle.
- On mobile only, renders the 86Voice controller panel through a React portal into the already-mounted Concept 1 shell instead of leaving it inside the collapsed legacy dock.
- Gives that panel its own fixed mobile geometry above the six-button bottom toolbar and an explicit high stacking layer.
- Synchronously commits the mobile panel-open state before the delayed Web Speech start, so the visible controller is mounted before Android begins microphone capture.
- Leaves the working desktop Voice dock path unchanged.

### Validation added

- Node regression verifies the portal, fixed mobile surface, synchronous panel reveal, retained production Web Speech controller, and retained physical-touch path.
- Mobile Playwright regression uses a real touchscreen tap, verifies the panel is visible, verifies it is no longer a descendant of the legacy dock, validates its viewport geometry/z-index, and verifies exactly one recognition session starts.

This is an app-only build. The full Play Store gate is not run for this targeted mobile repair unless explicitly requested.
