#!/usr/bin/env bash
# install-hook.sh
set -euo pipefail

# -----------------------------
# Logging (stdout + stderr)
# -----------------------------
SCRIPT_NAME="install_hook"
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
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

echo "ℹ️  Log file: $LOG_FILE"
echo "---- Context ----"
echo "user=$(whoami) host=$(hostname)"
echo "pwd=$(pwd)"
echo "git=$(git --version | head -n 1 2>/dev/null || echo n/a)"
echo "node=$(node -v 2>/dev/null || echo n/a) npm=$(npm -v 2>/dev/null || echo n/a)"
echo "------------------"

# -----------------------------
# Original script (unchanged behavior)
# -----------------------------
cp scripts/pre-push.sample .git/hooks/pre-push && chmod +x .git/hooks/pre-push && echo "Hook installed."
