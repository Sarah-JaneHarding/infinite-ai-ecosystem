#!/usr/bin/env bash
# Builds gateway/web/worker images from the monorepo root and pushes them to the ECR
# repositories that infra/terraform/environments/test/ creates, tagged ":test".
# Run after `terraform apply` in that environment to populate the repositories.
#
# Usage: ./scripts/cd/build-and-push-test.sh <aws-account-id>

set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Usage: $0 <aws-account-id>"
  exit 1
fi

ACCOUNT_ID="$1"
REGION="af-south-1"
REGISTRY="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"
TAG="test"

# Authenticate to ECR
aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$REGISTRY"

# Build from the monorepo root — every Dockerfile copies the whole workspace because
# pnpm's workspace:* protocol requires the full tree (see each Dockerfile's own header).
for SERVICE in gateway web worker; do
  ECR_REPO="${REGISTRY}/infinite-ai-test-${SERVICE}"
  echo "--- Building ${SERVICE} ---"
  docker build \
    -f "apps/${SERVICE}/Dockerfile" \
    -t "${ECR_REPO}:${TAG}" \
    .
  docker push "${ECR_REPO}:${TAG}"
  echo "Pushed ${ECR_REPO}:${TAG}"
done

echo ""
echo "Done. Re-run 'terraform apply' in infra/terraform/environments/test/ to roll the"
echo "new :test images into the running ECS services."
