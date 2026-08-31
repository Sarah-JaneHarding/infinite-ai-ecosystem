# Applied once, manually, by a human with real AWS credentials — before this, no
# environment's backend.tf has anywhere to point. Nothing in environments/{dev,staging,
# production} can `terraform init` until the two resources here (the state bucket, the
# lock table) exist, and no CI workflow can run `terraform plan`/`apply` until the OIDC
# role here exists — this is the one part of infra/terraform that is not itself managed
# through the same remote-state pattern everything else uses (its own state should be
# kept locally or in a private, separately-secured location the applying human controls,
# not committed).
#
# "No long-lived cloud credentials. CI authenticates via GitHub Actions OIDC" —
# infra/terraform/README.md's own standing constraint — is what the IAM role below is
# for: a GitHub Actions workflow exchanges a short-lived OIDC token for temporary
# credentials scoped to var.github_repository and var.github_branches, never a stored
# AWS access key.

resource "aws_s3_bucket" "state" {
  bucket = "infinite-ai-terraform-state"

  tags = var.tags
}

resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "state" {
  bucket = aws_s3_bucket.state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

data "aws_iam_policy_document" "state_require_tls" {
  statement {
    sid       = "DenyInsecureTransport"
    effect    = "Deny"
    actions   = ["s3:*"]
    resources = [aws_s3_bucket.state.arn, "${aws_s3_bucket.state.arn}/*"]
    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
    principals {
      type        = "*"
      identifiers = ["*"]
    }
  }
}

resource "aws_s3_bucket_policy" "state" {
  bucket = aws_s3_bucket.state.id
  policy = data.aws_iam_policy_document.state_require_tls.json
}

resource "aws_dynamodb_table" "lock" {
  name         = "infinite-ai-terraform-lock"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  tags = var.tags
}

# --- GitHub Actions OIDC --------------------------------------------------------

data "tls_certificate" "github" {
  url = "https://token.actions.githubusercontent.com/.well-known/openid-configuration"
}

resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.github.certificates[0].sha1_fingerprint]

  tags = var.tags
}

data "aws_iam_policy_document" "github_assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    # One condition value per allowed branch — a PR branch is never in this list, so a
    # workflow run on a PR cannot assume this role no matter what it requests.
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = [for b in var.github_branches : "repo:${var.github_repository}:ref:refs/heads/${b}"]
    }
  }
}

resource "aws_iam_role" "github_deploy" {
  name               = "infinite-ai-github-deploy"
  assume_role_policy = data.aws_iam_policy_document.github_assume.json

  tags = var.tags
}

# PowerUserAccess (AWS managed) covers everything this Terraform manages except IAM
# itself, which it deliberately excludes — and the ecs-service/database/object-store
# modules all create IAM roles and policies. The supplemental statement below re-grants
# exactly that, scoped to this project's own resource-name prefix ("infinite-ai-"), not
# IAM broadly. This is still a wide grant — tightening it to the exact action list
# Terraform's AWS provider needs per resource type is real, separate security work
# (a permissions boundary, most likely) that should happen before this handles real
# production traffic, not a decision to make by guessing at the full action list here.
resource "aws_iam_role_policy_attachment" "github_deploy_power_user" {
  role       = aws_iam_role.github_deploy.name
  policy_arn = "arn:aws:iam::aws:policy/PowerUserAccess"
}

data "aws_iam_policy_document" "github_deploy_iam" {
  statement {
    sid = "ManageProjectIamResources"
    actions = [
      "iam:CreateRole",
      "iam:DeleteRole",
      "iam:GetRole",
      "iam:PassRole",
      "iam:TagRole",
      "iam:AttachRolePolicy",
      "iam:DetachRolePolicy",
      "iam:PutRolePolicy",
      "iam:DeleteRolePolicy",
      "iam:GetRolePolicy",
      "iam:ListRolePolicies",
      "iam:ListAttachedRolePolicies",
      "iam:CreatePolicy",
      "iam:DeletePolicy",
      "iam:GetPolicy",
      "iam:GetPolicyVersion",
      "iam:CreatePolicyVersion",
      "iam:DeletePolicyVersion",
      "iam:ListPolicyVersions",
    ]
    resources = [
      "arn:aws:iam::*:role/infinite-ai-*",
      "arn:aws:iam::*:policy/infinite-ai-*",
    ]
  }
}

resource "aws_iam_role_policy" "github_deploy_iam" {
  name   = "infinite-ai-manage-project-iam"
  role   = aws_iam_role.github_deploy.name
  policy = data.aws_iam_policy_document.github_deploy_iam.json
}

data "aws_iam_policy_document" "github_deploy_state" {
  statement {
    actions   = ["s3:GetObject", "s3:PutObject", "s3:ListBucket"]
    resources = [aws_s3_bucket.state.arn, "${aws_s3_bucket.state.arn}/*"]
  }
  statement {
    actions   = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:DeleteItem"]
    resources = [aws_dynamodb_table.lock.arn]
  }
}

resource "aws_iam_role_policy" "github_deploy_state" {
  name   = "infinite-ai-terraform-state-access"
  role   = aws_iam_role.github_deploy.name
  policy = data.aws_iam_policy_document.github_deploy_state.json
}
