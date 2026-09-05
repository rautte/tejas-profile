# Projects — Feature Guide

The Projects section is a public profile section listing personal/professional projects as a filterable card grid.

For the underlying content model, see:

> **[Snapshots and Profile Platform Architecture](../architecture/snapshots-architecture.md)**

---

## 1. Access

Projects is a public profile section. No owner authentication is required.

```text
Public visitor
    ↓
Projects (nav section)
```

---

## 2. Mental Model

Each entry is one project:

```text
title
status        (e.g. Deployed, Completed, In-Progress)
description
tags
githubUrl / liveUrl (optional)
```

The section heading itself carries a disclaimer: **"(Links under construction)"** — project links are a known work-in-progress, not a bug.

---

## 3. Layout

```text
grid-cols-1 (mobile)
xl:grid-cols-2 (desktop)
```

Each card header shows the title and a colored status pill:

```text
Deployed / Completed  → green pill
anything else (e.g. In-Progress) → indigo pill
```

---

## 4. Filter

A "Filter" button opens a dropdown built from `PROJECT_FILTER_OPTIONS`, grouped by category, with a live count per option (`getCount(option)`).

```text
click Filter
    ↓
dropdown positioned via computeDropdownMetrics(buttonRect)
    ↓
clamped to viewport width/height (never overflows the screen edge)
    ↓
select one or more filter pills
    ↓
grid re-renders with only matching projects
```

The dropdown is rendered through a portal directly under `document.body`, and re-positions itself on scroll/resize while open (`applyDropdownPos`, rAF-throttled) — see the source for the exact positioning algorithm if modifying this.

"Reset Filters" clears the active filter set back to showing every project.

---

## 5. Data Model

Canonical shape (one entry in the `projects` array of `ProfileContent`):

```text
id: string
title: string
status: string
description: string
tags: string[]
githubUrl: string (optional)
liveUrl: string (optional)
```

`projects` is one of the top-level fields of the canonical `ProfileContent` DTO (see `src/utils/profileVariant/`).

---

## 6. Authoring Source

`buildProfileContent()` (`src/profile/content/buildProfileContent.js`) prefers a synced snapshot of the currently ACTIVE Profile Variant when one is present and valid, and falls back to the hand-authored `src/data/projects` module otherwise.

```text
active Profile Variant snapshot (preferred)
        or
src/data/projects (fallback)
```

---

## 7. Owner Editing

Projects are editable from **Admin → Data**, through the generic Content-group / Collection editor (`src/components/admin/Data.js`, `src/components/admin/data-editor/`). There is no Projects-specific admin UI.

```text
Admin → Data
    ↓
edit Projects collection (add/remove/reorder, edit fields, tags)
    ↓
Profile Draft
    ↓
publish → new immutable Profile Variant
    ↓
optional explicit activation
```

---

## 8. DEV vs PROD Behavior

DEV and PROD each have their own ACTIVE Profile Variant. A project added/edited in a DEV Draft is not visible in PROD until a corresponding Variant is published and activated in PROD.

---

## 9. How to Modify

```text
Hand-authored default content:
    edit src/data/projects/index.js

Filter categories / options:
    edit PROJECT_FILTER_OPTIONS in src/components/Projects.js

Owner-published content:
    Admin → Data → Projects → edit → publish → activate

Layout/dropdown behavior:
    edit src/components/Projects.js
```

---

## 10. Important Invariants

```text
Projects is public -- no owner auth required to view it.

The filter dropdown is always clamped to the viewport --
it must never render off-screen regardless of button position.

Editing in Admin -> Data produces a Draft, not a live mutation.

Publishing a Draft does not activate it.
```

---

## 11. Relevant Source Files

```text
src/components/Projects.js
src/data/projects/index.js
src/components/admin/Data.js
src/components/admin/data-editor/
src/profile/content/buildProfileContent.js
src/utils/profileVariant/
```

---

## 12. Related Documentation

> **[Education Feature Guide](./education.md)**

> **[Resume Feature Guide](./resume.md)**

> **[Snapshots and Profile Platform Architecture](../architecture/snapshots-architecture.md)**

> **[Root README](../../README.md)**
