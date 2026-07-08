# 86 Chaos 15.0.0 Release Notes

## Kitchen Intelligence, Reminders, and Schedule Clarity

- Preserved the 14.0.10 push, schedule-alert, production Firebase Messaging, and multi-workspace staff-recipient repairs.
- Added smart prep matching so typed and voice prep commands update confident existing prep rows instead of creating duplicates.
- Added Menu Intelligence for approved users: upload menu images/PDFs, scan with Gemini, review inventory matches, and save menu-to-inventory dependency links.
- Added zero-stock menu impact panels and menu-impact text on 86 alerts when inventory items affect active menu items.
- Added private My Reminders with typed or mic creation, Firestore owner-only rules, and scheduled push delivery through `/api/dispatch-reminders`.
- Added time-aware schedule dimming: My Schedule and Full Schedule now gray out shifts after their end time passes, and Full Schedule dims completed day sections.
- Added Firestore and Storage rules for personal reminders, menu scans, menu dependencies, menu upload files, and multi-workspace storage matching.
- Updated the System Administrator Manual, Help Center release note, README, QA checklist, package version, public version file, and release guardrail to 15.0.0.

## Important behavior

Publish both `firestore.rules` and `storage.rules` to every Firebase project that will run this build. Do not paste `firebase.json` into the Firebase console rules editors; paste the actual rule-file contents.

Menu scanning requires `GEMINI_API_KEY` or `GOOGLE_GENERATIVE_AI_API_KEY` in Vercel. Reminder delivery requires `CRON_SECRET` and a Vercel plan that supports the configured production cron schedule.
