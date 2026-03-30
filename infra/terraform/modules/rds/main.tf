###############################################################################
# Terraform module: RDS (PostgreSQL + pgvector)
###############################################################################

variable "identifier"        { type = string }
variable "db_name"           { type = string }
variable "engine_version"    { type = string }
variable "instance_class"    { type = string }
variable "allocated_storage" { type = number }
variable "vpc_id"            { type = string }
variable "subnet_ids"        { type = list(string) }
variable "allowed_cidr"      { type = string }
variable "environment"       { type = string }

resource "random_password" "db_password" {
  length  = 24
  special = false
}

resource "aws_db_subnet_group" "main" {
  name       = "${var.identifier}-subnet-group"
  subnet_ids = var.subnet_ids
  tags       = { Name = "${var.identifier}-subnet-group", Environment = var.environment }
}

resource "aws_security_group" "rds" {
  name        = "${var.identifier}-sg"
  vpc_id      = var.vpc_id
  description = "Allow PostgreSQL from VPC"

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [var.allowed_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.identifier}-sg" }
}

resource "aws_db_instance" "main" {
  identifier             = var.identifier
  db_name                = var.db_name
  engine                 = "postgres"
  engine_version         = var.engine_version
  instance_class         = var.instance_class
  allocated_storage      = var.allocated_storage
  max_allocated_storage  = var.allocated_storage * 4
  storage_encrypted      = true

  username = "iivkis"
  password = random_password.db_password.result

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  multi_az               = var.environment == "prod"
  deletion_protection    = var.environment == "prod"
  backup_retention_period = 7
  skip_final_snapshot    = var.environment != "prod"

  tags = { Environment = var.environment }
}

output "endpoint" { value = aws_db_instance.main.endpoint }
output "db_name"  { value = aws_db_instance.main.db_name }
output "username" { value = aws_db_instance.main.username }
output "password" {
  value     = random_password.db_password.result
  sensitive = true
}
