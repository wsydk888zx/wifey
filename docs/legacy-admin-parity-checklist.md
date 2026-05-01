# Legacy Admin Parity Checklist

Purpose: verify that the workspace admin can replace the legacy root `AdminPanel.jsx` without losing authoring or recovery features.

## Summary

Status: complete.

The workspace admin now covers the main authoring loop: validation, prologue editing, day/envelope/choice structure and copy editing, response fields, flow rules, AI drafts, snapshots, import/export, and publish export.

Full player-progress reset is owned by the workspace player, because player state is local to the player browser/WebView origin. The workspace admin owns authoring recovery for content, flow, snapshots, and settings.

The legacy root admin retirement path is complete: the visible root Admin controls were first hidden behind an explicit fallback flag, then the fallback was removed after package-content promotion was accepted. The root preview no longer loads `AdminPanel.jsx`, and `?legacyAdmin=1` is no longer a supported authoring path. The root preview smoke checklist passed before removal, including the two follow-up drag/import checks and the fallback-gated verification pass.

Real-text messaging is no longer part of the target product scope. The cleanup slice removed `card.realText` authoring/runtime behavior, queued text prompts, SMS links, recipient phone/webhook settings, browser notification prompt handling, and the Capacitor local notification dependency.

## Feature Parity

| Legacy admin surface | Workspace admin status | Notes |
|---|---|---|
| Overview metrics | Covered | Workspace Overview shows validation, story metrics, draft actions, and day health. |
| Settings: names and intensity | Covered | Workspace admin has a Settings section for persisted non-messaging `tweaks`: her name, his name, and intensity. |
| Prologue editor | Covered | Workspace Story section edits prologue lines and sign-off, previews output, saves draft, exports JSON, and can reset prologue. |
| Day copy fields | Covered | Workspace edits day id, theme, branch-only state, and day prelude fields. |
| Envelope copy fields | Covered | Workspace edits envelope id, label, time label, seal motif, branch-only state, intro, choice heading, and choice intro. |
| Choice/card copy fields | Covered | Workspace edits choice id, title, hint, card heading, card body, and card rule/footer. |
| Response fields | Covered | Workspace supports text, textarea, single-select, multi-select, required state, placeholder, help text, and options. |
| Placeholder preview | Partially covered | Workspace has a selected-field placeholder preview panel. Legacy still has an inline `PlaceholderBar` on text fields. |
| Structural editing | Covered | Workspace can add/remove days, envelopes, and choices, plus move envelopes with explicit up/down controls. New days are capped at the five canonical days supported by shared content normalization. |
| Real-text choice configuration | Removed | `card.realText` authoring/runtime behavior is gone and shared validation rejects it in imported content. |
| Flow rules | Covered | Workspace shows automatic defaults, end points, explicit rules, field-based conditions, and target envelopes. |
| AI card and envelope drafts | Covered | Workspace has a dedicated AI Drafts section and uses the workspace admin server endpoints. |
| Snapshots | Covered | Workspace supports save, compare, restore, delete, and export. |
| Import/export current content | Covered | Workspace imports and exports the `{ content, flowMap }` wrapper. |
| Publish/release export | Workspace-only improvement | Workspace has a release checkpoint with validation blocking. Legacy does not. |
| Queued real-world prompts | Removed | Prompt queues, SMS launch links, recipient phone/webhook settings, and notification handling are gone. |
| Recovery controls | Covered by ownership split | Workspace admin can reset the admin draft, settings, prologue, snapshots, content, and flow. Workspace player owns full player-progress reset from the player UI. |
| Legacy root browser globals | Legacy-only | `window.getGameContent`, `window.replacePlaceholders`, `window.normalizeGameContent`, `window.getDayEnvelopes`, and `window.buildCompleteFlowMap` must remain while the root player preview exists. |

## Historical Root Admin Smoke Checklist

This checklist was run before hiding and removing the legacy admin entry. Do not use it as the current root preview smoke checklist; the root admin surface no longer exists.

