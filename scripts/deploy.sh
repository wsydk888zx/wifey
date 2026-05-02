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
  vercel --prod --yes
  cleanup_vercel_link
  echo "✓ $name deployed"
}

# ── preflight ─────────────────────────────────────────────────────────────────

echo "=== Running preflight ==="
bash "$REPO_ROOT/scripts/preflight.sh"

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
# Only smoke-check what we deployed; player check is reliable, admin needs ADMIN_URL set
case "$TARGET" in
  admin)  bash "$REPO_ROOT/scripts/verify-deploy.sh" admin ;;
  player) bash "$REPO_ROOT/scripts/verify-deploy.sh" player ;;
  both)   bash "$REPO_ROOT/scripts/verify-deploy.sh" both ;;
esac

echo ""
echo "=== Deploy complete ==="
