# Improvement Plan — 2026-04-26

Scoped plan for five user-requested improvements. Each phase is independently shippable. Run `npm run verify` after every phase.

## Goals

1. Strip "Yours, Watching" / Marisa branding from the player surface and metadata.
2. Remove the "Observed" live-watching indicator from the player.
3. Add a scheduled-time field to envelopes so iOS notifications can fire when this becomes a Capacitor build.
4. Give the admin a real-time view of the player's typed responses.
5. Redesign the "Previous Choices" history panel — it currently looks lame.

These are independent. Order is chosen so that the simplest visible wins land first and the bigger architectural pieces (scheduling, response sync) happen against a cleaner surface.

---

## Phase 1 — Strip Branding ("Yours, Watching" / Marisa) ✅ DONE

**Surfaces to scrub** (confirmed via grep):

- [apps/player/index.html:9](apps/player/index.html:9) — `<title>Yours, Watching</title>` → neutral title (e.g. just "For her" or empty — pick a non-branded label).
- [apps/player/src/App.jsx:172](apps/player/src/App.jsx:172) — `<div className="title">Yours, watching</div>` in `TopBar`. Decide: drop the title row entirely, or replace with something quiet. The `for {addressee}` line is fine to keep.
- [apps/admin/index.html](apps/admin/index.html) — admin tab title. Pick a neutral admin label (not user-facing for her, but still worth de-branding).
- [apps/player/ios/App/App/public/index.html](apps/player/ios/App/App/public/index.html) — generated Capacitor copy; will regenerate on next `cap copy`, but update for now so dev runs are clean.
- [packages/story-content/src/storyData.js](packages/story-content/src/storyData.js) — search and remove any "Marisa" references in seed content. These are content strings, not architecture; safe to edit in place.
- [apps/admin/server/server.js](apps/admin/server/server.js) — likely in a system prompt for AI drafting. Replace any "Marisa" with the placeholder token (`{{herName}}`) so the AI doesn't keep echoing the name.
- Root `index.html` — same treatment as the workspace player html.

**Acceptance:** `grep -ri "marisa\|yours, watching" apps/ packages/ index.html` returns no user-facing matches.

**Risk:** Low. Pure string edits.

---

## Phase 2 — Remove the "Observed" Indicator ✅ DONE

**Files:**

- [apps/player/src/App.jsx:146-166](apps/player/src/App.jsx:146) — delete `WatchIndicator` component.
- [apps/player/src/App.jsx:177](apps/player/src/App.jsx:177) — remove `<WatchIndicator />` from `TopBar`.
- [apps/player/src/styles.css:183-205](apps/player/src/styles.css:183) — delete `.watch-indicator` rules and the `@media` override at line ~2873.
- Repeat for the legacy root copy (`App.jsx`, `styles.css`) if the same indicator exists there. Confirm with grep before deleting.

**Acceptance:** No red dot / "Observed HH:MM" pill renders. `grep -r "watch-indicator\|Observed" apps/player` returns nothing.

**Risk:** Low. Self-contained component.

---

## Phase 3 — Scheduled Times on Envelopes (iOS notification prep) ✅ DONE

This is the largest piece. Land the data model and admin UI first; defer actual `LocalNotifications` wiring until we're ready to test on-device.

### 3a. Content model

Add an optional `scheduledAt` (ISO-8601 string) and `notify` (boolean, default true when scheduledAt is set) field on each envelope.

- [packages/story-core/src/contentModel.js](packages/story-core/src/contentModel.js) — extend `normalizeEnvelope` to preserve these fields, defaulting to `null` / `false`. Do not infer or auto-fill.
- [packages/story-core/src/validation.js](packages/story-core/src/validation.js) — validate that `scheduledAt`, if present, parses as a date.
- [packages/story-core/test/core.test.mjs](packages/story-core/test/core.test.mjs) — add tests: round-trip with and without `scheduledAt`, invalid date rejection.

Keep `timeLabel` (existing display field) separate from `scheduledAt` (machine field). `timeLabel` stays as the human label; `scheduledAt` is what notifications fire on.

### 3b. Admin authoring UI

In [apps/admin/src/App.jsx](apps/admin/src/App.jsx), add a datetime-local input to the envelope editor row, alongside `timeLabel`. Wire it to the same envelope-update path that already exists for `timeLabel`.

Display the input next to the existing time label, with a checkbox "Send notification". No timezone gymnastics yet — store whatever the browser gives us, treat as device-local.

### 3c. Notification bridge stub

Create [packages/story-core/src/notifications.js](packages/story-core/src/notifications.js) with a single function:

```js
export function getEnvelopeNotificationSchedule(content) {
  // returns [{ envelopeId, scheduledAt, title, body }, ...]
}
```

This is the single seam the iOS layer will call into. No Capacitor code yet — that lands in a follow-up after device-test infra is ready (see [docs/mobile-ios-migration-plan.md](docs/mobile-ios-migration-plan.md)).

**Acceptance:** Admin can set a date+time on an envelope; it persists through save/load; `getEnvelopeNotificationSchedule` returns it. No notifications fire yet — that is the next phase, deliberately deferred.

**Risk:** Medium. Touches the shared content model, so validate with `npm run verify` and snapshot a content export before/after.

---

## Phase 4 — Real-time Admin View of Player Responses ✅ DONE

