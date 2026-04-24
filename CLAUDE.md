# Yours, Watching — Project Guide for Claude

## What this project is

A browser-based interactive story experience ("Yours, Watching"). The recipient moves through days and envelopes, makes choices, and sees branching narrative. It runs as a static site with React (via Babel, no build step) and an optional Node server for AI features.

## File map — what is authoritative

| File | Purpose |
|---|---|
| `content.js` | Source of truth for all story content (`window.GAME_CONTENT`) |
| `App.jsx` | Root React app, all state, routing between views |
| `AdminPanel.jsx` | **The one and only admin panel.** Full content + flow editor. Do not replace or duplicate. |
| `engine.js` | Story progression logic, envelope flattening, flow map traversal |
| `story.js` | Narrative text and story data |
| `state.js` | localStorage save/load |
| `Envelope.jsx` | Envelope rendering component |
| `Prologue.jsx` | Prologue screen |
| `TaskCard.jsx` | Task/choice card rendering |
| `styles/base.css` | Core design tokens (vars: `--brass`, `--cream`, `--parchment`, `--serif`, `--sans`, `--red-pulse`) |
| `styles/panels.css` | Panel and overlay styles |
| `server.js` | Node server — AI card-draft endpoint (`/api/card-draft`) |

## AdminPanel.jsx — features that MUST all exist

The admin panel (`AdminPanel.jsx`) is the product of many sessions. It contains:

- **DayEditor** — edit day-level fields (theme, branchOnly flag)
- **EnvelopeEditor** — edit per-envelope: intro, choicesHeading, choicesIntro, timeLabel, sealMotif, label, branchOnly
- **ChoiceEditor** — edit choices: text, card body, card inputs (text/textarea/select fields), branching flags
- **FlowMap** — visual flow rule editor: source choice → target envelope routing, conditional rules
- **PrologueEditor** — edit prologue lines and signoff
- **PlaceholderBar** — live preview of `{{herName}}` / `{{hisName}}` tokens inline in any field
- **Snapshot system** — save/restore named snapshots of the full content state
- `window.getGameContent()` — public API other components use to read (possibly edited) content
- `window.replacePlaceholders(text, tweaks)` — global placeholder replacement
- `window.normalizeGameContent` / `window.getDayEnvelopes` / `window.buildCompleteFlowMap` — exported globals used by engine

**Never remove any of these. Never replace AdminPanel.jsx with a new file — refactor it in place.**

## Rules for working on this project

1. **No greenfield rewrites of existing components.** When improving or redesigning something, edit the existing file. Creating a parallel replacement file causes feature loss and wiring confusion. This has happened before and caused serious regressions.

2. **The admin panel is the most complex component.** Before touching AdminPanel.jsx, read its full feature list above and verify all features are preserved after any change.

3. **One admin panel.** `App.jsx` renders `AdminPanel` when `tweaksOpen` is true. There is no second admin system. Do not add a second one.

4. **CSS files are in `styles/`.** Don't create new CSS files in the root. Don't create component-specific CSS files unless strictly necessary — prefer inline styles (AdminPanel uses the `S = {}` inline style object pattern) or additions to existing CSS files.

5. **No build step.** This is a pure browser app — React via CDN, Babel transpile in-browser. Don't add Webpack, Vite, npm build scripts, or ES module imports (`import/export`). All scripts are loaded via `<script>` tags in `index.html`.

6. **Content model.** Days have an `envelopes` array (normalized form) or legacy `prologue/morning/evening` slots. Always use `getDayEnvelopes(day)` — never access `day.morning` or `day.prologue` directly. Use `normalizeContentModel()` before saving. New envelopes need an `id` field.

7. **localStorage keys** (don't change these):
   - `yoursWatching:contentEdits:v2` — story content edits
   - `yoursWatching:flowMap:v2` — flow map rules
   - `yoursWatching:snapshots:v1` — snapshots
   - `yoursWatching:state:v1` — player game state
   - `yoursWatching:tweaks:v1` — names/settings tweaks

8. **Design tokens** — always use CSS variables from `base.css`. Never hardcode `#c9a961` — use `var(--brass)`. Never hardcode fonts — use `var(--serif)` (Cormorant Garamond) and `var(--sans)` (Inter).

## AI features

- **Choice-level AI** (`AIChoiceConfigurator`): inside each expanded choice in the Story tab. Calls `/api/card-draft`. Returns `{title, hint, heading, body, rule}`.
- **Envelope-level AI** (`AIEnvelopePanel`): below each envelope in the Story tab. Calls `/api/envelope-draft`. Returns `{intro, choicesHeading, choicesIntro}`.
- Both endpoints use `claude-haiku-4-5` with JSON schema output. Server must be running (`node server.js`) for AI to work.
- Client-side fallback rewrite functions exist (`buildConfiguratorDraft`, `rewriteBodyText`, etc.) but are separate from the API calls.

## Flow map

- `FlowMap` component shows two sections: **Unmapped choices** (all choices following automatic routing, with "+ Add path" buttons) and **Explicit paths** (choices with override rules). Every choice is visible — none are hidden.
- Auto-routes are derived from `buildCompleteFlowMap(content, { rules: [] })` — this gives the default linear sequence.
- Explicit rules override the auto-route for a given source choice.

## Story editor drag-and-drop

- Envelopes within a day are draggable (HTML5 DnD). The drag grip icon is `⠿`.
- Dragging reduces opacity of the source envelope to 0.35. Drop target gets a gold left border highlight.
- Cross-day reordering is NOT supported — only within the same day.

## What the TopBar "Admin" button does

Opens `AdminPanel` via `setTweaksOpen(true)`. This is the only admin entry point. There is no separate "Story Editor" button — it was removed because it opened a broken, incomplete replacement.
