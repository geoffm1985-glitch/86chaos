'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {deletionRecordTime,deletionOverlayEvidence,deletionOverlayMatches,preferDeletionOverlay}=require('../src/core/scheduleDeletionOverlay.shared.js');
const original={id:'sw_reviewed',revision:2,createdAt:'2026-10-14T12:00:00Z',updatedAt:'2026-10-15T14:00:00Z'};
test('deletion overlay hides its cached revision but never hides either newer restoration',()=>{
  const marker=deletionOverlayEvidence(original);
  assert.equal(deletionOverlayMatches(original,marker),true);
  for(const revision of [4,6])assert.equal(deletionOverlayMatches({...original,revision},marker),false);
  assert.equal(deletionOverlayMatches({...original,revision:1},marker),true);
  assert.equal(marker.renderOnly,true);
});
test('updated and restored timestamps outrank retained creation time and survive JSON storage',()=>{
  const marker=JSON.parse(JSON.stringify(deletionOverlayEvidence(original)));
  assert.equal(deletionRecordTime(original),Date.parse(original.updatedAt));
  assert.equal(deletionOverlayMatches({...original,updatedAt:'2026-10-15T14:01:00Z'},marker),false);
  assert.equal(deletionOverlayMatches({...original,restoredAt:{seconds:Date.parse('2026-10-15T14:02:00Z')/1000}},marker),false);
  assert.equal(deletionOverlayMatches({...original,updatedAt:{toMillis:()=>Date.parse(original.updatedAt)}},marker),true);
});
test('obsolete storage events cannot replace a newer deletion fence with a longer expiry',()=>{
  const newer={...deletionOverlayEvidence({...original,revision:5}),expiresAt:10};
  const older={...deletionOverlayEvidence(original),expiresAt:99999};
  assert.equal(preferDeletionOverlay(newer,older),false);
  assert.equal(preferDeletionOverlay(older,newer),true);
  assert.equal(deletionOverlayMatches({...original,revision:6},newer),false);
});
test('old or malformed tombstones cannot hide a versioned restored record without source evidence',()=>{
  for(const marker of [{shiftId:original.id},{sourceShiftId:original.id,sourceRevision:null},{sourceShiftId:original.id,sourceRevision:NaN}])assert.equal(deletionOverlayMatches(original,marker),false);
  assert.equal(deletionOverlayMatches(original,null),false);
  assert.equal(deletionOverlayMatches({...original,revision:0},{sourceShiftId:original.id,sourceRecordTime:Date.parse(original.updatedAt)}),true);
});
