'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const babel=require('@babel/core'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const root=path.resolve(__dirname,'../..');
const source=fs.readFileSync(path.join(root,'src/features/schedule.jsx'),'utf8');
const ast=babel.parseSync(source,{sourceType:'module',babelrc:false,configFile:false,parserOpts:{plugins:['jsx']}});
const initializers=new Map();
function visit(node){if(!node||typeof node!=='object')return;if(node.type==='VariableDeclarator'&&node.id?.type==='Identifier'&&node.init)initializers.set(node.id.name,source.slice(node.init.start,node.init.end));for(const value of Object.values(node))if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);}
visit(ast);
function compile(name,context){const expression=initializers.get(name);if(!expression)throw Error('Production initializer missing: '+name);const code=babel.transformSync('('+expression+')',{babelrc:false,configFile:false,plugins:[require.resolve('@babel/plugin-transform-react-jsx')]}).code;return vm.runInNewContext(code,context,{filename:'schedule.jsx:'+name});}
const {requestSubjectLabel}=require('../../src/core/scheduleWarningControls.cjs');
const {requestOffDateKey}=require('../../src/core/requestOffRuntimeSafety.cjs');
function cardFixture({canManage=true,selected=[]}={}){
  let selectedIds=[...selected];const actions=[];
  const icon=()=>React.createElement('svg',{'aria-hidden':'true',width:14,height:14});
  const context={React,T:{row:'flex items-center p-3',muted:'text-slate-400',btnAlt:'min-h-[44px] min-w-[44px] p-2'},canManage,requestSubjectLabel,requestOffDateKey,formatDisplayDate:value=>value,formatShortTime:value=>value,formatClockDateTime:()=>'',Check:icon,X:icon,Trash2:icon,window:{confirm:()=>true},approveRequest:r=>actions.push(['approve',r.id]),denyRequest:r=>actions.push(['deny',r.id]),archiveRequest:r=>actions.push(['archive',r.id]),restoreRequest:r=>actions.push(['restore',r.id]),cancelRequest:r=>actions.push(['cancel',r.id]),setSelectedRequestIds:update=>{selectedIds=update(selectedIds);}};
  for(const name of ['normalizeStatus','isArchivedRequest','formatRequestDateLabel','formatRequestTimeLabel','formatRequestPartialRange'])context[name]=compile(name,context);
  Object.defineProperty(context,'selectedRequestIds',{get:()=>selectedIds});
  const Card=compile('RequestCard',context);
  return {render:r=>renderToStaticMarkup(React.createElement(Card,{r})),element:r=>Card({r}),actions,selected:()=>selectedIds};
}
function controls(element){const out=[];function walk(node){if(!React.isValidElement(node))return;if(node.type==='input'||node.type==='button')out.push(node);React.Children.forEach(node.props.children,walk);}walk(element);return out;}
function cardDocument(indexHtml,markup,baseURL){
  const rootElement=/<div\b[^>]*\bid=(["'])root\1[^>]*>\s*<\/div>/i;
  if(!rootElement.test(indexHtml))throw Error('Deployed app HTML must expose the empty root mount');
  // Preserve the actual page head, viewport, stylesheets, and Tailwind runtime.
  // Remove only the app bundle so an isolated card does not boot Firebase/Auth.
  const html=indexHtml.replace(/<script\b([^>]*)>[\s\S]*?<\/script>/gi,(tag,attributes)=>{
    const src=attributes.match(/\bsrc\s*=\s*(["'])(.*?)\1/i)?.[2];
    return src&&new URL(src,baseURL).pathname.startsWith('/static/js/')?'':tag;
  });
  return html.replace(rootElement,()=>'<div id="root"><main>'+markup+'</main></div>');
}
module.exports={cardFixture,controls,cardDocument};
