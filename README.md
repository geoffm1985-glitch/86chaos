# 86 Chaos 15.0.56

86 Chaos is a restaurant/kitchen management web app built with React, Firebase Auth/Firestore/Storage, Firebase Functions, and Vercel API routes.

Version **15.0.56** adds restaurant-group push broadcasting inside the System Administrator Push Control Center while preserving the 15.0.55 desktop density pass and the 15.0.54 tier / Founder Beta / feature gate system.

## What changed in 15.0.56

- Added a targeted push broadcast composer in **System Administrator → Push Control Center**.
- System Administrator can send a push notification to:
  - one selected workspace,
  - one selected restaurant group,
  - or all workspaces when truly needed.
- Restaurant-group sends preview matching workspace count, user count, and connected push-token count before sending.
- The push API now supports multi-workspace targets safely through `restaurantIds` while keeping existing single-workspace push behavior intact.
- Multi-workspace/group push sends require internal System Administrator/Master Admin access.
- Server-side send logic deduplicates device tokens, respects notification preferences and quiet hours unless marked critical, and records audit logs.
- Push results now include target mode, target group labels, target restaurant IDs, sent/failed counts, and stale token cleanup counts.
- Added a non-secret root `.env` for build stability: disables the CRA ESLint plugin during production build and disables sourcemap generation. This avoids build-time lint hangs without changing runtime behavior.

## Restaurant group targeting

The push composer groups workspaces using the best available group label from each workspace record:

- `restaurantGroupId` / `groupId`
- `restaurantGroupName`
- `groupName`
- `restaurantGroup`
- `systemSettings.restaurantGroupName`
- `branding.restaurantGroupName`
- owner email fallback

Keep customer group labels consistent on workspace records so group targeting stays clean.

## Deployment notes

- No Firebase environment variable rename is required.
- Testing can continue using the existing full JSON `FIREBASE_SERVICE_ACCOUNT_KEY` and `CRON_SECRET` setup.
- No live Stripe billing, POS OAuth, accounting OAuth, or customer integration provider setup is added.
- No Firebase rules change is required for this release.
- Deploy through the testing branch first, verify push behavior, then promote when satisfied.

## Required verification

Before production rollout, test:

1. Push test to one selected user.
2. Push broadcast to one selected workspace.
3. Push broadcast to a selected restaurant group.
4. Confirm group sends are blocked for non-System Administrator users.
5. Confirm stale token cleanup still flags dead tokens.
6. Confirm audit logs write for group and workspace push sends.
7. Confirm the app still builds and loads on desktop and mobile widths.

