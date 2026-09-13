# SES domain identity for transactional email — OQ-021.
#
# Registers the deployment's own domain with SES and wires the DKIM / MAIL FROM DNS
# records so SES-sent messages pass DKIM and DMARC alignment. The resources here are
# purely infrastructure: which email addresses send from this domain, and what those
# emails contain, are application concerns outside this module.
#
# Regional note: Amazon SES is available in af-south-1. Because the pilot schools are
# in South Africa, sending from af-south-1 keeps email traffic in-region, reduces
# latency, and satisfies POPIA's preference for in-country data processing (POPIA §72
# cross-border transfers). Do not move SES resources to us-east-1 — that would route
# South African learner-related notifications through a foreign jurisdiction.
#
# SES sandbox: new accounts start in the SES sandbox (can only send to verified
# addresses). The `move out of sandbox` AWS support case must be raised manually before
# sending to arbitrary school addresses. This module does not automate that request.
#
# DMARC: requires both DKIM alignment (handled here) and SPF alignment. The MAIL FROM
# subdomain (var.mail_from_subdomain + "." + var.domain_name) carries an SPF TXT record
# allowing the SES service to send; DMARC then aligns against the From: domain. A
# _dmarc TXT record for the parent domain is the school's own policy decision (p=none /
# p=quarantine / p=reject), not set here.

resource "aws_ses_domain_identity" "this" {
  domain = var.domain_name
}

resource "aws_ses_domain_dkim" "this" {
  domain = aws_ses_domain_identity.this.domain
}

resource "aws_route53_record" "dkim" {
  for_each = toset(aws_ses_domain_dkim.this.dkim_tokens)

  zone_id = var.dns_zone_id
  name    = "${each.value}._domainkey.${var.domain_name}"
  type    = "CNAME"
  ttl     = 1800
  records = ["${each.value}.dkim.amazonses.com"]
}

# SES domain verification TXT record — proves ownership of the domain to SES.
resource "aws_route53_record" "verification" {
  zone_id = var.dns_zone_id
  name    = "_amazonses.${var.domain_name}"
  type    = "TXT"
  ttl     = 600
  records = [aws_ses_domain_identity.this.verification_token]
}

resource "aws_ses_domain_identity_verification" "this" {
  domain = aws_ses_domain_identity.this.domain

  depends_on = [aws_route53_record.verification]
}

# MAIL FROM subdomain — needed for DMARC alignment and RFC 5321 compliance. SES sends
# bounce notifications to the MAIL FROM domain; the MX record routes them back to SES.
resource "aws_ses_domain_mail_from" "this" {
  domain           = aws_ses_domain_identity.this.domain
  mail_from_domain = "${var.mail_from_subdomain}.${var.domain_name}"
}

resource "aws_route53_record" "mail_from_mx" {
  zone_id = var.dns_zone_id
  name    = "${var.mail_from_subdomain}.${var.domain_name}"
  type    = "MX"
  ttl     = 600
  records = ["10 feedback-smtp.${data.aws_region.current.name}.amazonses.com"]
}

# SPF record authorising SES to send on behalf of the MAIL FROM subdomain. The "~all"
# (softfail) rather than "-all" (hardfail) is deliberate: hardfail breaks forwarding
# scenarios common in school environments where staff use forwarded .edu.za addresses.
# Schools that have confirmed no-forwarding can upgrade to -all via AWS console.
resource "aws_route53_record" "mail_from_spf" {
  zone_id = var.dns_zone_id
  name    = "${var.mail_from_subdomain}.${var.domain_name}"
  type    = "TXT"
  ttl     = 600
  records = ["\"v=spf1 include:amazonses.com ~all\""]
}

data "aws_iam_policy_document" "send" {
  statement {
    sid = "SesSendEmail"
    # ses:SendEmail covers both the SES v1 and v2 send actions; SendRawEmail is
    # needed for multipart (HTML + plain-text) messages with inline attachments.
    actions = [
      "ses:SendEmail",
      "ses:SendRawEmail",
    ]
    resources = [
      aws_ses_domain_identity.this.arn,
    ]
  }
}

resource "aws_iam_policy" "send" {
  name        = "${var.name}-send"
  description = "Allows the gateway ECS task to send transactional email via SES."
  policy      = data.aws_iam_policy_document.send.json

  tags = var.tags
}

data "aws_region" "current" {}
