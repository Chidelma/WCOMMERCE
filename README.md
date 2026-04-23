# WCOMMERCE Infrastructure Assessment

Pulumi infrastructure for deploying a WooCommerce-style application stack to AWS, including ECS services and a backing relational database.

## Goal

This repo provisions the infrastructure needed to run separate API and web containers behind an AWS load balancer, with database support added for the application tier.

## Project Layout

- `index.ts`: Pulumi entrypoint.
- `infra-api/`: API service container.
- `infra-web/`: storefront or web service container.
- `docker-compose.yml`: local composition helper.
- `Pulumi*.yaml`: stack configuration files.

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

## GitHub Actions Configuration

Set these repository variables or secrets before enabling automated previews or applies:

- `vars.AWS_REGION`
- `vars.PULUMI_STACK`
- `vars.AWS_ROLE_TO_ASSUME` or `secrets.AWS_ACCESS_KEY_ID` plus `secrets.AWS_SECRET_ACCESS_KEY`
- `secrets.PULUMI_ACCESS_TOKEN` or `vars.PULUMI_BACKEND_URL`
- `secrets.PULUMI_CONFIG_PASSPHRASE` when the backend is passphrase protected

Note: This will destroy all resources created by the Pulumi stack.
