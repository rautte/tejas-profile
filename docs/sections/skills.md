# Skills — Feature Guide

The Skills section renders recruiter-facing skills grouped by category, each category shown as a card with an icon and a wrapped row of skill-tag pills.

For the canonical content model this section belongs to, see:

> **[Snapshots and Profile Platform Architecture](../architecture/snapshots-architecture.md)**

---

## 1. Access

Skills is a public section. No owner authentication is involved.

```text
Public Profile
→ Skills
```

---

## 2. Mental Model

Skills renders from a `skills` array inside the canonical `ProfileContent` DTO.

```text
ProfileContent.skills[]
    ↓
<Skills skills={...} />
    ↓
one category card per entry
```

Icon and accent color per category are a **platform** concern, not authored content — see Section 4.

---

## 3. Layout

```text
Mobile / narrow:  1 column
md and above:     2 columns
```

This is a fixed `md:grid-cols-2` breakpoint, distinct from the `xl:grid-cols-2` pattern used by Experience/Education/Timeline — Skills cards are shorter, so they comfortably support 2 columns starting at a narrower breakpoint.

---

## 4. Data Model

```text
skills: [
  {
    category: string
    skills: string[]
  },
  ...
]
```

`category` is matched (exact string) against a fixed presentation table in the component itself:

```text
SKILL_PRESENTATION = {
  "Programming Languages":       FaCode
  "Python Libraries & ML/AI":    FaCode
  "AWS":                         FaAws
  "Databases & Big Data":        FaDatabase
  "Cloud & DevOps":              FaCloud
  "Frameworks & Web":            FaTools
  "Visualization & ERP":         FaChartBar
}
```

A `category` string that does not match this table falls back to a generic `FaTools` icon with neutral gray styling — it still renders correctly, just without a category-specific icon/color. Authored content is never rejected for an unrecognized category.

---

## 5. Authoring Source

Same dual-source model as every other `ProfileContent` field (see [About Me — Authoring Source](./about-me.md#5-authoring-source) for the full mechanism):

```text
src/data/skills/index.js  (SKILLS constant)
        or
an active Profile Variant's published content
```

resolved by `buildProfileContent()`, preferring `activeSnapshot.json` when present and valid.

Skills is editable from **Admin → Data**, using the same generic Content-group / Collection editor (`src/components/admin/Data.js`, `src/components/admin/data-editor/`) shared across every collection-shaped content group — there is no Skills-specific admin UI. Editing there never mutates the live public section directly; it only produces a Draft, which must be explicitly published and then explicitly activated before real visitors see it.

---

## 6. How to Modify

```text
A) Edit src/data/skills/index.js directly
   → changes the repository fallback content
   → ships on the next frontend deploy

B) Publish a new Profile Variant (Admin → Snapshots)
   → changes the ACTIVE runtime content immediately upon activation
```

To add a new category with its own icon/color, add an entry to `SKILL_PRESENTATION` in `src/components/Skills.js` — this is a platform/code change, not a content change, and requires a frontend deploy regardless of which authoring source is used for the category text itself.

---

## 7. Important Invariants

```text
skills is part of the canonical ProfileContent DTO,
    not a standalone data source

icon/color presentation is platform code,
    keyed by exact category string match,
    never authored as part of ProfileContent

an unrecognized category degrades to a generic icon,
    it never fails to render

repository SKILLS != the active Profile Variant's skills
    (activeSnapshot.json exists to keep them in sync deliberately)
```

---

## 8. Relevant Source Files

```text
src/components/Skills.js
src/data/skills/index.js
src/components/shared/Pill.js
src/profile/content/buildProfileContent.js
src/utils/ui.js  (CARD_SURFACE, CARD_ROUNDED_XL, SECTION_SHELL, SECTION_CONTAINER)
```

---

## 9. Related Documentation

> **[About Me Feature Guide](./about-me.md)**

> **[Experience Feature Guide](./experience.md)**

> **[Snapshots and Profile Platform Architecture](../architecture/snapshots-architecture.md)**

> **[Root README](../../README.md)**
