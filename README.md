# Between Us

A private five-chapter erotic story app built for two.

## Two supported surfaces

This repo now has two supported browser surfaces in development:

- Admin authoring app: `npm run admin:dev`
- Player app: `npm run player:dev`

Default local URLs:

- Admin: `http://127.0.0.1:5174`
- Player: `http://127.0.0.1:5173`

When the admin local service is running, the player dev app automatically follows the current
admin draft. That means you edit in admin and view the result in player without exporting JSON
just to sanity-check the flow.

## NFC / QR location triggers

Place NFC tags or QR codes around the house. Each encodes a URL like:

```
http://your-local-ip:3000/?trigger=bedroom
http://your-local-ip:3000/?trigger=bathroom
http://your-local-ip:3000/?trigger=kitchen
http://your-local-ip:3000/?trigger=shower
http://your-local-ip:3000/?trigger=closet
http://your-local-ip:3000/?trigger=livingroom
```

Replace `your-local-ip` with your Mac's local IP (System Settings → WiFi → Details).  
NFC tags: write with any NFC writer app (~$10 for 10 tags on Amazon).  
QR codes: generate free at qr-code-generator.com or similar.

When she scans one, it logs to the Movement Record in the Memory Wall, pulses the presence dot, and shows a toast message.

## Release smoke

The player build still consumes bundled package content from `@wifey/story-content`.
If you want to check an exported release wrapper directly, you can still open the player with a
`?releaseUrl=` query that points at a local `{ content, flowMap }` JSON file on the same origin.

## Promoting release content

After an admin release export has been reviewed and accepted, promote that exported
`{ content, flowMap }` wrapper into the bundled story package before building the native player:

```bash
npm run promote:content -- /absolute/path/to/yours-watching-release_2026-04-25.json
npm run verify
```

Use `--dry-run` first when checking an export without changing `packages/story-content`.
The command validates the export, normalizes the content model, stores the exported flow map as
`defaultFlowMap`, and rewrites `packages/story-content/src/storyData.js` for player builds.
