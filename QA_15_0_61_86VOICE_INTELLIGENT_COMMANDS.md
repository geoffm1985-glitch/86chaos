# QA Checklist — 86 Chaos 15.0.61 86Voice Intelligent Commands

## Prep commands

- [ ] Say/type “Prep 2 pans onions” with an existing onion prep row. Confirm the existing row updates instead of duplicating.
- [ ] Say/type “Add two containers ranch” with no ranch prep row. Confirm a new prep row is created.
- [ ] Say/type multiple prep items if supported by Smart Prep. Confirm each item is parsed and saved correctly.
- [ ] Say/type “Mark tomatoes done” with one matching prep row. Confirm it is completed and audit logged.
- [ ] Say/type “Finish onions” when two onion-like rows exist. Confirm the review picker appears and nothing is marked done until a row is selected.
- [ ] Say/type “Undo that” after a safe prep update/completion. Confirm the previous prep values/completion state are restored where possible.

## Task commands

- [ ] Say/type “Add clean wall behind fryers to tasks.” Confirm a daily task is created or a high-confidence existing task updates.
- [ ] Say/type “Add dump hood oil pan to tonight.” Confirm task parsing chooses the task workflow and avoids duplicates.
- [ ] Say/type “Add deep clean ovens monthly.” Confirm a monthly task is created/updated.
- [ ] Say/type “Put check nacho cheese machine on daily tasks.” Confirm task name/category/frequency are correct.
- [ ] Say/type “Mark fryer wall done.” Confirm the matching task completes for the correct daily/weekly/monthly period.
- [ ] Say/type an ambiguous task phrase. Confirm candidate picker appears.
- [ ] Test task creation as a staff user without task/share permissions. Confirm it is blocked.

## 86 alerts and menu impact

- [ ] Say/type “86 chicken breast.” Confirm this creates an 86 alert flow, not an inventory edit.
- [ ] Say/type “We’re out of ribeye.” Confirm this creates an 86 alert flow, not an inventory edit.
- [ ] Say/type “No more brioche buns.” Confirm the basic 86 alert path works when no exact inventory match exists.
- [ ] Confirm strong 86 matches require final confirmation before posting.
- [ ] Confirm 86 alert posts appear in Manager Brief, Kitchen Command Center, Message Board, and push flow where allowed.
- [ ] With approved Menu Intelligence dependencies, confirm affected menu items show on the 86 preview/result.
- [ ] Without approved dependencies, confirm the setup message says menu impact needs approved ingredient links first.
- [ ] Ask “What does chicken breast affect?” as a Smart Kitchen/allowed user. Confirm approved dependency impact is shown.
- [ ] Ask “What does chicken breast affect?” as a locked-plan or unpermitted user. Confirm access is blocked without leaking restricted menu dependency data.

## Reminders

- [ ] Say/type “Remind me tomorrow at 10 to call Performance.” Confirm a private reminder is created.
- [ ] Say/type “Remind me Friday to order fryer oil.” Confirm date/time handling is correct or the reminder screen opens for missing details.
- [ ] Say/type “Remind Sarah to check hood filters Wednesday.” Confirm teammate matching uses real workspace staff and requires confirmation.
- [ ] Test ambiguous teammate names. Confirm the picker appears.
- [ ] Test shared reminder as a staff user without permission. Confirm it is blocked.
- [ ] Say/type “Create weekly reminder to clean oven vents.” Confirm recurrence is saved and the dispatcher advances after a successful push.
- [ ] Say/type “Undo that” after creating a safe reminder. Confirm the reminder is removed where possible.

## Navigation, search, and status questions

- [ ] Say/type “Open prep.” Confirm the Prep & Tasks screen opens only if allowed.
- [ ] Say/type “Open daily close.” Confirm Financials opens only for users/plans that allow it.
- [ ] Say/type “Open schedule.” Confirm Time Clock & Schedule opens only if allowed.
- [ ] Say/type “Show beer cheese recipe.” Confirm Recipe Book opens/searches the recipe.
- [ ] Say/type “Search help for invoice scanning.” Confirm Help Center search is populated.
- [ ] Say/type “What needs done?” Confirm open prep, open tasks, active 86 alerts, low stock, and maintenance are summarized only where the user has access.
- [ ] Say/type “What are we out of?” Confirm active 86 alerts show and low-stock data appears only for users who can view Inventory.

## Safety, permissions, plan gates, and audit

- [ ] Confirm voice actions obey the same plan gates as clicking/tapping.
- [ ] Confirm voice actions obey the same role permissions as clicking/tapping.
- [ ] Confirm staff cannot access financial, wage, admin, owner-only, Security Center, Backup Center, Plan/Billing, or integrations data through voice.
- [ ] Confirm customer users cannot access integrations through voice.
- [ ] Confirm Demo Mode blocks writes.
- [ ] Confirm invoice scan approval, menu scan approval, payroll readiness, Daily Close signoff, financial reports, plan/billing changes, admin/security actions, and integrations cannot be voice-auto-approved.
- [ ] Confirm blocked permission attempts are audit logged.
- [ ] Confirm created prep, updated prep, prep done, created task, updated task, task done, 86 alert, reminder, shared reminder, undo, low-confidence review, and parse errors are audit logged where meaningful.

## UI

- [ ] On mobile, confirm the 86Voice panel is touch-friendly and readable.
- [ ] On desktop, confirm the voice panel is compact, professional, and not oversized.
- [ ] Confirm the panel shows heard text, intent, matched item/task, confidence, confirmation needed, blocked status, result text, candidate picker, and undo option when available.
