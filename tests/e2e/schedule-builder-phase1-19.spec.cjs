'use strict';
const {test}=require('@playwright/test');
const {verifyEditingRecovery,verifyMoveCopy,verifyInterruptedSave,verifyLayoutAndKeyboard,verifyReviewedMonthRecovery}=require('../fixtures/schedule-builder-phase1-scenarios.cjs');
test('Phase 1 edits persist, no-op writes are avoided and deletion has safe Undo and Redo',verifyEditingRecovery);
test('Phase 1 drag and accessible reassignment preview copies and preserve original shifts',verifyMoveCopy);
test('Phase 1 interrupted saves require an explicit retry of the same operation',verifyInterruptedSave);
test('Phase 1 weekly headers, touch targets and keyboard focus preserve navigation',verifyLayoutAndKeyboard);
test('Phase 1 reviewed month clear preserves later shifts and supports authorized restoration',verifyReviewedMonthRecovery);
