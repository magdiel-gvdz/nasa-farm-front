# nasa-farm-front

Frontend (SPA con Vite) del proyecto para el **NASA Space Apps Challenge**.
Se despliega desde tu máquina como sitio estático en **S3 + CloudFront**
(HTTPS incluido, URL `*.cloudfront.net`), con la infraestructura en
Terraform. Un solo ambiente: **prod**. Sin CI/CD: el repo es solo para
guardar el código y el deploy se hace con `make`.

## Requisitos

Node.js >= 20.19 (o >= 22.12), Terraform >= 1.11, AWS CLI con credenciales configuradas
(`aws configure` o `AWS_PROFILE`) con permisos sobre S3 y CloudFront.

## Puesta en marcha

```bash
./init.sh --project nasa-farm --aws-account-id <id-de-cuenta> --aws-region us-east-1

./scripts/create-app.sh     # genera app/ con npm create vite@latest
make install

make tf-bootstrap           # bucket S3 para el state de Terraform (una sola vez)
make tf-init
make tf-apply               # crea bucket S3 privado + CloudFront
make deploy                 # build + s3 sync + invalidación
```

`make deploy` imprime al final la URL pública (`https://dxxxx.cloudfront.net`);
también la ves con `make tf-output`.

## Flujo diario

```bash
make dev       # desarrollo local
make deploy    # publicar cambios
```

## Qué trae

- `infra/` — bucket S3 privado servido por CloudFront con Origin Access
  Control, redirect a HTTPS, compresión y routing de SPA (403/404 →
  `/index.html` con 200, para que el router del cliente resuelva las rutas).
- `bootstrap/` — bucket S3 del state remoto de Terraform.
- `envs/prod.tfvars` — variables del ambiente.
- `Makefile` — `dev`, `build`, `deploy`, `tf-*`.

## Notas

- Variables `VITE_*` (p. ej. `VITE_API_URL`) se resuelven en build time.
- `make tf-destroy` elimina toda la infraestructura (el bucket debe estar
  vacío o Terraform fallará; vacíalo con `aws s3 rm s3://<bucket> --recursive`).
- Dominio propio: no incluido; habría que agregar certificado ACM
  (us-east-1), `aliases` en CloudFront y el registro DNS.
