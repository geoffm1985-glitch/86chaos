# 86 Chaos 17.0.31

## Cross-Platform Source Manifest Parity Repair

17.0.31 preserves the complete 17.0.30 unified feature set and repairs certification source identity parity across Linux/Vercel and Windows release-gate runners.

- Adds explicit LF normalization for TypeScript and TSX source files.
- Adds explicit Git EOL rules for .ts and .tsx files.
- Regenerates the bundled release source manifest only after the final source is assembled.
- Adds unit and Play Store release-gate coverage that fails if cross-platform source hashing diverges again.
- Makes no intentional restaurant workflow or UI feature removals.
