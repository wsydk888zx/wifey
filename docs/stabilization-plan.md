# Stabilization Plan

This plan exists to make the project manageable again. The goal is not to redesign everything at once. The goal is to create a stable development loop, remove contradictory architecture, and migrate the admin surface without losing features.

## Current Diagnosis

The project currently has two overlapping realities:

- A legacy root preview app with the real admin panel in `AdminPanel.jsx`
- A workspace architecture with `apps/player`, `apps/admin`, `packages/story-core`, and `packages/story-content`

The workspace architecture is the target. The root app stays as a fallback until the workspace player and admin reach feature parity.

The biggest risks are:

- The admin panel is too large and too easy to break.
- Shared content and flow logic exists in multiple places.
- The admin scaffold is not yet a real replacement.
- Story content can break silently unless validated.
- Future work can drift if docs, scripts, and agent rules disagree.

## Guiding Rules

- Keep changes small and reversible.
- Run `npm run verify` before calling work complete.
- Do not create another root-level admin panel.
- Do not rewrite `AdminPanel.jsx` from scratch while the legacy preview depends on it.
- Do not move admin-only behavior into `apps/player`.
- Move shared behavior into `packages/story-core` before using it in multiple apps.
- Keep the root app working until workspace feature parity is proven.

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

Goal: make story structure, placeholder replacement, and flow rules dependable before admin migration accelerates.

Tasks:

- Expand validation to cover imported/exported config JSON files.
- Add tests for conditional flow rules: `is_filled`, `equals`, and `contains`.
- Add tests for malformed content: missing ids, duplicate ids, bad flow targets.
- Move any remaining duplicated content-model logic from the legacy admin into `packages/story-core`.
- Keep compatibility wrappers in `AdminPanel.jsx` only where the legacy root app needs global APIs.

Acceptance checks:

- Shared logic lives in `packages/story-core`.
- Admin/player code imports shared helpers instead of duplicating them.
- Validator catches duplicate envelope ids, duplicate choice ids, invalid flow targets, and missing required card fields.
- `npm run verify` passes.

## Phase 2: Make Content Ownership Clear

Goal: stop relying on the temporary root `content.js` bridge for workspace apps.

Tasks:

- Move bundled story data into `packages/story-content`.
- Keep `content.js` as a legacy root adapter if needed.
- Make `apps/player` consume content from `@wifey/story-content` only.
- Make `apps/admin` load/edit/export the same content model.
- Add a content export format that can be re-imported without manual cleanup.

Acceptance checks:

- `packages/story-content` owns the canonical bundled story data.
- Root `content.js` is no longer the source for workspace builds.
- Player build does not rely on global `window.GAME_CONTENT`.
- `npm run verify` passes.

## Phase 3: Build The Real Admin Shell

Goal: turn `apps/admin` from a scaffold into a useful, boring, desktop authoring app.

Target layout:

- Left navigation: Overview, Story, Flow, AI Drafts, Snapshots, Publish
- Main pane: focused editor for the active section
- Right pane: validation, dirty state, and preview/status details

Tasks:

- Add admin storage helpers for content edits, flow map, snapshots, and settings.
- Add a visible dirty/clean state.
- Add import/export controls.
- Add validation results inside the admin app.
- Add basic story overview: days, envelopes, choices, flow-rule count, validation status.

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

Goal: reach feature parity without breaking the legacy fallback.

Migration order:

1. Storage and validation
2. Story overview
3. Prologue editor
4. Day and envelope editor
5. Choice/card editor
6. Response input editor
7. Flow map editor
8. Snapshots
9. AI drafting
10. Publish/export workflow

Feature parity checklist:

- Day-level fields: theme, branch-only state, day prelude
- Envelope fields: intro, choices heading, choices intro, time label, seal motif, label, branch-only state
- Choice fields: title, hint, card heading, card body, card rule
- Card inputs: text, textarea, single-select, multi-select
- Placeholder preview for supported name tokens
- Flow rules: source choice, source field, operator, value, target envelope
- Snapshot save/restore/delete
- Import/export current content and flow map
- AI card draft endpoint
- AI envelope draft endpoint

Acceptance checks:

- Each migrated feature has an equivalent path in `apps/admin`.
- Legacy `AdminPanel.jsx` is unchanged unless a compatibility fix is required.
- No admin-only code appears in `apps/player`.
- `npm run verify` passes after every slice.

## Phase 5: Retire Legacy Admin

Goal: remove duplicate admin behavior only after the workspace admin is proven.

Tasks:

- Compare legacy and workspace admin feature parity.
- Create a final legacy-root smoke checklist.
- Remove root admin entry only after workspace admin can replace it.
- Keep root preview available as player fallback until no longer needed.

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

Start Phase 1:

1. Expand core tests for conditional flow rules.
2. Extract validator logic into reusable `packages/story-core` helpers.
3. Make the CLI validator consume those shared helpers.
4. Wire `apps/admin` to display the same validation results.

This gives the admin migration a reliable foundation before any large UI work begins.
