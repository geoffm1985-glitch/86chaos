# 86 Chaos 15.0.56 Release Notes

## Restaurant Group Push Broadcasts

15.0.56 adds a targeted push broadcast composer inside **System Administrator → Push Control Center**.

### Added

- Push notifications can now be sent to:
  - one workspace,
  - one selected restaurant group,
  - or all workspaces when necessary.
- The composer previews matching workspace count, user count, and connected push-token count before sending.
- Restaurant group options are built from workspace group fields such as `restaurantGroupName`, `groupName`, `restaurantGroupId`, branding/system settings group labels, or owner email fallback.
- Group push sends use the server `/api/send-push` route with `restaurantIds` support.
- Multi-workspace/group sends are restricted to internal System Administrator/Master Admin access.
- Push sends deduplicate tokens across workspaces.
- Push sends continue respecting notification preferences and quiet hours unless marked critical.
- Push sends now write audit logs for workspace and group broadcasts.
- Last push result now records target mode, target group label/key, and target restaurant IDs.

### Preserved

- Existing single-user push tests still work.
- Existing single-workspace push behavior remains compatible.
- Existing Firebase service account env behavior remains unchanged: `FIREBASE_SERVICE_ACCOUNT_KEY` full JSON plus `CRON_SECRET` is still supported.
- No customer-facing integration tools were unlocked.
- No Firebase rules changes are required for this release.

### Build note

A non-secret root `.env` was added with:

```text
DISABLE_ESLINT_PLUGIN=true
GENERATE_SOURCEMAP=false
```

This keeps production builds stable for the current large CRA app without changing runtime behavior.
