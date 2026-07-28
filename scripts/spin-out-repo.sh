#!/usr/bin/env bash
#
# Move this monorepo into its own GitHub repository, history intact.
#
# It lives under infinite-ai/ in the host repository because the session that scaffolded
# it could not create a repository (see docs/OPEN_QUESTIONS.md, OQ-001). Once
# Infinite-AI-Ecosystem exists on GitHub, this script rewrites the subdirectory into a
# standalone repository root and pushes it there.
#
# Usage:
#   scripts/spin-out-repo.sh <git-remote-url> [branch]
#
# Example:
#   scripts/spin-out-repo.sh git@github.com:Sarah-JaneHarding/Infinite-AI-Ecosystem.git
#
# This reads the host repository and writes to a scratch clone. It never rewrites the
# history you are working in.

set -euo pipefail

REMOTE="${1:-}"
BRANCH="${2:-main}"

if [[ -z "$REMOTE" ]]; then
  echo "usage: $0 <git-remote-url> [branch]" >&2
  exit 2
fi

HOST_ROOT="$(git rev-parse --show-toplevel)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "Host repository : $HOST_ROOT"
echo "Target remote   : $REMOTE"
echo "Target branch   : $BRANCH"
echo

# A subtree split keeps only the commits that touched infinite-ai/, and rewrites them so
# that directory becomes the repository root.
echo "Splitting infinite-ai/ out of the host history..."
SPLIT_SHA="$(git -C "$HOST_ROOT" subtree split --prefix=infinite-ai HEAD)"
echo "Split commit: $SPLIT_SHA"

echo "Building the standalone repository..."
git -C "$HOST_ROOT" clone --no-local --branch "$(git -C "$HOST_ROOT" rev-parse --abbrev-ref HEAD)" . "$WORK/repo" >/dev/null 2>&1
git -C "$WORK/repo" checkout -q -B "$BRANCH" "$SPLIT_SHA"
git -C "$WORK/repo" remote remove origin
git -C "$WORK/repo" remote add origin "$REMOTE"

echo
echo "Ready. Contents of the new repository root:"
git -C "$WORK/repo" ls-tree --name-only HEAD | sed 's/^/  /'

echo
read -r -p "Push to $REMOTE ($BRANCH)? [y/N] " reply
if [[ "$reply" =~ ^[Yy]$ ]]; then
  git -C "$WORK/repo" push -u origin "$BRANCH"
  echo "Pushed."
  echo
  echo "Next: delete infinite-ai/ from the host repository in a separate commit, and"
  echo "move .github/workflows/infinite-ai-ci.yml out with it — the standalone repo"
  echo "already carries its own .github/workflows/ci.yml."
else
  echo "Not pushed. The prepared repository was in $WORK/repo and has been discarded."
fi
