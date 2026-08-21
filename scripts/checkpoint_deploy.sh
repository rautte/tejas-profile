#!/usr/bin/env bash
# scripts/checkpoint_deploy.sh

set -euo pipefail


# ============================================================
# CHECKPOINT
#
# This script:
#
#   1. validates the current working tree
#   2. runs the local quality gate
#   3. commits the checkpoint
#   4. creates an immutable checkpoint tag
#   5. atomically pushes main + checkpoint tag
#
# It DOES NOT deploy PROD.
# It DOES NOT move last-deployed.
# It DOES NOT update backup/last-deployed.
#
# After the push:
#
#   main
#     -> CI Quality Gate
#     -> DEV deployment / smoke validation when CI succeeds
#
# PROD requires a separate explicit:
#
#   Promote Frontend (PROD)
#
# workflow with:
#
#   gitSha  = exact 40-character commit SHA
#   confirm = PROMOTE-PROD
# ============================================================


SCRIPT_NAME="checkpoint_deploy"

REPO_ROOT="$(
  cd "$(dirname "${BASH_SOURCE[0]}")/.." &&
    pwd
)"

LOG_DIR="${REPO_ROOT}/logs/${SCRIPT_NAME}"

mkdir -p "${LOG_DIR}"


# ============================================================
# LOG RETENTION
# ============================================================

if compgen -G "${LOG_DIR}/${SCRIPT_NAME}_"*.log >/dev/null; then
  ls -1t "${LOG_DIR}/${SCRIPT_NAME}_"*.log |
    tail -n +31 |
    while read -r file; do
      rm -f "${file}"
    done
fi


RUN_TS="$(
  date +%Y-%m-%d_%H-%M-%S
)"

LOG_FILE="${LOG_DIR}/${SCRIPT_NAME}_${RUN_TS}.log"

LATEST_LOG="${LOG_DIR}/${SCRIPT_NAME}_latest.log"


# ============================================================
# HELPERS
# ============================================================

die() {
  echo "❌ $*" >&2
  exit 1
}


info() {
  echo "ℹ️  $*"
}


ok() {
  echo "✅ $*"
}


require_cmd() {
  command -v "$1" >/dev/null 2>&1 ||
    die "Missing required command: $1"
}


exec \
  > >(tee -a "${LOG_FILE}" "${LATEST_LOG}") \
  2>&1


trap '
  rc=$?

  if [[ ${rc} -eq 0 ]]; then
    echo "✅ RESULT: SUCCESS"
  else
    echo "❌ RESULT: FAILED (exit=${rc})"
  fi
' EXIT


# ============================================================
# CONTEXT
# ============================================================

cd "${REPO_ROOT}"


echo ""

info "Log file: ${LOG_FILE}"
info "Repo: ${REPO_ROOT}"
info "Branch: $(git branch --show-current 2>/dev/null || echo unknown)"
info "HEAD: $(git rev-parse --short HEAD 2>/dev/null || echo unknown)"

echo ""

info "---- Context ----"
info "user=$(whoami) host=$(hostname)"
info "pwd=$(pwd)"
info "git=$(git --version | head -n 1)"
info "node=$(node -v 2>/dev/null || echo n/a) npm=$(npm -v 2>/dev/null || echo n/a)"
info "------------------"


# ============================================================
# PRECONDITIONS
# ============================================================

require_cmd git
require_cmd npm


git rev-parse \
  --is-inside-work-tree \
  >/dev/null 2>&1 ||
  die "Not inside a git repository."


CURRENT_BRANCH="$(
  git branch --show-current
)"


if [[ "${CURRENT_BRANCH}" != "main" ]]; then
  die "You are on branch '${CURRENT_BRANCH}'. Switch to 'main' before running this script."
fi


git remote get-url \
  origin \
  >/dev/null 2>&1 ||
  die "Remote 'origin' not found."


if [[ -z "$(git status --porcelain)" ]]; then
  info "Working tree is clean. Nothing to checkpoint."
  exit 0
fi


# ============================================================
# REMOTE SAFETY
#
# Refuse to create a checkpoint from a main branch that has
# diverged from or fallen behind origin/main.
# ============================================================

echo ""

info "Refreshing origin/main..."

git fetch \
  origin \
  main:refs/remotes/origin/main \
  --force


if ! git merge-base \
  --is-ancestor \
  origin/main \
  HEAD; then

  die "Local main is behind or has diverged from origin/main. Reconcile main before creating a checkpoint."
fi


ok "Local main contains the latest origin/main history."


# ============================================================
# SOURCE HYGIENE
# ============================================================

echo ""

info "Checking source diff..."

git diff --check

ok "git diff --check passed."


# ============================================================
# LOCAL QUALITY GATE
# ============================================================

echo ""

info "Running frontend tests..."

CI=true npm run test:ci

ok "Frontend tests passed."


echo ""

info "Running production frontend build..."

CI=true npm run build

ok "Production frontend build passed."


echo ""

info "Running infrastructure/backend verification..."

(
  cd infra/cdk
  CI=true npm run verify
)

ok "Infrastructure/backend verification passed."


# ============================================================
# CHECKPOINT IDENTITY
# ============================================================

UUID=""

if command -v uuidgen >/dev/null 2>&1; then
  UUID="$(
    uuidgen |
      tr '[:upper:]' '[:lower:]'
  )"
else
  require_cmd python3

  UUID="$(
    python3 - <<'PY'
import uuid
print(str(uuid.uuid4()))
PY
  )"
fi


TIMESTAMP="$(
  date +"%Y-%m-%d %H:%M:%S"
)"


