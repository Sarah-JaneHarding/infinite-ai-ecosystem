# One self-hosted ClickHouse node on EC2+EBS — Langfuse's own analytics store
# (LLM traces, observations, scores; see modules/langfuse's own header for why Langfuse
# needs this at all). Every other stateful piece of this Terraform tree (Postgres,
# Redis, S3) runs on a managed AWS service; ClickHouse is the one exception, and
# deliberately so — this repo's whole compute layer is ECS Fargate, which has no
# persistent local disk, and ClickHouse's own docs advise against EFS for its data
# directory (meaningfully worse I/O latency than local NVMe). A managed ClickHouse
# service was the other option raised and explicitly rejected: it would mean
# self-hosted Langfuse (INFINITEAI_BUILD_MANUAL.md's own "LLM observability: Langfuse
# (self-hosted)" line) storing its data on a third-party platform, in tension with the
# same POPIA data-residency reasoning (§1.3) `af-south-1` and every other data store in
# this Terraform already exist for.
#
# What this deliberately is not: a ClickHouse cluster. One node, one EBS volume, no
# replication, no ClickHouse Keeper. A real production ClickHouse deployment at a scale
# beyond a pilot needs those — a real, separate decision when Langfuse's own trace
# volume actually needs it, not assumed here. Losing this instance loses trace history
# (LLM observability), never learner data — nothing in packages/db's own tenant-scoped
# tables lives here.

data "aws_region" "current" {}

data "aws_subnet" "selected" {
  id = var.private_subnet_id
}

# Amazon Linux 2023, arm64 — matches this Terraform's own Graviton preference
# (db.t4g.*, cache.t4g.*) and t4g.medium's own architecture.
data "aws_ssm_parameter" "al2023_arm64" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64"
}

resource "aws_security_group" "this" {
  name        = var.name
  description = "ClickHouse 8123 (HTTP)/9000 (native) — inbound only from Langfuse's own web/worker security groups."
  vpc_id      = var.vpc_id

  tags = merge(var.tags, { Name = var.name })
}

resource "aws_security_group_rule" "ingress_http" {
  count = length(var.allowed_security_group_ids)

  type                     = "ingress"
  from_port                = 8123
  to_port                  = 8123
  protocol                 = "tcp"
  security_group_id        = aws_security_group.this.id
  source_security_group_id = var.allowed_security_group_ids[count.index]
}

resource "aws_security_group_rule" "ingress_native" {
  count = length(var.allowed_security_group_ids)

  type                     = "ingress"
  from_port                = 9000
  to_port                  = 9000
  protocol                 = "tcp"
  security_group_id        = aws_security_group.this.id
  source_security_group_id = var.allowed_security_group_ids[count.index]
}

resource "aws_security_group_rule" "egress_all" {
  type              = "egress"
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  security_group_id = aws_security_group.this.id
  cidr_blocks       = ["0.0.0.0/0"]
}

# --- Credentials: generated, stored in Secrets Manager, fetched by user-data at boot —
# never rendered into user-data itself (see user-data.sh.tpl's own header). ------------

resource "random_password" "clickhouse" {
  length  = 32
  special = false
}

resource "aws_secretsmanager_secret" "credentials" {
  name                    = "${var.name}/credentials"
  recovery_window_in_days = 7

  tags = var.tags
}

resource "aws_secretsmanager_secret_version" "credentials" {
  secret_id = aws_secretsmanager_secret.credentials.id
  secret_string = jsonencode({
    user     = "clickhouse"
    password = random_password.clickhouse.result
  })
}

# --- IAM: SSM Session Manager for shell access (no SSH key — same "no long-lived
# credential" posture bootstrap-roles.sh's own header already states a preference for),
# plus read access to exactly this instance's own credentials secret. --------------------

data "aws_iam_policy_document" "assume_ec2" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "this" {
  name               = var.name
  assume_role_policy = data.aws_iam_policy_document.assume_ec2.json

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.this.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

data "aws_iam_policy_document" "read_credentials" {
  statement {
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [aws_secretsmanager_secret.credentials.arn]
  }
}

resource "aws_iam_role_policy" "read_credentials" {
  name   = "${var.name}-read-credentials"
  role   = aws_iam_role.this.id
  policy = data.aws_iam_policy_document.read_credentials.json
}

resource "aws_iam_instance_profile" "this" {
  name = var.name
  role = aws_iam_role.this.name
}

# --- The data volume — created and destroyed independently of the instance, so
# replacing the instance (a new AMI, an instance-type resize) detaches and reattaches
# the same volume rather than losing it. -----------------------------------------------

resource "aws_ebs_volume" "data" {
  availability_zone = data.aws_subnet.selected.availability_zone
  size              = var.volume_size_gb
  type              = "gp3"
  encrypted         = true

  tags = merge(var.tags, { Name = "${var.name}-data" })

  lifecycle {
    prevent_destroy = true
  }
}

locals {
  device_name = "/dev/sdf"
}

resource "aws_instance" "this" {
  ami                    = data.aws_ssm_parameter.al2023_arm64.value
  instance_type          = var.instance_type
  subnet_id              = var.private_subnet_id
  vpc_security_group_ids = [aws_security_group.this.id]
  iam_instance_profile   = aws_iam_instance_profile.this.name

  # Private-subnet only, same as every ECS task in this Terraform tree — reachable from
  # langfuse-web/langfuse-worker's own security groups, never directly from the internet.
  associate_public_ip_address = false

  metadata_options {
    http_tokens   = "required" # IMDSv2 only
    http_endpoint = "enabled"
  }

  root_block_device {
    volume_size = 20
    volume_type = "gp3"
    encrypted   = true
  }

  user_data = templatefile("${path.module}/user-data.sh.tpl", {
    device_name            = local.device_name
    aws_region             = data.aws_region.current.name
    credentials_secret_arn = aws_secretsmanager_secret.credentials.arn
    clickhouse_version     = var.clickhouse_version
  })

  # A new user_data (e.g. bumping clickhouse_version) should not silently no-op against
  # an instance that already ran the old script once — force a real reboot-and-rerun via
  # replacement instead, since user-data itself only runs the deep bootstrap on first
  # boot (see the script's own idempotency guards for what "rerun" actually still does).
  user_data_replace_on_change = true

  tags = merge(var.tags, { Name = var.name })
}

resource "aws_volume_attachment" "data" {
  device_name = local.device_name
  volume_id   = aws_ebs_volume.data.id
  instance_id = aws_instance.this.id
}
