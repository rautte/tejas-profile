#!/usr/bin/env bash
# sync-assets.sh
set -euo pipefail

# -----------------------------
# Logging (stdout + stderr)
# -----------------------------
SCRIPT_NAME="sync_assets"
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
LOG_DIR="${REPO_ROOT}/logs/${SCRIPT_NAME}"
mkdir -p "$LOG_DIR"

# keep last 30 logs (macOS friendly)
# NOTE: avoid "ls" failing when there are 0 matching files (set -e would exit)
if compgen -G "${LOG_DIR}/${SCRIPT_NAME}_"*.log > /dev/null; then
  ls -1t "${LOG_DIR}/${SCRIPT_NAME}_"*.log | tail -n +31 | while read -r f; do
    rm -f "$f"
  done
fi

RUN_TS="$(date +%Y-%m-%d_%H-%M-%S)"
LOG_FILE="${LOG_DIR}/${SCRIPT_NAME}_${RUN_TS}.log"
LATEST_LOG="${LOG_DIR}/${SCRIPT_NAME}_latest.log"

exec > >(tee -a "$LOG_FILE" "$LATEST_LOG") 2>&1
trap 'rc=$?; if [[ $rc -eq 0 ]]; then echo "✅ RESULT: SUCCESS"; else echo "❌ RESULT: FAILED (exit=$rc)"; fi' EXIT

echo ""
echo "ℹ️  Log file: $LOG_FILE"
echo ""
echo "---- Context ----"
echo "user=$(whoami) host=$(hostname)"
echo "pwd=$(pwd)"
echo "git=$(git --version | head -n 1 2>/dev/null || echo n/a)"
echo "node=$(node -v 2>/dev/null || echo n/a) npm=$(npm -v 2>/dev/null || echo n/a)"
echo "------------------"
echo ""

# -----------------------------
# Original script (unchanged behavior)
# -----------------------------

# -----------------------------
# Load env (prod-first, fallback)
# -----------------------------
load_env_file() {
  local f="$1"
  if [[ -f "$f" ]]; then
    set -a
    # shellcheck disable=SC1090
    . "$f"
    set +a
    return 0
  fi
  return 1
}

# Prefer prod env for asset sync (so pre-commit doesn't depend on dev .env.local)
load_env_file ".env.production.local" || true
load_env_file ".env.local" || true

ASSETS_DIR="${ASSETS_DIR:-src/assets/ships/sprites}"
BUCKET="${ASSETS_BUCKET:?ASSETS_BUCKET not set (set it in .env.production.local or .env.local)}"
PREFIX="${ASSETS_PREFIX:-ships/sprites/}"
REGION="${AWS_REGION:-us-east-1}"
PROFILE="${AWS_PROFILE:-}"


export AWS_SDK_LOAD_CONFIG=1

ensure_aws_session() {
  if aws sts get-caller-identity >/dev/null 2>&1; then
    return 0
  fi
  if [[ -n "$PROFILE" ]]; then
    echo "[sync:assets] AWS session invalid or expired. Attempting SSO login for profile '$PROFILE'…"
    echo ""
    aws sso login --profile "$PROFILE"
    # Try again
    aws sts get-caller-identity >/dev/null 2>&1 || {
      echo "[sync:assets] ERROR: Unable to authenticate to AWS after SSO login." >&2
      echo ""
      return 1
    }
    return 0
  fi
  echo "[sync:assets] ERROR: Not authenticated to AWS and AWS_PROFILE is empty." >&2
  echo ""
  return 1
}

echo "[sync:assets] Syncing '$ASSETS_DIR' → s3://$BUCKET/$PREFIX (region=$REGION profile=${PROFILE:-'<default>'})"
echo ""

ensure_aws_session

# You can tune these flags. Using default timestamp/etag detection is safest.
aws s3 sync "$ASSETS_DIR" "s3://$BUCKET/$PREFIX" \
  --region "$REGION" \
  ${PROFILE:+--profile "$PROFILE"} \
  --only-show-errors

echo ""
echo "[sync:assets] Done ✓"
echo ""
