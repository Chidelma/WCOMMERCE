# WCOMMERCE Infrastructure Assessment

Pulumi infrastructure for deploying `infra-web` and `infra-api` to AWS on ECS Fargate with a simple, enterprise-style separation between the public storefront edge and the private application tier.

## Goal

This project provisions a production-shaped AWS footprint for a split web and API workload. The stack creates networking, container registries, ECS services, load balancers, and clear trust boundaries without carrying unused infrastructure.

## Project Layout

- `index.ts`: Pulumi entrypoint.
- `infra-api/`: containerized API service.
- `infra-web/`: containerized storefront service.
- `docker-compose.yml`: local composition helper.
- `Pulumi*.yaml`: stack configuration files.

## Architecture

The refactored design keeps the platform intentionally simple:

- A public application load balancer receives internet traffic for the storefront.
- Storefront ECS tasks run in private subnets with no public IPs.
- An internal application load balancer fronts the API tier.
- API ECS tasks also run in private subnets with no public IPs.
- The storefront calls the API through the internal load balancer.
- AWS WAF is attached only to the public load balancer.

To keep the trust model easy to reason about, the stack uses two security groups:

- `frontend-sg`: internet to public ALB on port `80`, and storefront ALB to web tasks on port `5000`.
- `backend-sg`: web tasks to internal API ALB on port `80`, and internal API ALB to API tasks on port `5000`.

The original version also created an RDS instance, but the application code does not use a database today. That layer was removed so the infrastructure stays aligned with the workload and remains easier to operate.

## Local Requirements

- Node.js 20+
- npm
- Pulumi CLI
- AWS CLI

## Local Validation

```bash
npm ci
npx tsc --noEmit
```

## Deploying

```bash
pulumi stack init dev
pulumi config set aws:region <aws-region>
pulumi up
```

The stack expects valid AWS credentials in your environment. For GitHub Actions, the included workflow supports either OIDC role assumption or static AWS credentials plus a Pulumi backend or token configuration.

## GitHub Actions Configuration

Set these repository variables or secrets before enabling automated previews or applies:

- `vars.AWS_REGION`
- `vars.PULUMI_STACK`
- `vars.AWS_ROLE_TO_ASSUME` or `secrets.AWS_ACCESS_KEY_ID` plus `secrets.AWS_SECRET_ACCESS_KEY`
- `secrets.PULUMI_ACCESS_TOKEN` or `vars.PULUMI_BACKEND_URL`
- `secrets.PULUMI_CONFIG_PASSPHRASE` when the backend is passphrase protected

## Cleanup

```bash
pulumi destroy
```

This removes all resources created by the stack.
