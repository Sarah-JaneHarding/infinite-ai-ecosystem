# S3 bucket for object storage — Brain snapshots (docs/RUNBOOKS/region-loss.md's hourly
# snapshots) and whatever else OBJECT_STORE_BUCKET names, matching MinIO's role in
# infra/docker/compose.dev.yml exactly (the app talks to it through the same S3-compatible
# API either way, no code branch for "real S3 vs MinIO"). Private, versioned (a snapshot
# overwritten by mistake is still recoverable), and encrypted with a dedicated KMS key —
# this bucket can hold de-identified Brain content, never raw learner PII (rule 4), but
# "de-identified" is not the same claim as "not sensitive."

resource "aws_kms_key" "this" {
  description             = "${var.name} object store encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = var.tags
}

resource "aws_s3_bucket" "this" {
  bucket = var.name

  tags = var.tags
}

resource "aws_s3_bucket_versioning" "this" {
  bucket = aws_s3_bucket.this.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "this" {
  bucket = aws_s3_bucket.this.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.this.arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "this" {
  bucket = aws_s3_bucket.this.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "this" {
  bucket = aws_s3_bucket.this.id

  rule {
    id     = "expire-noncurrent-snapshot-versions"
    status = "Enabled"

    # Versioning protects against an accidental overwrite; it should not turn into an
    # unbounded storage bill for hourly snapshots. 90 days comfortably outlives every
    # retention/restore runbook's own RPO/RTO window (docs/RUNBOOKS/region-loss.md,
    # database-restore.md) — a real schedule, once a school's retention determination
    # exists (OQ-007), may shorten this.
    noncurrent_version_expiration {
      noncurrent_days = 90
    }
  }
}

data "aws_iam_policy_document" "read_write" {
  statement {
    sid = "ReadWriteObjects"
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
    ]
    resources = ["${aws_s3_bucket.this.arn}/*"]
  }
  statement {
    sid       = "ListBucket"
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.this.arn]
  }
  statement {
    sid       = "UseKmsKey"
    actions   = ["kms:Decrypt", "kms:GenerateDataKey"]
    resources = [aws_kms_key.this.arn]
  }
}

resource "aws_iam_policy" "read_write" {
  name   = "${var.name}-object-store-rw"
  policy = data.aws_iam_policy_document.read_write.json
}
