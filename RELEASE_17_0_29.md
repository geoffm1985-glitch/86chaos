# 86 Chaos 17.0.29

## Spanish Release-Gate Locator Fidelity Repair

The 17.0.28 failed+new gate reached all six current-release browser checks and passed five. The only failure occurred after the desktop browser had already switched to Spanish successfully. Playwright's accessibility snapshot showed the Preferences tab visibly rendered as `Preferencias`, while its accessibility name remained `Open Preferences`. The test used `getByRole(... name: /preferencias/)`, which searches the accessibility name rather than the visible label, so it could not match the correctly rendered button.

17.0.29 makes a surgical release-gate fidelity repair. The Spanish regression now locates the Settings tab by its visible translated text within the existing `.settings-tab-button` control. The test still requires `html[lang="es"]`, Spanish drawer labels, Spanish schedule controls, Spanish prep controls, and the Spanish Today/Manager Brief surface. Production localization, scheduling, deletion, publishing, Request Off, POS, inventory, financial, and permission behavior are unchanged.

A new Node contract prevents the test from regressing back to an accessibility-name/visible-text mismatch and confirms the full Spanish browser assertions remain present.
