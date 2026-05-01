# Ops Playbook — Recurring Issues & How to Fix Them

This document captures every issue that has recurred across multiple sessions, its root cause, and the exact fix. Update it whenever a new pattern emerges.

---

## 1. Admin login stops working

**Symptom:** Login screen shows, credentials fail, no obvious error.

**Root causes seen so far:**
- Supabase project was re-linked or keys rotated — `.env.local` has stale key
- Email confirmation required but not completed for the auth user
- Admin app crashes on render (JS error) before auth state resolves — shows blank or broken UI instead of clear error

**How to diagnose:**
```bash
# 1. Verify the anon key still works against Supabase
node -e "
const { createClient } = require('./node_modules/@supabase/supabase-js');
const c = createClient(process.env.VITE_SUPABASE_URL || 'YOUR_URL', 'YOUR_ANON_KEY');
c.auth.signInWithPassword({ email: 'YOUR_EMAIL', password: 'YOUR_PASS' })
  .then(({ error }) => console.log(error?.message || 'OK'));
"

# 2. Check for JS crashes in the admin UI
# Open admin locally, open DevTools → Console, look for red errors BEFORE login
npm run admin:dev

# 3. Check auth user exists & email is confirmed
# Go to: https://supabase.com/dashboard/project/bxeoleynlmnhagveqrmn/auth/users
# Both users must show as "Confirmed" (green checkmark)
```

**How to fix:**
| Cause | Fix |
|---|---|
| Key rotated / stale `.env.local` | Copy new anon key from Supabase dashboard → Settings → API. Update `.env.local` AND Vercel env vars for the admin project |
| Email not confirmed | Supabase dashboard → Auth → Users → click user → "Confirm email" button |
| JS crash pre-login | Run `npm run build --workspace @wifey/admin` — any broken imports/missing functions will surface as build errors. Fix those first |
| Supabase project reset | Re-run all migrations: `supabase db push`. Re-confirm auth users |

**Auth users for this project:**
- jondcarpenter@outlook.com (primary)
- Second account (backup)
- Both must show "Confirmed" in Supabase dashboard, not "Invited" or pending

---

## 2. Player app URL shows admin panel

**Symptom:** Opening the player URL shows the admin dashboard instead of the story experience.

**Root cause:** The `.vercel/output/` directory was committed to git. Vercel treats a committed `.vercel/output/` as a pre-built deployment and serves it verbatim, skipping the actual build. If that output was built from admin, the player URL serves admin.

**How to detect:**
```bash
# Check if .vercel/ is tracked
git ls-files .vercel/
# If any output is listed — that's the bug
```

**How to fix:**
```bash
# Remove from git tracking
git rm -r --cached .vercel/

# Confirm .vercel/ is in root .gitignore
grep ".vercel" .gitignore

# Commit the removal
git commit -m "fix: remove committed .vercel/output"

# Then manually deploy the player (Vercel won't auto-trigger properly)
mkdir -p .vercel && echo '{"projectId":"prj_7Rx0XM75xrhLLiQ9d18MUK0UThKd","orgId":"team_2ZGvGqwT3x8G87WEYTAkd4Ax"}' > .vercel/project.json
vercel --prod --yes
rm -rf .vercel/
```

**Prevention:** `.vercel/` is now in root `.gitignore`. Never run `git add -A` or `git add .` — always stage specific files.

---

## 3. Deployment doesn't include latest changes

**Symptom:** Git push succeeds but the live site shows old code.

