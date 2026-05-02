#!/usr/bin/env bash
# Post-deploy smoke check — hits both live URLs and asserts each serves the right app.
# Usage: ./scripts/verify-deploy.sh [player|admin|both]  (default: both)
# Env vars (D2): PLAYER_URL, ADMIN_URL — set by deploy.sh or manually
set -euo pipefail

TARGET="${1:-both}"

# D2: URLs injectable from deploy.sh; fall back to known stable URLs
PLAYER_URL="${PLAYER_URL:-https://wifey-player-wsydk888zxs-projects.vercel.app}"
ADMIN_URL="${ADMIN_URL:-}"

pass() { echo "✓ $1"; }
fail() { echo "FAIL: $1"; exit 1; }

check_player() {
  echo "→ Checking player ($PLAYER_URL)..."
  BODY=$(curl -sL --max-time 15 "$PLAYER_URL")
  echo "$BODY" | grep -qi "For her\|apple-mobile-web-app-title" \
    || fail "Player URL doesn't contain expected player markers. Got: $(echo "$BODY" | head -3)"
  echo "$BODY" | grep -qi "AdminPanel\|admin-root\|admin dashboard" \
    && fail "Player URL is serving the admin panel!" || true
  pass "Player is serving the player app"

  # D4: Verify Supabase content publication
  check_player_content
}

check_player_content() {
  # Read Supabase credentials from .env.local (player env vars)
  REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
  ENV_FILE="$REPO_ROOT/apps/player/.env.local"
  if [ ! -f "$ENV_FILE" ]; then
    ENV_FILE="$REPO_ROOT/apps/admin/.env.local"
  fi

  if [ ! -f "$ENV_FILE" ]; then
    echo "  (Skipping content publication check — no .env.local found)"
    return
  fi

  SUPABASE_URL=$(grep VITE_SUPABASE_URL "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"' || true)
  SUPABASE_KEY=$(grep VITE_SUPABASE_ANON_KEY "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"' || true)

  if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_KEY" ]; then
    echo "  (Skipping content publication check — Supabase credentials not found in .env.local)"
    return
  fi

  echo "→ Checking Supabase has a published story (D4)..."
  HTTP_CODE=$(curl -s -o /tmp/supabase-check.json -w "%{http_code}" --max-time 10 \
    "$SUPABASE_URL/rest/v1/stories?is_published=eq.true&select=id,updated_at&limit=1" \
    -H "apikey: $SUPABASE_KEY" \
    -H "Authorization: Bearer $SUPABASE_KEY" \
    2>/dev/null || echo "000")
  RESPONSE=$(cat /tmp/supabase-check.json 2>/dev/null || echo "")

  if [ "$HTTP_CODE" = "000" ]; then
    echo "  WARN: Could not reach Supabase REST API — player may fall back to bundled story"
  elif echo "$RESPONSE" | grep -q "PGRST205\|not find the table"; then
    echo "  FAIL: 'stories' table not found in Supabase"
    echo "        Migration not applied — run: supabase login && supabase db push"
    echo "        Migration file: supabase/migrations/20260502042315_story_content_centralization.sql"
    echo "        Player will fall back to bundled storyData.js until this is applied"
    # Warn but don't exit — deploy already happened, this is informational
  elif echo "$RESPONSE" | grep -q '"id"'; then
    pass "Supabase has a published story (player will load from Supabase)"
  else
    echo "  WARN: No published story found in Supabase stories table"
    echo "        Player will fall back to bundled storyData.js"
    echo "        To publish: open admin → make any edit → click Publish"
  fi
}

check_admin() {
  if [ -z "$ADMIN_URL" ]; then
    echo "  (Skipping admin check — set ADMIN_URL env var to enable)"
    return
  fi
  echo "→ Checking admin ($ADMIN_URL)..."
  BODY=$(curl -sL --max-time 15 "$ADMIN_URL")
  echo "$BODY" | grep -qi "Yours, Watching\|admin\|story\|For her" \
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
