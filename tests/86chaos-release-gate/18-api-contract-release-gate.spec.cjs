const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { attachJson } = require('../86chaos-full-audit/utils/audit-helpers.cjs');

const RISKY_NETWORK = /quickbooks-webhook|dispatch-reminders|firestore-backup|watchdog|weekly-maintenance|send-push|send-schedule-alert|delete-user|delete-users-bulk|deploy-tenant|restore-drill|master-admin-repair|full-audit-qa-cleanup|import-cheers|account-deletion-request|platform|maintenance|backup|restore|cleanup|delete|deploy|broadcast/i;
const LEAK_RE = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|serviceAccount|refreshToken|clientSecret|FIREBASE_SERVICE_ACCOUNT_KEY|AIza[0-9A-Za-z_-]{20,}/i;
const STACK_RE = /\bat\s+[A-Za-z0-9_$<>.]+\s*\([^\n]+:\d+:\d+\)|node_modules\//i;

function walk(dir) {
  const out=[];
  for (const ent of fs.readdirSync(dir,{withFileTypes:true})) {
    const p=path.join(dir,ent.name);
    if (ent.isDirectory()) out.push(...walk(p));
    else if (ent.isFile() && ent.name.endsWith('.js') && !ent.name.startsWith('_') && !/\.test\.|\.spec\./i.test(ent.name)) out.push(p);
  }
  return out;
}
function apiFiles() {
  const dir=path.join(process.cwd(),'api');
  return walk(dir).map(file=>{
    const rel=path.relative(dir,file).replace(/\\/g,'/');
    return { name:rel, endpoint:`/api/${rel.replace(/\.js$/,'')}`, source:fs.readFileSync(file,'utf8') };
  }).sort((a,b)=>a.name.localeCompare(b.name));
}

test.describe('18 recursive API contract + unauthenticated abuse gate',()=>{
  test('every public API handler, including nested System Administrator routes, rejects malformed unauthenticated calls without 5xx or leakage',async({request},testInfo)=>{
    test.setTimeout(35*60*1000);
    const base=process.env.APP_URL||process.env.CHAOS_BASE_URL||process.env.BASE_URL;
    const apis=apiFiles();
    const results=[];
    for(const api of apis){
      const url=new URL(api.endpoint,base).toString();
      const risky = RISKY_NETWORK.test(api.name);
      if (risky) {
        results.push({ endpoint: api.endpoint, method: 'SOURCE_ONLY', riskyNetworkProbeSkipped: true, reason: 'Potentially destructive/operational endpoint is source-audited but never invoked by the exhaustive gate.' });
        continue;
      }
      const methods=['GET','POST'];
      for(const method of methods){
        let response;
        try{
          response=method==='GET'
            ? await request.get(url,{failOnStatusCode:false,timeout:45000})
            : await request.post(url,{failOnStatusCode:false,timeout:45000,data:{}});
        }catch(err){
          results.push({endpoint:api.endpoint,method,transportError:String(err.message||err).slice(0,500)});
          continue;
        }
        const text=(await response.text().catch(()=>'' )).slice(0,12000);
        results.push({endpoint:api.endpoint,method,status:response.status(),contentType:response.headers()['content-type']||'',leakedSecret:LEAK_RE.test(text),leakedStack:STACK_RE.test(text),sample:text.slice(0,1200)});
      }
    }
    const networkResults=results.filter(r=>!r.riskyNetworkProbeSkipped);
    const riskySourceOnly=results.filter(r=>r.riskyNetworkProbeSkipped);
    const transport=networkResults.filter(r=>r.transportError);
    const serverErrors=networkResults.filter(r=>(r.status||0)>=500);
    const leaks=networkResults.filter(r=>r.leakedSecret||r.leakedStack);
    await attachJson(testInfo,'18-recursive-api-contract-results.json',{totals:{endpoints:apis.length,networkCalls:networkResults.length,riskySourceOnly:riskySourceOnly.length,transportErrors:transport.length,serverErrors:serverErrors.length,leaks:leaks.length},riskySourceOnly,transport,serverErrors,leaks,results});
    expect(apis.length,'Recursive API inventory unexpectedly shrank; nested endpoints may have escaped coverage').toBeGreaterThanOrEqual(70);
    expect(transport,'Every non-destructive API network probe must return a controlled HTTP response').toEqual([]);
    expect(serverErrors,'Malformed/unauthenticated API calls must not produce unhandled 5xx').toEqual([]);
    expect(leaks,'API error responses must never expose secrets or stack traces').toEqual([]);
  });

  test('every recursive API handler has explicit method/auth/error-handling evidence',async({},testInfo)=>{
    const findings=[];
    const apis=apiFiles();
    for(const api of apis){
      const s=api.source;
      const hasMethod=/req\.method|request\.method|method\s*===|method\s*!==/i.test(s);
      const hasAuth=/authorize\(|verifyIdToken|Authorization|requireAppCheck|webhook|cron_secret|CRON_SECRET|verify.*token|auth/i.test(s);
      const hasError=/try\s*\{|catch\s*\(/.test(s);
      const hasBodyGuard=/readBody\(|content-length|body.*size|MAX_.*BODY|JSON\.parse|req\.body/i.test(s);
      if(!hasMethod||!hasAuth||!hasError) findings.push({endpoint:api.endpoint,hasMethod,hasAuth,hasError,hasBodyGuard});
    }
    await attachJson(testInfo,'18-recursive-api-source-contract.json',{total:apis.length,findings});
    expect(findings,'Every nested and top-level API handler needs explicit method, authorization, and controlled error handling').toEqual([]);
  });
});
