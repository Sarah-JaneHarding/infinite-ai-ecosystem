#!/bin/bash
# Runs once, at first boot, as EC2 user-data — Amazon Linux 2023. Idempotent: every step
# checks before acting, so a reboot (which re-runs this same script, per AL2023's
# cloud-init behaviour) is a clean no-op, not a re-provision.
#
# Does NOT embed the ClickHouse password: it is fetched from Secrets Manager at boot,
# via the instance profile's own scoped-to-this-one-secret IAM permission, the same
# "never bake a secret into what's rendered/visible" discipline every other credential
# in this Terraform tree already holds to (ECS's own `secrets` mechanism; bootstrap-roles.sh's
# own header). User-data itself is visible in the EC2 console to anyone with
# `ec2:DescribeInstanceAttribute` on this instance — embedding the password directly here
# would defeat the point of generating it with `random_password` in the first place.
set -euo pipefail

exec > >(tee /var/log/clickhouse-bootstrap.log) 2>&1
echo "=== ClickHouse bootstrap: $(date -u) ==="

DEVICE="${device_name}"
MOUNT_POINT="/var/lib/clickhouse-data"

# --- Format (first boot only) and mount the data volume ------------------------------
if ! blkid "$DEVICE" >/dev/null 2>&1; then
  echo "Formatting $DEVICE (xfs, no existing filesystem detected)..."
  mkfs -t xfs "$DEVICE"
else
  echo "$DEVICE already has a filesystem — skipping mkfs."
fi

mkdir -p "$MOUNT_POINT"
if ! mountpoint -q "$MOUNT_POINT"; then
  mount "$DEVICE" "$MOUNT_POINT"
fi

# fstab entry survives a reboot; idempotent via the grep guard.
if ! grep -q "$MOUNT_POINT" /etc/fstab; then
  echo "$DEVICE $MOUNT_POINT xfs defaults,nofail 0 2" >>/etc/fstab
fi

# --- Docker ----------------------------------------------------------------------------
if ! command -v docker >/dev/null 2>&1; then
  dnf install -y docker
fi
systemctl enable --now docker

# --- Fetch the ClickHouse credential from Secrets Manager, never to a file -----------
CREDENTIALS_JSON=$(aws secretsmanager get-secret-value \
  --region "${aws_region}" \
  --secret-id "${credentials_secret_arn}" \
  --query 'SecretString' --output text)
CLICKHOUSE_USER=$(echo "$CREDENTIALS_JSON" | jq -r '.user')
CLICKHOUSE_PASSWORD=$(echo "$CREDENTIALS_JSON" | jq -r '.password')

# --- Run ClickHouse (same image/version infra/docker/compose.dev.yml validates) ------
if ! docker inspect clickhouse >/dev/null 2>&1; then
  docker run -d \
    --name clickhouse \
    --restart=always \
    --ulimit nofile=262144:262144 \
    -p 8123:8123 \
    -p 9000:9000 \
    -v "$MOUNT_POINT:/var/lib/clickhouse" \
    -e CLICKHOUSE_DB=default \
    -e CLICKHOUSE_USER="$CLICKHOUSE_USER" \
    -e CLICKHOUSE_PASSWORD="$CLICKHOUSE_PASSWORD" \
    "clickhouse/clickhouse-server:${clickhouse_version}"
else
  echo "clickhouse container already exists — not recreating (credential rotation needs a
  manual 'docker rm -f clickhouse' first, same as any other stateful container running
  outside an orchestrator that would otherwise handle that for you)."
fi

echo "=== ClickHouse bootstrap complete: $(date -u) ==="
