# Functional Requirements

What the system must do, grouped by capability area. Each requirement is phrased as an observable behavior, not an implementation detail — implementation lives in [High-Level Design](./high-level-design.md) and [Low-Level Design](./low-level-design.md).

---

## Index

- [1. Public Profile](#1-public-profile)
- [2. Profile Authoring and Activation](#2-profile-authoring-and-activation)
- [3. Platform Release and Deployment](#3-platform-release-and-deployment)
- [4. Legacy Snapshots](#4-legacy-snapshots)
- [5. Analytics](#5-analytics)
- [6. Usage Cost Tracking](#6-usage-cost-tracking)
- [7. Owner Authentication and Settings](#7-owner-authentication-and-settings)
- [8. Deployment Automation (CI/CD)](#8-deployment-automation-cicd)

---

## 1. Public Profile

```text
FR-1.1  Any visitor, unauthenticated, can view all 9 public sections:
        Hero, About Me, Experience, Skills, Education, Resume,
        Projects, Code Lab, Fun Zone, Timeline.

FR-1.2  Section content renders from one canonical ProfileContent
        object, regardless of which authoring source produced it.

FR-1.3  The rendered content is always the currently ACTIVE Profile
        Variant for the visitor's stage (DEV or PROD) — never a
        stale cached copy beyond the CDN's 30s TTL.

FR-1.4  If the active-profile fetch has not yet resolved, the app
        renders repository fallback content immediately rather than
        a blank page (see NFR reliability requirements).

FR-1.5  Timeline supports click, drag, and arrow-key navigation
        across a year-grouped rail; concurrent milestones in the
        same year all render, never silently collapsed.

FR-1.6  Fun Zone lets a visitor play, view source, and download a
        self-contained ZIP for each enabled game, entirely
        client-side.

FR-1.7  Section-to-section navigation (arrow keys / scroll) never
        renders a blank page, including at the last section when
        owner mode is off.

FR-1.8  All public sections render usably on mobile portrait, mobile
        landscape, tablet, and desktop widths.
```

[Back to Index](#index)

---

## 2. Profile Authoring and Activation

```text
FR-2.1  Profile content can be authored from two independent
        sources: the repository (src/data/*) or the owner-facing
        Admin → Data editor. Both converge on the same
        createProfileContent()/validateProfileContent() contract.

FR-2.2  Admin → Data provides a draft-then-publish workflow: an
        owner can edit any of the 11 content groups (hero, aboutMe,
        experience, education, skills, resume, projects, codeLab,
        funZone, timeline, contactLinks) plus site structure and
        assets, entirely in a Draft that autosaves locally and is
        resumable across sessions.

FR-2.3  A Draft never affects what public visitors see. Only an
        explicit Publish action creates a new, immutable Profile
        Variant.

FR-2.4  Publishing a Profile Variant does not, by itself, make it
        the ACTIVE variant. Activation is a separate, explicit step.

FR-2.5  Before publishing, the owner can review a diff between the
        Draft and its base Variant.

FR-2.6  Activating a Profile Variant is optimistic-concurrency
        controlled: an owner activating against a stale observed
        revision is rejected and must retry, never silently
        overwritten or silently ignored.

FR-2.7  Activation validates the target Variant's compatibility with
        the currently active Platform (Deployment Configuration)
        before committing; an incompatible combination fails closed.

FR-2.8  An owner can activate directly to PROD from DEV editing
        context via a single confirmation shortcut, without a
        separate manual PROD-specific publish step.

FR-2.9  DEV and PROD each have their own independent ACTIVE Profile
        pointer; activating in one stage never affects the other.
```

[Back to Index](#index)

---

## 3. Platform Release and Deployment

```text
FR-3.1  Every application deployment produces one immutable Platform
        Release record, identified independently of Git SHA.

FR-3.2  Every actual deployment occurrence produces one Platform
        Deployment record, distinct from the Platform Release it
        deploys — one release can have multiple deployment
        occurrences (e.g. a re-run).

FR-3.3  The system can compute a deterministic Deployment
        Configuration from the pairing of one Platform Release and
        one Profile Variant.

FR-3.4  A Platform Deployment must not commit against a Profile
        state different from the one used to construct its
        Deployment Configuration (atomic cross-control-plane
        transition).

FR-3.5  The public runtime exposes its effective formal identity
        (profileVariantId, platformReleaseId,
        deploymentConfigurationId) without ever fabricating it from
        Git SHA, legacy profileVersion, or Snapshot metadata.
```

[Back to Index](#index)

---

## 4. Legacy Snapshots

```text
FR-4.1  The owner can browse historical Snapshots (repository +
        deployment provenance records: Git SHA, checkpoint tag,
        build time, changed files) independent of the formal
        Profile/Platform control plane.

FR-4.2  The owner can remark, restore, delete (soft), and purge
        (hard) individual Snapshots.

FR-4.3  A new CI-published Snapshot, once a formal deployment has
        completed, persists the already-established
        platformReleaseId/platformDeploymentId as explicit links —
        never reconstructing them from GitHub run metadata.

FR-4.4  Historical Snapshot evidence that cannot be authoritatively
        mapped to a formal Profile/Platform identity is classified
        (LEGACY_UNMAPPED / AMBIGUOUS / INVALID) rather than guessed.
```

[Back to Index](#index)

---

## 5. Analytics

```text
FR-5.1  Public visitor interactions (session start, section views,
        section dwell time, scroll depth, CTA clicks, deep links,
        project opens, code snippet views) are tracked without
        requiring owner authentication.

FR-5.2  The owner can query exact, deduplicated unique visitor and
        session counts for any date range, plus section reach,
        engagement, geography, and journey intelligence — all
        behind owner authentication.

FR-5.3  Each ingested event is also attributed server-side to the
        exact Deployment Configuration active at ingest time,
        feeding an append-only per-Usage-Epoch projection the
        browser cannot forge or select.

FR-5.4  The owner can create a RESET boundary (non-destructive —
        establishes a new baseline without deleting prior data) and
        a DEPLOY boundary (registered only after the corresponding
        GitHub Pages deployment has actually succeeded).

FR-5.5  The owner can perform an explicit, fail-closed hard purge of
        all Analytics data for a stage, separate from and stronger
        than a Reset.

FR-5.6  Owner's own browsing is excluded from all Analytics
        aggregates.

FR-5.7  DEV and PROD Analytics data are fully isolated; no query can
        blend the two.
```

[Back to Index](#index)

---

## 6. Usage Cost Tracking

```text
FR-6.1  The system periodically collects real AWS cost (Cost
        Explorer) and resource usage (CloudWatch: S3 size/object
        count, DynamoDB consumed capacity, Lambda invocations/
        errors) on a schedule the owner can configure.

FR-6.2  The owner can trigger an immediate off-schedule refresh
        ("Refresh now") without waiting for the next scheduled tick.

FR-6.3  The owner can view current day/week/month cost+usage
        snapshots and a bounded history of past snapshots per period
        type.

FR-6.4  The owner can configure a cost alert threshold per period
        type (day/week/month); crossing a threshold sends at most
        one email per period per threshold, ever — never a repeat
        for the same period once already alerted.

FR-6.5  When a Usage Epoch (one continuous interval of one active
        Deployment Configuration) closes and its settlement window
        completes, the system can produce one immutable
        Configuration Analytics Report attributing exact Analytics
        data to that exact epoch.

FR-6.6  Every AWS resource created by this project's CDK stacks
        carries `project`/`stage` tags, enabling AWS Cost Allocation
        Tags to split billing by DEV vs. PROD in the Billing console.
```

[Back to Index](#index)

---

## 7. Owner Authentication and Settings

```text
FR-7.1  Only the owner, authenticated via a session established from
        a passcode, can access Admin sections (Data, Settings,
        Snapshots, Analytics, Usage) and any owner-only API route.

FR-7.2  The owner can rotate their own passcode through a
        request-change / confirm-change flow (e.g. via emailed
        confirmation), without requiring redeployment.

FR-7.3  Public runtime and public ingestion paths never require an
        owner credential, an admin API, or repository source access.
```

[Back to Index](#index)

---

## 8. Deployment Automation (CI/CD)

```text
FR-8.1  A checkpoint deploy (npm_cd) verifies frontend and infra
        tests/build locally, then commits, tags, and pushes
        atomically to main, triggering CI Quality Gate and (on
        success) automatic DEV infra deployment.

FR-8.2  A production deploy (npm_pd) promotes one exact, clean
        checkpoint SHA to PROD only after explicit interactive
        owner confirmation, and refuses to run against a dirty
        working tree.

FR-8.3  DEV infra deployment is fully automatic on every successful
        CI run against main. PROD infra/frontend deployment is
        always an explicit, separate, owner-triggered action.

FR-8.4  A legacy redeploy path can redeploy a known prior Git
        release/Snapshot without collapsing or reinterpreting it as
        a Profile activation.
```

[Back to Index](#index)

---

## Related Documentation

> **[Non-Functional Requirements](./non-functional-requirements.md)**

> **[Core Entities](./core-entities.md)**

> **[Specification Home](./README.md)**
