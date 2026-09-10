'use strict';

require('./restaurantPack.cjs');
require('./posNormalization.shared.js');

const posNormalization = globalThis.__86ChaosPosNormalizationShared;
if (!posNormalization) throw new Error('86 Chaos posNormalization failed to initialize.');

module.exports = posNormalization;
