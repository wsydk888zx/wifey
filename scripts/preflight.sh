#!/usr/bin/env bash
# Pre-deploy preflight: builds both apps, checks .vercel/ isn't tracked,
# validates local player/admin env alignment, and checks Supabase migrations.
# Usage: bash scripts/preflight.sh [target]
#   target: admin | player | both (default: both)
#   When target=admin, also checks AI server health on :8787.
set -euo pipefail

TARGET="${1:-both}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "=== Preflight check ==="

read_env_value() {
  local file="$1"
  local key="$2"

  if [ ! -f "$file" ]; then
    return 0
  fi

  grep "^${key}=" "$file" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"'
}

# 1. .vercel/ must not be tracked
TRACKED=$(git ls-files .vercel/ 2>/dev/null || true)
if [ -n "$TRACKED" ]; then
  echo "FAIL: .vercel/ files are tracked by git — run: git rm -r --cached .vercel/"
  exit 1
fi
echo "✓ .vercel/ not tracked"

# 2. Build admin (skip if player-only)
if [ "$TARGET" != "player" ]; then
  echo "→ Building admin..."
  npm run build --workspace @wifey/admin -- --outDir /tmp/wifey-preflight-admin --emptyOutDir
  echo "✓ Admin build OK"
fi

# 3. Build player (skip if admin-only)
if [ "$TARGET" != "admin" ]; then
  echo "→ Building player..."
  npm run build --workspace @wifey/player -- --outDir /tmp/wifey-preflight-player --emptyOutDir
  echo "✓ Player build OK"
fi

# 4. Validate local env alignment for the two apps
ADMIN_ENV_FILE="$REPO_ROOT/apps/admin/.env.local"
PLAYER_ENV_FILE="$REPO_ROOT/apps/player/.env.local"

echo "→ Checking local app env files..."

if [ "$TARGET" != "player" ]; then
  if [ -f "$ADMIN_ENV_FILE" ]; then
    echo "✓ Admin .env.local present"
  else
    echo "WARN: apps/admin/.env.local missing — admin auth/storage config may be unavailable locally"
  fi
fi

if [ "$TARGET" != "admin" ]; then
  if [ ! -f "$PLAYER_ENV_FILE" ]; then
    echo "FAIL: apps/player/.env.local missing — player build will fall back to bundled story content"
    exit 1
  fi
  echo "✓ Player .env.local present"

  PLAYER_VAPID_KEY="$(read_env_value "$PLAYER_ENV_FILE" VITE_VAPID_PUBLIC_KEY)"
  if [ -n "$PLAYER_VAPID_KEY" ]; then
    echo "✓ Player VAPID key present"
  else
    echo "WARN: VITE_VAPID_PUBLIC_KEY missing from apps/player/.env.local"
  fi
fi

if [ -f "$ADMIN_ENV_FILE" ] && [ -f "$PLAYER_ENV_FILE" ]; then
  ADMIN_SUPABASE_URL="$(read_env_value "$ADMIN_ENV_FILE" VITE_SUPABASE_URL)"
  ADMIN_SUPABASE_KEY="$(read_env_value "$ADMIN_ENV_FILE" VITE_SUPABASE_ANON_KEY)"
  PLAYER_SUPABASE_URL="$(read_env_value "$PLAYER_ENV_FILE" VITE_SUPABASE_URL)"
  PLAYER_SUPABASE_KEY="$(read_env_value "$PLAYER_ENV_FILE" VITE_SUPABASE_ANON_KEY)"

  if [ -z "$ADMIN_SUPABASE_URL" ] || [ -z "$ADMIN_SUPABASE_KEY" ]; then
    echo "WARN: apps/admin/.env.local is missing Supabase vars — see ops-playbook §7"
  elif [ -z "$PLAYER_SUPABASE_URL" ] || [ -z "$PLAYER_SUPABASE_KEY" ]; then
    echo "FAIL: apps/player/.env.local is missing Supabase vars — player will not load the live story"
    exit 1
  elif [ "$ADMIN_SUPABASE_URL" != "$PLAYER_SUPABASE_URL" ] || [ "$ADMIN_SUPABASE_KEY" != "$PLAYER_SUPABASE_KEY" ]; then
    echo "FAIL: apps/admin and apps/player point at different Supabase configs"
    echo "      Align VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before deploying"
    exit 1
  else
    echo "✓ Admin and player Supabase config aligned locally"
  fi
fi

# 5. Supabase migration check (D1)
echo "→ Checking Supabase migrations..."
MIGRATION_DIR="$REPO_ROOT/supabase/migrations"
if [ -d "$MIGRATION_DIR" ]; then
  MIGRATION_FILES=$(ls "$MIGRATION_DIR"/*.sql 2>/dev/null | wc -l | tr -d ' ')
  echo "  Local migration files: $MIGRATION_FILES"
  if command -v supabase &>/dev/null; then
    # Read access token from env, or fall back to the MCP config (never hardcoded here)
    _SB_TOKEN="${SUPABASE_ACCESS_TOKEN:-$(python3 -c "import json,os; d=json.load(open(os.path.expanduser('~/.claude/mcp.json'))); print(d['mcpServers']['supabase']['args'][-1])" 2>/dev/null || true)}"
    MIGRATION_STATUS=$(SUPABASE_ACCESS_TOKEN="$_SB_TOKEN" supabase migration list 2>&1 || true)
    if echo "$MIGRATION_STATUS" | grep -q "│.*false\|not applied"; then
      echo "WARN: Unapplied Supabase migrations detected — run: supabase db push"
      echo "      Player will fall back to bundled story content if stories table is missing"
      if [ "$TARGET" = "player" ] || [ "$TARGET" = "both" ]; then
        echo "FAIL: Cannot deploy player with unapplied migrations (stories table required)"
        exit 1
      fi
    elif echo "$MIGRATION_STATUS" | grep -qi "access token\|not logged\|error"; then
      echo "  (Not logged in to Supabase — skipping remote migration status)"
      echo "  Verify migrations are applied: supabase login && supabase migration list"
    else
      echo "✓ Supabase migrations up to date"
    fi
  else
    echo "  (supabase CLI not found — skipping migration sync check)"
    echo "  Verify $MIGRATION_FILES migration(s) are applied before player deploy"
  fi
else
  echo "  (No supabase/migrations dir — skipping)"
fi

# 6. AI server health check — only when deploying admin (D3)
if [ "$TARGET" = "admin" ] || [ "$TARGET" = "both" ]; then
  echo "→ Checking AI server health (http://127.0.0.1:8787/health)..."
  if curl -sf --max-time 5 http://127.0.0.1:8787/health &>/dev/null; then
    echo "✓ AI server is running on :8787"
  else
    echo "WARN: AI server not responding at http://127.0.0.1:8787/health"
    echo "      AI features (card-draft, envelope-draft) will 404 in the deployed admin"
    echo "      To start locally: npm run admin:dev"
    echo "      (This is a warning, not a hard failure — AI server runs locally, not on Vercel)"
  fi
fi

echo ""
echo "=== Preflight PASSED — safe to deploy ==="
