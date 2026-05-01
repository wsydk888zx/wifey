# Two-Surface Dev Plan

Goal: make the repo behave like two supported surfaces only:

- `admin`: authoring app
- `player`: playback app

## Tasks

- [completed] Remove the current "admin edits do not show up in player" dev gap.
- [completed] Make `admin:dev` start the authoring app with its local support server.
- [completed] Make `player:dev` use a stable local URL and read the live admin draft in dev.
- [completed] Update docs so the supported workflow is only admin plus player.
- [completed] Verify the two-surface loop end to end.
