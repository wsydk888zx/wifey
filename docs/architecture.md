# Workspace Architecture

The supported development workflow is a two-surface workspace:

- `apps/admin`: desktop/browser authoring workspace
- `apps/player`: player app for browser and native packaging
- `packages/story-core`: shared logic, constants, and formatting helpers
- `packages/story-content`: bundled story content that the player consumes in builds

In development, the admin local service can publish the current draft directly to the player app so
authoring and playback stay in sync without an export/import loop.

## Deployment topology

```
GitHub (main branch)
  │
  ├─► Vercel: wifey  (prj_9d9FqwIQB8S4z5JGCponKFkhXQxU)
  │     builds: apps/admin
  │     URL: wifey.vercel.app  (admin panel)
  │     env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (baked at build time)
  │         └─► Supabase (bxeoleynlmnhagveqrmn)
  │               ├── auth (admin login)
  │               ├── stories table (draft + published content)
  │               ├── story_versions table
  │               ├── player_state table
  │               └── player_responses table
  │
  └─► Vercel: wifey-player  (prj_7Rx0XM75xrhLLiQ9d18MUK0UThKd)
        builds: apps/player
        URL: wifey-player-wsydk888zxs-projects.vercel.app  (player PWA, iPhone Home Screen)
        env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_VAPID_PUBLIC_KEY
            └─► Supabase (same project)
                  ├── stories table (reads published story on startup)
                  ├── player_responses table (writes player choices)
                  └── push_subscriptions table (push notification subscription)

Local (author's machine only):
  apps/admin/server/server.js  — AI drafting endpoints (/api/card-draft, /api/envelope-draft)
  Start with: npm run ai:server --workspace @wifey/admin
```

**Key constraints:**
- Admin and player run on separate devices. No shared localStorage.
- Supabase config is baked into each bundle at **build time** — env-var changes require a redeploy.
- Push notifications: Supabase Edge Function (`send-scheduled-notifications`) runs on a cron and sends via Web Push to subscribed player instances.

## Rules

1. Treat `apps/admin` and `apps/player` as the only supported interactive surfaces.
2. Move shared logic into `packages/story-core` before copying UI into either app.
3. Keep admin-only code, AI endpoints, and editing controls out of the player app.
4. Keep packaged release content in `packages/story-content`; use live draft sync only for local development.
