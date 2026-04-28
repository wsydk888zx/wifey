# Yours, Watching — Project Guide for Claude

## What this project is

A private interactive story experience ("Yours, Watching"). The recipient moves through days and envelopes, makes choices, and sees branching narrative.

The project has two surfaces:

- `apps/player`: user-facing player app, built with Vite and Capacitor — ships as an iOS native app
- `apps/admin`: authoring surface, built with Vite — **hosted on Vercel**
- `packages/story-core`: shared content model, flow, placeholder, and formatting logic
- `packages/story-content`: bundled story content

## Deployment

| Surface | Runtime | Host |
|---|---|---|
| `apps/player` | iOS native (Capacitor) | Device |
| `apps/admin` | Browser | Vercel |
| Admin AI server (`apps/admin/server/server.js`) | Node.js | Local (author's machine) |
| Player responses | Supabase `player_responses` table | Supabase (hosted) |

**Admin and player are always on separate devices.** Never build features that assume shared browser storage or same-device access. Player responses flow through Supabase so they work on any network.

The root app is a legacy player-only fallback. Do not treat it as the long-term architecture. See `docs/dev-rules.md` and `docs/architecture.md` before changing structure.

## File map — what is authoritative

| File | Purpose |
|---|---|
| `content.js` | Legacy root adapter exposing package story data to the root preview globals |
| `App.jsx` | Legacy root React app, all state, routing between views |
| `AdminPanel.jsx` | Retired legacy root admin panel kept for historical reference only. Do not revive it as an authoring path. |
| `apps/player` | Target player app |
| `apps/admin` | Target admin app scaffold; migrate admin features here deliberately |
| `packages/story-core` | Target home for shared runtime and content-model logic |
| `packages/story-content` | Target home for bundled story content |
| `engine.js` | Story progression logic, envelope flattening, flow map traversal |
| `story.js` | Narrative text and story data |
| `state.js` | localStorage save/load |
| `Envelope.jsx` | Envelope rendering component |
| `Prologue.jsx` | Prologue screen |
| `TaskCard.jsx` | Task/choice card rendering |
| `styles/base.css` | Core design tokens (vars: `--brass`, `--cream`, `--parchment`, `--serif`, `--sans`, `--red-pulse`) |
| `styles/panels.css` | Panel and overlay styles |
| `server.js` | Node server — AI card-draft endpoint (`/api/card-draft`) |

## AdminPanel.jsx — retired legacy reference

The retired root admin panel (`AdminPanel.jsx`) was the product of many sessions. Its replacement is the workspace admin app in `apps/admin`. Do not route users back to the root admin fallback or create new root-level admin entry points.

Historically, it contained:

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

Do not edit or revive this file unless a scoped archival/removal task explicitly calls for it. Active admin work belongs in `apps/admin`.

## Rules for working on this project

0. **Always work from a Markdown plan.** For every ask, either use an existing plan file (for example `docs/stabilization-plan.md`) or create/update a scoped `.md` plan before treating the work as underway. Do not rely on chat-only plans as the source of truth. As progress is made, update the plan file in the same turn so it reflects what is done, what is partial, and what remains next.

1. **No greenfield rewrites of existing components.** When improving or redesigning something, edit the existing file. Creating a parallel replacement file causes feature loss and wiring confusion. This has happened before and caused serious regressions.

2. **The retired admin panel is complex.** Avoid touching `AdminPanel.jsx` unless the task is explicitly about archiving, deleting, or comparing the retired legacy admin.

3. **No root admin panel.** `apps/admin` is the only supported authoring surface. Do not add a root-level admin fallback or wire `AdminPanel.jsx` back into `App.jsx`.

4. **CSS files are in `styles/`.** Don't create new CSS files in the root. Don't create component-specific CSS files unless strictly necessary — prefer inline styles (AdminPanel uses the `S = {}` inline style object pattern) or additions to existing CSS files.

5. **Build rules depend on surface.** The legacy root preview is a pure browser app: React via CDN, Babel transpile in-browser, scripts loaded via `<script>` tags in `index.html`. The workspace apps use Vite. Do not add a root build step for the legacy preview, and do not remove the existing workspace build scripts.

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
- Both endpoints use `claude-haiku-4-5` with JSON schema output. The workspace admin AI server must be running with `npm run ai:server --workspace @wifey/admin` for AI drafting to work.
- Client-side fallback rewrite functions exist (`buildConfiguratorDraft`, `rewriteBodyText`, etc.) but are separate from the API calls.

## Flow map

- `FlowMap` component shows two sections: **Unmapped choices** (all choices following automatic routing, with "+ Add path" buttons) and **Explicit paths** (choices with override rules). Every choice is visible — none are hidden.
- Auto-routes are derived from `buildCompleteFlowMap(content, { rules: [] })` — this gives the default linear sequence.
- Explicit rules override the auto-route for a given source choice.

## Story editor drag-and-drop

- Envelopes within a day are draggable (HTML5 DnD). The drag grip icon is `⠿`.
- Dragging reduces opacity of the source envelope to 0.35. Drop target gets a gold left border highlight.
- Cross-day reordering is NOT supported — only within the same day.

## Root Preview

The legacy root preview is player-only. It no longer loads `AdminPanel.jsx`, and there is no supported `?legacyAdmin=1` fallback. Use `npm run admin:dev` for authoring and `npm run player:dev` for the workspace player.
