# Between Us

A private five-chapter erotic story app built for two.

## Running the app

ES modules require an HTTP server (not `file://`). One-command options:

```bash
# Option 1 — Node (if you have npm)
npx serve /Users/joncarpenter/Wifey

# Option 2 — Python (built-in on macOS)
cd /Users/joncarpenter/Wifey && python3 -m http.server 8080
```

Then open `http://localhost:3000` (serve) or `http://localhost:8080` (python).

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

## Admin panel

Tap the tiny ◆ button bottom-right. Only you should use it. From here you can:
- Set hours between chapters
- Unlock the next chapter manually
- Schedule messages that appear at specific clock times
- Read her Desire Dial setting
- Plan Day 5 choices when she asks you to decide
