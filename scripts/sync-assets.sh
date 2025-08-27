#!/usr/bin/env bash
set -euo pipefail

# Load .env.local if present
if [ -f ".env.local" ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env.local
  set +a
fi

: "${ASSETS_BUCKET:?ASSETS_BUCKET is required (set in .env.local)}"
: "${AWS_REGION:=us-east-1}"
: "${AWS_PROFILE:=default}"

SPRITES_DIR="src/assets/ships/sprites"

if [ ! -d "$SPRITES_DIR" ]; then
  echo "[sync:assets] No $SPRITES_DIR directory found. Skipping."
  exit 0
fi

echo "[sync:assets] Syncing $SPRITES_DIR → s3://$ASSETS_BUCKET/ships/sprites/ (profile=$AWS_PROFILE, region=$AWS_REGION)"
aws s3 sync "$SPRITES_DIR" "s3://$ASSETS_BUCKET/ships/sprites/" \
  --delete \
  --size-only \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --only-show-errors

echo "[sync:assets] Done."
