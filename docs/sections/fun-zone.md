# Fun Zone — Feature Guide

The Fun Zone public profile section showcases small animated SVG game previews, with links to play, view source, and download a self-contained ZIP built from the live SVG.

For how this section's content is composed, see the Authoring Boundary section of:

> **[Snapshots and Profile Platform Architecture](../architecture/snapshots-architecture.md)**

For repository deployment procedures, see:

> **[Root README](../../README.md)**

---

## 1. Access

Fun Zone is a public profile section.

```text
Any visitor
→ Fun Zone
```

No owner authentication is required to view it.

---

## 2. Mental Model

Content and platform are deliberately separated:

```text
Profile content declares:
    which games exist
    which are enabled
    the GitHub URL for each

Platform decides:
    how each game is actually rendered (preview SVG)
    how "Play" routes
    how "Code" downloads a ZIP
    what analytics IDs fire for each action
```

A Profile Variant that references a game ID the current platform does not know about is skipped rather than rendered broken (`GAME_RUNTIME[game.id]` lookup fails closed).

---

## 3. Games

The platform currently knows three games:

```text
minesweeper  — MinesweeperSVG preview
battleship   — BattleshipSVG preview
tictactoe    — TicTacToeSVG preview
```

Each game card shows:

```text
Title
Animated SVG preview (double-click to download a ZIP)
Code (download ZIP)
GitHub (opens the game's repository, if declared)
Play (routes to the game's hash route, e.g. #/fun-zone/minesweeper)
```

---

## 4. Download-as-ZIP

Both double-clicking the preview SVG and clicking "Code" trigger the same ZIP generation:

```text
1. locate the live <svg> DOM node (by its runtime svgId)
2. clone it, ensure xmlns / xmlns:xlink attributes are present
3. serialize to a standalone .svg file
4. wrap the same SVG in a minimal demo/index.html
5. generate a README.md with edit/preview instructions
6. add a placeholder requirements.txt
7. zip all four files with JSZip
8. trigger a browser download via file-saver
```

The ZIP is generated entirely client-side; nothing is uploaded or persisted server-side.

---

## 5. Data Model

Each game entry (`src/data/funZone`) has the shape:

```text
id: string          (must match a key in GAME_RUNTIME)
title: string
enabled: boolean
githubUrl?: string
```

`funZone` (an object with `subtitle` and `games[]`) is one field of the canonical `ProfileContent` DTO. Content for this field currently comes from one of two sources, resolved by `buildProfileContent()`:

```text
1. activeSnapshot.json (if present and schema-valid)
   — a synced copy of whatever Profile Variant is currently ACTIVE
     (see scripts/sync-repository-profile.mjs)

2. src/data/funZone (hand-authored fallback)
   — used whenever the snapshot is missing, empty, or fails validation
```

Fun Zone is editable from **Admin → Data**, using the same generic Content-group / Collection editor (`src/components/admin/Data.js`, `src/components/admin/data-editor/`) shared across every collection-shaped content group — there is no Fun-Zone-specific admin UI. Editing there never mutates the live public section directly; it only produces a Draft, which must be explicitly published and then explicitly activated before real visitors see it. The Profile Variant only declares which games are enabled — `GAME_RUNTIME` in `FunZone.js` still decides how each one is actually rendered, routed, and packaged for download; the editor cannot add a brand-new game, only toggle/reorder the ones the platform already knows how to run. The repository fallback (`src/data/funZone`) is changed separately, by editing that file directly or by re-syncing `activeSnapshot.json` after an activation.

The game preview components, download behavior, and routing (`GAME_RUNTIME` in `src/components/FunZone.js`) are platform code, not Profile content, and cannot be changed by authoring alone.

---

## 6. DEV vs PROD Behavior

Fun Zone renders identically regardless of stage. DEV and PROD may show a different `enabled` set or different `githubUrl` values only because they may have different active Profile Variants.

---

## 7. How to Modify

```text
Enable/disable a game, or change its GitHub link
    → edit src/data/funZone, or publish+activate a new Profile Variant

Add a brand-new game
    → add a preview component to src/components/games/GameSVGs.js
    → register it (svgId, baseName, Preview, codeHref, playHref, analytics IDs)
      in GAME_RUNTIME, src/components/FunZone.js
    → only then does a Profile Variant referencing that game's id render

Change ZIP contents (README wording, demo HTML shell, etc.)
    → downloadZipBySvgId in src/components/FunZone.js
```

---

## 8. Troubleshooting

```text
A game listed in Profile content doesn't render
    → its id has no matching entry in GAME_RUNTIME; the card is silently
      skipped (fail-closed), not shown as broken

Double-click download does nothing
    → the target element (by svgId) or its inner <svg> was not found in
      the DOM at click time

Downloaded ZIP's SVG looks different from what's on screen
    → the clone captures the DOM's current SVG markup at click time,
      including in-flight CSS-driven animation state is not captured
      (only structural markup + inline SVG attributes are serialized)
```

---

## 9. Important Invariants

```text
Profile content declares game availability, never rendering/behavior

an unknown game id fails closed (skipped), never rendered broken

ZIP generation is entirely client-side; no server upload/persistence occurs

funZone content is editable via Admin → Data's generic collection editor, but GAME_RUNTIME (rendering/routing/packaging) is platform code, not authorable content
```

---

## 10. Relevant Source Files

```text
src/components/FunZone.js
src/components/games/GameSVGs.js
src/data/funZone/index.js
src/profile/content/buildProfileContent.js
src/profile/content/activeSnapshot.json
scripts/sync-repository-profile.mjs
```

---

## 11. Related Documentation

> **[Snapshots and Profile Platform Architecture](../architecture/snapshots-architecture.md)**

> **[Snapshots Feature Guide](./snapshots.md)**

> **[Root README](../../README.md)**
