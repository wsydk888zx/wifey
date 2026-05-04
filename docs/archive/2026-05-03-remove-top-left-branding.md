# Remove Top-Left Branding

## Objective

Remove the `Yours, Watching` and `for her` label from the top-left area of the player surface so nothing renders there.

## Context

- The player top bar currently renders brand text in `apps/player/src/App.jsx`.
- The remaining top-right controls should stay visually aligned after the left-side content is removed.

## Steps

1. Remove the top-left brand/addressee markup from the player top bar.
2. Adjust the top bar layout so the remaining controls stay right-aligned.
3. Verify the changed UI code is consistent and leave completion notes.

## Verification

- Inspect the updated `TopBar` component markup.
- Inspect the related top bar CSS to confirm the button group remains right-aligned with no placeholder content on the left.

## Completion Notes

- Removed the top-left `Yours, Watching` and addressee label from the player `TopBar`.
- Updated the top bar layout so the remaining actions stay right-aligned with no placeholder content on the left.
- Verified with a successful `npm run build --workspace @wifey/player`.
