# Ops Playbook — Recurring Issues & How to Fix Them

This document captures every issue that has recurred across multiple sessions, its root cause, and the exact fix. Update it whenever a new pattern emerges.

---

## 1. Admin login stops working

**Symptom:** Login screen shows, credentials fail, no obvious error.

**Root causes seen so far:**
- Supabase project was re-linked or keys rotated — `.env.local` has stale key
- Email confirmation required but not completed for the auth user
- Admin app crashes on render (JS error) before auth state resolves — shows blank or broken UI instead of clear error

**Error message decoder — what Supabase actually returns:**

| What you see in the UI / console | What it means | Where to look |
|---|---|---|
| `Invalid login credentials` | Wrong password OR the user doesn't exist at all. Supabase intentionally returns the same message for both to prevent user enumeration. | Supabase dashboard → Auth → Users — confirm `jondcarpenter@outlook.com` is listed and "Confirmed". If the user exists and is confirmed, the password is wrong. |
| `Email not confirmed` | User was created but never confirmed (or was reset). | Dashboard → Auth → Users → click user → "Confirm email" button. |
| `User not found` | Extremely rare — only appears if the auth schema is in a bad state. Should not happen on this project. | Re-check which Supabase project `.env.local` points to (wrong project = wrong user list). |
| Login form does nothing / spinner hangs | The Supabase client is `null` — env vars missing at build time (§7 problem, not §1). | Open DevTools → Console and look for `[admin] Supabase env vars missing`. See §7. |
| Red "Configuration error" banner instead of login form | Same as above — `SUPABASE_CONFIG_MISSING = true` at build time. | See §7. |
| `Failed to fetch` / network error on login submit | CORS mismatch, wrong Supabase URL, or Supabase project paused. | DevTools → Network → login request URL. Should be `https://bxeoleynlmnhagveqrmn.supabase.co/auth/v1/token`. If it's a different URL, §7 env-var problem. If correct URL but 503, the Supabase project may be paused — log in to supabase.com to resume it. |

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

**How to deploy (preferred — use the deploy script):**
```bash
npm run deploy -- player   # deploy player only
npm run deploy -- admin    # deploy admin only
npm run deploy -- both     # deploy both + smoke check
```

The script runs preflight, sets the correct Vercel project link, deploys, cleans up, and runs a smoke check automatically.

**Manual fallback if the script isn't available:**
```bash
# Player
mkdir -p .vercel && echo '{"projectId":"prj_7Rx0XM75xrhLLiQ9d18MUK0UThKd","orgId":"team_2ZGvGqwT3x8G87WEYTAkd4Ax"}' > .vercel/project.json
vercel --prod --yes
rm -rf .vercel/

# Admin
vercel --prod --yes  # uses root-linked wifey project
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

**Quick import audit** (run if you're unsure whether all exports still exist):
```bash
# List every export from supabaseStorage.js
grep "^export" apps/admin/src/supabaseStorage.js

# List every import App.jsx takes from supabaseStorage.js
grep -A 30 "from './supabaseStorage.js'" apps/admin/src/App.jsx
```
Cross-check: every name in the App.jsx import block must appear in the export list. As of 2026-05-01, the full export list is:
`MAX_ADMIN_SNAPSHOTS`, `normalizeAdminTweaks`, `createDefaultAdminTweaks`, `createDefaultAdminDraft`, `loadAdminDraft`, `saveAdminDraft`, `publishStory`, `getStoryVersions`, `rollbackToVersion`, `createAdminSnapshot`, `downloadAdminExport`, `parseAdminImport`, `createAdminExport`, `createAdminPreviewPayload`, `subscribeToPlayerState`, `loadPublishedStory`, `clearAdminDraftStorage`, `createDraftFingerprint`.

The Vite build will also catch any missing exports as a hard error — so `npm run build --workspace @wifey/admin` is the definitive check.

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

## 7. Admin login broken after deploy ⚠️ HIGH FREQUENCY

**Symptom:** Login screen shows on the deployed admin URL, credentials fail or do nothing, no obvious error in the UI. Worked locally five minutes ago. Has happened on nearly every admin deploy.

**Root cause (the one that's actually been hitting us):** Admin Supabase config is baked into the bundle at **build time** via `import.meta.env.VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` ([apps/admin/src/App.jsx:60](../apps/admin/src/App.jsx)). Vite reads those from:

- **Locally:** `apps/admin/.env.local` (gitignored, never reaches Vercel).
- **On Vercel:** the project's Environment Variables in the dashboard.

If the Vercel `wifey` project's env vars are missing, stale, or pointed at a different Supabase project than your local, every deploy ships a bundle whose Supabase client is `null` (or wired to the wrong project). The login form then fails silently because `supabase.auth.signInWithPassword` either throws on null or hits the wrong backend.

**Always check this FIRST.** Don't go hunting for "is the user confirmed?" or "is the password right?" — those are §1 problems, not §7 problems.

**Diagnostic — 60 seconds:**

1. Open the deployed admin URL. If you see the red **"Configuration error"** banner instead of the login form, env vars are missing — skip to fix.
2. Otherwise, open DevTools → Console immediately on page load. If you see `[admin] Supabase env vars missing at build time...` — same answer, env vars missing.
3. If neither shows but login still fails, the env vars are *present but wrong* (pointing at a different Supabase project, or stale anon key). Open DevTools → Network → submit login → inspect the request URL. If it's not `https://bxeoleynlmnhagveqrmn.supabase.co/...`, the URL is wrong.

**Fix:**

```bash
# 1. Confirm what local has
cat apps/admin/.env.local

# 2. List Vercel env vars on the admin project
vercel env ls production --scope <team> --cwd apps/admin
# (or use the dashboard: vercel.com → wifey project → Settings → Environment Variables)

# 3. If missing or different, set them
vercel env add VITE_SUPABASE_URL production --scope <team> --cwd apps/admin
vercel env add VITE_SUPABASE_ANON_KEY production --scope <team> --cwd apps/admin

# 4. Redeploy — env-var changes do NOT propagate to existing deployments
vercel --prod --yes --cwd apps/admin
```

**Prevention:**

- A fail-loud guard now lives in `App.jsx` (red banner + console error) so this surfaces in 5 seconds instead of an hour. Do not remove it.
- Phase B of `docs/deployment-process-review.md` adds a pre-deploy `scripts/deploy.sh` that diffs `.env.local` against Vercel env vars and aborts if they don't match.
- Whenever Supabase keys rotate, update **both** `apps/admin/.env.local` AND the Vercel `wifey` project env vars in the same change.

---

## Deployment Checklist (run before every push)

```bash
# 1. Stage specific files (never git add -A)
git add apps/admin/src/... apps/player/src/... packages/...

# 2. Commit and push
# The pre-push hook (scripts/preflight.sh) runs both builds + .vercel/ check automatically.
git commit -m "..."
git push origin main

# 3. Deploy via the script (preflight + vercel + smoke check built in)
npm run deploy -- player   # or admin, or both
```

If `git push` is rejected by the pre-push hook, fix the build error before pushing — don't use `--no-verify` unless it's a genuine emergency.
