# Snapshots — Feature Guide

The Snapshots admin section is the owner-facing control-plane and historical release surface for Tejas Profile.

It combines the modern formal Profile/Platform control plane with the retained legacy Snapshot/redeploy history required for truthful rollback and historical inspection.

For the underlying architecture, see:

> **[Snapshots and Profile Platform Architecture](../architecture/snapshots-architecture.md)**

For repository deployment procedures, see:

> **[Root README](../../README.md)**

---

## 1. Access

Snapshots is available only from owner/admin mode:

```text
Admin
→ Snapshots
```

Public visitors do not use this page and public Profile runtime does not depend on this admin UI.

---

## 2. Mental Model

Do not treat all items shown on this page as the same kind of release.

The modern formal model is:

```text
Profile Variant
    +
Platform Release
    ↓
Deployment Configuration
```

A deployment occurrence is represented separately as:

```text
Platform Deployment
```

Legacy CI Snapshots remain available for:

```text
Git/repository provenance
checkpoint inspection
rollback/redeploy history
historical compatibility
```

A legacy Snapshot is not a Profile Variant.

A `profileVersion` is not a Profile Variant.

Git SHA is not a Profile Variant, Platform Release, Platform Deployment, or Deployment Configuration.

---

## 3. Current Runtime Composition

The Current runtime composition card displays the formal identities currently delivered by the public runtime:

```text
Profile Variant
Platform Release
Deployment Configuration
```

Possible states include:

```text
No formal active composition
Profile active but Platform identity not established
Formal composition active
Inconsistent runtime identity
```

Missing formal identities are never reconstructed from:

```text
Git SHA
legacy profileVersion
Snapshot history
```

---

## 4. Profile Activation

Profile publication and Profile activation are separate operations.

Publishing creates a new immutable Profile Variant.

It does not automatically make that Variant public.

Owner activation follows:

```text
enter published prv_* identity
    ↓
load immutable Variant
    ↓
review metadata
    ↓
confirm explicitly
    ↓
activate using observed ACTIVE revision
```

Activation uses optimistic concurrency.

A revision conflict is surfaced to the owner and is never automatically retried as a second mutation.

Profile activation changes Profile content only.

It does not trigger a Git deployment or GitHub Pages deployment.

---

## 5. Profile Variant History

Profile Variant history is a read-only immutable catalog.

It shows published Variants and can expose:

```text
active/historical status
Profile Variant identity
content metadata
targeting
activation history
Deployment Configurations
related Platform Releases
```

The catalog itself does not mutate ACTIVE Profile state.

Use the separate Profile activation panel for activation.

If no Variants have been published in the current environment, the catalog is legitimately empty.

---

## 6. Platform Release History

Platform Release history is a read-only immutable software-release catalog.

A Platform Release represents the built application release.

It is separate from:

```text
Git SHA
legacy profileVersion
deployment occurrence
Profile Variant
```

The same Platform Release may participate in more than one deployment occurrence.

History can expose:

```text
Platform Release identity
build provenance
PPS declaration
deployment occurrences
Deployment Configurations
related Profile Variants
```

This catalog does not deploy or activate anything.

---

## 7. Platform Deployment

A Platform Deployment represents an actual deployment occurrence.

Conceptually:

```text
Platform Release
    ↓ deployed
Platform Deployment
```

The same immutable Platform Release may legitimately be deployed more than once.

Therefore:

```text
Platform Release != Platform Deployment
```

---

## 8. Deployment Configuration

A Deployment Configuration represents the deterministic composition of:

```text
Profile Variant
    +
Platform Release
```

It is the formal runtime composition identity used downstream by Analytics and Usage Epoch lifecycle.

Deployment Configurations must not be fabricated from legacy Git/Profile Version data.

---

## 9. Profile Platform Specification

Platform Releases declare the Profile Platform Specification version they support.

Before activation/deployment establishes a formal composition, compatibility must be valid.

Unsupported or incompatible formal composition fails closed.

---

## 10. Legacy Snapshot Archive

