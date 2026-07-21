# QA 15.1.7 Navigation Dedup + Mobile Header Fix

## Automated
- npm test
- node --check src/App.js
- node --check src/core/appCore.js
- node --check src/core/needsAttentionEngine.js
- node --check scripts/validate-15-1-7.js

## Manual QA checklist
- Desktop shows one full left-side menu only.
- No extra hamburger/menu button appears in the desktop header.
- Mobile header does not overlap or show duplicate menu controls.
- Mobile bottom nav still includes More for the full drawer menu.
- The weird `⌘ K` hint is gone from the search bar.
- Desktop 86Voice Command button remains visible in the top command bar.
- Sales Import is not duplicated in the top-level menu.
- Sales Import remains available inside Financials/Sales.
- Manager Brief / Needs Attention still loads.
- System Administrator remains permission-gated.
