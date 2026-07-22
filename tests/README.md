# 86 Chaos Playwright Safety Suite, rebuilt for 15.1.10

These tests are safe by default. They check routing, permissions, protected admin surfaces, mobile layout, exports, inventory/scanner surfaces, reminders/push endpoint protection, and slow pages.

## Setup

1. Copy `.env.playwright.example` to `.env.playwright`.
2. Fill in at least `CHAOS_BASE_URL`, `OWNER_EMAIL`, and `OWNER_PASSWORD`.
3. Add `STAFF_EMAIL` / `STAFF_PASSWORD` and `SYSTEM_ADMIN_EMAIL` / `SYSTEM_ADMIN_PASSWORD` for the deeper permission/admin tests.
4. Leave `CHAOS_ALLOW_MUTATION=0` unless you are on a disposable testing workspace.

## One command

```bash
npm install; if ($LASTEXITCODE -eq 0) { npx playwright install chromium }; if ($LASTEXITCODE -eq 0) { npm run test:e2e:all }
```

## Reports

- HTML report: `playwright-report/index.html`
- JSON report: `test-results/chaos-playwright-results.json`
- Failure screenshots/traces/videos: `test-results/playwright-artifacts/`
