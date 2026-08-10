'use strict';

require('./scheduleWarningControls.shared.js');

const scheduleWarningControls = globalThis.__86ChaosScheduleWarningControlsShared;

if (!scheduleWarningControls || typeof scheduleWarningControls.buildCoverageVarianceRows !== 'function' || typeof scheduleWarningControls.buildScheduleConflictWarningRows !== 'function') {
  throw new Error('86 Chaos schedule warning controls failed to initialize.');
}

module.exports = scheduleWarningControls;
