# API Reference

Every HTTP route exposed by the backend, grouped by Lambda handler. Auth column: **Owner** = requires an authenticated owner session (`requireOwner()`); **Public** = no authentication.

For the domain objects these routes read/write, see [Core Entities](./core-entities.md). For how these Lambdas fit into the wider system, see [High-Level Design](./high-level-design.md).

---

## Index

- [1. Active Profile Handler](#1-active-profile-handler)
- [2. Analytics Handler](#2-analytics-handler)
- [3. Snapshots API Handler — Owner Session & Passcode](#3-snapshots-api-handler--owner-session--passcode)
- [4. Snapshots API Handler — Profile Variants](#4-snapshots-api-handler--profile-variants)
- [5. Snapshots API Handler — Platform Releases & Deployments](#5-snapshots-api-handler--platform-releases--deployments)
- [6. Snapshots API Handler — Deployment Configurations & Usage Epochs](#6-snapshots-api-handler--deployment-configurations--usage-epochs)
- [7. Snapshots API Handler — Configuration Analytics Reports](#7-snapshots-api-handler--configuration-analytics-reports)
- [8. Snapshots API Handler — Usage Cost](#8-snapshots-api-handler--usage-cost)
- [9. Snapshots API Handler — Legacy Snapshots & Repo](#9-snapshots-api-handler--legacy-snapshots--repo)
- [10. Non-HTTP: Usage Cost Aggregator](#10-non-http-usage-cost-aggregator)

---

## 1. Active Profile Handler

`infra/cdk/lambda/active-profile-handler.ts` — fronted by the shared Analytics CloudFront distribution's `/profile/active` behavior (30s TTL cache, cache key includes `Origin`).

```text
Method  Route             Auth     Purpose
GET     /profile/active   Public   Returns the ACTIVE Profile Variant's
                                    content plus formal runtime identity
                                    (profileVariantId, platformReleaseId,
                                    deploymentConfigurationId) for the
                                    requesting stage.
```

Any other method or path on this route returns 404. Response varies `Access-Control-Allow-Origin` by request `Origin`, which is why the CDN cache key must include `Origin` (see NFR-4.6).

[Back to Index](#index)

---

## 2. Analytics Handler

`infra/cdk/lambda/analytics-handler.ts` — public ingest routes are fronted by the Analytics CloudFront edge; all routes also reachable directly via API Gateway for owner/admin use.

```text
Method  Route                    Auth     Purpose
POST    /analytics/ingest        Public   Accept a batched event payload
                                           from the frontend tracker.
GET     /analytics/query         Public*  Query aggregated Analytics data
                                           for a date range/dimension set.
GET     /analytics/meta          Owner    Metadata needed by the dashboard
                                           (available releases, boundaries).
POST    /analytics/releases      Owner    Register/reconcile release
                                           metadata for a profileVersion.
POST    /analytics/boundaries    Owner    Create a RESET or DEPLOY boundary.
```

`*` `/analytics/query` is not gated by `requireOwner()` at the router level in this handler, but is only ever called from the owner-authenticated Admin → Analytics page via `REACT_APP_SNAPSHOTS_API` (direct API Gateway, not the public ingest edge) — see [Analytics Architecture § Owner/Admin Query Flow](../architecture/analytics-architecture.md#owner-query).

[Back to Index](#index)

---

## 3. Snapshots API Handler — Owner Session & Passcode

`infra/cdk/lambda/snapshots-handler.ts` (`fn` / SnapshotsApiHandler) — every route below shares this one Lambda, gated by `requireOwner()` unless noted.

```text
Method  Route                                  Auth    Purpose
POST    /owner/session                         Public  Establish an owner
                                                        session from a
                                                        passcode.
POST    /owner/passcode/request-change         Public  Begin a passcode
                                                        rotation (e.g. emails
                                                        a confirmation step).
POST    /owner/passcode/confirm-change         Public  Complete a passcode
                                                        rotation.
```

These three are necessarily reachable pre-authentication (they establish or recover the authenticated state itself); every other route in this handler requires an existing owner session.

[Back to Index](#index)

---

## 4. Snapshots API Handler — Profile Variants

```text
Method  Route                                     Purpose
POST    /profile-variants/assets/presign-put       Presigned S3 PUT URL for
                                                    staging a Draft asset.
POST    /profile-variants/publish                  Publish a Draft as a new
                                                    immutable Profile Variant.
GET     /profile-variants/get                      Fetch one Variant by id.
POST    /profile-variants/get-batch                Fetch multiple Variants
                                                    by id in one call.
GET     /profile-variants/list                     List Variants (catalog).
POST    /profile-variants/activate                 Activate a Variant for a
                                                    stage (optimistic-
                                                    concurrency guarded).
```

[Back to Index](#index)

---

## 5. Snapshots API Handler — Platform Releases & Deployments

```text
Method  Route                            Purpose
POST    /platform-releases/register       Create a new immutable Platform
                                           Release record.
GET     /platform-releases/get            Fetch one Platform Release by id.
GET     /platform-releases/list           List Platform Releases.
GET     /profile-activations/list         List Profile activation history
                                           (optionally filtered by
                                           profileVariantId via GSI).
GET     /platform-deployments/list        List Platform Deployment history
                                           (optionally filtered by
                                           platformReleaseId via GSI).
POST    /platform-deployments/commit      Commit a Platform Deployment
                                           occurrence (atomic cross-
                                           control-plane transition guard).
```

[Back to Index](#index)

---

## 6. Snapshots API Handler — Deployment Configurations & Usage Epochs

```text
Method  Route                                Purpose
POST    /deployment-configurations/create     Compute/create a Deployment
                                               Configuration from a
                                               (Platform Release, Profile
                                               Variant) pair.
GET     /deployment-configurations/get        Fetch one Deployment
                                               Configuration by id.
GET     /deployment-configurations/list       List Deployment
                                               Configurations.
GET     /usage-epochs/list                    List Usage Epochs (OPEN /
                                               CLOSING / CLOSED).
```

[Back to Index](#index)

---

## 7. Snapshots API Handler — Configuration Analytics Reports

```text
Method  Route                                          Purpose
GET     /configuration-analytics-reports/get            Fetch one immutable
                                                          report by its
                                                          Usage Epoch.
GET     /configuration-analytics-reports/get-batch       Fetch multiple
                                                          reports in one
                                                          call.
```

[Back to Index](#index)

---

## 8. Snapshots API Handler — Usage Cost

```text
Method  Route                    Purpose
GET     /usage/summary            Current config + latest day/week/month
                                   cost+usage snapshot.
GET     /usage/history             Up to `limit` snapshots for one
                                   periodType, newest first.
POST    /usage/config              Set intervalDays and/or
                                   alertThresholds (omitted threshold
                                   fields keep their prior saved value).
POST    /usage/refresh-now         Fire-and-forget async-invoke of the
                                   Usage Cost aggregator with
                                   { force: true }.
```

Full behavior (due-ness gating, alert dedupe, IAM boundary between this handler and the aggregator) is in [Usage Cost Architecture](../architecture/usage-architecture.md).

[Back to Index](#index)

---

## 9. Snapshots API Handler — Legacy Snapshots & Repo

```text
Method  Route                       Purpose
POST    /snapshots/presign-put       Presigned S3 PUT URL for a new
                                     Snapshot artifact.
POST    /snapshots/commit-meta       Commit a Snapshot's metadata record
                                     after its artifact upload completes.
POST    /repo/presign-put            Presigned S3 PUT URL for a repository
                                     zip artifact.
GET     /repo/presign-get            Presigned S3 GET URL for a repository
                                     zip artifact.
GET     /snapshots/list              List Snapshots.
GET     /snapshots/presign-get       Presigned S3 GET URL for a Snapshot
                                     artifact.
POST    /snapshots/remark            Update a Snapshot's owner-facing
                                     note.
POST    /snapshots/delete            Soft-delete a Snapshot.
POST    /snapshots/restore           Restore a soft-deleted Snapshot.
POST    /snapshots/purge             Hard-delete a Snapshot permanently.
GET     /deploy/history              List deployment history (legacy
                                     redeploy-compatible view).
```

[Back to Index](#index)

---

## 10. Non-HTTP: Usage Cost Aggregator

`infra/cdk/lambda/usage-cost-aggregator.ts` — not an HTTP route. Invoked two ways:

```text
EventBridge rule (rate: 6h)   → scheduled tick; runs the expensive
                                 Cost Explorer/CloudWatch path only
                                 if a collection is actually due.
lambda:InvokeFunction          → invoked directly by the Snapshots API
(from POST /usage/refresh-now)   handler with { force: true }, bypassing
                                 the due-ness check.
```

Writes results to `UsageCostMetricsTable`, the same table `/usage/summary` and `/usage/history` read from. See [Usage Cost Architecture § Due-ness Gating](../architecture/usage-architecture.md#3-due-ness-gating-cost-control).

[Back to Index](#index)

---

## Related Documentation

> **[Core Entities](./core-entities.md)**

> **[Snapshots and Profile Platform Architecture](../architecture/snapshots-architecture.md)**

> **[Analytics Architecture](../architecture/analytics-architecture.md)**

> **[Usage Cost Architecture](../architecture/usage-architecture.md)**

> **[Specification Home](./README.md)**
