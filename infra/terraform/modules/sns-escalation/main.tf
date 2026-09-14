# SNS topic for safeguarding escalation — OQ-014 close.
#
# Publishes school-level safeguarding events to a single topic whose subscriptions
# (SMS, email, PagerDuty HTTP endpoint, Lambda, etc.) are configured in the AWS console
# by each pilot school, not in this module. Routing is outside the codebase so operators
# can update it without a deployment.
#
# KMS encryption: safeguarding messages carry refusal codes and clinical-language
# explanations that are sensitive enough to warrant at-rest encryption on the topic. A
# single regional key per stack is the right granularity — one key per school would add
# cost with no cross-tenant isolation benefit, since each environment is already a
# separate AWS stack with its own topic.
#
# IAM: the publish policy includes both sns:Publish and the kms:GenerateDataKey /
# kms:Decrypt actions the SNS service needs to encrypt/decrypt messages on behalf of the
# publisher. Attach this policy to the worker ECS task role via ecs-service's
# `iam_policy_arns` — the container process (the task role, not the execution role) is
# what calls sns:Publish at runtime.

resource "aws_kms_key" "this" {
  description             = "${var.name} safeguarding escalation encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = var.tags
}

resource "aws_kms_alias" "this" {
  name          = "alias/${var.name}"
  target_key_id = aws_kms_key.this.key_id
}

resource "aws_sns_topic" "this" {
  name              = var.name
  kms_master_key_id = aws_kms_key.this.id

  tags = var.tags
}

data "aws_iam_policy_document" "publish" {
  statement {
    sid       = "SnsSafeguardingPublish"
    actions   = ["sns:Publish"]
    resources = [aws_sns_topic.this.arn]
  }

  # SNS uses the KMS key on behalf of the publisher when encrypting the message. The
  # task role needs GenerateDataKey (to encrypt on publish) and Decrypt (for SNS's own
  # internal re-encrypt on delivery to encrypted subscriptions, e.g. an SQS fan-out).
  statement {
    sid       = "KmsForSnsSafeguarding"
    actions   = ["kms:GenerateDataKey", "kms:Decrypt"]
    resources = [aws_kms_key.this.arn]
  }
}

resource "aws_iam_policy" "publish" {
  name        = "${var.name}-publish"
  description = "Allows the worker ECS task to publish safeguarding escalations to the SNS topic."
  policy      = data.aws_iam_policy_document.publish.json

  tags = var.tags
}
