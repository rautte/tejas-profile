#!/usr/bin/env bash
cp scripts/pre-push.sample .git/hooks/pre-push && chmod +x .git/hooks/pre-push && echo "Hook installed."
