# Strengthen Deploy Default

## Objective

Make the repo instructions explicit that completed hosted-app changes should be deployed to Vercel without the user needing to restate it.

## Context

- `AGENTS.md` already says local-only is usually not the finish line.
- The deployment expectation should be stronger and more explicit for future agent runs.

## Steps

1. Update `AGENTS.md` to state that Codex should proactively deploy affected surfaces by default.
2. Clarify that the user should only need to opt out, not opt in, for Vercel deployment.
3. Archive the task note after the doc update.

## Verification

- Inspect the updated deployment guidance in `AGENTS.md`.

## Completion Notes

- Updated `AGENTS.md` so hosted changes to `apps/admin` or `apps/player` are expected to be pushed and deployed through Vercel by default.
- Clarified that the user should only need to opt out of deploy/push work, not opt in.
