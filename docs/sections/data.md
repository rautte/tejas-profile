# Data — Feature Guide

The Data admin section is the owner's authoring surface for editing Profile content, retargeting, and publishing new immutable Profile Variants — without ever mutating what is currently live.

For the underlying control-plane model (Profile Variant, activation, Platform Release, Deployment Configuration), see:

> **[Snapshots and Profile Platform Architecture](../architecture/snapshots-architecture.md)**

---

## 1. Access

Data is available only from owner/admin mode:

```text
Admin
→ Data
```

Public visitors do not use this page, and the public Profile runtime never reads draft state.

---

## 2. Mental Model

Data is a **draft-then-publish** editor. It never edits the active Profile Variant in place.

```text
active Profile Variant (immutable, read-only baseline)
    ↓ Start draft
editable Draft (local, autosaved)
    ↓ edit fields / structure / assets
    ↓ Publish…
new immutable Profile Variant (stored, not yet active)
    ↓ Activate (separate, explicit step)
ACTIVE Profile pointer
```

Publishing and activating are two separate, explicit actions — publishing alone never changes what a visitor sees.

---

## 3. Draft Lifecycle

A draft starts from the currently active Profile Variant's content as its base.

```text
Start draft
    ↓
edit plain text / number / toggle fields → autosaves to localStorage (debounced)
edit structure (order/groups/default section) → same autosave path
stage asset uploads → held client-side until publish
    ↓
Publish… (review) → Discard draft (any time, no trace left)
```

If a draft from a previous browser session exists when the page loads, it is offered back as a **resumable draft** rather than silently discarded or silently resumed.

Draft status is derived from the draft's relationship to its base composition:

```text
clean
draft
draft_with_errors
ready
stale
```

`stale` means the active Profile Variant has changed since the draft was started (e.g. someone else activated a different Variant) — the draft is not silently rebased onto the new baseline.

---

## 4. Three Editing Views

The main editor is a three-pane layout: a left navigation rail, and a right panel showing whichever view is selected.

```text
Content   — one group per ProfileContent section (About Me, Experience, Skills, ...)
Structure — section order, groups, and the default landing section
Assets    — documents & images (profile photo, resume PDF, education logos/certificates, ...)
```

### Content

Each content group is rendered by a **generic, schema-driven field editor** (`GroupPanel` / `FieldRow` / `CollectionEditor` / `ScalarFieldValue`) driven by editor metadata (`src/profile/editor/metadata.js`), not by one hand-built form per section. Adding a new editable field to an existing section is a metadata change, not a new form.

A search box filters the list of content groups by label.

### Structure

Edits the site's navigable section order, per-group navigation order, and the default landing section — the same `structure` field that lives inside `ProfileContent` (see `src/data/structure` for the platform default, and `src/utils/structure`/`resolveSiteStructure` for how a per-Variant structure overrides it). A structural edit here becomes part of the draft and is only real once published + activated.

### Assets

Manages asset-typed fields (images/documents) referenced by content fields via `assetId`. Uploading here stages the asset client-side; it is only durably stored when the draft is published (see `AssetUploadControl`, `collectAssetFieldRefs`).

---

## 5. Publish

"Publish…" opens a review panel (`PublishReviewPanel`) comparing the draft against its base Profile Variant before committing anything.

Publishing:

```text
validates the draft content
    ↓
uploads any staged assets
    ↓
creates one new immutable Profile Variant
    ↓
does NOT activate it
```

The resulting `profileVariantId` is shown in a dismissible success banner, pointing the owner at the "Publish new Profile Variant" panel below to activate it.

---

## 6. Activate / Retarget (Publish new Profile Variant)

The activation panel (`ProfileVariantPublicationPanel`, moved here from the Snapshots page) unifies two related but distinct flows into one shared "activate confirmation" UI:

```text
content-edit path:   newly published Variant  → activate
retarget-only path:  active content unchanged, location/job role changed → republish + activate
```

Both paths funnel through the same confirmation step and, once activation succeeds, the same post-activation success banner — including an **"Activate to PROD"** shortcut when acting on DEV, so an owner does not have to separately navigate to a PROD-specific flow to promote the same content decision.

