# Education — Feature Guide

The Education section is a public profile section listing formal education history as a responsive card grid.

For the underlying content model, see:

> **[Snapshots and Profile Platform Architecture](../architecture/snapshots-architecture.md)**

---

## 1. Access

Education is a public profile section. No owner authentication is required.

```text
Public visitor
    ↓
Education (nav section)
```

---

## 2. Mental Model

Each entry represents one school/program.

```text
school
degree
duration
location
logo (asset)
coursework (tags)
highlights (bullets)
tags (bullets, general)
activities (inline text)
badge + attachment (optional certificate)
```

Not every entry has every optional field. Coursework, highlights, tags, activities, and the badge/attachment pair are all conditionally rendered.

---

## 3. Layout

Cards render in a grid:

```text
grid-cols-1 (mobile)
xl:grid-cols-2 (desktop)
```

Each card shows a header row (logo, school name, optional verified badge, degree, duration/location), followed by any of: Coursework, Activities, Highlights, Tags.

---

## 4. Certificate / Attachment Modal

An entry with `badge`, `attachment`, and a resolvable attachment image renders a small "verified" badge button next to the school name.

```text
click badge
    ↓
portal-based modal
    ↓
full attachment image (max-h-[80vh], scrollable)
```

The modal is rendered via `createPortal` directly under `document.body`, and temporarily locks the page's own scroll container while open.

If the attachment asset cannot be resolved, the badge is not rendered at all — a missing asset never produces a broken image or a dead button.

---

## 5. Asset Resolution

Logos and attachment images are not imported directly. They are resolved at runtime through a `resolveAsset(assetId)` prop passed down from `App.js`.

```text
resolveAsset(assetId)
    ↓
resolveRuntimeProfileAsset(runtimeProfile, assetId)
    ↓
repository asset catalog (repository source)
        or
active Profile Variant's asset URL map (active source)
```

See `src/profile/runtime/runtimeProfile.js`. Which branch is used depends on whether the current runtime is serving repository fallback content or an activated Profile Variant (see [Related Documentation](#related-documentation)) — an historical Variant's assets are never silently backfilled from today's repository asset catalog.

---

## 6. Data Model

Canonical shape (one entry in the `education` array of `ProfileContent`):

```text
school: string
logoAssetId: string
degree: string
duration: string
location: string
coursework: string[]
highlights: string[]
tags: string[]
activities: string[]
badge: string
attachment: { title: string, assetId: string }
```

`education` is one of the top-level fields of the canonical `ProfileContent` DTO (see `src/utils/profileVariant/`).

---

## 7. Authoring Source

Education content is not always hand-authored. `buildProfileContent()` (`src/profile/content/buildProfileContent.js`) prefers a synced snapshot of the currently ACTIVE Profile Variant when one is present and valid, and falls back to the hand-authored `src/data/education` module otherwise.

```text
active Profile Variant snapshot (preferred)
        or
src/data/education (fallback)
```

Either source produces the same canonical shape described above — the section component has no knowledge of which source was used.

---

## 8. Owner Editing

Education entries are editable from **Admin → Data**, using the generic Content-group / Collection editor (`src/components/admin/Data.js`, `src/components/admin/data-editor/`). There is no Education-specific admin UI — the same field/collection editing surface is shared across every collection-shaped content group.

```text
Admin → Data
    ↓
edit Education collection (add/remove/reorder entries, edit fields, upload logo/attachment assets)
    ↓
Profile Draft
    ↓
publish → new immutable Profile Variant
    ↓
optional explicit activation
```

Editing in Admin → Data never mutates the live public section directly — it only ever produces a new Draft, which must be explicitly published and then explicitly activated before real visitors see it.

---

## 9. DEV vs PROD Behavior

DEV and PROD each have their own ACTIVE Profile Variant and their own repository build. The repository fallback snapshot committed for one stage is not automatically applicable to the other — see [Related Documentation](#related-documentation) for how the fallback is kept in sync per stage.

---

## 10. How to Modify

```text
Hand-authored default content:
    edit src/data/education/index.js

Owner-published content:
    Admin → Data → Education → edit → publish → activate

Layout/behavior:
    edit src/components/Education.js
```

---

## 11. Important Invariants

```text
Education is public -- no owner auth required to view it.

A missing/unresolvable asset never renders a broken image.

An historical Profile Variant's assets are resolved only from
that Variant's own asset map, never from today's repository
asset catalog.

Editing in Admin -> Data produces a Draft, not a live mutation.

Publishing a Draft does not activate it.
```

---

## 12. Relevant Source Files

```text
src/components/Education.js
src/data/education/index.js
src/components/admin/Data.js
src/components/admin/data-editor/
src/profile/runtime/runtimeProfile.js
src/profile/content/buildProfileContent.js
src/utils/profileVariant/
```

---

<a id="related-documentation"></a>

## 13. Related Documentation

> **[Snapshots Feature Guide](./snapshots.md)**

> **[Snapshots and Profile Platform Architecture](../architecture/snapshots-architecture.md)**

> **[Root README](../../README.md)**
