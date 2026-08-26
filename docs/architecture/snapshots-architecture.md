# Snapshots and Profile Platform Architecture

This document describes the formal Profile/Platform control plane, its relationship to Admin → Snapshots, and the retained legacy Snapshot compatibility model.

---

## 1. Core Separation

The architecture deliberately separates two control planes.

### Profile control plane

```text
authoring
→ canonical ProfileContent
→ immutable Profile Variant
→ ACTIVE Profile pointer
```

### Platform control plane

```text
application build
→ immutable Platform Release
→ Platform Deployment
→ ACTIVE Platform pointer
```

Neither identity is derived from the other.

---

## 2. Authoring Boundary

Profile content is canonical before publication.

Current repository authoring:

```text
src/data/*
    ↓
buildProfileContent()
    ↓
canonical ProfileContent
```

Future owner UI authoring:

```text
Admin → Data
    ↓
Profile Draft
    ↓
canonical ProfileContent
```

Both paths converge before immutable publication.

The public runtime must not care which authoring source produced the Variant.

---

## 3. Profile Draft

Drafts represent editable authoring state.

Draft state may change.

Published Profile Variants may not.

The intended lifecycle is:

```text
Draft
→ validate
→ publish new Variant
→ optional activation
```

Editing published content always produces another immutable Variant.

---

## 4. Profile Variant

A Profile Variant is immutable published Profile content.

Identity is formal and must never be synthesized from:

```text
Git SHA
profileVersion
checkpoint tag
repository artifact key
```

Publication does not activate it.

---

## 5. Profile Activation

ACTIVE Profile is an atomic pointer with optimistic-concurrency revision semantics.

Activation conceptually performs:

```text
observe revision
    ↓
validate target Variant
    ↓
validate compatibility
    ↓
atomic transition
```

A conflict requires explicit owner review/retry.

---

## 6. Platform Release

A Platform Release is the immutable software-release identity.

The deployment workflow currently creates identities shaped like:

```text
plr_gha_<githubRunId>_<githubRunAttempt>
```

Git SHA remains provenance.

It is not the formal Platform Release identity.

A rerun attempt can therefore represent a distinct built release even when Git SHA is identical.

---

## 7. Platform Deployment

A Platform Deployment is an actual deployment occurrence.

Identity is distinct from Platform Release and may be shaped like:

```text
pdep_gha_<githubRunId>_<githubRunAttempt>
```

A Platform Release can have multiple deployment occurrences.

---

## 8. Deployment Configuration

A Deployment Configuration is the deterministic composition:

```text
Platform Release
      +
Profile Variant
      ↓
Deployment Configuration
```

Its identity is content-derived from the formal composition.

It is not inferred from legacy deployment history.

---

## 9. Profile Platform Specification

Platform Releases declare their supported Profile Platform Specification.

Compatibility is evaluated before a formal composition becomes active.

Invalid or unsupported composition fails closed.

Historical Platform Release records that predate PPS qualification may remain valid historical evidence without being silently upgraded.

---

## 10. Atomic Cross-Control-Plane Transition

Deployment and Profile activation must preserve a coherent effective composition.

The transition layer guards the observed opposite control-plane state.

For example, a Platform deployment must not silently commit against a Profile state different from the one used to construct its Deployment Configuration.

Likewise Profile activation validates the active Platform side.

---

## 11. Effective Runtime Identity

The public runtime exposes formal identity derived from active control-plane state:

```text
profileVariantId
platformReleaseId
deploymentConfigurationId
```

Runtime identity is not inferred from:

```text
Git SHA
legacy profileVersion
Snapshot metadata
```

If a formal composition is incomplete or unsupported, runtime behavior fails closed rather than manufacturing identity.

---

## 12. Usage Epoch

A Usage Epoch represents one continuous interval during which one effective Deployment Configuration is active.

```text
Deployment Configuration
        ↓
Usage Epoch
```

The same Deployment Configuration can recur in separate Usage Epochs.

Therefore:

```text
Usage Epoch != Deployment Configuration
```

Lifecycle:

```text
OPEN
→ CLOSING
→ CLOSED
```

---

## 13. Configuration Analytics Report

When a Usage Epoch closes and its settlement period completes, Analytics can create one immutable Configuration Analytics Report.

Conceptually:

```text
Usage Epoch
    ↓
exact attributed analytics
    ↓
immutable Configuration Analytics Report
```

Historical reports belong to Admin → Analytics rather than the legacy Snapshot archive.

---

## 14. Legacy Snapshots

Legacy Snapshots remain intentionally supported.

They preserve repository/deployment provenance such as:

```text
Git SHA
legacy profileVersion
checkpoint tag
build time
repository artifact
changed-file metadata
source Snapshot relationship
```

These values remain useful but are not formal Profile/Platform identity.

---

## 15. Formal Links on New CI Snapshots

After a formal deployment has completed, the CI Snapshot publisher receives the already-established:

```text
platformReleaseId
platformDeploymentId
```

and persists them as explicit links.

The publisher must not reconstruct these identities from GitHub metadata.

This keeps the relationship one-way and authoritative.

---

## 16. Historical Truth

Old Snapshot evidence is classified rather than guessed.

Formal identities are attached only when authoritative evidence proves the relationship.

Otherwise history remains:

```text
LEGACY_UNMAPPED
AMBIGUOUS
INVALID
```

as appropriate.

No historical Profile Variant, Platform Release, Deployment Configuration, Platform Deployment, or Usage Epoch is fabricated.

---

## 17. Admin vs Public Boundary

Admin/control-plane APIs are owner authenticated.

Public Profile runtime uses a separate public read path.

Public production runtime must not require:

```text
OWNER_TOKEN
admin Snapshot APIs
repository src/data
```

The public runtime reads only formal active state and immutable published artifacts required to render the Profile.

---

## 18. DEV / PROD Isolation

DEV and PROD use separate control-plane storage and pointers.

A formal object or ACTIVE pointer in DEV does not imply one exists in PROD.

Testing and local development must preserve this boundary.

---

## 19. Redeploy Compatibility

The legacy redeploy path remains:

```text
known Git release / Snapshot
    ↓
redeploy.yml
    ↓
deploy.yml
```

This exists for repository/application rollback.

It is not Profile activation and does not collapse the Profile and Platform control planes.

---

## 20. Failure Principles

The system favors:

```text
immutability
explicit identity
optimistic concurrency
atomic pointer transitions
idempotent writes
fail-closed compatibility
truthful historical classification
```

over guessing or reconstructing missing formal state.

---

## 21. Future Admin → Data Editor

The future Data editor must plug in above the canonical ProfileContent boundary.

It may provide:

```text
draft creation
field editing
validation
revision history
preview
asset selection
publish
optional activation
```

but must not introduce a second Profile runtime model.

Both repository and UI authoring must continue to publish the same Profile Variant contract.

---

## 22. Important Invariants

```text
application deployment != Profile activation

Profile Variant is immutable

Platform Release is immutable

Platform Deployment is an occurrence

Deployment Configuration is a formal composition

Usage Epoch is a usage interval

legacy Snapshot evidence is not formal identity

formal historical identity is never fabricated
```

---

## 23. Related Documentation

> **[Snapshots Feature Guide](../sections/snapshots.md)**

> **[Analytics Architecture](./analytics-architecture.md)**

> **[Root README](../../README.md)**
