# CloudWatch alarms against the ALB's and each ECS service's own native metrics — a real,
# working alerting mechanism, but an honest partial one: docs/RUNBOOKS/canary-deploy.md
# and region-loss.md name specific SLO metrics (`gateway.error_rate`,
# `gateway.latency_p95`, `web_availability_burn_rate`) that this does not compute or
# emit. Those are OTel/Langfuse-shaped burn-rate metrics from Stage 15's own
# observability stack, which — per docs/STAGE_LOG.md's Tier 1 entry — is not deployed
# anywhere yet (Langfuse's self-hosted footprint is a separate, larger follow-up). What's
# here uses the same numeric thresholds those runbooks already settled on
# (canary-deploy.md's 1% error rate / 10s p95 rollback triggers), applied to the ALB's
# own `HTTPCode_Target_5XX_Count` and `TargetResponseTime` metrics instead — a real signal
# today, not the named SLO metric the runbooks will eventually read from Langfuse.
#
# The SNS topic this creates is alerting infrastructure, not OQ-014's paging integration:
# an email subscription is not a page, and nothing here claims it is.

resource "aws_sns_topic" "alerts" {
  name = "${var.name}-alerts"

  tags = var.tags
}

resource "aws_sns_topic_subscription" "email" {
  count = var.alert_email == null ? 0 : 1

  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

resource "aws_cloudwatch_metric_alarm" "error_rate" {
  for_each = var.target_group_arn_suffixes

  alarm_name          = "${var.name}-${each.key}-error-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  period              = 60
  threshold           = var.error_rate_threshold_pct
  treat_missing_data  = "notBreaching"
  alarm_description   = "5xx rate for ${each.key} exceeded ${var.error_rate_threshold_pct}% for 2 consecutive minutes — canary-deploy.md's own rollback threshold."
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]

  metric_query {
    id          = "error_rate"
    expression  = "(errors / requests) * 100"
    label       = "Error rate (%)"
    return_data = true
  }

  metric_query {
    id = "errors"
    metric {
      namespace   = "AWS/ApplicationELB"
      metric_name = "HTTPCode_Target_5XX_Count"
      period      = 60
      stat        = "Sum"
      dimensions = {
        LoadBalancer = var.alb_arn_suffix
        TargetGroup  = each.value
      }
    }
  }

  metric_query {
    id = "requests"
    metric {
      namespace   = "AWS/ApplicationELB"
      metric_name = "RequestCount"
      period      = 60
      stat        = "Sum"
      dimensions = {
        LoadBalancer = var.alb_arn_suffix
        TargetGroup  = each.value
      }
    }
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "latency_p95" {
  for_each = var.target_group_arn_suffixes

  alarm_name          = "${var.name}-${each.key}-latency-p95"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  extended_statistic  = "p95"
  threshold           = var.latency_p95_threshold_seconds
  treat_missing_data  = "notBreaching"
  alarm_description   = "p95 response time for ${each.key} exceeded ${var.latency_p95_threshold_seconds}s for 2 consecutive minutes — canary-deploy.md's own rollback threshold."
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
    TargetGroup  = each.value
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "cpu_high" {
  for_each = toset(var.ecs_service_names)

  alarm_name          = "${each.key}-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 60
  statistic           = "Average"
  threshold           = 85
  treat_missing_data  = "notBreaching"
  alarm_description   = "${each.key} CPU above 85% for 3 consecutive minutes — approaching the autoscaling ceiling (ecs-service module's own max_count)."
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    ClusterName = var.ecs_cluster_name
    ServiceName = each.key
  }

  tags = var.tags
}
