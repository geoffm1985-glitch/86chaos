import './restaurantPack.js';
import './posNormalization.shared.js';

const posNormalization = globalThis.__86ChaosPosNormalizationShared;
if (!posNormalization) throw new Error('86 Chaos posNormalization failed to initialize.');

export default posNormalization;
