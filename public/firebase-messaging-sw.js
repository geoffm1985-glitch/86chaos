importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// 1. TEST DATABASE CONFIG (Sandbox)
const testConfig = {
  apiKey: "AIzaSyBIRGMeLnVE3w3i1WZJzurcp-LkeaNZ3hw",
  authDomain: "chaos-test-d1601.firebaseapp.com",
  projectId: "chaos-test-d1601",
  storageBucket: "chaos-test-d1601.firebasestorage.app",
  messagingSenderId: "534993379994",
  appId: "1:534993379994:web:9fefb6e10309223afe7523"
};

// 2. MAIN PRODUCTION DATABASE CONFIG (Live Data)
const prodConfig = {
  apiKey: "AIzaSyA0kkmRCqGNoB1LXKfuCNIl1JKDyQci9hA",
  authDomain: "cheers-34b8d.firebaseapp.com",
  projectId: "cheers-34b8d",
  storageBucket: "cheers-34b8d.firebasestorage.app",
  messagingSenderId: "762225019248",
  appId: "1:762225019248:web:3e142c9563e58ca762a7b5",
  measurementId: "G-JFZ6EZB0E3"
};

// 3. THE SMART BACKGROUND SWITCHER
const prodHosts = ['app.86chaos.com', '86chaos.com', 'www.86chaos.com'];
const firebaseConfig = prodHosts.includes(String(self.location.hostname || '').toLowerCase()) ? prodConfig : testConfig;

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

const recentNotificationKeys = new Map();
const RECENT_WINDOW_MS = 60 * 1000;

function cleanRecentNotificationKeys(now = Date.now()) {
  for (const [key, ts] of recentNotificationKeys.entries()) {
    if (now - ts > RECENT_WINDOW_MS) recentNotificationKeys.delete(key);
  }
}

function firstText(...values) {
  for (const value of values) {
    const text = String(value || '').trim();
    if (text) return text;
  }
  return '';
}

function buildNotificationKey(payload = {}, title = '', body = '') {
  const data = payload.data || {};
  return firstText(
    data.notificationTag,
    data.tag,
    data.reminderId && `personal-reminder:${data.reminderId}`,
    data.eventReminderId && `event-reminder:${data.eventReminderId}`,
    payload.messageId,
    `${title}:${body}`
  ).slice(0, 180);
}

function safeUrl(rawUrl = '/') {
  const fallback = '/';
  try {
    const url = new URL(String(rawUrl || fallback), self.location.origin);
    if (url.origin !== self.location.origin) return fallback;
    return `${url.pathname}${url.search}${url.hash}` || fallback;
  } catch (_) {
    return fallback;
  }
}

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);

  const data = payload.data || {};

  // If Firebase already received a notification payload, the browser/FCM layer displays it.
  // Showing it again here creates the duplicate Android notifications shown in testing.
  // Only manually display data-only/custom messages.
  if (payload.notification && data.chaosForceShow !== '1') return;

  const title = firstText(data.title, data.notificationTitle, payload.notification?.title, '86 Chaos');
  const body = firstText(data.body, data.notificationBody, payload.notification?.body, 'You have a new notification.');
  const tag = buildNotificationKey(payload, title, body);
  const now = Date.now();
  cleanRecentNotificationKeys(now);
  if (tag && recentNotificationKeys.has(tag)) return;
  if (tag) recentNotificationKeys.set(tag, now);

  const notificationOptions = {
    body,
    icon: firstText(data.icon, '/app-icon.png'),
    badge: firstText(data.badge, '/app-icon.png'),
    tag: tag || undefined,
    renotify: false,
    data: {
      url: safeUrl(firstText(data.click_action, data.url, data.link, '/?tab=today')),
      notificationTag: tag || ''
    }
  };

  self.registration.showNotification(title, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = safeUrl(event.notification?.data?.url || '/');
  event.waitUntil((async () => {
    const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of allClients) {
      try {
        const clientUrl = new URL(client.url);
        if (clientUrl.origin === self.location.origin) {
          await client.focus();
          if ('navigate' in client) await client.navigate(targetUrl);
          return;
        }
      } catch (_) {}
    }
    await clients.openWindow(targetUrl);
  })());
});
