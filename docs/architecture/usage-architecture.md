# Usage Cost Architecture

This document describes the AWS resource usage/cost tracking system behind Admin → Usage: a scheduled aggregator, its storage model, the API surface, the CDN-independent CDK resource tagging that makes Cost Allocation Tags possible, and the cost-alert email path.

---

## 1. Goals

```text
show real AWS $ cost and resource usage, aggregated day/week/month

never real-time — a periodic background job, not a live query

keep Cost Explorer's small per-call cost negligible regardless
of how often the schedule ticks

let the owner change the refresh cadence from the UI itself

optionally alert the owner by email when cost crosses a
threshold, without ever double-sending or blocking the
underlying collection
```

---

## 2. High-Level Architecture

```text
EventBridge (rate: 6h)
    ↓
UsageCostAggregator (Lambda)
    ↓ reads config, checks due-ness
    ↓ (if due, or forced) Cost Explorer + CloudWatch
    ↓
UsageCostMetricsTable (DynamoDB)
    ↑ read
SnapshotsApiHandler (Lambda)
    ↑ GET/POST /usage/*
Admin → Usage (React)
```

The aggregator and the main API handler (`fn` / SnapshotsApiHandler) are separate Lambdas with separate IAM roles. The aggregator holds the Cost Explorer / CloudWatch / SES permissions; the API handler only reads/writes the one DynamoDB table and can invoke the aggregator directly for "Refresh now" — it is never granted Cost Explorer or CloudWatch access itself.

---

## 3. Due-ness Gating (Cost Control)

EventBridge ticks the aggregator every 6 hours regardless of the owner's configured interval. Every tick reads the config row from DynamoDB; only when `now >= lastRunAt + intervalDays` does it proceed to the expensive path (Cost Explorer + CloudWatch).

```text
tick
    ↓
read config (cheap, DynamoDB GetItem)
    ↓
due?  no  → return { ran: false, reason: "not due yet" }
      yes → collect + write snapshots + advance lastRunAt
```

`force: true` (from the "Refresh now" API route) bypasses this check unconditionally. This is the only way a real collection can happen off-schedule.

---

## 4. Cost Collection

One `GetCostAndUsageCommand` call per real run, `Granularity: DAILY`, `TimePeriod` spanning the first of the current month through tomorrow, grouped by `SERVICE`. Cost Explorer is reachable only via `us-east-1` regardless of the stack's own region.

From that single response, three period totals are derived without three separate API calls:

```text
day   = the bucket matching today's date (or the most recent bucket)
week  = sum of buckets whose date falls within the current ISO week
month = sum of every bucket in the response (already scoped to the
        current month by the TimePeriod requested)
```

---

## 5. Resource Usage Collection

One `GetMetricDataCommand` call per real run, covering every configured S3 bucket / DynamoDB table / Lambda function belonging to this stack (passed in via env vars as comma-separated lists, not discovered at runtime).

```text
S3:       BucketSizeBytes (Average), NumberOfObjects (Average)
DynamoDB: ConsumedReadCapacityUnits, ConsumedWriteCapacityUnits (Sum)
Lambda:   Invocations, Errors (Sum)
```

A 2-day lookback window is used because S3 storage metrics publish once per day and can lag; the most recent datapoint in that window is used.

`fn` (SnapshotsApiHandler) is deliberately excluded from the tracked Lambda list: its own environment already references the aggregator's function name (to invoke it for "Refresh now"), so also having the aggregator's environment reference `fn`'s name back would create a circular CloudFormation dependency between the two resources.

---

## 6. Storage Model

A single DynamoDB table, two item shapes, distinguished by partition key:

```text
pk="CONFIG",              sk="CONFIG"        → one config row
pk="PERIOD#<day|week|month>", sk=<periodKey> → one row per period
```

Writing a snapshot is a plain upsert (PutItem) keyed by the current period's key — the previous value for that exact period is simply overwritten intraday, and a new item is created automatically once the calendar rolls over to a new day/week/month. History is a natural side effect of period keys changing over time, not a separate append-only log.

Querying `pk="PERIOD#day"` with `ScanIndexForward=false` returns day-level history newest-first for free.

This store intentionally has no checksum/immutability machinery, unlike Usage Epoch or Configuration Analytics Report storage — this is mutable, best-effort operational data, not a public-facing immutable audit record.

---

## 7. Cost Alerts

Checked once per real collection run, never on the cheap no-op ticks.

```text
for each period type (day, week, month):
    threshold configured?           no  → skip
    snapshot's total >= threshold?  no  → skip
    already alerted for this exact periodKey?  yes → skip
    else: send one email, record periodKey as alerted
```

