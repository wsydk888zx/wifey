# Design Constraints

Core decisions and constraints that must inform every feature built on this project.

## Deployment topology

| Surface | Target runtime |
|---|---|
| `apps/admin` | Desktop/browser — runs on the author's computer |
| `apps/player` | iOS native app via Capacitor — runs on the recipient's iPhone |

**Admin and player are on separate devices.** Any feature that assumes shared browser storage, same-origin access, or same-device proximity will not work in production.

## Player responses (Phase 4)

The current implementation reads `formResponses` from localStorage in the same browser. This **only works when admin and player are open in the same browser profile on the same device** — which is a dev-only scenario.

For iOS:

- The player is a Capacitor WebView on the recipient's iPhone
- localStorage is scoped to that device and app
- The admin has no access to it

### What must be built

To surface player responses in the admin, the player must POST responses to a backend endpoint, and the admin must read from that backend.

Concretely:

1. **Backend write endpoint** — a route on `apps/admin/server/server.js` (or a separate lightweight service) that accepts `{ envelopeId, choiceId, fieldId, value }` POSTs from the player and stores them (in-memory, a file, or a small DB).
2. **Player write hook** — `apps/player/src/App.jsx` fires a POST whenever `formResponses` changes. Must be non-blocking; network failure must not interrupt the player experience.
3. **Admin polling or push** — the admin Responses panel polls the backend (or uses SSE/WebSocket) instead of reading localStorage.

The localStorage polling path that currently exists is a dev-only convenience. It should be kept as a fallback for local testing but must not be presented as the production solution.

### Security note

The backend endpoint must be protected. The player and admin need a shared secret or token so random requests can't write to the response store. Keep it simple — a single static token in environment config is enough for a private one-recipient app.

## iOS-specific constraints

- Use Capacitor for all native bridging. Do not add Cordova plugins.
- Notifications must go through `@capacitor/local-notifications`. The schedule data lives in `scheduledAt` fields on envelopes (Phase 3).
- Network requests from the Capacitor WebView must target an explicit server URL configured at build time — `localhost` does not resolve to the author's machine from a phone.
- localStorage works within the Capacitor WebView, but is not shared with any other device or browser.

## Out of scope (deliberate non-decisions)

- Multi-user or multi-recipient — this is a one-author, one-recipient app.
- Cloud hosting or accounts — the admin server is local to the author's machine for now.
- Push notifications via APNs — local notifications via Capacitor are sufficient and avoid the APNs registration/cert complexity.
