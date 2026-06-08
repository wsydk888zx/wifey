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
  signal?: AbortSignal,
): Promise<{ ok: boolean; status?: number; body?: string }> {
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
      Urgency: 'high',
    },
    body,
    signal,
  });

  const ok = res.ok || res.status === 201;
  let errBody: string | undefined;
  if (!ok) { try { errBody = (await res.text()).slice(0, 140); } catch { /* ignore */ } }
  return { ok, status: res.status, body: errBody };
}

// ── Scheduling helpers ────────────────────────────────────────────────────────

const DEFAULT_OFFSET_MINUTES = 720; // 12h fallback when no cadence can be derived

// Transient = worth retrying; never prune these. Dead = permanently unusable; prune.
const TRANSIENT_STATUS = new Set([0, 408, 429, 500, 502, 503, 504]);
const DEAD_STATUS = new Set([403, 404, 410]);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Deliver to one subscription with a hard timeout + retry on transient failures.
async function deliverOne(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: string,
): Promise<{ status: number; ok: boolean; body?: string }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const r = await sendWebPush(sub, payload, controller.signal);
      clearTimeout(timer);
      if (r.ok) return { status: r.status ?? 201, ok: true };
      if (TRANSIENT_STATUS.has(r.status ?? 0) && attempt < 2) { await sleep(400 * (attempt + 1)); continue; }
      return { status: r.status ?? 0, ok: false, body: r.body };
    } catch (err) {
      clearTimeout(timer);
      if (attempt < 2) { await sleep(400 * (attempt + 1)); continue; }
      return { status: 0, ok: false, body: String(err).slice(0, 120) };
    }
  }
  return { status: 0, ok: false };
}

// Fan out to EVERY subscription in parallel. One slow/dead endpoint can never
// stall or skip another. Only permanently-dead endpoints are pruned.
async function sendToAll(
  subs: Array<{ endpoint: string; p256dh: string; auth: string }>,
  payloadObj: Record<string, unknown>,
): Promise<{ count: number; detail: string[] }> {
  const payload = JSON.stringify(payloadObj);
  const settled = await Promise.allSettled(subs.map((s) => deliverOne(s, payload)));
  let count = 0;
  const detail: string[] = [];
  const prune: string[] = [];
  settled.forEach((res, i) => {
    const tail = subs[i].endpoint.slice(-10);
    if (res.status === 'fulfilled') {
      const r = res.value;
      if (r.ok) count++;
      detail.push(`${tail}:${r.status}${r.body ? ' ' + r.body : ''}`);
      if (DEAD_STATUS.has(r.status)) prune.push(subs[i].endpoint);
    } else {
      detail.push(`${tail}:REJECTED`);
    }
  });
  if (prune.length) {
    await supabase.from('push_subscriptions').delete().in('endpoint', prune);
  }
  return { count, detail };
}

// ── Main handler ──────────────────────────────────────────────────────────────
//
// Pace-adaptive scheduling: each envelope's push fires at
//   (previous envelope's completed-at + offset)  — or the anchor, for the first —
//   + a global shift. An envelope is never notified until she has finished the one
//   before it, and never notified once she has already opened it. That makes bursts
//   structurally impossible: at most the single "next" envelope can ever be due.

