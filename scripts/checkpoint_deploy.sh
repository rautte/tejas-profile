#!/usr/bin/env bash
set -euo pipefail

# -----------------------------
# checkpoint_deploy.sh
# - Validates build
# - Commits with UUID + timestamp
# - Pushes main first
# - Updates + pushes moving backup branch
# - Tags checkpoint + moves last-deployed tag
# - Deploys to gh-pages
# - Logs everything to 
# -----------------------------

# ---- Logging (stdout + stderr)
SCRIPT_NAME="checkpoint_deploy"
LOG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/logs/${SCRIPT_NAME}"
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

# ---- Helpers (define BEFORE first use)
die() { echo "❌ $*" >&2; exit 1; }
info() { echo "ℹ️  $*"; }
ok() { echo "✅ $*"; }

# log everything to file + console
exec > >(tee -a "$LOG_FILE" "$LATEST_LOG") 2>&1

# final status line even on failure
trap 'rc=$?; if [[ $rc -eq 0 ]]; then echo "✅ RESULT: SUCCESS"; else echo "❌ RESULT: FAILED (exit=$rc)"; fi' EXIT

info "Log file: $LOG_FILE"
info "Repo: $(pwd)"
info "Branch: $(git branch --show-current 2>/dev/null || echo unknown)"
info "HEAD: $(git rev-parse --short HEAD 2>/dev/null || echo unknown)"

info "---- Context ----"
info "user=$(whoami) host=$(hostname)"
info "pwd=$(pwd)"
info "git=$(git --version | head -n 1)"
info "node=$(node -v 2>/dev/null || echo n/a) npm=$(npm -v 2>/dev/null || echo n/a)"
info "------------------"

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1"
}

# ---- Preconditions
require_cmd git
require_cmd npm

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "Not inside a git repository."

current_branch="$(git branch --show-current)"
if [[ "$current_branch" != "main" ]]; then
  die "You are on branch '$current_branch'. Switch to 'main' before running this script."
fi

if [[ -z "$(git status --porcelain)" ]]; then
  die "No changes to commit. (Working tree is clean.)"
fi

git remote get-url origin >/dev/null 2>&1 || die "Remote 'origin' not found."

# ---- 1) Validate production build
info "Running production build..."
npm run build
ok "Build succeeded."

# ---- 2) Commit with UUID + timestamp
uuid=""
if command -v uuidgen >/dev/null 2>&1; then
  uuid="$(uuidgen | tr '[:upper:]' '[:lower:]')"
else
  uuid="$(python3 - <<'PY'
import uuid
print(str(uuid.uuid4()))
PY
)"
fi

ts="$(date +"%Y-%m-%d %H:%M:%S")"
file_count="$(git status --porcelain | wc -l | tr -d ' ')"

info "Staging changes..."
git add .

info "Committing..."
git commit -m "checkpoint | ${ts} | ${current_branch} | files:${file_count} | ${uuid}"
ok "Committed."

# ---- 3) Push main FIRST (clean + linear history)
info "Pushing main..."
git push origin main
ok "Pushed main."

# ---- 4) Keep a moving backup branch in sync with this checkpoint commit (then push)
backup_branch="backup/last-deployed"
info "Updating backup branch: ${backup_branch} -> HEAD"
git branch -f "${backup_branch}" HEAD
ok "Updated ${backup_branch}."

info "Pushing backup branch: ${backup_branch} (skip pre-push hook)"
git push --no-verify -f origin "${backup_branch}"
ok "Pushed ${backup_branch}."

# ---- 5) Tag checkpoint + move last-deployed tag (then push tags)
tag="checkpoint-$(date +%Y-%m-%d_%H-%M-%S)"
info "Tagging: ${tag}"
git tag "${tag}"
ok "Tagged ${tag}."

info "Updating tag: last-deployed -> ${tag}"
git tag -a -f last-deployed -m "last deployed checkpoint: ${tag} (${ts})"
ok "Updated last-deployed."

info "Pushing tags (skip pre-push hook)..."
git push --no-verify origin "refs/tags/${tag}"
git push --no-verify --force origin "refs/tags/last-deployed"
ok "Pushed tags."

# ---- Safety: Prevent deploy if build folder differs from committed state
if [[ -n "$(git status --porcelain build)" ]]; then
  die "Build directory differs from committed state. Aborting deploy."
fi

# ---- 6) Deploy
info "Deploying (npm run deploy)..."
npm run deploy
ok "Deployed."

echo ""
ok "Done."
echo "   Commit UUID: ${uuid}"
echo "   Tag:         ${tag}"
echo ""
