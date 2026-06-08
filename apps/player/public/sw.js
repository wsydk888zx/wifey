const CACHE = 'your-master-v2';

// Public client config (same values shipped in the app bundle — safe to embed).
// Used so the service worker can re-register a rotated subscription on its own,
// even when the app isn't open.
const SUPABASE_URL = 'https://bxeoleynlmnhagveqrmn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_u4dOAZClMuAmrueWQvY0mg_h5uOrv0T';
const VAPID_PUBLIC_KEY = 'BH2bT8IawBFDGiLIk2rTzQ685BOd2qOnB6hWWWT-U2t9c5ZD6606c_M7AcP6hSwdwjvykSPYtG9XPxpVliwHQuo';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function syncSubscription(sub) {
  if (!sub) return;
  try {
    const json = sub.toJSON();
    const keys = json.keys || {};
    await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({ endpoint: json.endpoint, p256dh: keys.p256dh, auth: keys.auth }),
    });
  } catch (_err) {
    // best effort
  }
}

// Always show SOMETHING for any received push. Never silently drop:
// if the payload is missing or can't be parsed, fall back to a generic message.
self.addEventListener('push', (e) => {
  let data = {};
  if (e.data) {
    try {
      data = e.data.json();
    } catch {
      try {
        data = { body: e.data.text() };
      } catch {
        data = {};
      }
    }
  }

  const title = data.title || 'Mine';
  const body = data.body || 'Your next envelope is waiting.';
  const url = data.url || '/';

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

// iOS/Safari rotates push subscriptions periodically. When that happens, the
// old endpoint goes dead — re-subscribe and re-register so delivery never lapses.
self.addEventListener('pushsubscriptionchange', (e) => {
  e.waitUntil(
    (async () => {
      try {
        const sub = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
        await syncSubscription(sub);
      } catch (_err) {
        // best effort
      }
    })()
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
