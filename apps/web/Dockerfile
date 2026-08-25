# syntax=docker/dockerfile:1
#
# apps/web — the Next.js experience surface. Unlike apps/worker and apps/gateway, this
# one has a real build step: `next build` needs to run once, ahead of time, so
# `next start` in the runtime stage is serving compiled output, not compiling on every
# request. Build-time env is deliberately absent here — apps/web/src/lib/env.ts's
# getWebEnv() returns a placeholder during NEXT_PHASE=phase-production-build precisely
# so the build never needs a real secret; the runtime stage still needs a real
# NEXTAUTH_SECRET and Keycloak configuration supplied at deploy time.
#
# Same monorepo-wide dependency shape as the other two Dockerfiles in this repo — see
# apps/worker/Dockerfile's header for why, and for the known size-optimization
# follow-up (this carries the whole workspace, not just what apps/web needs at runtime).

FROM node:22 AS base
# The full (non-slim) image, deliberately — see apps/worker/Dockerfile's header: it
# already carries the libssl Prisma's query engine needs, with no live apt-get required.
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /repo

FROM base AS install
COPY . .
RUN pnpm install --frozen-lockfile

FROM install AS build
RUN pnpm --filter @infinite-ai/web build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /repo /repo
WORKDIR /repo/apps/web

EXPOSE 3000

CMD ["pnpm", "start"]
