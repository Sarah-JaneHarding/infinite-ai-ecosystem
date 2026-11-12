#!/usr/bin/env bash
# Copies the read-only /repo into the /workspace volume, installs dependencies from the lockfile, then
# runs the command. `rsync --delete` removes files deleted on the host; node_modules and build output
# are excluded from both the copy and the deletion, so they persist in the volume between runs.
#
#   SANDBOX_NO_SYNC=1   skip the copy and install (run against what is already in /workspace)
set -euo pipefail

if [ "${SANDBOX_NO_SYNC:-0}" != "1" ]; then
  if [ ! -d /repo ]; then
    echo "sandbox: /repo is not mounted; nothing to copy." >&2
    exit 64
  fi
  rsync -a --delete \
    --exclude '/.git' --exclude 'node_modules' --exclude '.next' --exclude '.turbo' \
    --exclude 'dist' --exclude 'coverage' --exclude '*.tsbuildinfo' \
    --include '.env.example' --exclude '.env' --exclude '.env.*' \
    /repo/ /workspace/
  cd /workspace
  # --frozen-lockfile: the sandbox must build exactly what the lockfile says, never resolve anew.
  pnpm install --frozen-lockfile --reporter=silent
fi

cd /workspace
exec "$@"
