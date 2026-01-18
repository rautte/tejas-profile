#!/usr/bin/env bash
set -euo pipefail

GIT_SHA="$(git rev-parse HEAD)"
GIT_SHA_SHORT="$(git rev-parse --short HEAD)"
BUILD_TIME="$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)"
PROFILE_VERSION="pv_${GIT_SHA_SHORT}"

ORIGIN_URL="$(git remote get-url origin)"
REPO_SLUG="$(echo "$ORIGIN_URL" | sed -E 's#^git@github.com:##; s#^https://github.com/##; s#\.git$##')"

cat > .env.local <<EOF
REACT_APP_PROFILE_VERSION=${PROFILE_VERSION}
REACT_APP_GIT_SHA=${GIT_SHA}
REACT_APP_BUILD_TIME=${BUILD_TIME}
REACT_APP_REPO=${REPO_SLUG}
EOF

echo "✅ Wrote .env.local"
cat .env.local
