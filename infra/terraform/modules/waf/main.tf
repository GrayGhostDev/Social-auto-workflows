terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# WAF Web ACL
resource "aws_wafv2_web_acl" "grayghost_ai" {
  name  = "${var.environment}-grayghost-ai-waf"
  scope = "REGIONAL"

  default_action {
    allow {}
  }

  # Rule 1: Geo-blocking
  rule {
    name     = "GeoBlockingRule"
    priority = 1

    action {
      block {}
    }

    statement {
      not_statement {
        statement {
          geo_match_statement {
            country_codes = var.allowed_countries
          }
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "GeoBlockingRule"
      sampled_requests_enabled   = true
    }
  }

  # Rule 2: Rate limiting
  rule {
    name     = "RateLimitRule"
    priority = 2

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = 2000  # 100 requests per minute = 2000 per 5 minutes
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "RateLimitRule"
      sampled_requests_enabled   = true
    }
  }

  # Rule 3: Size restrictions
  rule {
    name     = "SizeRestrictionRule"
    priority = 3

    action {
      block {}
    }

    statement {
      size_constraint_statement {
        field_to_match {
          body {}
        }
        comparison_operator = "GT"
        size                = 20971520  # 20MB in bytes
        text_transformation {
          priority = 0
          type     = "NONE"
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "SizeRestrictionRule"
      sampled_requests_enabled   = true
    }
  }

  # Rule 4: AWS Managed Core Rule Set
  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 4

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"

        rule_action_override {
          action_to_use {
            count {}
          }
          name = "NoUserAgent_HEADER"
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSManagedRulesCommonRuleSetMetric"
      sampled_requests_enabled   = true
    }
  }

  # Rule 5: Known Bad Inputs
  rule {
    name     = "AWSManagedRulesKnownBadInputsRuleSet"
    priority = 5

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSManagedRulesKnownBadInputsRuleSetMetric"
      sampled_requests_enabled   = true
    }
  }

  # Rule 6: SQL injection protection
  rule {
    name     = "AWSManagedRulesSQLiRuleSet"
    priority = 6

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesSQLiRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSManagedRulesSQLiRuleSetMetric"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "GrayGhostAIWAF"
    sampled_requests_enabled   = true
  }

  tags = merge(
    var.tags,
    {
      Name        = "${var.environment}-grayghost-ai-waf"
      Environment = var.environment
    }
  )
}

# WAF Logging Configuration
resource "aws_cloudwatch_log_group" "waf_log_group" {
  name              = "/aws/wafv2/${var.environment}-grayghost-ai"
  retention_in_days = 7  # 7-day rotation as specified
  kms_key_id        = var.kms_key_id

  tags = merge(
    var.tags,
    {
      Name        = "${var.environment}-waf-logs"
      Environment = var.environment
      PIILevel    = "low-impact"
    }
  )
}

resource "aws_wafv2_web_acl_logging_configuration" "waf_logging" {
  resource_arn            = aws_wafv2_web_acl.grayghost_ai.arn
  log_destination_configs = [aws_cloudwatch_log_group.waf_log_group.arn]

  redacted_fields {
    single_header {
      name = "authorization"
    }
  }

  redacted_fields {
    single_header {
      name = "cookie"
    }
  }

  redacted_fields {
    single_header {
      name = "x-auth-token"
    }
  }
}

# ALB Association (if ALB ARN is provided)
resource "aws_wafv2_web_acl_association" "alb" {
  count        = var.alb_arn != "" ? 1 : 0
  resource_arn = var.alb_arn
  web_acl_arn  = aws_wafv2_web_acl.grayghost_ai.arn
}

# CloudWatch Dashboard for WAF
resource "aws_cloudwatch_dashboard" "waf_dashboard" {
  dashboard_name = "${var.environment}-waf-dashboard"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/WAFV2", "BlockedRequests", "WebACL", aws_wafv2_web_acl.grayghost_ai.name, "Region", var.aws_region, "Rule", "ALL"],
            [".", "AllowedRequests", ".", ".", ".", ".", ".", "."],
            [".", "CountedRequests", ".", ".", ".", ".", ".", "."]
          ]
          period = 300
          stat   = "Sum"
          region = var.aws_region
          title  = "WAF Request Metrics"
        }
      },
      {
        type   = "metric"
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/WAFV2", "BlockedRequests", "WebACL", aws_wafv2_web_acl.grayghost_ai.name, "Region", var.aws_region, "Rule", "GeoBlockingRule"],
            ["...", "RateLimitRule"],
            ["...", "SizeRestrictionRule"]
          ]
          period = 300
          stat   = "Sum"
          region = var.aws_region
          title  = "Blocked Requests by Rule"
        }
      }
    ]
  })
}