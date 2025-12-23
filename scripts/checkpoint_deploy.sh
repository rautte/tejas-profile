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
# -----------------------------

# ---- Helpers
die() { echo "❌ $*" >&2; exit 1; }
info() { echo "ℹ️  $*"; }
ok() { echo "✅ $*"; }

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

info "Pushing backup branch: ${backup_branch}"
git push -f origin "${backup_branch}"
ok "Pushed ${backup_branch}."

# ---- 5) Tag checkpoint + move last-deployed tag (then push tags)
tag="checkpoint-$(date +%Y-%m-%d_%H-%M-%S)"
info "Tagging: ${tag}"
git tag "${tag}"
ok "Tagged ${tag}."

info "Updating tag: last-deployed -> ${tag}"
git tag -a -f last-deployed -m "last deployed checkpoint: ${tag} (${ts})"
ok "Updated last-deployed."

info "Pushing tags..."
git push origin "refs/tags/${tag}"
git push --force origin "refs/tags/last-deployed"
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
