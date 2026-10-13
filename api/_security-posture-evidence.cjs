'use strict';
async function readMfaEnrollment(app, user) {
  // Firestore profile flags are enrollment hints, never authentication proof.
  try {
    const uid=String(user.authUid||user.uid||user.id||'').trim();
    let account=uid?await app.auth().getUser(uid).catch(()=>null):null;
    if(!account&&user.email)account=await app.auth().getUserByEmail(user.email).catch(()=>null);
    if(!account)return{state:'unknown',enrolled:null};
    return{state:'verified-auth',enrolled:(account.multiFactor?.enrolledFactors||[]).length>0};
  }catch(_){return{state:'unknown',enrolled:null};}
}
function mfaCoverage({pairs,elevatedCount,userCount,userLimit=500,checkedLimit=200}) {
  const unknown=pairs.filter(row=>row.enrollment.state==='unknown').length;
  const missing=pairs.filter(row=>row.enrollment.enrolled===false).length;
  const complete=userCount<userLimit&&elevatedCount<=checkedLimit&&unknown===0;
  return{status:missing?'action-needed':complete?'verified-sample-clear':'unknown',checkedElevatedCount:pairs.length,unknownEnrollmentCount:unknown,missingEnrollmentCount:missing,complete,truncated:userCount>=userLimit||elevatedCount>checkedLimit,scope:'Bounded account enrollment evidence; enrollment is separate from API and Firebase-console enforcement.'};
}
function configurationEvidence({securityStatus={},projectId,appCheckEnforced,mfaEnforced}) {
  const rules=product=>({source:'recorded-deployment-evidence',status:securityStatus[`${product}RulesPublishedAt`]&&securityStatus[`${product}RulesSourceHash`]?'recorded-unverified':'unknown',publishedAt:securityStatus[`${product}RulesPublishedAt`]||'',sourceHash:securityStatus[`${product}RulesSourceHash`]||'',liveVerified:false});
  return{projectId,apiAppCheckEnforced:Boolean(appCheckEnforced),apiElevatedMfaEnforced:Boolean(mfaEnforced),firebaseConsoleAppCheckEnforcement:'unknown',firestoreRules:rules('firestore'),storageRules:rules('storage'),credentialExposureAudit:'not-proven-by-environment-presence',productionRestoreAcceptance:'requires-separate-verified-drill'};
}
module.exports={readMfaEnrollment,mfaCoverage,configurationEvidence};
