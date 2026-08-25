# syntax=docker/dockerfile:1
#
# apps/worker — BullMQ consumer host.
#
# Built from the whole monorepo, not just this app's own directory: every
# @infinite-ai/* dependency resolves through pnpm's `workspace:*` protocol, which pnpm
# only satisfies with the full workspace tree present. Nothing in this repo emits
# standalone build output yet (see turbo.json's own note on that), so this image runs
# the app the same way local dev already does — `tsx` against source, via this
# package's own `start` script — rather than inventing a separate production build path
# that has never been proven.
#
# A known, deliberate follow-up, not done here: this single-stage-of-dependencies image
# carries the whole workspace's node_modules (every app, every package), not just what
# apps/worker needs at runtime. Slimming that — a pruned `pnpm deploy` output, or a real
# compiled build — is a size optimization on top of a working image, not a prerequisite
# for one.

FROM node:22 AS base
# The full (non-slim) image, deliberately: Prisma's query engine needs libssl at
# runtime, and the slim variant doesn't ship it, requiring a live `apt-get` against
# Debian's package repository — a dependency this Dockerfile shouldn't need at build
# time. `node:22`'s own layers already carry libssl.
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /repo

FROM base AS install
COPY . .
RUN pnpm install --frozen-lockfile

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=install /repo /repo
WORKDIR /repo/apps/worker

# Liveness/readiness probe — see src/health-server.ts. WORKER_PORT is read from the
# environment at boot (packages/config), not baked in; this just documents the default.
EXPOSE 8081

CMD ["pnpm", "start"]
