# Tejas Profile — Infrastructure (CDK)

AWS CDK (TypeScript) app defining every backend stack for Tejas Profile: CloudFront/S3 asset and frontend hosting, API Gateway HTTP API, Lambda handlers, DynamoDB, and SES.

This README is the **CDK-specific quick reference** — stack names, environment variables, and raw CDK commands. It does not duplicate the full deployment runbook, which lives at the repo root.

> **For actual deploy/release procedures (`npm_cd`, `npm_pd`, CI workflows, rollback), see the [Root README](../../README.md) — start there, not here.**
>
> For the architecture these stacks implement, see the [Snapshots and Profile Platform Architecture](../../docs/architecture/snapshots-architecture.md), [Analytics Architecture](../../docs/architecture/analytics-architecture.md), and [Usage Cost Architecture](../../docs/architecture/usage-architecture.md).

---

## Stacks (`bin/cdk.ts`)

```text
AssetsCdnStack          PROD  media/asset CDN + S3 (infra/cdk/lib/assets-cdn-stack.ts)
AssetsCdnStackDev       DEV   isolated media/asset CDN + S3

FrontendCdnStackDev     DEV   dedicated DEV application hosting
                              (PROD frontend hosting is GitHub Pages, not a CDK stack)

TejasProfileSnapshotsStackProd  PROD  API Gateway + Lambdas + DynamoDB + SES
TejasProfileSnapshotsStackDev   DEV   isolated control-plane API (own tables, own origins)
```

DEV and PROD are physically isolated — separate stacks, separate DynamoDB tables, separate S3 buckets, separate allowed CORS origins. Nothing in DEV's stack references PROD's resources or vice versa. See [DEV / PROD Isolation](../../docs/architecture/snapshots-architecture.md#18-dev--prod-isolation) for why this matters beyond just this CDK app.

Every resource in every stack is tagged `project: tejas-profile` and `stage: dev|prod` (`cdk.Tags.of(...)`), which is what makes AWS Cost Allocation Tags able to split billing by stage — see the [Usage Cost Architecture](../../docs/architecture/usage-architecture.md).

---

## Required Environment Variables

Read via `dotenv/config` from `.env.local` (gitignored) at synth time:

```text
CDK_DEFAULT_ACCOUNT          AWS account ID stacks deploy into
CDK_DEFAULT_REGION           used for the two Assets/Frontend stacks
                              (the Snapshots stacks hardcode us-east-1)
GITHUB_DEPLOYER_ROLE_ARN     optional; PROD Snapshots stack only —
                              IAM role GitHub Actions assumes to deploy
```

Runtime owner credentials are never read at synth time — `SnapshotsStack` resolves them from stage-specific Secrets Manager identities at runtime, so `cdk synth`/`cdk diff` never require or load the owner passcode.

---

## Useful Commands

```bash
npm run build      # compile TypeScript to JS
npm run watch       # watch for changes and compile
npm run test        # jest unit tests (infra/cdk/test/)
npx cdk synth       # emit synthesized CloudFormation for all stacks
npx cdk diff <stack>        # compare one deployed stack against current code
npx cdk deploy <stack>      # deploy one stack directly (see caution below)
```

To synth/diff/deploy a single stack, pass its exact name from the table above, e.g. `npx cdk diff TejasProfileSnapshotsStackDev`.

**Do not run `npx cdk deploy` directly against PROD stacks.** Normal releases go through `npm_cd` → GitHub Actions "Deploy Infra (CDK)" (DEV, automatic) and `npm_pd` (PROD, explicit promotion) so that the frontend build, infra tests, and deploy stay in lock-step. Direct `cdk deploy` is for local iteration against DEV only. See [Infrastructure / Backend Release — Full Procedure](../../README.md#infra-release-procedure) in the root README.

[Back to Root README](../../README.md) · [Back to Documentation Home](../../docs/README.md)
