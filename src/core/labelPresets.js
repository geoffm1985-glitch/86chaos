import './labelPresets.shared.js';

const labelPresets = globalThis.__86ChaosLabelPresetsShared;
if (!labelPresets) throw new Error('86 Chaos labelPresets failed to initialize.');

export default labelPresets;
