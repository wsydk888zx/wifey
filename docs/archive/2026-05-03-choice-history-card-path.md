# Choice History Card Path

## Objective

Restyle the player choice-history panel so previous choices read as small thematic cards connected by a visible path.

## Context

- The current panel uses a ledger-like timeline treatment that no longer fits the player surface.
- The existing choice-history data and interaction flow should remain unchanged.

## Steps

1. Update the choice-history copy and markup only where needed to support a card-and-path presentation.
2. Replace the current ledger styling with connected choice cards in the player CSS.
3. Build the player app to verify the updated UI compiles cleanly.

## Verification

- Inspect the updated choice-history JSX structure.
- Inspect the related CSS for the card/path treatment.
- Run `npm run build --workspace @wifey/player`.

## Completion Notes

- Reworked the choice-history presentation into connected choice cards with a visible path node between entries.
- Updated the panel intro copy to match the new tone.
- Added a mobile-specific reset so the staggered card effect does not feel cramped in the bottom-sheet layout.
- Verified with a successful `npm run build --workspace @wifey/player`.
