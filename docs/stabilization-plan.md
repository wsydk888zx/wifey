# Stabilization Plan

This plan exists to make the project manageable again. The goal is not to redesign everything at once. The goal is to create a stable development loop, remove contradictory architecture, and migrate the admin surface without losing features.

## Current Diagnosis

The project has been reduced to one target architecture with one remaining legacy fallback:

- A legacy root player preview kept only as a fallback
- A workspace architecture with `apps/player`, `apps/admin`, `packages/story-core`, and `packages/story-content`

The workspace architecture is the target. The root admin surface has been retired; the root player preview stays as a fallback until the workspace player is accepted as the only preview/runtime path.

The biggest risks are:

- Retired legacy admin code can accidentally be treated as current architecture.
- Shared content and flow logic exists in multiple places.
- The admin scaffold is not yet a real replacement.
- Story content can break silently unless validated.
- Future work can drift if docs, scripts, and agent rules disagree.

## Guiding Rules

- Keep changes small and reversible.
- Run `npm run verify` before calling work complete.
- Do not create another root-level admin panel.
- Do not revive the root `AdminPanel.jsx` fallback; use `apps/admin` for authoring.
- Do not move admin-only behavior into `apps/player`.
- Move shared behavior into `packages/story-core` before using it in multiple apps.
- Keep the root player preview working until the workspace player is accepted as the only runtime path.

## Current Hotfix: Admin Tweak Persistence

Status: complete.

Goal: restore persistence for workspace admin `tweaks` so names and intensity survive draft save/load, export/import, publish, and player fetch.

Done:

- Traced the loss of `tweaks` to the Supabase-backed admin adapter, which was not persisting them on save or restoring them on load.
- Restored `tweaks` persistence by storing them alongside `flow_map`, keeping the editable flow-map shape clean while avoiding a password-gated schema migration.
- Added `tweaks` to admin export/import so backup JSON keeps names and intensity.
- Updated the player loader to read published `tweaks` and use the authored flow map from Supabase.
- Verified the admin and player production builds before the hosted rollout.

## Phase 0: Baseline And Safety Net

Status: complete.

Done:

- Initialized Git in the project folder.
- Added `.gitignore`.
- Added `npm run verify`.
- Added content validation.
- Added core tests for content-model and placeholder behavior.
- Updated agent/development guidance to recognize the workspace migration.

Acceptance checks:

- `git status --short` is clean.
- `npm run verify` passes.
- Generated build output is written to `/tmp`, not committed app folders.

## Phase 1: Stabilize Shared Logic

Status: in progress.

Goal: make story structure, placeholder replacement, and flow rules dependable before admin migration accelerates.

Done:

- Added shared flow-rule matching helpers in `packages/story-core`.
- Added tests for conditional flow rules: `is_filled`, `equals`, and `contains`.
- Added tests for malformed content: missing ids, duplicate ids, missing card fields, bad flow targets, unsupported operators, and bad conditional source fields.
- Extracted reusable content validation helpers into `packages/story-core`.
- Made `scripts/validate-content.mjs` consume shared validation helpers.
- Added optional CLI validation for import/export JSON wrapper files.
- Default content validation now covers `config_importable_2026-04-23_revised.json` and `yours-watching-config.json`; the broken `config_current...` snapshots remain manually checkable until cleaned.
- Wired `apps/admin` to display shared validation stats and validation messages.
- Updated mixed-shape content normalization so exported configs with legacy slots plus `envelopes` preserve missing legacy envelopes without hiding real duplicate ids.
- Kept `npm run verify` passing after the slice.
- Added shared `flattenStoryEnvelopes` helpers so flow-map generation and the workspace player use the same envelope sequence metadata.
- Added shared input-type normalization helpers and made the workspace player task card consume them.
- Aligned the legacy admin compatibility wrappers with shared mixed-shape content behavior, day prelude defaults, and deterministic legacy flow-map ids.
- Kept `npm run verify` passing after the shared-helper cleanup slice.

Tasks:

- Expand validation to cover imported/exported config JSON files. Done: default verification covers the two clean importable fixtures, and explicit CLI args can validate historical/current snapshots manually.
- Add tests for conditional flow rules: `is_filled`, `equals`, and `contains`. Done.
- Add tests for malformed content: missing ids, duplicate ids, bad flow targets. Done.
- Move any remaining duplicated content-model logic from the legacy admin into `packages/story-core`. Partial: shared helpers now cover mixed-shape envelopes, envelope flattening, input types, validation, and flow matching; root browser globals remain as compatibility wrappers while the legacy player preview is CDN/Babel based.
- Keep root compatibility wrappers only where the legacy player preview still needs global APIs.

