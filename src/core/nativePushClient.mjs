'use strict';

const normalizePermission = value => value === 'granted' || value === 'denied' ? value : 'default';

function withDeadline(task, timeoutMs = 30000) {
  let timer;
  return Promise.race([
    Promise.resolve().then(task),
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Notification registration timed out. Check your connection and try again.')), timeoutMs); })
  ]).finally(() => clearTimeout(timer));
}

function createNativePushClient({ getPlatform, isAvailable = () => true, plugin, timeoutMs = 30000 }) {
  const platform = () => ['android', 'ios'].includes(getPlatform()) ? getPlatform() : 'web';
  const requireNative = () => {
    if (platform() === 'web' || !isAvailable()) throw new Error('Native notifications are unavailable in this app build. Install the latest mobile version.');
  };
  const permission = async (request = false) => {
    requireNative();
    let result = await withDeadline(() => plugin.checkPermissions(), timeoutMs);
    if (request && normalizePermission(result.receive) === 'default') {
      result = await withDeadline(() => plugin.requestPermissions(), 120000);
    }
    return normalizePermission(result.receive);
  };
  return {
    platform,
    isNative: () => platform() !== 'web',
    permission,
    async connect({ requestPermission = false } = {}) {
      const receive = await permission(requestPermission);
      if (receive !== 'granted') return { permission: receive, token: null };
      if (platform() === 'android') await withDeadline(() => plugin.createChannel({ id: '86chaos-alerts', name: '86 Chaos alerts', description: 'Restaurant schedules, messages, and alerts', importance: 4, visibility: 0 }), timeoutMs);
      const result = await withDeadline(() => plugin.getToken(), timeoutMs);
      const token = String(result.token || '').trim();
      if (!token) throw new Error('The phone returned no notification token. Try reconnecting notifications.');
      return { permission: receive, token };
    },
    async listen({ onToken, onAction, onNotification }) {
      requireNative();
      const handles = [];
      try {
        handles.push(await plugin.addListener('tokenReceived', event => {
          const token = String(event?.token || '').trim();
          if (token) onToken?.(token);
        }));
        handles.push(await plugin.addListener('notificationActionPerformed', event => onAction?.(event?.notification || {})));
        handles.push(await plugin.addListener('notificationReceived', event => onNotification?.(event?.notification || {})));
      } catch (err) {
        await Promise.all(handles.map(handle => handle.remove()));
        throw err;
      }
      return () => Promise.all(handles.map(handle => handle.remove()));
    }
  };
}

export { createNativePushClient, normalizePermission, withDeadline };
