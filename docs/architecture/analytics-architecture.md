# Analytics Architecture

This document describes how Tejas Profile Analytics is engineered.

For dashboard usage and metric semantics, see:

> **[Analytics Feature Guide](../sections/analytics.md)**

For deployment procedures, see:

> **[Root README](../../README.md)**

## Current Formal Runtime and Archive Layer

The Analytics architecture now contains two related models.

### Live analytics

The existing daily/session-fragment model remains the mutable owner analytics surface.

It retains compatibility dimensions including:

```text
legacy profileVersion
deployment/reset boundaries
session intelligence
journey information
```

Sections later in this document that describe `PV#<profileVersion>` and release boundaries refer to this Live/compatibility model.

### Exact configuration archive

New events are also attributed server-side to the exact active Usage Epoch.

The browser does not choose or submit a trusted Usage Epoch identity.

Conceptually:

```text
formal runtime identity
    ↓
Deployment Configuration
    ↓
OPEN Usage Epoch
    ↓
append-only exact epoch projection
    ↓
CLOSING
    ↓
settlement window
    ↓
immutable Configuration Analytics Report
    ↓
CLOSED
```

The immutable report is keyed to one Usage Epoch and therefore one exact formal composition.

Formal runtime dimensions include:

```text
profileVariantId
platformReleaseId
deploymentConfigurationId
```

Usage Epoch is deliberately separate from Deployment Configuration because the same configuration can become active again during a later independent interval.

Raw Analytics S3 remains short-term diagnostic storage and is not the authoritative source used to reconstruct exact historical reports.

The immutable Configuration Analytics archive is owner/admin-only.

---

<a id="index"></a>

# Index

