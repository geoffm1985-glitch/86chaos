import './restaurantPack.js';
import './foodSafety.shared.js';

const foodSafety = globalThis.__86ChaosFoodSafetyShared;
if (!foodSafety) throw new Error('86 Chaos foodSafety failed to initialize.');

export default foodSafety;
