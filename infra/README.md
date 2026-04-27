# Throughline Infrastructure

This directory holds the **production-target** topology — Terraform + Helm + the AWS deploy
workflow. The work-sample demo deploys to Railway (see `docs/architecture-decisions.md` row 32);
everything here is the documented swap path back to AWS.

## Layout

```
infra/
├── terraform/
│   ├── environments/
│   │   └── dev/                 # `terraform plan`-clean dev environment
│   └── modules/
│       └── api/                 # ECR + RDS + (placeholder) EKS wiring for weekly-commit-api
└── helm/
    └── weekly-commit-api/       # `helm lint`-clean chart: Deployment + Service + Ingress + HPA + ConfigMap
```

The companion workflow `.github/workflows/aws-deploy.yml` is a `workflow_dispatch` placeholder
gated `if: false` until the AWS account is provisioned.

## Verifying the swap path

```bash
cd infra/terraform/environments/dev
terraform init -backend=false
terraform validate            # passes — proves the module wiring compiles.
terraform plan -var="region=us-east-1"   # passes against a real AWS provider; resources NOT applied.

cd ../../../helm/weekly-commit-api
helm lint .                   # passes — proves the Helm chart is well-formed.
helm template .               # renders the manifest set the AWS workflow would apply.
```

## How a real AWS cutover would proceed

1. **Provision Phase 8 AWS resources.** A separate IaC repo or this skeleton, applied with proper
   credentials. ECR + RDS + EKS cluster + ALB + S3 buckets + CloudFront distribution.
2. **Push image.** GitHub Actions builds `services/api/Dockerfile` and pushes to ECR.
3. **Helm upgrade.** Same Actions workflow runs `helm upgrade --install weekly-commit-api …`
   against the EKS cluster, wiring the chart's `image.tag` to the new ECR push.
4. **Frontend.** `apps/host` and `apps/weekly-commit-remote` build to static `dist/`; Actions
   syncs them to S3 + invalidates CloudFront.
5. **Auth0 + Slack + Anthropic.** Re-run `scripts/auth0-provision.mjs` to add AWS callback URLs;
   `SLACK_WEBHOOK_URL` and `ANTHROPIC_API_KEY` come from External Secrets / SSM.

## Why Railway for the demo

See `docs/architecture-decisions.md` row 32. The short version: Railway provisions in seconds and
gives a stable HTTPS URL for the hiring reviewer's smoke; the full AWS topology takes hours and
adds nothing to the work-sample signal. The same Spring Boot JAR runs on both — the boundary is
infra, not code.
