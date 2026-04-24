# Workspace Architecture

This repo is migrating from a single browser preview app at the repository root to a split workspace:

- `apps/player`: the native-packaged iPhone player app
- `apps/admin`: the desktop/browser authoring workspace
- `packages/story-core`: shared logic, constants, and formatting helpers
- `packages/story-content`: bundled story content that the player consumes

## Migration Rules

1. Keep the legacy preview running from the repo root until the new player app can replace it.
2. Move shared logic into `packages/story-core` before copying UI into either app.
3. Keep admin-only code, AI endpoints, and editing controls out of the player app.
4. Prefer a local content publish flow first; add backend infrastructure only after the Personal Team iPhone path is working.
