'use strict';
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const assert = require('node:assert/strict'), crypto = require('node:crypto');
const PROJECT = 'cheers-34b8d', ORIGIN = 'https://app.86chaos.com';
const UPDATED_ORIGIN = 'https://86chaos-git-mobile-cheers-portal-s-projects.vercel.app';
function productionEnvironment(parent = process.env) {
  const env = { ...parent };
  for (const key of Object.keys(env)) {
    if (/EMULATOR|^YARDMASTER_|^CHAOS_(?:BASE_URL|BLOCK_LIVE_FIREBASE|EXPECTED_TEST_FIREBASE_PROJECT_ID)|^VERCEL(?:_|$)/.test(key) || key === 'GOOGLE_APPLICATION_CREDENTIALS' || key === 'FIREBASE_CONFIG') delete env[key];
  }
  return { ...env, CI:'false', GENERATE_SOURCEMAP:'false', REACT_APP_86CHAOS_FIREBASE_TARGET:'live',
    REACT_APP_FIREBASE_DEPLOYMENT_MODE:'production', FIREBASE_DEPLOYMENT_MODE:'production',
    REACT_APP_FIREBASE_ACTIVE_PROJECT_ID:PROJECT, REACT_APP_FIREBASE_PROJECT_ID:PROJECT,
    FIREBASE_ACTIVE_PROJECT_ID:PROJECT, FIREBASE_PROJECT_ID:PROJECT, GCLOUD_PROJECT:PROJECT, GOOGLE_CLOUD_PROJECT:PROJECT,
    REACT_APP_NATIVE_API_BASE_URL:ORIGIN, REACT_APP_NATIVE_UPDATED_API_BASE_URL:UPDATED_ORIGIN };
}
function verifyProductionConfiguration(services, capacitor, contract) {
  assert.equal(services.project_info.project_id, PROJECT, 'APK requires production Firebase cheers-34b8d');
  assert(services.client.some(c => c.client_info.android_client_info.package_name === 'com.chiltonappworks.chaos86'), 'Production Firebase Android registration missing');
  assert.equal(capacitor.appId, 'com.chiltonappworks.chaos86');
  assert.equal(capacitor.appName, '86 Chaos');
  assert.equal(capacitor.server.hostname, 'app.86chaos.com', 'APK requires production native origin');
  assert.equal(contract.firebase.projectId, PROJECT);
  assert.equal(contract.nativePush.projectId, PROJECT);
  assert.equal(contract.nativeApiBridge.backendBaseUrl, ORIGIN);
  assert.equal(contract.nativeApiBridge.updatedRoutes.backendBaseUrl, UPDATED_ORIGIN);
  assert.equal(contract.nativeApiBridge.updatedRoutes.firebaseProjectId, PROJECT);
}
function verifyBuildBranch(branch) {
  assert.equal(branch,'testing','This rebuild must package the sealed testing branch; never switch or modify mobile');
}
function verifySigningCertificate(output, expected) {
  const actual=String(output).match(/certificate SHA-256 digest:\s*([a-f0-9:]+)/i)?.[1]?.replace(/:/g,'').toLowerCase();
  assert(actual && actual===String(expected).replace(/:/g,'').toLowerCase(),'APK signing certificate differs from the retained signing identity');
  return actual;
}
async function main() {
  const root = path.resolve(__dirname, '..');
  const json = p => JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
  verifyBuildBranch(cp.execFileSync('git',['branch','--show-current'],{cwd:root,encoding:'utf8'}).trim());
  assert.equal(cp.execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim(),'','Commit reviewed source before building');
  const source = require('./86chaos-release-gate/source-identity.cjs').captureSourceIdentity(root);
  assert.equal(source.sourceHash,json('release-source-manifest.json').sourceHash);
  verifyProductionConfiguration(json('android/app/google-services.json'),json('capacitor.config.json'),json('mobile/native-platform-contract.json'));
  const env = productionEnvironment();
  const sdk = env.ANDROID_HOME || env.ANDROID_SDK_ROOT;
  assert(sdk && fs.existsSync(sdk),'Local Android SDK missing');
  assert(env.CHAOS_PREVIEW_KEYSTORE && fs.existsSync(env.CHAOS_PREVIEW_KEYSTORE),'Retained signing key missing');
  const expectedSigner=json('mobile/native-platform-contract.json').androidSigning.certificateSha256;
  const keytool=path.join(env.JAVA_HOME,'bin',process.platform==='win32'?'keytool.exe':'keytool');
  const certificate=cp.execFileSync(keytool,['-exportcert','-keystore',env.CHAOS_PREVIEW_KEYSTORE,'-storepass','android','-alias','androiddebugkey']);
  assert.equal(crypto.createHash('sha256').update(certificate).digest('hex'),expectedSigner,'Configured keystore is not the retained signing key');
  const run = (command,args,cwd=root) => new Promise((resolve,reject) => {
    console.log('[BUILD] '+path.basename(command)+' '+args.join(' '));
    const child=cp.spawn(command,args,{cwd,env,stdio:['inherit','inherit',1],windowsHide:true});
    child.on('error',reject); child.on('close',code=>code===0?resolve():reject(Error('Build step exited '+code)));
  });
  const npm=path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
  await run(process.execPath,[npm,'run','build']);
  const identity=json('build/build-identity.json');
  assert.equal(identity.identityStampStatus,'verified');
  assert.equal(identity.sourceHash,source.sourceHash); assert.equal(identity.commit,source.commit);
  const target={environment:'production',firebaseProjectId:PROJECT,apiBaseUrl:ORIGIN,updatedApiBaseUrl:UPDATED_ORIGIN,
    localHostname:'app.86chaos.com',version:source.version,commit:source.commit,sourceHash:source.sourceHash};
  fs.writeFileSync(path.join(root,'build/native-build-target.json'),JSON.stringify(target,null,2)+'\n');
  await run(process.execPath,[path.join(root,'node_modules/@capacitor/cli/bin/capacitor'),'sync','android']);
  await run(env.ComSpec || 'cmd.exe',['/d','/c','gradlew.bat assembleDebug testDebugUnitTest lintDebug --no-daemon'],path.join(root,'android'));
  const dir=path.join(root,'.cache/production-apk'); fs.mkdirSync(dir,{recursive:true});
  const apk=path.join(dir,`86Chaos-${source.version}-production-preview.apk`);
  fs.copyFileSync(path.join(root,'android/app/build/outputs/apk/debug/app-debug.apk'),apk);
  const versions=fs.readdirSync(path.join(sdk,'build-tools')).sort((a,b)=>b.localeCompare(a,undefined,{numeric:true}));
  const zipalign=versions.map(v=>path.join(sdk,'build-tools',v,process.platform==='win32'?'zipalign.exe':'zipalign')).find(p=>fs.existsSync(p));
  assert(zipalign,'zipalign missing'); await run(zipalign,['-c','-P','16','4',apk]);
  const signer=versions.map(v=>path.join(sdk,'build-tools',v,'lib','apksigner.jar')).find(p=>fs.existsSync(p));
  assert(signer,'apksigner missing');
  const java=path.join(env.JAVA_HOME,'bin',process.platform==='win32'?'java.exe':'java');
  const signature=cp.execFileSync(java,['-jar',signer,'verify','--print-certs',apk],{encoding:'utf8',env});
  const certificateSha256=verifySigningCertificate(signature,expectedSigner);
  fs.writeFileSync(apk+'.signature.txt',signature);
  await run(process.platform==='win32'?'python':'python3',[path.join(root,'scripts/verify-native-push-apk.py'),apk]);
  const sha256=crypto.createHash('sha256').update(fs.readFileSync(apk)).digest('hex');
  fs.writeFileSync(apk+'.sha256',sha256+'  '+path.basename(apk)+'\n');
  fs.writeFileSync(path.join(dir,'build-result.json'),JSON.stringify({...target,apk,sha256,certificateSha256,builtLocally:true,targetedDeltaValidated:false,physicalDeviceVerified:false,backendCompatibility:'pending',finishedAt:new Date().toISOString()},null,2)+'\n');
  console.log('[PASS] Production Firebase APK built and packaged target verified: '+apk);
}
module.exports={productionEnvironment,verifyProductionConfiguration,verifyBuildBranch,verifySigningCertificate,PROJECT,ORIGIN,UPDATED_ORIGIN};
if(require.main===module)main().catch(e=>{console.error('[FAIL] '+e.message);process.exitCode=1;});
