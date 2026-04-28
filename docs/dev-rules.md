# Development Rules

This project is in a migration phase. The main goal is to make changes small, reversible, and easy to verify.

## Current Architecture

- The workspace architecture is the target architecture.
- `apps/player` owns the user-facing player.
- `apps/admin` owns the desktop authoring/admin surface.
- `packages/story-core` owns shared runtime logic.
- `packages/story-content` owns bundled story content.
- The supported local workflow is two running apps: admin plus player.

## Guardrails

- Do not create a second admin panel.
- Do not revive `AdminPanel.jsx` or add a new root admin fallback.
- Do not edit generated `dist` files by hand.
- Do not change localStorage keys without a migration.
- Do not duplicate shared content model or flow-map logic. Move shared behavior into `packages/story-core`.
- Do not ship admin-only code into `apps/player`.
- Keep the player dev app reading either packaged content or the local admin draft service, not ad hoc exports by default.

## Required Checks

Run this before calling a development change complete:

```bash
npm run verify
```

The verification command validates story content and builds both workspace apps into `/tmp` so local generated output stays untouched.

## Change Notes

Each meaningful change should state which area it touches:

- `player`
- `admin`
- `content`
- `flow`
- `infra`

Keep changes scoped to one area when possible.
