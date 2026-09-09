import './restaurantPack.js';
import './vendorProductMemory.shared.js';

const vendorProductMemory = globalThis.__86ChaosVendorProductMemoryShared;
if (!vendorProductMemory) throw new Error('86 Chaos vendorProductMemory failed to initialize.');

export default vendorProductMemory;
