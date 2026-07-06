# 86 Chaos 13.1.31 Release Notes

## Mobile Zoom Lock

This release keeps 86 Chaos from zooming in on mobile devices during normal app use.

### Changes

- Updated the app viewport to disable mobile pinch zoom and double-tap zoom.
- Added a mobile no-zoom guard that runs when the app starts.
- Added mobile-safe input sizing to help prevent iPhone/Android field-focus zoom.
- Kept normal page scrolling intact.
- Updated the public Help Center release note for this mobile polish change.

### Deployment Notes

No Firebase rules, Storage rules, API route, or Vercel environment changes are required.
