output "topic_arn" {
  description = "ARN of the safeguarding escalation SNS topic. Set as SAFEGUARDING_SNS_TOPIC_ARN in the worker ECS task environment."
  value       = aws_sns_topic.this.arn
}

output "publish_policy_arn" {
  description = "Attach to the worker ECS task role via ecs-service's `iam_policy_arns`. Grants sns:Publish plus the KMS actions SNS needs to encrypt/decrypt messages."
  value       = aws_iam_policy.publish.arn
}
