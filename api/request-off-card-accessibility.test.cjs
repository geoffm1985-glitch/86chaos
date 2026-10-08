'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {cardFixture,controls,cardDocument}=require('../tests/fixtures/request-off-card-fixture.cjs');
const pending={id:'pending-request',employeeName:'Allen QA',date:'2026-10-07',status:'pending'};
test('production pending Request Off card names its selection and approval controls by employee and date',()=>{
  const fixture=cardFixture();const rows=controls(fixture.element(pending));
  assert.deepEqual(rows.filter(row=>row.props['aria-label']).map(row=>row.props['aria-label']),['Select Request Off for Allen QA on 2026-10-07','Approve Request Off for Allen QA on 2026-10-07','Deny Request Off for Allen QA on 2026-10-07']);
  for(const button of rows.filter(row=>/^(Approve|Deny)/.test(row.props['aria-label']||''))){assert.equal(button.props.type,'button');assert.match(button.props.className,/min-h-\[44px\]/);assert.match(button.props.className,/min-w-\[44px\]/);}
});
test('named Request Off controls preserve selection and approval action dispatch',()=>{
  const fixture=cardFixture({selected:['another-request']});const rows=controls(fixture.element(pending));
  const selection=rows.find(row=>row.type==='input');selection.props.onChange({target:{checked:true}});assert.deepEqual(Array.from(fixture.selected()),['another-request',pending.id]);
  selection.props.onChange({target:{checked:false}});assert.deepEqual(Array.from(fixture.selected()),['another-request']);
  rows.find(row=>/^Approve/.test(row.props['aria-label']||'')).props.onClick();rows.find(row=>/^Deny/.test(row.props['aria-label']||'')).props.onClick();assert.deepEqual(fixture.actions,[['approve',pending.id],['deny',pending.id]]);
});
test('approved and archived manager cards do not expose pending approval actions',()=>{
  for(const status of ['approved','archived','processed','cancelled']){const fixture=cardFixture();const rows=controls(fixture.element({...pending,status}));assert(!rows.some(row=>/^(Approve|Deny)/.test(row.props['aria-label']||'')));const action=rows.find(row=>row.type==='button');action.props.onClick();assert.deepEqual(fixture.actions,[[status==='approved'?'archive':'restore',pending.id]]);}
});
test('employee cards retain cancellation without exposing manager selection or approvals',()=>{
  for(const status of ['pending','approved']){const fixture=cardFixture({canManage:false});const rows=controls(fixture.element({...pending,status}));assert.equal(rows.length,1);assert.match(rows[0].props['aria-label'],/^Cancel Request Off/);rows[0].props.onClick();assert.deepEqual(fixture.actions,[['cancel',pending.id]]);}
  const fixture=cardFixture({canManage:false});assert.equal(controls(fixture.element({...pending,status:'archived'})).length,0);
});
test('request control names remain distinct across employees and usable with missing legacy metadata',()=>{
  const fixture=cardFixture();const labels=[pending,{...pending,id:'second',employeeName:'Chuck QA'},{id:'legacy',status:'pending'}].map(row=>controls(fixture.element(row))[0].props['aria-label']);assert.equal(new Set(labels).size,3);assert(labels.every(label=>label&& !/undefined|null|Invalid Date/.test(label)));
});

test('isolated Request Off page retains real Tailwind, viewport and CSS while excluding only app startup scripts',()=>{
  const fs=require('node:fs'),path=require('node:path');
  const index=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8').replace('</head>','<link rel="stylesheet" href="/static/css/main.css"><script defer src="/static/js/main.js"></script><script defer src="/static/js/vendor.js"></script></head>');
  const html=cardDocument(index,cardFixture().render(pending),'https://testing.86chaos.com/');
  assert.match(html,/<script src="https:\/\/cdn\.tailwindcss\.com"><\/script>/);
  assert.match(html,/window\.tailwind\.config/);
  assert.match(html,/name="viewport"/);
  assert.match(html,/href="\/static\/css\/main\.css"/);
  assert.doesNotMatch(html,/<script[^>]+src="\/static\/js\//);
  assert.match(html,/Select Request Off for Allen QA/);
  assert.throws(()=>cardDocument('<html>No mount</html>','card','https://testing.86chaos.com/'),/root mount/);
});
