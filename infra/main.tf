# ==========================================
# S3 — hosting privado del build estático
# ==========================================
# El bucket NO es público — solo CloudFront puede leerlo, vía Origin
# Access Control (OAC). Nadie debería poder pegar la URL de S3 directo.

resource "aws_s3_bucket" "website" {
  bucket = local.bucket_name

  tags = local.common_tags
}

resource "aws_s3_bucket_public_access_block" "website" {
  bucket                  = aws_s3_bucket.website.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "website" {
  bucket = aws_s3_bucket.website.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

data "aws_iam_policy_document" "website_cloudfront_access" {
  statement {
    sid       = "AllowCloudFrontServicePrincipalReadOnly"
    effect    = "Allow"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.website.arn}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.website.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "website" {
  bucket = aws_s3_bucket.website.id
  policy = data.aws_iam_policy_document.website_cloudfront_access.json
}

# ==========================================
# CLOUDFRONT
# ==========================================

resource "aws_cloudfront_origin_access_control" "website" {
  name                              = "${local.name_prefix}-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "website" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = var.spa_index_document
  comment             = "${local.name_prefix} SPA"

  origin {
    domain_name              = aws_s3_bucket.website.bucket_regional_domain_name
    origin_id                = "s3-website"
    origin_access_control_id = aws_cloudfront_origin_access_control.website.id
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "s3-website"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true
    # AWS managed policy "Managed-CachingOptimized" — no forwardea query
    # strings ni cookies, cachea agresivamente. Suficiente para una SPA con
    # assets versionados por Vite (hash en el nombre de archivo).
    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6"
  }

  # SPA routing: cualquier ruta de cliente (React Router, etc.) que S3
  # no tenga como objeto real vuelve 403/404 — se reescribe a index.html
  # con 200 para que el router del lado del cliente la resuelva.
  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/${var.spa_index_document}"
  }

  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/${var.spa_index_document}"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # Certificado por defecto de *.cloudfront.net (HTTPS incluido, sin dominio propio)
  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = local.common_tags
}
