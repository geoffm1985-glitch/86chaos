'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('route cleanup releases only zero-subscriber listeners and preserves cache evidence',()=>{const core=read('src/core/appCore.js');assert.match(core,/export const releaseAbandonedRouteListeners/);assert.match(core,/Number\(entry\.subscribers\?\.size \|\| 0\) === 0/);assert.match(core,/route-change-zero-subscribers/);assert.match(core,/cache: true/);assert.match(core,/lastRouteCleanup/)});
test('App invokes bounded route cleanup after prior route hooks unsubscribe',()=>{const app=read('src/App.js');assert.match(app,/releaseAbandonedRouteListeners\(\{/);assert.match(app,/route: activeTabState/);assert.match(app,/setTimeout\(\(\) => \{/);assert.match(app,/\[activeTabState, firebaseConfig\?\.projectId, rId, authenticatedUid\]/)});
test('workspace and user boundary changes clear prior tenant listeners',()=>{const app=read('src/App.js');assert.match(app,/listenerCacheBoundaryRef/);assert.match(app,/previousProjectId, previousRestaurantId, previousViewerUid/);assert.match(app,/clearTenantListenerCache\(\{/);assert.match(app,/viewerUid: previousViewerUid/)});
test('listener diagnostics stay aggregate and expose duplicate/read amplification inputs',()=>{const core=read('src/core/appCore.js');assert.match(core,/documentsReceivedInitial/);assert.match(core,/documentsReceivedChanges/);assert.match(core,/listenerReuseCount/);assert.match(core,/consumerLabels/);assert.doesNotMatch(read('src/core/firebaseCostDiagnostics.cjs'),/\bdata\s*:/)});
