# Mobile iOS Migration Plan

This project is migrating from a single browser preview app into a split workspace for Personal Team iPhone testing.

## Current target

- Native-installed iPhone player app
- Desktop/browser-only admin console
- Personal Team workflow for local installs on your own phones only
- Core player flow first; real-text notification/SMS prompts are no longer in target scope
- No App Store distribution in this phase

## Completed

### Workspace scaffold

- Root workspace configured in `/Users/joncarpenter/Wifey/package.json`
- New app folders created:
  - `/Users/joncarpenter/Wifey/apps/player`
  - `/Users/joncarpenter/Wifey/apps/admin`
- New shared package folders created:
  - `/Users/joncarpenter/Wifey/packages/story-core`
  - `/Users/joncarpenter/Wifey/packages/story-content`

### Player scaffold

- Starter Vite app created in `/Users/joncarpenter/Wifey/apps/player`
- Capacitor config added at `/Users/joncarpenter/Wifey/apps/player/capacitor.config.ts`

### Player migration

- Legacy player flow ported into `/Users/joncarpenter/Wifey/apps/player/src/App.jsx`
- Player components migrated into:
  - `/Users/joncarpenter/Wifey/apps/player/src/components/Prologue.jsx`
  - `/Users/joncarpenter/Wifey/apps/player/src/components/Envelope.jsx`
  - `/Users/joncarpenter/Wifey/apps/player/src/components/TaskCard.jsx`
- Player-specific styles moved into `/Users/joncarpenter/Wifey/apps/player/src/styles.css`
- Admin entry points removed from the new player app
- Player content now reads from `@wifey/story-content`
- Shared placeholder/content-model/runtime helpers now read from `@wifey/story-core`
- New player runtime helper module added at `/Users/joncarpenter/Wifey/packages/story-core/src/contentModel.js`
- `@wifey/story-content` now owns bundled story content promoted from an accepted release export; `/Users/joncarpenter/Wifey/content.js` is only a root-preview adapter.
- Real-text/text-prompt notification behavior was later de-scoped and removed from `/Users/joncarpenter/Wifey/apps/player/src/App.jsx`
- Production player build verified with `npm run player:build`

### Player iOS bring-up

- `apps/player` now includes `typescript` in devDependencies so Capacitor can load `/Users/joncarpenter/Wifey/apps/player/capacitor.config.ts`
- Dev-mode player startup verified with `npm run dev -- --host=127.0.0.1 --port=4173` from `/Users/joncarpenter/Wifey/apps/player`
- Local dev server responded successfully at `http://127.0.0.1:4173/`
- Native iOS project created at `/Users/joncarpenter/Wifey/apps/player/ios`
- iOS add flow now uses Swift Package Manager instead of CocoaPods
- New helper script added at `/Users/joncarpenter/Wifey/apps/player/scripts/add-ios-spm.cjs`
- `apps/player/package.json` now routes `npm run ios:add` through that SPM helper
- `npm run ios:sync` now completes successfully from `/Users/joncarpenter/Wifey/apps/player`
- `npm run ios:open` successfully opens the generated Xcode project
- `xcodebuild -list -project ios/App/App.xcodeproj` now resolves the package graph successfully when run outside the sandbox
- Simulator blank-screen startup failure was reproduced and diagnosed as `ReferenceError: Can't find variable: React` in the packaged player bundle
- The fix was to add explicit `React` imports to:
  - `/Users/joncarpenter/Wifey/apps/player/src/App.jsx`
  - `/Users/joncarpenter/Wifey/apps/player/src/components/Envelope.jsx`
  - `/Users/joncarpenter/Wifey/apps/player/src/components/Prologue.jsx`
  - `/Users/joncarpenter/Wifey/apps/player/src/components/TaskCard.jsx`
- After rebuild + sync, the simulator app renders again instead of failing on startup
- Resolved iOS packages include:
  - Local `CapApp-SPM`
  - Remote `capacitor-swift-pm`

### Admin scaffold

- Starter Vite app created in `/Users/joncarpenter/Wifey/apps/admin`
- Placeholder admin server created at `/Users/joncarpenter/Wifey/apps/admin/server/server.js`

### Shared code scaffold

