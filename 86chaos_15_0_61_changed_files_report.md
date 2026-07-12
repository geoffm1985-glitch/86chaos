# 86 Chaos 15.0.61 Changed Files Report

## Source code

- `src/core/voiceIntelligence.js` — New centralized fuzzy matching utility for 86Voice phrases, synonyms, plural handling, token/partial scoring, typo tolerance, confidence scores, and alternatives.
- `src/components/common.jsx` — Hardened `VoiceCommandDock` parsing/execution/UI for prep/task upsert, mark-done, 86 alerts, menu impact questions, reminders/shared reminders, status questions, undo, permission/plan checks, audit logging, and candidate review.
- `src/App.js` — Passed current events and maintenance logs into 86Voice so status questions can summarize permitted open work.
- `src/core/appCore.js` — Version marker updated to `15.0.61`.
- `api/dispatch-reminders.js` — Added recurring reminder advancement after successful reminder push delivery.
- `api/voice-command.js` — Hardened optional AI parser prompt and intent list; AI remains a safe fallback and cannot approve or execute risky/data-changing work.

## Documentation and manual content

- `src/features/management.jsx` — Added customer Help Center article for 86Voice intelligent commands and System Administrator manual article for 15.0.61 voice safety, permissions, audits, and support behavior.
- `src/features/trainingManual.js` — Expanded the complete app training manual with intelligent voice examples, mark-done/upsert guidance, menu impact questions, reminders, recurring reminders, undo, and safety limits.
- `README.md` — Updated to 15.0.61.
- `README_15_0_61_RELEASE_NOTES.md` — Current release notes only.
- `QA_15_0_61_86VOICE_INTELLIGENT_COMMANDS.md` — Current QA checklist.
- `86chaos_15_0_61_86voice_supported_commands.md` — Supported voice command summary.
- `86chaos_15_0_61_86voice_confirmation_blocked_commands.md` — Confirmation-required and intentionally blocked voice command summary.

## Version/config

- `package.json` — Version updated to `15.0.61`.
- `functions/package.json` — Version updated to `15.0.61`.
- `functions/package-lock.json` — Functions lockfile version metadata updated to `15.0.61` only.
- `public/version.json` — Public version marker updated to `15.0.61`.

## Removed from clean root package

- Old 15.0.60 release notes, QA checklist, changed-files report, deployment notes, and build-verification report were removed from the source root so the ZIP contains current-version release artifacts only.
