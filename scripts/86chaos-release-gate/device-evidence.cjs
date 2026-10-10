'use strict';
const checklist=require('../../test-tools/certification/device-acceptance.json');
// Google Play phone/tablet updates require API 36 as checked 2026-10-10:
// https://support.google.com/googleplay/android-developer/answer/11926878
const MIN_ANDROID_TARGET_SDK=36;
const validText=value=>typeof value==='string' && value.trim().length>0;
const validHash=value=>typeof value==='string' && /^[a-f0-9]{64}$/i.test(value);
function validateDeviceEvidence(evidence,identity) {
  const failures=[];
  if(!evidence || evidence.ok!==true)failures.push('Physical-device acceptance has not passed.');
  for(const key of ['version','sourceManifestHash','commit'])if(!identity?.[key] || evidence?.[key]!==identity[key])failures.push(`Device evidence ${key} does not match this release.`);
  if(!['serial','model','androidVersion'].every(key=>validText(evidence?.device?.[key])))failures.push('Connected Android device identity is missing.');
  const artifact=evidence?.artifact || {};
  if(!validHash(artifact.sha256) || typeof artifact.packageName!=='string' || !/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/i.test(artifact.packageName) || !Number.isInteger(artifact.versionCode) || artifact.versionCode<=0 || !validHash(artifact.signingCertificateSha256) || artifact.debuggable!==false)failures.push('Installed signed release Android artifact identity is missing or invalid.');
  if(!Number.isInteger(artifact.targetSdkVersion) || artifact.targetSdkVersion<MIN_ANDROID_TARGET_SDK)failures.push(`Android submission artifact must target API ${MIN_ANDROID_TARGET_SDK} or higher.`);
  if(artifact.pageSize16KbCompatible!==true)failures.push('Android artifact needs verified 16 KB page-size compatibility.');
  const supplied=evidence?.results,results=Array.isArray(supplied)?supplied.filter(row=>row && typeof row==='object' && !Array.isArray(row) && typeof row.id==='string'):[];
  if(!Array.isArray(supplied) || results.length!==supplied.length)failures.push('Device results are malformed.');
  const knownIds=new Set(checklist.checks.map(check=>check.id));
  if(results.some(row=>!knownIds.has(row.id)))failures.push('Device results contain unknown check IDs.');
  if(new Set(results.map(row=>row.id)).size!==results.length)failures.push('Device results contain duplicate check IDs.');
  for(const check of checklist.checks) {
    const result=results.find(row=>row.id===check.id);
    const testedAt=typeof result?.testedAt==='string'?Date.parse(result.testedAt):NaN;
    if(result?.status!=='passed' || typeof result?.evidence!=='string' || !result.evidence.trim() || !Number.isFinite(testedAt) || testedAt>Date.now()+300000)failures.push(`Device check ${check.id} needs dated passing evidence from completed testing.`);
  }
  return {ok:failures.length===0,failures};
}
module.exports={validateDeviceEvidence};
