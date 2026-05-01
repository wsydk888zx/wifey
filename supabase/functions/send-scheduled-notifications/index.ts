// Supabase Edge Function — fires scheduled push notifications
// Deploy: supabase functions deploy send-scheduled-notifications
// Schedule: supabase functions schedule send-scheduled-notifications --cron "* * * * *"
//
// Required secrets (set via: supabase secrets set KEY=value):
//   VAPID_SUBJECT   — mailto:you@example.com
//   VAPID_PUBLIC_KEY
//   VAPID_PRIVATE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// ── VAPID / Web Push helpers ──────────────────────────────────────────────────

function base64urlToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

function uint8ArrayToBase64url(arr: Uint8Array): string {
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function importVapidKeys() {
  const publicKey = base64urlToUint8Array(Deno.env.get('VAPID_PUBLIC_KEY')!);
  const privateKey = base64urlToUint8Array(Deno.env.get('VAPID_PRIVATE_KEY')!);

  const privateJwk = await crypto.subtle.importKey(
    'raw', privateKey,
    { name: 'ECDH', namedCurve: 'P-256' },
    true, ['deriveKey'],
  );
  const publicJwk = await crypto.subtle.importKey(
    'raw', publicKey,
    { name: 'ECDH', namedCurve: 'P-256' },
    true, [],
  );
  return { publicKey, publicJwk, privateJwk };
}

async function buildVapidJwt(audience: string): Promise<string> {
  const subject = Deno.env.get('VAPID_SUBJECT')!;
  const exp = Math.floor(Date.now() / 1000) + 12 * 3600;

  const header = uint8ArrayToBase64url(
    new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })),
  );
  const payload = uint8ArrayToBase64url(
    new TextEncoder().encode(JSON.stringify({ aud: audience, exp, sub: subject })),
  );
  const sigInput = new TextEncoder().encode(`${header}.${payload}`);

  const privateKey = base64urlToUint8Array(Deno.env.get('VAPID_PRIVATE_KEY')!);
  const signingKey = await crypto.subtle.importKey(
    'raw', privateKey,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, ['sign'],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signingKey, sigInput),
  );
  return `${header}.${payload}.${uint8ArrayToBase64url(sig)}`;
}

async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
): Promise<{ ok: boolean; status?: number }> {
  const url = new URL(subscription.endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const jwt = await buildVapidJwt(audience);
  const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY')!;

  // Encrypt the payload using Web Push Encryption (RFC 8291)
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const authBuffer = base64urlToUint8Array(subscription.auth);
  const p256dhBuffer = base64urlToUint8Array(subscription.p256dh);

  const serverKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey', 'deriveBits'],
  ) as CryptoKeyPair;

  const serverPublicKey = new Uint8Array(
    await crypto.subtle.exportKey('raw', serverKeyPair.publicKey),
  );

  const recipientKey = await crypto.subtle.importKey(
    'raw', p256dhBuffer, { name: 'ECDH', namedCurve: 'P-256' }, false, [],
  );

  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'ECDH', public: recipientKey }, serverKeyPair.privateKey, 256,
    ),
  );

  // HKDF for content encryption key and nonce
  const hkdfKey = await crypto.subtle.importKey('raw', sharedSecret, 'HKDF', false, ['deriveKey', 'deriveBits']);

  const prk = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: authBuffer, info: new TextEncoder().encode('Content-Encoding: auth\0') },
    hkdfKey, 256,
  ));

  const prkKey = await crypto.subtle.importKey('raw', prk, 'HKDF', false, ['deriveKey', 'deriveBits']);
  const keyInfo = buildInfo('aesgcm', p256dhBuffer, serverPublicKey);
  const nonceInfo = buildInfo('nonce', p256dhBuffer, serverPublicKey);

  const contentKey = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: keyInfo }, prkKey, 128,
  ));
  const nonce = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: nonceInfo }, prkKey, 96,
  ));

  const aesKey = await crypto.subtle.importKey('raw', contentKey, 'AES-GCM', false, ['encrypt']);
  const paddedPayload = new Uint8Array([0, 0, ...new TextEncoder().encode(payload)]);
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, paddedPayload));

  const body = buildEncryptedBody(salt, serverPublicKey, encrypted);

  const res = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `vapid t=${jwt},k=${vapidPublic}`,
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aesgcm',
      Encryption: `salt=${uint8ArrayToBase64url(salt)}`,
      'Crypto-Key': `dh=${uint8ArrayToBase64url(serverPublicKey)};p256ecdsa=${vapidPublic}`,
      TTL: '86400',
    },
    body,
  });

  return { ok: res.ok || res.status === 201, status: res.status };
}

