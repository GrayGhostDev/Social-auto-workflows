output "web_acl_id" {
  description = "The ID of the WAF WebACL"
  value       = aws_wafv2_web_acl.grayghost_ai.id
}

output "web_acl_arn" {
  description = "The ARN of the WAF WebACL"
  value       = aws_wafv2_web_acl.grayghost_ai.arn
}

output "web_acl_capacity" {
  description = "The capacity consumed by the WAF WebACL rules"
  value       = aws_wafv2_web_acl.grayghost_ai.capacity
}

output "cloudwatch_log_group_name" {
  description = "The name of the CloudWatch log group for WAF logs"
  value       = aws_cloudwatch_log_group.waf_log_group.name
}

output "cloudwatch_log_group_arn" {
  description = "The ARN of the CloudWatch log group for WAF logs"
  value       = aws_cloudwatch_log_group.waf_log_group.arn
}

output "dashboard_url" {
  description = "URL to the CloudWatch dashboard for WAF metrics"
  value       = "https://console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards:name=${aws_cloudwatch_dashboard.waf_dashboard.dashboard_name}"
}