// src/profile/draft/draftStatus.js

import {
  canonicalJsonStringify,
} from "../../utils/profileVariant";

import {
  evaluateProfileDraftReadiness,
  validateProfileDraft,
} from "./profileDraft";


export const PROFILE_DRAFT_STATUS =
  Object.freeze({
    CLEAN:
      "clean",

    DRAFT:
      "draft",

    DRAFT_WITH_ERRORS:
      "draft_with_errors",

    READY:
      "ready",

    STALE:
      "stale",

    PUBLISHING:
      "publishing",

    PUBLISHED:
      "published",
  });


function draftHasChanges(
  draft,
  baseTargeting,
  baseContent
) {
  const targetingChanged =
    canonicalJsonStringify(
      draft.targeting
    ) !==
    canonicalJsonStringify(
      baseTargeting ||
        {}
    );

  const contentChanged =
    canonicalJsonStringify(
      draft.content
    ) !==
    canonicalJsonStringify(
      baseContent ||
        {}
    );

  return (
    targetingChanged ||
    contentChanged
  );
}


/**
 * Derives one of PROFILE_DRAFT_STATUS from a draft's relationship
 * to its base composition. PUBLISHING/PUBLISHED are set explicitly
 * by the publish flow (a later phase) rather than derived here.
 */
export function deriveProfileDraftStatus({
  draft,
  baseProfileVariantId,
  baseTargeting,
  baseContent,
}) {
  if (!draft) {
    return PROFILE_DRAFT_STATUS.CLEAN;
  }

  const cleanBaseId =
    String(
      baseProfileVariantId ||
        ""
    ).trim();

  if (
    cleanBaseId &&
    draft.baseProfileVariantId &&
    draft.baseProfileVariantId !==
      cleanBaseId
  ) {
    return PROFILE_DRAFT_STATUS.STALE;
  }

  const validation =
    validateProfileDraft(
      draft
    );

  if (
    !validation.valid
  ) {
    return PROFILE_DRAFT_STATUS.DRAFT_WITH_ERRORS;
  }

  if (
    !draftHasChanges(
      draft,
      baseTargeting,
      baseContent
    )
  ) {
    return PROFILE_DRAFT_STATUS.CLEAN;
  }

  const readiness =
    evaluateProfileDraftReadiness(
      draft
    );

  return readiness.publishable
    ? PROFILE_DRAFT_STATUS.READY
    : PROFILE_DRAFT_STATUS.DRAFT;
}
