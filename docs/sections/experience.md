# Experience — Feature Guide

The Experience section renders recruiter-facing work history as a grid of cards, each with highlights and skill tags.

For the canonical content model this section belongs to, see:

> **[Snapshots and Profile Platform Architecture](../architecture/snapshots-architecture.md)**

---

## 1. Access

Experience is a public section. No owner authentication is involved.

```text
Public Profile
→ Experience
```

---

## 2. Mental Model

Experience renders from an `experience` array inside the canonical `ProfileContent` DTO.

```text
ProfileContent.experience[]
    ↓
<Experience experience={...} />
    ↓
one <ExperienceCard /> per entry
```

Entries are rendered in array order. There is no client-side sorting, filtering, or date-based re-ordering — authoring order is display order.

---

## 3. Layout

```text
Mobile / narrow:  1 column
xl and above:     2 columns
```

Each card shows, top to bottom: company + role + employment type + duration/location, then a bulleted highlights list, then a wrapped row of skill-tag pills.

---

## 4. Data Model

```text
experience: [
  {
    company: string
    role: string
    employmentType?: string
    duration: string
    location?: string
    highlights?: string[]
    tags?: string[]
  },
  ...
]
```

All fields except `company`, `role`, and `duration` are optional and conditionally rendered — `employmentType` and `location` are appended inline with a "•" separator only when present; `highlights` and `tags` sections are omitted entirely when empty.

---

## 5. Authoring Source

Same dual-source model as every other `ProfileContent` field (see [About Me — Authoring Source](./about-me.md#5-authoring-source) for the full mechanism):

```text
src/data/experience/index.js  (EXPERIENCE constant)
        or
an active Profile Variant's published content
```

resolved by `buildProfileContent()`, preferring `activeSnapshot.json` when present and valid.

Experience is editable from **Admin → Data**, using the same generic Content-group / Collection editor (`src/components/admin/Data.js`, `src/components/admin/data-editor/`) shared across every collection-shaped content group — there is no Experience-specific admin UI. Editing there never mutates the live public section directly; it only produces a Draft, which must be explicitly published and then explicitly activated before real visitors see it.

---

## 6. How to Modify

```text
A) Edit src/data/experience/index.js directly
   → changes the repository fallback content
   → ships on the next frontend deploy

B) Publish a new Profile Variant (Admin → Snapshots)
   → changes the ACTIVE runtime content immediately upon activation
```

To reorder entries, reorder the array — there is no separate ordering field.

---

## 7. Important Invariants

```text
experience is part of the canonical ProfileContent DTO,
    not a standalone data source

array order is display order; there is no sort/date logic

repository EXPERIENCE != the active Profile Variant's experience
    (activeSnapshot.json exists to keep them in sync deliberately)
```

---

## 8. Relevant Source Files

```text
src/components/Experience.js
src/data/experience/index.js
src/components/shared/Pill.js
src/profile/content/buildProfileContent.js
src/utils/ui.js  (CARD_SURFACE, CARD_ROUNDED_XL, SECTION_SHELL, SECTION_CONTAINER, BODY_TEXT)
```

---

## 9. Related Documentation

> **[About Me Feature Guide](./about-me.md)**

> **[Snapshots Feature Guide](./snapshots.md)**

> **[Snapshots and Profile Platform Architecture](../architecture/snapshots-architecture.md)**

> **[Root README](../../README.md)**