- [1. Goals](#goals)
- [2. Non-Goals](#non-goals)
- [3. High-Level Architecture](#high-level)
- [4. Public Ingestion Flow](#public-ingestion)
- [5. Owner/Admin Query Flow](#owner-query)
- [6. Event Model](#event-model)
- [7. Frontend Tracking Model](#frontend-tracking)
- [8. Session Model](#session-model)
- [9. Cross-Tab Session Sharing](#cross-tab)
- [10. Active-Time Tracking](#active-time)
- [11. Event Batching](#batching)
- [12. Idempotency and Deduplication](#deduplication)
- [13. Anonymous Visitor Identity](#visitor-identity)
- [14. Returning Visitors](#returning-visitors)
- [15. DynamoDB Aggregation Model](#dynamodb)
- [16. Exact Unique Calculations](#exact-uniques)
- [17. Raw S3 Storage](#raw-storage)
- [18. Journey / Session Intelligence](#journeys)
- [19. Geography](#geography)
- [20. Edge Trust Model](#edge-trust)
- [21. Privacy](#privacy)
- [22. Analytics Boundaries](#boundaries)
- [23. Releases](#releases)
- [24. Reset Semantics](#reset)
- [25. Hard Purge](#hard-purge)
- [26. DEV / PROD Isolation](#dev-prod)
- [27. Deployment Integration](#deployment)
- [28. Smoke Testing](#smoke-testing)
- [29. Scaling Model](#scaling)
- [30. Failure and Retry Behavior](#failure-retry)
- [31. Security Model](#security)
- [32. Data Retention](#retention)
- [33. Source Files](#source-files)
- [34. Tests](#tests)
- [35. Important Architecture Invariants](#invariants)
- [36. Related Documentation](#related)

---

<a id="goals"></a>

# 1. Goals

The Analytics system was designed to provide production-grade portfolio analytics without introducing a heavyweight external analytics platform.

Primary goals:

```text
Exact anonymous unique visitors

Sessions tracked separately from visitors

Returning visitor analytics

Active engagement time

Section reach and funnel

CTA/project/code engagement

Deep-link analytics

Country/city aggregation

Release-aware analytics

Reset/baseline-aware analytics

Anonymous session journeys

Owner-only dashboard

DEV/PROD separation

Low operational cost

Privacy-conscious raw data
```

Expected traffic is relatively modest:

```text
≤ ~50k unique sessions / year

target ≤ ~100 analytics events / session
```

The architecture therefore prioritizes:

```text
correctness
simplicity
privacy
low cost
operational clarity
```

over unnecessary distributed-system complexity.

[Back to Index](#index)

---

<a id="non-goals"></a>

# 2. Non-Goals

The system is not intended to be:

```text
a full Google Analytics replacement

a precise identity system

an advertising tracker

a GPS location tracker

a high-frequency mouse recorder

a session replay/video system

an unlimited raw-event warehouse

a cross-device personal identity platform
```

It is intentionally scoped to useful portfolio engagement analytics.

[Back to Index](#index)

---

<a id="high-level"></a>

# 3. High-Level Architecture

Public ingestion:

```text
Public Browser
      ↓
Frontend Analytics Tracker
      ↓
CloudFront Analytics Edge
      ↓
API Gateway
      ↓
POST /analytics/ingest
      ↓
Analytics Lambda
      ↓
 ┌─────────────────────┐
 │                     │
 ▼                     ▼
DynamoDB             S3
Aggregates        Raw Batches
```

Owner query/control:

```text
Owner/Admin Browser
      ↓
Direct API Gateway
      ↓
Analytics Lambda
      ↓
DynamoDB
```

Production and development use separate stacks/resources.

[Back to Index](#index)

---

<a id="public-ingestion"></a>

# 4. Public Ingestion Flow

Public visitor events use:

```text
REACT_APP_ANALYTICS_INGEST_API
```

This resolves to the Analytics CloudFront edge.

Flow:

```text
Browser
   ↓
CloudFront
   ↓
trusted edge headers added
   ↓
API Gateway
   ↓
Analytics Lambda
```

Why use an edge?

```text
trusted coarse geographic metadata

separation between public ingestion and owner APIs

ability to validate edge-originated metadata

clean public runtime endpoint
```

Public visitors do not need owner credentials.

[Back to Index](#index)

---

<a id="owner-query"></a>

# 5. Owner/Admin Query Flow

Owner/Admin Analytics uses:

```text
REACT_APP_SNAPSHOTS_API
```

and goes directly to API Gateway.

Conceptually:

```text
Admin UI
   ↓
API Gateway
   ↓
Analytics Lambda
```

Owner routes include capabilities such as:

```text
analytics query
analytics metadata
boundary creation
release metadata
snapshot APIs
```

This separation avoids routing privileged owner controls through the public ingestion path.

[Back to Index](#index)

---

<a id="event-model"></a>

# 6. Event Model

The frontend tracker uses an allowlisted event model.

Supported event types include:

```text
session_start

section_view

section_time

scroll_depth

cta_click

deep_link

project_open

code_snippet_view
```

This is intentionally preferable to accepting arbitrary frontend events.

Benefits:

```text
stable schema

controlled storage growth

predictable aggregation

easier privacy review

simpler dashboard semantics
```

[Back to Index](#index)

---

<a id="frontend-tracking"></a>

# 7. Frontend Tracking Model

Important frontend components include:

```text
tracker.js
session.js
exclusion.js
analyticsApi.js
```

Tracking behavior includes:

```text
event allowlisting

stable event IDs

batched delivery

queue limits

important-event immediate flush

cross-tab session identity

section tracking

active-time tracking

coarse scroll milestones

CTA registry

deep-link initial-entry tracking
```

The tracker intentionally avoids emitting unlimited high-frequency events.

## Navigation-Safe Interaction Delivery

Ordinary Analytics delivery uses `fetch()` with `keepalive: true`.

Navigation-sensitive interactions additionally use `navigator.sendBeacon()` as a best-effort synchronous delivery path before a browser context may be suspended.

This is particularly important for:

```text
target="_blank"
downloads
mobile browser tab switching
external navigation
```

[Back to Index](#index)

---

<a id="session-model"></a>

# 8. Session Model

A session is a logical browsing visit.

Current inactivity model:

```text
approximately 30 minutes
```

Meaningful visitor activity refreshes session activity.

A session is not equivalent to:

```text
browser tab
```

This distinction is essential because one person can open multiple tabs during the same visit.

[Back to Index](#index)

---

<a id="cross-tab"></a>

# 9. Cross-Tab Session Sharing

Session state is shared through browser storage so multiple tabs can participate in one logical session.

Without this:

```text
Tab A = session 1
Tab B = session 2
Tab C = session 3
```

which would artificially inflate session counts.

With shared session identity:

```text
Tab A
Tab B
Tab C
   ↓
same logical session
```

[Back to Index](#index)

---

<a id="active-time"></a>

# 10. Active-Time Tracking

The tracker is designed to measure meaningful engagement rather than wall-clock time.

Activity behavior considers page conditions such as:

```text
visible
focused
active
```

Heartbeat behavior is intentionally controlled rather than high-frequency.

The implementation uses periodic active tracking and activity throttling.

This prevents:

```text
background tab open for 2 hours
```

from being interpreted as:

```text
2 hours of meaningful portfolio engagement
```

[Back to Index](#index)

---

<a id="batching"></a>

# 11. Event Batching

Events are queued client-side before ingestion.

The tracker uses bounded batching rather than one HTTP request for every event.

Important design characteristics include:

```text
bounded queue

batch flush

periodic flush

immediate flush for important events
```

This reduces:

```text
network overhead

API request count

Lambda invocation pressure
```

while still preserving important interactions.

[Back to Index](#index)

---

<a id="deduplication"></a>

# 12. Idempotency and Deduplication

Events have stable IDs.

The backend tracks processed event IDs within aggregation fragments.

If the client retries the same batch:

```text
first request
→ accepted

retry
→ duplicate IDs detected
→ aggregate not double-counted
```

This is critical because HTTP retries are normal.

Without deduplication:

```text
network retry
→ duplicate analytics
→ incorrect metrics
```

The design therefore favors idempotent ingestion.

[Back to Index](#index)

---

<a id="visitor-identity"></a>

# 13. Anonymous Visitor Identity

The browser maintains an anonymous visitor identity.

The backend does not expose/store that raw browser identity in dashboard aggregates.

Instead, the server produces anonymous hashes such as:

```text
visitorHash

sessionHash
```

The purpose is:

```text
exact anonymous counting
```

without building a personal identity database.

[Back to Index](#index)

---

<a id="returning-visitors"></a>

# 14. Returning Visitors

Returning visitor analytics uses server-side visitor history.

This allows the backend to distinguish:

```text
first observed visitor
```

from:

```text
visitor seen previously
```

This is more reliable than trying to infer returning users only from the currently selected range.

[Back to Index](#index)

---

<a id="dynamodb"></a>

# 15. DynamoDB Aggregation Model

Analytics aggregates are stored in DynamoDB.

The high-level partitioning model uses daily partitions.

Conceptually:

```text
PK:
DAY#YYYY-MM-DD
```

Session aggregation fragments additionally contain dimensions including:

```text
profile version

session hash

boundary
```

Conceptual key shape:

```text
DAY#<date>

PV#<profileVersion>
#SESSION#<sessionHash>
#BOUNDARY#<boundaryId>
```

when a boundary applies.

A fragment represents approximately:

```text
one logical session
× one day
× one release
× one boundary classification
```

This provides a useful balance between:

```text
exactness
queryability
write simplicity
```

[Back to Index](#index)

---

<a id="exact-uniques"></a>

# 16. Exact Unique Calculations

Daily unique counts cannot simply be summed.

Example:

```text
Monday:
Visitor A

Tuesday:
Visitor A
```

Naively summing daily uniques would produce:

```text
2
```

but true range unique visitors is:

```text
1
```

The query layer therefore unions anonymous visitor/session hashes across the selected daily fragments.

This provides exact range-level:

```text
unique visitors
sessions
```

for the selected query rather than approximate addition of daily totals.

[Back to Index](#index)

---

<a id="raw-storage"></a>

# 17. Raw S3 Storage

Accepted analytics batches are also persisted into S3 under the Analytics raw-event area.

Purpose:

```text
short-term debugging

auditability

future reprocessing if necessary

operational diagnosis
```

The raw schema has been privacy-hardened.

New raw storage does not retain direct raw fields such as:

```text
IP address
User-Agent
raw visitor ID
raw session ID
raw tab ID
```

[Back to Index](#index)

---

<a id="journeys"></a>

# 18. Journey / Session Intelligence

Session fragments can retain a bounded representation of ordered journey events.

The goal is useful path intelligence such as:

```text
About Me
→ Experience
→ Projects
→ CTA
```

without retaining an unlimited event replay.

The model is bounded.

If the journey exceeds the configured representation:

```text
journeyTruncated
```

can indicate that the stored journey is partial.

This keeps storage predictable.

[Back to Index](#index)

---

<a id="geography"></a>

# 19. Geography

Visitor country/city metadata is derived from CloudFront viewer geography.

No browser GPS is required.

This allows the system to aggregate:

```text
country
city
```

with low operational overhead.

Because geographic metadata comes from the public edge rather than the browser directly, the backend can distinguish trusted edge information from arbitrary client-provided values.

[Back to Index](#index)

---

<a id="edge-trust"></a>

# 20. Edge Trust Model

CloudFront injects an opaque Analytics edge token/header.

The Analytics Lambda trusts viewer geographic metadata only when the edge trust condition is satisfied.

Conceptually:

```text
CloudFront request
+
correct edge trust token
→ viewer geo trusted
```

Direct ingestion attempt:

```text
client supplies fake geo headers
without trusted edge proof
→ geo not trusted
```

This prevents trivial geographic spoofing.

[Back to Index](#index)

---

<a id="privacy"></a>

# 21. Privacy

Privacy decisions include:

```text
anonymous visitor identity

hashed visitor/session IDs

no raw IP in new raw storage

no raw User-Agent in new raw storage

no raw visitor/session/tab IDs in new raw storage

no GPS tracking

bounded journeys

limited raw retention

owner exclusion
```

The system is intended to understand portfolio usage, not identify individual people.

[Back to Index](#index)

---

<a id="boundaries"></a>

# 22. Analytics Boundaries

Boundaries divide Analytics history into meaningful logical eras.

Supported conceptual types include:

```text
RESET

DEPLOY
```

A boundary has metadata including:

```text
boundaryId

type

effectiveAt

optional profileVersionId

optional Git SHA/build metadata

note
```

Events are classified against the applicable boundary based on event time.

[Back to Index](#index)

---

<a id="releases"></a>

# 23. Releases

Release metadata maps Analytics to deployed profile versions.

Example:

```text
profileVersionId:
pv_c341be8
```

A successful deployment boundary also establishes/reconciles the associated release metadata.

Important behavior:

```text
first release timestamp is preserved
```

rather than being overwritten every time the same profile version is redeployed.

This makes the release catalogue stable.

[Back to Index](#index)

---

<a id="reset"></a>

# 24. Reset Semantics

Normal Reset is non-destructive.

Flow:

```text
Owner clicks Reset
      ↓
new RESET boundary
      ↓
dashboard selects new baseline
      ↓
new traffic classified after boundary
```

Old data remains.

This enables:

```text
fresh operational baseline

while preserving historical analysis
```

[Back to Index](#index)

---

<a id="hard-purge"></a>

# 25. Hard Purge

Hard purge exists separately for destructive maintenance.

Script:

```text
infra/cdk/scripts/purge-analytics.mjs
```

Safety characteristics include:

```text
discover exact Analytics Lambda

discover backing table/bucket

verify stage

dry-run mode

stage-specific confirmation

batched DynamoDB deletion

batched S3 deletion

post-delete verification
```

Hard purge should not be confused with dashboard Reset.

[Back to Index](#index)

---

<a id="dev-prod"></a>

# 26. DEV / PROD Isolation

Separate infrastructure exists for:

```text
DEV

PROD
```

This prevents local/development traffic from contaminating production data.

Conceptually:

```text
DEV frontend
→ DEV API/edge/table/S3

PROD frontend
→ PROD API/edge/table/S3
```

Infrastructure deployment is also separated:

```text
successful CI
→ automatic DEV

manual explicit operation
→ PROD
```

[Back to Index](#index)

---

<a id="deployment"></a>

# 27. Deployment Integration

PROD frontend deployment resolves the runtime Analytics endpoints from CloudFormation.

Frontend variables include:

```text
REACT_APP_SNAPSHOTS_API

REACT_APP_ANALYTICS_INGEST_API

REACT_APP_PROFILE_VERSION

REACT_APP_GIT_SHA

REACT_APP_BUILD_TIME
```

The public ingestion API comes from the Analytics CloudFront edge.

The owner API comes from the direct API Gateway/Snapshots stack output.

---

## Release Boundary Timing

The deployment boundary is registered only after:

```text
GitHub Pages deployment succeeds
```

This ordering is important.

Incorrect:

```text
register release
↓
Pages deployment fails
```

would create a release that never actually became live.

Correct:

```text
Pages deployment succeeds
↓
register deploy boundary
↓
release becomes Analytics-visible
```

[Back to Index](#index)

---

<a id="smoke-testing"></a>

# 28. Smoke Testing

Automatic DEV deployment runs:

```text
infra/cdk/scripts/smoke-analytics.mjs
```

The smoke test verifies important integration paths including:

```text
public Analytics edge ingestion

owner Analytics query

owner exclusion behavior
```

This runs after DEV infrastructure deployment.

The goal is to catch integration failures that unit tests alone cannot detect.

[Back to Index](#index)

---

<a id="scaling"></a>

# 29. Scaling Model

Expected scale is moderate.

Target assumptions:

```text
≤ ~50k unique sessions/year

~50 events/session typical

≤ ~100 events/session target
```

The architecture uses:

```text
CloudFront
API Gateway
Lambda
DynamoDB
S3
```

which provides substantial automatic scaling for this traffic level.

The design intentionally avoids introducing unnecessary infrastructure such as:

```text
Kafka
Flink
large streaming clusters
dedicated analytics warehouse
```

because current scale does not justify that operational complexity.

[Back to Index](#index)

---

<a id="failure-retry"></a>

# 30. Failure and Retry Behavior

The system is designed around normal distributed-system retry behavior.

Examples:

```text
browser sends batch
network response fails
browser retries
```

Event IDs make retries safe.

Deployment boundary registration is also designed for idempotent retry.

A workflow can re-use the same boundary identity and stored effective timestamp if a partial failure occurred.

This prevents retrying a deployment workflow from creating multiple logically different release boundaries.

[Back to Index](#index)

---

<a id="security"></a>

# 31. Security Model

Public ingestion:

```text
does not require owner authentication
```

because normal visitors need to emit analytics.

Owner operations:

```text
require owner authorization
```

The Analytics edge has a trust relationship used for trusted geo metadata.

Important security principles:

```text
do not embed owner secret in frontend

do not trust arbitrary client geo headers

keep owner APIs separate from public ingest path

use stage isolation

use least-privilege IAM where practical
```

[Back to Index](#index)

---

<a id="retention"></a>

# 32. Data Retention

Raw Analytics batches:

```text
30-day retention target
```

Aggregates can remain longer.

This provides:

```text
short raw operational window

long useful analytics history
```

without indefinite raw-event retention.

[Back to Index](#index)

---

<a id="source-files"></a>

# 33. Source Files

## Frontend

```text
src/components/admin/Analytics.js

src/utils/analytics/analyticsApi.js

src/utils/analytics/analyticsApi.test.js

src/utils/analytics/tracker.js

src/utils/analytics/session.js

src/utils/analytics/exclusion.js

src/config/owner.js

src/App.js
```

---

## Backend / Infrastructure

```text
infra/cdk/lambda/analytics-handler.ts

infra/cdk/lib/snapshots-stack.ts

infra/cdk/bin/cdk.ts
```

---

## Operational Scripts

```text
infra/cdk/scripts/smoke-analytics.mjs

infra/cdk/scripts/purge-analytics.mjs
```

---

## Deployment

```text
.github/workflows/ci.yml

.github/workflows/infra-deploy.yml

.github/workflows/deploy.yml
```

[Back to Index](#index)

---

<a id="tests"></a>

# 34. Tests

Frontend Analytics API tests:

```text
src/utils/analytics/analyticsApi.test.js
```

Backend Analytics tests:

```text
infra/cdk/test/analytics-handler.test.ts
```

Infrastructure tests:

```text
infra/cdk/test/snapshots-stack.test.ts
```

Current deterministic project suite at the known-good baseline:

```text
Frontend tests:                6

Infrastructure/backend tests: 25

Total:                        31
```

Additionally:

```text
DEV Analytics smoke test
```

provides deployed integration verification.

[Back to Index](#index)

---

<a id="invariants"></a>

# 35. Important Architecture Invariants

Unless intentionally redesigning Analytics, preserve:

```text
1. Public ingestion goes through the Analytics edge.

2. Owner query/control uses the direct owner API.

3. DEV and PROD remain isolated.

4. Owner browsing remains excluded.

5. Raw IP/User-Agent/client IDs remain excluded from new raw storage.

6. Anonymous visitor/session identity remains hashed server-side.

7. Cross-tab activity remains one logical session.

8. Session inactivity remains intentional and explicit.

9. Event types remain allowlisted.

10. High-frequency mouse/scroll tracking remains avoided.

11. Event ingestion remains idempotent.

12. Exact range unique visitors remain exact.

13. Exact range sessions remain exact.

14. Reset remains non-destructive by default.

15. Deployment does not delete Analytics history.

16. Release filtering remains independent of Period.

17. Boundary filtering remains independent of Release.

18. Deploy boundaries are registered only after successful Pages deployment.

19. Release registration remains retry-safe/idempotent.

20. Hard purge remains explicit and fail-closed.
```

[Back to Index](#index)

---

<a id="related"></a>

# 36. Related Documentation

Feature/user semantics:

> **[Analytics Feature Guide](../sections/analytics.md)**

Documentation index:

> **[Documentation Home](../README.md)**

Repository operation/deployment:

> **[Root README](../../README.md)**

[Back to Index](#index)
