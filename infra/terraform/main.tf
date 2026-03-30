###############################################################################
# IIVKIS — Cloud Infrastructure (Terraform Root Module)
#
# Provisions the complete AWS cloud environment for IIVKIS:
#   • VPC with public/private subnets across 3 AZs
#   • EKS cluster (managed node group)
#   • RDS PostgreSQL (pgvector-compatible, Multi-AZ)
#   • ElastiCache Redis (cluster mode)
#   • IAM roles & IRSA for pod-level AWS access
#   • Route 53 private hosted zone
#
# Usage:
#   cd infra/terraform
#   terraform init
#   terraform workspace new prod   # or staging / uat
#   terraform apply -var-file=environments/prod.tfvars
###############################################################################

terraform {
  required_version = ">= 1.7.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.40"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.28"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.13"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Remote state — configure the bucket/key before running in CI
  backend "s3" {
    bucket         = "iivkis-terraform-state"
    key            = "iivkis/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "iivkis-terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "IIVKIS"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# ─── Data Sources ────────────────────────────────────────────────────────────
data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

# ─── Modules ─────────────────────────────────────────────────────────────────
module "vpc" {
  source = "./modules/vpc"

  name             = "iivkis-${var.environment}"
  cidr             = var.vpc_cidr
  azs              = slice(data.aws_availability_zones.available.names, 0, 3)
  private_subnets  = var.private_subnet_cidrs
  public_subnets   = var.public_subnet_cidrs
  environment      = var.environment
}

module "eks" {
  source = "./modules/eks"

  cluster_name       = "iivkis-${var.environment}"
  cluster_version    = var.eks_cluster_version
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  node_instance_type = var.eks_node_instance_type
  node_desired_size  = var.eks_node_desired_size
  node_min_size      = var.eks_node_min_size
  node_max_size      = var.eks_node_max_size
  environment        = var.environment
}

module "rds" {
  source = "./modules/rds"

  identifier         = "iivkis-${var.environment}"
  db_name            = "iivkis_${var.environment}"
  engine_version     = "15.6"
  instance_class     = var.rds_instance_class
  allocated_storage  = var.rds_allocated_storage
  vpc_id             = module.vpc.vpc_id
  subnet_ids         = module.vpc.private_subnet_ids
  allowed_cidr       = var.vpc_cidr
  environment        = var.environment
}

module "elasticache" {
  source = "./modules/elasticache"

  cluster_id       = "iivkis-${var.environment}"
  node_type        = var.redis_node_type
  num_cache_nodes  = var.redis_num_cache_nodes
  vpc_id           = module.vpc.vpc_id
  subnet_ids       = module.vpc.private_subnet_ids
  allowed_cidr     = var.vpc_cidr
  environment      = var.environment
}

# ─── Outputs ─────────────────────────────────────────────────────────────────
output "eks_cluster_endpoint" {
  description = "EKS cluster API server endpoint"
  value       = module.eks.cluster_endpoint
}

output "eks_cluster_name" {
  description = "EKS cluster name"
  value       = module.eks.cluster_name
}

output "rds_endpoint" {
  description = "RDS PostgreSQL endpoint"
  value       = module.rds.endpoint
  sensitive   = true
}

output "redis_endpoint" {
  description = "ElastiCache Redis primary endpoint"
  value       = module.elasticache.primary_endpoint
  sensitive   = true
}

output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}
