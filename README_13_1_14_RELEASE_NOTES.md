# 86 Chaos 13.1.14

## Fixes

- Added schedule rescue display armor so hard-restored months only show protected restore-seed rows.
- Prevents old/merged schedule records from visually replacing the corrected schedule after an emergency reinject.
- Added restaurant-level rescue enforcement fields for restored months.
- Cleaned Help Center release note language so administrator-tab/internal-tool details are not shown there.

## Test

1. Deploy to staging.
2. Run the schedule reinject button again for Cheers July 2026.
3. Open Time Clock & Schedule and move to July 2026.
4. Confirm the imported PDF schedule remains visible after refresh.
5. Confirm Help Center release notes only show general stability wording for admin/internal fixes.
