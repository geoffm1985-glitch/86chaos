const { test }=require('node:test'); const assert=require('node:assert/strict'); const fs=require('fs'); const path=require('path'); const os=require('os');
const {captureSourceIdentity,compareSourceIdentity}=require('../scripts/86chaos-release-gate/source-identity.cjs');
test('release evidence rejects both modified source and a changed commit',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'chaos-identity-'));
  try { fs.writeFileSync(path.join(dir,'package.json'),'{"version":"16.0.228"}'); fs.writeFileSync(path.join(dir,'source.js'),'one'); const before=captureSourceIdentity(dir);
    assert.equal(compareSourceIdentity(before,captureSourceIdentity(dir)).ok,true); fs.writeFileSync(path.join(dir,'source.js'),'two'); assert.equal(compareSourceIdentity(before,captureSourceIdentity(dir)).ok,false);
    assert.equal(compareSourceIdentity(before,{...before,commit:'new-commit'}).ok,false);
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});
test('Help JS/CJS mirrors have the same reviewed customer articles',()=>{
  const js=fs.readFileSync(path.join(__dirname,'../src/core/customerHelpKnowledge.js'),'utf8'); const cjs=fs.readFileSync(path.join(__dirname,'../src/core/customerHelpKnowledge.cjs'),'utf8');
  assert.equal(js.slice(0,js.indexOf('const CUSTOMER_HELP_ARTICLES_LEGACY =')).trim(),cjs.slice(0,cjs.indexOf('module.exports =')).trim());
});
test('affected Firebase read/listener and human approval invariants remain in source',()=>{
  const root=path.join(__dirname,'..'); const read=file=>fs.readFileSync(path.join(root,file),'utf8');
  assert.match(read('src/hooks/useScanHistory.js'),/startAfter\(cursor\)/); assert(!read('src/hooks/useScanHistory.js').includes('onSnapshot'));
  assert(!read('src/features/intelligence.jsx').includes("useLiveCollection('menuDependencies'"));
  assert.match(read('api/_invoice-approval.js'),/db\.runTransaction/); assert.match(read('api/_menu-approval.js'),/approved !== true/);
  const rules=JSON.parse(read('firestore.indexes.json')); assert(rules.indexes.some(index=>index.collectionGroup==='invoices'&&index.fields.some(field=>field.fieldPath==='processedAt')));
});
