variable "environment" {
  description = "Environment name (dev, staging, production)"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "allowed_countries" {
  description = "List of allowed country codes for geo-fencing"
  type        = list(string)
  default     = ["US", "CA", "GB", "AU"]
}

variable "alb_arn" {
  description = "ARN of the ALB to associate with WAF"
  type        = string
  default     = ""
}

variable "kms_key_id" {
  description = "KMS key ID for encrypting WAF logs"
  type        = string
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}