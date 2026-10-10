'use strict';
const fs=require('node:fs');
const path=require('node:path');

// Collection success means a report was written; it does not mean certification passed.
function finalGateOutcome(report,{runId,requireCertification=true}={}) {
  const failures=[];
  if(!report || typeof report!=='object')return {ok:false,failures:['Final report is missing or invalid.']};
  if(!runId || report.runId!==runId)failures.push('Final report belongs to a different run.');
  if(report.ok!==true || report.outcome!=='PASS')failures.push(report.primaryBlockingFailure || 'Final report did not pass.');
  if(requireCertification && report.fullReleaseCertified!==true)failures.push('Full release certification is incomplete.');
  for(const key of ['sourceIdentityValidation','deploymentIdentityValidation','mandatoryGroupValidation','certificationTruth','skipValidation'])if(report[key]?.ok!==true)failures.push(`${key} did not pass.`);
  const browser=report.playwright;
  if(!browser || !(browser.passed>0) || browser.failed!==0 || browser.timedOut!==0 || browser.unexpected!==0 || browser.blocked>0)failures.push('Passing browser execution evidence is missing.');
  return {ok:failures.length===0,failures};
}
module.exports={finalGateOutcome};
if(require.main===module) {
  const directory=process.argv[2],runId=process.argv[3];
  let outcome;
  try {
    const files=fs.readdirSync(directory).filter(file=>/^86chaos-play-store-release-gate-summary-.*\.json$/.test(file));
    if(files.length!==1)throw new Error('Expected exactly one final report.');
    outcome=finalGateOutcome(JSON.parse(fs.readFileSync(path.join(directory,files[0]),'utf8')),{runId,requireCertification:process.env.CHAOS_CERTIFICATION_MODE==='true'});
  }catch(error){outcome={ok:false,failures:[error.message]};}
  fs.writeFileSync(path.join(directory,'final-gate-outcome.json'),JSON.stringify(outcome,null,2));
  console.log(JSON.stringify(outcome));process.exitCode=outcome.ok?0:1;
}
