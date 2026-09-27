const { test, expect } = require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const json=file=>JSON.parse(read(file));

test.describe('59 Native packaged API bridge',()=>{
  test('Android and iPhone packaged API bridge contract stays identical',async({page,request},testInfo)=>{
    expect(['native-android','native-ios-webkit']).toContain(testInfo.project.name);
    const versionResponse=await request.get('/version.json');
    expect(versionResponse.ok()).toBeTruthy();
    expect((await versionResponse.json()).version).toBe('18.0.2');
    const response=await page.goto('/',{waitUntil:'domcontentloaded',timeout:30000});
    expect(response && response.ok()).toBeTruthy();
    await expect(page.locator('body')).toBeVisible();

    const cap=json('capacitor.config.json');
    const contract=json('mobile/native-platform-contract.json');
    expect(cap.server.hostname).toBe('testing.86chaos.com');
    expect(contract.nativeApiBridge.backendBaseUrl).toBe('https://testing.86chaos.com');
    expect(contract.nativeApiBridge.transport).toBe('CapacitorHttp');
    expect(contract.nativeApiBridge.paidServicesAdded).toBe(false);
  });

  test('source routes only same-origin /api requests through CapacitorHttp',async()=>{
    const core=read('src/core/appCore.js');
    expect(core).toMatch(/nativeApiRequestPath/);
    expect(core).toMatch(/parsed\.origin === window\.location\.origin/);
    expect(core).toMatch(/CapacitorHttp\.request\(/);
    expect(core).toMatch(/window\.fetch = nativeApiFetch/);
    expect(core).toMatch(/NATIVE_API_BASE_URL/);
  });
});
