'use strict';
const path=require('node:path');
const layoutOutputRoot=process.env.CHAOS_RELEASE_GATE_RUN_DIR || path.join(__dirname,'test-results');
module.exports={testDir:'./tests/layout',outputDir:path.join(layoutOutputRoot,'layout-smoke-artifacts'),timeout:30000,globalTimeout:180000,workers:1,use:{browserName:'chromium',headless:true},reporter:[['list']]};
