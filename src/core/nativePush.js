import { Capacitor, registerPlugin } from '@capacitor/core';
import { createNativePushClient } from './nativePushClient.mjs';

// Use only the native bridge. The existing Firebase 10 web messaging path stays
// separate; this plugin's optional Firebase 12 web implementation is not loaded.
export const nativePush = createNativePushClient({
  getPlatform: () => Capacitor.getPlatform(),
  isAvailable: () => Capacitor.isPluginAvailable('FirebaseMessaging'),
  plugin: registerPlugin('FirebaseMessaging')
});
