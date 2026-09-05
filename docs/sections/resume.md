# Resume — Feature Guide

The Resume section is a public profile section presenting a condensed, resume-style summary plus a downloadable/viewable PDF.

For the underlying content model, see:

> **[Snapshots and Profile Platform Architecture](../architecture/snapshots-architecture.md)**

---

## 1. Access

Resume is a public profile section. No owner authentication is required.

```text
Public visitor
    ↓
Resume (nav section)
```

---

## 2. Mental Model

Resume is **not** the same data as the Experience / Education / Projects / Skills nav sections. It is an independently authored, condensed summary intended to mirror an actual one-page/two-page resume document, rendered as a stack of cards:

```text
Quick Info        (name, View PDF, Download PDF)
Professional Experience
Education
Relevant Projects
Technical Skills
```

Each card is a `SectionCard` — the same lightweight card wrapper used throughout this component.

---

## 3. PDF View / Download

Quick Info exposes two actions:

```text
View PDF    → opens an in-page modal, embeds the PDF via an <iframe>/<object>
Download PDF → <a download="Tejas_Raut_Resume.pdf" href={pdfSrc}>
```

The PDF's URL is resolved the same way every other asset is resolved in this app — through `resolveAsset(pdfAssetId)`, not a static import. See [Asset Resolution](#asset-resolution).

---

<a id="asset-resolution"></a>

## 4. Asset Resolution

```text
resolveAsset(RESUME_DATA.pdfAssetId)
    ↓
resolveRuntimeProfileAsset(runtimeProfile, assetId)
    ↓
repository asset catalog (repository source)
        or
active Profile Variant's asset URL map (active source)
```

See `src/profile/runtime/runtimeProfile.js`. If the PDF asset cannot be resolved for the current runtime source, View/Download must degrade gracefully rather than link to a broken URL — verify this against the current implementation before relying on it in a redesign.

---

## 5. Data Model

Canonical shape (`resume` field of `ProfileContent`):

```text
pdfAssetId: string

(plus the condensed summary content rendered by each SectionCard --
 inspect src/data/resume/index.js for the exact current shape, since
 this is authored independently of the full Experience/Education/
 Projects/Skills sections and may not mirror them field-for-field)
```

`resume` is one of the top-level fields of the canonical `ProfileContent` DTO (see `src/utils/profileVariant/`).

---

## 6. Authoring Source

`buildProfileContent()` (`src/profile/content/buildProfileContent.js`) prefers a synced snapshot of the currently ACTIVE Profile Variant when one is present and valid, and falls back to the hand-authored `src/data/resume` module otherwise.

```text
active Profile Variant snapshot (preferred)
        or
src/data/resume (fallback)
```

---

## 7. Owner Editing

Resume content is editable from **Admin → Data**, through the same generic field/collection editor used for every other content group (`src/components/admin/Data.js`, `src/components/admin/data-editor/`). There is no Resume-specific admin UI.

```text
Admin → Data
    ↓
edit Resume fields / upload a new PDF asset
    ↓
Profile Draft
    ↓
publish → new immutable Profile Variant
    ↓
optional explicit activation
```

---

## 8. DEV vs PROD Behavior

DEV and PROD each have their own ACTIVE Profile Variant, their own repository build, and (per the sync workflow documented in the root README) their own synced repository fallback snapshot. A resume PDF activated in DEV is not visible in PROD until PROD is separately activated/promoted.

---

## 9. How to Modify

```text
Hand-authored default content:
    edit src/data/resume/index.js

Owner-published content / new PDF:
    Admin → Data → Resume → edit / upload → publish → activate

Layout/behavior:
    edit src/components/Resume.js (large file --
    look for the SectionCard usages to find each card's boundary)
```

---

## 10. Important Invariants

```text
Resume is public -- no owner auth required to view it.

Resume content is authored independently of the Experience /
Education / Projects / Skills nav sections -- it is not
automatically derived from them.

The PDF URL is resolved through the same asset-resolution path
as every other asset -- never a static bundled import.

Editing in Admin -> Data produces a Draft, not a live mutation.
```

---

## 11. Relevant Source Files

```text
src/components/Resume.js
src/data/resume/index.js
src/components/admin/Data.js
src/components/admin/data-editor/
src/profile/runtime/runtimeProfile.js
src/profile/content/buildProfileContent.js
src/utils/profileVariant/
```

---

## 12. Related Documentation

> **[Education Feature Guide](./education.md)**

> **[Snapshots and Profile Platform Architecture](../architecture/snapshots-architecture.md)**

> **[Root README](../../README.md)**
