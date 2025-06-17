terraform {
  required_version = ">= 1.5.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.24"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.12"
    }
  }
  
  backend "s3" {
    bucket         = "grayghost-terraform-state"
    key            = "social-auto-workflows/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"
  }
}

provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = var.tags
  }
}

# VPC Module
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"
  
  name = "${var.environment}-grayghost-vpc"
  cidr = var.vpc_cidr
  
  azs             = data.aws_availability_zones.available.names
  private_subnets = var.private_subnets
  public_subnets  = var.public_subnets
  
  enable_nat_gateway   = true
  single_nat_gateway   = var.environment == "dev" ? true : false
  enable_dns_hostnames = true
  enable_dns_support   = true
  
  enable_flow_log                      = true
  create_flow_log_cloudwatch_iam_role  = true
  create_flow_log_cloudwatch_log_group = true
  
  public_subnet_tags = {
    "kubernetes.io/cluster/${var.eks_cluster_name}" = "shared"
    "kubernetes.io/role/elb"                        = 1
  }
  
  private_subnet_tags = {
    "kubernetes.io/cluster/${var.eks_cluster_name}" = "shared"
    "kubernetes.io/role/internal-elb"               = 1
  }
  
  tags = merge(
    var.tags,
    {
      "kubernetes.io/cluster/${var.eks_cluster_name}" = "shared"
    }
  )
}

# EKS Module
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 19.0"
  
  cluster_name    = var.eks_cluster_name
  cluster_version = var.eks_cluster_version
  
  vpc_id                   = module.vpc.vpc_id
  subnet_ids               = module.vpc.private_subnets
  control_plane_subnet_ids = module.vpc.private_subnets
  
  # Enable IRSA
  enable_irsa = true
  
  # Cluster access
  cluster_endpoint_public_access  = true
  cluster_endpoint_private_access = true
  
  # Enable cluster encryption
  cluster_encryption_config = {
    provider_key_arn = aws_kms_key.eks.arn
    resources        = ["secrets"]
  }
  
  # Ubuntu 22.04 LTS custom launch template
  eks_managed_node_groups = {
    for name, config in var.node_groups : name => {
      name = "${var.eks_cluster_name}-${name}"
      
      # Use custom AMI for Ubuntu 22.04 LTS
      ami_id = data.aws_ami.ubuntu_eks.id
      
      instance_types = config.instance_types
      capacity_type  = "ON_DEMAND"
      
      min_size     = config.scaling_config.min_size
      max_size     = config.scaling_config.max_size
      desired_size = config.scaling_config.desired_size
      
      disk_size = config.disk_size
      
      labels = config.labels
      
      # Enable detailed monitoring
      enable_monitoring = true
      
      # User data for CIS hardening
      user_data = base64encode(templatefile("${path.module}/templates/node-userdata.sh", {
        cluster_name        = var.eks_cluster_name
        cluster_endpoint    = module.eks.cluster_endpoint
        cluster_ca          = module.eks.cluster_certificate_authority_data
        region              = var.aws_region
      }))
      
      tags = merge(
        var.tags,
        {
          Name = "${var.eks_cluster_name}-${name}"
        }
      )
    }
  }
  
  # OIDC Provider for IRSA
  cluster_addons = {
    coredns = {
      most_recent = true
    }
    kube-proxy = {
      most_recent = true
    }
    vpc-cni = {
      most_recent = true
    }
    aws-ebs-csi-driver = {
      most_recent = true
    }
  }
  
  tags = var.tags
}

# KMS Key for EKS
resource "aws_kms_key" "eks" {
  description             = "KMS key for EKS cluster encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true
  
  tags = merge(
    var.tags,
    {
      Name = "${var.eks_cluster_name}-encryption"
    }
  )
}

resource "aws_kms_alias" "eks" {
  name          = "alias/${var.eks_cluster_name}"
  target_key_id = aws_kms_key.eks.key_id
}

# Aurora PostgreSQL Cluster
module "aurora" {
  source  = "terraform-aws-modules/rds-aurora/aws"
  version = "~> 8.0"
  
  name              = var.aurora_cluster_identifier
  engine            = "aurora-postgresql"
  engine_version    = var.aurora_engine_version
  master_username   = "grayghost_admin"
  
  vpc_id               = module.vpc.vpc_id
  subnets              = module.vpc.private_subnets
  create_security_group = true
  allowed_cidr_blocks  = [var.vpc_cidr]
  
  instance_class = var.aurora_instance_class
  instances      = var.aurora_instances
  
  # Multi-AZ for HA
  storage_encrypted = true
  kms_key_id        = aws_kms_key.rds.arn
  
  # Backup configuration for 5-minute RPO
  backup_retention_period   = var.aurora_backup_retention_period
  preferred_backup_window   = var.aurora_preferred_backup_window
  enabled_cloudwatch_logs_exports = ["postgresql"]
  
  # Performance insights
  performance_insights_enabled = true
  performance_insights_retention_period = 7
  
  # WAL-G S3 streaming configuration
  db_cluster_parameter_group_name = aws_rds_cluster_parameter_group.aurora_pg.name
  
