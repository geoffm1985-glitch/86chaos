'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const root=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('legacy freeze validators normalize CRLF before SHA-256 comparisons',()=>{
  for(const file of ['scripts/validate-16-0-231.js','scripts/validate-16-0-233.js']){
    const source=read(file);
    assert.match(source,/createHash\('sha256'\)\.update\(read\(file\)\.replace\(\/\\r\\n\?\/g, '\\n'\)\)/,file);
    assert.doesNotMatch(source,/createHash\('sha256'\)\.update\(read\(file\)\)\.digest/,file);
  }
});
