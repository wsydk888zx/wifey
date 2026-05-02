#!/usr/bin/env bash
# Pre-deploy preflight: builds both apps, checks .vercel/ isn't tracked,
# diffs admin .env.local against Vercel env vars, and checks Supabase migrations.
# Usage: bash scripts/preflight.sh [target]
#   target: admin | player | both (default: both)
#   When target=admin, also checks AI server health on :8787.
set -euo pipefail

TARGET="${1:-both}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "=== Preflight check ==="

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

# 4. Compare admin .env.local against Vercel env vars (best-effort)
ENV_FILE="$REPO_ROOT/apps/admin/.env.local"
if command -v vercel &>/dev/null && [ -f "$ENV_FILE" ]; then
  echo "→ Checking Vercel admin env vars match .env.local..."
  VERCEL_URL=$(vercel env ls production --scope team_2ZGvGqwT3x8G87WEYTAkd4Ax 2>/dev/null | grep VITE_SUPABASE_URL | awk '{print $1}' || true)
  LOCAL_URL=$(grep VITE_SUPABASE_URL "$ENV_FILE" | cut -d= -f2- | tr -d '"' || true)
  if [ -n "$VERCEL_URL" ] && [ -n "$LOCAL_URL" ] && [ "$VERCEL_URL" != "$LOCAL_URL" ]; then
    echo "WARN: VITE_SUPABASE_URL in Vercel doesn't match .env.local — see ops-playbook §7"
  else
    echo "✓ Env var check passed (or skipped — vercel CLI env output didn't parse)"
  fi
else
  echo "  (Skipping env-var diff — vercel CLI not found or .env.local missing)"
fi

# 5. Supabase migration check (D1)
echo "→ Checking Supabase migrations..."
MIGRATION_DIR="$REPO_ROOT/supabase/migrations"
if [ -d "$MIGRATION_DIR" ]; then
  MIGRATION_FILES=$(ls "$MIGRATION_DIR"/*.sql 2>/dev/null | wc -l | tr -d ' ')
  echo "  Local migration files: $MIGRATION_FILES"
  if command -v supabase &>/dev/null; then
    MIGRATION_STATUS=$(supabase migration list 2>&1 || true)
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
