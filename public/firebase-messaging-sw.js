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

const firebaseConfig = self.location.hostname === 'app.86chaos.com' ? prodConfig : testConfig;

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Background message received', payload);
  const notificationTitle = payload.notification?.title || payload.data?.title || '86 Chaos Alert';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'You have a new notification.',
    icon: payload.webpush?.notification?.icon || '/app-icon.png',
    badge: payload.webpush?.notification?.badge || '/app-icon.png',
    data: {
      url: payload.fcmOptions?.link || payload.webpush?.fcmOptions?.link || payload.data?.url || '/'
    },
    requireInteraction: payload.data?.isCritical === 'true'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification?.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(urlToOpen).catch(() => {});
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(urlToOpen);
      return null;
    })
  );
});
