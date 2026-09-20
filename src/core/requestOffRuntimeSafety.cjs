'use strict';

// Keep Node consumers on the same browser-bundled implementation. CRA/Webpack 4
// emits directly imported .cjs files as static media, so React code must import
// the .shared.js module through requestOffRuntimeSafety.js instead.
module.exports = require('./requestOffRuntimeSafety.shared.js');
