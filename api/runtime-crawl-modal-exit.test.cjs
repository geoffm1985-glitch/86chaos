'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { newlyOpenedStateDialog, recoverExitedStateModal } = require('../tests/86chaos-release-gate/utils/exhaustive-ui-helpers.cjs');

function fixture(buttons, child = '') {
  const clicked = [];
  let open = true;
  const locator = rows => ({
    count: async () => rows.length,
    first: () => locator(rows.slice(0,1)),
    nth: index => locator(rows.slice(index,index+1)),
    isVisible: async () => rows.length > 0 && rows[0].visible !== false && open,
    isEnabled: async () => rows.length > 0 && rows[0].enabled !== false,
    click: async () => { clicked.push(rows[0].name); open = false; },
  });
  const modal = {
    ...locator([{name:'dialog'}]),
    getByRole: (role, {name}) => locator((role === 'button' ? buttons : role === 'tab' && child ? [{name:child}] : []).filter(row => name.test(row.name))),
    waitFor: async ({state}) => assert.equal(open, state !== 'hidden'),
  };
  return {clicked, page:{locator: () => ({first: () => modal}), evaluate:async () => {}}, isOpen:() => open};
}

test('runtime crawl closes the shared Modal through its titled accessible exit', async () => {
  const state = fixture([{name:'Close Publish a Training Manual'}, {name:'Publish Manual'}]);
  assert.equal(await recoverExitedStateModal(state.page, 'Onboarding'), false);
  assert.deepEqual(state.clicked, ['Close Publish a Training Manual']);
  assert.equal(state.isOpen(), false);
});

test('runtime crawl skips hidden and disabled duplicates before choosing a safe exit', async () => {
  const state = fixture([{name:'Cancel',visible:false}, {name:'Cancel',enabled:false}, {name:'Close Publish a Training Manual'}, {name:'Publish Manual'}]);
  await recoverExitedStateModal(state.page, 'Onboarding');
  assert.deepEqual(state.clicked, ['Close Publish a Training Manual']);
});

test('runtime crawl refuses a modal with only a publishing action', async () => {
  const state = fixture([{name:'Publish Manual'}]);
  await assert.rejects(recoverExitedStateModal(state.page, 'Onboarding'), /Cannot safely leave nested state modal/);
  assert.deepEqual(state.clicked, []);
  assert.equal(state.isOpen(), true);
});

test('runtime crawl keeps a requested child inside the modal open for auditing', async () => {
  const state = fixture([{name:'Close Publish a Training Manual'}], 'Details');
  assert.equal(await recoverExitedStateModal(state.page, 'Details'), true);
  assert.deepEqual(state.clicked, []);
  assert.equal(state.isOpen(), true);
});

test('a newly opened Add Special Event dialog proves the Event action completed', () => {
  assert.deepEqual(newlyOpenedStateDialog(/^Event$/i, [], [{title:'Add Special Event'}]), {title:'Add Special Event'});
  assert.deepEqual(newlyOpenedStateDialog('Event', [], [{title:'Edit Special Event'}]), {title:'Edit Special Event'});
});

test('an already open event dialog cannot prove a fresh click completed', () => {
  assert.equal(newlyOpenedStateDialog(/^Event$/i, [{title:'Add Special Event'}], [{title:'Add Special Event'}]), null);
});

test('unrelated dialogs and other state actions cannot masquerade as Event activation', () => {
  assert.equal(newlyOpenedStateDialog(/^Event$/i, [], [{title:'Add Certification'}]), null);
  assert.equal(newlyOpenedStateDialog('Drag Board', [], [{title:'Add Special Event'}]), null);
});

for (const [label, title] of [
  [
    "Edit Presets",
    "Manage Custom Shifts"
  ],
  [
    "Copy Month",
    "Auto-Populate Schedule"
  ],
  [
    "Publish Manual",
    "Publish a Training Manual"
  ],
  [
    "Assign Checklist",
    "Assign Onboarding Checklist"
  ],
  [
    "Add Certification",
    "Add Certification"
  ],
  [
    "Add Confidential Note",
    "Add Confidential Performance Note"
  ]
]) {
  test(label+' requires its own newly opened dialog before a click retry can be suppressed', () => {
    assert.deepEqual(newlyOpenedStateDialog(label, [], [{title}]), {title});
    assert.equal(newlyOpenedStateDialog(label, [{title}], [{title}]), null);
    assert.equal(newlyOpenedStateDialog(label, [], [{title:'Unrelated dialog'}]), null);
  });
}
