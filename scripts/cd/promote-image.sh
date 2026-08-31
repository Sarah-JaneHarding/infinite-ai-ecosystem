#!/usr/bin/env bash
# Promotes one already-built, already-tested image from one environment's ECR
# repository to another's, unchanged — "build once, promote the same artifact," not a
# second build. staging and production each have their own ECR repository (one per
# environment, per infra/terraform/modules/ecs-service's own design), so getting the
# exact image staging just ran through docs/RUNBOOKS/canary-deploy.md's checks into
# production means copying it, not rebuilding it: a second build could, in principle,
# produce different bytes (a base image tag moving, an untracked build-time input) even
# from the same source commit, which would make "tested in staging" mean nothing.
#
# Requires: docker CLI, already authenticated against both registries (both are ECR in
# the same account today, so one `aws ecr get-login-password` covers both — see the
# calling workflow for how credentials are configured).

set -euo pipefail

if [[ $# -ne 3 ]]; then
  echo "Usage: $0 <source-ecr-repository-url> <dest-ecr-repository-url> <tag>" >&2
  exit 1
fi

SOURCE_REPOSITORY_URL="$1"
DEST_REPOSITORY_URL="$2"
TAG="$3"

echo "== Promoting ${SOURCE_REPOSITORY_URL}:${TAG} -> ${DEST_REPOSITORY_URL}:${TAG} ==" >&2

docker pull "${SOURCE_REPOSITORY_URL}:${TAG}"
docker tag "${SOURCE_REPOSITORY_URL}:${TAG}" "${DEST_REPOSITORY_URL}:${TAG}"
docker push "${DEST_REPOSITORY_URL}:${TAG}"

echo "Promoted." >&2
