# Low-Level Design

How each component from [High-Level Design](./high-level-design.md) is actually implemented: storage layout, state machines, algorithms, and the specific engineering decisions and pitfalls encountered building them. This is the file to read before touching implementation, not just behavior.

---

## Index

- [1. DynamoDB Key Design](#1-dynamodb-key-design)
- [2. Optimistic Concurrency (Profile Activation)](#2-optimistic-concurrency-profile-activation)
- [3. Usage Epoch State Machine](#3-usage-epoch-state-machine)
- [4. Exact Unique Visitor Calculation](#4-exact-unique-visitor-calculation)
- [5. Repository Fallback Sync (activeSnapshot.json)](#5-repository-fallback-sync-activesnapshotjson)
- [6. Wave Animation / Content-Flash Interaction](#6-wave-animation--content-flash-interaction)
- [7. CloudFront Cache-Key Design for /profile/active](#7-cloudfront-cache-key-design-for-profileactive)
- [8. Reusing the Analytics Edge Distribution](#8-reusing-the-analytics-edge-distribution)
- [9. IAM: The minimizePolicies Pitfall](#9-iam-the-minimizepolicies-pitfall)
- [10. Usage Cost Due-ness Gating](#10-usage-cost-due-ness-gating)
- [11. Cost Alert Dedup](#11-cost-alert-dedup)
- [12. Edge Trust for Geography](#12-edge-trust-for-geography)
- [13. Profile Draft Autosave](#13-profile-draft-autosave)
- [14. Section Layout Width Strategy](#14-section-layout-width-strategy)
- [15. Legacy Snapshot Historical Classification](#15-legacy-snapshot-historical-classification)

---

## 1. DynamoDB Key Design

```text
Usage Cost table:
  pk="CONFIG",                    sk="CONFIG"         → 1 config row
  pk="PERIOD#<day|week|month>",   sk=<periodKey>       → N period rows

Analytics table (live/compatibility model):
  DAY#<date> / PV#<profileVersion> / #SESSION#<hash> /
  #BOUNDARY#<boundaryId>          → 1 session-fragment row

Profile/Platform control plane:
  catalog entries per Variant/Release/Deployment/Configuration,
  plus GSIs: ByProfileVariant (on Profile Activation records),
  ByPlatformRelease (on Platform Deployment records) — enabling
  GET .../list?profileVariantId=... / ?platformReleaseId=... without
  a table scan.
```

The Usage Cost table's period-row upsert-in-place design (§10) means "history" is a side effect of periodKey changing, not an append-only log — deliberately, since this is best-effort operational telemetry, not an audit trail. Contrast with Configuration Analytics Reports, which are genuinely append-only and immutable because they ARE meant to be an audit trail.

[Back to Index](#index)

---

## 2. Optimistic Concurrency (Profile Activation)

```text
1. Client reads current ACTIVE pointer, including its revision number.
2. Client submits an activate request carrying that observed revision.
3. Server re-reads the current revision at write time.
4. observed == current?
     yes → validate target Variant + Platform compatibility →
           atomic conditional write (revision+1, new target) →
           success
     no  → reject with a conflict; client must re-observe and retry
```

This is a conditional-write pattern (DynamoDB `ConditionExpression` on the revision attribute), not a distributed lock — no activation ever blocks waiting on another; a losing writer simply fails fast and must retry against fresh state. This is why FR-2.6 phrases it as "rejected and must retry," never "queued."

[Back to Index](#index)

---

## 3. Usage Epoch State Machine

```text
OPEN
  │  the Deployment Configuration this epoch tracks is no longer
  │  the effective active composition (a new activation or
  │  deployment superseded it)
  ▼
CLOSING
  │  settlement window elapses — this delay exists so in-flight
  │  Analytics events for the just-superseded configuration have
  │  time to actually arrive and be attributed before the epoch is
  │  treated as final
  ▼
CLOSED
  (a Configuration Analytics Report may now exist for this epoch)
```

An epoch never re-opens once CLOSED. If the same Deployment Configuration becomes active again later, that is a brand-new OPEN epoch (see Core Entities §8 — this is precisely why Usage Epoch != Deployment Configuration).

[Back to Index](#index)

---

## 4. Exact Unique Visitor Calculation

```text
naive (wrong):  sum(daily_unique_count for each day in range)
                — double-counts a visitor who returns on multiple
                  days within the range

correct:        union(daily_visitor_hash_set for each day in range)
                → count(union)
```

Because each day's Analytics Session Fragment already stores hashed visitor/session identifiers, the query layer can union these sets directly across the requested date range's fragments rather than re-deriving identity from raw events — the aggregation granularity (one fragment per session per day) was chosen specifically to make this union operation cheap.

[Back to Index](#index)

---

## 5. Repository Fallback Sync (activeSnapshot.json)

```text
Problem:   ProfileRuntimeContext must render *something* before the
           network fetch resolves (NFR-1.1). If the repository's
           hand-authored src/data/* content has drifted from what's
           actually ACTIVE, the visitor sees a visible "flash" from
           stale fallback content to real content once the fetch
           resolves.

Fix:       src/profile/content/activeSnapshot.json is a synced copy
           of whatever Profile Variant is currently ACTIVE for a
           chosen stage, produced by
           scripts/sync-repository-profile.mjs. buildProfileContent()
           prefers this snapshot over src/data/* whenever it is
           present and passes validateProfileContent().

Mechanism: buildProfileContentFromSnapshot() wraps snapshot parsing
           + createProfileContent() + validateProfileContent() in a
           try/catch; any failure (missing file, malformed content,
           a genuine type violation) returns null, and
           buildProfileContent() falls through to the original
           src/data/*-based composition unchanged. This is a
           preference layer, not a third authoring source — see
           NFR-10.2.
```

**Operational caveat (must be re-run manually, per stage):** there is no automatic trigger. Before `npm_pd`, `profile:sync-repository` (defaults to PROD) must be re-run or PROD will flash from a stale/DEV-synced snapshot to its own real active content. For local `npm start` testing (which talks to DEV), use `profile:sync-repository:dev` instead — syncing against the wrong stage reproduces the exact flash this mechanism exists to prevent (this was hit and fixed once already in this project's history).

[Back to Index](#index)

---

## 6. Wave Animation / Content-Flash Interaction

A worked example of two bugs that looked unrelated but shared one root cause.

```text
Symptom 1: the Hero wave emoji doesn't animate at all.
Symptom 2 (after fixing 1): it animates, but only during the
           fallback-content flash, so by the time the "real" page
           settles the animation has already finished and the emoji
           looks static.

Root cause: Hero's DOM node persists across the fallback→real content
           swap (no remount happens by default). A CSS animation
           that plays once on element creation had therefore already
           finished by the time a visitor was actually looking at
           final content.

Fix:       <span key={waveKey} className="animate-wave">👋</span>,
           where waveKey = activeProfileVariantId || "repository".
           React remounts the span (replaying the CSS animation)
           specifically when the real active Profile Variant settles
           in — tying an animation-replay decision to the same
           signal (profileVariantId resolution) that already governs
           the flash problem in §5.
```

Framer Motion was deliberately abandoned for this element in favor of a plain CSS `@keyframes` animation (`.animate-wave` in `src/index.css`, mirroring the pre-existing `.animate-glow` pattern) — the plain-CSS approach is immune to React/Framer-Motion mount-timing quirks that made the JS-driven version unreliable.

[Back to Index](#index)

---

## 7. CloudFront Cache-Key Design for /profile/active

```text
Problem:   active-profile-handler's response varies its
           Access-Control-Allow-Origin header based on the request's
           Origin header (different allowed origins per stage).

Risk:      a cache policy that does NOT include Origin in its cache
           key could serve a response cached for one origin to a
           different origin's request — an incorrect CORS response.

Fix:       ActiveProfileCachePolicy uses
           CacheHeaderBehavior.allowList("origin") — Origin
           participates in the cache key, so each distinct Origin
           gets its own cached response. TTL: default/min/max all
           tuned around 30s (min 0s, max 30s) to bound staleness
           without making every request a Lambda invocation.
```

[Back to Index](#index)

---

## 8. Reusing the Analytics Edge Distribution

`/profile/active` was added as an `additionalBehaviors` entry on the EXISTING `AnalyticsEdgeDistribution` rather than provisioning a new CloudFront distribution:

```text
Why safe:   the handler doesn't depend on or reject the
            x-analytics-edge-token header the origin injects for
            Analytics routes — it simply ignores headers it doesn't
            use, so sharing the origin introduces no coupling.
Why worth it: avoids the cost and operational overhead (separate
            domain, separate cert/DNS path, separate invalidations)
            of a second distribution for one lightweight GET route.
Verification: confirmed via cdk synth output, not just by reading
            the CDK code, that the emitted CloudFormation actually
            carried the expected TTL/header-allowlist/methods on the
            new behavior before deploying it.
```

[Back to Index](#index)

---

## 9. IAM: The minimizePolicies Pitfall

```text
Problem:   CDK's minimizePolicies behavior merges multiple separate
           .grantXxx()/.addToRolePolicy() calls targeting the SAME
           Lambda's auto-managed default IAM policy. Empirically,
           this merge can silently DROP unrelated pre-existing
           statements rather than just adding to them.

Fix:       whenever a Lambda needs multiple grants added across
           different features/PRs, combine them into ONE dedicated
           `new iam.Policy(scope, id, { statements: [...] })
           .attachToRole(fn.role!)` construct instead of multiple
           separate grant calls. This sidesteps the merge behavior
           entirely by never touching the auto-managed default
           policy for these additions.
```

Applied concretely in the Usage Cost system: the SnapshotsApiHandler's Usage Cost additions (`dynamodb:GetItem/PutItem/Query` on `UsageCostMetricsTable`, `lambda:InvokeFunction` on the aggregator's ARN) are one dedicated Policy construct, not two separate grant calls layered onto `fn`'s existing default policy.

[Back to Index](#index)

---

## 10. Usage Cost Due-ness Gating

```text
every EventBridge tick (every 6h, unconditionally):
    read CONFIG row (single cheap GetItem)
    now >= lastRunAt + intervalDays ?
        no  → return { ran: false, reason: "not due yet" }
                (zero Cost Explorer/CloudWatch calls)
        yes → run the real collection (§ High-Level Design §6),
              advance lastRunAt
force: true (from POST /usage/refresh-now) skips the due-ness check
       unconditionally — the only way to force an off-schedule
       real collection.
```

The 6-hour EventBridge rate is intentionally decoupled from the owner-configurable `intervalDays` — the schedule just has to tick often enough to notice when the configured interval has elapsed; it is not itself the collection cadence.

[Back to Index](#index)

---

## 11. Cost Alert Dedup

```text
on every REAL collection run only (never on a due-ness no-op):
    for each period type (day, week, month):
        threshold configured for this period?      no  → skip
        this period's total >= threshold?           no  → skip
        lastAlertedPeriodKeys[periodType] ==
            this period's periodKey already?         yes → skip
        else:
            send one SES email
            (only on send SUCCESS) record periodKey
                as this period's lastAlertedPeriodKeys value
```

Re-arming requires no manual reset: once a period's calendar key changes (new day / new ISO week / new month), `lastAlertedPeriodKeys` for that period type no longer matches the new periodKey, so the next real run that crosses the threshold again will alert. An SES failure is caught and logged but never propagates — it must never roll back or block the DynamoDB snapshot write it was alerting about (NFR-1.3).

[Back to Index](#index)

---

## 12. Edge Trust for Geography

```text
CloudFront injects an opaque, verifiable edge-trust token/header on
every request it forwards to the Analytics Lambda.

viewer geo (country/city) is trusted by the handler
    IF AND ONLY IF that edge-trust token is present and correct.

A direct-to-origin request (bypassing CloudFront) supplying
fabricated geo headers has no valid edge-trust token, so its geo
claims are never trusted — this is the entire spoofing defense
(NFR-4.4), and it requires no per-request cryptographic geo
verification, only checking for CloudFront's own trusted signal.
```

[Back to Index](#index)

---

## 13. Profile Draft Autosave

```text
owner edits a field in Admin → Data
    ↓ (debounced)
useProfileDraftSession.js persists the Draft to browser localStorage
    ↓
Draft is resumable: reopening Admin → Data on the same browser later
restores the exact in-progress Draft, not a blank editor
    ↓
Draft status transitions: clean → draft → draft_with_errors
    (validation failed) or ready (validation passed) → stale
    (the Draft's base Variant is no longer the current baseline,
    e.g. someone else activated a different Variant meanwhile)
```

Draft state is deliberately client-local (localStorage), not server-persisted — a Draft that's never published was never meant to be durable server-side state; only publish promotes it into the durable, immutable Profile Variant record.

[Back to Index](#index)

---

## 14. Section Layout Width Strategy

```text
Problem:   fixed max-width wrappers (max-w-5xl mx-auto, etc.) on
           Resume/Education/CodeLab/Timeline/the shared
           SECTION_CONTAINER constant left visibly wasted
           horizontal space on wide desktop viewports, inconsistent
           with how Admin pages already used the available width.

Fix:       stripped the max-width cap from SECTION_CONTAINER (used
           by AboutMe/Skills/Experience) and from each section's own
           wrapper div, keeping only the padding classes — mirroring
           the Admin section pages' pattern of using full available
           width with padding rather than a centered fixed-width
           column.

Exception: Timeline's short italic caption line kept its
           max-w-4xl mx-auto wrapper deliberately — that one wrapper
           is prose-readability styling (a long line of text is hard
           to read at full viewport width), not a card-layout
           wrapper, so the general fix does not apply to it.
```

[Back to Index](#index)

---

## 15. Legacy Snapshot Historical Classification

```text
new Snapshot, published AFTER a formal deployment completed:
    → carries the already-established platformReleaseId/
      platformDeploymentId as explicit links, persisted verbatim,
      never reconstructed from GitHub run metadata by the publisher
      itself (keeps the relationship one-way and authoritative).

older Snapshot, predating the formal control plane:
    can this Snapshot be authoritatively mapped to a formal
    Profile/Platform identity using available evidence?
        yes, unambiguous  → link it
        yes, but evidence conflicts → classify AMBIGUOUS
        no formal-era evidence exists → classify LEGACY_UNMAPPED
        evidence exists but is self-contradictory/corrupt →
                                          classify INVALID
    → no formal identity is ever fabricated to fill a gap (NFR-2.4)
```

[Back to Index](#index)

---

## Related Documentation

> **[High-Level Design](./high-level-design.md)**

> **[Core Entities](./core-entities.md)**

> **[Snapshots and Profile Platform Architecture](../architecture/snapshots-architecture.md)**

> **[Usage Cost Architecture](../architecture/usage-architecture.md)**

> **[Analytics Architecture](../architecture/analytics-architecture.md)**

> **[Specification Home](./README.md)**
