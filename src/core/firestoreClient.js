import { onSnapshot as sdkOnSnapshot } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { firebaseRuntimeTarget, firebaseEmulatorSettings } from './firebaseTarget';
import './emulatorSubscriptions.shared';

// Live/native exports retain the original SDK function. Local fault injection
// can release real watch targets without unmounting React or losing callbacks.
export const emulatorSubscriptionLifecycle = globalThis.__86ChaosEmulatorSubscriptionsShared.createEmulatorSubscriptions({
  target: firebaseRuntimeTarget,
  native: Capacitor.isNativePlatform(),
  projectId: firebaseEmulatorSettings.projectId,
  hostname: typeof window === 'undefined' ? '' : window.location.hostname,
  failClosed: firebaseRuntimeTarget === 'EMULATOR',
  subscribe: sdkOnSnapshot,
});
export const onSnapshot = emulatorSubscriptionLifecycle
  ? (...args) => emulatorSubscriptionLifecycle.subscribe(...args)
  : sdkOnSnapshot;
