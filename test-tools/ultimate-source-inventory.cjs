'use strict';
const fs=require('fs');
const path=require('path');
const parser=require('@babel/parser');
const traverse=require('@babel/traverse').default;

function walk(dir,pred){const out=[];if(!fs.existsSync(dir))return out;for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory()&&!['node_modules','build','coverage','.git'].includes(e.name))out.push(...walk(p,pred));else if(e.isFile()&&pred(p))out.push(p);}return out;}
function rel(root,p){return path.relative(root,p).replace(/\\/g,'/');}
function literalText(node){if(!node)return'';if(node.type==='StringLiteral')return node.value;if(node.type==='JSXText')return node.value.trim();if(node.type==='JSXExpressionContainer'&&node.expression?.type==='StringLiteral')return node.expression.value;return'';}
function attr(opening,name){const a=(opening.attributes||[]).find(x=>x.type==='JSXAttribute'&&x.name?.name===name);if(!a)return'';if(!a.value)return'true';return literalText(a.value)|| (a.value.type==='JSXExpressionContainer'&&a.value.expression?.type==='StringLiteral'?a.value.expression.value:'');}
function functionName(pathNode,file){const n=pathNode.node;const parent=pathNode.parentPath?.node;if(n.id?.name)return n.id.name;if(parent?.type==='VariableDeclarator'&&parent.id?.type==='Identifier')return parent.id.name;if(parent?.type==='ObjectProperty'&&(parent.key?.name||parent.key?.value))return String(parent.key.name||parent.key.value);if(n.key?.name||n.key?.value)return String(n.key.name||n.key.value);return `<anonymous@${file}:${n.loc?.start?.line||0}>`;}

function analyze(root=process.cwd()){
 const srcFiles=walk(path.join(root,'src'),p=>/\.(?:js|jsx|mjs|cjs)$/.test(p));
 const apiFiles=walk(path.join(root,'api'),p=>/\.js$/.test(p)&&!path.basename(p).startsWith('_')&&!/\.(test|spec)\./.test(p));
 const testFiles=walk(path.join(root,'tests'),p=>/\.(?:spec|test)\.cjs$/.test(p)).concat(walk(path.join(root,'api'),p=>/\.(?:spec|test)\.cjs$/.test(p)));
 const inventory={root,sourceFiles:[],apiHandlers:apiFiles.map(p=>rel(root,p)),testFiles:testFiles.map(p=>rel(root,p)),functions:[],interactiveControls:[],eventHandlers:[],forms:[],mathExpressions:[],parseErrors:[],focusedTests:[]};
 for(const p of srcFiles){const file=rel(root,p);const code=fs.readFileSync(p,'utf8');let ast;try{ast=parser.parse(code,{sourceType:'unambiguous',plugins:['jsx','optionalChaining','nullishCoalescingOperator','classProperties','objectRestSpread','dynamicImport','topLevelAwait']});}catch(err){inventory.parseErrors.push({file,error:err.message});continue;}let fns=0,controls=0,events=0,forms=0;
  traverse(ast,{
   BinaryExpression(pth){if(['+','-','*','/','%','**'].includes(pth.node.operator))inventory.mathExpressions.push({file,line:pth.node.loc?.start?.line||0,kind:'binary',operator:pth.node.operator});},
   CallExpression(pth){const c=pth.node.callee;if(c?.type==='MemberExpression'&&c.object?.type==='Identifier'&&c.object.name==='Math')inventory.mathExpressions.push({file,line:pth.node.loc?.start?.line||0,kind:'Math',operator:c.property?.name||c.property?.value||'call'});},
   Function(pathNode){fns++;inventory.functions.push({file,name:functionName(pathNode,file),line:pathNode.node.loc?.start?.line||0,async:Boolean(pathNode.node.async)});},
   JSXOpeningElement(pth){const n=pth.node;const tag=n.name?.type==='JSXIdentifier'?n.name.name:'';const props=(n.attributes||[]).filter(a=>a.type==='JSXAttribute').map(a=>a.name?.name).filter(Boolean);const eventProps=props.filter(x=>/^on[A-Z]/.test(x));if(eventProps.length){events+=eventProps.length;for(const ev of eventProps)inventory.eventHandlers.push({file,line:n.loc?.start?.line||0,tag,event:ev,testId:attr(n,'data-testid'),ariaLabel:attr(n,'aria-label')});}
    if(tag==='form') {forms++;inventory.forms.push({file,line:n.loc?.start?.line||0,onSubmit:props.includes('onSubmit')});}
    if(['button','a','input','select','textarea'].includes(tag)||props.includes('onClick')||attr(n,'role')){controls++;const parent=pth.parentPath?.node;const childText=parent?.children?.map(literalText).filter(Boolean).join(' ').replace(/\s+/g,' ').trim().slice(0,180)||'';inventory.interactiveControls.push({file,line:n.loc?.start?.line||0,tag,role:attr(n,'role'),type:attr(n,'type'),ariaLabel:attr(n,'aria-label'),title:attr(n,'title'),placeholder:attr(n,'placeholder'),testId:attr(n,'data-testid'),childText,eventProps});}
   }
  });
  inventory.sourceFiles.push({file,functions:fns,interactiveControls:controls,eventHandlers:events,forms});
 }
 for(const p of testFiles){const code=fs.readFileSync(p,'utf8');if(/\b(?:test|it|describe)\.only\s*\(/.test(code))inventory.focusedTests.push(rel(root,p));}
 inventory.totals={sourceFiles:inventory.sourceFiles.length,apiHandlers:inventory.apiHandlers.length,testFiles:inventory.testFiles.length,functions:inventory.functions.length,interactiveControls:inventory.interactiveControls.length,eventHandlers:inventory.eventHandlers.length,forms:inventory.forms.length,mathExpressions:inventory.mathExpressions.length,parseErrors:inventory.parseErrors.length,focusedTests:inventory.focusedTests.length};
 return inventory;
}
if(require.main===module){const inv=analyze(process.cwd());const out=process.argv[2]||path.join(process.cwd(),'test-results','86chaos-ultimate-source-inventory.json');fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(inv,null,2));console.log(JSON.stringify(inv.totals,null,2));console.log(`Wrote ${out}`);if(inv.parseErrors.length||inv.focusedTests.length)process.exitCode=1;}
module.exports={analyze};
