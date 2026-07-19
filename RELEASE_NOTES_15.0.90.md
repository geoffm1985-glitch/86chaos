# 86 Chaos 15.0.90 Release Notes

## Performance Hotfix

This release focuses on slow app startup and slow Inventory loading.

### Fixed
- Split the main application tabs into lazy-loaded route chunks instead of loading every major feature file at first boot.
- Removed duplicate top-level Inventory and Menu Intelligence listeners while the Inventory tab is open.
- Stopped loading all recipe documents on every app startup just for background voice navigation.
- Made Inventory side data load on demand by sub-tab: invoices, burn logs, AI ordering events/prep context, and menu dependency data no longer all start at once.
- Reduced the first Inventory count load to a lighter snapshot, with a **Load full list** control and automatic expansion when searching or using below-par focus.
- Memoized expensive Inventory grouping, below-par calculations, vendor lookups, selected burn item calculations, and AI order assistant calculations.
- AI Order calculations now run only on the AI Order sub-tab.

### Still unchanged
- Firebase service-account-key handling was not touched.
- Security/rules fixes from 15.0.87 through 15.0.89 remain in place.

### QA focus
- Confirm first app load reaches Today faster on mobile.
- Open Inventory and confirm the Count tab appears without waiting for invoices, burn logs, AI order data, or event/prep snapshots.
- Tap **Load full list** and confirm more inventory rows appear.
- Search inventory and confirm the full inventory snapshot loads for broader searching.
- Open Order, AI Order, Vendors, Invoices, and Burn Log and confirm each sub-tab loads its own data when selected.
