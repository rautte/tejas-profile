// src/profile/draft/constants.js

export const PROFILE_DRAFT_DOCUMENT_SCHEMA =
  "tejas-profile.profile-draft";

export const CURRENT_PROFILE_DRAFT_SCHEMA_VERSION =
  1;


/**
 * Draft document identity is independently versioned from
 * Profile Content.
 *
 * Example:
 *
 * draftSchemaVersion = 2
 * contentSchemaVersion = 5
 *
 * They solve different compatibility problems.
 */
export const PROFILE_DRAFT_EDITABLE_FIELDS =
  Object.freeze([
    "targeting",
    "content",
  ]);