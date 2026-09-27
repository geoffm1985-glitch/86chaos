const { test, expect } = require('@playwright/test');
const { ownerLikeCreds, requireCreds, login, gotoTab, watchForProblems } = require('../86chaos-full-audit/utils/audit-helpers.cjs');

test.describe('53 Speak Reminder microphone lifecycle', () => {
  test('authenticated reminder UI starts and stops one accessible recognition session', async ({ page }) => {
    test.setTimeout(6 * 60 * 1000);
    await page.addInitScript(()=>{class FakeRecognition{start(){queueMicrotask(()=>this.onstart?.())}stop(){queueMicrotask(()=>this.onend?.())}abort(){queueMicrotask(()=>this.onend?.())}}window.SpeechRecognition=FakeRecognition});
    const account=ownerLikeCreds();requireCreds(account,'owner-like account');const problems=[];watchForProblems(page,problems);
    await login(page,account.email,account.password);await gotoTab(page,'reminders',{settleMs:1200});
    const start=page.getByRole('button',{name:'Speak Reminder'});await expect(start).toBeVisible();await start.click();
    const stop=page.getByRole('button',{name:'Stop reminder voice entry'});await expect(stop).toBeVisible();await stop.click();await expect(start).toBeVisible();
    expect(problems.filter(row=>['page-error','http-5xx'].includes(row.type)),JSON.stringify(problems,null,2)).toEqual([]);
  });
});
