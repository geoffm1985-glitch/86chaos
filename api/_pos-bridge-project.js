'use strict';
const {getAdminAppForRequest}=require('./_firebase-project-admin');
function getPosBridgeAdminApp(_req,_options={},factory=getAdminAppForRequest){return factory({headers:{}},{requireCredentials:true});}
module.exports={getPosBridgeAdminApp};
