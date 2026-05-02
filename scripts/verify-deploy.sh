#!/usr/bin/env bash
# Post-deploy smoke check — hits both live URLs and asserts each serves the right app.
# Usage: ./scripts/verify-deploy.sh [player|admin|both]  (default: both)
set -euo pipefail

TARGET="${1:-both}"

PLAYER_URL="https://wifey-player-wsydk888zxs-projects.vercel.app"
# Admin URL not hardcoded — read from vercel output or env
ADMIN_URL="${ADMIN_URL:-}"

pass() { echo "✓ $1"; }
fail() { echo "FAIL: $1"; exit 1; }

check_player() {
  echo "→ Checking player ($PLAYER_URL)..."
  BODY=$(curl -sL --max-time 15 "$PLAYER_URL")
  echo "$BODY" | grep -qi "Yours, Watching" \
    || fail "Player URL doesn't contain expected title 'Yours, Watching'. Got: $(echo "$BODY" | head -3)"
  echo "$BODY" | grep -qi "AdminPanel\|admin-root\|admin dashboard" \
    && fail "Player URL is serving the admin panel!" || true
  pass "Player is serving the player app"
}

check_admin() {
  if [ -z "$ADMIN_URL" ]; then
    echo "  (Skipping admin check — set ADMIN_URL env var to enable)"
    return
  fi
  echo "→ Checking admin ($ADMIN_URL)..."
  BODY=$(curl -sL --max-time 15 "$ADMIN_URL")
  echo "$BODY" | grep -qi "Yours, Watching\|admin\|story" \
    || fail "Admin URL returned unexpected content. Got: $(echo "$BODY" | head -3)"
  pass "Admin URL responded"
}

echo "=== Post-deploy smoke check ==="

case "$TARGET" in
  player) check_player ;;
  admin)  check_admin ;;
  both)   check_player; check_admin ;;
  *) echo "Usage: $0 [player|admin|both]"; exit 1 ;;
esac

echo "=== Smoke check PASSED ==="