A retarget request whose location and job role are unchanged from the currently active targeting is rejected before it reaches the backend — retargeting to the same target is treated as a no-op, not a new Variant.

If a freshly published-but-never-activated Profile Variant has no Deployment Configuration yet for the currently active Platform Release, a manual **"Create Deployment Configuration"** action is available rather than leaving activation permanently blocked.

---

## 7. Data Model

Data does not introduce its own storage. It reads and writes the same canonical model used everywhere else in the platform:

```text
ProfileContent          — the DTO this editor edits (see src/utils/profileVariant)
Profile Draft           — client-side only; never sent to the server until publish
Profile Variant         — the immutable object Publish creates
ACTIVE Profile pointer  — what Activate changes
Deployment Configuration — Profile Variant + Platform Release composition
```

---

## 8. Authoring Source Duality

`ProfileContent` can come from either of two authoring sources, and the public runtime does not care which one produced it:

```text
src/data/*  (repository, hand-authored)
        \
         → canonical ProfileContent
        /
Admin → Data  (this page, owner-authored)
```

`src/profile/content/buildProfileContent.js` additionally prefers a synced snapshot of the currently-active Variant (`activeSnapshot.json`, kept up to date by `npm run profile:sync-repository`) over the hand-authored `src/data/*` modules when one is present and valid — purely so the app's very-first-paint fallback matches what's actually live, before the Active Profile API resolves. It is not a third authoring source; it is a cache of whichever Variant was last synced.

---

## 9. DEV vs PROD

DEV and PROD each have their own independent draft/publish/activation state. A draft, published Variant, or active pointer in DEV implies nothing about PROD.

The "Activate to PROD" shortcut is an explicit, separate confirmation — it never happens implicitly as a side effect of a DEV activation.

---

## 10. How to Modify

```text
Main page:               src/components/admin/Data.js
Draft session/autosave:  src/profile/draft/useProfileDraftSession.js
Draft diffing:            src/profile/draft/diffProfileContent.js
Editor field metadata:    src/profile/editor/metadata.js
Publish flow:             src/profile/publish/
Activation/retarget UI:   src/components/admin/ProfileVariantPublicationPanel.js
                           src/components/admin/ProfileVariantActivationPanel.js
Structure editing:        src/data/structure/, src/utils/structure (if present)
Backend publish/activate: infra/cdk/lambda/snapshots-handler.ts
                           (profile-variants/publish, profile activation routes)
```

---

## 11. Troubleshooting

```text
"Autosave failed" banner
    → localStorage write failed (private/incognito quota, or storage full);
      the draft still exists in memory for the current tab session.

Draft marked "stale"
    → the active Profile Variant changed since the draft started;
      review before publishing rather than assuming the draft is still
      based on what is currently live.

Retarget rejected with "no change"
    → the requested location/job role are identical to the currently
      active targeting; this is intentional, not a bug.

Activation blocked, no Deployment Configuration
    → use "Create Deployment Configuration" rather than treating this
      as a dead end.
```

---

## 12. Important Invariants

```text
Publish != Activate

a draft never mutates the active Profile Variant

publishing always creates a NEW immutable Profile Variant,
never an edit to an existing one

a stale draft is never silently rebased onto a new active baseline

retargeting to unchanged location+jobRole is rejected, not
silently accepted as a new Variant

DEV and PROD authoring/activation state are independent
```

---

## 13. Relevant Source Files

Frontend:

```text
src/components/admin/Data.js
src/components/admin/ProfileVariantPublicationPanel.js
src/components/admin/ProfileVariantActivationPanel.js
src/profile/draft/
src/profile/editor/
src/profile/publish/
src/profile/content/buildProfileContent.js
src/profile/content/activeSnapshot.json
scripts/sync-repository-profile.mjs
```

Backend:

```text
infra/cdk/lambda/snapshots-handler.ts
infra/cdk/lambda/profile-variants-contract.ts
infra/cdk/lambda/profile-activation-*
infra/cdk/lambda/deployment-configuration-*
```

---

## 14. Related Documentation

> **[Snapshots Feature Guide](./snapshots.md)**

> **[Snapshots and Profile Platform Architecture](../architecture/snapshots-architecture.md)**

> **[Settings Feature Guide](./settings.md)**

> **[Root README](../../README.md)**
