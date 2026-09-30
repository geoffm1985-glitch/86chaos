#!/usr/bin/env node
'use strict';
const cp=require('node:child_process');const path=require('node:path');const fs=require('node:fs');
const packagePath=require.resolve('firebase-tools/package.json',{paths:[process.cwd()]});const pkg=JSON.parse(fs.readFileSync(packagePath,'utf8'));const bin=path.resolve(path.dirname(packagePath),typeof pkg.bin==='string'?pkg.bin:pkg.bin.firebase);const command=`"${process.execPath}" --test api/pos-bridge-emulator-16-0-236.test.cjs`;const result=cp.spawnSync(process.execPath,[bin,'emulators:exec','--only','firestore','--project','demo-pos-bridge',command],{cwd:process.cwd(),stdio:'inherit',env:{...process.env,GCLOUD_PROJECT:'demo-pos-bridge'}});process.exitCode=result.status===0?0:(result.status||1);