Status: passed on 2026-04-25.

Notes:

- The primary root smoke pass covered prologue rendering, admin tab navigation, settings/name placeholder edits, prologue edits, day/envelope/choice/response-field edits, structural add/remove controls, flow-rule add/clear behavior, snapshot save/restore/export/delete, Full Reset behavior, and restored local state after temporary checks.
- Follow-up isolated Chrome smoke on `http://localhost:8010` verified legacy envelope drag-and-drop by moving `d1m` ahead of `d1p`, confirming saved order, and restoring `d1p`, `d1m`, `d1e`.
- The same isolated smoke imported `yours-watching-config.json` through the actual Versions file input and confirmed the saved imported draft contained 12 envelopes, 29 choices, and 3 explicit flow rules.
- The fallback-gated verification pass on 2026-04-25 confirmed the default root preview hides Admin on prologue, active player, and finale states; the missing-content render branch used the same fallback-gated `TopBar`; `?legacyAdmin=1` still opened `AdminPanel.jsx` before the fallback removal slice.
- The follow-up retirement slice removed the root Admin fallback wiring and dropped the `AdminPanel.jsx` script from the legacy root HTML. Workspace admin is now the only supported authoring surface.
- The workspace admin authoring pass edited the prologue in memory, reached the Publish checkpoint, and confirmed `Export Release JSON` succeeds from the current draft.
- Browser console stayed free of runtime errors; the only warning was the expected in-browser Babel transformer warning.

1. Start the legacy root preview with `npm run legacy:preview`.
2. Open the root app and confirm the prologue renders without the runtime error fallback.
3. At the time, use the root Admin entry to open `AdminPanel.jsx`, switch through every tab, and close the panel.
4. In Settings, edit names and intensity, then confirm placeholder text and saved state still use those values.
5. In Prologue, edit one temporary line, save it, confirm the root preview reflects it, then restore the original value.
6. In Story, edit a day theme, envelope label/intro, choice title/body/rule, and response field, then confirm each change persists after saving and reloading.
7. Add and remove a temporary choice, envelope, and day in the legacy admin, then confirm reset restores the expected defaults.
8. Move an envelope with the legacy drag handle and confirm the preview sequence remains stable, then restore or reset.
9. In Flow Map, add an explicit path, confirm it appears under explicit rules, then clear branch rules.
10. In Versions, save a snapshot, compare or restore it, export it, delete it, and import a known-good wrapper config.
11. Confirm no target smoke coverage depends on real-text prompts, SMS links, webhook delivery, or browser notifications.
12. Use Full Reset and confirm player progress resets while content and flow overrides are preserved as intended.
13. Re-run `npm run verify`.
14. Check the browser console and terminal for runtime errors.

## Remaining Workspace Parity Work

Recommended order:

1. Add workspace admin settings storage and UI for non-messaging `tweaks`: names and intensity. Done.
2. Add workspace Story controls for ids and structure: day id, envelope id, choice id, add/remove day, add/remove envelope, add/remove choice, and a clear stance on envelope reordering. Done.
3. Remove real-text messaging from the target scope: `card.realText` authoring, prompt queues, SMS links, recipient phone/webhook settings, and notification prompt handling. Done.
4. Decide whether player progress reset belongs in `apps/admin`, `apps/player`, or remains legacy-only until the root preview is retired. Done: player progress reset belongs in `apps/player`.
5. After gaps are closed, run the root preview smoke checklist and document the result in `docs/stabilization-plan.md`. Done.
6. Choose the root admin retirement path: hide behind a fallback flag, remove from the root preview, or keep visible for one more real authoring pass. Done: hidden behind the fallback flag first, then removed after package-content promotion was accepted.
7. Verify the fallback-gated default and explicit fallback behavior. Done before removal.
8. Remove the root Admin fallback once the workspace player/admin replacement path is accepted end to end. Done: root preview no longer loads `AdminPanel.jsx`.