An SES send failure is caught, logged, and does not propagate — an alert email is never allowed to fail or roll back the DynamoDB writes it is reporting on. `lastAlertedPeriodKeys` is only updated for periods whose email actually sent.

Re-arming is automatic and requires no manual reset: once a period's key changes (a new day, a new ISO week, a new month), the stored `lastAlertedPeriodKeys` value for that period type no longer matches, and the next real run that crosses the threshold again will alert.

---

## 8. API Surface

All routes are owner-only (behind the same `requireOwner()` gate as the rest of `snapshots-handler.ts`) and live in the shared SnapshotsApiHandler Lambda, not the aggregator:

```text
GET  /usage/summary       → current config + latest day/week/month snapshot
GET  /usage/history       → up to `limit` snapshots for one periodType, newest first
POST /usage/config        → set intervalDays and/or alertThresholds
                            (fields omitted from alertThresholds keep
                            their previously saved value)
POST /usage/refresh-now   → async-invoke the aggregator with { force: true };
                            fire-and-forget, the response only confirms
                            the trigger was accepted
```

---

## 9. Resource Tagging (Cost Allocation Tags Prerequisite)

Every resource in every CDK stack carries two tags, applied at the App and per-stack level in `bin/cdk.ts`:

```text
project = "tejas-profile"   (applied once, at the App level)
stage   = "dev" | "prod"    (applied per stack instance)
```

This is a prerequisite, not a feature on its own: AWS Cost Allocation Tags (Billing console) can only break cost down by tag once resources have actually been carrying that tag in billing data for a while. Tagging existed nowhere in this project before this system was built.

---

## 10. Security / IAM

```text
UsageCostAggregator role:
    ce:GetCostAndUsage        (Resource: "*" — Cost Explorer has no
                                per-resource IAM scoping)
    cloudwatch:GetMetricData  (Resource: "*" — same reason)
    ses:SendEmail             (scoped to the owner notification identity)
    dynamodb: read/write      (scoped to UsageCostMetricsTable only)

SnapshotsApiHandler (fn) additions:
    dynamodb:GetItem/PutItem/Query  (scoped to UsageCostMetricsTable)
    lambda:InvokeFunction           (scoped to the aggregator's own ARN)
```

Both grants onto `fn`'s role are combined into one dedicated `iam.Policy` construct rather than using `grantReadData()`/`grantInvoke()` directly — this codebase has an established, empirically-verified issue where CDK's `minimizePolicies` behavior can silently drop unrelated pre-existing statements when multiple separate grant calls merge into a Lambda's single auto-managed default policy. A dedicated Policy resource sidesteps that entirely.

---

## 11. DEV / PROD Isolation

DEV and PROD each have their own `UsageCostMetricsTable`, their own `UsageCostAggregator` Lambda and EventBridge schedule, and their own alert configuration. A cost/usage figure in one stage says nothing about the other.

---

## 12. Testing

```text
infra/cdk/test/usage-cost-store.test.ts        — storage layer, config defaults
infra/cdk/test/usage-cost-aggregator.test.ts   — cost bucketing, resource usage
                                                   collection, due-ness gating,
                                                   alert send/dedupe/failure paths
infra/cdk/test/usage-cost-api.test.ts          — route-level (owner gate, validation,
                                                   config merge, refresh-now invoke)
src/utils/usage/usageApi.test.js               — frontend API client
src/components/admin/Usage.test.js             — page-level UI behavior
```

---

## 13. Important Invariants

```text
a no-op tick never calls Cost Explorer or CloudWatch

force:true is the only way to bypass the configured interval

an alert email failure never blocks a data collection

at most one alert email per period per threshold, ever

fn never receives Cost Explorer or CloudWatch IAM permissions

DEV and PROD usage/cost infrastructure are fully independent stacks
```

---

## 14. Relevant Source Files

```text
infra/cdk/lambda/usage-cost-aggregator.ts
infra/cdk/lambda/usage-cost-store.ts
infra/cdk/lambda/snapshots-handler.ts
infra/cdk/lib/snapshots-stack.ts
infra/cdk/bin/cdk.ts
src/components/admin/Usage.js
src/utils/usage/usageApi.js
```

---

## 15. Related Documentation

> **[Usage Feature Guide](../sections/usage.md)**

> **[Snapshots and Profile Platform Architecture](./snapshots-architecture.md)**

> **[Analytics Architecture](./analytics-architecture.md)**

> **[Root README](../../README.md)**
