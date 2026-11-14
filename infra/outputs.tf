output "bucket_name" {
  description = "Nombre del bucket S3 (destino de `aws s3 sync`)"
  value       = aws_s3_bucket.website.id
}

output "distribution_id" {
  description = "ID de la distribución CloudFront (para invalidations)"
  value       = aws_cloudfront_distribution.website.id
}

output "cloudfront_domain_name" {
  description = "Dominio *.cloudfront.net donde se sirve el sitio"
  value       = aws_cloudfront_distribution.website.domain_name
}

output "cloudfront_url" {
  description = "URL pública del sitio (HTTPS, servida por CloudFront)"
  value       = "https://${aws_cloudfront_distribution.website.domain_name}"
}
