# Tejas Profile

Personal portfolio/profile application built with React, AWS CDK, GitHub Actions, CloudFront, S3, API Gateway, Lambda, DynamoDB, and GitHub Pages.

This README is primarily the **developer, deployment, and operations runbook**.

Detailed product/feature documentation lives under [`docs/`](./docs/README.md).

If you return to this project after several months and remember nothing about the deployment process, start with:

> **[I changed something — what do I do?](#changed-something)**

---

<a id="index"></a>

# Index

## Project Operations

- [1. Current Known-Good Production Baseline](#current-prod-baseline)
- [2. Documentation Map](#documentation-map)
  - [Feature Documentation](#feature-documentation)
  - [Architecture Documentation](#architecture-documentation)
- [3. Quick Start](#quick-start)
  - [Start Local Development](#start-local-development)
  - [Most Common Development Flow](#most-common-flow)
- [4. I Changed Something — What Do I Do?](#changed-something)
  - [Decision Guide](#decision-guide)
  - [Case A — Normal Frontend / UI / Data Change](#frontend-change)
  - [Case B — Infrastructure / Backend Change](#infra-change)
  - [Case C — Documentation-Only Change](#documentation-change)
- [5. Understanding `npm_cd`](#npm-cd)
  - [What `npm_cd` Does](#npm-cd-does)
  - [What `npm_cd` Does NOT Do](#npm-cd-does-not)
  - [What Happens Automatically After `npm_cd`](#after-npm-cd)
- [6. Local Development Commands](#local-commands)
  - [`npm start`](#npm-start)
  - [`npm test`](#npm-test)
  - [`npm run test:ci`](#npm-test-ci)
  - [`npm run build`](#npm-build)
  - [Infrastructure / Backend Verification](#infra-verify)
- [7. GitHub Actions Workflows](#github-workflows)
  - [CI Quality Gate](#ci-quality-gate)
  - [Deploy Infra (CDK)](#deploy-infra-workflow)
  - [Promote Frontend (PROD)](#promote-prod)
  - [Redeploy (Owner)](#redeploy-owner)
  - [CDN Invalidate](#cdn-invalidate-workflow)
- [8. Normal Frontend Release — Full Procedure](#frontend-release-procedure)
- [9. Infrastructure / Backend Release — Full Procedure](#infra-release-procedure)
- [10. Do I Need PROD Infrastructure?](#need-prod-infra)
- [11. PROD Deployment Architecture](#prod-deployment-architecture)
- [12. AWS Login and Local AWS Access](#aws-login)
- [13. Asset Management](#asset-management)
  - [DEV Assets](#dev-assets)
  - [PROD Assets](#prod-assets)
  - [Read-Only Asset Dry Runs](#asset-dry-run)
- [14. Verify Git Before PROD](#verify-git)
  - [Verify Local vs Remote](#verify-local-remote)
  - [Verify a Checkpoint Tag](#verify-checkpoint-tag)
- [15. Verify Live PROD](#verify-live-prod)
- [16. Analytics Summary](#analytics-summary)
- [17. Snapshots and Release Metadata](#snapshots)
- [18. Recovery and Rollback](#recovery)
  - [Local Source Recovery](#local-recovery)
  - [PROD Redeploy / Rollback](#prod-rollback)
- [19. Git Hooks](#git-hooks)
- [20. Environment Files and Secrets](#environment-files)
- [21. Old / Deprecated Deployment Practices](#deprecated-practices)
- [22. Pre-Release Checklists](#checklists)
  - [Before `npm_cd`](#before-npm-cd)
  - [After `npm_cd`](#after-npm-cd-checklist)
  - [Before PROD Frontend Promotion](#before-prod-promotion)
  - [Before PROD Promotion When Infrastructure Changed](#before-prod-infra)
- [23. Short Version — If You Remember Nothing Else](#short-version)
- [24. Things NOT to Do](#do-not-do)
- [25. Maintenance Notes](#maintenance)
- [26. Current Platform Guarantees](#platform-guarantees)
- [27. Create React App Reference](#cra-reference)

---

<a id="current-prod-baseline"></a>

# 1. Current Known-Good Production Baseline

As of **August 21, 2026**, the latest fully tested, deployed, and runtime-verified PROD checkpoint is:

```text
Commit:
c341be871fbf61598eb20fb0fce1f103a8fc1a62

Short SHA:
c341be8

Checkpoint:
checkpoint-2026-08-21_07-41-20

Profile Version:
pv_c341be8
```

This checkpoint successfully passed:

- Frontend tests
- Production frontend build
- Infrastructure/backend tests
- CDK synth
- GitHub CI Quality Gate
- Automatic DEV deployment
- DEV asset deployment
- DEV CloudFront invalidation
- DEV Analytics smoke test
- Explicit PROD infrastructure deployment
- Explicit PROD frontend deployment
- PROD CI snapshot publication
- Live production SHA verification

Unless a newer checkpoint has been explicitly tested and verified, this is the current:

- known-good PROD baseline
- rollback/reference commit
- production comparison point
- starting point for future work

[Back to Index](#index)

---

<a id="documentation-map"></a>

# 2. Documentation Map

The root README answers:

> How do I develop, test, checkpoint, deploy, recover, and operate this project?

Detailed feature documentation lives under:

```text
docs/
```

Open the complete documentation homepage:

> **[Tejas Profile Documentation](./docs/README.md)**

---

<a id="feature-documentation"></a>

## Feature Documentation

### Admin Features

#### Analytics

User-facing behavior, filters, KPIs, reset semantics, releases, sessions, engagement, geography, privacy, and troubleshooting:

> **[Analytics — Complete Feature Guide](./docs/sections/analytics.md)**

#### Snapshots

Owner-facing runtime composition, Profile activation, immutable Profile/Platform history, legacy Snapshot archive, redeploy compatibility, and truthful historical identity:

> **[Snapshots — Complete Feature Guide](./docs/sections/snapshots.md)**

---

### Public Profile Sections

Detailed documentation will be added one section at a time as each section is reviewed against its current implementation.

Planned:

```text
About Me
Experience
Skills
Education
Resume
Projects
Code Lab
Fun Zone
Timeline
```

We intentionally do **not** create empty documentation files before reviewing the actual implementation.

---

### Other Admin Sections

Planned / future implementation:

```text
Data
Settings
```

The future Data editor is already structurally supported by the canonical ProfileContent → immutable Profile Variant architecture documented in the Snapshots architecture guide.

---

<a id="architecture-documentation"></a>

## Architecture Documentation

### Analytics

Backend architecture, tracking model, session model, privacy, event ingestion, DynamoDB/S3 storage, release boundaries, exact aggregation, DEV/PROD separation, and deployment integration:

> **[Analytics Architecture](./docs/architecture/analytics-architecture.md)**

---

### Profile / Platform Control Plane

Profile Variant, activation, Platform Release, Platform Deployment, Deployment Configuration, PPS, historical truth, and Snapshot compatibility:

> **[Snapshots and Profile Platform Architecture](./docs/architecture/snapshots-architecture.md)**

### Additional Architecture Documentation

May be added later when useful:

```text
Asset/CDN Architecture
deeper standalone Deployment Architecture
```

[Back to Index](#index)

---

<a id="quick-start"></a>

# 3. Quick Start

<a id="start-local-development"></a>

## Start Local Development

From the repository root:

```bash
cd ~/projects/tejas-profile
npm start
```

Open:

```text
http://localhost:3000
```

Use `npm start` while actively developing.

It:

```text
Starts local React app     ✅
Hot reloads changes        ✅
Lets you test localhost    ✅

Deploys DEV                ❌
Deploys PROD               ❌
Changes AWS                ❌
Pushes Git                 ❌
```

---

<a id="most-common-flow"></a>

## Most Common Development Flow

For most application changes:

```text
npm start
   ↓
make changes
   ↓
test locally
   ↓
npm_cd
   ↓
CI Quality Gate automatically
   ↓
Deploy Infra (CDK) automatically → DEV only
   ↓
verify both workflows
   ↓
if site/runtime changed:
    Promote Frontend (PROD)
   ↓
verify live PROD
```

You do **not** manually deploy PROD infrastructure for every frontend change.

[Back to Index](#index)

---

<a id="changed-something"></a>

# 4. I Changed Something — What Do I Do?

First determine what type of change you made.

---

<a id="decision-guide"></a>

## Decision Guide

### Normal frontend/application change

Examples:

```text
React
CSS
UI/UX
copy
text
frontend data
About Me
Experience
Skills
Education
Projects
Timeline
frontend Analytics UI
frontend JavaScript
```

Use:

> [Case A — Normal Frontend / UI / Data Change](#frontend-change)

---

### Infrastructure/backend change

Examples:

```text
infra/cdk/**
Lambda
API Gateway
DynamoDB
S3 infrastructure
CloudFront infrastructure
IAM
CDK
backend Analytics
Snapshots backend
CloudFormation outputs
AWS roles
```

Use:

> [Case B — Infrastructure / Backend Change](#infra-change)

---

### Documentation-only change

Examples:

```text
README.md
docs/**
comments that do not affect runtime behavior
```

Use:

> [Case C — Documentation-Only Change](#documentation-change)

---

<a id="frontend-change"></a>

## Case A — Normal Frontend / UI / Data Change

Use this flow:

```text
Develop locally
      ↓
npm_cd
      ↓
CI Quality Gate automatically
      ↓
Deploy Infra (CDK) automatically → DEV
      ↓
Verify DEV
      ↓
Promote Frontend (PROD) manually
      ↓
Verify live PROD
```

You normally do **not** need manual PROD infrastructure deployment.

Detailed procedure:

> [Normal Frontend Release — Full Procedure](#frontend-release-procedure)

---

<a id="infra-change"></a>

## Case B — Infrastructure / Backend Change

Use this flow:

```text
Develop locally
      ↓
npm_cd
      ↓
CI Quality Gate automatically
      ↓
Automatic DEV infrastructure deployment
      ↓
DEV smoke test
      ↓
Verify DEV
      ↓
Manual PROD infrastructure deployment
      ↓
Wait for PROD infra success
      ↓
Promote Frontend (PROD)
      ↓
Verify live PROD
```

Detailed procedure:

> [Infrastructure / Backend Release — Full Procedure](#infra-release-procedure)

---

<a id="documentation-change"></a>

## Case C — Documentation-Only Change

For changes only to:

```text
README.md
docs/**
```

use:

```text
edit documentation
      ↓
preview Markdown
      ↓
npm_cd
      ↓
CI runs
      ↓
automatic DEV workflow may still run because current CI/CD is branch-based
```

If **only documentation changed**, you normally do **not** need:

```text
Manual PROD infrastructure deployment
Promote Frontend (PROD)
```

because README/documentation files are repository documentation and are not part of the React production site.

You only need the Git checkpoint/push so GitHub contains the updated documentation.

[Back to Index](#index)

---

<a id="npm-cd"></a>

# 5. Understanding `npm_cd`

Preferred checkpoint command:

```bash
npm_cd
```

`npm_cd` is a local shell alias for:

```bash
~/projects/tejas-profile/scripts/checkpoint_deploy.sh
```

It is **not an npm package script**.

Verify:

```bash
type npm_cd
```

Expected:

```text
npm_cd is an alias for ~/projects/tejas-profile/scripts/checkpoint_deploy.sh
```

Canonical command:

```bash
bash scripts/checkpoint_deploy.sh
```

---

<a id="npm-cd-does"></a>

## What `npm_cd` Does

```text
refresh origin/main
      ↓
verify origin/main ancestry
      ↓
git diff --check
      ↓
frontend tests
      ↓
production frontend build
      ↓
backend / infrastructure verification
      ↓
CDK synth
      ↓
stage changes
      ↓
reject staged .env files
      ↓
create checkpoint commit
      ↓
update local-only build metadata
      ↓
create immutable checkpoint tag
      ↓
atomically push main + checkpoint tag
```

Expected successful result:

```text
CHECKPOINT CREATED

Commit:
<40-character SHA>

Checkpoint tag:
checkpoint-...

PROD:
NOT DEPLOYED
```

Save the full SHA.

---

<a id="npm-cd-does-not"></a>

## What `npm_cd` Does NOT Do

```text
Deploy PROD infrastructure    ❌
Deploy PROD frontend          ❌
Automatically promote PROD    ❌
Perform direct PROD CDK       ❌
```

---

<a id="after-npm-cd"></a>

## What Happens Automatically After `npm_cd`

Normally:

```text
1. CI Quality Gate
2. Deploy Infra (CDK)
```

Flow:

```text
npm_cd
   ↓
push main
   ↓
CI Quality Gate
   ↓
if successful
   ↓
Deploy Infra (CDK)
   ↓
DEV only
```

[Back to Index](#index)

---

<a id="local-commands"></a>

# 6. Local Development Commands

<a id="npm-start"></a>

## `npm start`

```bash
npm start
```

Use for:

```text
React development
CSS
UI
frontend logic
localhost testing
```

Does not deploy anything.

---

<a id="npm-test"></a>

## `npm test`

```bash
npm test
```

Interactive/watch-mode frontend tests.

---

<a id="npm-test-ci"></a>

## Deterministic Frontend Tests

```bash
CI=true npm run test:ci
```

The deterministic suite grows with the repository. Treat the command result itself as authoritative rather than maintaining a hard-coded test count in this README.

---

<a id="npm-build"></a>

## Production Frontend Build

```bash
CI=true npm run build
```

Verifies the production bundle compiles.

---

<a id="infra-verify"></a>

## Infrastructure / Backend Verification

```bash
cd infra/cdk
npm run verify
cd ../..
```

Runs:

```text
TypeScript build
backend/infrastructure tests
CDK synth
```

The exact suite counts evolve with the repository.

For release decisions, the authoritative result is the current successful frontend and infrastructure/backend verification output, not a hard-coded count in this document.

`npm_cd` already runs the full quality gate.

[Back to Index](#index)

---

<a id="github-workflows"></a>

# 7. GitHub Actions Workflows

<a id="ci-quality-gate"></a>

## CI Quality Gate

File:

```text
.github/workflows/ci.yml
```

Responsibilities:

```text
frontend tests
frontend production build
backend/infra verification
CDK synth
```

It does not mutate AWS.

---

<a id="deploy-infra-workflow"></a>

## Deploy Infra (CDK)

File:

```text
.github/workflows/infra-deploy.yml
```

### Automatic Mode

Successful CI on `main`:

```text
CI
↓
Deploy Infra
↓
DEV ONLY
```

Expected:

```text
AssetsCdnStackDev
TejasProfileSnapshotsStackDev
DEV Analytics endpoints
DEV assets
DEV CDN invalidation
DEV Analytics smoke
```

---

### Manual PROD Mode

```text
GitHub
→ Actions
→ Deploy Infra (CDK)
→ Run workflow
```

Inputs:

```text
Branch:
main

target:
prod

confirm:
DEPLOY-PROD-INFRA
```

---

<a id="promote-prod"></a>

## Promote Frontend (PROD)

File:

```text
.github/workflows/deploy.yml
```

Run manually:

```text
GitHub
→ Actions
→ Promote Frontend (PROD)
```

Inputs:

```text
gitSha:
<exact 40-character SHA>

confirm:
PROMOTE-PROD
```

Expected jobs:

```text
Validate & Build PROD
Deploy PROD Pages
Publish CI Snapshot (prod)
```

---

<a id="redeploy-owner"></a>

## Redeploy (Owner)

Use for deliberate redeployment/rollback.

Requires:

```text
exact SHA
+
REDEPLOY-PROD
```

Normal releases use:

```text
Promote Frontend (PROD)
```

---

<a id="cdn-invalidate-workflow"></a>

## CDN Invalidate

Manual maintenance workflow.

Use only when a deliberate CloudFront cache refresh is needed outside normal deployment.

[Back to Index](#index)

---

<a id="frontend-release-procedure"></a>

# 8. Normal Frontend Release — Full Procedure

## Step 1 — Develop

```bash
cd ~/projects/tejas-profile
npm start
```

---

## Step 2 — Inspect

```bash
git status --short
git diff --stat
```

Everything should be intentional.

---

## Step 3 — Checkpoint

```bash
npm_cd
```

Wait for:

```text
Frontend tests ✅
Production build ✅
Infrastructure/backend verify ✅
Checkpoint commit ✅
Checkpoint tag ✅
Atomic push ✅
```

Save the full SHA.

---

## Step 4 — Verify CI

```text
GitHub
→ Actions
→ CI Quality Gate
```

Expected:

```text
Frontend                  ✅
Infrastructure + Backend  ✅
Quality Gate              ✅
```

---

## Step 5 — Verify DEV

```text
GitHub
→ Actions
→ Deploy Infra (CDK)
```

Expected:

```text
CDK deploy (DEV)                          ✅
Resolve DEV Analytics endpoints           ✅
Configure DEV asset publisher             ✅
Publish DEV assets                        ✅
Invalidate DEV asset CDN                  ✅
Smoke test DEV Analytics                  ✅
```

PROD should be skipped.

---

## Step 6 — Promote PROD

```text
GitHub
→ Actions
→ Promote Frontend (PROD)
```

Inputs:

```text
gitSha:
<full SHA>

confirm:
PROMOTE-PROD
```

---

## Step 7 — Verify Live PROD

See:

> [Verify Live PROD](#verify-live-prod)

[Back to Index](#index)

---

<a id="infra-release-procedure"></a>

# 9. Infrastructure / Backend Release — Full Procedure

```text
develop
   ↓
npm_cd
   ↓
CI ✅
   ↓
automatic DEV infra ✅
   ↓
DEV smoke ✅
   ↓
manual PROD infra
   ↓
DEPLOY-PROD-INFRA
   ↓
wait for success
   ↓
Promote Frontend PROD
   ↓
PROMOTE-PROD
   ↓
verify live site
```

Manual PROD infrastructure:

```text
GitHub
→ Actions
→ Deploy Infra (CDK)

Branch:
main

target:
prod

confirm:
DEPLOY-PROD-INFRA
```

Only after that succeeds:

```text
GitHub
→ Actions
→ Promote Frontend (PROD)
```

[Back to Index](#index)

---

<a id="need-prod-infra"></a>

# 10. Do I Need PROD Infrastructure?

| Change | PROD Infra First? | PROD Frontend? |
|---|---:|---:|
| React | No | Yes |
| CSS / UI | No | Yes |
| Text/content | No | Yes |
| Frontend data | No | Yes |
| Analytics UI | No | Yes |
| Documentation only | No | No |
| Lambda | Yes | Usually yes |
| API Gateway | Yes | Usually yes |
| DynamoDB | Yes | Usually yes |
| IAM | Yes | Usually yes |
| CDK | Yes | Usually yes |
| CloudFront infra | Yes | Usually yes |
| S3 infra | Yes | Usually yes |
| Stack outputs | Yes | If frontend consumes them |
| Workflow-only | Depends | Depends |

[Back to Index](#index)

---

<a id="prod-deployment-architecture"></a>

# 11. PROD Deployment Architecture

```text
exact Git SHA requested
   ↓
validate request + main ancestry
   ↓
checkout exact SHA
   ↓
tests + infra/backend verification
   ↓
resolve PROD infrastructure/endpoints
   ↓
build frontend
   ↓
create immutable Platform Release
(plr_gha_<run>_<attempt>)
   ↓
──── PROD mutation / publication work ────
   ↓
publish PROD assets
   ↓
upload repository artifact
   ↓
deploy GitHub Pages
   ↓
derive Platform Deployment occurrence
(pdep_gha_<run>_<attempt>)
   ↓
resolve current ACTIVE Profile state
   ↓
ensure compatible Deployment Configuration
   ↓
atomically commit Platform Deployment
+ ACTIVE Platform transition
+ effective Usage Epoch transition
   ↓
register legacy-compatible Analytics deploy boundary
   ↓
invalidate PROD CDN
   ↓
update deploy/history.json compatibility history
   ↓
publish PROD CI Snapshot
with exact formal Platform links
```

Git SHA remains deployment provenance and the explicit repository release input.

It is not the Platform Release identity.

Profile activation remains a separate control-plane operation and does not require a GitHub Pages deployment.

[Back to Index](#index)

---

<a id="aws-login"></a>

# 12. AWS Login and Local AWS Access

AWS login is not required for normal development or `npm_cd`.

When intentionally accessing AWS:

```bash
cd ~/projects/tejas-profile

export AWS_SDK_LOAD_CONFIG=1
export AWS_PROFILE=tejas-sso

aws sso login --profile tejas-sso
```

Verify:

```bash
aws sts get-caller-identity
```

[Back to Index](#index)

---

<a id="asset-management"></a>

# 13. Asset Management

Git operations do not publish assets.

Assets are normally deployed through CD.

---

<a id="dev-assets"></a>

## DEV Assets

Manual DEV sync if intentionally needed:

```bash
ASSET_STAGE=dev npm run sync:assets
```

Invalidate:

```bash
ASSET_STAGE=dev npm run cdn:invalidate
```

---

<a id="prod-assets"></a>

## PROD Assets

Normal PROD promotion handles these.

Manual sync requires:

```bash
ASSET_STAGE=prod \
ASSET_CONFIRMATION=SYNC-PROD \
npm run sync:assets
```

Manual invalidation:

```bash
ASSET_STAGE=prod \
ASSET_CONFIRMATION=INVALIDATE-PROD \
npm run cdn:invalidate
```

---

<a id="asset-dry-run"></a>

## Read-Only Asset Dry Runs

```bash
ASSET_STAGE=prod \
ASSET_DRY_RUN=1 \
npm run sync:assets
```

```bash
ASSET_STAGE=prod \
ASSET_DRY_RUN=1 \
npm run cdn:invalidate
```

No S3/CloudFront mutation occurs.

[Back to Index](#index)

---

<a id="verify-git"></a>

# 14. Verify Git Before PROD

<a id="verify-local-remote"></a>

## Verify Local vs Remote

```bash
git fetch origin main --tags

git rev-parse HEAD
git rev-parse origin/main
```

Inspect recent history:

```bash
git log -5 --oneline --decorate origin/main
```

Check working tree:

```bash
git status --short
```

---

<a id="verify-checkpoint-tag"></a>

## Verify a Checkpoint Tag

Current baseline:

```bash
git rev-parse checkpoint-2026-08-21_07-41-20^{commit}
```

Expected:

```text
c341be871fbf61598eb20fb0fce1f103a8fc1a62
```

[Back to Index](#index)

---

<a id="verify-live-prod"></a>

# 15. Verify Live PROD

Use:

```bash
EXPECTED_SHA="<FULL_SHA>"
EXPECTED_PV="pv_<SHORT_SHA>"
BASE_URL="https://rautte.github.io/tejas-profile"

HTML="$(
  curl -fsSL \
    "${BASE_URL}/?cacheBust=$(date +%s)"
)"

MAIN_JS="$(
  printf '%s' "${HTML}" |
    grep -oE 'static/js/main\.[^"]+\.js' |
    head -n 1
)"

if [[ -z "${MAIN_JS}" ]]; then
  echo "❌ Could not resolve live main JS bundle."
  exit 1
fi

TMP_BUNDLE="$(mktemp)"

curl -fsSL \
  "${BASE_URL}/${MAIN_JS}?cacheBust=$(date +%s)" \
  -o "${TMP_BUNDLE}"

if grep -Fq "${EXPECTED_SHA}" "${TMP_BUNDLE}"; then
  echo "✅ Live PROD SHA verified"
else
  echo "❌ Live PROD SHA mismatch"
fi

if grep -Fq "${EXPECTED_PV}" "${TMP_BUNDLE}"; then
  echo "✅ Live PROD profile version verified"
else
  echo "❌ Live PROD profile version mismatch"
fi

rm -f "${TMP_BUNDLE}"
```

Current baseline:

```text
EXPECTED_SHA:
c341be871fbf61598eb20fb0fce1f103a8fc1a62

EXPECTED_PV:
pv_c341be8
```

[Back to Index](#index)

---

<a id="analytics-summary"></a>

# 16. Analytics Summary

Analytics is one of the project's most sophisticated admin features.

The root README intentionally contains only a summary.

For complete user-facing documentation:

> **[Analytics Feature Guide](./docs/sections/analytics.md)**

For backend/system-design documentation:

> **[Analytics Architecture](./docs/architecture/analytics-architecture.md)**

At a high level:

```text
Public Browser
    ↓
Analytics CloudFront Edge
    ↓
Analytics API
    ↓
Lambda
    ↓
DynamoDB aggregates
+
S3 raw batches
```

Owner/Admin analytics uses the direct owner API instead of the public ingest edge.

The system supports:

```text
exact anonymous unique visitors
sessions
new/returning visitors
active time
section reach
section funnel
CTA engagement
deep links
project opens
code snippet views
country/city analytics
session journeys
release filtering
baseline/reset filtering
period comparisons
deployment boundaries
formal runtime identity
Usage Epoch historical archive
immutable Configuration Analytics Reports
```

[Back to Index](#index)

---

<a id="snapshots"></a>

# 17. Snapshots and Release Metadata

Admin → Snapshots now exposes both the formal Profile/Platform control plane and the retained legacy Snapshot archive.

Formal control-plane identities include:

```text
Profile Variant
Platform Release
Platform Deployment
Deployment Configuration
```

These identities are not inferred from Git SHA or legacy `profileVersion`.

The page provides:

```text
Current runtime composition
Profile Variant activation
Profile Variant history
Platform Release history
Deployment Configuration relationships
legacy Snapshot archive
historical truth classification
redeploy/rollback compatibility
```

Successful formal PROD deployment also publishes a legacy-compatible CI Snapshot.

Its provenance may include:

```text
Git SHA
legacy profileVersion
checkpoint tag
build time
repository artifact
artifact checksum
changed-file categories
```

New CI Snapshots additionally persist exact authoritative `formalLinks` when available:

```text
platformReleaseId
platformDeploymentId
```

Those links come from the completed formal deployment workflow and are never reconstructed from Git SHA or GitHub run metadata.

Detailed feature documentation:

> **[Snapshots — Feature Guide](./docs/sections/snapshots.md)**

Architecture:

> **[Snapshots and Profile Platform Architecture](./docs/architecture/snapshots-architecture.md)**

[Back to Index](#index)

---

<a id="recovery"></a>

# 18. Recovery and Rollback

<a id="local-recovery"></a>

## Local Source Recovery

```bash
bash scripts/restore_last_checkpoint.sh
```

Restores local source.

It does not deploy PROD.

---

<a id="prod-rollback"></a>

## PROD Redeploy / Rollback

```text
GitHub
→ Actions
→ Redeploy (Owner)
```

Inputs:

```text
gitSha:
<known-good SHA>

confirm:
REDEPLOY-PROD
```

[Back to Index](#index)

---

<a id="git-hooks"></a>

# 19. Git Hooks

Git hooks are local-validation-only.

They must never:

```text
upload S3
invalidate CloudFront
deploy CDK
publish snapshots
mutate AWS
```

[Back to Index](#index)

---

<a id="environment-files"></a>

# 20. Environment Files and Secrets

Never commit:

```text
.env
.env.local
.env.production.local
.env.*
```

The checkpoint script rejects staged environment files.

Production configuration is generated from trusted deployment metadata and infrastructure outputs.

[Back to Index](#index)

---

<a id="deprecated-practices"></a>

# 21. Old / Deprecated Deployment Practices

Do not use the old combined deployment as the normal release process:

```bash
cd infra/cdk

npx cdk deploy \
  AssetsCdnStack \
  TejasProfileSnapshotsStackProd \
  TejasProfileSnapshotsStackDev
```

Current model:

```text
DEV
→ automatic GitHub deployment

PROD infrastructure
→ explicit manual workflow

PROD frontend
→ explicit exact-SHA promotion
```

[Back to Index](#index)

---

<a id="checklists"></a>

# 22. Pre-Release Checklists

<a id="before-npm-cd"></a>

## Before `npm_cd`

```text
□ App works locally
□ Changes are intentional
□ Relevant tests passed
□ No secrets are staged
□ No .env file is staged
□ Ready to push
□ Ready for automatic DEV deployment
```

---

<a id="after-npm-cd-checklist"></a>

## After `npm_cd`

Expected:

```text
CI Quality Gate             ✅
Deploy Infra (CDK) — DEV    ✅
```

---

<a id="before-prod-promotion"></a>

## Before PROD Frontend Promotion

```text
□ CI passed
□ DEV deployment passed
□ DEV smoke passed
□ exact SHA known
□ origin/main correct
□ no required PROD infra remains undeployed
```

Then:

```text
Promote Frontend (PROD)

gitSha:
<exact SHA>

confirm:
PROMOTE-PROD
```

---

<a id="before-prod-infra"></a>

## Before PROD Promotion When Infrastructure Changed

```text
□ npm_cd succeeded
□ CI passed
□ DEV deployed
□ DEV smoke passed
```

Then:

```text
Deploy Infra (CDK)

target:
prod

confirm:
DEPLOY-PROD-INFRA
```

Wait for success.

Then promote frontend.

[Back to Index](#index)

---

<a id="short-version"></a>

# 23. Short Version — If You Remember Nothing Else

## Normal Runtime/Frontend Change

```text
npm start
   ↓
make/test change
   ↓
npm_cd
   ↓
CI ✅
   ↓
DEV ✅
   ↓
Promote Frontend PROD
exact SHA + PROMOTE-PROD
   ↓
verify PROD
```

## Infrastructure/Backend Change

```text
develop
   ↓
npm_cd
   ↓
CI ✅
   ↓
DEV infra + smoke ✅
   ↓
Deploy Infra PROD
DEPLOY-PROD-INFRA
   ↓
Promote Frontend PROD
PROMOTE-PROD
   ↓
verify PROD
```

## Documentation-Only Change

```text
edit README/docs
   ↓
npm_cd
   ↓
CI / automatic DEV workflow may run
   ↓
DONE

No PROD promotion required.
```

[Back to Index](#index)

---

<a id="do-not-do"></a>

# 24. Things NOT to Do

```text
❌ Do not automatically deploy PROD after every commit.

❌ Do not manually deploy PROD infra for frontend-only changes.

❌ Do not manually upload PROD assets during normal releases.

❌ Do not use direct PROD CDK deploy as the normal workflow.

❌ Do not put AWS mutations back into Git hooks.

❌ Do not commit .env files.

❌ Do not expose Owner secrets in the React application.

❌ Do not use npm audit fix --force casually.

❌ Do not promote an unverified SHA.

❌ Do not promote PROD before CI/DEV verification.

❌ Do not delete Analytics history during normal deployment.

❌ Do not create empty/stale documentation just to fill the docs directory.
```

[Back to Index](#index)

---

<a id="maintenance"></a>

# 25. Maintenance Notes

Non-blocking items:

- CRA/Browserslist may report stale `caniuse-lite`.
- GitHub Actions may report Node runtime deprecation warnings.
- Handle dependency upgrades separately from feature releases.
- Avoid `npm audit fix --force`.
- Prefer small independently verifiable infrastructure changes.
- Keep documentation synchronized with actual implementation.

[Back to Index](#index)

---

<a id="platform-guarantees"></a>

# 26. Current Platform Guarantees

## Git is Cloud-Pure

```text
git commit
git push
```

do not directly mutate AWS.

---

## CI is Validation-Only

```text
CI Quality Gate
```

tests/builds but does not mutate AWS.

---

## DEV is Automatic

```text
main push
↓
CI
↓
DEV infrastructure
↓
DEV assets
↓
DEV smoke
```

---

## PROD is Explicit

Infrastructure:

```text
target=prod
+
DEPLOY-PROD-INFRA
```

Frontend:

```text
exact SHA
+
PROMOTE-PROD
```

Redeploy:

```text
exact SHA
+
REDEPLOY-PROD
```

---

## DEV and PROD Are Isolated

Separate stacks/resources exist for DEV and PROD.

---

## Deployment Uses Exact Git Provenance

PROD deployment begins from an explicit, verified Git SHA.

That SHA identifies repository provenance.

The formal software-release identity is a separate immutable Platform Release, and a deployment occurrence is a separate Platform Deployment.

---

## Checkpoint Tags Are Immutable

Example:

```text
checkpoint-2026-08-21_07-41-20
```

---

## Analytics Is Release-Aware

Analytics carries formal runtime identity for new events and archives exact completed Usage Epochs by Deployment Configuration.

The Live analytics surface intentionally retains the legacy `profileVersion` release dimension and deployment boundaries for compatibility and historical analysis.

---

## Live PROD Identity Is Verifiable

Two identity layers are deliberately visible.

Repository/build provenance includes:

```text
Git SHA
legacy Profile Version
build metadata
```

Formal runtime composition includes:

```text
Profile Variant
Platform Release
Deployment Configuration
```

Do not use Git SHA or legacy Profile Version as a substitute for formal Profile/Platform identity.

[Back to Index](#index)

---

<a id="cra-reference"></a>

# 27. Create React App Reference

Useful commands:

```bash
npm start
npm test
npm run build
```

CRA:

https://create-react-app.dev/

React:

https://react.dev/

---

# Final Reminder

If you return after a long time:

```text
1. Read README.md.

2. For feature details:
   docs/README.md

3. Develop:
   npm start

4. Checkpoint:
   npm_cd

5. Verify:
   CI ✅
   DEV ✅

6. If infrastructure changed:
   Deploy Infra PROD
   DEPLOY-PROD-INFRA

7. If runtime/site changed:
   Promote Frontend PROD
   exact SHA
   PROMOTE-PROD

8. Verify live site.
```

Current known-good PROD baseline:

```text
Commit:
c341be871fbf61598eb20fb0fce1f103a8fc1a62

Checkpoint:
checkpoint-2026-08-21_07-41-20

Profile Version:
pv_c341be8
```

[Back to Index](#index)
