# Player Polish Pass

## Status

Completed.

Started: 2026-05-03

## Working Notes

- This pass is centered on `apps/player` as the primary surface, with supporting schema/admin changes only where the final-day reveal item flow requires them.
- The current worktree is already dirty in unrelated areas, so this plan should track only the player-polish scope and avoid assuming a clean baseline.
- Shared content-model changes should land in `packages/story-core` so the admin and player stay aligned on reveal-item data.
- Verification should favor fast local build coverage first, then a direct production deploy with post-deploy smoke checks for the player and admin surfaces.

## Objective

Polish the player app experience by removing distracting utility UI, improving the choice-history presentation, removing the visible loading screen, tightening the PWA install experience, fixing the envelope title overlap during the open animation, and supporting final-day author-defined reveal items for the branch where he chooses.

## Context

The player app is the recipient-facing surface and should feel intimate, thematic, and intentional. Current rough edges break the mood:

- The top-left live story sync badge exposes implementation detail in the main experience.
- The choice-history drawer works functionally but does not feel elegant enough for the story tone.
- The app shows a visible loading screen during startup instead of transitioning directly into the story shell.
- The PWA manifest exists, but the install icon experience needs a deliberate app icon treatment.
- The `sealed for you` note overlaps the envelope while it animates open.
- On the final day, one branch needs admin-authored items that can be entered in the admin panel and revealed back to the player in the last envelope.

## Steps

- [x] Audit the current player shell, history drawer, startup loader, manifest, envelope animation, and final-day card data shape.
- [x] Remove the visible live story status UI from the player chrome without breaking live refresh behavior behind the scenes.
- [x] Redesign the choice-history presentation to feel more thematic, readable, and mobile-friendly.
- [x] Replace the current blocking loading screen with a quieter startup path that keeps the shell feeling immediate.
- [x] Create or integrate a stronger player app icon and wire it into the PWA manifest plus Apple touch icon flow.
- [x] Fix the envelope note/layout so `sealed for {name} alone` does not visually bleed into the envelope during the open animation.
- [x] Extend the shared story card schema to support optional author-defined reveal items without relying on deprecated card fields.
- [x] Add admin editing controls for reveal items on the relevant final-day choice card.
- [x] Render reveal items in the player so the chosen final branch can reveal them elegantly in the last envelope.
- [x] Run verification and direct production deploy, then record follow-ups or residual polish gaps.

## Execution Order

1. Audit the current player and shared-content implementation so UI and schema work can be sequenced cleanly.
2. Land the player-only polish items first: sync badge removal, history refinement, startup behavior, app icon wiring, and envelope animation cleanup.
3. Add the shared-schema and admin authoring support for final-day reveal items.
4. Render and verify the reveal-item experience in the player.
5. Finish with builds, direct production deploy, smoke checks, and written completion notes.

## Verification

- [x] `npm run build --workspace @wifey/player`
- [x] `npm run build --workspace @wifey/admin`
- [x] `npm run test:core`
- [x] Production smoke check for the deployed player shell and published-story fetch path
- [x] Production smoke check for the deployed admin shell after the player-polish schema/editor changes

## Risks

- Removing visible sync UI should not remove the underlying live-content refresh logic.
- A more ambitious history redesign needs to stay legible on small screens and inside standalone PWA mode.
- PWA icon changes may require both manifest updates and refreshed generated assets to look correct on iOS and Android.
- Shared card-schema changes must stay compatible with existing story data and validation rules.

## Completion Notes

Kickoff complete on 2026-05-03. Initial plan scaffold existed already; this update marks it active, captures scope assumptions, and sets the intended implementation order before code changes begin.

Implementation progress:

- Player chrome now hides the live sync badge and uses a more intentional brand/header treatment while preserving the underlying refresh/subscription logic.
- Choice history now presents as a themed side panel with a scrim, richer metadata, and calmer copy instead of a plain utility drawer.
- The startup path now uses a quiet shell instead of a visible blocking loading screen.
- Player PWA assets now include a stronger seal-and-letter icon treatment, updated manifest colors, and a dedicated Apple touch icon.
- Envelope note motion now fades/lifts away during the open animation to prevent overlap with the envelope.
- Shared story cards now support optional `revealItems`, the admin editor can author them, and the player renders them as a final authored reveal block.

Remaining verification:

- None. Verification and production deployment completed on 2026-05-03.

Final verification and rollout:

- `npm run verify`
- `bash scripts/deploy.sh both`
- Post-deploy smoke check passed for the live player shell, published-story fetch, and admin shell.

Residual notes:

- The preflight check still warns that the local-only AI helper server on `:8787` is not running. That did not block deploy and is expected unless local drafting endpoints are needed.
