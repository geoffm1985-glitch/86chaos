'use strict';
// Execute the actual browser model in Node integration tests. Only module
// syntax is transformed; costing/ordering business logic is never duplicated.
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const babel=require('@babel/core');
module.exports=function loadRestaurantModel(name) {
  if(!['menuCosting','aiOrderAssistant'].includes(name))throw new Error('Unsupported restaurant integration model.');
  const root=path.resolve(__dirname,'../src/core'),filename=path.join(root,`${name}.js`);
  const code=babel.transformSync(fs.readFileSync(filename,'utf8'),{filename,babelrc:false,configFile:false,plugins:[require.resolve('@babel/plugin-transform-modules-commonjs')]}).code;
  const exports={};
  vm.runInNewContext(code,{exports,require:reference=>{if(!['./restaurantPack.js','./menuApproval.js'].includes(reference))throw new Error('Unexpected model dependency.');return require(path.join(root,reference.replace(/\.js$/,'.cjs')));},console},{filename});
  return exports;
};
