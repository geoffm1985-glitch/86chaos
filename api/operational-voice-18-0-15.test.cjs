'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { buildOperationalVoiceReview, voiceReviewBoundary, voiceReviewIsCurrent } = require('../src/core/operationalVoice.cjs');
test('operational voice reviews route to real review screens without creating mutations', () => {
  for (const [text,tab,focus] of [['review food safety','prep','checks'],['show my shift changes','published',undefined],['open receiving','inventory','invoices'],['review vendor aliases','inventory','invoices'],['review waste','inventory','waste'],['show readiness','today',undefined],['open station training','hr-training',undefined],['review pos recovery','settings',undefined]]) {
    const action = buildOperationalVoiceReview(text, () => true);
    assert.equal(action.tab, tab); assert.equal(action.focus, focus); assert.equal(action.intent, 'navigate'); assert.equal(action.reviewOnly, true); assert.equal(action.needsConfirmation, false);
  }
});
test('voice cannot turn consequential free text into an approval, closure, pay change or acknowledgment', () => {
  for (const phrase of ['acknowledge every shift','close all food safety problems','approve invoice 1','pay Bob less','review food safety and close everything','publish my changes']) assert.equal(buildOperationalVoiceReview(phrase, () => true), null);
});
test('operational voice review denies a route revoked for the current role', () => {
  assert.equal(buildOperationalVoiceReview('review food safety', () => false).blocked, true);
});
test('pending voice review expires and rejects tenant, actor, permission and feature changes', () => {
  const user = { id:'a',restaurantId:'r',permissions:{prep:true} }, features = { prep:true };
  const boundary = voiceReviewBoundary(user, features), action = { reviewBoundary:boundary, reviewCreatedAt:1000 };
  assert.equal(voiceReviewIsCurrent(action,boundary,1001), true);
  for (const changed of [{...user,id:'b'},{...user,restaurantId:'s'},{...user,permissions:{prep:false}}]) assert.equal(voiceReviewIsCurrent(action,voiceReviewBoundary(changed,features),1001),false);
  assert.equal(voiceReviewIsCurrent(action,voiceReviewBoundary(user,{prep:false}),1001),false);
  assert.equal(voiceReviewIsCurrent(action,boundary,121001),false); assert.equal(voiceReviewIsCurrent(action,boundary,999),false);
});
