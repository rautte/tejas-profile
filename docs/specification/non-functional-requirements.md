# Non-Functional Requirements

Constraints the system must satisfy while doing what [Functional Requirements](./functional-requirements.md) describes. Grouped by concern; each is a testable property, not a design decision (design decisions that satisfy these live in [Low-Level Design](./low-level-design.md)).

---

## Index

- [1. Reliability](#1-reliability)
- [2. Immutability and Identity](#2-immutability-and-identity)
- [3. Consistency](#3-consistency)
- [4. Security](#4-security)
- [5. Privacy](#5-privacy)
- [6. Performance](#6-performance)
- [7. Cost](#7-cost)
- [8. Scalability](#8-scalability)
- [9. Isolation](#9-isolation)
- [10. Operability](#10-operability)
- [11. Testability](#11-testability)

---

## 1. Reliability

```text
NFR-1.1  The public runtime never renders a blank page while
         waiting on the active-profile network fetch — it falls
         back to repository content synchronously on first render.

NFR-1.2  A network retry of the same analytics event batch never
         double-counts (idempotent ingestion via stable event IDs).

NFR-1.3  A cost-alert email failure never blocks or rolls back the
         underlying data collection it was reporting on.

NFR-1.4  A partial deployment-boundary registration failure is safe
         to retry without creating a second, logically-different
         boundary (idempotent, identity-preserving retry).

NFR-1.5  An unknown Fun Zone game id or an incompatible formal
         composition fails closed (skipped / rejected) rather than
         rendering broken or fabricating a fallback identity.
```

[Back to Index](#index)

---

## 2. Immutability and Identity

```text
NFR-2.1  A published Profile Variant, once published, never changes
         content. Any edit produces a new Variant.

NFR-2.2  A Platform Release, once created, is immutable.

NFR-2.3  A Configuration Analytics Report, once produced, is
         immutable.

NFR-2.4  No formal identity (profileVariantId, platformReleaseId,
         platformDeploymentId, deploymentConfigurationId) is ever
         synthesized from Git SHA, legacy profileVersion, checkpoint
         tag, or repository artifact key.

NFR-2.5  Application deployment identity and Profile activation
         identity are never collapsed into one concept.
```

[Back to Index](#index)

---

## 3. Consistency

```text
NFR-3.1  ACTIVE Profile and ACTIVE Platform pointer transitions are
         atomic — no reader ever observes a half-applied activation.

NFR-3.2  Activation and deployment commits use optimistic
         concurrency (observed revision check) — a conflicting
         concurrent write is rejected, never silently lost or
         silently merged.

NFR-3.3  A Deployment Configuration commit validates the opposing
         control-plane state it was built against; the composition
         actually made active is never allowed to silently diverge
         from the one that was validated.

NFR-3.4  Range-level unique visitor/session counts in Analytics are
         computed as an exact union across daily fragments, never
         approximated by summing daily uniques.
```

[Back to Index](#index)

---

## 4. Security

```text
NFR-4.1  Every owner/admin API route requires an authenticated
         owner session; no admin capability is reachable
         unauthenticated.

NFR-4.2  The owner passcode/credential is never embedded in frontend
         code or bundled JS.

NFR-4.3  Public ingestion and public read paths never require an
         owner credential, admin API, or repository source access.

NFR-4.4  CloudFront-forwarded geographic metadata is trusted by the
         backend only when accompanied by a verified edge-trust
         token; arbitrary client-supplied geo headers are never
         trusted.

NFR-4.5  IAM grants follow least privilege per Lambda; a Lambda that
         only reads one DynamoDB table is never granted account-wide
         or cross-service permissions it doesn't use (e.g. the main
         API handler is never granted Cost Explorer/CloudWatch
         access — only the Usage Cost aggregator is).

NFR-4.6  A response whose Access-Control-Allow-Origin header varies
         by request Origin is never cached by a CDN keyed without
         Origin in its cache key (would leak one origin's CORS
         response to another origin).
```

[Back to Index](#index)

---

## 5. Privacy

```text
NFR-5.1  Raw Analytics storage never retains IP address, User-Agent,
         raw visitor ID, raw session ID, or raw tab ID.

NFR-5.2  Visitor/session identity exposed in aggregates is a
         server-computed anonymous hash, never the raw client-side
         identifier.

NFR-5.3  No GPS or precise-location tracking; geography is
         coarse (country/city) and derived from CDN edge location,
         never a device GPS API.

NFR-5.4  Session journey representations are bounded, never an
         unlimited raw event replay.

NFR-5.5  The owner's own browsing sessions are excluded from
         Analytics aggregates.

NFR-5.6  Raw Analytics batches in S3 are retained for a bounded
         window (30-day target), not indefinitely.
```

[Back to Index](#index)

---

## 6. Performance

```text
NFR-6.1  The public active-profile endpoint is cached at the CDN
         edge with a short TTL (30s) so most requests never reach
         the Lambda, while still keeping content-staleness bounded
         and short.

NFR-6.2  Analytics event delivery is batched client-side (bounded
         queue, periodic + immediate-on-important-event flush)
         rather than one HTTP request per event.

NFR-6.3  Navigation-sensitive analytics interactions (external nav,
         downloads, tab switch) use a best-effort synchronous
         delivery path (sendBeacon) so they are not lost to browser
         context suspension.

NFR-6.4  Usage Cost data collection (Cost Explorer + CloudWatch) is
         never performed on a request path a human is waiting on —
         it is background/scheduled, with "Refresh now" being
         fire-and-forget from the caller's perspective.
```

[Back to Index](#index)

---

## 7. Cost

```text
NFR-7.1  Cost Explorer / CloudWatch calls happen only when a
         collection is actually due (or explicitly forced) — never
         on every scheduler tick regardless of the configured
         interval.

NFR-7.2  The system avoids heavyweight streaming/analytics
         infrastructure (Kafka, Flink, dedicated warehouses) given
         its target scale (~50k unique sessions/year, ~100
         events/session).

NFR-7.3  Every CDK-managed resource is tagged with project/stage so
         AWS Cost Allocation Tags can attribute historical billing
         by stage without added infrastructure.
```

[Back to Index](#index)

---

## 8. Scalability

```text
NFR-8.1  The Analytics and Profile/Platform control-plane
         architecture must handle the target scale (≤ ~50k unique
         sessions/year, ≤ ~100 events/session) using only
         CloudFront + API Gateway + Lambda + DynamoDB + S3 —
         no additional infrastructure tier is required at this
         scale.

NFR-8.2  DynamoDB access patterns (daily partitions, GSIs for
         ByProfileVariant / ByPlatformRelease lookups) must remain
         single-digit-item reads/queries, not table scans, for all
         routes on the hot path.
```

[Back to Index](#index)

---

## 9. Isolation

```text
NFR-9.1  DEV and PROD use entirely separate CDK stacks, DynamoDB
         tables, S3 buckets, and CloudFront distributions/behaviors
         for every subsystem (Profile/Platform control plane,
         Analytics, Usage Cost).

NFR-9.2  A formal object or ACTIVE pointer existing in DEV never
         implies or creates a corresponding object in PROD.

NFR-9.3  DEV infra deploys automatically on every successful CI run;
         PROD infra/frontend deploys only via explicit owner action
         — this asymmetry is a permanent property, not a transition
         state.
```

[Back to Index](#index)

---

## 10. Operability

```text
NFR-10.1  Every checkpoint deploy is independently verifiable: the
          exact commit, tag, and test/build results that passed are
          discoverable after the fact (Root README's Known-Good
          Production Baseline).

NFR-10.2  A repository-fallback content source (activeSnapshot.json)
          must be able to fail validation and fall back to the
          hand-authored src/data/* source without ever crashing the
          build or the runtime.

NFR-10.3  Hard purge and PROD promotion are both explicit,
          irreversible-by-mistake operations — each requires a
          distinct, unambiguous confirmation step separate from
          routine day-to-day actions.
```

[Back to Index](#index)

---

## 11. Testability

```text
NFR-11.1  Every Lambda-level route and every meaningful storage
          behavior (due-ness gating, alert dedupe, activation
          concurrency, snapshot lifecycle) has a corresponding
          automated test — the project's checked-in test suite is
          the source of truth for "does this still work," not
          manual verification alone.

NFR-11.2  Infra changes are verifiable pre-deploy via `cdk synth`/
          `cdk diff` without requiring an actual AWS deployment to
          catch a misconfiguration.
```

[Back to Index](#index)

---

## Related Documentation

> **[Functional Requirements](./functional-requirements.md)**

> **[High-Level Design](./high-level-design.md)**

> **[Specification Home](./README.md)**
