output "state_bucket_name" {
  value = aws_s3_bucket.state.bucket
}

output "lock_table_name" {
  value = aws_dynamodb_table.lock.name
}

output "github_deploy_role_arn" {
  description = "Paste into the deploy workflow's `role-to-assume` input (aws-actions/configure-aws-credentials)."
  value       = aws_iam_role.github_deploy.arn
}
