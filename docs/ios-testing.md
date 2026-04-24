# Personal Team iOS Testing

This project is currently targeting the Personal Team workflow for local iPhone installs.

## Scope

- For your own tethered iPhones only
- Not a long-lived distribution channel
- Rebuild and reinstall when Personal Team profiles expire

## Constraints

- Personal Team supports up to 3 test devices per platform
- Provisioning profiles expire after roughly 7 days
- Developer Mode must be enabled on the device
- CocoaPods is not installed in this environment; current iOS bring-up uses Swift Package Manager

## Planned Player Workflow

1. Run the player app from `apps/player`
2. Build the web bundle
3. If the iOS project is missing, run `npm run ios:add` from `apps/player`
4. Sync the Capacitor iOS project with `npm run ios:sync`
5. Open `apps/player/ios` in Xcode with `npm run ios:open`
6. Sign with your Personal Team
7. Install to a tethered iPhone with Developer Mode enabled

## Current note

- `apps/player/package.json` uses an SPM helper for `npm run ios:add` because the installed Capacitor CLI version still routes the raw `cap add ios --packagemanager SPM` flow through CocoaPods checks
- Simulator blank-screen startup was traced to missing explicit `React` imports in several player `.jsx` files; that is now fixed, so Simulator can be used for local UI verification again

## Immediate Goal

Get the player app packaged and testable with native local notifications before adding any remote push or broader distribution workflow.
