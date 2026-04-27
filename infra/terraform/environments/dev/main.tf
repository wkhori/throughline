# -----------------------------------------------------------------------------------------------
# Throughline AWS dev environment — production-target skeleton (PRD §13.6, ADR row 32).
#
# This file is **not** applied during the work-sample build; the demo runs on Railway. The skeleton
# proves out the swap path: `terraform init && terraform validate && terraform plan` runs clean
# against a real AWS provider, and the module wiring + variable shape match how a production cut-
# over would proceed (ECR push + EKS apply + S3 + CloudFront + RDS).
#
# To exercise:
#   cd infra/terraform/environments/dev
#   terraform init -backend=false
#   terraform validate
#   terraform plan -var="region=us-east-1"
# -----------------------------------------------------------------------------------------------

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region                      = var.region
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_region_validation      = true

  default_tags {
    tags = {
      Project     = "throughline"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

variable "region" {
  type        = string
  description = "AWS region for the dev environment."
  default     = "us-east-1"
}

variable "environment" {
  type        = string
  description = "Environment label propagated into resource tags."
  default     = "dev"
}

# The API module owns the ECR repo, RDS instance, and EKS-side service definitions for the
# weekly-commit-api Spring Boot service.
module "api" {
  source         = "../../modules/api"
  region         = var.region
  environment    = var.environment
  service_name   = "weekly-commit-api"
  database_name  = "throughline"
  database_user  = "throughline"
  postgres_size  = "db.t4g.micro"
  postgres_engine_version = "16.4"
}

output "ecr_repository_url" {
  description = "ECR repository URL — push the weekly-commit-api Docker image here before EKS apply."
  value       = module.api.ecr_repository_url
}

output "rds_endpoint" {
  description = "RDS Postgres endpoint — wire to SPRING_DATASOURCE_URL via the EKS configmap."
  value       = module.api.rds_endpoint
  sensitive   = true
}
