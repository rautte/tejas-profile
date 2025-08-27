#!/usr/bin/env bash
set -euo pipefail

# Load .env.local if present
if [ -f ".env.local" ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env.local
  set +a
fi

: "${CF_DIST_ID:?CF_DIST_ID is required (set in .env.local)}"
: "${AWS_REGION:=us-east-1}"
: "${AWS_PROFILE:=default}"

echo "[cdn:invalidate] Invalidating /ships/sprites/* on $CF_DIST_ID"
aws cloudfront create-invalidation \
  --distribution-id "$CF_DIST_ID" \
  --paths "/ships/sprites/*" \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --output text >/dev/null

echo "[cdn:invalidate] Submitted."
