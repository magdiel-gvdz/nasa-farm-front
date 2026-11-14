output "bucket" {
  value = aws_s3_bucket.terraform_state.id
}

output "region" {
  value = var.aws_region
}
