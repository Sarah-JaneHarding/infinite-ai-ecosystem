output "send_policy_arn" {
  description = "Attach to the gateway ECS task role via ecs-service's `iam_policy_arns`. Grants ses:SendEmail and ses:SendRawEmail for the registered domain identity."
  value       = aws_iam_policy.send.arn
}

output "domain_identity_arn" {
  description = "ARN of the SES domain identity. Useful for adding additional per-email-address or configuration-set send policies."
  value       = aws_ses_domain_identity.this.arn
}

output "from_domain" {
  description = "The verified sending domain (var.domain_name). Use in application config as the FROM address domain, e.g. no-reply@<from_domain>."
  value       = var.domain_name
}

output "mail_from_domain" {
  description = "The MAIL FROM subdomain used for SPF alignment and bounce routing."
  value       = aws_ses_domain_mail_from.this.mail_from_domain
}
