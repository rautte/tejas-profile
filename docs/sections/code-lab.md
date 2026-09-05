# Code Lab — Feature Guide

The Code Lab public profile section is a filterable catalog of sanitized, production-minded code snippets that demonstrate engineering style: secure access, deterministic ingestion, reusable transforms, orchestration, and consistent writes.

For how this section's content is composed, see the Authoring Boundary section of:

> **[Snapshots and Profile Platform Architecture](../architecture/snapshots-architecture.md)**

For repository deployment procedures, see:

> **[Root README](../../README.md)**

---

## 1. Access

Code Lab is a public profile section.

```text
Any visitor
→ Code Lab
```

No owner authentication is required to view it.

---

## 2. Mental Model

Each snippet is one card:

```text
Title
Language badge
"Why" rationale
"From" attribution
Collapsed code preview
    ↓ View
Full syntax-highlighted code
    ↓ Hide
Collapsed again
```

Only 5 snippets render initially. A "See More" control reveals the rest.

Only one snippet can be expanded at a time. Expanding a second snippet collapses the first.

---

## 3. Controls

```text
Filter (Technology / Concept / Domain / Language)
See More / See Less
View / Hide (per snippet)
Copy (per expanded snippet)
```

---

## 4. Filtering

Filter facets are derived from the snippet catalog at render time, not hand-maintained:

```text
Technology  — every distinct value, kept as-is
Language    — every distinct value, kept as-is
Concept     — condensed to the top 12 by frequency; "API Design" is always guaranteed present
Domain      — condensed to the top 8 by frequency, using keyword buckets
              (Data Platforms, Infra / Platform, Backend Systems,
              ML / AI Systems, Observability, Other)
```

Selecting multiple values within one facet is OR'd. Selecting across facets is AND'd.

The Filter panel is rendered through a `createPortal` into `document.body`, clamped to the viewport (`computeDropdownMetrics`) so it never renders off-screen, and closes on outside click or on scroll outside the panel.

---

## 5. Deep Linking

The section reads a URL hash query parameter to pre-filter by attribution:

```text
#/code-lab?from=battleship
#/code-lab?from=syzmaniac,sys_managed
```

`from` is matched against each snippet's `from` field via substring match, case-insensitively, and supports a comma-separated list (URL-encoded commas are also accepted).

Deep-link filtering and dropdown filtering compose: the deep-link result is filtered further by any additional dropdown selections.

---

## 6. Expand / Collapse Behavior

Expanding a snippet:

```text
records a code-snippet-view analytics event (once per snippet per browser session)
marks the snippet "expanded this session" in sessionStorage
scrolls so the card's top pins just under the Hero section (or near viewport top if Hero isn't visible)
```

Switching directly from one expanded snippet to another does not jump instantly — it collapses the previous card while smoothly chasing the new card's pinned scroll position across the collapse animation, so the two transitions never visually fight.

The code block itself renders twice during expansion: a plain `<pre>` layer first (fast paint), then crossfades into a Prism `SyntaxHighlighter` layer (line numbers, theme-aware highlighting, long-line wrapping) once the expand animation has settled.

---

## 7. Copy

The Copy button copies the snippet's raw code (newlines normalized) to the clipboard via the Clipboard API, with a `document.execCommand("copy")` fallback for older/restricted browser contexts. The button shows "Copied" for ~900ms after a successful copy.

---

## 8. Data Model

Each snippet (`src/data/codeLab`) has the shape:

```text
id: string
title: string
lang: string
from: string
why: string
code: string
technology?: string[]
domain?: string[]
concepts?: string[]
```

`codeLab` is one field of the canonical `ProfileContent` DTO. Content for this field currently comes from one of two sources, resolved by `buildProfileContent()`:

```text
1. activeSnapshot.json (if present and schema-valid)
   — a synced copy of whatever Profile Variant is currently ACTIVE
     (see scripts/sync-repository-profile.mjs)

2. src/data/codeLab (hand-authored fallback)
   — used whenever the snapshot is missing, empty, or fails validation
```

Code Lab snippets are editable from **Admin → Data**, using the same generic Content-group / Collection editor (`src/components/admin/Data.js`, `src/components/admin/data-editor/`) shared across every collection-shaped content group — there is no Code-Lab-specific admin UI. Editing there never mutates the live public section directly; it only produces a Draft, which must be explicitly published and then explicitly activated before real visitors see it. The repository fallback (`src/data/codeLab`) is changed separately, by editing that file directly or by re-syncing `activeSnapshot.json` after an activation.

---

## 9. DEV vs PROD Behavior

Code Lab renders identically regardless of stage — its content flows through the same `ProfileContent` composition used by every other public section. DEV and PROD may show different snippets only because they may have different active Profile Variants (or different `activeSnapshot.json` sync history).

---

## 10. How to Modify

```text
Change snippet content
    → edit src/data/codeLab, or publish+activate a new Profile Variant

Change filter facet logic (condensation, bucket keywords)
    → src/components/CodeLab.js: normalizeConcept / normalizeDomain / topByCount

Change dropdown sizing/position behavior
    → src/components/CodeLab.js: DROPDOWN constants + computeDropdownMetrics

Change expand/collapse scroll-pin behavior
    → src/components/CodeLab.js: SWITCH constants + the pin-during-switch effect
```

---

## 11. Troubleshooting

```text
Filter panel appears in the wrong place
    → check computeDropdownMetrics; it clamps to window.innerWidth/innerHeight,
      not the button's own container

A snippet doesn't appear under an expected filter value
    → Technology/Language must match exactly (case-sensitive as authored);
      Concept/Domain pass through normalization first — check
      normalizeConcept/normalizeDomain for how the raw value is bucketed

Deep link (#/code-lab?from=...) shows nothing
    → the match is substring-based against each snippet's `from` field;
      confirm the snippet's `from` value actually contains the needle
```

---

## 12. Important Invariants

```text
codeLab content is editable via Admin → Data's generic collection editor

only one snippet is expanded at a time

expanding a snippet != re-tracking a view already tracked this session

deep-link filtering and dropdown filtering compose (AND), they do not replace each other
```

---

## 13. Relevant Source Files

```text
src/components/CodeLab.js
src/data/codeLab/index.ts
src/data/codeLab/snippets.ts
src/data/codeLab/types.ts
src/profile/content/buildProfileContent.js
src/profile/content/activeSnapshot.json
scripts/sync-repository-profile.mjs
```

---

## 14. Related Documentation

> **[Snapshots and Profile Platform Architecture](../architecture/snapshots-architecture.md)**

> **[Snapshots Feature Guide](./snapshots.md)**

> **[Root README](../../README.md)**
