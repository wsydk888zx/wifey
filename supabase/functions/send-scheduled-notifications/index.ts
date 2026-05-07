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

  // EC private keys must be imported as JWK — raw format only works for public keys.
  // Reconstruct JWK from the raw private scalar + the uncompressed public key (04 || x || y).
  const privBytes = base64urlToUint8Array(Deno.env.get('VAPID_PRIVATE_KEY')!);
  const pubBytes = base64urlToUint8Array(Deno.env.get('VAPID_PUBLIC_KEY')!);
  const signingKey = await crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC', crv: 'P-256',
      d: uint8ArrayToBase64url(privBytes),
      x: uint8ArrayToBase64url(pubBytes.slice(1, 33)),
      y: uint8ArrayToBase64url(pubBytes.slice(33, 65)),
    },
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
  const enc = new TextEncoder();

  // RFC 8291 Web Push Message Encryption (aes128gcm)
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const authBuffer = base64urlToUint8Array(subscription.auth);
  const p256dhBuffer = base64urlToUint8Array(subscription.p256dh);

  // Ephemeral ECDH server key pair
  const serverKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'],
  ) as CryptoKeyPair;

  const serverPublicKey = new Uint8Array(
    await crypto.subtle.exportKey('raw', serverKeyPair.publicKey),
  ); // 65-byte uncompressed point

  const recipientKey = await crypto.subtle.importKey(
    'raw', p256dhBuffer, { name: 'ECDH', namedCurve: 'P-256' }, false, [],
  );

  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'ECDH', public: recipientKey }, serverKeyPair.privateKey, 256,
    ),
  );

  // RFC 8291 §3.3 — PRK = HKDF(salt=auth, IKM=sharedSecret, info="WebPush: info\0" || ua_public || as_public)
  const ikmKey = await crypto.subtle.importKey('raw', sharedSecret, 'HKDF', false, ['deriveBits']);
  const infoBytes = new Uint8Array([
    ...enc.encode('WebPush: info\0'),
    ...p256dhBuffer,    // ua_public (65 bytes)
    ...serverPublicKey, // as_public (65 bytes)
  ]);
  const prk = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: authBuffer, info: infoBytes },
    ikmKey, 256,
  ));

  // CEK (16 bytes) and nonce (12 bytes) via HKDF(salt=salt, IKM=prk, info=...)
  const prkKey = await crypto.subtle.importKey('raw', prk, 'HKDF', false, ['deriveBits']);
  const cek = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: enc.encode('Content-Encoding: aes128gcm\0') },
    prkKey, 128,
  ));
  const nonce = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: enc.encode('Content-Encoding: nonce\0') },
    prkKey, 96,
  ));

  // Encrypt: plaintext + 0x02 delimiter byte (single-record aes128gcm)
  const plaintext = new Uint8Array([...enc.encode(payload), 0x02]);
  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, plaintext),
  );

  // RFC 8291 §2 — body: salt(16) | rs(4 BE) | idlen(1) | keyid(65) | ciphertext
  const body = new Uint8Array(16 + 4 + 1 + 65 + ciphertext.length);
  let off = 0;
  body.set(salt, off); off += 16;
  new DataView(body.buffer).setUint32(off, 4096, false); off += 4; // rs = 4096
  body[off] = 65; off += 1;                                         // idlen
  body.set(serverPublicKey, off); off += 65;
  body.set(ciphertext, off);

  const res = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `vapid t=${jwt},k=${vapidPublic}`,
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      TTL: '86400',
    },
    body,
  });

  const body2 = await res.text().catch(() => '');
  return { ok: res.ok || res.status === 201, status: res.status };
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async () => {
  // Read the published story to find envelopes with scheduledAt + notify
  const { data: storyRow, error: storyError } = await supabase
    .from('stories')
    .select('days')
    .eq('is_published', true)
    .single();

  if (storyError || !storyRow) {
    return new Response('No published story', { status: 200 });
  }

  const days: any[] = storyRow.days ?? [];
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

  // Collect reminders due: envelopes with reminderAt set, choices not yet made, interval elapsed
  type ReminderDue = { envelopeId: string; title: string; body: string; reminderIndex: number };
  const dueReminders: ReminderDue[] = [];

  for (const day of days) {
    const envelopes: any[] = day.envelopes ?? [];
    for (const env of envelopes) {
      if (!env?.reminderAt || !env?.reminderIntervalMinutes) continue;
      const reminderStart = new Date(env.reminderAt);
      if (reminderStart > now) continue;

      // Skip if a choice has already been made for this envelope
      const { data: response } = await supabase
        .from('player_responses')
        .select('id')
        .eq('envelope_id', env.id)
        .maybeSingle();
      if (response) continue;

      // How many reminders have already been sent?
      const { count: sentCount } = await supabase
        .from('sent_reminders')
        .select('id', { count: 'exact', head: true })
        .eq('envelope_id', env.id);
      const alreadySent = sentCount ?? 0;

      // Respect max count (0 = unlimited)
      const maxCount: number = env.reminderMaxCount ?? 0;
      if (maxCount > 0 && alreadySent >= maxCount) continue;

      // Is the next reminder window due?
      const intervalMs = env.reminderIntervalMinutes * 60 * 1000;
      const nextFireAt = new Date(reminderStart.getTime() + alreadySent * intervalMs);
      if (nextFireAt > now) continue;

      dueReminders.push({
        envelopeId: env.id,
        title: env.reminderTitle || env.notificationTitle || 'Your Master',
        body: env.reminderBody || 'You still have a choice waiting.',
        reminderIndex: alreadySent + 1,
      });
    }
  }

  const allDue = [...due.map(n => ({ ...n, type: 'initial' as const })),
                  ...dueReminders.map(r => ({ ...r, type: 'reminder' as const }))];

  if (!allDue.length) {
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

  for (const notification of allDue) {
    const payload = JSON.stringify({
      title: notification.title,
      body: notification.body,
      url: '/',
    });

    let sentCount = 0;
    for (const sub of subscriptions) {
      try {
        const result = await sendWebPush(sub, payload);
        if (result.ok) sentCount++;
        if (result.status === 410 || result.status === 404) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        }
      } catch (_err) {
        // skip failed subscription
      }
    }

    if (notification.type === 'initial') {
      await supabase.from('sent_notifications').insert({
        envelope_id: notification.envelopeId,
        title: notification.title,
        body: notification.body,
        sent_at: new Date().toISOString(),
        recipients: sentCount,
      });
    } else {
      await supabase.from('sent_reminders').insert({
        envelope_id: notification.envelopeId,
        reminder_index: (notification as ReminderDue).reminderIndex,
        title: notification.title,
        body: notification.body,
        sent_at: new Date().toISOString(),
        recipients: sentCount,
      });
    }

    results.push(`${notification.type}:${notification.envelopeId}: sent to ${sentCount}`);
  }

  return new Response(results.join('\n'), { status: 200 });
});
