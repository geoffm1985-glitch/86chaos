const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

function read(rel) { return fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8'); }

test.describe('86 Chaos DEEP DEEP source wiring contract', () => {
  test('critical UI wiring source hooks exist for admin, mobile clock/schedule, voice, and live graphs', async ({}, testInfo) => {
    const app = read('src/App.js');
    const common = read('src/components/common.jsx');
    const reference = read('src/features/reference.jsx');

    const checks = {
      adminSectionState: /activeAdminSection/.test(app) && /setActiveAdminSection/.test(app),
      adminExitRail: /Exit to App/.test(app) && /Exit Admin/.test(app) && /setActiveTab\('today'\)/.test(app),
      adminSections: /admin-workspaces/.test(app) && /admin-security/.test(app) && /admin-automation/.test(app) && /activeAdminSection=/.test(app),
      topVoiceDispatch: /chaos-open-voice-dock/.test(app) && /reference-voice-action/.test(app),
      voiceDockListener: /addEventListener\('chaos-open-voice-dock'/.test(common) && /Parse Typed Command/.test(common),
      mobileClockScheduleQuick: /mobile-clock-schedule-quick/.test(app) && /setActiveTab\('published'\)/.test(app) && /setActiveTab\('schedule'\)/.test(app),
      bottomNavPriority: /mobile-clock/.test(app) && /mobile-schedule/.test(app) && /native-mobile-bottom-nav/.test(app),
      liveGraphPrimitives: /LiveLineChart/.test(reference) && /LiveBarChart/.test(reference) && /dailySeries/.test(reference) && /No live graph data yet/.test(reference),
      emptyLiveStates: /EmptyLive/.test(reference) && /No live .*yet/i.test(reference),
    };

    for (const [name, ok] of Object.entries(checks)) expect(ok, `${name} source wiring contract failed`).toBeTruthy();

    expect(app, 'Top mic should be copper-styled and larger in app CSS').toMatch(/reference-voice-action[\s\S]*(min-width|width)[\s\S]*(48px|54px|178px)[\s\S]*rgba\(196,124,63|#D4A381|#c47c3f/i);
    expect(app, 'Mobile layout should have overflow containment rules').toMatch(/overflow-x:\s*hidden|max-width:\s*100vw|mobile layout/i);
    expect(reference, 'Reference screens should not use hardcoded SVG polyline point art').not.toMatch(/<polyline\s+points=["']\d+,\d+\s+\d+,/i);

    await testInfo.attach('09-deep-deep-source-wiring-contract.json', {
      body: JSON.stringify({ checks, files: { appBytes: app.length, commonBytes: common.length, referenceBytes: reference.length } }, null, 2),
      contentType: 'application/json',
    });
  });
});
