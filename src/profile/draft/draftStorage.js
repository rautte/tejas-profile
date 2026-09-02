// src/profile/draft/draftStorage.js

const STORAGE_KEY_PREFIX =
  "tejas-profile:owner-draft:";


function cleanString(
  value
) {
  return String(
    value || ""
  ).trim();
}


function storageKey(
  baseProfileVariantId
) {
  const clean =
    cleanString(
      baseProfileVariantId
    );

  if (!clean) {
    throw new Error(
      "baseProfileVariantId is required to address a stored Profile Draft."
    );
  }

  return `${STORAGE_KEY_PREFIX}${clean}`;
}


function defaultStorage() {
  return typeof window !==
    "undefined"
    ? window.localStorage
    : null;
}


/**
 * Owner drafts persist to localStorage, scoped per base Profile
 * Variant. This is deliberately not a new backend/DynamoDB surface:
 * "resume later" only needs to survive across page loads on the
 * same device for the actual single-owner workflow this site has.
 * Cross-device draft sync is a separate decision for if it's ever
 * actually needed.
 */
export function saveDraftToStorage(
  draft,
  {
    storage =
      defaultStorage(),
  } = {}
) {
  if (!storage) {
    return false;
  }

  const baseId =
    draft
      ?.baseProfileVariantId;

  if (!baseId) {
    throw new Error(
      "Draft is missing baseProfileVariantId."
    );
  }

  storage.setItem(
    storageKey(
      baseId
    ),

    JSON.stringify(
      draft
    )
  );

  return true;
}


export function loadDraftFromStorage(
  baseProfileVariantId,
  {
    storage =
      defaultStorage(),
  } = {}
) {
  if (!storage) {
    return null;
  }

  let raw;

  try {
    raw =
      storage.getItem(
        storageKey(
          baseProfileVariantId
        )
      );
  } catch {
    return null;
  }

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(
      raw
    );
  } catch {
    // Corrupt entry — fail closed rather than surface a parse
    // error to the owner.
    return null;
  }
}


export function discardDraftFromStorage(
  baseProfileVariantId,
  {
    storage =
      defaultStorage(),
  } = {}
) {
  if (!storage) {
    return false;
  }

  storage.removeItem(
    storageKey(
      baseProfileVariantId
    )
  );

  return true;
}
