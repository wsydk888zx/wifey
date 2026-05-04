# Codex Doc Transition

## Objective

Make `AGENTS.md` the primary Codex-facing project guide, update continuity docs to reference it, and archive the now-unneeded Claude-specific root guide.

## Context

The repo already has strong project guidance, but it is centered on `CLAUDE.md`. Codex expects `AGENTS.md`, so the active guidance path should point there to reduce duplicated instructions and make the repo feel native to Codex.

## Steps

- [x] Add a root `AGENTS.md` as the Codex-native guide
- [x] Update `MEMORY.md` read order and doc update rules
- [x] Archive the legacy `CLAUDE.md` file
- [x] Verify the final active guidance path is clear

## Verification

- [x] Confirm `AGENTS.md` exists at the repo root
- [x] Confirm `MEMORY.md` points to `AGENTS.md`
- [x] Confirm `CLAUDE.md` no longer remains in the repo root

## Completion Notes

Completed on 2026-05-03.

- Added `AGENTS.md` as the primary Codex-facing repo guide.
- Updated active entry-point docs so the current path is `AGENTS.md` -> `MEMORY.md` -> deeper docs.
- Archived `CLAUDE.md` and the old deployment process review into `docs/archive/legacy/`.
- Verified that `CLAUDE.md` no longer exists at the repo root and that the active docs now point to `AGENTS.md`.
