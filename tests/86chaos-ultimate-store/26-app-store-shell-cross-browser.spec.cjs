const { test, expect } = require('@playwright/test');
const {
  BASE_URL,
  FATAL_TEXT_RE,
  BAD_VALUE_RE,
  bodyText,
  viewportAudit,
  watchForProblems,
  attachJson,
} = require('../86chaos-full-audit/utils/audit-helpers.cjs');

test.describe('26 App-store shell and cross-browser foundations', () => {
  test('public shell, manifest, icons, viewport, and version metadata are installable and safe', async ({ page, request }, testInfo) => {
    const problems = [];
    watchForProblems(page, problems, { recordNonfatal4xx: true });
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

    const text = await bodyText(page, 20_000);
    expect(text.trim().length, 'The app shell must not be blank').toBeGreaterThan(20);
    expect(text).not.toMatch(FATAL_TEXT_RE);
    expect(text).not.toMatch(BAD_VALUE_RE);

    const head = await page.evaluate(() => ({
      title: document.title,
      manifest: document.querySelector('link[rel="manifest"]')?.getAttribute('href') || '',
      viewport: document.querySelector('meta[name="viewport"]')?.getAttribute('content') || '',
      themeColor: document.querySelector('meta[name="theme-color"]')?.getAttribute('content') || '',
      appleTouchIcon: document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href') || '',
      htmlLang: document.documentElement.lang || '',
    }));
    expect(head.title).toMatch(/86\s*Chaos/i);
    expect(head.manifest).toBeTruthy();
    expect(head.viewport).toMatch(/width=device-width/i);
    expect(head.appleTouchIcon, 'iOS installability should expose an apple-touch-icon').toBeTruthy();

    const manifestUrl = new URL(head.manifest, BASE_URL).toString();
    const manifestResponse = await request.get(manifestUrl);
    expect(manifestResponse.ok(), `Manifest should load: ${manifestUrl}`).toBeTruthy();
    const manifest = await manifestResponse.json();
    expect(manifest.name || manifest.short_name).toMatch(/86\s*Chaos|86Chaos/i);
    expect(manifest.display).toMatch(/standalone|fullscreen|minimal-ui/i);
    expect(manifest.start_url).toBeTruthy();
    expect(Array.isArray(manifest.icons) && manifest.icons.length > 0).toBeTruthy();

    const iconChecks = [];
    for (const icon of manifest.icons || []) {
      const iconUrl = new URL(icon.src, manifestUrl).toString();
      const response = await request.get(iconUrl);
      iconChecks.push({ iconUrl, status: response.status(), type: response.headers()['content-type'] || '', sizes: icon.sizes || '', purpose: icon.purpose || '' });
      expect(response.ok(), `Manifest icon should load: ${iconUrl}`).toBeTruthy();
      expect(response.headers()['content-type'] || '').toMatch(/image\//i);
    }

    const versionResponse = await request.get(new URL('/version.json', BASE_URL).toString());
    expect(versionResponse.ok(), '/version.json should load').toBeTruthy();
    const version = await versionResponse.json();
    expect(String(version.version || '')).toMatch(/^\d+\.\d+\.\d+$/);

    const layout = await viewportAudit(page);
    expect(layout.horizontalOverflow, `Public shell overflow: ${JSON.stringify(layout.offenders)}`).toBeFalsy();
    expect(problems.filter(problem => problem.type !== 'controlled-4xx'), JSON.stringify(problems, null, 2)).toEqual([]);
    await attachJson(testInfo, 'app-store-shell-evidence.json', { project: testInfo.project.name, head, manifest, iconChecks, version, layout, problems });
  });

  test('login shell has readable controls and mobile-safe touch targets', async ({ page }, testInfo) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    const controls = await page.locator('input:visible, button:visible, a:visible').evaluateAll((elements) => elements.map((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        tag: element.tagName,
        type: element.getAttribute('type') || '',
        name: (element.getAttribute('aria-label') || element.innerText || element.getAttribute('placeholder') || '').trim().slice(0, 100),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        fontSize: Number.parseFloat(style.fontSize || '0'),
        visible: rect.width > 0 && rect.height > 0,
      };
    }));
    const keyControls = controls.filter(row => /email|password|sign in|log in|unlock|forgot/i.test(row.name));
    expect(keyControls.length, 'Expected the login form to expose named controls').toBeGreaterThanOrEqual(3);
    for (const control of keyControls) {
      expect(control.width, `${control.name} should be wide enough`).toBeGreaterThanOrEqual(42);
      expect(control.height, `${control.name} should be tall enough`).toBeGreaterThanOrEqual(42);
      if (testInfo.project.name.includes('mobile') && control.tag === 'INPUT') {
        expect(control.fontSize, `${control.name} should avoid mobile browser zoom`).toBeGreaterThanOrEqual(16);
      }
    }
    await attachJson(testInfo, 'login-control-metrics.json', { project: testInfo.project.name, controls, keyControls });
  });
});
