# 86 Chaos 15.0.79 Release Notes

## Safe Component Split + Inventory Load Control

This release keeps the production-safe 15.0.76/15.0.78 login boundary intact and moves performance work behind authentication. The login screen, Firebase config bootstrap, auth provider, and workspace session cache are still eager-loaded so users are not locked out by a lazy route failure.

## What changed

- Split heavy authenticated tabs into lazy-loaded route chunks using `React.lazy` and `Suspense`.
- Moved `TabInventory` out of the shared Operations module into `src/features/inventory.jsx` so opening Today, Prep, Recipes, Maintenance, or Ops does not also drag the invoice scanner and AI ordering workspace into the same chunk.
- Stopped the app shell from opening a second inventory listener while the dedicated Inventory route is active.
- Stopped recipe collection reads from running on every app boot; recipes load when Recipes, Today, Ops, or Global Search needs them.
- Stopped menu-dependency shell reads on the Inventory route; Inventory loads its own menu graph only when below-par/menu impact focus or AI Order needs it.
- Inventory now opens light on the Count tab and loads heavier datasets only when their sub-tabs need them:
  - invoices only for Invoices or AI Order,
  - waste logs only for Burn Log or AI Order,
  - future events and prep-order context only for AI Order,
  - full menu graph only for AI Order or below-par focus,
  - full inventory snapshot only for heavier tabs, search, or below-par focus.
- Updated Vercel Node engine to `24.x` to remove the upcoming Node 20 deployment blocker.

## What did not change

- Firebase service-account-key handling was not changed.
- Login was not lazy-loaded.
- Firebase browser API key restrictions still must include the exact Vercel Preview URL used for testing. Code cannot bypass Google Cloud referrer restrictions.
- Dependency major upgrades were not forced in this pass.
