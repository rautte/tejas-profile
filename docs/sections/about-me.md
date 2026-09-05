# About Me — Feature Guide

The About Me section is the first public profile section after the Hero. It shows a profile photo, a pull quote, and a short recruiter-facing narrative.

For the canonical content model this section belongs to, see:

> **[Snapshots and Profile Platform Architecture](../architecture/snapshots-architecture.md)**

---

## 1. Access

About Me is a public section. No owner authentication is involved.

```text
Public Profile
→ About Me
```

---

## 2. Mental Model

About Me renders from a single `aboutMe` object inside the canonical `ProfileContent` DTO.

```text
ProfileContent.aboutMe
    ↓
<AboutMe />
```

The component itself never fetches data. It receives `aboutMe` and a `resolveAsset` function as props from the section switcher in `src/App.js`.

---

## 3. Layout

Two distinct layouts are rendered from the same data, selected by CSS breakpoint (`md:`), not by separate data:

```text
Mobile  (< md):
  photo + "👋 I'm <name>" row
  quote below, centered
  all mobile paragraphs shown, stacked

Desktop (≥ md):
  photo + pull quote, side by side
  3-column paragraph row below, with extra top spacing
```

Mobile and desktop each get their own quote and paragraph set (see Data Model). This is a deliberate content split, not a responsive reflow of the same text — the mobile copy is shorter and more scannable, and the desktop copy is fuller.

---

## 4. Data Model

```text
aboutMe: {
  name: string
  profilePhotoAssetId: string

  mobile: {
    quote: string
    paragraphs: string[]
  }

  desktop: {
    quote: string
    paragraphs: string[]
  }

  // legacy flat fallback, used only if mobile/desktop are absent
  quote?: string
  paragraphs?: string[]
}
```

Only the first 3 entries of `desktop.paragraphs` are rendered (`.slice(0, 3)`), matching the fixed 3-column desktop layout. Extra desktop paragraphs beyond 3 are silently not shown.

`profilePhotoAssetId` is an asset reference, not a URL. It is resolved at render time via `resolveAsset(assetId)`, not read directly.

---

## 5. Authoring Source

`aboutMe` content can come from either of two sources, both producing the same `ProfileContent.aboutMe` shape:

```text
src/data/aboutMe/index.js  (ABOUT_ME constant)
        or
an active Profile Variant's published content
```

`buildProfileContent()` (`src/profile/content/buildProfileContent.js`) is the adapter that resolves which one wins for the app's own built-in repository fallback:

```text
src/profile/content/activeSnapshot.json present and valid?
    yes → use its .content.aboutMe
    no  → use ABOUT_ME from src/data/aboutMe
```

`activeSnapshot.json` is produced by `scripts/sync-repository-profile.mjs`, which pulls the currently active Profile Variant from a chosen stage (PROD by default) and writes it into the repository build so the app's first paint already matches production instead of momentarily showing older hand-authored copy. See the root README's `npm_cd` / `npm_pd` documentation for when this sync should be re-run.

About Me is editable from **Admin → Data**, using the same generic Content-group / Field editor (`src/components/admin/Data.js`, `src/components/admin/data-editor/`) shared across every content group — there is no About-Me-specific admin UI. Editing there never mutates the live public section directly; it only produces a Draft, which must be explicitly published and then explicitly activated before real visitors see it. See Section 6 for the repository-file alternative.

---

## 6. How to Modify

Two supported ways to change what About Me shows:

```text
A) Edit src/data/aboutMe/index.js directly
   → changes the repository fallback content
   → ships on the next frontend deploy

B) Publish a new Profile Variant (Admin → Snapshots)
   → changes the ACTIVE runtime content immediately upon activation
   → does not require a frontend deploy
```

To change the profile photo, add/point `profilePhotoAssetId` at an entry in the asset catalog (`src/data/profileAssets/`) for the repository path, or supply the asset via the Profile Variant's own `assets` array for the active-content path — the two asset resolution paths are independent (see `resolveRuntimeProfileAsset` in `src/profile/runtime/runtimeProfile.js`).

---

## 7. Important Invariants

```text
aboutMe is part of the canonical ProfileContent DTO,
    not a standalone data source

repository ABOUT_ME != the active Profile Variant's aboutMe
    (they may differ; activeSnapshot.json exists to keep
    them in sync deliberately, not automatically)

only 3 desktop paragraphs are ever rendered,
    regardless of how many are authored

profilePhotoAssetId is resolved, never used as a URL directly
```

---

## 8. Relevant Source Files

```text
src/components/AboutMe.js
src/data/aboutMe/index.js
src/data/profileAssets/
src/profile/content/buildProfileContent.js
src/profile/content/activeSnapshot.json
src/profile/runtime/runtimeProfile.js
scripts/sync-repository-profile.mjs
src/utils/ui.js  (SECTION_SHELL, SECTION_CONTAINER, BODY_TEXT)
```

---

## 9. Related Documentation

> **[Snapshots Feature Guide](./snapshots.md)**

> **[Snapshots and Profile Platform Architecture](../architecture/snapshots-architecture.md)**

> **[Root README](../../README.md)**
