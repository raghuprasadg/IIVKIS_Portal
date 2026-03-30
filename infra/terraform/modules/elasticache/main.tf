###############################################################################
# Terraform module: ElastiCache Redis
###############################################################################

variable "cluster_id"      { type = string }
variable "node_type"       { type = string }
variable "num_cache_nodes" { type = number }
variable "vpc_id"          { type = string }
variable "subnet_ids"      { type = list(string) }
variable "allowed_cidr"    { type = string }
variable "environment"     { type = string }

resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.cluster_id}-subnet-group"
  subnet_ids = var.subnet_ids
}

resource "aws_security_group" "redis" {
  name        = "${var.cluster_id}-redis-sg"
  vpc_id      = var.vpc_id
  description = "Allow Redis from VPC"

  ingress {
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = [var.allowed_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.cluster_id}-redis-sg" }
}

resource "aws_elasticache_replication_group" "main" {
  replication_group_id       = var.cluster_id
  description                = "IIVKIS Redis — ${var.environment}"
  node_type                  = var.node_type
  num_cache_clusters         = var.num_cache_nodes
  automatic_failover_enabled = var.num_cache_nodes > 1
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]

  tags = { Environment = var.environment }
}

output "primary_endpoint" {
  value = aws_elasticache_replication_group.main.primary_endpoint_address
}
