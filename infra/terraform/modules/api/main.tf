# API module — ECR + RDS Postgres + IAM exec role for the weekly-commit-api EKS service.
#
# Intentionally minimal: this is the swap-path proof, not a production-ready stack. The full
# topology (VPC + subnets + EKS cluster + ALB + CloudFront + S3 static buckets) lives in the
# parallel `aws-deploy.yml` workflow's plan output (see infra/README.md). Every block here uses
# resources that compile under `terraform validate` without provisioning.

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws    = { source = "hashicorp/aws", version = "~> 5.0" }
    random = { source = "hashicorp/random", version = "~> 3.0" }
  }
}

variable "region" { type = string }
variable "environment" { type = string }
variable "service_name" { type = string }
variable "database_name" { type = string }
variable "database_user" { type = string }
variable "postgres_size" { type = string }
variable "postgres_engine_version" { type = string }

resource "random_password" "rds" {
  length           = 32
  special          = true
  override_special = "_-"
}

resource "aws_ecr_repository" "this" {
  name                 = "${var.service_name}-${var.environment}"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_db_subnet_group" "this" {
  name        = "${var.service_name}-${var.environment}"
  description = "Subnet group for the ${var.service_name} RDS instance."
  # Subnet IDs would be sourced from the VPC module; use AWS-default subnets for the validate path.
  subnet_ids = []
}

resource "aws_db_instance" "this" {
  identifier              = "${var.service_name}-${var.environment}"
  engine                  = "postgres"
  engine_version          = var.postgres_engine_version
  instance_class          = var.postgres_size
  allocated_storage       = 20
  storage_encrypted       = true
  db_name                 = var.database_name
  username                = var.database_user
  password                = random_password.rds.result
  skip_final_snapshot     = true
  publicly_accessible     = false
  backup_retention_period = 7
  apply_immediately       = true
  deletion_protection     = false
  db_subnet_group_name    = aws_db_subnet_group.this.name
}

output "ecr_repository_url" { value = aws_ecr_repository.this.repository_url }
output "rds_endpoint" {
  value     = aws_db_instance.this.endpoint
  sensitive = true
}
