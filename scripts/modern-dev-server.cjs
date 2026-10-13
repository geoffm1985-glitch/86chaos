'use strict';
function modernOptions(input,{routerFactory=()=>require('express').Router(),localOnly=false}={}) {
  const {onBeforeSetupMiddleware,onAfterSetupMiddleware,https,http2,setupMiddlewares,...options}=input;
  options.server=options.server || (https||http2?{type:http2?'spdy':'https',options:typeof https==='object'?https:{}}:'http');
  if(localOnly){options.host='127.0.0.1';options.allowedHosts=['127.0.0.1','localhost'];options.headers={...(options.headers||{}),'Access-Control-Allow-Origin':'http://127.0.0.1:3000'};}
  if(options.proxy&&!Array.isArray(options.proxy))options.proxy=Object.entries(options.proxy).map(([context,value])=>({context:[context],...(typeof value==='string'?{target:value}:value)}));
  options.setupMiddlewares=(middlewares,server)=>{
    if(!server?.app)throw new Error('The local development server is unavailable.');
    onBeforeSetupMiddleware?.(server);
    let result=setupMiddlewares?setupMiddlewares(middlewares,server):middlewares;
    if(!Array.isArray(result))throw new Error('Development middleware must remain ordered.');
    if(onAfterSetupMiddleware){
      const after=routerFactory();
      const app=new Proxy(server.app,{get(target,key){if(key==='use')return after.use.bind(after);return Reflect.get(target,key);}});
      onAfterSetupMiddleware({...server,app});
      result=[...result,{name:'86chaos-after-development-middleware',middleware:after}];
    }
    return result;
  };
  return options;
}
let installed=false;
function installModernDevServer(){
  if(installed)return;installed=true;
  const filename=require.resolve('react-scripts/config/webpackDevServer.config'),factory=require(filename);
  require.cache[filename].exports=(...args)=>modernOptions(factory(...args),{localOnly:process.env.REACT_APP_86CHAOS_YARDMASTER==='true'});
}
module.exports={modernOptions,installModernDevServer};
