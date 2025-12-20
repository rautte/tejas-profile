#!/usr/bin/env bash
set -euo pipefail

# Load local env if present
[ -f .env.local ] && set -a && . ./.env.local && set +a

ASSETS_DIR="${ASSETS_DIR:-src/assets/ships/sprites}"
BUCKET="${ASSETS_BUCKET:?ASSETS_BUCKET not set (put it in .env.local)}"
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
    aws sso login --profile "$PROFILE"
    # Try again
    aws sts get-caller-identity >/dev/null 2>&1 || {
      echo "[sync:assets] ERROR: Unable to authenticate to AWS after SSO login." >&2
      return 1
    }
    return 0
  fi
  echo "[sync:assets] ERROR: Not authenticated to AWS and AWS_PROFILE is empty." >&2
  return 1
}

echo "[sync:assets] Syncing '$ASSETS_DIR' → s3://$BUCKET/$PREFIX (region=$REGION profile=${PROFILE:-'<default>'})"

ensure_aws_session

# You can tune these flags. Using default timestamp/etag detection is safest.
aws s3 sync "$ASSETS_DIR" "s3://$BUCKET/$PREFIX" \
  --region "$REGION" \
  ${PROFILE:+--profile "$PROFILE"} \
  --only-show-errors

echo "[sync:assets] Done ✓"
