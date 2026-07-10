# QA Checklist - 86 Chaos 15.0.43

## Version and build
- [ ] `/version.json` reports `15.0.43`.
- [ ] App identifies itself as 15.0.43 in System Administrator/version surfaces.
- [ ] Production build completes.
- [ ] API syntax checks pass.
- [ ] React/JSX parse checks pass.
- [ ] ZIP integrity test passes.

## Voice 86 safety
- [ ] Say/type an exact inventory name with `86 [item]`; verify a confirmation appears and no alert is sent before confirmation.
- [ ] Confirm the exact match; verify one 86 alert appears in Manager Brief, Kitchen Command Center, and Message Board.
- [ ] Verify the alert stores the canonical inventory item and `inventoryNotModified: true`.
- [ ] Verify inventory quantity is unchanged.
- [ ] Test `we're out of [item]` with the same results.
- [ ] Test a strong Menu Intelligence alias; verify the matched inventory item is shown before confirmation.
- [ ] Test an ambiguous phrase; verify candidate choices appear and no alert is auto-sent.
- [ ] Choose a candidate; verify a second final confirmation is required.
- [ ] Test an unknown phrase; verify no confirm/send button is available and no event or push is created.
- [ ] Change/delete the matched item before final confirmation; verify the fresh recheck blocks the alert.
- [ ] Verify the optional AI parser never silently selects an inventory item.

## Smart prep regression
- [ ] Speak/type multiple prep items in one command.
- [ ] Verify every item is processed.
- [ ] Verify an existing matching prep task quantity is adjusted instead of duplicated.
- [ ] Verify unmatched prep items are created normally.

## OpenAI diagnostics
- [ ] Without `OPENAI_API_KEY`, click Explain with OpenAI and verify a clear configuration message appears without a crash.
- [ ] With a valid key, run Health Dashboard or Full System Diagnostics, then request an explanation.
- [ ] Verify structured fields show issue, severity, meaning, likely cause, repair steps, click path, deployment/env notes, verification, and escalation guidance.
- [ ] Verify `/api/openai-diagnostics-explain` rejects unauthenticated and non-Super Admin requests.
- [ ] Verify App Check enforcement works when enabled.
- [ ] Verify rate limiting returns a friendly response.
- [ ] Inspect Vercel logs/audit records and confirm raw diagnostic contents, keys, tokens, and signed URLs are not logged.
- [ ] Test a rejected/invalid OpenAI key and verify the UI-safe error.

## System Administrator search
- [ ] Search for `backup`, `OpenAI`, `MFA`, `user`, and `deployment` on desktop.
- [ ] Verify tool/action results open the correct section.
- [ ] Verify manual article results open Manual and select the correct article.
- [ ] Repeat on mobile; verify results are readable and tappable.
- [ ] Verify search does not appear outside Super Admin System Administrator access.

## Event Calendar
- [ ] Open Event Calendar and verify the large top title says `Event Calendar`.
- [ ] Verify the smaller calendar month display remains inside the calendar.
- [ ] Verify previous/next month arrows still work.
- [ ] Verify clicking the top title still opens the month selector.

## Gemini and 15.0.42 regressions
- [ ] Ask Gemini Manual a long troubleshooting question.
- [ ] Verify finish reason and continuation metadata remain available.
- [ ] Verify automatic continuation runs for cut-off answers.
- [ ] Verify Continue Gemini Answer appends rather than replaces.
- [ ] Verify Backup Watchdog remains available.
- [ ] Verify diagnostics exports omit signed backup URLs.
- [ ] Verify Health Checks does not falsely report all API files missing.
- [ ] Verify System Administrator remains mobile usable and organized.
- [ ] Verify 86 Chaos branding cannot be hidden or replaced.
