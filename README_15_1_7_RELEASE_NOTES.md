# 86 Chaos 15.1.7 Release Notes

## Navigation Dedup + Mobile Header Fix

This release cleans up the navigation after the 15.1.x reference UI rebuild.

### Changed
- Removed the extra top hamburger/menu button from the app header.
- Kept desktop navigation as one full left-side sidebar.
- Kept the desktop 86Voice Command button in the top command bar.
- Removed the odd command shortcut hint (`⌘ K`) from the search field.
- Removed Sales Import as a duplicate top-level menu item; Sales Import remains inside Financials/Sales.
- Removed the floating voice dock trigger from the shell so mobile is not fighting extra buttons.
- Tightened the mobile header so workspace/search/voice/message/profile controls no longer pile on top of each other.
- Preserved Manager Brain / Needs Attention work, push fixes, QuickBooks review-first safety, and the 15.1.x dark/copper reference look.

### Notes
- Financials is the single top-level money menu destination. Sales Import lives inside that Financials workspace.
- 86Voice remains available from the top command button and AI Tools/Voice navigation, not as a second floating bubble.
