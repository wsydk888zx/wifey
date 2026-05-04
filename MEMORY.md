# Project Memory

This is the project's continuity file. Keep it short, current, and practical. When architecture, workflow, or recurring operational facts change, update this file alongside the deeper docs.

## What We Are Building

`Wifey` is a two-surface interactive story system:

- `apps/admin`: the authoring and publishing surface
- `apps/player`: the recipient-facing player and PWA
- `packages/story-core`: shared content model, flow, formatting, and validation logic
- `packages/story-content`: bundled fallback story content for builds and recovery paths

## Current Architecture

- Admin drafts live in Supabase and publish to the `stories` table.
- The player reads the latest published story from Supabase and falls back to bundled package content if live content is unavailable.
- Player state and typed responses also flow through Supabase.
- Admin and player are separate surfaces and should be treated as separate devices.
- The root `App.jsx` player and `AdminPanel.jsx` are legacy references, not the target architecture.

## Deployment Topology

- Vercel project `wifey`: builds `apps/admin`
- Vercel project `wifey-player`: builds `apps/player`
- Supabase project `bxeoleynlmnhagveqrmn`: auth, stories, versions, player state, responses, push subscriptions
- Admin AI server: local-only via `apps/admin/server/server.js`

## Read Order At Session Start

1. `AGENTS.md`
2. `MEMORY.md`
3. `docs/ops-playbook.md` for recurring failures and exact fixes
4. `docs/architecture.md` for system topology
5. The active task plan in `docs/plans/`

## Working Agreement

- Every task starts with a scoped Markdown plan in `docs/plans/`.
- Every active plan should include: objective, context, steps, verification, and completion notes.
- Update the plan during the work, not only at the end.
- When the task is complete, add the outcome and verification notes, then move the plan to `docs/archive/`.
- Do not rely on chat history as the only record of intent or progress.

## Definition Of Done

- Appropriate local verification is complete, usually `npm run verify` when app behavior changed.
- If the task affects hosted behavior, finish the GitHub, Vercel, and Supabase rollout unless the user explicitly says to stop earlier.
- The relevant docs are updated when the change alters architecture, workflow, or recurring operational knowledge.

## Current Priorities

- Preserve the two-surface architecture and avoid reviving root-level admin workflows.
- Keep the Supabase-backed draft, publish, and player-sync path healthy.
- Prefer small, reversible changes with clear verification.
- Capture repeated incidents in `docs/ops-playbook.md` instead of rediscovering them later.
- Remove or correct stale process docs when they conflict with the live architecture.

## Update Rules

- Update `MEMORY.md` when enduring project truths change.
- Update `docs/architecture.md` when topology or responsibilities change.
- Update `docs/ops-playbook.md` when a problem recurs or the fix meaningfully changes.
- Update `docs/plan-workflow.md` and `AGENTS.md` when the team changes how work should begin or end.