CHECKPOINT_TAG="checkpoint-$(
  date +%Y-%m-%d_%H-%M-%S
)"


if git rev-parse \
  --quiet \
  --verify \
  "refs/tags/${CHECKPOINT_TAG}" \
  >/dev/null; then

  die "Checkpoint tag already exists: ${CHECKPOINT_TAG}"
fi


# ============================================================
# STAGE
# ============================================================

echo ""

info "Staging checkpoint..."

git add -A


# Never permit environment files to enter a checkpoint.
STAGED_ENV_FILES="$(
  git diff \
    --cached \
    --name-only |
    grep -E '(^|/)\.env($|\.)' ||
    true
)"


if [[ -n "${STAGED_ENV_FILES}" ]]; then
  echo ""
  echo "${STAGED_ENV_FILES}"
  echo ""

  die "Environment file detected in staged checkpoint."
fi


FILE_COUNT="$(
  git diff \
    --cached \
    --name-only |
    wc -l |
    tr -d ' '
)"


if [[ "${FILE_COUNT}" == "0" ]]; then
  info "No staged changes remain. Nothing to checkpoint."
  exit 0
fi


ok "Staged ${FILE_COUNT} changed file(s)."


# ============================================================
# COMMIT
# ============================================================

echo ""

info "Creating checkpoint commit..."


git commit \
  -m "checkpoint | ${TIMESTAMP} | ${CURRENT_BRANCH} | files:${FILE_COUNT} | ${UUID}"


COMMIT_SHA="$(
  git rev-parse HEAD
)"

COMMIT_SHA_SHORT="$(
  git rev-parse --short HEAD
)"


ok "Created checkpoint commit ${COMMIT_SHA_SHORT}."


# ============================================================
# REFRESH LOCAL BUILD METADATA
#
# This file is local-only. GitHub Actions generates authoritative
# PROD build metadata from the exact promoted SHA.
# ============================================================

ENV_FILE=".env.production.local"


if git ls-files \
  --error-unmatch \
  "${ENV_FILE}" \
  >/dev/null 2>&1; then

  die "${ENV_FILE} is tracked by Git. It must remain local-only."
fi


BUILD_TIME="$(
  date -u +%Y-%m-%dT%H:%M:%S.%3NZ
)"

PROFILE_VERSION="pv_${COMMIT_SHA_SHORT}"

GIT_REF="${CURRENT_BRANCH}"

ORIGIN_URL="$(
  git remote get-url origin
)"

REPO_SLUG="$(
  echo "${ORIGIN_URL}" |
    sed -E \
      's#^git@github.com:##; s#^https://github.com/##; s#\.git$##'
)"


TMP_FILE="$(
  mktemp
)"


if [[ -f "${ENV_FILE}" ]]; then
  grep -vE \
    '^(REACT_APP_PROFILE_VERSION|REACT_APP_GIT_SHA|REACT_APP_BUILD_TIME|REACT_APP_REPO|REACT_APP_GIT_REF|REACT_APP_CHECKPOINT_TAG)=' \
    "${ENV_FILE}" \
    > "${TMP_FILE}" ||
    true
else
  : > "${TMP_FILE}"
fi


cat >> "${TMP_FILE}" <<EOF

REACT_APP_PROFILE_VERSION=${PROFILE_VERSION}
REACT_APP_GIT_SHA=${COMMIT_SHA}
REACT_APP_BUILD_TIME=${BUILD_TIME}
REACT_APP_REPO=${REPO_SLUG}
REACT_APP_GIT_REF=${GIT_REF}
REACT_APP_CHECKPOINT_TAG=${CHECKPOINT_TAG}
EOF


mv \
  "${TMP_FILE}" \
  "${ENV_FILE}"


ok "Updated local ${ENV_FILE} with checkpoint metadata."


# ============================================================
# IMMUTABLE CHECKPOINT TAG
# ============================================================

echo ""

info "Creating checkpoint tag: ${CHECKPOINT_TAG}"


git tag \
  -a \
  "${CHECKPOINT_TAG}" \
  -m "checkpoint ${CHECKPOINT_TAG} | ${COMMIT_SHA}"


ok "Created ${CHECKPOINT_TAG}."


# ============================================================
# PUSH
#
# main and the immutable checkpoint tag move together.
#
# There is deliberately:
#
#   - no backup/last-deployed branch update
#   - no last-deployed tag update
#   - no gh-pages deployment
# ============================================================

echo ""

info "Pushing main + checkpoint tag atomically..."


git push \
  --atomic \
  origin \
  main \
  "refs/tags/${CHECKPOINT_TAG}"


ok "Pushed main and ${CHECKPOINT_TAG}."


# ============================================================
# RESULT
# ============================================================

echo ""
echo "============================================================"
echo " CHECKPOINT CREATED"
echo "============================================================"
echo ""
echo " Commit:"
echo "   ${COMMIT_SHA}"
echo ""
echo " Checkpoint tag:"
echo "   ${CHECKPOINT_TAG}"
echo ""
echo " Push behavior:"
echo "   main -> CI Quality Gate"
echo "        -> DEV deployment when CI succeeds"
echo ""
echo " PROD:"
echo "   NOT DEPLOYED"
echo ""
echo " To promote this exact checkpoint to PROD:"
echo ""
echo "   GitHub Actions"
echo "     -> Promote Frontend (PROD)"
echo "     -> gitSha:"
echo "        ${COMMIT_SHA}"
echo "     -> confirm:"
echo "        PROMOTE-PROD"
echo ""
echo "============================================================"
echo ""

ok "Checkpoint complete."

exit 0