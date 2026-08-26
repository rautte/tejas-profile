// src/profile/editor/constants.js

export const PROFILE_EDITOR_METADATA_DOCUMENT_SCHEMA =
  "tejas-profile.profile-editor-metadata";

export const CURRENT_PROFILE_EDITOR_METADATA_VERSION =
  1;


/**
 * Pure semantic editor types.
 *
 * These do NOT dictate which React component the future
 * Admin → Data page must use.
 */
export const PROFILE_EDITOR_FIELD_KINDS =
  Object.freeze([
    "text",
    "textarea",
    "number",
    "boolean",
    "url",
    "email",
    "phone",
    "datetime",
    "asset",
    "string-list",
    "record-string-list",
    "select",
    "code",
    "object",
    "collection",
  ]);