**Root causes seen:**
- Pushing to the wrong Vercel project (root `wifey` project = admin; `wifey-player` project = player)
- Vercel's GitHub integration not set up for the player project
- Pre-built output in `.vercel/output/` bypassing the build (see issue #2)

**Two separate Vercel projects:**
| Project | Vercel ID | URL | Builds from |
|---|---|---|---|
| `wifey` (admin) | `prj_9d9FqwIQB8S4z5JGCponKFkhXQxU` | admin URL | `apps/admin` |
| `wifey-player` | `prj_7Rx0XM75xrhLLiQ9d18MUK0UThKd` | `wifey-player.vercel.app` | `apps/player` |

**How to deploy the player explicitly:**
```bash
# From repo root — set project link to wifey-player, deploy, then clean up
mkdir -p .vercel && echo '{"projectId":"prj_7Rx0XM75xrhLLiQ9d18MUK0UThKd","orgId":"team_2ZGvGqwT3x8G87WEYTAkd4Ax"}' > .vercel/project.json
vercel --prod --yes
rm -rf .vercel/
```

**How to deploy the admin explicitly:**
```bash
# From repo root — uses root-linked wifey project
vercel --prod --yes
```

---

## 4. Build fails after admin code changes (missing function / bad import)

**Symptom:** `npm run build --workspace @wifey/admin` fails with "X is not exported from Y".

**Root cause:** A refactor removed or renamed a function that's still imported elsewhere, OR changed a function signature (sync → async, different args) without updating all call sites.

**Critical functions that must stay in sync:**

| Function | File | Notes |
|---|---|---|
| `handleSaveDraft` | `apps/admin/src/App.jsx` | Referenced in ~8 UI buttons. Must exist. |
| `loadAdminDraft(supabase, defaultContent, defaultFlowMap)` | `supabaseStorage.js` | Now async, takes supabase as first arg |
| `saveAdminDraft(supabase, draft)` | `supabaseStorage.js` | Now async, takes supabase as first arg |
| `subscribeToPlayerState(supabase, callback)` | `supabaseStorage.js` | Takes supabase as first arg |

**How to check before committing:**
```bash
npm run build --workspace @wifey/admin
npm run build --workspace @wifey/player
# Both must succeed with zero errors before committing
```

---

## 5. Story content out of sync between admin and player

**Symptom:** Admin shows edited content; player shows old/wrong content.

**Root cause (old):** Content was bundled in `storyData.js` at build time. Admin edits to localStorage were never committed or were committed but the player didn't rebuild.

**Root cause (new, after centralization):** Supabase migration hasn't been applied, so the `stories` table doesn't exist. Player falls back to bundled `storyData.js`.

**Current architecture:**
1. Admin edits → auto-saves to Supabase `stories` table (draft)
2. Admin clicks Publish → sets `is_published = true`
3. Player fetches published story from Supabase on startup
4. Fallback: bundled `storyData.js` (snapshot from App-Story-Backup.json)

**If player shows wrong content:**
```bash
# 1. Check migration is applied
supabase db push  # if not applied yet

# 2. Check the stories table has a published row
# Supabase dashboard → Table Editor → stories → filter is_published = true

# 3. If no published story, open admin → make any edit → click Publish
```

---

## 6. Supabase migration not applied after schema changes

**Symptom:** Player shows fallback content; admin crashes trying to load from `stories` table; console shows "relation does not exist".

**Migration files:**
```
supabase/migrations/
  20260430_push_notifications.sql   — push_subscriptions, sent_notifications tables
  20260430_story_content_centralization.sql — stories, story_versions, player_state, player_responses tables
```

**How to apply:**
```bash
supabase login  # if not already logged in
supabase db push
# Confirm when prompted
```

---

## Deployment Checklist (run before every push)

```bash
# 1. Build both apps
npm run build --workspace @wifey/admin
npm run build --workspace @wifey/player

# 2. Confirm .vercel/ is not tracked
git ls-files .vercel/  # must be empty

# 3. Stage specific files (never git add -A)
git add apps/admin/src/... apps/player/src/... packages/...

# 4. Commit and push
git commit -m "..."
git push origin main

# 5. If player didn't auto-deploy, deploy it explicitly
mkdir -p .vercel && echo '{"projectId":"prj_7Rx0XM75xrhLLiQ9d18MUK0UThKd","orgId":"team_2ZGvGqwT3x8G87WEYTAkd4Ax"}' > .vercel/project.json
vercel --prod --yes
rm -rf .vercel/
```
