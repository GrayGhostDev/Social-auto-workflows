variable "environment" {
  description = "Environment name"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
}

variable "private_subnets" {
  description = "List of private subnet CIDR blocks"
  type        = list(string)
}

variable "public_subnets" {
  description = "List of public subnet CIDR blocks"
  type        = list(string)
}

variable "eks_cluster_name" {
  description = "Name of the EKS cluster"
  type        = string
}

variable "eks_cluster_version" {
  description = "Kubernetes version for EKS cluster"
  type        = string
}

variable "node_groups" {
  description = "EKS node group configurations"
  type = map(object({
    instance_types = list(string)
    scaling_config = object({
      desired_size = number
      min_size     = number
      max_size     = number
    })
    disk_size = number
    labels    = map(string)
  }))
}

variable "aurora_cluster_identifier" {
  description = "Identifier for Aurora cluster"
  type        = string
}

variable "aurora_engine_version" {
  description = "Aurora PostgreSQL engine version"
  type        = string
}

variable "aurora_instance_class" {
  description = "Instance class for Aurora instances"
  type        = string
}

variable "aurora_instances" {
  description = "Map of Aurora instances"
  type        = map(any)
}

variable "aurora_backup_retention_period" {
  description = "Backup retention period in days"
  type        = number
}

variable "aurora_preferred_backup_window" {
  description = "Preferred backup window"
  type        = string
}

variable "redis_cluster_id" {
  description = "ElastiCache Redis cluster ID"
  type        = string
}

variable "redis_node_type" {
  description = "Node type for Redis cluster"
  type        = string
}

variable "redis_engine_version" {
  description = "Redis engine version"
  type        = string
}

variable "redis_num_cache_nodes" {
  description = "Number of cache nodes"
  type        = number
}

variable "redis_parameter_group" {
  description = "Parameter group for Redis"
  type        = string
}

variable "allowed_countries" {
  description = "List of allowed country codes for WAF"
  type        = list(string)
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}

data "aws_availability_zones" "available" {
  state = "available"
}

# Ubuntu 22.04 LTS AMI for EKS
data "aws_ami" "ubuntu_eks" {
  most_recent = true
  owners      = ["099720109477"] # Canonical
  
  filter {
    name   = "name"
    values = ["ubuntu-eks/k8s_${var.eks_cluster_version}/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }
  
  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}