- Shared constants and helpers added in:
  - `/Users/joncarpenter/Wifey/packages/story-core/src/constants.js`
  - `/Users/joncarpenter/Wifey/packages/story-core/src/placeholders.js`
  - `/Users/joncarpenter/Wifey/packages/story-core/src/formatting.js`
- Starter bundled content added in:
  - `/Users/joncarpenter/Wifey/packages/story-content/src/defaultContent.js`

### Docs

- Architecture notes: `/Users/joncarpenter/Wifey/docs/architecture.md`
- Personal Team testing notes: `/Users/joncarpenter/Wifey/docs/ios-testing.md`

## Important notes

- The legacy root preview app is still active as a player-only fallback.
- `npm install` has now been run successfully for the workspace.
- `package-lock.json` now reflects the workspace layout.
- `apps/player/package.json` and `apps/admin/package.json` use local `file:` package links instead of `workspace:*` because the current local npm toolchain errored on `workspace:*`.
- The new player consumes bundled package content from `@wifey/story-content`.
- CocoaPods is not installed in this environment right now.
- Capacitor CLI `7.2.0` still misroutes `npx cap add ios --packagemanager SPM` through CocoaPods checks, so `/Users/joncarpenter/Wifey/apps/player/scripts/add-ios-spm.cjs` is the current reproducible workaround.
- The iOS project is now present at `/Users/joncarpenter/Wifey/apps/player/ios` and is configured for SPM bring-up.
- iOS Simulator is now usable for local UI smoke tests on this Mac after the React import fix.
- The remaining blocker is manual Personal Team signing plus on-device install/verification in Xcode.
- Dev-mode startup was confirmed by server launch and HTTP response, and simulator rendering was confirmed after the startup-failure fix.
- Git is initialized in this folder.

## Next phase

The next implementation slice is Personal Team signing plus first on-device verification, with Simulator available as a local fallback for UI checks.

### Goal

Take the now-generated Capacitor iOS player from Xcode-open state to a successful Personal Team install on a real iPhone, then verify the core story flow end to end.

### Current player entry points

- `/Users/joncarpenter/Wifey/apps/player/src/App.jsx`
- `/Users/joncarpenter/Wifey/apps/player/src/components/Prologue.jsx`
- `/Users/joncarpenter/Wifey/apps/player/src/components/Envelope.jsx`
- `/Users/joncarpenter/Wifey/apps/player/src/components/TaskCard.jsx`
- `/Users/joncarpenter/Wifey/apps/player/src/styles.css`

### Rules for the next session

1. Keep the legacy root player preview in place as a fallback until the workspace player path is accepted end to end.
2. Keep using the SPM-based `npm run ios:add` helper instead of the raw Capacitor add command unless the CLI version is upgraded and retested.
3. Preserve the current `apps/player` UI/flow unless native boot exposes a real issue.
4. If content packaging becomes a blocker during native boot, keep fixes in `packages/story-content` or `packages/story-core` instead of adding more root-level coupling.

### Specific next tasks

1. In Xcode, open `/Users/joncarpenter/Wifey/apps/player/ios/App/App.xcodeproj` if it is not already open.
2. Set the `App` target signing team to the Personal Team account and fix any bundle-signing prompts.
3. Connect the target iPhone, enable Developer Mode if needed, choose the device as the run target, and install the app.
4. Play through the prologue, envelope open, choice, response field, and completion flow.
5. Confirm no notification permission prompt, text-prompt tray, or Messages deep link appears.
6. If install or launch fails, capture the exact Xcode signing/build/runtime error in this doc before changing code.

### Current place

- Browser build works.
- Capacitor iOS project exists and syncs successfully.
- Simulator startup regression is fixed and the app renders again locally.
- The remaining unverified path is real-device Personal Team signing, install, and core story behavior on an actual iPhone.

## After iOS boot succeeds

Once the migrated player is running on-device:

1. Enable Developer Mode on the iPhone if it is not already enabled.
2. Smoke-test prologue, envelope opening, choices, response fields, branching, and reset behavior on-device.
3. Move any remaining root-bound content/runtime pieces into the workspace packages if they are still only bridged.
4. Continue the admin split as a separate desktop/browser-only surface.

## Personal Team constraints

- Up to 3 test devices per platform
- Provisioning/profile validity is short-lived and requires periodic rebuild/reinstall
- This phase is for personal testing, not real distribution
