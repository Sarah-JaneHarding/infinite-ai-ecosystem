#!/usr/bin/env bash
# Deploys one image tag to one ECS Fargate service — the "deploy code" step
# infra/terraform/README.md named as the CD pipeline's job, not Terraform's: Terraform
# owns the service, task definition shape, and the ECR repository; this script owns what
# tag is running right now, the same way docs/RUNBOOKS/canary-deploy.md's manual
# commands do, called from .github/workflows/cd.yml instead of typed by a human.
#
# What it does, in order:
#   1. Reads the service's current task definition — this is the rollback target, so it
#      is captured before anything changes, never re-derived after a failed deploy.
#   2. Registers a new task definition revision, identical except for the one container's
#      image tag (same jq transform docs/RUNBOOKS/canary-deploy.md's manual steps use).
#   3. Updates the service to the new revision and waits for it to stabilise, using the
#      same minimumHealthyPercent=100/maximumPercent=200 configuration
#      canary-deploy.md's own "Step 2 — Full rollout" uses — a plain rolling deploy, not
#      a traffic-weighted canary (canary-deploy.md's own "What this cannot do yet"
#      section names what that would need: a second, paired target group).
#   4. If alarm names are given, polls their state for a few minutes after the rollout
#      stabilises. Any alarm in ALARM state triggers an automatic rollback to the task
#      definition captured in step 1 — closing the exact gap canary-deploy.md's own
#      "Automatic rollback" section names: "there is no automatic one until something
#      subscribes to alerts." This is that something.
#
# Requires: aws CLI (credentials already configured — this script does not assume OIDC
# or any other auth method), jq.

set -euo pipefail

if [[ $# -lt 4 ]]; then
  echo "Usage: $0 <cluster-name> <service-name> <ecr-repository-url> <image-tag> [alarm-name ...]" >&2
  echo "  e.g.  $0 infinite-ai-staging infinite-ai-staging-gateway \\" >&2
  echo "          123456789012.dkr.ecr.af-south-1.amazonaws.com/infinite-ai-staging-gateway \\" >&2
  echo "          a1b2c3d infinite-ai-staging-gateway-error-rate infinite-ai-staging-gateway-latency-p95" >&2
  exit 1
fi

CLUSTER="$1"
SERVICE="$2"
ECR_REPOSITORY_URL="$3"
IMAGE_TAG="$4"
shift 4
ALARM_NAMES=("$@")

# Alarms are polled once a minute; five checks matches the deployment's own health-check
# cadence (30s interval, 30s start period — a bad task fails its own check well inside
# this window) without holding a CI runner open as long as canary-deploy.md's manual
# 15-minute human-monitoring window, which assumes a human watching other signals too
# (logs, RLS violations) this script cannot evaluate.
MONITOR_CHECKS="${DEPLOY_MONITOR_CHECKS:-5}"
MONITOR_INTERVAL_SECONDS="${DEPLOY_MONITOR_INTERVAL_SECONDS:-60}"

echo "== ${SERVICE}: capturing current task definition (the rollback target) ==" >&2
PREVIOUS_TASK_DEF_ARN=$(aws ecs describe-services \
  --cluster "$CLUSTER" --services "$SERVICE" \
  --query 'services[0].taskDefinition' --output text)
echo "Current: ${PREVIOUS_TASK_DEF_ARN}" >&2

echo "== ${SERVICE}: registering a new task definition revision (image tag ${IMAGE_TAG}) ==" >&2
NEW_TASK_DEF_ARN=$(aws ecs register-task-definition \
  --cli-input-json "$(aws ecs describe-task-definition \
    --task-definition "$PREVIOUS_TASK_DEF_ARN" \
    --query 'taskDefinition' | \
    jq --arg image "${ECR_REPOSITORY_URL}:${IMAGE_TAG}" \
      '.containerDefinitions[0].image = $image' | \
    jq 'del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy)')" \
  --query 'taskDefinition.taskDefinitionArn' --output text)
echo "Registered: ${NEW_TASK_DEF_ARN}" >&2

deploy_task_definition() {
  local task_def_arn="$1"
  aws ecs update-service \
    --cluster "$CLUSTER" --service "$SERVICE" \
    --task-definition "$task_def_arn" \
    --deployment-configuration "minimumHealthyPercent=100,maximumPercent=200" \
    >/dev/null
  aws ecs wait services-stable --cluster "$CLUSTER" --services "$SERVICE"
}

rollback() {
  echo "::error::${SERVICE}: rolling back to ${PREVIOUS_TASK_DEF_ARN}" >&2
  deploy_task_definition "$PREVIOUS_TASK_DEF_ARN"
  echo "${SERVICE}: rolled back and stable." >&2
}

echo "== ${SERVICE}: deploying ${NEW_TASK_DEF_ARN} ==" >&2
deploy_task_definition "$NEW_TASK_DEF_ARN"
echo "${SERVICE}: stable on the new revision." >&2

if [[ "${#ALARM_NAMES[@]}" -eq 0 ]]; then
  echo "${SERVICE}: no alarms named — nothing to monitor (e.g. apps/worker has no ALB target group)." >&2
  exit 0
fi

echo "== ${SERVICE}: monitoring ${ALARM_NAMES[*]} for ${MONITOR_CHECKS} check(s), ${MONITOR_INTERVAL_SECONDS}s apart ==" >&2
for ((check = 1; check <= MONITOR_CHECKS; check++)); do
  sleep "$MONITOR_INTERVAL_SECONDS"

  IN_ALARM=$(aws cloudwatch describe-alarms \
    --alarm-names "${ALARM_NAMES[@]}" \
    --state-value ALARM \
    --query 'MetricAlarms[].AlarmName' --output text)

  if [[ -n "$IN_ALARM" ]]; then
    echo "::error::${SERVICE}: alarm(s) fired during post-deploy monitoring: ${IN_ALARM}" >&2
    rollback
    exit 1
  fi

  echo "${SERVICE}: check ${check}/${MONITOR_CHECKS} clear." >&2
done

echo "${SERVICE}: deploy complete, no alarms fired during monitoring." >&2
