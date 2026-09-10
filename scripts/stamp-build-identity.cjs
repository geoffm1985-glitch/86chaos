'use strict';
const fs = require('fs');
const { captureSourceIdentity } = require('./86chaos-release-gate/source-identity.cjs');
const { files, ...identity } = captureSourceIdentity();
fs.writeFileSync('public/build-identity.json', JSON.stringify({ ...identity, buildTimestamp: new Date().toISOString(), certified: false }, null, 2) + '\n');
console.log(`Build ${identity.version}: source ${identity.sourceHash}, commit ${identity.commit || 'ZIP source'}`);
