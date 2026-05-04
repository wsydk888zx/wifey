# Wifey - Codex Project Guide

This file is the Codex-native entry point for working in this repo.

## Read This First

1. Read [MEMORY.md](/Users/joncarpenter/Wifey/MEMORY.md) for current architecture, priorities, and working agreements.
2. Read [docs/ops-playbook.md](/Users/joncarpenter/Wifey/docs/ops-playbook.md) before troubleshooting deploy, auth, build, Supabase, or sync problems.
3. Read [docs/architecture.md](/Users/joncarpenter/Wifey/docs/architecture.md) when changing system boundaries or data flow.
4. Check for an active task plan in `docs/plans/` before starting work.

## Project Shape

`Wifey` is a two-surface interactive story system:

- `apps/admin`: authoring and publishing surface
- `apps/player`: recipient-facing player and PWA
- `packages/story-core`: shared content model, flow, formatting, and validation logic
- `packages/story-content`: bundled fallback story content for builds and recovery paths

The root-level `App.jsx` player and `AdminPanel.jsx` are legacy references, not the target architecture.

## Core Rules

1. Start every scoped task from a Markdown plan in `docs/plans/` and archive finished plans into `docs/archive/`.
2. Treat `apps/admin` and `apps/player` as the only supported interactive surfaces.
3. Do not revive or expand a root-level admin workflow. `apps/admin` is the only supported authoring surface.
4. Prefer editing existing files over creating parallel replacements.
5. Move shared business logic into `packages/story-core` instead of duplicating it across surfaces.
6. Keep bundled fallback content in `packages/story-content`.
7. Do not assume admin and player share device state; they must work as separate devices through Supabase.

## Deployment Reality

Local-only is usually not the real finish line unless the user explicitly says so.

Codex should treat deployment as part of completing the task, not as an optional follow-up the user has to remember to request. If a change affects hosted behavior in `apps/admin` or `apps/player`, the default is to roll it through Vercel before calling the work complete unless the user explicitly says to stop at local changes.

When work is intended to be complete, the default expectation is:

1. Commit and push the code
2. Deploy the affected surface(s) to Vercel
3. Apply and verify any required Supabase changes

The user should only need to opt out of deploy/push work, not opt in.

## Known High-Value Facts

- Vercel project `wifey` builds `apps/admin`
- Vercel project `wifey-player` builds `apps/player`
- Supabase project ID: `bxeoleynlmnhagveqrmn`
- Admin Supabase env vars are baked in at build time; if deployed admin auth breaks, check Vercel env-var sync first

## Content And Data Rules

- Use normalized day envelopes instead of directly relying on legacy `morning` or `prologue` slots
- Use shared helpers from `packages/story-core` for content normalization, placeholders, flow rules, and formatting
- Keep existing localStorage keys stable unless a migration is explicitly part of the task

## Where To Update Docs

- Update `MEMORY.md` when enduring project truths or priorities change
- Update `docs/architecture.md` when topology or responsibilities change
- Update `docs/ops-playbook.md` when a recurring issue or its fix changes
- Update this file when Codex-facing workflow or repo instructions change

## Legacy Notes

- `AdminPanel.jsx` is retained for historical reference only; do not route active work back into it
- The root preview is player-only and should not become the main architecture again
