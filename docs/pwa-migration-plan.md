# PWA Migration Plan — Yours, Watching

## Goal

Replace the iOS Capacitor native app with a Progressive Web App (PWA). The recipient installs it to their iPhone Home Screen and receives Web Push notifications at times configured in the admin.

## Confirmed feasibility

- **iOS 16.4+** supports Web Push for Home Screen PWAs (Safari engine)
- Standard Web Push / VAPID protocol — same as Android/desktop
- Notifications fire even when the app is closed (as long as installed to Home Screen)
- No Apple Developer account, no Xcode, no Configurator 2

## Architecture

```
Admin (Vercel)
  └─ Notification Scheduler UI → saves schedule to Supabase (notifications_schedule table)

Supabase Edge Function (cron, runs every minute)
  └─ reads due notifications → sends Web Push via VAPID → player's Service Worker

Player (PWA, iPhone Home Screen)
  └─ Service Worker receives push → displays iOS notification
  └─ On tap → opens app to the correct day/envelope
```

## Phases

### Phase 1 — Convert player to PWA

- [ ] Add `manifest.webmanifest` to `apps/player/public/`
  - name, short_name, icons (192×192, 512×512), display: standalone, theme_color, background_color
  - `start_url` pointing to the player root
- [ ] Add `service-worker.js` to `apps/player/public/`
  - `push` event handler: show notification with title, body, icon, data (url to open)
  - `notificationclick` event handler: open/focus the app at the correct route
- [ ] Register the service worker in `apps/player/src/main.jsx`
- [ ] Remove Capacitor dependency from `apps/player/package.json` and all Capacitor config files
- [ ] Deploy `apps/player` to Vercel (new project, separate from admin)

### Phase 2 — Web Push subscription

- [ ] On player first load (after user grants permission), call `pushManager.subscribe()` with the server's VAPID public key
- [ ] Store the push subscription object in Supabase `push_subscriptions` table (keyed by a device/user identifier)
- [ ] Add a "Enable notifications" prompt/button in the player UI

### Phase 3 — Admin notification scheduler UI

- [ ] Add a `Notifications` tab (or panel) in `apps/admin`
- [ ] For each day/envelope, allow the author to set:
  - Date + time the notification fires
  - Title (e.g. "Day 2 is here")
  - Body text (e.g. "Your envelope is waiting.")
- [ ] Save schedule rows to Supabase `notifications_schedule` table
  - columns: `id`, `day`, `envelope_id`, `fire_at` (timestamptz), `title`, `body`, `sent` (bool)

### Phase 4 — Server-side push sender

- [ ] Generate VAPID key pair (one-time, store public key in player env, private key in server env)
- [ ] Create a Supabase Edge Function (`send-scheduled-notifications`)
  - Runs on a cron trigger (every minute, or every 5 minutes)
  - Queries `notifications_schedule` where `fire_at <= now()` and `sent = false`
  - For each due notification, fetches all subscriptions from `push_subscriptions`
  - Sends Web Push using the `web-push` library (or manual VAPID signing in Deno)
  - Marks notification as `sent = true`
- [ ] Alternative: use the existing local `apps/admin/server/server.js` as the scheduler if Supabase Edge Functions are not preferred

### Phase 5 — Testing & cutover

- [ ] Test on a real iPhone (iOS 16.4+): install PWA to Home Screen, grant notification permission
- [ ] Verify push arrives when app is closed
- [ ] Verify notification tap opens correct day/envelope
- [ ] Confirm the old Capacitor build files can be archived (not deleted yet)

## Supabase schema additions

```sql
-- push subscriptions (one row per device)
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now()
);

-- notification schedule
create table notifications_schedule (
  id uuid primary key default gen_random_uuid(),
  day int,
  envelope_id text,
  fire_at timestamptz not null,
  title text not null,
  body text,
  sent boolean default false,
  created_at timestamptz default now()
);
```

## Open questions

1. **Vercel project for player** — should the player share the admin Vercel project or be a separate deployment?
2. **VAPID key storage** — VAPID private key needs to be a secret env var (Supabase secret or Vercel env). Confirm where the push sender runs.
3. **Single recipient vs multiple** — for now, push goes to all subscribed devices. Is that correct?
4. **iOS install prompt** — iOS does not show an "Add to Home Screen" banner automatically. We should add an in-app prompt with instructions.

## What gets removed

- `apps/player/ios/` directory (Xcode project, Capacitor iOS platform)
- Capacitor dependencies from `apps/player/package.json`
- iOS build steps from CLAUDE.md deployment workflow

## Status

- [x] Phase 1 — PWA shell (`manifest.webmanifest`, `sw.js`, `index.html` meta tags, SW registration in `main.jsx`)
- [x] Phase 2 — Push subscription (`usePushSubscription.js`, `NotificationPrompt` in `App.jsx`, `push_subscriptions` Supabase table)
- [x] Phase 3 — Admin Notifications tab (`apps/admin/src/App.jsx` — new section with schedule overview + title/body editor)
- [x] Phase 4 — Edge Function (`supabase/functions/send-scheduled-notifications/index.ts`) + SQL migration (`supabase/migrations/20260430_push_notifications.sql`)
- [ ] Phase 5 — One-time setup (VAPID keys, Supabase secrets, deploy Edge Function, run migration)
- [ ] Phase 5 — Real-device test on iPhone: install to Home Screen, grant permission, verify push arrives

## Remaining manual steps

1. `npx web-push generate-vapid-keys` — generate VAPID keys
2. Add `VITE_VAPID_PUBLIC_KEY` to Vercel env for `apps/player`
3. `supabase secrets set VAPID_SUBJECT=... VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=...`
4. Run `supabase/migrations/20260430_push_notifications.sql` against the project
5. `supabase functions deploy send-scheduled-notifications`
6. `supabase functions schedule send-scheduled-notifications --cron "* * * * *"`
7. Generate app icons: open `apps/player/public/icons/generate-icons.html` in a browser, save the canvases as `icon-192.png` and `icon-512.png`
8. Deploy `apps/player` to Vercel (new Vercel project, root = `apps/player`)
9. Have the recipient add the URL to their iPhone Home Screen
