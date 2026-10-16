'use strict';
const {test}=require('../fixtures/emulator-navigation-test.cjs');
const {cleanupScenario,verifyEditingRecovery,verifyDeletionRecovery,verifyMoveCopy,verifyInterruptedSave,verifyLayoutAndKeyboard,verifyReviewedMonthRecovery,verifyServerReadFallback}=require('../fixtures/schedule-builder-phase1-scenarios.cjs');
test.afterEach(cleanupScenario);
test('Phase 1 edits persist, no-op writes are avoided and time edits have safe Undo and Redo',verifyEditingRecovery);

test('Phase 1 deletion is explicitly confirmed and safely restored with Undo and Redo',verifyDeletionRecovery);
test('Phase 1 drag and accessible reassignment preview copies and preserve original shifts',verifyMoveCopy);
test('Phase 1 interrupted saves require an explicit retry of the same operation',verifyInterruptedSave);
test('Phase 1 weekly headers, touch targets and keyboard focus preserve navigation',verifyLayoutAndKeyboard);
test('Phase 1 reviewed month clear preserves later shifts and supports authorized restoration',verifyReviewedMonthRecovery);
test('Phase 1 verifies complete weeks through the API when live snapshots stall and invalidates offline evidence',verifyServerReadFallback);

test('Local emulator reload acknowledges listener removal and restores authoritative scheduling', async ({page}) => {
  const {expectedFirebaseProject}=require('../../scripts/86chaos-firebase-target.cjs');
  test.skip(expectedFirebaseProject(process.env)!=='demo-86chaos','Local emulator transport lifecycle contract');
  const {openWorkspace}=require('../fixtures/schedule-builder-phase1-scenarios.cjs');
  const {drainEmulatorPage}=require('../fixtures/emulator-navigation.cjs');
  const {expect}=require('@playwright/test');
  const {dismissBlockingDialogs}=require('../86chaos-full-audit/utils/audit-helpers.cjs');
  await openWorkspace(page);
  for(let cycle=0;cycle<2;cycle++) {
    const proof=await drainEmulatorPage(page);
    expect(proof).toMatchObject({applicable:true,active:0,pending:0,failure:false});
    expect(proof.added).toBeGreaterThan(0);expect(proof.removed).toBeGreaterThan(0);
    await page.reload();await dismissBlockingDialogs(page);
    await expect(page.getByTestId('schedule-workspace')).toBeVisible();
    await expect(page.getByTestId('schedule-workspace').getByRole('status').first()).toContainText('Schedule loaded from the server');
  }
});
