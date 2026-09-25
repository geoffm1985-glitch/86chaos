'use strict';
const {handler,json,method,requireContract:baseRequireContract,rejectMachineAuthorityOverrides,assertKeys}=require('../../_pos-bridge-route');
function requireContract(req){baseRequireContract(req);rejectMachineAuthorityOverrides(req);assertKeys(req.query||{},[]);}
const {getPosBridgeAdminApp:getAdminAppForRequest}=require('../../_pos-bridge-project');
const {verifyAccessToken,admitRate,constantIntersection}=require('../../_pos-bridge-auth');
const {BRIDGE_VERSION,APP_RELEASE,SUPPORTED_CONTRACT_VERSIONS,SERVER_CAPABILITIES,LIMITS}=require('../../_pos-bridge-config');
module.exports=handler(async(req,res)=>{method(req,['GET']);requireContract(req);const db=getAdminAppForRequest(req,{requireCredentials:true}).firestore();const auth=await verifyAccessToken(db,req);await admitRate(db,auth.claims.posInstallationId,'read');json(res,200,{ok:true,bridgeVersion:BRIDGE_VERSION,appRelease:APP_RELEASE,supportedContractVersions:SUPPORTED_CONTRACT_VERSIONS,minimumPosVersion:null,serverCapabilities:SERVER_CAPABILITIES,installationCapabilities:auth.installation.approvedCapabilities||[],effectiveCapabilities:constantIntersection(auth.installation.approvedCapabilities||[],auth.claims.capabilities||[]),deprecatedCapabilities:[],limits:{...LIMITS},serverTime:new Date().toISOString(),environment:auth.cfg.environment});});
