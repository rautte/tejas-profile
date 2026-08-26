// src/utils/profileVariant/constants.js

/**
 * Stable document family.
 *
 * Do NOT encode the content version into this string.
 * contentSchemaVersion is independently versioned.
 */
export const PROFILE_VARIANT_DOCUMENT_SCHEMA =
  "tejas-profile.profile-variant";

/**
 * The content schema understood by the current platform.
 *
 * Any breaking content-model change must increment this value
 * and provide a deterministic migration from the previous version.
 */
export const CURRENT_PROFILE_CONTENT_SCHEMA_VERSION =
  1;


/**
 * Compatibility states used by future Owner UI / activation checks.
 */
export const PROFILE_VARIANT_COMPATIBILITY =
  Object.freeze({
    READY:
      "ready",

    MIGRATION_REQUIRED:
      "migration_required",

    NEEDS_METADATA:
      "needs_metadata",

    INCOMPATIBLE:
      "incompatible",
  });


/**
 * Canonical recruiter-facing content sections.
 *
 * These represent semantic content, not React/UI implementation.
 */
export const PROFILE_CONTENT_FIELDS =
  Object.freeze([
    "hero",
    "aboutMe",
    "experience",
    "education",
    "skills",
    "resume",
    "projects",
    "codeLab",
    "funZone",
    "timeline",
    "contactLinks",
  ]);


/**
 * Runtime shape expected for schema v1.
 *
 * This keeps structural validation centralized.
 */
export const PROFILE_CONTENT_FIELD_TYPES =
  Object.freeze({
    hero:
      "object",

    aboutMe:
      "object",

    experience:
      "array",

    education:
      "array",

    skills:
      "array",

    resume:
      "object",

    projects:
      "array",

    codeLab:
      "array",

    funZone:
      "object",

    timeline:
      "array",

    contactLinks:
      "array",
  });


/**
 * Variant-owned asset categories.
 *
 * Platform/game/CDN assets do NOT belong here.
 */
export const PROFILE_VARIANT_ASSET_KINDS =
  Object.freeze([
    "profile_photo",
    "resume_pdf",
    "education_image",
    "project_media",
    "attachment",
    "other",
  ]);