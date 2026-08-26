# Tejas Profile Documentation

This directory contains the **deep product and architecture documentation** for Tejas Profile.

The root [`README.md`](../README.md) is the developer/deployment runbook.

This documentation answers a different question:

> What does each feature do, why does it exist, how is it implemented, and how should I safely modify it?

---

<a id="index"></a>

# Index

- [1. Documentation Structure](#documentation-structure)
- [2. Public Profile Sections](#public-profile-sections)
- [3. Admin Sections](#admin-sections)
  - [Analytics](#analytics)
  - [Snapshots](#snapshots)
- [4. Architecture Documentation](#architecture-documentation)
  - [Analytics Architecture](#analytics-architecture)
  - [Snapshots Architecture](#snapshots-architecture)
- [5. Documentation Status](#documentation-status)
- [6. How New Documentation Should Be Added](#adding-documentation)
- [7. Documentation Standards](#documentation-standards)
- [8. Relationship to the Root README](#root-readme)

---

<a id="documentation-structure"></a>

# 1. Documentation Structure

The intended structure is:

```text
tejas-profile/
│
├── README.md
│
└── docs/
    │
    ├── README.md
    │
    ├── sections/
    │   ├── analytics.md
    │   ├── snapshots.md
    │   └── <future feature docs>
    │
    └── architecture/
        ├── analytics-architecture.md
        ├── snapshots-architecture.md
        └── <future architecture docs>
```

The three documentation levels have deliberately different responsibilities.

---

## Root `README.md`

Answers:

```text
How do I start the project?

How do I test?

What is npm_cd?

What happens after npm_cd?

When do I deploy PROD infrastructure?

How do I promote PROD?

How do I rollback?

How do I verify the live release?
```

---

## `docs/sections/*.md`

Answers:

```text
What does this application section do?

What controls/options exist?

What does each metric mean?

What does the user/admin see?

How should I use it?

How do I modify it?

What source files belong to it?

What assumptions must remain true?
```

---

## `docs/architecture/*.md`

Answers:

```text
How is the feature engineered?

What services/components exist?

What data model is used?

What are the consistency/privacy/reliability decisions?

How does DEV differ from PROD?

How does deployment interact with it?

What should not be changed accidentally?
```

[Back to Index](#index)

---

<a id="public-profile-sections"></a>

# 2. Public Profile Sections

The public profile currently contains sections such as:

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

These documents will be added **one at a time after reviewing the actual current implementation**.

This prevents documentation from becoming speculative or stale.

Planned structure:

```text
docs/sections/about-me.md
docs/sections/experience.md
docs/sections/skills.md
docs/sections/education.md
docs/sections/resume.md
docs/sections/projects.md
docs/sections/code-lab.md
docs/sections/fun-zone.md
docs/sections/timeline.md
```

Do not create empty placeholder files yet.

[Back to Index](#index)

---

<a id="admin-sections"></a>

# 3. Admin Sections

Admin sections include:

```text
Analytics
Snapshots
Data
Settings
```

---

<a id="analytics"></a>

## Analytics

Status:

```text
DOCUMENTED
```

Complete feature/user documentation:

> **[Analytics — Feature Guide](./sections/analytics.md)**

This document explains:

- dashboard purpose
- Period
- From
- Release
- Compare
- unique visitors
- sessions
- new visitors
- returning visitors
- active time
- section reach
- section funnel
- CTA engagement
- deep links
- projects
- code snippets
- geography
- recent session journeys
- resets
- deployment boundaries
- release semantics
- formal runtime identity
- Usage Epoch historical archive
- immutable Configuration Analytics Reports
- privacy
- retention
- owner exclusion
- DEV vs PROD behavior
- troubleshooting
- relevant source files

---

<a id="snapshots"></a>

## Snapshots

Status:

```text
DOCUMENTED
```

Complete feature/user documentation:

> **[Snapshots — Feature Guide](./sections/snapshots.md)**

It covers:

- current runtime composition
- Profile activation
- immutable Profile Variant history
- Platform Release history
- Deployment Configurations
- formal vs legacy identity
- Snapshot archive
- truthful historical classification
- redeploy compatibility
- DEV/PROD behavior
- future Admin → Data authoring boundary

---

## Data

Status:

```text
NOT YET DOCUMENTED
```

Future:

```text
docs/sections/data.md
```

---

## Settings

Status:

```text
NOT YET DOCUMENTED
```

Future:

```text
docs/sections/settings.md
```

[Back to Index](#index)

---

<a id="architecture-documentation"></a>

# 4. Architecture Documentation

<a id="analytics-architecture"></a>

## Analytics Architecture

Status:

```text
DOCUMENTED
```

Complete system-design documentation:

> **[Analytics Architecture](./architecture/analytics-architecture.md)**

It covers:

```text
browser tracking
CloudFront ingestion edge
API Gateway
Analytics Lambda
DynamoDB aggregation
S3 raw storage
event batching
event deduplication
visitor hashing
session hashing
cross-tab sessions
session inactivity
active-time tracking
geo metadata
privacy stripping
release registration
deployment boundaries
reset boundaries
formal runtime identity
Usage Epoch attribution
immutable Configuration Analytics Reports
exact unique calculations
journey/session intelligence
DEV/PROD isolation
CI/CD integration
```

---

<a id="snapshots-architecture"></a>

## Snapshots Architecture

Status:

```text
DOCUMENTED
```

Complete architecture documentation:

> **[Snapshots and Profile Platform Architecture](./architecture/snapshots-architecture.md)**

It covers:

```text
Profile Draft
Profile Variant
Profile activation
Platform Release
Platform Deployment
Deployment Configuration
Profile Platform Specification
effective runtime identity
Usage Epoch relationship
legacy Snapshot compatibility
historical truth
future Data authoring integration
```

---

## Deployment Architecture

The operational deployment model is already documented extensively in the root:

> **[Root README](../README.md)**

A separate architecture document may be added later if deeper design documentation becomes useful.

[Back to Index](#index)

---

<a id="documentation-status"></a>

# 5. Documentation Status

| Area | Feature Guide | Architecture |
|---|---:|---:|
| About Me | Planned | N/A |
| Experience | Planned | N/A |
| Skills | Planned | N/A |
| Education | Planned | N/A |
| Resume | Planned | N/A |
| Projects | Planned | N/A |
| Code Lab | Planned | N/A |
| Fun Zone | Planned | N/A |
| Timeline | Planned | N/A |
| Analytics | ✅ Complete | ✅ Complete |
| Snapshots | ✅ Complete | ✅ Complete |
| Data | Future editor | Covered structurally by Snapshots architecture |
| Settings | Planned | TBD |
| Deployment | Root README | Control-plane model covered by Snapshots architecture |

This table should be updated whenever a documentation area is completed.

[Back to Index](#index)

---

<a id="adding-documentation"></a>

# 6. How New Documentation Should Be Added

When documenting a new profile section, do not write documentation from memory alone.

Recommended process:

```text
1. Identify the latest known-good production baseline.

2. Inspect the actual section implementation.

3. Inspect its data source.

4. Inspect related CSS/UI behavior.

5. Inspect Analytics events associated with the section.

6. Document current behavior.

7. Document how to modify it.

8. Document relevant files.

9. Add the file under docs/sections/.

10. Add it to this documentation index.

11. Add the link to the root README documentation map.
```

For architecture-heavy features, also create:

```text
docs/architecture/<feature>-architecture.md
```

[Back to Index](#index)

---

<a id="documentation-standards"></a>

# 7. Documentation Standards

Feature documents should generally contain:

```text
Overview
Purpose
Access
User/Admin Mental Model
Controls
Detailed Behavior
Metrics
Data Model
Tracking
DEV/PROD Behavior
How to Modify
Relevant Source Files
Troubleshooting
Design Decisions
Important Invariants
Related Documentation
```

Architecture documents should generally contain:

```text
Goals
Requirements
High-Level Architecture
Request/Data Flow
Data Model
Consistency
Idempotency
Security
Privacy
Retention
Scaling
Failure Handling
DEV/PROD Isolation
Deployment Integration
Testing
Relevant Source Files
Important Invariants
```

Not every document needs every heading.

The priority is:

```text
accurate
current
easy to navigate
easy for future-you to understand
```

[Back to Index](#index)

---

<a id="root-readme"></a>

# 8. Relationship to the Root README

Use the root README for:

> **How do I operate this repository?**

Use this documentation directory for:

> **How does this application actually work?**

Use architecture documentation for:

> **How is the system engineered underneath?**

Navigation:

> **[← Root README](../README.md)**

> **[Analytics Feature Guide](./sections/analytics.md)**

> **[Analytics Architecture](./architecture/analytics-architecture.md)**

> **[Snapshots Feature Guide](./sections/snapshots.md)**

> **[Snapshots Architecture](./architecture/snapshots-architecture.md)**

[Back to Index](#index)
