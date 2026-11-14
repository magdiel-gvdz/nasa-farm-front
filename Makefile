# Makefile — NASA Space Apps Challenge · SPA en S3 + CloudFront (solo prod)

.PHONY: help create-app install dev build \
        tf-bootstrap tf-init tf-plan tf-apply tf-destroy tf-validate tf-fmt tf-output \
        deploy clean

PROJECT         ?= nasa-farm
TF_AWS_REGION   ?= us-east-1
TF_STATE_BUCKET ?= $(PROJECT)-terraform-state-028610956742
TF_VARS         := ../envs/prod.tfvars

help:
	@echo ""
	@echo "$(PROJECT) — Comandos"
	@echo ""
	@echo "  create-app     Genera app/ con 'npm create vite@latest' (una sola vez)"
	@echo "  install        npm install dentro de app/"
	@echo "  dev            Servidor de desarrollo"
	@echo "  build          Build de producción (app/dist/)"
	@echo ""
	@echo "  tf-bootstrap   Crea el bucket S3 del state de Terraform (una sola vez)"
	@echo "  tf-init        Init de Terraform con backend remoto"
	@echo "  tf-plan        Plan de cambios"
	@echo "  tf-apply       Crea/actualiza bucket S3 + CloudFront"
	@echo "  tf-output      Muestra bucket, distribution id y URL"
	@echo "  tf-destroy     Destruye la infraestructura (pide confirmación)"
	@echo ""
	@echo "  deploy         build + s3 sync + invalidación de CloudFront"
	@echo ""

create-app:
	./scripts/create-app.sh

install:
	cd app && npm install

dev:
	cd app && npm run dev

build:
	cd app && npm run build

tf-bootstrap:
	terraform -chdir=bootstrap init -input=false
	terraform -chdir=bootstrap apply -auto-approve

tf-init:
	terraform -chdir=infra init \
		-backend-config="bucket=$(TF_STATE_BUCKET)" \
		-backend-config="key=prod/terraform.tfstate" \
		-backend-config="region=$(TF_AWS_REGION)" \
		-reconfigure

tf-plan:
	terraform -chdir=infra plan -var-file="$(TF_VARS)"

tf-apply:
	terraform -chdir=infra apply -auto-approve -var-file="$(TF_VARS)"

tf-destroy:
	@read -p "  Esto destruye TODA la infraestructura. Escribe 'prod' para confirmar: " c && [ "$$c" = "prod" ] || exit 1
	terraform -chdir=infra destroy -var-file="$(TF_VARS)"

tf-validate:
	terraform -chdir=infra validate

tf-fmt:
	terraform fmt -recursive infra/ bootstrap/

tf-output:
	terraform -chdir=infra output

deploy: build
	@set -e; \
	bucket=$$(terraform -chdir=infra output -raw bucket_name); \
	distribution_id=$$(terraform -chdir=infra output -raw distribution_id); \
	echo "  → Sincronizando app/dist/ con s3://$$bucket ..."; \
	aws s3 sync app/dist/ "s3://$$bucket" --delete --exclude "*.mjs"; \
	aws s3 sync app/dist/ "s3://$$bucket" --exclude "*" --include "*.mjs" --content-type "text/javascript"; \
	echo "  → Invalidando CloudFront ($$distribution_id)..."; \
	aws cloudfront create-invalidation --distribution-id "$$distribution_id" --paths "/*" >/dev/null; \
	echo "  ✓ Deploy completo: $$(terraform -chdir=infra output -raw cloudfront_url)"

clean:
	rm -rf app/dist app/node_modules