The player already stores form input under `formResponses` keyed by `${envelopeId}::${choiceId}` and persists via `state.js` to localStorage.

**Completed:**

- [apps/admin/src/adminStorage.js](apps/admin/src/adminStorage.js) — `subscribeToPlayerState(callback)` helper implemented. Polls every 1s and watches for cross-tab storage events.
- Admin "Responses" tab in [apps/admin/src/App.jsx](apps/admin/src/App.jsx) — displays `formResponses` grouped by envelope → choice → field, read-only.
- Status metrics show response count and "Receiving" / "Waiting" indicator.

**Acceptance:** ✅ Admin Responses tab shows typed player input in real time (within ~1-2s). No editing. Works across tabs on same device.

**Note on cross-device:** Currently localStorage-only (documented in UI). Cross-device sync (iOS) requires a backend write endpoint — future scope.

---

## Phase 5 — Redesign the Previous Choices Panel ✅ DONE

Current state ([apps/player/src/App.jsx:193-223](apps/player/src/App.jsx:193), [apps/player/src/styles.css:1873-1975](apps/player/src/styles.css:1873)): a right-side slide-in drawer with stacked cards showing theme / label / choice title / hint. The user describes it as shockingly lame. The pieces are right; the visual hierarchy and styling are flat.

**Direction (not a rewrite — edit the existing component per rule 1):**

- Replace the dark slab cards with a typographic timeline: vertical brass spine on the left, day/envelope as ornamental display heading, choice text in the serif. Use existing tokens (`--gilt-soft`, `--display`, `--serif`).
- Add the typed responses inline under each choice (uses Phase 4's data — landing this after Phase 4 is intentional).
- Add subtle envelope wax-seal motif as the bullet on the spine, reusing `sealMotif` already in the model.
- Animate entries with a slow fade-in stagger (existing slide already uses `transform`; just add per-card `animation-delay`).
- Mobile: full-width sheet that slides up from the bottom instead of from the right (better for one-handed iOS use).

**What stays:**

- Same component file. Same data shape. Same open/close mechanism.
- Same z-index layering.

**Acceptance:** Open the panel — it reads as part of the story (parchment / brass / italic display), not a debug log. Each entry shows day, time, choice, and (if any) typed response. Looks correct on a 375px iPhone width.

**Risk:** Low. Pure visual edit. Keep the JSX structure; rework CSS and add response display.

---

---

## Phase 6 — Remove Draft/Release Machinery (there is one live version) ✅ DONE (player + admin)

The player currently has three content-loading paths: bundled default content, an explicit `?releaseUrl=` preview, and a live admin-draft polling loop that hits the admin server every 1200ms. There is only one live version — the bundled content in `packages/story-content`. All draft/preview/release plumbing must go.

### What to delete in `apps/player/src/App.jsx`

| Symbol | Action |
|---|---|
| `getDevLiveDraftUrl()` | Delete |
| `getDevReleaseUrl()` | Delete |
| `normalizeReleaseSource()` | Delete |
| `loadExplicitDevReleaseSource()` | Delete |
| `loadDevLiveDraftSource()` | Delete |
| `createBundledReleaseSource()` | Inline: just use `defaultContent` directly, no wrapper |
| `releaseSource` state | Delete — replace with `const content = defaultContent.content` |
| `releaseFlowMap` | Delete — derive from content as before |
| `releaseStatus` state and all mode/label/loading/error logic | Delete |
| `syncLiveDraft` interval (line ~370) | Delete |
| `previewLabel` and `previewTone` props on `TopBar` | Delete |
| The `preview-pill` div in `TopBar` JSX | Delete |
| The loading/error render branch at line ~612 | Delete |

### What stays

- `defaultContent` import from `@wifey/story-content` — this is the one source of truth
- `readFlowMap(content, flowMap)` can be simplified: just call `buildCompleteFlowMap(content, content.defaultFlowMap || { rules: [] })`
- All player game state and history — unchanged

### CSS to remove in `apps/player/src/styles.css`

- `.preview-pill`, `.preview-pill-live`, `.preview-pill-neutral` — delete all three

### Acceptance

`grep -n "draft\|Draft\|releaseStatus\|previewLabel\|preview-pill\|liveDraft\|releaseUrl" apps/player/src/App.jsx apps/player/src/styles.css` returns nothing. The player loads, plays, and the top bar has no pill label.

**Risk:** Low. Deletion only. The player still reads from `defaultContent` exactly as before — we're just removing the two fallback loading paths that wrapped it.

---

## Sequencing & Verification

1. ✅ Phase 1 + Phase 2 — branding and Observed indicator removed.
2. ✅ Phase 5 — Previous Choices panel redesigned as brass-spine timeline.
3. ✅ Phase 6 — strip draft/release machinery from the player.
4. ✅ Phase 4 — admin real-time response view live.
5. ✅ Phase 3 — scheduled times on envelopes (content-model change).

**All phases complete.**

After each phase: `npm run test:core` + build both apps. Do not run `git stash`.

## Out of scope (intentionally deferred)

- Actual Capacitor `LocalNotifications` registration. Follows Phase 3.
- Cross-device admin↔player sync. Requires a write endpoint and auth model that doesn't exist yet.
- Touching the retired root `AdminPanel.jsx` (per CLAUDE.md rule 2).
