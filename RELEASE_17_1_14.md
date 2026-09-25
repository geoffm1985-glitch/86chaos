# 86 Chaos 17.1.14 - Vercel Reference Asset Resolution Repair

## Scope

This is a surgical deployment repair on top of the complete 17.1.13 approved-reference redesign. No feature, page, tab, subtab, workflow, permission, 86Voice behavior, or visual layout was removed.

## Vercel failure found

The failed testing deployment stopped in the Create React App compile step with:

`Module not found: Error: Can't resolve '/concept17-kitchen-reference.jpg' in '/vercel/path0/src'`

The 17.1.13 CSS used a root-public `url('/concept17-kitchen-reference.jpg')`. Vercel's CRA/css-loader build interpreted that value as a module-resolution request instead of a runtime public URL.

## Repair

- Keeps `public/concept17-kitchen-reference.jpg` unchanged.
- Embeds those exact JPEG bytes once as a CSS data URI custom property.
- Reuses that same custom property for all three approved-reference image surfaces.
- Preserves the 17.1.13 pixel treatment because the image bytes are identical; only the delivery mechanism changed.
- Adds a regression that decodes the embedded data URI and verifies its SHA-256 against the approved public JPEG.

## Targeted verification

- `api/vercel-reference-asset-resolution-17-1-14.test.cjs`
- Full current targeted source/regression bundle, including 17.1.13 visual preservation and prior 86Voice/mobile repairs.
- `scripts/validate-17-1-14.js`

The full Play Store gate is intentionally not run for this surgical deployment repair unless explicitly requested.
