variable "project_name" {
  description = "Nombre corto de este proyecto (ej. 'nasa-farm')"
  type        = string
  default     = "nasa-farm"
}

variable "environment" {
  description = "Ambiente de despliegue"
  type        = string
  default     = "prod"
}

variable "aws_region" {
  description = "Región de AWS (CloudFront es global, pero el bucket S3 vive acá)"
  type        = string
  default     = "us-east-1"
}

variable "aws_profile" {
  description = "Perfil de AWS CLI (vacío cuando corre en CI vía OIDC)"
  type        = string
  default     = ""
}

variable "spa_index_document" {
  description = "Archivo servido como index (y como fallback de rutas de cliente)"
  type        = string
  default     = "index.html"
}

locals {
  name_prefix = "${var.project_name}-${var.environment}"
  bucket_name = "${local.name_prefix}-website"

  common_tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}
