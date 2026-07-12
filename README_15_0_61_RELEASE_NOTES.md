# 86 Chaos 15.0.61 Release Notes — 86Voice Intelligent Commands

## Summary

15.0.61 is a preserve-and-harden pass for 86Voice. It keeps the existing app structure and improves the current voice implementation in place so spoken commands can decipher intent, match existing records, ask for review when needed, and obey the same plan, role, workspace, and safety rules as the normal UI.

## Added / hardened

- Added centralized fuzzy voice matching in `src/core/voiceIntelligence.js`.
- Hardened prep voice commands so natural phrases search existing prep rows first and update high-confidence matches instead of duplicating.
- Hardened prep mark-done commands with fuzzy matching, completion metadata, audit logging, ambiguity review, and safe undo.
- Added task upsert voice commands for daily, weekly, and monthly tasks so existing matching tasks are updated before new ones are created.
- Hardened task mark-done commands with fuzzy matching, correct period completion keys, audit logging, ambiguity review, and safe undo.
- Expanded 86 alert voice handling for phrases such as “we're out of,” “no more,” and “kill item for tonight.”
- Added basic text-only 86 alert support when no safe inventory match exists, with confirmation and setup guidance. Inventory quantity is not changed.
- Added menu impact questions such as “What does chicken breast affect?” using approved Menu Intelligence dependencies where allowed.
- Added shift/work status questions such as “What needs done?” and out-of-stock questions such as “What are we out of?” with permission-aware summaries.
- Added shared reminder voice commands using the real workspace staff list, permission checks, ambiguity review, and audit logging.
- Added recurring voice reminder creation and updated reminder dispatch so recurring reminders advance after successful delivery.
- Added safe undo for recent voice-created or voice-updated prep, tasks, and reminders where rollback is possible.
- Improved the voice panel so it shows heard text, detected intent, matched item/task, confidence, blocked status, result details, candidate pickers, and undo availability.
- Updated Help Center, Complete App Training Manual, and Administrator Manual for the new 86Voice behavior.
- Updated the optional voice AI parser guardrail so it can suggest safe navigation/help but cannot execute high-risk or data-changing actions.

## Preserved

- Existing prep creation, smart prep quantity updates, recurring tasks, 86 alerts, recipe search, navigation, reminders, burn log, maintenance, message posts, plan gates, role permissions, Founder Beta system, integrations lock, and System Administrator tools were preserved.
- Voice still cannot bypass tab visibility, plan locks, Firestore rules, role permissions, demo-mode read-only rules, or workspace isolation.

## Not implemented intentionally

- Voice does not auto-approve invoice scans, menu scans, payroll readiness, Daily Close signoff, financial reports, plan/billing changes, Firebase/security settings, or integrations.
- Voice does not directly edit inventory quantity when someone says “86 item” or “we're out of item.” 86 alerts and inventory edits remain separate workflows.

## Deployment

No Firebase rules changes are required.
No new Vercel environment variables are required.
Keep the existing working server env vars: `FIREBASE_SERVICE_ACCOUNT_KEY` and `CRON_SECRET`.
