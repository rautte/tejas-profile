# Usage — Feature Guide

The Usage admin section tracks AWS resource usage and real dollar cost for the project — S3, DynamoDB, Lambda — aggregated day/week/month, refreshed on an owner-configurable schedule, with optional email alerts on cost thresholds.

For the underlying architecture, see:

> **[Usage Cost Architecture](../architecture/usage-architecture.md)**

---

## 1. Access

Usage is available only from owner/admin mode:

```text
Admin
→ Usage
```

Public visitors do not use this page.

---

## 2. Mental Model

Usage is deliberately **not real-time**. A background job collects evidence periodically; the page only ever shows the most recent collection.

```text
AWS Cost Explorer  → actual $ cost, by service, account-wide
CloudWatch metrics → resource usage for this project's own S3/DynamoDB/Lambda
        ↓
one snapshot each for day / week / month
        ↓
Usage page (reads only; never queries AWS directly)
```

Dollar cost is account-wide (Cost Explorer has no per-resource IAM scoping, and this AWS account is dedicated to this project). Resource-level usage (storage size, consumed capacity, invocations) is scoped to this stack's own S3 buckets / DynamoDB tables / Lambda functions — it does not cover the separate Assets/Frontend CDN stacks.

---

## 3. Cost KPIs and History

Three KPI cards show today's, this week's, and this month's total cost, each with a per-service cost breakdown for the month.

The History panel lets you switch between Day / Week / Month and shows up to the last 30 collected snapshots for that period type, newest first.

---

## 4. Resource Usage Cards

S3 buckets, DynamoDB tables, and Lambda functions are each shown as a **full-width card, stacked vertically** (not side-by-side) — deliberately, so long AWS resource names have room to display without truncation. Each card is capped to a fixed height showing 5 rows before it becomes independently scrollable, with a sticky header, rather than growing the whole page.

```text
S3 buckets:      size, object count
DynamoDB tables: consumed read/write capacity (24h)
Lambda functions: invocations, errors (24h)
```

---

## 5. Refresh Schedule

The owner sets how often the background aggregator actually performs a real collection:

```text
Every day / Every 2 days / Every 3 days / Weekly
```

An EventBridge schedule ticks the aggregator Lambda far more often than any of these choices (every 6 hours) — each tick is a cheap DynamoDB-only check that becomes a real Cost Explorer/CloudWatch collection only once the configured interval has actually elapsed. This keeps Cost Explorer's small per-call cost negligible regardless of how often the schedule fires.

**Refresh now** bypasses the interval and forces an immediate collection — useful right after changing the schedule or wanting fresh numbers without waiting. It is fire-and-forget: the button confirms the trigger was accepted, and the page must be reloaded afterward to see the result once it lands (the API's own response time budget is far shorter than a real Cost Explorer + CloudWatch collection can take).

---

## 6. Cost Alerts

Optional $ thresholds, one each for Day / Week / Month. Leaving a field blank disables that alert.

```text
threshold crossed on a real collection run
    ↓
one email to the owner notification address
    ↓
same period crossed again → no repeat email
    ↓
period rolls over to a new periodKey → alerting re-arms automatically
```

Alerts are only evaluated on a **real** collection run (not on the frequent no-op ticks), and a failed alert email is logged and swallowed — it can never block or roll back the underlying data collection it was alerting about.

---

## 7. Data Model

```text
UsageCostConfig {
  intervalDays: 1 | 2 | 3 | 7
  lastRunAt: ISO timestamp | null
  alertThresholdsUsd: { day, week, month: number | null }
  lastAlertedPeriodKeys: { day, week, month: string | null }
}

UsageCostSnapshot {
  periodType: "day" | "week" | "month"
  periodKey: string        (e.g. "2026-09-05", "2026-W36", "2026-09")
  collectedAt: ISO timestamp
  totalCostUsd: number
  costByService: { [serviceName]: number }
  resourceUsage: { s3: [...], dynamodb: [...], lambda: [...] }
}
```

One DynamoDB table stores both shapes: `pk="CONFIG"` for the single config row, `pk="PERIOD#<type>"` / `sk=<periodKey>` for snapshots — querying `pk="PERIOD#day"` newest-first gives day-level history for free, with no separate history table.

---

## 8. DEV vs PROD

DEV and PROD each have their own independent Usage Cost table, aggregator schedule, and alert configuration. Cost/usage numbers shown in DEV reflect DEV's own AWS resources, not PROD's.

---

## 9. How to Modify

```text
Frontend page:        src/components/admin/Usage.js
API client:            src/utils/usage/usageApi.js
Backend routes:        infra/cdk/lambda/snapshots-handler.ts
                        (GET /usage/summary, GET /usage/history,
                         POST /usage/config, POST /usage/refresh-now)
Aggregation logic:      infra/cdk/lambda/usage-cost-aggregator.ts
Storage:                infra/cdk/lambda/usage-cost-store.ts
CDK wiring:             infra/cdk/lib/snapshots-stack.ts
                        (UsageCostMetricsTable, UsageCostAggregator,
                         UsageCostAggregatorSchedule)
Manual repository sync: npm run profile:sync-repository[:dev]
```

---

## 10. Troubleshooting

```text
All KPIs show "—"
    → the aggregator has never run yet in this environment;
      click "Refresh now" and reload after a minute.

Cost total looks account-wide, not project-scoped
    → expected — Cost Explorer has no per-resource IAM scoping.
      Activating AWS Cost Allocation Tags (Billing console) lets
      cost be broken down by the "project"/"stage" tags every
      resource in this stack now carries.

Resource usage missing for a bucket/table/function
    → only resources belonging to SnapshotsStack are tracked;
      Assets/Frontend CDN stack resources are out of scope.
```

---

## 11. Important Invariants

```text
Usage data is a periodic snapshot, never a live query

a cheap no-op tick != a real collection run

alerts are evaluated only on a real collection run

an alert email failure never blocks or rolls back the
collection that triggered it

at most one alert email per period per threshold

DEV and PROD usage/cost state are fully independent
```

---

## 12. Relevant Source Files

Frontend:

```text
src/components/admin/Usage.js
src/utils/usage/usageApi.js
```

Backend:

```text
infra/cdk/lambda/usage-cost-aggregator.ts
infra/cdk/lambda/usage-cost-store.ts
infra/cdk/lambda/snapshots-handler.ts
infra/cdk/lib/snapshots-stack.ts
```

---

## 13. Related Documentation

> **[Usage Cost Architecture](../architecture/usage-architecture.md)**

> **[Analytics Feature Guide](./analytics.md)**

> **[Root README](../../README.md)**
