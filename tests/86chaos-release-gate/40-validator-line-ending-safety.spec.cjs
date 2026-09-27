const { test, expect } = require('@playwright/test');
const fs=require('fs');
const path=require('path');
const root=process.cwd();
test.describe('40 cross-platform source-validator hash safety',()=>{
  test('legacy freeze validators normalize line endings before hashing',async ({},testInfo)=>{
    const evidence={};
    for(const file of ['scripts/validate-16-0-231.js','scripts/validate-16-0-233.js']){
      const source=fs.readFileSync(path.join(root,file),'utf8');
      const normalized=/createHash\('sha256'\)\.update\(read\(file\)\.replace\(\/\\r\\n\?\/g, '\\n'\)\)/.test(source);
      const raw=/createHash\('sha256'\)\.update\(read\(file\)\)\.digest/.test(source);
      evidence[file]={normalized,raw};
      expect(normalized).toBe(true);
      expect(raw).toBe(false);
    }
    await testInfo.attach('40-validator-line-ending-safety.json',{body:JSON.stringify(evidence,null,2),contentType:'application/json'});
  });
});