Acceptance checks:

- Shared logic lives in `packages/story-core`.
- Admin/player code imports shared helpers instead of duplicating them.
- Validator catches duplicate envelope ids, duplicate choice ids, invalid flow targets, and missing required card fields.
- `npm run verify` passes.

## Phase 2: Make Content Ownership Clear

Status: in progress.

Goal: stop relying on the temporary root `content.js` bridge for workspace apps.

Done:

- Moved bundled story data into `packages/story-content/src/storyData.js`.
- Reduced root `content.js` to a legacy CDN/Babel adapter that exposes `window.GAME_CONTENT` and `window.DEFAULT_FLOW_MAP`.
- Exported both `defaultContent` and `defaultFlowMap` from `@wifey/story-content`.
- Made `apps/player` and `apps/admin` consume content and default flow data from `@wifey/story-content`.
- Updated content validation to load the package-owned story data plus the legacy adapter.
- Kept `npm run verify` passing after the content ownership slice.

Tasks:

- Move bundled story data into `packages/story-content`. Done.
- Keep `content.js` as a legacy root adapter if needed. Done.
- Make `apps/player` consume content from `@wifey/story-content` only. Done.
- Make `apps/admin` load/edit/export the same content model. Partial: `apps/admin` reads and validates package content, but edit/import/export controls still belong to Phase 3.
- Add a content export format that can be re-imported without manual cleanup. Partial: validator accepts wrapper config files; workspace admin export/import controls still need the real authoring UI.

Acceptance checks:

- `packages/story-content` owns the canonical bundled story data.
- Root `content.js` is no longer the source for workspace builds.
- Player build does not rely on global `window.GAME_CONTENT`.
- `npm run verify` passes.

## Phase 3: Build The Real Admin Shell

Status: in progress.

Goal: turn `apps/admin` from a scaffold into a useful, boring, desktop authoring app.

Target layout:

- Left navigation: Overview, Story, Flow, AI Drafts, Snapshots, Publish
- Main pane: focused editor for the active section
- Right pane: validation, dirty state, and preview/status details

Done:

- Added the desktop admin shell with left navigation, main overview pane, and right validation/storage rail.
- Added shared validation results inside the admin app.
- Added basic story overview: days, envelopes, choices, flow-rule count, and validation status.
- Added admin storage helpers for editable content, flow map, snapshots, and dirty-state fingerprinting.
- Added visible dirty/clean state with browser draft save/reset controls.
- Added import/export controls for the `{ content, flowMap }` wrapper format.
- Added snapshot staging, restore, and delete controls in `apps/admin`.
- Kept the targeted admin production build passing after the storage/import slice.
- Added the first real editing surface in `apps/admin`: a prologue lines/sign-off editor that updates the normalized draft, previews the opening sequence, and can save/export through the existing draft helpers.
- Tightened prologue validation so an all-blank opening sequence is reported as invalid.

Tasks:

- Add admin storage helpers for content edits, flow map, snapshots, and settings. Partial: content, flow map, snapshots, and dirty-state helpers are in place; settings helpers can wait until a settings surface exists.
- Add a visible dirty/clean state. Done.
- Add import/export controls. Done.
- Add validation results inside the admin app. Done.
- Add basic story overview: days, envelopes, choices, flow-rule count, validation status. Done.
- Add a first real editing surface for the prologue. Done.

Design requirements:

- Keep it dense, calm, and operational.
- Avoid decorative card-heavy layouts.
- Avoid hidden critical actions.
- Keep controls predictable and easy to scan.

Acceptance checks:

- `apps/admin` can display current content health.
- `apps/admin` can import/export content JSON.
- `apps/admin` can show dirty state.
- `npm run verify` passes.

## Phase 4: Migrate Admin Features By Slice

Status: in progress.

Goal: reach feature parity without breaking the legacy fallback.

Done:

