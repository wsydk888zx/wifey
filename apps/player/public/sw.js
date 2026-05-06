const CACHE = 'your-master-v1';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('push', (e) => {
  if (!e.data) return;

  let data = {};
  try {
    data = e.data.json();
  } catch {
    data = { title: 'Yours, Watching', body: e.data.text() };
  }

  const { title = 'Yours, Watching', body = '', url = '/' } = data;

  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url },
      requireInteraction: false,
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data?.url ?? '/';

  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(self.location.origin));
      if (existing) {
        existing.focus();
        existing.postMessage({ type: 'NAVIGATE', url });
      } else {
        self.clients.openWindow(url);
      }
    })
  );
});