The legacy Snapshot archive remains intentionally supported.

It provides:

```text
Profile CI Snapshots
Analytics Snapshots
preview
download
remarks
favorites
filter/query
archive to Trash
restore
purge
repository artifact access
redeploy bridge
```

This is a compatibility and historical-provenance surface.

It is not the authoritative modern Profile runtime identity model.

---

## 11. CI Snapshot Formal Links

New CI Snapshots created after a successful formal deployment can persist exact authoritative links such as:

```text
platformReleaseId
platformDeploymentId
```

Those links come from the already-completed control-plane workflow.

They are not reconstructed from GitHub run metadata, Git SHA, or `profileVersion`.

Older Snapshots that do not contain authoritative formal evidence remain legacy history.

---

## 12. Historical Truth

Historical records are classified truthfully.

The system does not invent formal identity for legacy data.

Possible historical classifications include:

```text
FORMAL
LEGACY_LINKED
LEGACY_UNMAPPED
AMBIGUOUS
INVALID
```

A legacy record may remain permanently unmapped when authoritative evidence does not prove a unique formal identity.

---

## 13. Redeploy

The owner redeploy path is intentionally retained.

It is used for deliberate rollback/redeployment of a known repository release.

Conceptually:

```text
legacy Snapshot / known Git SHA
    ↓
Redeploy (Owner)
    ↓
canonical deploy workflow
```

Redeploy is not Profile activation.

The reusable canonical deployment implementation remains:

```text
.github/workflows/deploy.yml
```

and:

```text
.github/workflows/redeploy.yml
```

is the owner-facing wrapper.

---

## 14. DEV vs PROD

DEV and PROD control-plane data are isolated.

An empty DEV formal catalog does not imply that the frontend is incomplete.

It may simply mean no formal Profile Variant or Platform Release has yet been created in DEV.

Never infer PROD state from DEV state.

---

## 15. Future Admin → Data Authoring

The architecture intentionally supports two Profile authoring sources:

```text
Repository / src/data
          \
           → canonical ProfileContent
          /
Admin → Data editor
```

The Admin → Data editor is future functionality.

When implemented, it must use the existing downstream model:

```text
Profile Draft
    ↓
validation
    ↓
new immutable Profile Variant
    ↓
optional explicit activation
```

The editor must never mutate an existing published Profile Variant or directly overwrite ACTIVE public content.

---

## 16. Important Invariants

```text
Profile publication != Profile activation

Profile activation != application deployment

Profile Variant != legacy profileVersion

Platform Release != Git SHA

Platform Release != Platform Deployment

Deployment Configuration =
    Profile Variant + Platform Release

Legacy history is never assigned fabricated formal IDs.

Public runtime does not depend on owner authentication.

Public components do not depend on repository src/data.

DEV and PROD remain isolated.
```

---

## 17. Relevant Source Files

Frontend:

```text
src/components/admin/Snapshots.js
src/components/admin/CurrentRuntimeCompositionCard.js
src/components/admin/ProfileVariantActivationPanel.js
src/components/admin/ProfileVariantCatalogPanel.js
src/components/admin/PlatformReleaseCatalogPanel.js
src/components/admin/LegacyHistoricalTruth.js
src/utils/snapshots/
```

Backend/control plane:

```text
infra/cdk/lambda/snapshots-handler.ts
infra/cdk/lambda/profile-variant-*
infra/cdk/lambda/platform-release-*
infra/cdk/lambda/platform-deployment-*
infra/cdk/lambda/deployment-configuration-*
infra/cdk/lambda/usage-epoch-*
```

Deployment:

```text
.github/workflows/deploy.yml
.github/workflows/redeploy.yml
scripts/publish-ci-snapshot.mjs
```

---

## 18. Related Documentation

> **[Snapshots Architecture](../architecture/snapshots-architecture.md)**

> **[Analytics Feature Guide](./analytics.md)**

> **[Analytics Architecture](../architecture/analytics-architecture.md)**

> **[Root README](../../README.md)**