- Added a day and envelope editing surface to the workspace admin Story section.
- Day editing now covers theme, branch-only state, and day prelude fields.
- Envelope editing now covers label, time label, seal motif, intro, choices heading, choices intro, and branch-only state.
- Day/envelope edits stay in the normalized admin draft and continue through Save Draft and `{ content, flowMap }` export.
- Kept `npm run verify` passing after the day/envelope editor slice.
- Added the choice/card editing surface under the currently selected envelope in `apps/admin`.
- Choice/card editing now covers choice title, choice hint, card heading, card body, and card rule/footer.
- Choice/card edits stay in the normalized admin draft and continue through Save Draft and `{ content, flowMap }` export.
- Kept `npm run verify` passing after the choice/card editor slice.
- Added the response input editing surface under the currently selected choice in `apps/admin`.
- Response input editing now covers field id, label, type, placeholder, help text, required state, and select/multi-select options.
- Response input edits stay in the normalized admin draft and continue through Save Draft and `{ content, flowMap }` export.
- Kept `npm run verify` passing after the response input editor slice.
- Added the Flow tab in `apps/admin` with visible automatic default routes, end points, and explicit route rules.
- Flow rule editing now covers source choice, optional source response field, operator, comparison value, and target envelope.
- Added shared flow-operator labels in `packages/story-core` and kept the route editor on shared flow/content helpers.
- Kept `npm run verify` passing after the flow editor slice.
- Added the dedicated Snapshots tab in `apps/admin`.
- Snapshot management now supports current-draft snapshot creation, compare, restore, delete, and per-snapshot export actions from a full authoring surface.
- Reduced the right rail snapshot area to a compact summary so validation and storage status stay readable.
- Kept `npm run verify` passing after the snapshot section slice.
- Enabled the AI Drafts tab in `apps/admin`.
- Migrated the card and envelope draft endpoints into the workspace admin server at `/api/card-draft` and `/api/envelope-draft`.
- Added a focused AI drafting workspace that targets the selected choice or envelope, compares generated fields against current draft content, and only writes through explicit field/all apply actions.
- Added a health route and dev CORS handling to the admin AI server so the Vite admin app can use the local server during authoring.
- Kept the targeted admin production build and admin AI server health check passing after the AI drafting slice.
- Enabled the Publish tab in `apps/admin` as a release checkpoint.
- Publish now shows validation, dirty-state, and snapshot readiness before export.
- Publish exports the same `{ content, flowMap }` wrapper accepted by admin import and content validation, and blocks release export while validation errors exist.
- Added shared placeholder-token helpers and a workspace admin Story preview panel for supported name tokens.
- Workspace admin previews now render supported name placeholders in the selected prologue, card, and response-field previews.
- Kept `npm run verify` passing after the placeholder preview slice.
- Added guarded Story structural controls in `apps/admin`: day, envelope, and choice id editing; add/remove day, envelope, and choice; and move up/down envelope ordering.
- Structural edits now keep explicit flow rules safer by cascading source/target id changes and pruning rules that depend on removed days, envelopes, choices, or response fields.
- Kept `npm run verify` passing after the structural editing slice.

Migration order:

1. Storage and validation
2. Story overview
3. Prologue editor
4. Day and envelope editor. Done.
5. Choice/card editor. Done.
6. Response input editor. Done.
7. Flow map editor. Done.
8. Snapshots. Done.
9. AI drafting. Done.
10. Publish/export workflow. Done.

Feature parity checklist:

- Day-level fields: id, theme, branch-only state, day prelude. Done.
- Envelope fields: id, intro, choices heading, choices intro, time label, seal motif, label, branch-only state. Done.
- Choice fields: id, title, hint, card heading, card body, card rule. Done.
- Structural editing: add/remove days, envelopes, and choices; move envelopes with explicit up/down controls. Done.
- Card inputs: text, textarea, single-select, multi-select. Done.
- Placeholder preview for supported name tokens. Done.
- Flow rules: source choice, source field, operator, value, target envelope. Done.
- Snapshot save/restore/delete. Done.
- Snapshot compare/export. Done.
- Import/export current content and flow map. Done.
- AI card draft endpoint. Done.
- AI envelope draft endpoint. Done.
- Publish/export checkpoint. Done.

Acceptance checks:

- Each migrated feature has an equivalent path in `apps/admin`.
- Retired `AdminPanel.jsx` is not revived or wired back into the root preview.
- No admin-only code appears in `apps/player`.
- `npm run verify` passes after every slice.

## Phase 5: Retire Legacy Admin

Status: in progress.

Goal: remove duplicate admin behavior only after the workspace admin is proven.

Done:

