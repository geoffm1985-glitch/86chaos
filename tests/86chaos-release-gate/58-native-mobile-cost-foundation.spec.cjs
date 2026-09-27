const { test, expect } = require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const json=file=>JSON.parse(read(file));

test.describe('58 Native mobile and Firebase cost foundation',()=>{
  test('deployed/local 18.0.0 identity loads on Android Chromium and iPhone WebKit',async({page,request},testInfo)=>{
    expect(['native-android','native-ios-webkit']).toContain(testInfo.project.name);
    const contract=json('mobile/native-platform-contract.json');
    expect(contract.platforms).toEqual(['android','ios']);
    expect(contract.equalPlatformPriority).toBe(true);
    expect(contract.firebase.projectId).toBe('chaos-test-d1601');
    expect(contract.costControls.nativeBackgroundReleaseGraceMs).toBe(15000);

    const versionResponse=await request.get('/version.json');
    expect(versionResponse.ok()).toBeTruthy();
    const version=await versionResponse.json();
    expect(version.version).toMatch(/^18\.0\./);

    const response=await page.goto('/',{waitUntil:'domcontentloaded',timeout:30000});
    expect(response && response.ok(),testInfo.project.name+' root document should load').toBeTruthy();
    await expect(page.locator('body')).toBeVisible();
    const body=(await page.locator('body').innerText()).slice(0,12000);
    expect(body).not.toMatch(/application recovery|something went wrong/i);
    const viewportMeta=await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewportMeta||'').toContain('width=device-width');
  });

  test('source contract keeps native identity permissions and Firebase cost guard aligned',async()=>{
    const core=read('src/core/appCore.js');
    const cap=json('capacitor.config.json');
    const contract=json('mobile/native-platform-contract.json');
    const androidBuild=read('android/app/build.gradle');
    const androidManifest=read('android/app/src/main/AndroidManifest.xml');
    const iosProject=read('ios/App/App.xcodeproj/project.pbxproj');
    const iosPlist=read('ios/App/App/Info.plist');

    expect(cap.webDir).toBe('build');
    expect(cap.server.url).toBeUndefined();
    expect(contract.capacitor.version).toBe('8.5.2');
    expect(contract.capacitor.android.versionCode).toBeGreaterThanOrEqual(180000);
    expect(contract.capacitor.android.versionName).toMatch(/^18\.0\./);
    expect(contract.capacitor.ios.currentProjectVersion).toBeGreaterThanOrEqual(180000);
    expect(contract.capacitor.ios.marketingVersion).toMatch(/^18\.0\./);

    expect(androidBuild).toMatch(/versionCode 18\d{4}/);
    expect(androidBuild).toMatch(/versionName "18\.0\.\d+"/);
    expect(androidManifest).toMatch(/android\.permission\.CAMERA/);
    expect(androidManifest).toMatch(/android\.permission\.RECORD_AUDIO/);
    expect(androidManifest).toMatch(/android\.permission\.POST_NOTIFICATIONS/);
    expect(iosProject).toMatch(/CURRENT_PROJECT_VERSION = 18\d{4};/);
    expect(iosProject).toMatch(/MARKETING_VERSION = 18\.0\.\d+;/);
    expect(iosPlist).toMatch(/NSCameraUsageDescription/);
    expect(iosPlist).toMatch(/NSMicrophoneUsageDescription/);

    expect(core).toMatch(/MOBILE_NATIVE_BACKGROUND_RELEASE_GRACE_MS = 15 \* 1000/);
    expect(core).toMatch(/listenerReleaseGraceMs\(current, 'collection'\)/);
    expect(core).toMatch(/listenerReleaseGraceMs\(current, 'document'\)/);
    expect(core).toMatch(/enableMultiTabIndexedDbPersistence/);
    expect(core).toMatch(/source: 'rtdb-low-cost-presence'/);
  });
});
