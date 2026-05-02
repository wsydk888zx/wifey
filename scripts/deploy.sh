#!/usr/bin/env bash
# Single deploy command — preflight, deploy the right project, smoke check.
# Usage: ./scripts/deploy.sh <admin|player|both>
set -euo pipefail

TARGET="${1:-}"
if [ -z "$TARGET" ]; then
  echo "Usage: $0 <admin|player|both>"
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

ADMIN_PROJECT_ID="prj_9d9FqwIQB8S4z5JGCponKFkhXQxU"
PLAYER_PROJECT_ID="prj_7Rx0XM75xrhLLiQ9d18MUK0UThKd"
ORG_ID="team_2ZGvGqwT3x8G87WEYTAkd4Ax"

# URLs are set here and exported so verify-deploy.sh can use them (D2)
# These are the stable Vercel project URLs. Update if domains change.
export PLAYER_URL="https://wifey-player-wsydk888zxs-projects.vercel.app"
export ADMIN_URL="${ADMIN_URL:-}"  # Set in env or auto-discovered below

# ── helpers ──────────────────────────────────────────────────────────────────

cleanup_vercel_link() {
  rm -rf "$REPO_ROOT/.vercel"
}
trap cleanup_vercel_link EXIT

set_vercel_project() {
  local project_id="$1"
  mkdir -p "$REPO_ROOT/.vercel"
  echo "{\"projectId\":\"$project_id\",\"orgId\":\"$ORG_ID\"}" \
    > "$REPO_ROOT/.vercel/project.json"
}

deploy_project() {
  local name="$1"
  local project_id="$2"
  echo ""
  echo "=== Deploying $name ==="
  set_vercel_project "$project_id"

  # Capture vercel output to extract deployment URL (D2)
  local vercel_output
  vercel_output=$(vercel --prod --yes 2>&1 | tee /dev/stderr)
  local deployed_url
  deployed_url=$(echo "$vercel_output" | grep -oE "https://[a-zA-Z0-9._-]+\.vercel\.app" | tail -1 || true)

  cleanup_vercel_link

  if [ -n "$deployed_url" ]; then
    echo "  Deployed to: $deployed_url"
    # Override the static URL with the actual deployment URL (D2)
    if [ "$name" = "player" ]; then
      export PLAYER_URL="$deployed_url"
    elif [ "$name" = "admin" ]; then
      export ADMIN_URL="$deployed_url"
    fi
  fi

  echo "✓ $name deployed"
}

# ── preflight ─────────────────────────────────────────────────────────────────

echo "=== Running preflight ==="
bash "$REPO_ROOT/scripts/preflight.sh" "$TARGET"

# ── deploy ────────────────────────────────────────────────────────────────────

case "$TARGET" in
  admin)
    deploy_project "admin" "$ADMIN_PROJECT_ID"
    ;;
  player)
    deploy_project "player" "$PLAYER_PROJECT_ID"
    ;;
  both)
    deploy_project "admin"  "$ADMIN_PROJECT_ID"
    deploy_project "player" "$PLAYER_PROJECT_ID"
    ;;
  *)
    echo "Unknown target: $TARGET. Use admin, player, or both."
    exit 1
    ;;
esac

# ── smoke check ───────────────────────────────────────────────────────────────

echo ""
echo "=== Running smoke check ==="
case "$TARGET" in
  admin)  PLAYER_URL="$PLAYER_URL" ADMIN_URL="$ADMIN_URL" bash "$REPO_ROOT/scripts/verify-deploy.sh" admin ;;
  player) PLAYER_URL="$PLAYER_URL" bash "$REPO_ROOT/scripts/verify-deploy.sh" player ;;
  both)   PLAYER_URL="$PLAYER_URL" ADMIN_URL="$ADMIN_URL" bash "$REPO_ROOT/scripts/verify-deploy.sh" both ;;
esac

echo ""
echo "=== Deploy complete ==="
