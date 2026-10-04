# 86 Chaos 17.0.67 - Release-Gate Runtime Isolation Repair

This testing build repairs the concrete failure clusters captured in the latest Yardmaster failed+new handoff. It does not push production.

The first runtime error came from the Yardmaster local readiness server: its test-only Content-Security-Policy blocked Firebase Auth's Google bootstrap script and authentication iframe even though the production Vercel CSP already permits those resources. 17.0.67 aligns only the local browser bootstrap directives with the production requirement while deliberately keeping `connect-src` restricted to localhost/127.0.0.1 so the emulator safety boundary is not weakened.

The Spanish-interface regression also left the shared QA Owner account in Spanish when its cleanup control remounted during hydration. Later English-label tests then reported dozens of missing states even though the controls were visibly present in Spanish. Cleanup now fails closed, restores English, reloads, and proves that the saved account preference survives a fresh authenticated page load.

The handoff additionally exposed three real keyboard-accessibility defects in System Administrator scroll regions. Those regions now have labeled, focusable region semantics. A single tablet route-reset failure caused by a destroyed navigation execution context receives one bounded retry only for that exact transient.

Finally, the two mobile sticky-header failures were assertion-geometry defects after the 17.0.64 nested-scroll design change. The tests now compare sticky position to the nested scrollport plus the computed sticky offset and account for finite scroll range. Product Schedule Builder behavior is unchanged.

Coverage added or updated:

- Targeted Node/release-gate regression for the local CSP safety boundary, language-state cleanup, sticky geometry, route-reset retry, and System Administrator accessibility nodes.
- Mandatory Play Store/release-gate Playwright regression `79-runtime-isolation-csp-sticky-a11y-17-0-67.spec.cjs`.
- Independent Playwright regression `tests/e2e/runtime-isolation-csp-sticky-a11y.spec.cjs`.
- Existing Spanish, sticky-header, exhaustive-state, and accessibility browser tests now exercise the repaired boundaries directly.

No production deployment is included.
