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
  - [Data](#data)
  - [Settings](#settings)
  - [Usage](#usage)
- [4. Architecture Documentation](#architecture-documentation)
  - [Analytics Architecture](#analytics-architecture)
  - [Snapshots Architecture](#snapshots-architecture)
  - [Usage Cost Architecture](#usage-architecture)
- [5. Documentation Status](#documentation-status)
- [6. How New Documentation Should Be Added](#adding-documentation)
- [7. Documentation Standards](#documentation-standards)
- [8. Relationship to the Root README](#root-readme)
- [9. Project Specification (Requirements & Design)](#project-specification)

---

<a id="documentation-structure"></a>

# 1. Documentation Structure

The structure is:

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
    │   ├── data.md
    │   ├── settings.md
    │   ├── usage.md
    │   ├── about-me.md
    │   ├── experience.md
    │   ├── skills.md
    │   ├── education.md
    │   ├── resume.md
    │   ├── projects.md
    │   ├── code-lab.md
    │   ├── fun-zone.md
    │   └── timeline.md
    │
    ├── architecture/
    │   ├── analytics-architecture.md
    │   ├── snapshots-architecture.md
    │   └── usage-architecture.md
    │
    └── specification/
        ├── README.md
        ├── functional-requirements.md
        ├── non-functional-requirements.md
        ├── core-entities.md
        ├── api-reference.md
        ├── high-level-design.md
        └── low-level-design.md
```

`docs/specification/` is a whole-system requirements/design document set, distinct from the per-feature guides below it — see [Section 9](#project-specification).

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

All nine public profile sections are documented:

| Section | Feature Guide |
|---|---|
| About Me | **[about-me.md](./sections/about-me.md)** |
| Experience | **[experience.md](./sections/experience.md)** |
| Skills | **[skills.md](./sections/skills.md)** |
| Education | **[education.md](./sections/education.md)** |
| Resume | **[resume.md](./sections/resume.md)** |
| Projects | **[projects.md](./sections/projects.md)** |
| Code Lab | **[code-lab.md](./sections/code-lab.md)** |
| Fun Zone | **[fun-zone.md](./sections/fun-zone.md)** |
| Timeline | **[timeline.md](./sections/timeline.md)** |

Each covers: what the section renders, its exact data model, how its content is authored (repository `src/data/*` vs. an active Profile Variant via Admin → Data, converging through `buildProfileContent()`), whether an owner-facing editor already exists for it, and where to find its source files.

None of these sections has a dedicated architecture document — they are all thin, stateless renderers of one field of the canonical `ProfileContent` DTO. The relevant architecture lives in the [Snapshots and Profile Platform Architecture](#snapshots-architecture) document instead.

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
Usage
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
- Admin → Data authoring boundary

---

<a id="data"></a>

## Data

Status:

```text
DOCUMENTED
```

Complete feature/user documentation:

> **[Data — Feature Guide](./sections/data.md)**

It covers:

- draft-then-publish authoring model (never edits the active Variant in place)
- autosaved, resumable local drafts
- the generic, metadata-driven field/collection editor shared by every content group
- Structure editing (section order, groups, default landing section)
- Asset staging and upload
- Publish review and the resulting new immutable Profile Variant
- unified activate / retarget-only-republish flow, including the "Activate to PROD" shortcut
- the repository-vs-active-Variant authoring duality and `activeSnapshot.json`

---

<a id="settings"></a>

## Settings

Status:

```text
DOCUMENTED
```

Complete feature/user documentation:

> **[Settings — Feature Guide](./sections/settings.md)**

It covers:

- owner login passcode rotation (distinct from the CI/CD master credential)
- the email-verified two-step change flow and its rate limiting
- why the passcode-change endpoints must remain reachable without a prior owner session (recovery)
- SES email delivery and DEV/PROD secret isolation

---

<a id="usage"></a>

## Usage

Status:

```text
DOCUMENTED
```

Complete feature/user documentation:

> **[Usage — Feature Guide](./sections/usage.md)**

It covers:

- AWS $ cost and resource usage, aggregated day/week/month
- the owner-configurable refresh schedule and "Refresh now"
- cost alert emails and their once-per-period dedupe guarantee
- the full-width, 5-row-capped resource usage cards
- DEV/PROD isolation

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
Admin → Data authoring integration (implemented)
```

---

<a id="usage-architecture"></a>

## Usage Cost Architecture

Status:

```text
DOCUMENTED
```

Complete architecture documentation:

> **[Usage Cost Architecture](./architecture/usage-architecture.md)**

It covers:

```text
scheduled aggregator (EventBridge + Lambda) and its due-ness gating
Cost Explorer cost collection and day/week/month derivation
CloudWatch resource-usage collection
DynamoDB storage model (config + period snapshots, one table)
cost-alert email path and its once-per-period dedupe guarantee
API surface (owner-only routes on the shared API handler)
CDK-wide resource tagging as the Cost Allocation Tags prerequisite
IAM (including the dedicated-Policy workaround for a known
    CDK minimizePolicies pitfall)
DEV/PROD isolation
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
| About Me | ✅ Complete | N/A (covered by Snapshots architecture) |
| Experience | ✅ Complete | N/A (covered by Snapshots architecture) |
| Skills | ✅ Complete | N/A (covered by Snapshots architecture) |
| Education | ✅ Complete | N/A (covered by Snapshots architecture) |
| Resume | ✅ Complete | N/A (covered by Snapshots architecture) |
| Projects | ✅ Complete | N/A (covered by Snapshots architecture) |
| Code Lab | ✅ Complete | N/A (covered by Snapshots architecture) |
| Fun Zone | ✅ Complete | N/A (covered by Snapshots architecture) |
| Timeline | ✅ Complete | N/A (covered by Snapshots architecture) |
| Analytics | ✅ Complete | ✅ Complete |
| Snapshots | ✅ Complete | ✅ Complete |
| Data | ✅ Complete | Covered structurally by Snapshots architecture |
| Settings | ✅ Complete | Covered by Root README (owner auth) |
| Usage | ✅ Complete | ✅ Complete |
| Deployment | Root README | Control-plane model covered by Snapshots architecture |
| Whole-system specification | See [Project Specification](#project-specification) | See [Project Specification](#project-specification) |

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

> **[Analytics Feature Guide](./sections/analytics.md)** · **[Analytics Architecture](./architecture/analytics-architecture.md)**

> **[Snapshots Feature Guide](./sections/snapshots.md)** · **[Snapshots Architecture](./architecture/snapshots-architecture.md)**

> **[Data Feature Guide](./sections/data.md)**

> **[Settings Feature Guide](./sections/settings.md)**

> **[Usage Feature Guide](./sections/usage.md)** · **[Usage Cost Architecture](./architecture/usage-architecture.md)**

> **[Project Specification](./specification/README.md)**

[Back to Index](#index)

---

<a id="project-specification"></a>

# 9. Project Specification (Requirements & Design)

The documents above are per-feature guides and per-feature architecture. They answer *how does this one feature work*.

`docs/specification/` is different: it is a single, whole-system requirements and design specification, covering the project as one system rather than one section at a time.

> **[Project Specification — Index](./specification/README.md)**

It is organized as:

| Document | Answers |
|---|---|
| **[Functional Requirements](./specification/functional-requirements.md)** | What must the system do? |
| **[Non-Functional Requirements](./specification/non-functional-requirements.md)** | How well must it do it (reliability, security, performance, cost, privacy)? |
| **[Core Entities](./specification/core-entities.md)** | What are the fundamental objects in this system, and how do they relate? |
| **[API Reference](./specification/api-reference.md)** | Every HTTP endpoint the backend exposes, request/response shape, and auth requirement |
| **[High-Level Design](./specification/high-level-design.md)** | What are the major components/services, and how do they fit together? |
| **[Low-Level Design](./specification/low-level-design.md)** | How is each component actually implemented — data flow, algorithms, storage layout, state machines? |

Use the specification when you need the whole picture at once (e.g. onboarding, a design review, or preparing to explain the system to someone else). Use the per-feature guides and architecture docs above when you are working on one specific feature.

[Back to Index](#index)
