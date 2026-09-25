# 86 Chaos 17.1.16 - Navigation, Brand, and Mobile Voice Toolbar Repair

## Scope

17.1.16 keeps the full 17.1.15 application and approved reference redesign while correcting the navigation and presentation details identified in the live testing build.

## Repairs

- Ensures `experimental.86chaos.com` selects its dedicated PWA manifest before a generic manifest can be discovered, so a fresh install is named **86chaos experimental**.
- Removes the phone hamburger from the mobile header. The mobile **More** button remains the menu entry point.
- Restores **86Voice** to the first visible slot of the six-button mobile bottom toolbar: Voice, Home, Schedule, Kitchen, Staff, More.
- Removes the visible 86Voice entry from the More drawer so Voice exists in one primary mobile location.
- Prevents the legacy overlay drawer from becoming a second desktop menu.
- Rebuilds the redesigned desktop sidebar around the complete legacy menu universe, in the same category order:
  - People & Scheduling: Time Clock & Schedule, Staff Roster, HR & Training
  - Today: Manager Brief, Kitchen Command Center, My Reminders, Event Calendar, Message Board
  - Kitchen Operations: Prep & Tasks, Inventory & Orders, Recipe Book
  - Business & Financials: Financials, Back Office, Maintenance
  - Tools & Automation: Kitchen Tools, Menu Intelligence
  - System & Support: Settings, Help Center, System Audit, System Administrator
- Preserves Report Problem and Log Out in the redesigned desktop sidebar footer.
- Replaces the generated generic `86 CHAOS` wordmark in the redesigned shell with the supplied `/6139.png` 86 Chaos Kitchen Management OS logo artwork.
- Replaces the generic Kitchen TV brand text with the supplied logo artwork.
- Expands the desktop Message Board surface and forces category/composer buttons to stay on one readable line instead of stacking letters vertically.

## Preservation

No page, tab, subtab, schedule workflow, inventory workflow, recipe workflow, financial workflow, staff/HR workflow, maintenance workflow, AI tool, System Administrator tool, permission boundary, data model, 86Voice controller behavior, Vercel asset repair, or authenticated shell hook-order repair is removed.

## Targeted regression additions

- `api/navigation-brand-toolbar-17-1-16.test.cjs`
- `tests/86chaos-new-implementations/30-navigation-logo-toolbar-fit.spec.cjs`
