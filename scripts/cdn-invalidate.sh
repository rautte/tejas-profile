#!/usr/bin/env bash
set -euo pipefail

[ -f .env.local ] && set -a && . ./.env.local && set +a

DISTRIBUTION_ID="${CDN_DISTRIBUTION_ID:?CDN_DISTRIBUTION_ID not set in .env.local}"
PATTERNS="${CDN_INVALIDATE_PATHS:-/ships/sprites/*}"
PROFILE="${AWS_PROFILE:-}"
REGION="${AWS_REGION:-us-east-1}"

export AWS_SDK_LOAD_CONFIG=1

ensure_aws_session() {
  if aws sts get-caller-identity >/dev/null 2>&1; then
    return 0
  fi
  if [[ -n "$PROFILE" ]]; then
    echo "[cdn:invalidate] AWS session invalid or expired. Attempting SSO login for profile '$PROFILE'…"
    aws sso login --profile "$PROFILE"
    aws sts get-caller-identity >/dev/null 2>&1 || {
      echo "[cdn:invalidate] ERROR: Unable to authenticate to AWS after SSO login." >&2
      return 1
    }
    return 0
  fi
  echo "[cdn:invalidate] ERROR: Not authenticated to AWS and AWS_PROFILE is empty." >&2
  return 1
}

echo "[cdn:invalidate] Creating invalidation on $DISTRIBUTION_ID for: $PATTERNS"

ensure_aws_session

aws cloudfront create-invalidation \
  --distribution-id "$DISTRIBUTION_ID" \
  --paths $PATTERNS \
  ${PROFILE:+--profile "$PROFILE"} \
  --region "$REGION" \
  >/dev/null

echo "[cdn:invalidate] Invalidation requested ✓"
