'use strict';
const {handler,json,readBoundedJson,method,requireContract:baseRequireContract,rejectMachineAuthorityOverrides,assertKeys}=require('../../_pos-bridge-route');
function requireContract(req){baseRequireContract(req);rejectMachineAuthorityOverrides(req);assertKeys(req.body||{},['contractVersion','posInstallationId','clientAssertion','capabilities']);}
const {consumeAssertionAndIssueToken}=require('../../_pos-bridge-auth');
const {getPosBridgeAdminApp:getAdminAppForRequest}=require('../../_pos-bridge-project');
module.exports=handler(async(req,res)=>{method(req,['POST']);const body=readBoundedJson(req);requireContract(req);const installationId=String(body.posInstallationId||'').trim();const assertion=String(body.clientAssertion||'').trim();if(!installationId||!assertion)throw Object.assign(new Error('Assertion required.'),{code:'invalid_request',statusCode:400});const db=getAdminAppForRequest(req,{requireCredentials:true}).firestore();const issued=await consumeAssertionAndIssueToken(db,{clientAssertion:assertion,installationId,requestedCapabilities:Array.isArray(body.capabilities)?body.capabilities:[]});json(res,200,{ok:true,...issued});});
