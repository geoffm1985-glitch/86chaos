'use strict';

require('./scheduleToolsPeriod.shared.js');

const scheduleToolsPeriod = globalThis.__86ChaosScheduleToolsPeriodShared;
if (!scheduleToolsPeriod || typeof scheduleToolsPeriod.deriveScheduleToolsPeriod !== 'function') {
  throw new Error('86 Chaos Schedule Tools period helpers failed to initialize.');
}

module.exports = scheduleToolsPeriod;