Deno.serve(async () => {
  const now = new Date();

  // 1. Global controls (singleton row; missing => safe defaults / paused).
  const { data: settings } = await supabase
    .from('notification_settings')
    .select('paused, anchor_at, shift_minutes')
    .eq('id', 'main')
    .maybeSingle();
  const paused: boolean = settings?.paused ?? true;
  const shiftMs: number = (settings?.shift_minutes ?? 0) * 60_000;

  // 2. Published story.
  const { data: storyRow, error: storyError } = await supabase
    .from('stories')
    .select('days')
    .eq('is_published', true)
    .single();
  if (storyError || !storyRow) {
    return new Response('No published story', { status: 200 });
  }
  const days: any[] = storyRow.days ?? [];

  // 3. Her progress — completion timestamps from the singleton player_state.
  const { data: stateRow } = await supabase
    .from('player_state')
    .select('state')
    .eq('id', 'main')
    .maybeSingle();
  const completedAtMap: Record<string, string> =
    (stateRow?.state?.completedAtMap as Record<string, string>) ?? {};

  // 4. Subscriptions (also used to auto-anchor to her first subscribe).
  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth, created_at')
    .order('created_at', { ascending: true });
  const subs = subscriptions ?? [];

  // 5. Anchor: explicit admin override, else when she first subscribed.
  let anchorAt: Date | null = settings?.anchor_at ? new Date(settings.anchor_at) : null;
  if (!anchorAt && subs.length) anchorAt = new Date(subs[0].created_at);

  // 6. Ordered notifiable spine + each envelope's effective fire time.
  //
  // Two scheduling modes, decided per-envelope:
  //   ABSOLUTE — env.scheduledAt is set → fire at exactly that UTC time.
  //              Admin entered a clock time in the "Notification Time" field
  //              and it should mean what it says.
  //   PACE-ADAPTIVE — env.scheduledAt is null → fire at
  //              (previous completion + unlockOffsetMinutes), or at the anchor
  //              for the first envelope.
  // Either way, an envelope is never notified before she's finished the one
  // before it (prevents stacking and out-of-order alerts).
  type Node = { env: any; reachable: boolean; unlockAt: Date | null };
  const computed: Node[] = [];
  const envById: Record<string, any> = {};
  let prev: any = null;
  for (const day of days) {
    for (const env of (day.envelopes ?? [])) {
      if (!env?.id) continue;
      envById[env.id] = env;
      if (env.notify === false) continue; // silent/branch envelopes never notify or anchor

      let fireAt: Date | null = null;
      let reachable = false;
      const prevDone = prev ? !!completedAtMap[prev.id] : true;

      if (env.scheduledAt) {
        if (prevDone) {
          fireAt = new Date(env.scheduledAt);
          reachable = true;
        }
      } else {
        const offsetMin = (typeof env.unlockOffsetMinutes === 'number' && env.unlockOffsetMinutes > 0)
          ? env.unlockOffsetMinutes
          : DEFAULT_OFFSET_MINUTES;
        if (!prev) {
          fireAt = anchorAt;
          reachable = true;
        } else if (completedAtMap[prev.id]) {
          fireAt = new Date(new Date(completedAtMap[prev.id]).getTime() + offsetMin * 60_000);
          reachable = true;
        }
      }

      const unlockAt = fireAt ? new Date(fireAt.getTime() + shiftMs) : null;
      computed.push({ env, reachable, unlockAt });
      prev = env;
    }
  }

  type Outgoing = { kind: 'initial' | 'reminder'; envelopeId: string; title: string; body: string; reminderIndex?: number };
  const outgoing: Outgoing[] = [];

  // 7. Automatic initials + reminders (suppressed entirely while paused).
  if (!paused) {
    for (const node of computed) {
      const env = node.env;
      if (!node.reachable || !node.unlockAt) continue;
      if (completedAtMap[env.id]) continue;   // already opened — nothing to nudge
      if (node.unlockAt > now) continue;       // not time yet

      // Initial — once per envelope.
      const { data: sent } = await supabase
        .from('sent_notifications')
        .select('id')
        .eq('envelope_id', env.id)
        .maybeSingle();
      if (!sent) {
        outgoing.push({
          kind: 'initial',
          envelopeId: env.id,
          title: env.notificationTitle || 'Your Master',
          body: env.notificationBody || 'Your next envelope is waiting.',
        });
        continue; // don't also reminder on the same tick we first notify
      }

      // Reminder — only if configured and she still hasn't responded.
      if (!env.reminderIntervalMinutes) continue;
      const { data: response } = await supabase
        .from('player_responses')
        .select('id')
        .eq('envelope_id', env.id)
        .maybeSingle();
      if (response) continue;

      const { count: reminderCount } = await supabase
        .from('sent_reminders')
        .select('id', { count: 'exact', head: true })
        .eq('envelope_id', env.id);
      const alreadySent = reminderCount ?? 0;
      const maxCount: number = env.reminderMaxCount ?? 0;
      if (maxCount > 0 && alreadySent >= maxCount) continue;

      const intervalMs = env.reminderIntervalMinutes * 60_000;
      const nextReminderAt = new Date(node.unlockAt.getTime() + (alreadySent + 1) * intervalMs);
      if (nextReminderAt > now) continue;

      outgoing.push({
        kind: 'reminder',
        envelopeId: env.id,
        title: env.reminderTitle || env.notificationTitle || 'Your Master',
        body: env.reminderBody || 'You still have a choice waiting.',
        reminderIndex: alreadySent + 1,
      });
    }
  }

  // 8. One-shot admin commands (manual override — run even while paused).
  const { data: commands } = await supabase
    .from('notification_commands')
    .select('id, type, envelope_id')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  const results: string[] = [];

  if (!outgoing.length && !(commands?.length)) {
    return new Response(paused ? 'Paused — nothing sent' : 'Nothing due', { status: 200 });
  }

  // No devices: don't lose the queue to a later burst — just resolve commands.
  if (!subs.length) {
    if (commands?.length) {
      await supabase
        .from('notification_commands')
        .update({ status: 'done', result: 'no subscriptions', processed_at: new Date().toISOString() })
        .in('id', commands.map((c) => c.id));
    }
    return new Response('No subscriptions', { status: 200 });
  }

  // 9. Send automatic notifications.
  for (const note of outgoing) {
    const { count } = await sendToAll(subs, { title: note.title, body: note.body, url: '/' });
    if (note.kind === 'initial') {
      await supabase.from('sent_notifications').upsert(
        { envelope_id: note.envelopeId, title: note.title, body: note.body, sent_at: new Date().toISOString(), recipients: count },
        { onConflict: 'envelope_id' },
      );
    } else {
      await supabase.from('sent_reminders').insert({
        envelope_id: note.envelopeId,
        reminder_index: note.reminderIndex ?? 1,
        title: note.title,
        body: note.body,
        sent_at: new Date().toISOString(),
        recipients: count,
      });
    }
    results.push(`${note.kind}:${note.envelopeId} -> ${count}`);
  }

  // 10. Process one-shot commands.
  for (const cmd of (commands ?? [])) {
    const env = cmd.envelope_id ? envById[cmd.envelope_id] : null;
    if (cmd.type !== 'send_now' || !env) {
      await supabase.from('notification_commands')
        .update({ status: 'error', result: env ? 'unknown command' : 'envelope not found', processed_at: new Date().toISOString() })
        .eq('id', cmd.id);
      continue;
    }
    const { count, detail } = await sendToAll(subs, {
      title: env.notificationTitle || 'Your Master',
      body: env.notificationBody || 'Your next envelope is waiting.',
      url: '/',
    });
    await supabase.from('sent_notifications').upsert(
      { envelope_id: env.id, title: env.notificationTitle || 'Your Master', body: env.notificationBody || '', sent_at: new Date().toISOString(), recipients: count },
      { onConflict: 'envelope_id' },
    );
    await supabase.from('notification_commands')
      .update({ status: 'done', result: `sent to ${count} | ${detail.join(' ; ')}`.slice(0, 480), processed_at: new Date().toISOString() })
      .eq('id', cmd.id);
    results.push(`send_now:${env.id} -> ${count}`);
  }

  return new Response(results.join('\n') || 'OK', { status: 200 });
});