- Compared legacy `AdminPanel.jsx` feature surfaces against `apps/admin`.
- Created `docs/legacy-admin-parity-checklist.md` with the parity matrix, root preview smoke checklist, and remaining workspace parity gaps.
- Identified that the workspace admin covers the main authoring loop but should not replace the legacy admin yet.
- De-scoped real-text messaging from the target product plan; it should be removed rather than migrated.
- Added workspace admin Settings storage and UI for non-messaging `tweaks`: her name, his name, and intensity.
- Kept `npm run verify` passing after the settings slice.
- Added workspace admin Story structure controls for ids, add/remove actions, and envelope reordering; new days are capped at the five canonical days supported by shared content normalization.
- Removed de-scoped real-text messaging behavior from the legacy root runtime, workspace player runtime, legacy admin authoring UI, settings, prompt queue surfaces, styles, and Capacitor notification dependency wiring.
- Removed `card.realText` from canonical package content and the default validated importable JSON fixtures.
- Added shared validation coverage that rejects deprecated `card.realText` config in imported or edited content.
- Decided full player-progress reset belongs in `apps/player`, because the state is local to the player browser/WebView origin.
- Added a player-owned mid-flow reset action in the workspace player top bar while keeping content, flow, snapshots, and settings recovery in `apps/admin`.
- Ran the legacy-root smoke checklist pass on 2026-04-25 against `npm run legacy:preview`.
- Confirmed root prologue/player rendering, legacy Admin tab navigation, settings/name placeholder edits, prologue edits, day/envelope/choice/response-field edits, structural add/remove controls, flow-rule add/clear behavior, snapshot save/restore/export/delete, Full Reset behavior, and restored local state after temporary destructive checks.
- Confirmed browser console stayed free of runtime errors during smoke; the only warning was the expected in-browser Babel transformer warning from the legacy root preview.
- Kept `npm run verify` passing after the legacy-root smoke pass.
- Closed the two remaining legacy-root smoke gaps on 2026-04-25 with an isolated headless Chrome profile against `http://localhost:8010`.
- Verified Day I legacy envelope drag-and-drop by moving `d1m` ahead of `d1p`, confirming the saved content order, and restoring the original `d1p`, `d1m`, `d1e` order.
- Verified legacy Versions import through the actual file input using `yours-watching-config.json`; the imported draft saved 12 envelopes, 29 choices, and 3 explicit flow rules.
- Chose the guarded fallback path for legacy root admin retirement on 2026-04-25.
- Hid the root preview Admin controls by default while keeping `AdminPanel.jsx` loaded for compatibility and emergency fallback use.
- Added the explicit fallback switch: open the root preview with `?legacyAdmin=1` or run `localStorage.setItem('yoursWatching:legacyAdminFallback', 'true')`; open with `?legacyAdmin=0` to clear it.
- Ran the fallback-gated legacy admin verification pass on 2026-04-25 against `npm run legacy:preview` and the workspace admin dev server.
- Confirmed the default root preview shows no visible Admin entry on the prologue, active player, or finale states; the missing-content render branch uses the same fallback-gated `TopBar` path.
- Confirmed `?legacyAdmin=1` shows the root Admin entry and opens the existing `AdminPanel.jsx` fallback.
- Ran one workspace admin authoring pass by editing the prologue in memory, reaching the Publish checkpoint, and confirming `Export Release JSON` succeeds from the current draft.
- Decided to keep the legacy admin code behind the fallback flag until the root preview itself is retired.
- Added a dev-only workspace player `releaseUrl` preview path for same-origin exported `{ content, flowMap }` wrappers.
- Ran a workspace player default-content smoke pass on 2026-04-25 against `http://127.0.0.1:4173/`: prologue rendered, first envelope opened, first choice rendered, completion advanced to the next envelope, and browser console errors stayed empty.
- Ran a workspace player wrapper smoke pass on 2026-04-25 against `yours-watching-config.json` through the dev `releaseUrl` path on `http://127.0.0.1:4174/`: the player rendered the wrapper's 12 envelopes, opened the first envelope, selected the first choice, completed it, advanced to the next envelope, and browser console errors stayed empty.
- Chose the publish-to-player stance for now: admin release exports remain the portable review/smoke artifact, while packaged player builds should continue to ship package-owned story content unless a later backend/distribution path replaces that local promotion step.
- Added `npm run promote:content -- <release-export.json>` to validate an accepted admin release export, normalize it, store the exported flow map as package `defaultFlowMap`, and rewrite `packages/story-content/src/storyData.js` for bundled native/player builds.
- Documented the release-promotion handoff in `README.md`.
- Dry-run promotion checks passed for `yours-watching-config.json` and `config_importable_2026-04-23_revised.json`; a generated copy was written to `/tmp/wifey-promoted-storyData.js` without replacing package content before an accepted release is chosen.
- Re-ran the workspace player package-default smoke pass on 2026-04-25 against `http://127.0.0.1:4175/`: prologue rendered, first envelope opened, first choice rendered, completion advanced to the next envelope, and browser console errors stayed empty.
- Kept `npm run verify` passing after the release-promotion tooling slice.
- Promoted `config_importable_2026-04-23_revised.json` into `packages/story-content/src/storyData.js` on 2026-04-25 with `npm run promote:content -- config_importable_2026-04-23_revised.json`.
- Re-ran the workspace player package-default smoke pass after promotion on 2026-04-25 against `http://127.0.0.1:4176/`: the promoted package content rendered 19 seals, opened Day I morning, selected the first choice, completed it, advanced to the next envelope, and browser console errors stayed empty.
- Kept `npm run verify` passing after the accepted-release promotion slice.
- Accepted the promoted package-content path as the native/player build source for the next retirement slice.
- Removed the root Admin fallback from the legacy preview on 2026-04-25: `App.jsx` no longer reads `?legacyAdmin`, no longer renders `AdminPanel`, and `index.html` no longer loads `AdminPanel.jsx`.
- Kept the root player preview path intact while making `apps/admin` the only supported authoring surface.

