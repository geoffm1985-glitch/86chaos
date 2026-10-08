const { test, expect } = require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const bin=file=>fs.readFileSync(path.join(root,file));
const json=file=>JSON.parse(read(file));

test.describe('60 Native system bars and branding',()=>{
  test('native viewport contract stays safe on Android Chromium and iPhone WebKit',async({page,request},testInfo)=>{
    expect(['native-android','native-ios-webkit','chromium','mobile-chromium']).toContain(testInfo.project.name);
    const version=await (await request.get('/version.json')).json();
    const currentVersion=json('package.json').version;
    expect(version.version).toBe(currentVersion);
    expect(currentVersion).toMatch(/^18\.0\.\d+$/);
    const response=await page.goto('/',{waitUntil:'domcontentloaded',timeout:30000});
    expect(response && response.ok()).toBeTruthy();
    const viewport=await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport||'').toContain('viewport-fit=cover');
    const overflow=await page.evaluate(()=>({
      width:document.documentElement.scrollWidth,
      client:document.documentElement.clientWidth,
      bodyWidth:document.body.scrollWidth
    }));
    expect(overflow.width).toBeLessThanOrEqual(overflow.client+1);
    expect(overflow.bodyWidth).toBeLessThanOrEqual(overflow.client+1);
  });

  test('native source protects Android system bars and uses branded launcher asset',async()=>{
    const activity=read('android/app/src/main/java/com/chiltonappworks/chaos86/MainActivity.java');
    const manifest=read('android/app/src/main/AndroidManifest.xml');
    const core=read('src/core/appCore.js');
    const css=read('src/styles.css');
    const contract=json('mobile/native-platform-contract.json');
    expect(activity).toMatch(/WindowInsetsCompat\.Type\.systemBars\(\)/);
    expect(activity).toMatch(/WindowInsetsCompat\.Type\.displayCutout\(\)/);
    expect(activity).toMatch(/view\.setPadding\(safeInsets\.left, safeInsets\.top, safeInsets\.right, safeInsets\.bottom\)/);
    expect(manifest).toMatch(/@drawable\/chaos86_app_icon/);
    expect(bin('android/app/src/main/res/drawable-nodpi/chaos86_app_icon.png').equals(bin('public/86chaos-pwa-512-v4.png'))).toBe(true);
    expect(core).toMatch(/installNativeViewportClass/);
    expect(css).toMatch(/html\.chaos-native-ios body/);
    expect(contract.nativeViewport.android.containerPadding).toBe(true);
    expect(contract.nativeViewport.android.webViewPadding).toBe(false);
    expect(contract.branding.androidLauncherIcon).toBe('public/86chaos-pwa-512-v4.png');
    expect(contract.branding.iosBrandedIconRequiredBeforeAppleDistribution).toBe(true);
  });
});
