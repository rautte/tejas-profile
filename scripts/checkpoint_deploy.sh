#!/usr/bin/env bash
set -euo pipefail

# -----------------------------
# checkpoint_deploy.sh
# - Validates build
# - Commits with UUID + timestamp
# - Tags a checkpoint
# - Pushes main + tags
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

# Ensure we're in a git repo
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "Not inside a git repository."

# Ensure we're on main (or change this if your default branch differs)
current_branch="$(git branch --show-current)"
if [[ "$current_branch" != "main" ]]; then
  die "You are on branch '$current_branch'. Switch to 'main' before running this script."
fi

# Ensure working tree has changes to commit (optional, but matches your intended flow)
if [[ -z "$(git status --porcelain)" ]]; then
  die "No changes to commit. (Working tree is clean.)"
fi

# Optional: ensure remote exists
git remote get-url origin >/dev/null 2>&1 || die "Remote 'origin' not found."

# ---- 1) Validate production build
info "Running production build..."
npm run build
ok "Build succeeded."

# ---- 2) Commit with UUID + timestamp
# uuidgen exists on macOS by default. If not, fall back to random.
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

# ---- 3) Tag checkpoint (use datetime to avoid collisions)
tag="checkpoint-$(date +%Y-%m-%d_%H-%M-%S)"
info "Tagging: ${tag}"
git tag "${tag}"
ok "Tagged."

# ---- 4) Push main + tags
info "Pushing main + tags..."
git push origin main
git push origin --tags
ok "Pushed."

# ---- 5) Deploy
info "Deploying (npm run deploy)..."
npm run deploy
ok "Deployed."

echo ""
ok "Done."
echo "   Commit UUID: ${uuid}"
echo "   Tag:         ${tag}"
echo ""