Tasks:

- Compare legacy and workspace admin feature parity. Done.
- Create a final legacy-root smoke checklist. Done.
- Close workspace admin parity gaps for structural editing and recovery ownership. Done: non-messaging settings and Story structural editing are covered, and player progress reset is explicitly player-owned.
- Remove real-text messaging features instead of migrating them: `card.realText`, queued prompts, SMS links, recipient phone/webhook settings, and browser notification prompt handling. Done.
- Run the final legacy-root smoke checklist. Done: the main browser smoke passed, and the drag/import gaps were closed with an isolated headless Chrome pass.
- Choose the legacy root admin retirement path. Done: the root Admin entry was hidden behind an explicit fallback flag first, then the fallback was removed after package-content promotion was accepted.
- Run fallback-gated legacy admin verification after hiding the default Admin entry. Done before removal: default prologue, active player, and finale states hid Admin; fallback flag still opened `AdminPanel.jsx`; workspace admin publish export succeeded.
- Add or document the package-content release promotion step. Done: `npm run promote:content -- <release-export.json>` is the explicit accepted-export-to-package path.
- Promote the accepted release export into package content and smoke package defaults. Done: `config_importable_2026-04-23_revised.json` is now the bundled package content, with a passing workspace player smoke and `npm run verify`.
- Remove root admin entry only after workspace admin can replace it. Done: root `App.jsx` no longer renders `AdminPanel`, and root `index.html` no longer loads `AdminPanel.jsx`.
- Keep root preview available as player fallback until no longer needed.

Current retirement checks:

- Real-text messaging is no longer a parity gap because it should be removed, not migrated.
- Full player-progress reset is player-owned in `apps/player`; workspace admin owns authoring recovery for content, flow, snapshots, and settings.
- Workspace placeholder preview is centralized rather than inline like the legacy `PlaceholderBar`.
- The previous drag-and-file-picker smoke gaps are resolved.
- The root preview is now player-only; legacy admin access through `?legacyAdmin=1` is no longer supported.
- The workspace player/admin replacement path is proven for browser default content and same-origin exported-wrapper smoke testing.
- The accepted revised export has been promoted and smoked through package defaults for native/player builds.
- The remaining retirement decision is whether to remove the root player preview/server path after one more player-only smoke pass.

Acceptance checks:

- Workspace admin can perform every required authoring task.
- Player consumes published content from the workspace flow.
- Legacy admin can be removed without losing features.
- `npm run verify` passes.

## Phase 6: Development Workflow

Goal: make future work routine instead of nerve-wracking.

Standard loop:

1. Check `git status --short`.
2. Make one scoped change.
3. Run targeted checks.
4. Run `npm run verify`.
5. Commit with a clear message.

Suggested branch/commit style:

- `infra: ...`
- `content: ...`
- `admin: ...`
- `player: ...`
- `flow: ...`
- `test: ...`
- `docs: ...`

Definition of done:

- The intended behavior works.
- `npm run verify` passes.
- The working tree is clean or remaining changes are explicitly explained.
- The change does not introduce a second source of truth.

## Next Concrete Slice

Continue Phase 5 by deciding whether the root player preview is still needed:

1. Run one root player-only smoke pass after the Admin fallback removal.
2. If the workspace player is accepted as the only runtime path, plan the root preview/server retirement slice.
3. If the root player preview is still useful as a fallback, keep it player-only and update default scripts/docs so routine work starts from workspace apps.
4. Re-run `npm run verify` after any retirement or fallback-path change.

Keep the legacy root player preview untouched until the workspace player replacement path is fully accepted.
