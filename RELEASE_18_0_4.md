# 86 Chaos 18.0.4 — Native System Bar and Launcher Branding Repair

18.0.4 repairs two real-device findings from the first Android preview.

## System bars

Android 15/16 can render an edge-to-edge WebView beneath status, navigation, and display-cutout areas. MainActivity now applies WindowInsetsCompat system-bar and display-cutout insets directly to the Capacitor WebView. The app remains edge-to-edge aware without allowing restaurant controls to sit under Android system UI.

The shared native runtime also marks Android/iOS explicitly. iPhone/iPad receives a CSS safe-area fallback using env(safe-area-inset-*), preserving the cross-platform mobile rule.

## Launcher branding

The Android manifest no longer points to Capacitor's generated launcher resources. It points to a native drawable that is byte-identical to the existing 86 Chaos v4 safe-canvas icon.

Apple distribution still requires a proper 1024x1024 branded AppIcon before any TestFlight/App Store build. That requirement is explicit in the mobile contract and may not be waived.

## Testing

Only the targeted mobile workflow is authorized for this build. No full Release Gate or full Play Store suite is run.
