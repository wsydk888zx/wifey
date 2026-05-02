# Deployment Process Review & Remediation Plan

**Date:** 2026-05-01
**Status:** Phase A complete (2026-05-01). Phase B complete (2026-05-01). Phase C complete (2026-05-01). Phase D planned.

---

## Progress log

### 2026-05-01 — Phase C done

- **C1** — ops-playbook §1 now has an "Error message decoder" table mapping every Supabase auth error string to its meaning and fix. Covers: `Invalid login credentials`, `Email not confirmed`, `User not found`, silent spinner (env-var missing), red banner, `Failed to fetch` (wrong URL or paused project).
- **C2** — `docs/architecture.md` now has a full ASCII deployment topology diagram: GitHub → both Vercel projects, each with env-var callouts, pointing to Supabase tables. Local AI server also shown.
- **C3** — Full export audit of `supabaseStorage.js` vs `App.jsx` imports: all 16 imported names confirmed present as exports. Audit commands + full export list documented in ops-playbook §4 for future re-runs. Build (`npm run build --workspace @wifey/admin`) is the definitive CI check.

---

### 2026-05-01 — Phase B done

Scripts:
- `scripts/preflight.sh` — builds both apps, asserts `.vercel/` isn't tracked, diffs admin `.env.local` vs Vercel env vars (best-effort).
- `scripts/verify-deploy.sh [player|admin|both]` — curls live URLs, asserts each serves the right app (player title check + "not serving admin" guard).
- `scripts/deploy.sh <admin|player|both>` — runs preflight → sets correct `.vercel/project.json` → `vercel --prod --yes` → cleans up → smoke check. Replaces the manual mkdir/echo dance from ops-playbook §3.

Hooks:
- `.git/hooks/pre-push` — runs `preflight.sh` before every push. Skip with `--no-verify` only in emergencies.

npm scripts added to `package.json`:
- `npm run preflight` — runs preflight only
- `npm run deploy -- <admin|player|both>` — full deploy
- `npm run smoke -- [player|admin|both]` — smoke check only

Ops-playbook §7 prevention note already referenced `scripts/deploy.sh` — now it's real.

---

### 2026-05-01 — Phase A done

Code:
- [apps/admin/src/App.jsx:60](../apps/admin/src/App.jsx) — added `SUPABASE_CONFIG_MISSING` guard with a build-time console error.
- `LoginScreen` — renders a red "Configuration error" panel pointing to ops-playbook §7 when env vars are missing, instead of a broken login form.
- Admin build verified green (`npm run build --workspace @wifey/admin` → 84 modules, no errors).

Docs:
- [CLAUDE.md](../CLAUDE.md) — added "READ FIRST" pointer to ops-playbook + a "Known facts" block listing the two confirmed auth users, both Vercel project IDs + team ID, Supabase project ID, and the env-var-baked-at-build-time gotcha.
- [docs/ops-playbook.md](ops-playbook.md) — added §7 "Admin login broken after deploy", documenting the env-var-sync root cause, the 60-second diagnostic, the fix, and the prevention note about the new fail-loud guard.

Memory:
- `project_admin_login_after_deploy.md` — saved as project memory so cold-start Claude opens with "check env-var sync first" instead of "do you have an account?"
- `project_vercel_topology.md` — saved hard facts (project IDs, team ID, auth users) so they don't get re-discovered.
- `MEMORY.md` index updated.

Not yet verified (needs your hands or a Vercel re-auth):
- That the deployed admin Vercel project's env vars *actually match* `.env.local`. The MCP can't see your team (403). The new banner will surface this in 5 seconds the next time you open the deployed admin if they don't match — that's the verification.

---

### 2026-05-01 — Phase D planned (next session)

**Audit findings:**
- Smoke check script hardcoded player URL and had incorrect title check — fixed locally, smoke check now passes.
- Deploy script structure validated; correctly rejects missing/invalid arguments.
- Pre-push hook structure validated; runs preflight before every push.
- Both admin and player builds passing green on every preflight run.

**Phase D scope:** Extend pre-deploy validation to catch data + infrastructure issues before they reach Vercel.

