'use strict';
const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),css=fs.readFileSync(path.join(root,'src/styles.css'),'utf8');
// Layout fixture loads the application's actual CSS and voice button classes.
// No auth/voice behavior is simulated or claimed by these geometry assertions.
const source=fs.readFileSync(path.join(root,'src/components/common.jsx'),'utf8');
const dockClass=source.match(/className="(voice-command-dock[^"]+)"/)[1];
const buttonClass=source.match(/aria-expanded=\{open\}[\s\S]*?className="([^"]+)"/)[1];
for(const [width,height] of [[360,740],[412,915],[540,720],[412,580],[1024,768]])test(`17.0.5 actual voice CSS layout ${width}x${height}`,async({page})=>{
 await page.setViewportSize({width,height});
 await page.setContent(`<style>html,body{margin:0}*{box-sizing:border-box}.flex{display:flex}.flex-col{flex-direction:column}.flex-1{flex:1 1 0%}.fixed{position:fixed}.bottom-5{bottom:20px}.left-4{left:16px}.w-14{width:56px}.h-14{height:56px}.min-h-screen{min-height:100vh}.app-header{height:60px}.app-content-shell{width:100%}${css}</style><div class="desktop-pro-shell min-h-screen flex flex-col" data-active-tab="schedule"><header class="app-header">Schedule</header><div class="${dockClass}"><button class="${buttonClass}" aria-label="Open 86Voice">Mic</button></div><main class="app-content-shell flex-1"><button>Copy Month</button><button>Publish</button><button>Event</button>${Array.from({length:40},(_,i)=>`<div class="shift-row" style="height:50px">${i%2?'BARTENDER':'MANAGER'} shift ${i}</div>`).join('')}</main></div>`);
 const mic=page.getByRole('button',{name:'Open 86Voice'}),box=await mic.boundingBox();expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);
 if(width<=720){expect(height-box.y-box.height).toBeCloseTo(8,0);const main=page.locator('main'),bounds=await main.boundingBox();expect(bounds.y+bounds.height).toBeLessThanOrEqual(box.y);await main.evaluate(el=>el.scrollTop=el.scrollHeight);const last=await page.locator('.shift-row').last().boundingBox();expect(last.y+last.height).toBeLessThanOrEqual(box.y);for(const name of ['Copy Month','Publish','Event']){await main.evaluate(el=>el.scrollTop=0);const control=await page.getByRole('button',{name,exact:true}).boundingBox();expect(control.y+control.height).toBeLessThan(box.y);}}
 else expect(height-box.y-box.height).toBeCloseTo(20,0);
});
