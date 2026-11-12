# The sandbox toolbox: a clean, reproducible place to lint, typecheck, test and build the monorepo
# without touching the host's node_modules or working tree.
#
# It does not contain the code. The repository is mounted read-only at /repo and copied (rsync) into
# the /workspace volume by `sandbox-entrypoint` before each command, so nothing a command writes —
# node_modules, .next, dist, generated Prisma clients, a stray file — can reach the host checkout.
#
# Base image: node:22 matches `engines.node` (>=22). The pnpm version is the one in package.json's
# `packageManager`, pinned here so the image and the lockfile agree.
#
# Deliberately NOT in here: Docker (the Testcontainers integration tier needs a daemon — see
# docs/SANDBOX.md), a browser (the Playwright tiers), and any secret. Credentials arrive as
# environment variables from the compose file at run time.

FROM node:22-bookworm-slim

# Dev-only tooling inside a throwaway container, never shipped: rsync (sync the repo copy),
# postgresql-client (psql, for `sandbox psql` and `verify`), curl (health checks), openssl and
# ca-certificates (corepack's download, TLS). Recorded in docs/DEPENDENCIES.md.
RUN apt-get update \
 && apt-get install -y --no-install-recommends rsync postgresql-client curl openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

ARG PNPM_VERSION=10.33.0
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

# The volumes below mount here. Creating the directories owned by the unprivileged `node` user first
# makes a fresh named volume inherit that ownership, so nothing runs as root.
RUN mkdir -p /workspace /pnpm-store && chown -R node:node /workspace /pnpm-store

COPY sandbox-entrypoint.sh /usr/local/bin/sandbox-entrypoint
COPY sandbox-verify.sh /usr/local/bin/sandbox-verify
RUN chmod 0755 /usr/local/bin/sandbox-entrypoint /usr/local/bin/sandbox-verify

USER node
WORKDIR /workspace
ENV CI=true \
    npm_config_store_dir=/pnpm-store \
    NEXT_TELEMETRY_DISABLED=1 \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
ENTRYPOINT ["sandbox-entrypoint"]
CMD ["bash"]
