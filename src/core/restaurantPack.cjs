'use strict';

require('./restaurantPack.shared.js');

const restaurantPack = globalThis.__86ChaosRestaurantPackShared;
if (!restaurantPack) throw new Error('86 Chaos restaurantPack failed to initialize.');

module.exports = restaurantPack;
