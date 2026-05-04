# Restore Previous Published Story

## Objective

Restore the previously published story so the player no longer serves the newest publish the user wants to undo.

## Context

- Published stories live in Supabase `stories`.
- Immutable publish history lives in Supabase `story_versions`.
- The codebase already supports creating a rollback draft from a historical version, but the current admin UI does not expose a direct restore flow.

## Steps

1. Inspect the live published story row and recent `story_versions` history.
2. Identify the version immediately before the current publish.
3. Restore that version using the safest available path.
4. Verify the previous version is now the live published story.

## Verification

- Confirm the restored story is the only `stories` row with `is_published = true`.
- Confirm its `version_number` and `published_at` match the expected rollback outcome.

## Completion Notes

- Inspected live `stories` and `story_versions` in the linked Supabase project.
- Found the previous published story in `stories.id = 2`; the version-history table only contained snapshots of the newer publish, so restore used the prior unpublished story row directly.
- Created a backup snapshot of the newer live story in `story_versions` before restoring.
- Restored the previous story by unpublishing `stories.id = 1` and marking `stories.id = 2` as published again.
- Verified `stories.id = 2` is now the only published row and the newer story remains recoverable via `story_versions`.
