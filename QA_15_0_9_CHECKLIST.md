# QA Checklist - 86 Chaos 15.0.9

## Deploy / Version

- [ ] Deploy through GitHub/Vercel.
- [ ] Confirm `/version.json` reports `15.0.9`.
- [ ] Confirm the footer/version display reports `15.0.9`.

## Workspace Schedule Publishing Settings

- [ ] Open Settings → Workspace → Schedule Publishing.
- [ ] Save `1 week at a time` and refresh; confirm it persists.
- [ ] Save `2 weeks at a time` and refresh; confirm it persists.
- [ ] Save `Full month at a time` and refresh; confirm it persists.
- [ ] Save `Custom number of weeks`, choose 3–8 weeks, and refresh; confirm it persists.
- [ ] Change the schedule week-start day and confirm weekly/2-week/custom windows follow it.

## Schedule Builder

- [ ] Weekly mode shows a 7-day schedule window.
- [ ] 2-week mode shows a 14-day schedule window.
- [ ] Monthly mode shows the full calendar month.
- [ ] Custom mode shows the selected number of weeks.
- [ ] Projected labor totals match the visible publishing window.
- [ ] Publish Schedule backs up and publishes only the active publishing window.
- [ ] Duplicate-shift prevention still blocks assigning the same employee twice on the same date.

## Time-Off After Publish

- [ ] Turn off `Allow Time-Off Requests After Publishing`.
- [ ] Publish at least one shift on a future date.
- [ ] Log in as a regular employee and confirm they cannot request time off for that published date.
- [ ] Confirm the employee can still request time off for an unpublished future date.
- [ ] Log in as manager/admin and confirm manual schedule/request control still works.

## System Administrator Bulk User Delete

- [ ] Open System Administrator → People.
- [ ] Paste an email that matches one profile and confirm created date/time appears.
- [ ] Paste an email that matches multiple profiles and confirm every profile row appears with created date/time, workspace, role, and profile ID.
- [ ] Confirm duplicate-email deletion requires selecting exact row(s) first.
- [ ] Confirm current admin/master admin protected rows cannot be selected/deleted.
- [ ] Delete one selected test profile and confirm other duplicate rows remain.
- [ ] Confirm audit logs show selected profile ID(s).

## Administrator Manual

- [ ] Open System Administrator → Administrator Manual.
- [ ] Search `15.0.9`.
- [ ] Confirm schedule publishing, post-publish time-off blocking, and exact-row bulk user delete guidance appears.
- [ ] Confirm no 15.0.9 release note was added to the public Help Center.

## Regression Smoke Test

- [ ] Invoice scanner still auto-compresses large photos.
- [ ] Menu scanner still auto-compresses large photos.
- [ ] Voice prep matching still updates existing prep rows instead of creating duplicates.
- [ ] Manual presence snapshot still works only for Super Admin.
