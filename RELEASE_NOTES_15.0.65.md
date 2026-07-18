# 86 Chaos 15.0.65 Release Notes

## Voice reminders
- Voice reminder creation now runs only from final speech transcripts.
- Added per-session commit locking, `voiceSessionId`, `clientCommandId`, normalized titles, and 30-second duplicate checks.
- Duplicate voice reminder attempts are blocked and audit logged.
- “Just me” reminders remain private to the creator.

## Scheduling, request-off, and availability
- Full Schedule date jumping now uses the date picker path and can jump across months.
- Removed the extra schedule month header from the Time Off request area while keeping the calendar card header.
- Request-offs now support active workflow filters, date filters, soft archive/history, restore, and publish-time processing.
- Publishing a schedule archives approved/denied request-offs in that date range and flags pending overlaps.
- Added employee Availability under Time Clock & Schedule with employee submission, manager approval/denial/archive/restore, history, and Schedule Builder warnings.

## Reminders and notifications
- Added due/overdue red dots for reminders.
- Added reminder snooze options in 30-minute increments.
- Added central toast dedupe protection to prevent duplicate popups from one action.

## Events
- Event Calendar now supports one or more push reminders before an event.
- Added Order Reminder settings with cutoff weekdays, one-week lookahead, recipients, safe recalculation, and duplicate cancellation on edit/delete.
- `/api/dispatch-reminders` now also dispatches scheduled event and order reminders.

## Prep labels
- Prep label printing is now configured for a Brother QL-810W-oriented profile.
- Print CSS hides app shell, navigation, buttons, backgrounds, and shadows.
- Added helper text under the print action: “* Intended for use with Brother QL-810W label printer.”

## Navigation
- Reordered the main menu into the requested sections.
- Time Clock & Schedule is now the first clickable menu item.
- Empty sections stay hidden, permissions/plan rules remain enforced, and the mobile menu remains an overlay.
