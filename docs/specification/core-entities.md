# Core Entities

Every first-class domain object in the system: its identity, its lifecycle, and how it relates to every other entity. This is the reference to check before assuming two similarly-named things are the same thing — several deliberately are not (see each entity's "Distinct From" line).

---

## Index

- [1. ProfileContent](#1-profilecontent)
- [2. Profile Draft](#2-profile-draft)
- [3. Profile Variant](#3-profile-variant)
- [4. Profile Activation (ACTIVE Profile pointer)](#4-profile-activation-active-profile-pointer)
- [5. Platform Release](#5-platform-release)
- [6. Platform Deployment](#6-platform-deployment)
- [7. Deployment Configuration](#7-deployment-configuration)
- [8. Usage Epoch](#8-usage-epoch)
- [9. Configuration Analytics Report](#9-configuration-analytics-report)
- [10. Legacy Snapshot](#10-legacy-snapshot)
- [11. Analytics Boundary](#11-analytics-boundary)
- [12. Analytics Release](#12-analytics-release)
- [13. Analytics Session Fragment](#13-analytics-session-fragment)
- [14. Usage Cost Snapshot](#14-usage-cost-snapshot)
- [15. Owner Session](#15-owner-session)
- [16. Entity Relationship Diagram](#16-entity-relationship-diagram)

---

## 1. ProfileContent

```text
What it is:    the canonical DTO shape for all public profile
               content — one object with a field per content
               group (hero, aboutMe, experience, education, skills,
               resume, projects, codeLab, funZone, timeline,
               contactLinks) plus structure.
Identity:      none of its own — it is a value, not a stored record.
Lifecycle:     created in memory by createProfileContent(), checked
               by validateProfileContent(); never persisted as
               "ProfileContent" directly — it becomes a Profile
               Variant once published.
Produced by:   1) src/data/* (hand-authored repository modules), or
               2) Admin -> Data -> Profile Draft, once published.
Distinct from: Profile Variant (a ProfileContent becomes one Variant
               only at the moment of publish; most ProfileContent
               values — e.g. every open Draft — are never a
               Variant at all).
```

[Back to Index](#index)

---

## 2. Profile Draft

```text
What it is:    editable, in-progress authoring state for a future
               Profile Variant.
Identity:      session-scoped (browser localStorage), not a
               server-side record.
Lifecycle:     Draft -> validate -> publish (produces a new
               immutable Profile Variant) -> optional activation.
Mutability:    fully mutable; autosaved (debounced) as the owner
               edits; resumable across sessions on the same browser.
Status values: clean | draft | draft_with_errors | ready | stale
               (PROFILE_DRAFT_STATUS).
Relates to:    produces exactly one Profile Variant per publish
               action; a Draft never itself becomes visible to
               public visitors.
Distinct from: Profile Variant (mutable vs. immutable — this is the
               single most important distinction in the Profile
               control plane).
```

[Back to Index](#index)

---

## 3. Profile Variant

```text
What it is:    one immutable, published snapshot of ProfileContent.
Identity:      formal, e.g. prv_<slug>_<timestamp> — never derived
               from Git SHA, profileVersion, checkpoint tag, or
               repository artifact key.
Lifecycle:     published (immutable from this point on) -> zero or
               more times ACTIVATED (activation is a separate,
               reversible pointer operation; publication itself
               never activates).
Storage:       S3 (content body) with a DynamoDB catalog entry
               (list/get/get-batch).
Produced by:   either src/data/* (repository authoring) or Admin ->
               Data (Draft publish) — the public runtime cannot
               tell which.
Relates to:    referenced by zero or more Profile Activation
               records over time; referenced by zero or more
               Deployment Configurations (paired with a Platform
               Release).
Distinct from: Profile Draft (mutable precursor); Legacy Snapshot
               (repository/deployment provenance, not formal
               Profile identity).
```

[Back to Index](#index)

---

## 4. Profile Activation (ACTIVE Profile pointer)

```text
What it is:    the atomic pointer recording which Profile Variant is
               currently live for a given stage (DEV or PROD).
Identity:      one pointer per stage; carries a revision number for
               optimistic concurrency.
Lifecycle:     observe current revision -> validate target Variant
               -> validate Platform compatibility -> atomic
               transition. A conflicting concurrent activation
               (stale observed revision) is rejected, not merged.
Relates to:    points at exactly one Profile Variant at a time, per
               stage; each activation event is itself recorded
               (queryable via /profile-activations/list, by
               profileVariantId via a GSI).
Distinct from: Profile Variant itself (the Variant is immutable
               content; the Activation is a mutable pointer that
               can be repointed at different Variants over time,
               including back to a previously-active one).
```

[Back to Index](#index)

---

## 5. Platform Release

```text
What it is:    the immutable identity of one built/deployed version
               of the application software itself (not its content).
Identity:      formal, shaped like plr_gha_<githubRunId>_
               <githubRunAttempt> — Git SHA is retained as
               provenance metadata on the record, but is never the
               identity itself. A workflow re-run (same SHA, new
               run attempt) can therefore be a distinct Platform
               Release.
Lifecycle:     created once per successful application deployment
               workflow; immutable thereafter.
Declares:      the Profile Platform Specification (PPS) version(s)
               it supports, used to gate compatibility at
               activation/deployment time.
Relates to:    paired with a Profile Variant to form a Deployment
               Configuration; has one or more Platform Deployment
               occurrences.
Distinct from: Platform Deployment (the release is the built
               artifact's identity; the deployment is the act/
               occurrence of deploying it — one release can have
               many deployment occurrences).
```

[Back to Index](#index)

---

## 6. Platform Deployment

```text
What it is:    one actual occurrence of deploying a Platform Release.
Identity:      formal, shaped like pdep_gha_<githubRunId>_
               <githubRunAttempt>, distinct from its Platform
               Release's identity.
Lifecycle:     created when a deployment workflow run actually
               executes a deploy step; committed atomically against
               the observed opposing (Profile) control-plane state.
Relates to:    references exactly one Platform Release; contributes
               to zero or more Deployment Configurations; feeds
               Platform Deployment history (/platform-deployments/
               list, /platform-deployments/commit).
Distinct from: Platform Release (identity of the build) and
               Deployment Configuration (the formal Release+Variant
               composition this deployment actually committed).
```

[Back to Index](#index)

---

## 7. Deployment Configuration

```text
What it is:    the deterministic, content-derived composition of
               exactly one Platform Release and exactly one Profile
               Variant.
Identity:      derived from the formal composition itself (Release
               id + Variant id), not inferred from legacy deployment
               history or Git SHA.
Lifecycle:     computed/created (create), then read (get/list); acts
               as the anchor a Usage Epoch opens against whenever it
               becomes the effective active composition.
Compatibility: only valid if the Platform Release declares support
               for a Profile Platform Specification the Profile
               Variant satisfies — an invalid/unsupported pairing
               fails closed and is never silently activated.
Relates to:    referenced by one or more Usage Epochs over time (the
               same configuration can recur across separate,
               non-contiguous epochs).
Distinct from: Usage Epoch (the configuration is "what was active";
               the epoch is "for how long, this particular time").
```

[Back to Index](#index)

---

## 8. Usage Epoch

```text
What it is:    one continuous time interval during which one
               specific Deployment Configuration was the effective
               active composition.
Identity:      one record per continuous interval — NOT one record
               per Deployment Configuration (the same configuration
               recurring later opens a new, separate epoch).
Lifecycle (state machine):
               OPEN -> CLOSING -> CLOSED
Relates to:    exactly one Deployment Configuration per epoch;
               exactly one (at most) Configuration Analytics Report
               per epoch, produced only after CLOSING's settlement
               window completes.
Queried via:   GET /usage-epochs/list.
Distinct from: Deployment Configuration (many-to-one: many epochs
               can reference the same configuration over time).
```

[Back to Index](#index)

---

## 9. Configuration Analytics Report

```text
What it is:    one immutable, exact-attribution Analytics report for
               one Usage Epoch — the settled, authoritative record
               of what happened during that epoch's exact formal
               composition.
Identity:      keyed to its Usage Epoch (and therefore to one exact
               profileVariantId + platformReleaseId +
               deploymentConfigurationId triple).
Lifecycle:     created once, after a Usage Epoch transitions CLOSING
               -> settlement window elapses -> report generated ->
               epoch marked CLOSED. Immutable from creation.
Source data:   the append-only, server-side, per-epoch Analytics
               event projection (browser cannot forge or choose
               which epoch an event is attributed to) — not the
               short-retention raw S3 diagnostic storage.
Queried via:   GET /configuration-analytics-reports/get,
               /get-batch.
Distinct from: Legacy Snapshot's historical Analytics data (belongs
               to Admin -> Analytics's live/compatibility model, a
               separate, mutable, ongoing aggregate — not this
               immutable per-epoch archive).
```

[Back to Index](#index)

---

## 10. Legacy Snapshot

```text
What it is:    a repository/deployment provenance record predating
               (and still coexisting alongside) the formal Profile/
               Platform control plane.
Identity:      keyed by repository/deployment facts: Git SHA, legacy
               profileVersion, checkpoint tag, build time, changed-
               file metadata.
Lifecycle:     created by the CI Snapshot publisher on deploy;
               owner can remark, soft-delete (delete/restore), or
               hard-delete (purge).
Formal links:  a Snapshot published AFTER a formal deployment
               completed carries explicit, already-established
               platformReleaseId/platformDeploymentId links — it
               never reconstructs them itself. Older Snapshots that
               predate the formal control plane are classified
               (LEGACY_UNMAPPED / AMBIGUOUS / INVALID) rather than
               retroactively assigned a guessed identity.
Distinct from: Profile Variant / Platform Release (Snapshots record
               provenance and history; they are not themselves
               formal Profile/Platform identity, even when linked).
```

[Back to Index](#index)

---

## 11. Analytics Boundary

```text
What it is:    a marker dividing Analytics history into logical eras
               for dashboard baselining/filtering.
Types:         RESET (owner-initiated, non-destructive — old data
               remains, only the dashboard's default baseline
               changes) | DEPLOY (registered only after a GitHub
               Pages deployment has actually succeeded).
Identity:      boundaryId, with type, effectiveAt, optional
               profileVersionId, optional Git SHA/build metadata,
               and an owner note.
Relates to:    events are classified against the applicable boundary
               by event timestamp; filtering by boundary is
               independent of filtering by Release.
Queried via:   POST /analytics/boundaries (create); read as part of
               query/meta responses.
```

[Back to Index](#index)

---

## 12. Analytics Release

```text
What it is:    metadata mapping the live/compatibility Analytics
               model to a deployed legacy profileVersion (e.g.
               pv_c341be8).
Lifecycle:     a successful deployment boundary reconciles/creates
               the associated release record; the FIRST release
               timestamp is preserved on redeploy of the same
               profileVersion, never overwritten — keeping the
               release catalogue stable across re-deploys of
               identical content.
Relates to:    independent filtering dimension from Boundary in
               Analytics queries.
Registered via: POST /analytics/releases.
```

[Back to Index](#index)

---

## 13. Analytics Session Fragment

```text
What it is:    the DynamoDB aggregation unit for live Analytics: one
               logical session x one day x one release x one
               boundary classification.
Identity:      conceptual key shape
               DAY#<date> / PV#<profileVersion> /
               #SESSION#<sessionHash> / #BOUNDARY#<boundaryId>.
Contents:      hashed visitor/session identity, section
               view/dwell/scroll data, CTA/journey data (bounded,
               with journeyTruncated when it exceeds the bounded
               representation) — never raw IP/User-Agent/raw
               visitor or session/tab IDs.
Relates to:    range-level unique visitor/session counts are
               computed by unioning fragments across days, not by
               summing daily uniques (see NFR-3.4).
Distinct from: Configuration Analytics Report (this is the mutable,
               ongoing, day-partitioned live aggregate; the Report
               is the immutable, per-epoch, exact-attribution
               archive).
```

[Back to Index](#index)

---

## 14. Usage Cost Snapshot

```text
What it is:    one point-in-time AWS cost + resource usage
               measurement for one period type.
Identity:      DynamoDB item keyed pk="PERIOD#<day|week|month>",
               sk=<periodKey> — plus one singleton pk="CONFIG",
               sk="CONFIG" row holding intervalDays,
               alertThresholds, lastRunAt, lastAlertedPeriodKeys.
Lifecycle:     upserted (PutItem) on every real (due, or forced)
               aggregator run; the previous value for the same
               periodKey is simply overwritten intraday — history
               accumulates naturally as periodKey rolls over to a
               new day/week/month, not via an append-only log.
Mutability:    intentionally mutable, best-effort operational data —
               no checksum/immutability machinery, unlike the formal
               Profile/Platform/Analytics-report entities.
Queried via:   GET /usage/summary, /usage/history.
Distinct from: Configuration Analytics Report (cost/usage telemetry
               about the infrastructure, not an Analytics-domain
               record about visitor behavior).
```

[Back to Index](#index)

---

## 15. Owner Session

```text
What it is:    the authenticated identity behind every Admin/owner
               API call.
Lifecycle:     established via POST /owner/session (passcode-based);
               the passcode itself can be rotated via
               /owner/passcode/request-change ->
               /owner/passcode/confirm-change without requiring a
               redeploy.
Scope:         gates every route in snapshots-handler.ts behind
               requireOwner() except the owner-session/passcode
               routes themselves; public ingestion and public
               active-profile routes never require it.
```

[Back to Index](#index)

---

## 16. Entity Relationship Diagram

```text
Profile Draft ──publish──> Profile Variant ──activate──> Profile Activation (per stage)
                                  │
                                  │ paired with
                                  ▼
Platform Release ──deployed as──> Platform Deployment
        │                              │
        └──────────┬───────────────────┘
                    ▼
          Deployment Configuration
                    │
                    │ becomes effective for an interval
                    ▼
               Usage Epoch (OPEN → CLOSING → CLOSED)
                    │
                    │ on settlement
                    ▼
       Configuration Analytics Report  (immutable, exact)

Legacy Snapshot ──optional formal links──> Platform Release / Platform Deployment
                  (never guessed; only attached when authoritative)

Analytics Session Fragment ──classified by──> Analytics Boundary
                            ──filtered by────> Analytics Release
                  (independent filter dimensions)

Usage Cost Snapshot  (independent telemetry; no relation to Profile/Platform entities)

Owner Session  (gates all of the above except public read/ingest paths)
```

[Back to Index](#index)

---

## Related Documentation

> **[Snapshots and Profile Platform Architecture](../architecture/snapshots-architecture.md)**

> **[API Reference](./api-reference.md)**

> **[Specification Home](./README.md)**
