#!/usr/bin/env bash
# scripts/install-hook.sh

set -euo pipefail


REPO_ROOT="$(
  git rev-parse --show-toplevel 2>/dev/null ||
    pwd
)"

cd "${REPO_ROOT}"


echo ""
echo "Installing repository Git hooks..."
echo ""


command -v git \
  >/dev/null 2>&1 ||
  {
    echo "❌ git is required." >&2
    exit 1
  }


command -v npm \
  >/dev/null 2>&1 ||
  {
    echo "❌ npm is required." >&2
    exit 1
  }


# Husky is the single hook implementation for this repository.
npm run prepare


HOOKS_PATH="$(
  git config \
    --get \
    core.hooksPath ||
    true
)"


if [[ "${HOOKS_PATH}" != ".husky/_" ]]; then
  echo "❌ Unexpected Git hooks path:"
  echo "   ${HOOKS_PATH:-<unset>}"
  echo ""
  echo "Expected:"
  echo "   .husky/_"
  exit 1
fi


# Remove obsolete hooks from the default .git/hooks directory.
#
# core.hooksPath currently means these are inactive, but leaving
# cloud-mutating hooks there creates a future foot-gun if the
# hooksPath configuration is ever removed.
rm -f \
  .git/hooks/pre-commit \
  .git/hooks/pre-push


echo ""
echo "✅ Husky hooks installed."
echo "✅ Legacy .git/hooks entries removed."
echo "✅ No cloud deployment is performed by this installer."
echo ""