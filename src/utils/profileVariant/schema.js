// src/utils/profileVariant/schema.js

import {
  CURRENT_PROFILE_CONTENT_SCHEMA_VERSION,
  PROFILE_VARIANT_DOCUMENT_SCHEMA,
} from "./constants";

import {
  assertJsonCompatible,
  cloneJson,
} from "./json";

import {
  PROFILE_VARIANT_SCHEMA_ID_V1,
} from "./schemas/v1";


function cleanString(
  value
) {
  return String(
    value || ""
  ).trim();
}


function nullableString(
  value
) {
  const normalized =
    cleanString(
      value
    );

  return (
    normalized ||
    null
  );
}


function plainObjectOrEmpty(
  value
) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return {};
  }

  return value;
}


export function createEmptyProfileContent() {
  return {
    hero: {},

    aboutMe: {},

    experience: [],

    education: [],

    skills: [],

    resume: {},

    projects: [],

    codeLab: [],

    funZone: {},

    timeline: [],

    contactLinks: [],
    };
}

/**
 * Creates an independent canonical ProfileContent DTO.
 *
 * This function knows nothing about where content came from.
 * Repo data, a future Admin editor, imports, or migration tools
 * can all provide the same semantic content shape.
 *
 * Validation is deliberately separate so callers can decide
 * whether they are working with an incomplete draft or with
 * publishable content.
 */
export function createProfileContent(
  content = {}
) {
  const source =
    plainObjectOrEmpty(
      content
    );

  return {
    ...createEmptyProfileContent(),

    ...cloneJson(
      source
    ),
  };
}


/**
 * Creates the canonical Profile Variant envelope.
 *
 * This does NOT generate profileVariantId.
 * Identity generation belongs to the publishing layer in P2.
 */
export function createProfileVariantDocument(
  {
    profileVariantId,

    schemaId =
      PROFILE_VARIANT_SCHEMA_ID_V1,

    contentHash,

    contentSchemaVersion =
      CURRENT_PROFILE_CONTENT_SCHEMA_VERSION,

    createdAt =
      new Date()
        .toISOString(),

    targeting = {},

    provenance = {},

    content = {},

    assets = [],
  } = {}
) {
  const normalizedContent =
    createProfileContent(
        content
    );

  const normalizedTargeting = {
    location:
      cleanString(
        targeting
          ?.location
      ),

    jobRole:
      cleanString(
        targeting
          ?.jobRole
      ),
  };

  const normalizedProvenance = {
    legacyProfileVersionId:
      nullableString(
        provenance
          ?.legacyProfileVersionId
      ),

    platformVersionId:
      nullableString(
        provenance
          ?.platformVersionId
      ),

    gitSha:
      nullableString(
        provenance
          ?.gitSha
      ),

    checkpointTag:
      nullableString(
        provenance
          ?.checkpointTag
      ),

    sourceSnapshotKey:
      nullableString(
        provenance
          ?.sourceSnapshotKey
      ),
  };

  const normalizedAssets =
    Array.isArray(
      assets
    )
      ? cloneJson(
          assets
        )
      : assets;

  const document = {
    schema:
      PROFILE_VARIANT_DOCUMENT_SCHEMA,

    schemaId:
      cleanString(
        schemaId
    ),

    contentSchemaVersion,

    profileVariantId:
      cleanString(
        profileVariantId
      ),

    contentHash:
      cleanString(
        contentHash
    ),

    createdAt:
      cleanString(
        createdAt
      ),

    targeting:
      normalizedTargeting,

    provenance:
      normalizedProvenance,

    content:
      normalizedContent,

    assets:
      normalizedAssets,
  };

  assertJsonCompatible(
    document
  );

  return document;
}