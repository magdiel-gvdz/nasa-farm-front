terraform {
  required_version = ">= 1.11.0"

  # Backend configurado en tiempo de init vía -backend-config flags.
  # Correr: make tf-init
  # use_lockfile: locking nativo de S3 (GA desde Terraform 1.11), sin
  # necesidad de una tabla DynamoDB de locks.
  backend "s3" {
    use_lockfile = true
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile
  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}
