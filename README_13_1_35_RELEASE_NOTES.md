# 86 Chaos 13.1.35 Release Notes

## Voice Recipe Opening

- 86 Voice can now open a specific Recipe Book item by spoken recipe name.
- Commands like “open beer cheese recipe”, “show me chicken marsala recipe”, “pull up ranch recipe”, or “what is the recipe for chili” now open Recipe Book and target the best matching recipe.
- The recipe matching uses the live Recipe Book data, so recipes added in the future work without adding new hardcoded voice commands.
- If an exact match is not found yet, Recipe Book opens with the useful search phrase filled in instead of saving command words into a field.
- Voice recipe navigation still follows the normal Recipes module permission check.

## Files Changed

- `src/components/common.jsx`
- `src/App.js`
- `src/features/operations.jsx`
- `src/features/management.jsx`
- `src/core/appCore.js`
- `public/version.json`

## Deploy Notes

No Firebase rules, Storage rules, Vercel config, API route, or environment variable changes are required.
