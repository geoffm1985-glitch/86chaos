'use strict';
const fs=require('node:fs'),path=require('node:path');
const yaml=require('js-yaml');
function workflowEvents(text) {
  const workflow=yaml.load(text);
  if(!workflow||typeof workflow!=='object')throw new Error('Invalid workflow configuration.');
  const events=workflow.on;
  return (typeof events==='string'?[events]:Array.isArray(events)?events:Object.keys(events||{})).sort();
}
function verifyManualWorkflows(root=path.resolve(__dirname,'..')) {
  const directory=path.join(root,'.github/workflows');
  const files=fs.readdirSync(directory).filter(file=>/\.ya?ml$/.test(file));
  for(const file of files){
    const events=workflowEvents(fs.readFileSync(path.join(directory,file),'utf8'));
    if(events.length!==1||events[0]!=='workflow_dispatch')throw new Error(`${file} contains an unapproved workflow trigger.`);
  }
  return files;
}
module.exports={workflowEvents,verifyManualWorkflows};
if(require.main===module){try{console.log('Manual-only workflows verified: '+verifyManualWorkflows().join(', '));}catch(error){console.error(error.message);process.exitCode=1;}}
