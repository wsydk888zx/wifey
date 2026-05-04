# Envelope Route Timeline

## Objective

Replace the player's current day-progress medallion strip with a thematic route graphic that uses small envelope markers and a dotted travel path that feels native to the Wifey letter aesthetic.

## Context

- The current `DayTimeline` in `apps/player/src/App.jsx` uses wax-seal medallions and a straight cord.
- The requested direction is closer to a romantic travel route: curved/dashed path, stop markers, and miniature envelope letters from the app rather than generic pins or unrelated icons.
- The updated design should preserve the player's existing typography, wax/parchment palette, and completed/current/future state clarity.

## Steps

1. Update the active timeline markup in `apps/player/src/App.jsx` to support route-style envelope stops and labels.
2. Replace the existing timeline styling in `apps/player/src/styles.css` with a compact "love route" composition using mini envelopes, dashed connectors, and Wifey colors/materials.
3. Verify the player build succeeds and confirm the layout remains usable on desktop and mobile.

## Verification

- `npm run build --workspace @wifey/player`
- Captured a local mobile screenshot from `http://127.0.0.1:5174/` to verify the new route timeline composition and responsive caption layout.

## Completion Notes

- Replaced the straight wax-seal progress row with a curved travel-route strip built from miniature envelope markers, wax dots, and dashed connectors.
- Preserved existing day progression state logic while changing the visual language to feel more like "letters in transit" within the player.
- Tightened the route caption and spacing on narrow mobile widths so the new motif stays readable.
