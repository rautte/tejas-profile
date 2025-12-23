#!/usr/bin/env bash
set -euo pipefail

# ----------------------------
# restore_last_checkpoint.sh
# Purpose:
#  - Restore working tree to last known good deployed commit
#  - Prefers moving tag: last-deployed
#  - Falls back to latest checkpoint-* tag
#  - Creates a rescue branch before resetting
# ----------------------------

# ---- Repo root + helpers (define BEFORE first use)
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

say() { printf "%s\n" "$*"; }
die() { printf "❌ %s\n" "$*" >&2; exit 1; }

# ---- Logging (stdout + stderr)
SCRIPT_NAME="restore_last_checkpoint"
LOG_DIR="${REPO_ROOT}/logs/${SCRIPT_NAME}"
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

exec > >(tee -a "$LOG_FILE" "$LATEST_LOG") 2>&1
trap 'rc=$?; if [[ $rc -eq 0 ]]; then echo "✅ RESULT: SUCCESS"; else echo "❌ RESULT: FAILED (exit=$rc)"; fi' EXIT

say "ℹ️  Log file: $LOG_FILE"
say "ℹ️  Repo: $REPO_ROOT"
say "ℹ️  Branch: $(git branch --show-current 2>/dev/null || echo unknown)"
say "ℹ️  HEAD: $(git rev-parse --short HEAD 2>/dev/null || echo unknown)"

say "---- Context ----"
say "user=$(whoami) host=$(hostname)"
say "pwd=$(pwd)"
say "git=$(git --version | head -n 1)"
say "node=$(node -v 2>/dev/null || echo n/a) npm=$(npm -v 2>/dev/null || echo n/a)"
say "------------------"

require_cmd() { command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1"; }

require_cmd git
require_cmd npm

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "Not inside a git repository."

# Ensure remote exists
git remote get-url origin >/dev/null 2>&1 || die "Remote 'origin' not found."

# Enforce branch policy (same as checkpoint script)
TARGET_BRANCH="${TARGET_BRANCH:-main}"
current_branch="$(git branch --show-current)"

if [[ "$current_branch" != "$TARGET_BRANCH" ]]; then
  say "⚠️  You are on branch '$current_branch' but restores are intended on '$TARGET_BRANCH'."
  read -r -p "Switch to '$TARGET_BRANCH' now? (y/N): " ans
  if [[ "${ans:-}" == "y" || "${ans:-}" == "Y" ]]; then
    # refuse to switch if dirty unless user confirms
    if ! git diff --quiet || ! git diff --cached --quiet; then
      say "⚠️  You have uncommitted changes; switching branches may fail or carry changes."
      read -r -p "Proceed with checkout anyway? (y/N): " ans2
      [[ "${ans2:-}" == "y" || "${ans2:-}" == "Y" ]] || die "Aborted."
    fi
    git checkout "$TARGET_BRANCH"
    current_branch="$TARGET_BRANCH"
    say "✅ Switched to '$TARGET_BRANCH'."
  else
    die "Aborted. Please run this from '$TARGET_BRANCH'."
  fi
fi

say "ℹ️  Fetching latest tags..."
git fetch --tags --quiet

# Prefer last-deployed, fallback to latest checkpoint-*
restore_ref=""
if git rev-parse -q --verify "refs/tags/last-deployed" >/dev/null; then
  restore_ref="last-deployed"
else
  latest_checkpoint="$(
    git tag -l "checkpoint-*" | sort | tail -n 1
  )"
  [[ -n "${latest_checkpoint:-}" ]] || die "No 'last-deployed' or 'checkpoint-*' tags found."
  restore_ref="$latest_checkpoint"
fi

commit_sha="$(git rev-list -n 1 "$restore_ref")"
[[ -n "${commit_sha:-}" ]] || die "Could not resolve commit for ref: $restore_ref"

say "✅ Restore target: $restore_ref"
say "   Commit: $commit_sha"

# Idempotency: if already at target commit and clean, do nothing.
head_sha="$(git rev-parse HEAD)"
if [[ "$head_sha" == "$commit_sha" ]]; then
  if git diff --quiet && git diff --cached --quiet; then
    say "✅ Already at $restore_ref and working tree is clean. Nothing to do."
    exit 0
  fi
  say "ℹ️  HEAD already matches $restore_ref, but you have local changes."
fi

# Dirty check
if ! git diff --quiet || ! git diff --cached --quiet; then
  say "⚠️  You have uncommitted changes."
  say "    Restore will DISCARD them unless you stash/commit."
  read -r -p "Proceed and discard local changes? (y/N): " ans
  [[ "${ans:-}" == "y" || "${ans:-}" == "Y" ]] || die "Aborted."
fi

# Create rescue branch from current HEAD (safe escape hatch)
rescue_branch="rescue/before-restore-$(date +%Y%m%d-%H%M%S)"
say "🛟 Creating rescue branch: $rescue_branch"
git branch "$rescue_branch" >/dev/null 2>&1 || true

say "🔁 Resetting working tree to: $restore_ref"
git reset --hard "$restore_ref" --quiet

say "✅ Repo restored to $restore_ref"

read -r -p "Run npm ci + npm run build now? (Y/n): " run_build
if [[ "${run_build:-Y}" != "n" && "${run_build:-Y}" != "N" ]]; then
  say "ℹ️  Installing deps (npm ci)..."
  npm ci
  say "ℹ️  Building..."
  npm run build
  say "✅ Build OK."
fi

say ""
say "✅ Done."
say "   Restored to:  $restore_ref ($commit_sha)"
say "   Rescue branch: $rescue_branch"
