'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
test('17.0.43 testing gate trigger and targeted identity are deterministic',()=>{const p=JSON.parse(read('package.json')),w=read('.github/workflows/testing-targeted-delta.yml');assert.equal(p.version,'17.0.43');assert.match(w,/contains\(github\.event\.head_commit\.message, '\[full-gate\]'\)/);assert.ok(w.includes('version=$(node -p "require(\'./package.json\').version")'));assert.ok(w.includes('echo "CHAOS_EXPECTED_VERSION=$version" >> "$GITHUB_ENV"'));assert.ok(w.indexOf('Wait for exact testing deployment')<w.indexOf('Run full Release Gate'));});
