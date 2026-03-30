###############################################################################
# Production environment tfvars
###############################################################################
environment             = "prod"
aws_region              = "us-east-1"
vpc_cidr                = "10.0.0.0/16"
private_subnet_cidrs    = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
public_subnet_cidrs     = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
eks_cluster_version     = "1.29"
eks_node_instance_type  = "m5.xlarge"
eks_node_desired_size   = 5
eks_node_min_size       = 3
eks_node_max_size       = 20
rds_instance_class      = "db.r6g.large"
rds_allocated_storage   = 200
redis_node_type         = "cache.r6g.large"
redis_num_cache_nodes   = 3
