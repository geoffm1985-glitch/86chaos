'use strict';
const LABEL_PRESETS = Object.freeze({ legacy: { label: '3.5 × 1.1 inches (existing)', width: '3.5in', height: '1.1in' }, roll62: { label: '62 × 29 mm', width: '62mm', height: '29mm' }, small: { label: '2 × 1 inches', width: '2in', height: '1in' } });
function normalizeLabelSettings(settings = {}) {
  return { preset: LABEL_PRESETS[settings.preset] ? settings.preset : 'legacy',
    offsetX: Math.max(-5, Math.min(5, Number(settings.offsetX) || 0)), offsetY: Math.max(-5, Math.min(5, Number(settings.offsetY) || 0)) };
}
const labelPresetsShared = { LABEL_PRESETS, normalizeLabelSettings };

// One implementation for the browser and Node, using the existing shared-helper pattern.
(function publishLabelPresets(root) {
  if (!root) return;
  Object.defineProperty(root, '__86ChaosLabelPresetsShared', {
    value: labelPresetsShared,
    configurable: true,
    writable: true,
  });
})(typeof globalThis !== 'undefined' ? globalThis : undefined);
