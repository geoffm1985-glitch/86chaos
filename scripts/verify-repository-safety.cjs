'use strict';
const fs=require('node:fs'),cp=require('node:child_process');
const {excludedFile}=require('./86chaos-release-gate/source-identity.cjs');
function git(args){const r=cp.spawnSync('git',args,{encoding:'utf8'});if(r.status!==0)throw new Error(r.stderr||'Git check failed');return r.stdout;}
try{
 const staged=process.argv.includes('--staged');
 const required=['src','api','scripts','test-tools','tests'];
 for(const dir of required)if(!fs.existsSync(dir)||!fs.statSync(dir).isDirectory())throw new Error('Missing source tree: '+dir);
 for(const f of ['package.json','package-lock.json','vercel.json','firebase.json','RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1','.gitignore'])if(!fs.existsSync(f))throw new Error('Missing required source: '+f);
 const files=git(['ls-files','-z']).split('\0').filter(Boolean);
 const forbidden=files.filter(file=>excludedFile(file)||/(?:service[-_]?account|credentials|private[-_]?key).*\.json$/i.test(file));
 if(forbidden.length)throw new Error('Generated files or secrets are tracked: '+forbidden.join(', ')+'. Remove only these exact paths from the index after review; never clear the whole index.');
 if(files.length<800)throw new Error('Application source inventory is unexpectedly small.');
 const deletions=git(['diff',...(staged?['--cached']:[]),'--diff-filter=D','--name-only']).trim();
 if(deletions)throw new Error('Review unexpected source deletions before continuing:\n'+deletions);
 if(staged){const indexed=new Set(files);for(const dir of required)if(!files.some(file=>file.startsWith(dir+'/')))throw new Error('Source tree missing from index: '+dir);for(const f of ['package.json','package-lock.json','vercel.json','firebase.json','.gitignore'])if(!indexed.has(f))throw new Error('Required source is missing from index: '+f);}
 console.log('Repository safety passed: complete source; no tracked generated files/secrets or source deletions.');
}catch(error){console.error(error.message);process.exitCode=1;}
