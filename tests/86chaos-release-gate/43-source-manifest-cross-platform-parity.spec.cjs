'use strict';
const {test,expect}=require('@playwright/test');
const fs=require('fs');
const path=require('path');
const identity=require('../../scripts/86chaos-release-gate/source-identity.cjs');
const root=path.resolve(__dirname,'../..');

test.describe('17.0.31 source manifest cross-platform parity',()=>{
  test('tracked source, bundled manifest, and TypeScript newline normalization remain deterministic',async()=>{
    const captured=identity.captureSourceIdentity(root);
    const bundled=identity.readBundledSourceManifest(root);
    expect(bundled).toBeTruthy();
    expect(captured.sourceHash).toBe(bundled.sourceHash);
    const lf=Buffer.from('export const x = 1;\n','utf8');
    const crlf=Buffer.from('export const x = 1;\r\n','utf8');
    expect(identity.hash(identity.sourceBytes('functions/src/x.ts',crlf))).toBe(identity.hash(identity.sourceBytes('functions/src/x.ts',lf)));
    const attrs=fs.readFileSync(path.join(root,'.gitattributes'),'utf8');
    expect(attrs).toMatch(/^\*\.ts text eol=lf$/m);
    expect(attrs).toMatch(/^\*\.tsx text eol=lf$/m);
  });
});
