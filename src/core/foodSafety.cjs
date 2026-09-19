'use strict';

require('./restaurantPack.cjs');
require('./foodSafety.shared.js');

const foodSafety = globalThis.__86ChaosFoodSafetyShared;
if (!foodSafety) throw new Error('86 Chaos foodSafety failed to initialize.');

module.exports = foodSafety;
