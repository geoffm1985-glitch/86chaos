# 86 Chaos 17.0.26

## Phase 1 Spanish Interface

17.0.26 introduces the first native bilingual interface foundation for 86 Chaos. Each employee can choose English or Spanish in Settings > Preferences. The preference is stored on that employee's user profile, so changing language does not change the restaurant workspace or another employee's interface.

Phase 1 translates the highest-use surfaces: global navigation, Today / Manager Brief, Time Clock & Schedule, the primary Schedule Builder controls and Schedule Tools navigation, Request Off policy/workflow controls, Prep & Tasks primary controls, Settings preference/navigation labels, and common dialog/navigation copy. English remains the authoritative fallback when a Spanish key is unavailable.

Restaurant-entered operational data is intentionally not translated. Employee names, roles, notes, recipes, menu items, event titles, blackout reasons, and other restaurant-authored records continue to display exactly as entered.

The release gate now includes both a Node regression contract for translation completeness/per-user persistence and a deployed Playwright test that switches a release-gate account to Spanish, verifies core Spanish surfaces, and restores the original language afterward.

No POS Bridge, inventory, financial, schedule-publishing, shift-delete, Request Off authority, or unrelated application behavior was redesigned by this release.
