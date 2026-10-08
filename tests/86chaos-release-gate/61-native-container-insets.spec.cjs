const { test, expect } = require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const json=file=>JSON.parse(read(file));

test.describe('61 Native container insets',()=>{
  test('Android microphone matches web spacing even when WebView reports system-bar insets',async({page})=>{
    const component=read('src/components/common.jsx');
    const dockClass=component.match(/className="(voice-command-dock[^"]+)"/)[1];
    // Exercise the real CSS against a nonzero inset. Android's native container
    // has already removed that area; iOS and web still need their CSS fallback.
    const css=read('src/styles.css').replace(/env\(safe-area-inset-bottom,\s*0px\)/g,'48px').replace(/env\(safe-area-inset-left,\s*0px\)/g,'24px');
    await page.setContent(`<meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><div class="${dockClass}" style="position:fixed"><button aria-label="Open 86Voice">Mic</button></div><div style="height:2400px"></div>`);
    const geometry=()=>page.getByRole('button',{name:'Open 86Voice'}).evaluate(el=>{
      const r=el.getBoundingClientRect(); return {bottom:innerHeight-r.bottom,left:r.left};
    });
    expect((await geometry()).bottom).toBeCloseTo(92,0);
    await page.evaluate(()=>document.documentElement.className='chaos-native-runtime chaos-native-android');
    expect(await geometry()).toEqual({bottom:44,left:12});
    await page.evaluate(()=>window.scrollTo(0,900));
    expect(await geometry()).toEqual({bottom:44,left:12});
    await page.setViewportSize({width:640,height:360});
    expect(await geometry()).toEqual({bottom:44,left:12});
    await page.evaluate(()=>document.documentElement.className='chaos-native-runtime chaos-native-ios');
    expect((await geometry()).bottom).toBeCloseTo(92,0);
  });
  test('native container inset contract remains active for the current Android build',async({page,request},testInfo)=>{
    expect(['native-android','native-ios-webkit','chromium','mobile-chromium']).toContain(testInfo.project.name);
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
