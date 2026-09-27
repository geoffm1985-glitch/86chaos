const { test, expect } = require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const json=file=>JSON.parse(read(file));

test.describe('61 Native container insets',()=>{
  test('native container inset contract remains active for the current Android build',async({page,request},testInfo)=>{
    expect(['native-android','native-ios-webkit']).toContain(testInfo.project.name);
    const current=json('package.json').version;
    const version=await (await request.get('/version.json')).json();
    expect(version.version).toBe(current);
    const response=await page.goto('/',{waitUntil:'domcontentloaded',timeout:30000});
    expect(response && response.ok()).toBeTruthy();
    await expect(page.locator('body')).toBeVisible();
  });

  test('Android native source constrains the activity content container, not fixed-position web content',async()=>{
    const activity=read('android/app/src/main/java/com/chiltonappworks/chaos86/MainActivity.java');
    const contract=json('mobile/native-platform-contract.json');
    expect(activity).toMatch(/findViewById\(android\.R\.id\.content\)/);
    expect(activity).toMatch(/setOnApplyWindowInsetsListener\(contentView/);
    expect(activity).toMatch(/webView\.setPadding\(0, 0, 0, 0\)/);
    expect(activity).not.toMatch(/setOnApplyWindowInsetsListener\(webView/);
    expect(contract.nativeViewport.android.containerPadding).toBe(true);
    expect(contract.nativeViewport.android.webViewPadding).toBe(false);
  });
});
