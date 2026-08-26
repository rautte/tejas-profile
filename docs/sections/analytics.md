# Analytics — Feature Guide

This document explains the **Analytics admin section from a product/user perspective**.

For backend/system architecture, see:

> **[Analytics Architecture](../architecture/analytics-architecture.md)**

For deployment and release procedures, see:

> **[Root README](../../README.md)**

## Current Identity and Archive Model

Analytics currently has two owner-facing modes:

```text
Live analytics
Historical archive
```

Live analytics retains the existing mutable date/range, reset-boundary, session/journey, and legacy `profileVersion` release dimensions.

Historical archive is different.

It represents one exact closed Usage Epoch for one formal Deployment Configuration:

```text
Profile Variant
    +
Platform Release
    ↓
Deployment Configuration
    ↓
Usage Epoch
    ↓
immutable Configuration Analytics Report
```

For new formal runtime events, Analytics identity is based on:

```text
profileVariantId
platformReleaseId
deploymentConfigurationId
```

A legacy value such as:

```text
pv_c341be8
```

remains a valid Live-analytics compatibility/release dimension.

It must not be interpreted as a Profile Variant identity.

Historical archive intentionally excludes session-fragment counters, raw journeys, and recent-session intelligence.

---

<a id="index"></a>

# Index

- [1. Overview](#overview)
- [2. Purpose](#purpose)
- [3. Access and Owner Mode](#access)
- [4. Dashboard Mental Model](#mental-model)
- [5. Main Filters](#filters)
  - [Period](#period)
  - [From](#from)
  - [Release](#release)
  - [Compare](#compare)
- [6. KPI Metrics](#kpis)
  - [Unique Visitors](#unique-visitors)
  - [Sessions](#sessions)
  - [New Visitors](#new-visitors)
  - [Returning Visitors](#returning-visitors)
  - [Active Time](#active-time)
- [7. Section Analytics](#section-analytics)
  - [Section Reach](#section-reach)
  - [Section Funnel](#section-funnel)
  - [Active Time by Section](#section-active-time)
- [8. Engagement Analytics](#engagement)
  - [CTA Clicks](#cta-clicks)
  - [Deep Links](#deep-links)
  - [Project Opens](#project-opens)
  - [Code Snippet Views](#code-snippets)
- [9. Geography](#geography)
  - [Countries](#countries)
  - [Cities](#cities)
- [10. Session / Journey Explorer](#session-explorer)
- [11. Release Analytics](#release-analytics)
- [12. Analytics Boundaries](#boundaries)
  - [Reset Boundaries](#reset-boundaries)
  - [Deploy Boundaries](#deploy-boundaries)
- [13. Reset — What It Actually Does](#reset)
- [14. Hard Purge](#hard-purge)
- [15. Visitor and Session Semantics](#visitor-session)
- [16. Tracked Events](#tracked-events)
- [17. Privacy Model](#privacy)
- [18. Owner Traffic Exclusion](#owner-exclusion)
- [19. Data Retention](#retention)
- [20. DEV vs PROD](#dev-prod)
- [21. Common Analytics Questions](#common-questions)
- [22. How to Modify Analytics Safely](#modify)
- [23. Relevant Source Files](#source-files)
- [24. Important Invariants](#invariants)
- [25. Troubleshooting](#troubleshooting)
- [26. Related Documentation](#related)

---

<a id="overview"></a>

# 1. Overview

Analytics is an **owner/admin-only dashboard** used to understand how visitors interact with the public portfolio.

The system is designed to answer questions such as:

```text
How many anonymous visitors viewed the profile?

How many sessions occurred?

How many visitors came back?

Which sections are actually being reached?

Where are people spending active time?

Which CTAs are being clicked?

Which projects attract attention?

Are visitors landing directly on deep links?

Which countries/cities generate traffic?

How does engagement differ between releases?

What happened after a reset or deployment boundary?
```

Analytics is intentionally designed as a real backend analytics system rather than relying on browser-local statistics.

[Back to Index](#index)

---

<a id="purpose"></a>

# 2. Purpose

The Analytics dashboard has three primary purposes.

## Understand overall traffic

Examples:

```text
Unique Visitors
Sessions
New Visitors
Returning Visitors
```

---

## Understand profile engagement

Examples:

```text
Section Reach
Section Funnel
Active Time
CTA Clicks
Project Opens
Code Snippet Views
Deep-Link Landings
```

---

## Understand changes across releases

Examples:

```text
Did the new Projects design improve engagement?

Did a deployment change section reach?

What happened after I reset my analytics baseline?

How does pv_c341be8 compare with another profile version?
```

The release-aware design is important because traffic from significantly different versions of the profile should not always be mixed together.

[Back to Index](#index)

---

<a id="access"></a>

# 3. Access and Owner Mode

Analytics is an **admin/owner feature**.

Normal public visitors should not see the Analytics dashboard.

Owner-only operations use the direct backend API.

Public analytics ingestion uses a separate public edge path.

Conceptually:

```text
PUBLIC VISITOR
Browser
→ Analytics ingestion edge
→ backend


OWNER
Admin Analytics
→ direct owner API
→ backend
```

Owner Mode also participates in traffic exclusion so normal owner browsing does not contaminate portfolio analytics.

[Back to Index](#index)

---

<a id="mental-model"></a>

# 4. Dashboard Mental Model

The most important thing to understand is that Analytics has multiple independent dimensions.

The main dimensions are:

```text
WHEN?
→ Period

FROM WHICH LOGICAL BASELINE?
→ From

WHICH APPLICATION VERSION?
→ Release

COMPARE AGAINST WHAT?
→ Compare
```

These controls are intentionally independent.

For example:

```text
Period:
Last 30 days

From:
Latest Reset

Release:
pv_c341be8
```

means:

> Show data from the selected 30-day period, but only after the chosen reset boundary, and only for traffic attributed to profile version `pv_c341be8`.

This is much more powerful than a simple date-range analytics dashboard.

[Back to Index](#index)

---

<a id="filters"></a>

# 5. Main Filters

<a id="period"></a>

## Period

**Period answers:**

> During what date/time range do I want to analyze traffic?

Typical uses include:

```text
recent traffic
weekly traffic
monthly traffic
custom date range
all available history
```

Examples:

```text
Last 7 days
Last 30 days
Custom Start / End
All History
```

### Utility

Use Period when asking:

```text
How much traffic did I get this week?

What happened during the last month?

How did visitors behave around a specific event?
```

Period is primarily a **time-window control**.

---

<a id="from"></a>

## From

**From answers:**

> Which logical Analytics boundary should be considered the beginning of the dataset?

Possible conceptual choices include:

```text
All History

Reset boundary

Deployment boundary
```

The dashboard defaults toward the most useful recent baseline behavior, including the latest Reset when appropriate.

### Why From exists

Suppose your site has existed for months, but today you substantially redesign the portfolio.

You may not want your current analysis mixed with months of old behavior.

A boundary gives you a logical point such as:

```text
FROM:
Portfolio Redesign Reset
```

or:

```text
FROM:
Deployment of a particular release
```

### Period vs From

These are different.

```text
Period
= WHEN should data be considered?

From
= AFTER WHICH LOGICAL BOUNDARY should data be considered?
```

Example:

```text
Period:
Last 30 days

From:
Latest Reset
```

If the reset happened 10 days ago, only the portion after that reset is relevant even though the Period itself is 30 days.

---

<a id="release"></a>

## Release

**Release answers:**

> Which profile/application version generated the traffic?

Examples:

```text
All Releases

pv_c341be8

pv_<another-version>
```

The release catalogue is global rather than being restricted only to releases that happen to appear inside the currently selected Period.

### Utility

Use Release when asking:

```text
How did a particular version perform?

Did engagement improve after a redesign?

Was a drop in CTA usage associated with one release?

How does the current release compare with older releases?
```

### Period vs From vs Release

A useful mental model:

```text
Period
= WHEN?

From
= AFTER WHICH LOGICAL BASELINE?

Release
= WHICH APP VERSION?
```

These should not be treated as interchangeable controls.

---

<a id="compare"></a>

## Compare

Compare mode is used to evaluate the currently selected analytics range against another compatible range.

The comparison logic preserves the relevant logical boundary behavior so the comparison does not accidentally cross incompatible baseline semantics.

Use Compare for questions such as:

```text
Did traffic increase?

Did returning visitors improve?

Did visitors spend more active time?

Did Projects engagement improve?

Did a release change the section funnel?
```

Compare should be interpreted as a **relative trend tool**, not as a replacement for selecting the correct Period / From / Release first.

[Back to Index](#index)

---

<a id="kpis"></a>

# 6. KPI Metrics

<a id="unique-visitors"></a>

## Unique Visitors

Unique Visitors represents distinct anonymous visitors in the selected query.

The system uses anonymous server-side visitor identity rather than counting every event or session as a visitor.

A person can generate:

```text
many events
multiple section views
multiple sessions
```

while still representing a single anonymous visitor.

The analytics aggregation is designed to calculate exact unique visitor counts across the selected date range rather than simply adding daily unique totals together.

### Utility

Use this to answer:

```text
How many different people visited?
```

rather than:

```text
How many visits happened?
```

---

<a id="sessions"></a>

## Sessions

Sessions represents distinct anonymous browsing sessions.

A visitor can have multiple sessions.

For example:

```text
Visitor A
  Monday session
  Thursday session
  Saturday session
```

means:

```text
Unique Visitors = 1
Sessions = 3
```

### Utility

Sessions is useful for understanding repeat usage frequency.

---

<a id="new-visitors"></a>

## New Visitors

A New Visitor is an anonymous visitor whose identity has not previously been observed by the server-side returning-visitor model before the relevant first-seen point.

This is different from:

```text
new session
```

A returning person opening a new session is not necessarily a new visitor.

### Utility

Use New Visitors to understand acquisition.

---

<a id="returning-visitors"></a>

## Returning Visitors

Returning Visitors identifies anonymous visitors that have been seen previously.

The returning-visitor system uses a backend registry rather than relying only on a temporary browser-session count.

### Utility

Use this to understand whether visitors return to the portfolio rather than viewing it only once.

---

<a id="active-time"></a>

## Active Time

Active Time is designed to represent meaningful user engagement rather than simply:

```text
page open duration
```

The tracker considers active/visible interaction behavior and sends controlled activity information.

This avoids treating a browser tab that was left open in the background for an hour as an hour of meaningful engagement.

### Utility

Active Time answers:

```text
Where are visitors actually spending attention?
```

rather than:

```text
How long was the browser tab technically open?
```

[Back to Index](#index)

---

<a id="section-analytics"></a>

# 7. Section Analytics

The system uses the canonical public profile section order rather than mixing admin sections into the public visitor funnel.

Public sections include the normal public profile experience.

---

<a id="section-reach"></a>

## Section Reach

Section Reach represents how much of the audience reached each section.

This helps answer:

```text
Do visitors actually make it to Projects?

How many visitors reach Experience?

Does engagement drop before Timeline?

Which sections are frequently skipped?
```

Reach is especially useful for a long single-page profile where simply knowing that the home page loaded is not enough.

---

<a id="section-funnel"></a>

## Section Funnel

The funnel analyzes progression through the canonical public section order.

Conceptually:

```text
About Me
   ↓
Experience
   ↓
Skills
   ↓
Education
   ↓
Resume
   ↓
Projects
   ↓
Code Lab
   ↓
Fun Zone
   ↓
Timeline
```

It helps identify where visitors stop progressing.

### Utility

For example:

```text
100 visitors reach About Me
80 reach Experience
65 reach Skills
30 reach Projects
```

This can reveal whether:

```text
the page is too long

an earlier section is losing attention

important content is positioned too far down
```

---

<a id="section-active-time"></a>

## Active Time by Section

This shows where visitors spend meaningful active time.

A section can have:

```text
high reach
low active time
```

meaning many visitors see it but do not engage deeply.

Another section can have:

```text
lower reach
high active time
```

meaning fewer visitors reach it, but those who do spend significant attention there.

Combining Reach + Active Time gives a much more useful picture than either metric alone.

[Back to Index](#index)

---

<a id="engagement"></a>

# 8. Engagement Analytics

<a id="cta-clicks"></a>

## CTA Clicks

CTA events represent deliberate calls-to-action.

The frontend uses stable analytics identifiers rather than relying only on arbitrary text labels.

Examples may include:

```text
Resume actions
external links
contact actions
project CTAs
navigation actions
```

### Utility

CTA metrics answer:

```text
Which actions are visitors actually taking?
```

### Project CTA Tracking

Rendered project actions are tracked at two levels:

```text
CTA
→ what action was selected?

Project interaction
→ which project was selected?
```

### Fun Zone CTA Tracking

Each Fun Zone game tracks all three visible actions independently:

```text
Minesweeper
  Code
  GitHub
  Play

Battleship
  Code
  GitHub
  Play

Tic-Tac-Toe
  Code
  GitHub
  Play

---

<a id="deep-links"></a>

## Deep Links

A Deep Link represents a visitor landing directly into a specific routed/hash-linked area of the profile.

The initial landing is treated differently from ordinary later navigation so analytics does not incorrectly count every internal hash change as a new deep-link landing.

### Utility

Useful for understanding whether people arrive through:

```text
shared project links
specific section links
external referrals to a section
```

### Nested Fun Zone Deep Links

Direct entry at a nested game URL is tracked as a deep-link landing:

```text
#/fun-zone/minesweeper
#/fun-zone/tictactoe
#/fun-zone/battleship

---

<a id="project-opens"></a>

## Project Opens

Project engagement tracks which project content visitors deliberately open/interact with.

### Utility

Use this to understand:

```text
Which projects attract the most interest?

Which project cards are being ignored?

Does changing project ordering affect engagement?
```

---

<a id="code-snippets"></a>

## Code Snippet Views

Code Lab / snippet interactions can be tracked independently.

### Utility

This helps distinguish:

```text
general portfolio browsing
```

from:

```text
technical/code-specific interest
```

[Back to Index](#index)

---

<a id="geography"></a>

# 9. Geography

Analytics supports anonymous coarse geographic metadata.

It does **not** use browser GPS.

Geographic information is derived at the trusted public ingestion edge.

---

<a id="countries"></a>

## Countries

Country analytics helps answer:

```text
Which countries generate traffic?

Is the portfolio reaching the intended job market?

Did international traffic change after sharing the profile?
```

---

<a id="cities"></a>

## Cities

City analytics provides a more detailed but still coarse location breakdown where edge metadata is available.

It should be interpreted as approximate network-derived geography, not precise user location.

### Important

Analytics should not be understood as storing:

```text
GPS coordinates
street address
precise personal location
```

[Back to Index](#index)

---

<a id="session-explorer"></a>

# 10. Session / Journey Explorer

The Analytics dashboard includes bounded session/journey intelligence.

The goal is to answer:

```text
What path did visitors follow?

Which sections were reached in what order?

What engagement happened during the session?
```

The journey model is intentionally bounded.

It is not designed to retain an unlimited detailed replay of every action forever.

If a journey exceeds the configured bounded representation, it may be marked as truncated.

### Utility

This is useful for understanding patterns such as:

```text
About Me
→ Experience
→ Projects
→ Resume CTA
```

versus:

```text
Deep link directly to Projects
→ project open
→ leave
```

[Back to Index](#index)

---

<a id="release-analytics"></a>

# 11. Release Analytics

Each deployed profile version has an identifier such as:

```text
pv_c341be8
```

A successful PROD deployment registers release metadata.

This allows Analytics to answer:

```text
Which release generated these events?

How did one version perform compared with another?

What changed after a deployment?
```

Release filtering is independent of Period and From.

[Back to Index](#index)

---

<a id="boundaries"></a>

# 12. Analytics Boundaries

Analytics boundaries are logical points in time used to divide data into meaningful eras.

Two important boundary types are:

```text
reset
deploy
```

---

<a id="reset-boundaries"></a>

## Reset Boundaries

A Reset boundary is created when the owner intentionally establishes a new analytics baseline.

Example:

```text
Before redesign
      |
      | RESET
      v
After redesign
```

Old data remains available through All History.

The reset changes the logical starting point of analysis.

---

<a id="deploy-boundaries"></a>

## Deploy Boundaries

A Deploy boundary is associated with a successful production deployment.

Conceptually:

```text
Old release
   ↓
GitHub Pages successfully deploys
   ↓
Deploy Boundary
   ↓
New release traffic
```

The workflow registers this only after the production frontend has actually deployed successfully.

This avoids creating a release boundary for a deployment that never became live.

[Back to Index](#index)

---

<a id="reset"></a>

# 13. Reset — What It Actually Does

The normal Analytics Reset is a **soft/logical reset**.

It does **not** normally delete historical data.

Instead:

```text
Create RESET boundary
      ↓
mark new analytics baseline
      ↓
automatically select/use that baseline
```

Historical data remains available through:

```text
All History
```

### Why this design is better

A destructive Reset would permanently remove useful historical comparisons.

A logical boundary gives both:

```text
fresh baseline
+
retained history
```

[Back to Index](#index)

---

<a id="hard-purge"></a>

# 14. Hard Purge

A separate administrative hard-purge capability exists for exceptional cases.

This is **not** the normal dashboard Reset.

Hard purge can remove Analytics backend data and should be treated as an operational/destructive maintenance tool.

It includes explicit safety controls such as:

```text
stage awareness
dry run
exact confirmation
post-delete verification
```

Do not use hard purge merely because you want the dashboard to start from a new baseline.

For normal use:

```text
Reset Boundary
```

is preferred.

[Back to Index](#index)

---

<a id="visitor-session"></a>

# 15. Visitor and Session Semantics

## Visitor

Represents an anonymous portfolio visitor identity.

The backend stores hashed identity rather than exposing the raw client identifier to the dashboard.

---

## Session

A logical visitor session is shared across browser tabs.

The system avoids treating:

```text
Tab A
Tab B
Tab C
```

as three separate sessions merely because the same visitor opened multiple tabs.

---

## Inactivity

A logical session expires after approximately:

```text
30 minutes
```

of inactivity according to the session model.

---

## Active Tracking

Meaningful active time is tracked while the page is:

```text
visible
focused
actively used
```

rather than sending high-frequency mouse/scroll events.

The system intentionally avoids noisy tracking.

[Back to Index](#index)

---

<a id="tracked-events"></a>

# 16. Tracked Events

The Analytics tracker uses an allowlisted event model.

Important events include:

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

Scroll milestones are coarse:

```text
25%
50%
75%
100%
```

The system intentionally avoids high-frequency tracking such as:

```text
mousemove every few milliseconds
raw continuous scroll events
```

This reduces:

```text
noise
cost
storage
privacy surface
```

[Back to Index](#index)

---

<a id="privacy"></a>

# 17. Privacy Model

Analytics is designed to be anonymous.

New raw analytics storage intentionally excludes direct raw fields such as:

```text
raw IP address
raw User-Agent
raw visitor ID
raw session ID
raw tab ID
```

The backend uses hashed anonymous visitor/session identities.

Geographic metadata comes from trusted edge-derived headers.

Direct clients cannot simply provide arbitrary location headers and have them trusted as genuine edge geography.

The purpose is portfolio analytics, not personal surveillance.

[Back to Index](#index)

---

<a id="owner-exclusion"></a>

# 18. Owner Traffic Exclusion

Owner activity should not contaminate public analytics.

Exclusion happens through multiple defenses.

Conceptually:

```text
localhost / DEV browsing
→ excluded

non-production environment
→ excluded

browser marked as owner-excluded
→ excluded

valid owner-authenticated requests
→ backend can exclude
```

The system does not depend primarily on matching a specific owner IP address.

That is important because owner IP addresses can change.

[Back to Index](#index)

---

<a id="retention"></a>

# 19. Data Retention

Raw Analytics event batches stored in S3 use limited retention.

Current raw retention target:

```text
30 days
```

Aggregated Analytics data can remain available longer.

This gives:

```text
short-lived raw debugging/history
+
long-lived useful aggregates
```

without storing raw event payloads indefinitely.

[Back to Index](#index)

---

<a id="dev-prod"></a>

# 20. DEV vs PROD

DEV and PROD Analytics infrastructure are separate.

Conceptually:

```text
DEV Browser
→ DEV Analytics infrastructure

PROD Browser
→ PROD Analytics infrastructure
```

DEV testing should not pollute PROD analytics.

Automatic CI/CD deploys DEV first.

PROD changes remain explicit.

The DEV deployment includes an Analytics smoke test to verify:

```text
public ingestion
owner query
owner exclusion
basic backend behavior
```

before PROD rollout.

[Back to Index](#index)

---

<a id="common-questions"></a>

# 21. Common Analytics Questions

## What is the difference between Unique Visitors and Sessions?

```text
Unique Visitors
= anonymous people/visitor identities

Sessions
= browsing visits
```

One visitor can produce multiple sessions.

---

## What is the difference between Period and From?

```text
Period
= time window

From
= logical baseline boundary
```

---

## What is the difference between From and Release?

```text
From
= after which boundary?

Release
= which profile version?
```

---

## Does Reset delete everything?

No.

Normal Reset creates a logical boundary.

---

## Can old data still be viewed after Reset?

Yes, through All History / other applicable filters.

---

## Does deployment delete Analytics history?

No.

Deployment creates a release/deploy boundary.

---

## Does my own browsing count?

Owner/local browsing is intentionally excluded through the owner-exclusion model.

---

## Does Analytics store exact GPS location?

No.

Geography is coarse edge-derived country/city metadata where available.

---

## Does opening multiple tabs create multiple sessions?

The session model is designed to share the logical session across tabs.

---

## Is every mouse movement tracked?

No.

The system intentionally avoids noisy high-frequency tracking.

[Back to Index](#index)

---

<a id="modify"></a>

# 22. How to Modify Analytics Safely

Before changing Analytics:

```text
1. Understand whether the change is frontend-only or backend/infra.

2. Preserve public-vs-owner API separation.

3. Preserve owner exclusion.

4. Preserve anonymous identity/privacy behavior.

5. Preserve event deduplication.

6. Preserve boundary semantics.

7. Preserve exact unique calculations.

8. Preserve DEV/PROD isolation.

9. Add/update tests.

10. Run the normal checkpoint/deployment process.
```

Frontend-only Analytics dashboard changes normally follow:

```text
npm_cd
→ CI
→ DEV
→ Promote Frontend PROD
```

Backend/CDK Analytics changes require:

```text
npm_cd
→ CI
→ DEV
→ manual PROD infra
→ Promote Frontend PROD
```

[Back to Index](#index)

---

<a id="source-files"></a>

# 23. Relevant Source Files

Important frontend files include:

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

Important backend/infrastructure files include:

```text
infra/cdk/lambda/analytics-handler.ts

infra/cdk/lib/snapshots-stack.ts

infra/cdk/scripts/smoke-analytics.mjs

infra/cdk/test/analytics-handler.test.ts

infra/cdk/test/snapshots-stack.test.ts
```

Relevant deployment files include:

```text
.github/workflows/ci.yml

.github/workflows/infra-deploy.yml

.github/workflows/deploy.yml
```

Destructive maintenance:

```text
infra/cdk/scripts/purge-analytics.mjs
```

[Back to Index](#index)

---

<a id="invariants"></a>

# 24. Important Invariants

These should remain true unless a deliberate architecture change is being made.

```text
Public ingestion goes through the Analytics edge.

Owner queries go directly to the owner API.

DEV analytics never pollutes PROD.

Owner browsing is excluded.

Raw IP/User-Agent/client IDs are not retained in new raw Analytics storage.

Sessions are shared across tabs.

Session inactivity is approximately 30 minutes.

Analytics events are allowlisted.

High-frequency mouse/scroll tracking is avoided.

Event ingestion is idempotent/deduplicated.

Unique visitors are calculated exactly across selected ranges.

Reset is normally non-destructive.

Deployments do not delete Analytics history.

Release and boundary filtering remain independent.

PROD deployment boundary is created only after successful Pages deployment.
```

[Back to Index](#index)

---

<a id="troubleshooting"></a>

# 25. Troubleshooting

## Analytics dashboard shows no data

Check:

```text
Correct Period?

Correct From boundary?

Correct Release?

Owner Mode enabled?

Correct environment?

PROD/DEV endpoint correct?
```

---

## Public events are not appearing

Check:

```text
REACT_APP_ANALYTICS_INGEST_API

Analytics CloudFront edge

API Gateway route

Analytics Lambda

DEV/PROD stage

browser owner exclusion
```

---

## Owner queries fail

Check:

```text
Owner Mode authentication

REACT_APP_SNAPSHOTS_API

direct API connectivity

OWNER_TOKEN backend configuration
```

---

## Geography is missing

Possible reasons:

```text
request did not enter through trusted Analytics edge

CloudFront viewer geo was unavailable

direct API ingestion was used

edge trust validation rejected spoofable headers
```

---

## Counts look lower after Reset

Check the:

```text
From
```

filter.

You may be viewing only traffic after the latest reset boundary.

Choose:

```text
All History
```

to inspect historical data.

---

## Release is missing from the selector

Check whether the PROD deployment boundary/release registration successfully completed.

The release catalogue is populated by backend release metadata rather than being inferred only from the currently selected Period.

[Back to Index](#index)

---

<a id="related"></a>

# 26. Related Documentation

Architecture:

> **[Analytics Architecture](../architecture/analytics-architecture.md)**

Repository operations:

> **[Root README](../../README.md)**

Documentation homepage:

> **[Documentation Index](../README.md)**

[Back to Index](#index)
