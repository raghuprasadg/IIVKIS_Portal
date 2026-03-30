###############################################################################
# Staging environment tfvars
###############################################################################
environment             = "staging"
aws_region              = "us-east-1"
vpc_cidr                = "10.1.0.0/16"
private_subnet_cidrs    = ["10.1.1.0/24", "10.1.2.0/24", "10.1.3.0/24"]
public_subnet_cidrs     = ["10.1.101.0/24", "10.1.102.0/24", "10.1.103.0/24"]
eks_cluster_version     = "1.29"
eks_node_instance_type  = "m5.large"
eks_node_desired_size   = 3
eks_node_min_size       = 2
eks_node_max_size       = 8
rds_instance_class      = "db.t3.large"
rds_allocated_storage   = 100
redis_node_type         = "cache.t3.medium"
redis_num_cache_nodes   = 2
