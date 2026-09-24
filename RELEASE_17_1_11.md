# 86 Chaos 17.1.11

## 86Voice Mobile Physical Touch Activation Repair

17.1.11 repairs the mobile-only 86Voice toolbar event path while preserving the production 17.0.29 Web Speech lifecycle and the current Concept 1 redesign.

### Root cause repaired

- The mobile toolbar Voice control depended on the browser's synthesized `click` event.
- 86 Chaos also has a global mobile `touchend` double-tap guard, so the synthesized click can be cancelled on a real phone even though desktop clicks work normally.
- A cancelled/held touch could fall through to browser callout behavior instead of reaching 86Voice, producing the reported page-address/link-copy behavior.

### Repairs

- Activates the mobile Voice control on the real touch/pen `pointerdown` event before `touchend` cancellation can occur.
- Deduplicates the follow-up compatibility click so one physical tap opens only one voice session.
- Suppresses context-menu, drag, touch-callout, and selection behavior only on the mobile Voice control so the browser cannot reinterpret the mic gesture as a copy-address action.
- Routes the toolbar through `openAndListen`, the same controller entry point backed by the restored production 17.0.29 `SpeechRecognition` / `webkitSpeechRecognition` lifecycle.
- Keeps the hidden legacy floating mobile trigger out of the touch path and preserves the current six-button toolbar layout.

### Validation added

- Node regression for the physical mobile pointer path and browser-callout suppression.
- Mobile Playwright regression that uses a real touchscreen tap against the toolbar, verifies the 86Voice panel opens, and verifies exactly one production recognition session starts.

This remains an app-only build. A deployed physical-device pass is still the final environment confirmation after installing/deploying this source.
