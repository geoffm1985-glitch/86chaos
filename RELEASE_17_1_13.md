# 86 Chaos 17.1.13 - Approved Reference Full-App Visual Parity

## Scope

17.1.13 applies the approved 86 Chaos restaurant-management reference design to the live application shell and every routed page/subpage without deleting or replacing mature workflows.

### Desktop
- Rebuilds the fixed sidebar, command header, search, restaurant switcher, notification control, profile control, route hero, cards, forms, tables, tabs, and nested workspaces around the approved charcoal/copper reference language.
- Restores **Today** as the first primary destination to match the approved reference.
- Removes the duplicate top-right report/hamburger controls from the desktop command header. The only normal right-side controls are notifications and profile, plus the existing conditional offline-queue indicator when there is unsynced data.
- Uses the approved kitchen image treatment for all route identity headings so every top-level tab and subtab belongs to the same visual system.

### Mobile
- Rebuilds the mobile header, restaurant/status row, Manager Brief, metrics, priorities, shortcuts, and bottom command bar to match the approved reference geometry.
- Uses a five-slot bottom bar: Home, Time Clock, Kitchen, Staff, and More.
- Keeps **86Voice** fully available from More. The hardened physical-touch microphone regression target remains in the DOM invisibly so prior Android/PWA microphone behavior can continue to be certified.

### Feature preservation
- No business page, subpage, data workflow, permission, schedule tool, inventory workflow, financial workflow, administrative tool, message workflow, maintenance workflow, HR/training workflow, AI/kitchen tool, setting, help page, or Voice controller was removed.
- Existing Manager Brief advanced/operational panels remain below the new approved-reference surface.
- The standalone **Orders & Tickets** tab remains intentionally absent, consistent with the current product scope.

## Targeted certification additions
- `api/pixel-reference-full-app-17-1-13.test.cjs`
- `tests/86chaos-new-implementations/28-approved-reference-full-app-parity.spec.cjs`

The new contract checks the approved desktop/mobile shell, five-slot mobile navigation, retained 86Voice access, universal route framing, preserved Today workflows, preserved feature families, and the absence of duplicate desktop menus.
