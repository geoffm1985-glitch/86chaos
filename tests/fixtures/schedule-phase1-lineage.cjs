'use strict';
const retiredTitle = 'Phase 1 edits persist, no-op writes are avoided and deletion has safe Undo and Redo';
const currentTitles = [
  'Phase 1 edits persist, no-op writes are avoided and time edits have safe Undo and Redo',
  'Phase 1 deletion is explicitly confirmed and safely restored with Undo and Redo',
];
function schedulePartitionFixture(specPath, project) {
  const identity = title => ({ specPath, title, exactTestTitle: title, leafTitle: title, fullSuitePath: '', fullTitle: title, project, projects: [project], stableKey: `${specPath}\u0000\u0000${title}\u0000${project}` });
  return {
    manifest: { selected: [{ ...identity(retiredTitle), priorStatus: 'failed', selectionReasons: ['previous_failure'] }] },
    currentRecords: currentTitles.map(identity),
  };
}
module.exports = { schedulePartitionFixture, retiredTitle, currentTitles };