---

## Phase D — data & infrastructure checks (next session, ~45 min)

**D1. Supabase migration validation**
- Add to `preflight.sh`: check that all migrations in `supabase/migrations/` have been applied.
- Get migration status: `supabase migration list` (requires `supabase login`).
- Warn if migrations are pending: "Apply with: supabase db push".
- Player deploy should fail (not warn) if migrations aren't applied, since player expects `stories` table.

**D2. Auto-discover Vercel URLs**
- Replace hardcoded `PLAYER_URL` in `verify-deploy.sh` with Vercel API lookup.
- Read from `.vercel/project.json` → query Vercel API for latest production deployment URL.
- Make `ADMIN_URL` optional but auto-discoverable the same way, instead of requiring env var.
- Removes brittle hardcoded URLs if Vercel domains ever change.

**D3. AI server health check (admin-only)**
- Add to `preflight.sh` (or deploy script pre-admin-deploy): check that `http://localhost:3001/api/card-draft` responds.
- Only runs if admin is being deployed (not for player-only deploys).
- Helps catch "admin deployed but AI features broken because server isn't running" issues.
- Exact endpoint: local dev server on port 3001 (from `scripts/dev-admin.mjs`).

**D4. Content publication verification**
- Add to smoke check (after deploy succeeds): fetch player URL, check that it loads published story from Supabase, not bundled fallback.
- Query player's live state to confirm `lastPublishedAt` timestamp is recent (within last 5 minutes of deploy).
- Catches: published story not actually live, Supabase fetch failing, fallback being served instead.

**Why these matter:**
- **D1** prevents "player loads old story" (missing migration = no table = bundled fallback).
- **D2** makes the deploy script more robust to Vercel domain changes and works for both surfaces without env var setup.
- **D3** catches "admin deploys but AI endpoints 404" immediately instead of at author's next session.
- **D4** verifies the full flow: admin publishes → Supabase receives → player fetches → player displays. If any link breaks, we know in 30 seconds.

---

---

## 1. What's actually going wrong

You're seeing the same symptoms session after session:

