# High-Level Design

The major components of the system and how they fit together. For per-endpoint detail see [API Reference](./api-reference.md); for the entities these components manipulate see [Core Entities](./core-entities.md); for implementation-level detail see [Low-Level Design](./low-level-design.md).

---

## Index

- [1. System Overview](#1-system-overview)
- [2. Component Map](#2-component-map)
- [3. Public Read Path](#3-public-read-path)
- [4. Owner/Admin Path](#4-owner-admin-path)
- [5. Analytics Ingestion Path](#5-analytics-ingestion-path)
- [6. Usage Cost Path](#6-usage-cost-path)
- [7. Deployment Pipeline](#7-deployment-pipeline)
- [8. DEV / PROD Topology](#8-dev--prod-topology)
- [9. Design Principles](#9-design-principles)

---

## 1. System Overview

```text
Frontend:        React (Create React App), single-page, hash routing
Infra:            AWS CDK (TypeScript), 5 stacks (2 asset/frontend
                  CDN stacks + 2 Snapshots control-plane stacks +
                  1 shared Analytics Edge distribution)
Compute:          Lambda (Node.js/TypeScript) — 4 handlers:
                  active-profile-handler, analytics-handler,
                  snapshots-handler, usage-cost-aggregator
Storage:          DynamoDB (control-plane catalogs, Analytics
                  aggregates, Usage Cost metrics),
                  S3 (Profile Variant/Platform Release bodies,
                  Snapshot/repo artifacts, raw Analytics batches)
Email:            SES (owner passcode rotation, cost alerts)
CDN:              CloudFront (frontend hosting, asset hosting,
                  shared Analytics Edge fronting both /analytics/*
                  ingest and /profile/active)
CI/CD:            GitHub Actions (CI Quality Gate, Deploy Infra,
                  Promote Frontend, Redeploy, CDN Invalidate)
```

[Back to Index](#index)

---

## 2. Component Map

```text
                         ┌─────────────────────────┐
                         │   Public Browser         │
                         └───────────┬──────────────┘
                                     │
              ┌──────────────────────┼───────────────────────┐
              ▼                      ▼                        ▼
    Frontend CDN (S3+CF)   Analytics Edge (CF)        Assets CDN (S3+CF)
    (built React app)       │            │             (media/photos)
                             │            │
                  /analytics/*      /profile/active
                             │            │
                             ▼            ▼
                   analytics-handler   active-profile-handler
                             │            │
                             ▼            ▼
                   Analytics DynamoDB   Snapshots DynamoDB/S3
                   + raw S3 batches     (read-only: ACTIVE pointer,
                                         Variant/Release/Config bodies)

                         ┌─────────────────────────┐
                         │  Owner/Admin Browser     │
                         └───────────┬──────────────┘
                                     │  (direct API Gateway,
                                     │   REACT_APP_SNAPSHOTS_API)
                                     ▼
                          snapshots-handler  (fn)
                     (Profile/Platform/Snapshot/Usage
                      Cost control-plane — see API Reference)
                                     │
                    ┌────────────────┼─────────────────┐
                    ▼                ▼                 ▼
        Snapshots DynamoDB/S3   Analytics DynamoDB   UsageCostMetricsTable
                                (query/meta/releases/  (read + invoke
                                 boundaries routes)     aggregator)

                                                       ▲
                                                       │ invoke (force)
                                          ┌────────────┴────────────┐
                          EventBridige (6h) ──────▶ usage-cost-aggregator
                                                       │
                                          Cost Explorer + CloudWatch + SES
```

[Back to Index](#index)

---

## 3. Public Read Path

```text
Browser loads app
    ↓
React renders repository-fallback ProfileContent synchronously
(activeSnapshot.json if valid, else src/data/*)
    ↓ (async, non-blocking)
fetch GET /profile/active  (via Analytics Edge, 30s CDN TTL)
    ↓
active-profile-handler reads the stage's ACTIVE Profile pointer,
resolves the pointed-at Profile Variant body from S3, resolves the
current effective Deployment Configuration
    ↓
response replaces runtimeProfile state once resolved
    ↓
Hero's wave animation remounts (keyed on the resolved
profileVariantId) so its one-shot CSS animation actually plays
against final content, not the transient fallback
```

This two-phase render (fallback-then-real) is why `activeSnapshot.json` exists at all — see [Low-Level Design § Repository Fallback Sync](./low-level-design.md#5-repository-fallback-sync-activesnapshotjson) for the staleness problem it solves and its manual re-sync requirement.

[Back to Index](#index)

---

## 4. Owner/Admin Path

```text
Owner authenticates (POST /owner/session)
    ↓
Admin UI calls snapshots-handler directly via API Gateway
(REACT_APP_SNAPSHOTS_API) — never through the public Analytics Edge
    ↓
Data editor:   Draft (localStorage) -> publish -> Profile Variant
                                     -> optional activate
Snapshots:     browse/remark/restore/delete/purge legacy Snapshots
Analytics:     query/meta/releases/boundaries (same Lambda,
               different route group)
Usage:         summary/history/config/refresh-now
Settings:      passcode rotation
```

Separating the owner path (direct API Gateway) from the public path (CDN edge) means privileged routes never depend on, or share cache behavior with, the public ingestion/read surface. See [Analytics Architecture § Security Model](../architecture/analytics-architecture.md#security).

[Back to Index](#index)

---

## 5. Analytics Ingestion Path

```text
Browser tracker (tracker.js) batches allowlisted events
    ↓ fetch keepalive (or sendBeacon for nav-sensitive interactions)
CloudFront Analytics Edge
    ↓ injects trusted edge token + viewer geo headers
API Gateway
    ↓
analytics-handler
    ↓ dedupe by stable event ID, classify by Boundary, aggregate
      into a session fragment, attribute to the current Deployment
      Configuration's Usage Epoch
    ├──▶ DynamoDB (live aggregates, per-session-per-day fragments)
    └──▶ S3 (short-retention raw batch, privacy-hardened schema)
```

See [Analytics Architecture](../architecture/analytics-architecture.md) for the full event/session/journey model.

[Back to Index](#index)

---

## 6. Usage Cost Path

```text
EventBridge (rate: 6h)
    ↓
usage-cost-aggregator
    ↓ read CONFIG row; due?
    no  → return early (no AWS API calls)
    yes → GetCostAndUsageCommand (Cost Explorer, us-east-1 always)
          + GetMetricDataCommand (CloudWatch, this stack's own
            S3/DynamoDB/Lambda resources)
    ↓
UsageCostMetricsTable  (PERIOD#day|week|month rows, upserted)
    ↓
threshold crossed AND not already alerted for this periodKey?
    yes → SES email (failure never blocks the write above)
    ↓
Admin → Usage reads via snapshots-handler's /usage/* routes
"Refresh now" → snapshots-handler async-invokes the aggregator
                directly with { force: true }, bypassing due-ness
```

See [Usage Cost Architecture](../architecture/usage-architecture.md) for the IAM split between the aggregator and the API handler.

[Back to Index](#index)

---

## 7. Deployment Pipeline

```text
Local: npm_cd (scripts/checkpoint_deploy.sh)
    ↓ frontend + infra tests/build verified locally
    ↓ commit + tag + push (atomic) to main
GitHub Actions: CI Quality Gate
    ↓ on success, triggers via workflow_run
GitHub Actions: Deploy Infra (CDK)  → automatic DEV deployment
    ↓ (DEV asset deploy, DEV CDN invalidation, DEV Analytics smoke test)

Local: npm_pd (scripts/production_deploy.sh)
    ↓ requires clean working tree + interactive "PROMOTE-PROD" confirm
    ↓ promotes one exact checkpoint SHA
GitHub Actions: Promote Frontend (PROD)  → explicit PROD deployment
    ↓ PROD CI Snapshot publication (with formal platformReleaseId/
      platformDeploymentId links already established)
```

Full step-by-step procedures live in the [Root README](../../README.md) — this section exists only to show where the pipeline sits relative to the rest of the system, not to replace the runbook.

[Back to Index](#index)

---

## 8. DEV / PROD Topology

```text
DEV                                    PROD
───                                    ────
FrontendCdnStackDev (S3+CF)            GitHub Pages (not a CDK stack)
AssetsCdnStackDev (S3+CF)              AssetsCdnStack (S3+CF)
TejasProfileSnapshotsStackDev          TejasProfileSnapshotsStackProd
  own DynamoDB tables                    own DynamoDB tables
  own S3 buckets                         own S3 buckets
  own ACTIVE Profile pointer             own ACTIVE Profile pointer
  allowedOrigins: localhost:3000,        allowedOrigins:
    DEV frontend origin                    https://rautte.github.io

Deploys automatically on every          Deploys only via explicit
successful CI run against main          npm_pd promotion
```

Every stack instance is tagged `stage: dev` or `stage: prod` at the CDK App level — see [Usage Cost Architecture § Resource Tagging](../architecture/usage-architecture.md#9-resource-tagging-cost-allocation-tags-prerequisite).

[Back to Index](#index)

---

## 9. Design Principles

```text
Immutability over mutation for anything that is later relied on as
historical truth (Profile Variant, Platform Release, Configuration
Analytics Report).

Explicit identity over derived/guessed identity — no formal id is
ever synthesized from Git SHA or legacy metadata (see NFR-2.4).

Fail closed over fail open — an unrecognized game id, an
incompatible Deployment Configuration, or unauthoritative historical
Snapshot evidence is rejected/classified, never guessed into a
working-looking state.

Separate control planes for separate concerns — Profile content and
Platform software are never collapsed into one identity, even though
a casual reading of "deploying a new version" might suggest they
should be.

Reuse infrastructure where the trust boundary already matches —
/profile/active rides the existing Analytics Edge distribution
rather than provisioning a second CloudFront distribution, because
both already share the same origin and public/unauthenticated trust
level.

Scale to the actual target, not a hypothetical one — Analytics and
Usage Cost both explicitly reject heavier architectures (streaming
platforms, real-time cost queries) that this project's real traffic
and cost-tracking cadence don't justify.
```

[Back to Index](#index)

---

## Related Documentation

> **[Low-Level Design](./low-level-design.md)**

> **[Core Entities](./core-entities.md)**

> **[Snapshots and Profile Platform Architecture](../architecture/snapshots-architecture.md)**

> **[Root README](../../README.md)**

> **[Specification Home](./README.md)**
