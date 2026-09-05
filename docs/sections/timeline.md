# Timeline — Feature Guide

The Timeline public profile section presents work history as a draggable, clickable, keyboard-navigable year scrubber, showing the selected year's milestone(s) as cards below the rail.

For how this section's content is composed, see the Authoring Boundary section of:

> **[Snapshots and Profile Platform Architecture](../architecture/snapshots-architecture.md)**

For repository deployment procedures, see:

> **[Root README](../../README.md)**

---

## 1. Access

Timeline is a public profile section.

```text
Any visitor
→ Timeline
```

No owner authentication is required to view it.

---

## 2. Mental Model

```text
Timeline entries
    ↓ grouped by "completed year"
Years (sorted chronologically, oldest → newest, left → right on the rail)
    ↓ one year is "active" at a time
Active year's entries render as cards below the rail
```

A year is a milestone's **completed** year: its parsed end year, or the current year if the entry says "Present". Entries with only one parsed year fall back to that year.

If a year has more than one entry (concurrency — e.g. two roles ending the same year), all of that year's entries render as separate cards, ordered "Present" first, then by descending start year.

---

## 3. Controls

```text
Click a year label above the rail
Click anywhere on the rail track
Drag the rail's scrubber pill
← / → arrow keys (moves one year at a time)
```

The section defaults to the most recent year on load, and re-defaults whenever the underlying `timeline` data changes.

---

## 4. Rail Mechanics

Year positions are percentage-based (`index / (totalYears - 1) * 100`), not fixed pixels, so the rail is resolution-independent.

Dragging uses Pointer Events (`onPointerDown` / `onPointerMove` / `onPointerUp` with pointer capture) so the same interaction works for mouse and touch. The nearest year to the pointer's horizontal position is selected continuously while dragging (`pctToNearestIndex`), not only on release.

---

## 5. Chip Derivation

Each rendered card shows up to 6 short "chips" derived from the entry's `description` text via keyword matching (`deriveChips`), e.g.:

```text
"aws" → AWS
"event-driven" / "event" → Event-driven
"real-time" / "realtime" → Real-time
"reliability" / "error" / "recovery" → Reliability
"orchestration" → Orchestration
"etl" → ETL
"olap" → OLAP
"cdk" → CDK
"fastapi" → FastAPI
"go-based" / "golang" / "go " → Go
"distributed" / "systems" / "boundaries" → Systems
```

Chips are computed at render time from `description` text; they are not a separate authored field.

---

## 6. Data Model

Each timeline entry (`src/data/timeline`) has the shape:

```text
company: string
role: string
duration: string   (e.g. "2024 – Present", "2023 – 2024")
description: string
```

`timeline` is one field of the canonical `ProfileContent` DTO (an array). Content for this field currently comes from one of two sources, resolved by `buildProfileContent()`:

```text
1. activeSnapshot.json (if present and schema-valid)
   — a synced copy of whatever Profile Variant is currently ACTIVE
     (see scripts/sync-repository-profile.mjs)

2. src/data/timeline (hand-authored fallback)
   — used whenever the snapshot is missing, empty, or fails validation
```

Timeline entries are editable from **Admin → Data**, using the same generic Content-group / Collection editor (`src/components/admin/Data.js`, `src/components/admin/data-editor/`) shared across every collection-shaped content group — there is no Timeline-specific admin UI. Editing there never mutates the live public section directly; it only produces a Draft, which must be explicitly published and then explicitly activated before real visitors see it. The repository fallback (`src/data/timeline`) is changed separately, by editing that file directly or by re-syncing `activeSnapshot.json` after an activation.

`duration` parsing (`parseDurationYears`) extracts the first two 4-digit years (19xx/20xx) it finds in the string and detects "Present" case-insensitively — it does not otherwise validate the duration string's format.

---

## 7. DEV vs PROD Behavior

Timeline renders identically regardless of stage. DEV and PROD may show different milestones only because they may have different active Profile Variants.

---

## 8. How to Modify

```text
Change milestone content
    → edit src/data/timeline, or publish+activate a new Profile Variant

Change which keywords produce which chips
    → deriveChips in src/components/Timeline.js

Change year-grouping/ordering rules (e.g. concurrency tie-breaks)
    → completedYearKey / compareWithinYear in src/components/Timeline.js
```

---

## 9. Troubleshooting

```text
A milestone appears under the wrong year
    → check its duration string; completedYearKey uses the second
      parsed year, or the current year if "Present" is present,
      or the first parsed year if only one year exists

Expected chips are missing
    → deriveChips only matches specific keyword substrings against
      description (case-insensitive); it does not use technology/tags
      fields the way other sections do

Dragging the rail feels unresponsive on touch
    → confirm the track's `touchAction: "none"` style hasn't been
      removed; without it the browser may intercept the gesture as
      a page scroll
```

---

## 10. Important Invariants

```text
a year's position on the rail is a percentage, not a fixed pixel

multiple entries completing in the same year all render (concurrency
is shown, never silently collapsed to one card)

chips are derived from description text at render time, not authored

Timeline content is editable via Admin → Data's generic collection editor
```

---

## 11. Relevant Source Files

```text
src/components/Timeline.js
src/data/timeline/index.js
src/profile/content/buildProfileContent.js
src/profile/content/activeSnapshot.json
scripts/sync-repository-profile.mjs
```

---

## 12. Related Documentation

> **[Snapshots and Profile Platform Architecture](../architecture/snapshots-architecture.md)**

> **[Snapshots Feature Guide](./snapshots.md)**

> **[Root README](../../README.md)**
