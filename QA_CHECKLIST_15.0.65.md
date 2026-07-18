# QA Checklist: 86 Chaos 15.0.65

## Voice reminder duplicate bug
- Speak one reminder and confirm exactly one reminder is created.
- Confirm interim transcripts do not create reminders.
- Simulate or repeat a final transcript event and confirm no duplicate is created.
- Confirm duplicate attempts are audit logged.
- Speak an ambiguous reminder and confirm it asks for review instead of saving.
- Speak “just me” and confirm the reminder is private and only visible to the creator.

## Full Schedule date picker
- Open Time Clock & Schedule → Full Schedule.
- Select a date using the date picker.
- Confirm the schedule jumps/filters to that day.
- Select dates in a different month and confirm the month changes correctly.
- Confirm previous/next navigation still works.
- Confirm mobile layout does not overflow.

## Time Off cleanup and archive
- Open Time Clock & Schedule → Request Off and confirm the extra large top month header is gone.
- Confirm the calendar card still shows its month header and prev/next buttons.
- Submit a request-off and confirm one toast appears.
- Approve and deny request-offs.
- Publish a schedule and confirm approved/denied request-offs in range move to Published/Archived.
- Confirm pending request-offs remain visible and are flagged if overlapping a published schedule.
- Manually archive and restore a selected request-off as manager/owner.
- Confirm employees can see their own history only.
- Confirm unauthorized users cannot see other employees’ request-off details.
- Confirm Master Override Log still displays.

## Availability
- Submit normal weekly availability as an employee.
- Submit a temporary availability with start/end dates.
- Confirm pending availability does not affect Schedule Builder when approval is required.
- Approve/deny/archive/restore availability as manager/owner.
- Confirm approved availability appears in Schedule Builder warnings.
- Schedule someone outside availability and confirm an override reason is required and logged.
- Confirm availability conflict warnings are separate from request-off conflicts.
- Confirm role filters still use Preferences / Roster Roles.
- Confirm unauthorized users cannot view or edit other employees’ availability.

## Prep label printing
- Select prep items and open print preview.
- Confirm the full app shell/nav/buttons do not print.
- Confirm labels are readable and formatted for Brother QL-810W-style labels.
- Confirm helper text appears under the print action.
- Confirm existing prep create/edit/history workflows still work.

## Reminders and snooze
- Create a due reminder and confirm a red dot appears.
- Confirm overdue reminders show a red dot.
- Confirm completed reminders do not show a red dot.
- Snooze by 30 minutes and confirm the next reminder time updates.
- Confirm snoozed reminder reappears after the snoozed time.
- Confirm private reminder snooze does not expose it to other users.

## Toast dedupe
- Create a reminder and confirm only one popup appears.
- Submit a time-off request and confirm only one popup appears.
- Submit/approve/deny availability and confirm one popup per action.
- Create/edit/delete prep labels and confirm one popup per action.
- Create/edit/delete an event and confirm one popup per action.
- Confirm real errors still show clearly.

## Event reminders
- Create an event with one push reminder.
- Create an event with multiple push reminders.
- Edit and remove reminders from an existing event.
- Enable Order Reminder with multiple cutoff days.
- Confirm order reminders are scheduled only on selected cutoff days starting one week before the event.
- Change the event date and confirm future reminders are recalculated.
- Delete the event and confirm future event/order reminders are cancelled.
- Confirm duplicate event reminders are not sent.

## Main menu
- Open the menu and confirm Time Clock & Schedule is the first clickable item.
- Confirm Today/Manager Brief is not above Time Clock & Schedule.
- Confirm section order: People & Scheduling, Today, Kitchen Operations, Business & Financials, Tools & Automation, System & Support.
- Confirm no menu item appears twice.
- Confirm hidden/restricted items do not show to unauthorized users.
- Confirm empty section headers do not show.
- Confirm mobile menu overlays the app and does not push the page down.
- Confirm System Administrator and System Audit remain permission protected.