  tags = var.tags
}

# RDS Parameter Group for WAL-G
resource "aws_rds_cluster_parameter_group" "aurora_pg" {
  family = "aurora-postgresql15"
  name   = "${var.aurora_cluster_identifier}-wal-g"
  
  parameter {
    name  = "shared_preload_libraries"
    value = "pg_stat_statements,pgaudit"
  }
  
  parameter {
    name  = "log_statement"
    value = "all"
  }
  
  parameter {
    name  = "log_min_duration_statement"
    value = "1000"  # Log queries longer than 1 second
  }
  
  parameter {
    name  = "archive_mode"
    value = "on"
  }
  
  parameter {
    name  = "archive_command"
    value = "wal-g wal-push %p"
  }
  
  tags = var.tags
}

# S3 Bucket for WAL-G backups
resource "aws_s3_bucket" "wal_g_backups" {
  bucket = "${var.environment}-grayghost-wal-g-backups"
  
  tags = var.tags
}

resource "aws_s3_bucket_versioning" "wal_g_backups" {
  bucket = aws_s3_bucket.wal_g_backups.id
  
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "wal_g_backups" {
  bucket = aws_s3_bucket.wal_g_backups.id
  
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.s3.arn
    }
  }
}

# KMS Keys
resource "aws_kms_key" "rds" {
  description             = "KMS key for RDS encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true
  
  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-rds-encryption"
    }
  )
}

resource "aws_kms_key" "s3" {
  description             = "KMS key for S3 encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true
  
  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-s3-encryption"
    }
  )
}

# ElastiCache Redis Cluster
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id       = var.redis_cluster_id
  description                = "Redis cluster for n8n queue management"
  engine                     = "redis"
  node_type                  = var.redis_node_type
  parameter_group_name       = var.redis_parameter_group
  port                       = 6379
  
  # Multi-AZ with automatic failover
  multi_az_enabled           = true
  automatic_failover_enabled = true
  
  # Cluster mode enabled
  num_node_groups         = 3
  replicas_per_node_group = 1
  
  # Security
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token_enabled         = true
  
  # Subnet group
  subnet_group_name = aws_elasticache_subnet_group.redis.name
  
  # Security group
  security_group_ids = [aws_security_group.redis.id]
  
  # Maintenance window
  maintenance_window = "sun:05:00-sun:07:00"
  
  # Backup
  snapshot_retention_limit = 5
  snapshot_window          = "03:00-05:00"
  
  # Logging
  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.redis_slow.name
    destination_type = "cloudwatch-logs"
    log_format       = "json"
    log_type         = "slow-log"
  }
  
  tags = var.tags
}

resource "aws_elasticache_subnet_group" "redis" {
  name       = "${var.redis_cluster_id}-subnet-group"
  subnet_ids = module.vpc.private_subnets
  
  tags = var.tags
}

resource "aws_security_group" "redis" {
  name_prefix = "${var.redis_cluster_id}-"
  vpc_id      = module.vpc.vpc_id
  
  ingress {
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  tags = merge(
    var.tags,
    {
      Name = "${var.redis_cluster_id}-sg"
    }
  )
}

resource "aws_cloudwatch_log_group" "redis_slow" {
  name              = "/aws/elasticache/${var.redis_cluster_id}/slow-log"
  retention_in_days = 7
  
  tags = var.tags
}

# WAF Module
module "waf" {
  source = "./modules/waf"
  
  environment       = var.environment
  aws_region        = var.aws_region
  allowed_countries = var.allowed_countries
  alb_arn           = aws_lb.main.arn
  kms_key_id        = aws_kms_key.logs.arn
  tags              = var.tags
}

# Application Load Balancer
resource "aws_lb" "main" {
  name               = "${var.environment}-grayghost-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = module.vpc.public_subnets
  
  enable_deletion_protection = var.environment == "production" ? true : false
  enable_http2               = true
  enable_cross_zone_load_balancing = true
  
  access_logs {
    bucket  = aws_s3_bucket.alb_logs.bucket
    enabled = true
  }
  
  tags = var.tags
}

resource "aws_security_group" "alb" {
  name_prefix = "${var.environment}-alb-"
  vpc_id      = module.vpc.vpc_id
  
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-alb-sg"
    }
  )
}

resource "aws_s3_bucket" "alb_logs" {
  bucket = "${var.environment}-grayghost-alb-logs"
  
  tags = var.tags
}

resource "aws_s3_bucket_public_access_block" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id
  
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_kms_key" "logs" {
  description             = "KMS key for log encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true
  
  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-logs-encryption"
    }
  )
}

# Outputs
output "eks_cluster_endpoint" {
  value = module.eks.cluster_endpoint
}

output "eks_cluster_name" {
  value = module.eks.cluster_name
}

output "aurora_endpoint" {
  value = module.aurora.cluster_endpoint
}

output "redis_endpoint" {
  value = aws_elasticache_replication_group.redis.configuration_endpoint_address
}

output "alb_dns_name" {
  value = aws_lb.main.dns_name
}