# syntax=docker/dockerfile:1
#
# apps/gateway — the Model Gateway. Same shape as apps/worker/Dockerfile; see that
# file's header for why this builds from the whole workspace and runs via `tsx` rather
# than a separate compiled artifact, and for the known size-optimization follow-up.

FROM node:22 AS base
# The full (non-slim) image, deliberately — see apps/worker/Dockerfile's header: it
# already carries the libssl Prisma's query engine needs, with no live apt-get required.
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /repo

FROM base AS install
COPY . .
RUN pnpm install --frozen-lockfile

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=install /repo /repo
WORKDIR /repo/apps/gateway

# GATEWAY_PORT (apps/gateway/src/config/env.ts) defaults to 8080 if unset.
EXPOSE 8080

CMD ["pnpm", "start"]
