# 86 Chaos

Current version: 15.0.9

## 15.0.9 focus

15.0.9 adds schedule publishing controls and safer exact-row bulk user deletion.

- Workspace schedule publishing can now be set to weekly, every 2 weeks, monthly, or a custom 1–8 week window.
- Schedule Builder uses the workspace publishing style for the visible grid, projected labor, publish backup, and Publish Schedule action.
- Workspace settings can block regular employee time-off requests after a date has already been published.
- System Administrator → People bulk delete shows every matching user profile with created date/time, workspace, role, and profile ID before deletion.
- Duplicate-email cleanup now requires selecting the exact user profile rows before deleting.
- `/api/delete-users-bulk` accepts selected user profile IDs so it can delete only the intended rows.
- The internal Administrator Manual includes 15.0.9 setup, support, and QA guidance.
- No public Help Center release note was added for this build.

## Deployment notes

1. Deploy the app through GitHub/Vercel.
2. Confirm `/version.json` reports `15.0.9` after deploy.
3. Test Workspace → Schedule Publishing settings.
4. Test Schedule Builder in weekly, 2-week, monthly, and custom modes.
5. Test time-off blocking after schedule publish when the workspace toggle is off.
6. Test System Administrator → People bulk delete preview and exact-row selection.
7. Run the 15.0.9 QA checklist before handing it to staff.

## Separate publish/deploy requirements

- Firestore rules: no new changes from 15.0.8.
- Storage rules: no new changes from 15.0.8.
- Vercel/API routes: deploy updated app code because `/api/delete-users-bulk.js` changed.
- New Vercel environment variables: none.
