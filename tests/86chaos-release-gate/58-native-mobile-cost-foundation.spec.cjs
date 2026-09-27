const { test, expect } = require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const json=file=>JSON.parse(read(file));

test.describe('58 Native mobile and Firebase cost foundation',()=>{
  test('deployed 18.0.0 identity and Android/iPhone responsive smoke stay aligned',async({browser,request})=>{
    const contract=json('mobile/native-platform-contract.json');
    expect(contract.platforms).toEqual(['android','ios']);
    expect(contract.equalPlatformPriority).toBe(true);
    expect(contract.firebase.projectId).toBe('chaos-test-d1601');
    expect(contract.costControls.nativeBackgroundReleaseGraceMs).toBe(15000);

    const versionResponse=await request.get('/version.json');
    expect(versionResponse.ok()).toBeTruthy();
    const version=await versionResponse.json();
    expect(version.version).toBe('18.0.0');

    const profiles=[
      {
        name:'android',
        userAgent:'Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36',
        viewport:{width:412,height:915}
      },
      {
        name:'ios',
        userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
        viewport:{width:393,height:852}
      }
    ];

    for(const profile of profiles){
      const context=await browser.newContext({userAgent:profile.userAgent,viewport:profile.viewport,isMobile:true,hasTouch:true});
      const page=await context.newPage();
      const response=await page.goto('/',{waitUntil:'domcontentloaded',timeout:30000});
      expect(response && response.ok(),profile.name+' root document should load').toBeTruthy();
      await expect(page.locator('body')).toBeVisible();
      const body=(await page.locator('body').innerText()).slice(0,12000);
      expect(body).not.toMatch(/application recovery|something went wrong/i);
      const viewportMeta=await page.locator('meta[name="viewport"]').getAttribute('content');
      expect(viewportMeta||'').toContain('width=device-width');
      await context.close();
    }
  });

  test('source contract keeps native listener cost guard and local packaging intact',async()=>{
    const core=read('src/core/appCore.js');
    const cap=json('capacitor.config.json');
    expect(cap.webDir).toBe('build');
    expect(cap.server.url).toBeUndefined();
    expect(core).toMatch(/MOBILE_NATIVE_BACKGROUND_RELEASE_GRACE_MS = 15 \* 1000/);
    expect(core).toMatch(/listenerReleaseGraceMs\(current, 'collection'\)/);
    expect(core).toMatch(/listenerReleaseGraceMs\(current, 'document'\)/);
    expect(core).toMatch(/enableMultiTabIndexedDbPersistence/);
    expect(core).toMatch(/source: 'rtdb-low-cost-presence'/);
  });
});
