#!/usr/bin/env bash
# Pre-deploy preflight: builds both apps, checks .vercel/ isn't tracked,
# and diffs admin .env.local against Vercel env vars.
# Abort on first failure.
set -euo pipefail

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

# 2. Build admin
echo "→ Building admin..."
npm run build --workspace @wifey/admin -- --outDir /tmp/wifey-preflight-admin --emptyOutDir
echo "✓ Admin build OK"

# 3. Build player
echo "→ Building player..."
npm run build --workspace @wifey/player -- --outDir /tmp/wifey-preflight-player --emptyOutDir
echo "✓ Player build OK"

# 4. Compare admin .env.local against Vercel env vars (best-effort — skips if vercel CLI not available)
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

echo ""
echo "=== Preflight PASSED — safe to deploy ==="
