'use strict';
const checklist=require('../../test-tools/certification/device-acceptance.json');
function validateDeviceEvidence(evidence,identity) {
  const failures=[];
  if(!evidence || evidence.ok!==true)failures.push('Physical-device acceptance has not passed.');
  for(const key of ['version','sourceManifestHash','commit'])if(!identity?.[key] || evidence?.[key]!==identity[key])failures.push(`Device evidence ${key} does not match this release.`);
  if(!evidence?.device?.serial || !evidence?.device?.model || !evidence?.device?.androidVersion)failures.push('Connected Android device identity is missing.');
  if(!evidence?.artifact?.sha256 || !/^[a-f0-9]{64}$/i.test(evidence.artifact.sha256) || !evidence?.artifact?.packageName || !Number.isInteger(evidence?.artifact?.versionCode))failures.push('Installed Android artifact identity is missing.');
  const results=evidence?.results || [];
  if(new Set(results.map(row=>row.id)).size!==results.length)failures.push('Device results contain duplicate check IDs.');
  for(const check of checklist.checks) {
    const result=results.find(row=>row.id===check.id);
    if(result?.status!=='passed' || !result?.evidence || !Number.isFinite(Date.parse(result?.testedAt)))failures.push(`Device check ${check.id} needs dated passing evidence.`);
  }
  return {ok:failures.length===0,failures};
}
module.exports={validateDeviceEvidence};
