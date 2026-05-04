# Her Choices Letter Trail

## Objective

Redesign the player app's "Her Choices" panel so each entry feels like a letter from the app and the overall panel reads like a traveled path rather than a standard stacked list.

## Context

- The active implementation lives in `apps/player/src/App.jsx` and `apps/player/src/styles.css`.
- The current panel is a dark glass side sheet with timeline cards, which does not match the desired "letter" presentation.
- The user wants a preview before anything is pushed or deployed to production.

## Steps

1. Inspect the current "Her Choices" panel markup and styling hooks in the player app.
2. Refactor the entry layout so each choice reads like a letter or note authored by the app.
3. Restyle the panel so the sequence of entries also suggests a path traveled, inspired by the reference image.
4. Verify the player locally and capture a preview before any push or deployment work.

## Verification

- Confirm the player builds successfully after the panel changes.
- Confirm the "Her Choices" panel opens and displays the new letter-trail layout on desktop and mobile widths.
- Confirm a local preview is available to review before any prod rollout.

## Completion Notes

- Reworked the `ChoiceHistoryPanel` entry markup so each completed choice reads like a note sent from the app, with a postmark, stamped header, delivered-path label, and signoff.
- Replaced the old dark timeline styling with a parchment slide-over panel and a staggered dotted route inspired by the provided traveled-path reference.
- Refined the concept after review so the panel reads more like a pinboard: the panel background is now board-like, the individual notes are smaller, and each note has a visible pushpin treatment.
- Verified the player build succeeds and the shared `story-core` test suite still passes.
- Started the local player preview on `http://127.0.0.1:5174/`.
- Screenshot capture was attempted for a shareable preview image, but local browser/screenshot execution was not approved in this session, so no image was captured yet.
