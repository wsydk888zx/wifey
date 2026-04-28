# Workspace Architecture

The supported development workflow is a two-surface workspace:

- `apps/admin`: desktop/browser authoring workspace
- `apps/player`: player app for browser and native packaging
- `packages/story-core`: shared logic, constants, and formatting helpers
- `packages/story-content`: bundled story content that the player consumes in builds

In development, the admin local service can publish the current draft directly to the player app so
authoring and playback stay in sync without an export/import loop.

## Rules

1. Treat `apps/admin` and `apps/player` as the only supported interactive surfaces.
2. Move shared logic into `packages/story-core` before copying UI into either app.
3. Keep admin-only code, AI endpoints, and editing controls out of the player app.
4. Keep packaged release content in `packages/story-content`; use live draft sync only for local development.