function buildInfo(type: string, clientKey: Uint8Array, serverKey: Uint8Array): Uint8Array {
  const label = new TextEncoder().encode(`Content-Encoding: ${type}\0P-256\0`);
  const buf = new Uint8Array(label.length + 2 + clientKey.length + 2 + serverKey.length);
  let offset = 0;
  buf.set(label, offset); offset += label.length;
  new DataView(buf.buffer).setUint16(offset, clientKey.length, false); offset += 2;
  buf.set(clientKey, offset); offset += clientKey.length;
  new DataView(buf.buffer).setUint16(offset, serverKey.length, false); offset += 2;
  buf.set(serverKey, offset);
  return buf;
}

function buildEncryptedBody(salt: Uint8Array, serverKey: Uint8Array, ciphertext: Uint8Array): Uint8Array {
  const RS = 4096;
  const header = new Uint8Array(21 + serverKey.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, RS, false);
  header[20] = serverKey.length;
  header.set(serverKey, 21);
  const body = new Uint8Array(header.length + ciphertext.length);
  body.set(header, 0);
  body.set(ciphertext, header.length);
  return body;
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async () => {
  // Read story_content to find envelopes with scheduledAt + notify
  const { data: storyRow, error: storyError } = await supabase
    .from('story_content')
    .select('content')
    .eq('id', 'main')
    .single();

  if (storyError || !storyRow) {
    return new Response('No story content', { status: 200 });
  }

  const days: any[] = storyRow.content?.days ?? [];
  const now = new Date();

  // Collect all envelopes that should have fired by now and haven't been sent yet
  const due: Array<{ envelopeId: string; title: string; body: string; fireAt: Date }> = [];

  for (const day of days) {
    const envelopes: any[] = day.envelopes ?? [];
    for (const env of envelopes) {
      if (!env?.scheduledAt || env?.notify === false) continue;
      const fireAt = new Date(env.scheduledAt);
      if (fireAt > now) continue;

      // Check if already sent
      const { data: sent } = await supabase
        .from('sent_notifications')
        .select('id')
        .eq('envelope_id', env.id)
        .maybeSingle();

      if (sent) continue;

      due.push({
        envelopeId: env.id,
        title: env.notificationTitle || 'Yours, Watching',
        body: env.notificationBody || 'Your next envelope is waiting.',
        fireAt,
      });
    }
  }

  if (!due.length) {
    return new Response('Nothing due', { status: 200 });
  }

  // Fetch all push subscriptions
  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth');

  if (!subscriptions?.length) {
    return new Response('No subscriptions', { status: 200 });
  }

  const results: string[] = [];

  for (const notification of due) {
    const payload = JSON.stringify({
      title: notification.title,
      body: notification.body,
      url: '/',
    });

    let sentCount = 0;
    for (const sub of subscriptions) {
      const result = await sendWebPush(sub, payload);
      if (result.ok) sentCount++;
      // Remove stale subscriptions (gone/expired)
      if (result.status === 410 || result.status === 404) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      }
    }

    await supabase.from('sent_notifications').insert({
      envelope_id: notification.envelopeId,
      title: notification.title,
      body: notification.body,
      sent_at: new Date().toISOString(),
      recipients: sentCount,
    });

    results.push(`${notification.envelopeId}: sent to ${sentCount}`);
  }

  return new Response(results.join('\n'), { status: 200 });
});
