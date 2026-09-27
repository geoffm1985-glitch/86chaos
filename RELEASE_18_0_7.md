# 86 Chaos 18.0.7 — Real-Device Native Viewport Containment Repair

18.0.7 replaces the Android WebView-padding approach with native activity-content containment after real-device screenshots showed fixed UI still rendering beneath Android status and navigation bars.

The activity now applies system-bar and display-cutout insets to android.R.id.content. The WebView itself has zero inset padding and lives inside that already-constrained native rectangle. This is intended to protect fixed notification banners, headers, microphones, and bottom controls consistently on Android 15/16 edge-to-edge devices.

The existing 86 Chaos launcher icon and iPhone/iPad safe-area fallback are preserved.

Only targeted mobile tests are authorized. No full Release Gate or full Play Store suite is run.
