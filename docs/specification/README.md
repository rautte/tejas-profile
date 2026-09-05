# Tejas Profile — Project Specification

This is the whole-system requirements and design specification for Tejas Profile.

It is distinct from [`docs/sections/`](../sections/) (per-feature user guides) and [`docs/architecture/`](../architecture/) (per-feature deep architecture). Those answer *how does this one feature work?*. This folder answers *what is this system, end to end?*.

---

## Index

- **[Functional Requirements](./functional-requirements.md)** — what the system must do, organized by capability area (public profile, Profile/Platform authoring and activation, Analytics, Usage cost, deployment).
- **[Non-Functional Requirements](./non-functional-requirements.md)** — reliability, immutability, security, privacy, performance, cost, and operability constraints the system must satisfy while doing the above.
- **[Core Entities](./core-entities.md)** — every first-class domain object (Profile Variant, Platform Release, Deployment Configuration, Usage Epoch, Configuration Analytics Report, Usage Cost snapshot, etc.), its identity, its lifecycle, and how it relates to every other entity.
- **[API Reference](./api-reference.md)** — every HTTP endpoint exposed by the backend, grouped by Lambda handler, with method, auth requirement, and purpose.
- **[High-Level Design](./high-level-design.md)** — the major services/components (frontend, control-plane API, Analytics pipeline, Usage cost pipeline, CDN, CI/CD) and how they fit together.
- **[Low-Level Design](./low-level-design.md)** — how each component is actually implemented: storage layout, state machines, algorithms, and the specific engineering decisions/pitfalls encountered while building them.

---

## How to Use This Specification

```text
Onboarding to the whole project?          → read all 6, in the order above
Explaining the system to someone else?    → start with High-Level Design
Deciding whether a change is safe?        → check Core Entities + the
                                             relevant Low-Level Design section
Adding a new API endpoint?                → check API Reference for the
                                             existing naming/auth conventions
Reviewing a proposed feature?             → check Functional + Non-Functional
                                             Requirements for what it must
                                             satisfy
```

For day-to-day development, testing, checkpointing, and deployment operations, use the root [`README.md`](../../README.md) instead — this specification describes what the system *is*, not how to *operate* it.

---

## Relationship to the Rest of `docs/`

```text
docs/specification/   → the whole system, once, top to bottom
docs/architecture/     → one feature, deep engineering detail
docs/sections/         → one feature, user/admin-facing behavior
../../README.md        → how to run, test, checkpoint, and deploy this repo
```

A change to how a feature actually behaves should be reflected in its `docs/sections/*.md` and (if architecturally significant) `docs/architecture/*.md` file first. This specification should then be updated if the change affects a *system-wide* concern — a new entity, a new API surface, a new non-functional guarantee, or a change to the high-level architecture.

[Back to Documentation Home](../README.md)
