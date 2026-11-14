variable "project_name" {
  type    = string
  default = "nasa-farm"
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "aws_profile" {
  description = "Perfil de AWS CLI"
  type        = string
  default     = ""
}
