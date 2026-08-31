output "bucket_name" {
  value = aws_s3_bucket.this.bucket
}

output "bucket_arn" {
  value = aws_s3_bucket.this.arn
}

output "endpoint" {
  description = "OBJECT_STORE_ENDPOINT — S3's regional endpoint, matching MinIO's http://host:port shape for dev."
  value       = "https://s3.${data.aws_region.current.name}.amazonaws.com"
}

output "read_write_policy_arn" {
  description = "Attach to the ECS task role (via the ecs-service module's `iam_policy_arns` var) so a task can read/write this bucket without broader S3 access."
  value       = aws_iam_policy.read_write.arn
}

data "aws_region" "current" {}
