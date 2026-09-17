'use strict';
const {validateEvent}=require('./_pos-bridge-schema');
const {stageEvent,recordValidationFailureAttempt}=require('./_pos-bridge-storage');

const PERMANENT_REJECTIONS=new Set(['invalid_request','forbidden','invalid_access_token','installation_inactive','authority_changed']);
function successOutcome(receipt){return receipt?.deliveryOutcome==='duplicate'||receipt?.outcome==='duplicate'?'duplicate':'accepted';}
function unattempted(events,start,failedIndex,failedOutcome){return events.slice(start).map((event,offset)=>({index:start+offset,eventId:String(event?.eventId||''),outcome:'unattempted',attempted:false,retryable:failedOutcome==='retryable',blockedByIndex:failedIndex}));}
async function processEventBatch(db,authority,events,{stage=stageEvent,recordValidationFailure=recordValidationFailureAttempt}={}){
  const results=[];const receipts=[];
  for(let index=0;index<events.length;index+=1){const event=events[index];const validation=validateEvent(event);
    if(!validation.ok){let evidenceRecorded=true;try{await recordValidationFailure(db,authority);}catch(_){evidenceRecorded=false;}results.push({index,eventId:String(event?.eventId||''),outcome:'rejected',attempted:true,retryable:false,code:'invalid_request',validationErrors:validation.errors,evidenceRecorded});results.push(...unattempted(events,index+1,index,'rejected'));return {ok:false,partial:receipts.length>0,processingEnabled:false,financialReconciliation:'not-performed',failedIndex:index,results,receipts};}
    try{const receipt=await stage(db,authority,event);const outcome=successOutcome(receipt);results.push({index,eventId:event.eventId,outcome,attempted:true,retryable:false,receipt});receipts.push(receipt);}
    catch(error){const code=String(error?.code||'bridge_error');const outcome=code==='conflict'?'conflict':PERMANENT_REJECTIONS.has(code)?'rejected':'retryable';results.push({index,eventId:String(event?.eventId||''),outcome,attempted:true,retryable:outcome==='retryable',code:outcome==='retryable'?'bridge_error':code,...(outcome==='retryable'?{commitState:'unknown'}:{})});results.push(...unattempted(events,index+1,index,outcome));return {ok:false,partial:receipts.length>0,processingEnabled:false,financialReconciliation:'not-performed',failedIndex:index,results,receipts};}
  }
  return {ok:true,partial:false,processingEnabled:false,financialReconciliation:'not-performed',results,receipts};
}
module.exports={processEventBatch,successOutcome};