1. **Claude says "you don't have an admin account"** — when in fact two confirmed accounts exist in Supabase (`jondcarpenter@outlook.com` + a backup).
2. **Vercel deploys go to the wrong project / serve the wrong app** — e.g. player URL serving admin (issue #2 in the ops playbook, root cause: committed `.vercel/output/`).
3. **`git push` succeeds but the live site shows old code** — wrong project, missing GitHub integration, or pre-built output bypassing the build.
4. **Builds break post-refactor** — `handleSaveDraft`, `supabaseStorage.js` signatures drift, and nothing catches it before push.
5. **Story content desync** between admin and player after the Supabase centralization.

These are not new problems. They're catalogued in `docs/ops-playbook.md` (commit 33422d0). The problem isn't that we don't know the fixes — it's that **nothing in the workflow forces Claude (or you) to consult them at the start of a task.**

---

## 2. Root cause: why Claude keeps "not understanding"

| Problem | Why it happens |
|---|---|
| Claude claims no admin account exists | Each session starts cold. Claude reads `CLAUDE.md` but `CLAUDE.md` doesn't mention auth users. The ops playbook does (§1), but Claude doesn't open it unless something specifically points there. |
| Claude doesn't know which Vercel project is which | Two projects (`wifey` = admin, `wifey-player` = player) with different IDs. Documented in ops-playbook §3 but, again, not surfaced by default. |
| Claude proposes destructive git commands | No memory of past incidents (e.g. `git stash` wiping live admin session — that one IS in memory now). Other foot-guns aren't. |
| Builds break unnoticed | No pre-commit hook runs `npm run build`. The "Deployment Checklist" exists as prose only. |
| `.vercel/output/` keeps coming back | `.gitignore` covers it now, but nothing prevents `git add -A` from re-introducing other build artifacts. |

**The pattern:** institutional knowledge lives in `docs/ops-playbook.md`, but the workflow doesn't ingest it. Fixes get written down, then forgotten on the next cold start.

---

## 3. Are we using git? Are Vercel deploys working?

**Git:** Yes. `origin = https://github.com/wsydk888zx/wifey.git`, branch `main`, working tree clean. Recent commits are sensible. No problem here.

**Vercel:** Two projects, both connected:
- `wifey` (admin) — `prj_9d9FqwIQB8S4z5JGCponKFkhXQxU`
- `wifey-player` — `prj_7Rx0XM75xrhLLiQ9d18MUK0UThKd`

The breakdown isn't Vercel itself. It's that:
- Player project's GitHub auto-deploy is unreliable (per ops-playbook §3) — sometimes needs manual `vercel --prod`.
- When `.vercel/output/` got committed (33422d0 fixed it), Vercel served stale prebuilt assets.
- There's no post-deploy verification step, so we don't notice until you do.

---

## 4. The plan — what to actually change

### Phase A — make the institutional knowledge unmissable (today, ~30 min)

**A1. Add an "always-read" pointer to `CLAUDE.md`.**
At the top of `CLAUDE.md`, before any other rules, add:

> **Before any deployment, auth, build, or Supabase task:** read `docs/ops-playbook.md` first. It catalogues the recurring issues and exact fixes. Do not propose generic solutions for problems already solved there.

**A2. Add the auth user list directly to `CLAUDE.md`.**
A short "Known facts" section so cold-start Claude can't claim accounts don't exist:
- Two confirmed Supabase auth users exist (jondcarpenter@outlook.com + backup).
- Two Vercel projects exist (admin = `wifey`, player = `wifey-player`) with their IDs.
- Supabase project ID: `bxeoleynlmnhagveqrmn`.

**A3. Save these as auto-memory.**
Two `project` memories: (1) auth users exist & are confirmed, (2) two Vercel project IDs and which builds which. This survives across sessions, not just within `CLAUDE.md`.

### Phase B — make builds & deploys verifiable (this week)

**B1. Pre-push build script.** Add `npm run preflight` at the repo root that runs both workspace builds + checks `.vercel/` isn't tracked. Wire it into a `pre-push` git hook (Husky or simple `.git/hooks/pre-push`).

**B2. Post-deploy smoke check.** Add `scripts/verify-deploy.sh` that:
- Hits the player URL, asserts HTML contains a player-specific marker (e.g. `<title>Yours, Watching</title>`).
- Hits the admin URL, asserts it contains an admin-specific marker.
- Fails loud if either is wrong (catches "player URL serving admin" within 30 seconds of deploy).

**B3. Single deploy command.** A `scripts/deploy.sh <admin|player|both>` wrapper that:
- Runs preflight.
- Sets the correct `.vercel/project.json` for the target.
- Runs `vercel --prod --yes`.
- Cleans up `.vercel/`.
- Runs the smoke check.
- Removes the manual mkdir/echo dance from ops-playbook §3.

### Phase C — close the smaller gaps (next session)

**C1. Document the actual auth flow** in ops-playbook §1 — specifically what error message corresponds to "wrong password" vs "user doesn't exist" vs "email not confirmed", so Claude stops guessing.

**C2. Add a "deployment topology" diagram** (ASCII is fine) to `docs/architecture.md` showing: GitHub → Vercel admin project, GitHub → Vercel player project, admin → Supabase, player → Supabase. So a cold-start Claude can see the whole picture in one glance.

**C3. Audit `apps/admin/src/App.jsx` exports + `supabaseStorage.js`** for the function-drift issue (ops-playbook §4). Either add a typecheck step or unit-test the imports so a missing `handleSaveDraft` fails CI, not at runtime.

---

## 5. What I'd like you to confirm before I touch anything

1. Do you want me to do **Phase A in this turn** (CLAUDE.md edits + memory writes)? It's safe, reversible, ~10 minutes.
2. For Phase B, are you OK with a git pre-push hook? Some people hate hooks; if you do, we'll make `preflight` a manual step you run before pushing.
3. Is there a third recurring symptom I missed? You mentioned the admin-account thing specifically — anything else from this week that I should add to the playbook before I forget it?

Once you say go on Phase A, I'll execute it and update this plan with what's done.
