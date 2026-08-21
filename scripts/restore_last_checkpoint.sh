#!/usr/bin/env bash
# scripts/restore_last_checkpoint.sh

set -euo pipefail


# ============================================================
# LOCAL CHECKPOINT RESTORE
#
# Restores the local working tree to an immutable checkpoint.
#
# This script DOES NOT:
#
#   - determine what is currently deployed to PROD
#   - mutate the last-deployed tag
#   - push main
#   - deploy GitHub Pages
#
# Production rollback is performed through:
#
#   GitHub Actions
#     -> Redeploy (Owner)
#     -> exact git SHA
#     -> REDEPLOY-PROD
#
# Optional:
#
#   RESTORE_REF=checkpoint-... ./scripts/restore_last_checkpoint.sh
#
# Without RESTORE_REF, the newest checkpoint-* tag is selected.
# ============================================================


SCRIPT_NAME="restore_last_checkpoint"


REPO_ROOT="$(
  cd "$(dirname "${BASH_SOURCE[0]}")/.." &&
    pwd
)"


cd "${REPO_ROOT}"


LOG_DIR="${REPO_ROOT}/logs/${SCRIPT_NAME}"

mkdir -p "${LOG_DIR}"


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


say() {
  printf "%s\n" "$*"
}


die() {
  printf "❌ %s\n" "$*" >&2
  exit 1
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
# PRECONDITIONS
# ============================================================

require_cmd git
require_cmd npm


git rev-parse \
  --is-inside-work-tree \
  >/dev/null 2>&1 ||
  die "Not inside a Git repository."


git remote get-url \
  origin \
  >/dev/null 2>&1 ||
  die "Remote 'origin' not found."


TARGET_BRANCH="${TARGET_BRANCH:-main}"

CURRENT_BRANCH="$(
  git branch --show-current
)"


if [[ "${CURRENT_BRANCH}" != "${TARGET_BRANCH}" ]]; then
  die "Run this restore from '${TARGET_BRANCH}'. Current branch: '${CURRENT_BRANCH}'."
fi


echo ""

say "ℹ️  Log file: ${LOG_FILE}"
say "ℹ️  Repo: ${REPO_ROOT}"
say "ℹ️  Branch: ${CURRENT_BRANCH}"
say "ℹ️  HEAD: $(git rev-parse --short HEAD)"

echo ""


# ============================================================
# REFRESH REMOTE STATE
# ============================================================

say "ℹ️  Fetching origin/main and immutable checkpoint tags..."


git fetch \
  origin \
  main:refs/remotes/origin/main \
  --tags \
  --force


echo ""


# ============================================================
# SELECT CHECKPOINT
# ============================================================

RESTORE_REF="${RESTORE_REF:-}"


if [[ -z "${RESTORE_REF}" ]]; then
  RESTORE_REF="$(
    git for-each-ref \
      --sort=-creatordate \
      --format='%(refname:short)' \
      'refs/tags/checkpoint-*' |
      head -n 1
  )"
fi


if [[ -z "${RESTORE_REF}" ]]; then
  die "No checkpoint-* tags were found."
fi


if ! git rev-parse \
  --quiet \
  --verify \
  "${RESTORE_REF}^{commit}" \
  >/dev/null; then

  die "Restore ref does not resolve to a commit: ${RESTORE_REF}"
fi


COMMIT_SHA="$(
  git rev-parse "${RESTORE_REF}^{commit}"
)"


if ! git merge-base \
  --is-ancestor \
  "${COMMIT_SHA}" \
  origin/main; then

  die "Checkpoint ${RESTORE_REF} is not contained in origin/main."
fi


say "✅ Local restore target:"
say "   Ref:    ${RESTORE_REF}"
say "   Commit: ${COMMIT_SHA}"

echo ""


# ============================================================
# IDEMPOTENCY
# ============================================================

HEAD_SHA="$(
  git rev-parse HEAD
)"


if [[ "${HEAD_SHA}" == "${COMMIT_SHA}" ]] &&
   git diff --quiet &&
   git diff --cached --quiet; then

  say "✅ Already at ${RESTORE_REF}; working tree is clean."
  exit 0
fi


# ============================================================
# DIRTY TREE SAFETY
# ============================================================

if ! git diff --quiet ||
   ! git diff --cached --quiet ||
   [[ -n "$(git ls-files --others --exclude-standard)" ]]; then

  say "⚠️  The working tree contains uncommitted/untracked changes."
  say ""
  say "Restore will remove those changes after creating a rescue branch."
  say ""

  read -r -p "Continue? Type RESTORE to confirm: " CONFIRMATION

  if [[ "${CONFIRMATION}" != "RESTORE" ]]; then
    die "Restore cancelled."
  fi
fi


# ============================================================
# RESCUE BRANCH
# ============================================================

RESCUE_BRANCH="rescue/before-restore-$(
  date +%Y%m%d-%H%M%S
)"


say ""
say "🛟 Creating rescue branch:"
say "   ${RESCUE_BRANCH}"


git branch \
  "${RESCUE_BRANCH}" \
  HEAD


# ============================================================
# RESTORE
# ============================================================

say ""
say "🔁 Restoring tracked files to:"
say "   ${RESTORE_REF}"


git reset \
  --hard \
  "${COMMIT_SHA}"


# Remove untracked files/directories only after explicit confirmation
# above. Ignored files such as local .env files remain intact.
git clean \
  -fd


say ""
say "✅ Local checkpoint restored."


# ============================================================
# OPTIONAL VALIDATION
# ============================================================

echo ""

read -r -p "Run the full local quality gate now? (Y/n): " RUN_VERIFY


if [[ "${RUN_VERIFY:-Y}" != "n" &&
      "${RUN_VERIFY:-Y}" != "N" ]]; then

  echo ""

  say "ℹ️  Installing frontend dependencies..."

  npm ci


  echo ""

  say "ℹ️  Running frontend tests..."

  CI=true npm run test:ci


  echo ""

  say "ℹ️  Running production frontend build..."

  CI=true npm run build


  echo ""

  say "ℹ️  Installing infrastructure dependencies..."

  (
    cd infra/cdk
    npm ci
  )


  echo ""

  say "ℹ️  Running infrastructure/backend verification..."

  (
    cd infra/cdk
    CI=true npm run verify
  )


  echo ""

  say "✅ Full local quality gate passed."
fi


# ============================================================
# RESULT
# ============================================================

echo ""
echo "============================================================"
echo " LOCAL CHECKPOINT RESTORED"
echo "============================================================"
echo ""
echo " Ref:"
echo "   ${RESTORE_REF}"
echo ""
echo " Commit:"
echo "   ${COMMIT_SHA}"
echo ""
echo " Rescue branch:"
echo "   ${RESCUE_BRANCH}"
echo ""
echo " PROD:"
echo "   NOT CHANGED"
echo ""
echo " To redeploy this commit to PROD:"
echo ""
echo "   GitHub Actions"
echo "     -> Redeploy (Owner)"
echo "     -> gitSha:"
echo "        ${COMMIT_SHA}"
echo "     -> confirm:"
echo "        REDEPLOY-PROD"
echo ""
echo "============================================================"
echo ""