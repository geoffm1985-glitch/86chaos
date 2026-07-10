# 86 Chaos 15.0.43 Release Notes

## Stable base
Built directly from `86chaos_15_0_42_gemini_manual_completion_guard.zip`. No 16.0.x source or redesign styling was used.

## Changes

### Safer Voice 86 alerts
- `86 [item]` and out-of-stock phrases create only 86 alert workflows and never inventory adjustments.
- Strict matching is required before confirmation is offered.
- Strong matches require an explicit confirmation.
- Ambiguous matches show up to five inventory candidates and require the user to choose one, then confirm again.
- Unknown matches cannot be sent.
- The inventory record is freshly reloaded and verified before Firestore and push writes.
- AI voice fallback cannot choose an item or silently send an 86 alert.
- Existing multi-item smart prep and quantity-merging behavior is preserved.

### OpenAI diagnostics explanations
- Added Super Admin-only `/api/openai-diagnostics-explain`.
- Uses `OPENAI_API_KEY` and `OPENAI_DIAGNOSTICS_MODEL`, defaulting to `gpt-5-mini`.
- Returns structured issue, severity, meaning, likely cause, repair steps, System Administrator click path, deploy/publish/env notes, verification, and escalation guidance.
- Redacts credentials, API keys, tokens, bearer headers, private keys, signed URLs, and personal contact fields before transmission.
- Added request size limits, rate limiting, App Check support, Super Admin authorization, no-storage API setting, and audit metadata without diagnostic contents.
- Missing or rejected OpenAI configuration produces a clear UI-safe error instead of crashing.

### System Administrator search
- Search covers authorized sections, tools, common actions, and Administrator Manual articles.
- Works in the same top area on desktop and mobile.
- Search is contained inside the Super Admin-only System Administrator component.

### Event Calendar heading
- Replaced the oversized current month/date heading with `Event Calendar`.
- Preserved the previous/next month arrows and date/month selector behavior.

### Preserved from 15.0.42
- Gemini Manual completion guard, finish reasons, automatic continuation, dangling-ending detection, and manual continuation button.
- Backup watchdog, diagnostics redaction, signed URL protection, corrected API route manifest, mobile System Administrator organization, and mandatory 86 Chaos branding.

## Deployment notes
- Vercel redeploy required.
- Add `OPENAI_API_KEY` to each environment that should use diagnostics explanations.
- Recommended: `OPENAI_DIAGNOSTICS_MODEL=gpt-5-mini`.
- No Firestore or Storage rules publishing required.

## Validation performed
- API syntax passed for all 42 API JavaScript files.
- React/JSX parse passed for all 33 source files.
- JSON configuration and health-route manifest checks passed.
- Strict 86 matching behavior tests passed for exact, menu-linked, ambiguous, broad, and unknown phrases.
- OpenAI route tests passed for missing-key handling, structured output parsing, and server-side secret/signed-URL/personal-data redaction.
- Full production build was not completed in the sandbox because dependency installation timed out and dependencies were not available. Run `npm install` and `npm run build` in CI/Vercel before production promotion.
