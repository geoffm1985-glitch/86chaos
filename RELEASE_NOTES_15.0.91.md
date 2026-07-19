# 86 Chaos 15.0.91 Release Notes

## Login Stability Hotfix

This release fixes the 15.0.90 performance build login regression.

### Fixed

- Restored the login/auth screen to an eager-loaded safe path so the app can render the sign-in screen before any lazy feature workspace tools load.
- Kept the inventory performance work behind the authenticated workspace shell.
- Synchronized app version markers to 15.0.91 so the update banner does not reappear from version drift.

### Unchanged

- Firebase service account key parsing and environment handling were not changed.
- Security and rules hardening from the audit repair remains in place.
- Inventory lazy loading and reduced first-load reads remain in place after login.

### Required QA

- Open a fresh incognito/mobile browser and verify the login screen appears.
- Log in as owner, manager, and staff test users.
- Open Inventory Count and verify first load, search, below-par focus, and Load full list.
- Verify the update banner clears after one refresh and stays cleared.
