// src/profile/variant/profileVariant.js

import {
  CURRENT_PROFILE_CONTENT_SCHEMA_VERSION,
  PROFILE_VARIANT_SCHEMA_ID_V1,
  canonicalJsonStringify,
  cloneJson,
  createProfileVariantDocument,
  sha256Hex,
  validateProfileVariantDocument,
} from "../../utils/profileVariant";

import {
  evaluateProfileDraftReadiness,
} from "../draft";


const SHA256_RE =
  /^[a-f0-9]{64}$/i;


function cleanString(
  value
) {
  return String(
    value || ""
  ).trim();
}


function isPlainObject(
  value
) {
  return Boolean(
    value &&
    typeof value ===
      "object" &&
    !Array.isArray(
      value
    )
  );
}


function normalizePublishedAsset(
  asset
) {
  if (
    !isPlainObject(
      asset
    )
  ) {
    throw new Error(
      "Published Profile Variant asset must be an object."
    );
  }


  const normalized = {
    id:
      cleanString(
        asset.id
      ),

    kind:
      cleanString(
        asset.kind
      ),

    objectKey:
      cleanString(
        asset.objectKey
      ),

    sha256:
      cleanString(
        asset.sha256
      )
        .toLowerCase(),

    contentType:
      cleanString(
        asset.contentType
      ),
  };


  if (
    asset.sourcePath
  ) {
    normalized.sourcePath =
      cleanString(
        asset.sourcePath
      );
  }


  if (
    !normalized.id ||
    !normalized.kind ||
    !normalized.objectKey ||
    !normalized.contentType ||
    !SHA256_RE.test(
      normalized.sha256
    )
  ) {
    throw new Error(
      `Invalid published Profile Variant asset "${normalized.id || "unknown"}".`
    );
  }


  return normalized;
}


export function normalizePublishedAssets(
  assets = []
) {
  if (
    !Array.isArray(
      assets
    )
  ) {
    throw new Error(
      "Published Profile Variant assets must be an array."
    );
  }


  const normalized =
    assets.map(
      normalizePublishedAsset
    );


  const seenIds =
    new Set();


  for (
    const asset of
      normalized
  ) {
    if (
      seenIds.has(
        asset.id
      )
    ) {
      throw new Error(
        `Duplicate published Profile Variant asset ID "${asset.id}".`
      );
    }

    seenIds.add(
      asset.id
    );
  }


  return normalized.sort(
    (a, b) =>
      a.id.localeCompare(
        b.id
      )
  );
}


/**
 * Semantic identity payload.
 *
 * Excluded intentionally:
 * - profileVariantId
 * - createdAt
 * - gitSha
 * - checkpoint tag
 * - source snapshot
 * - platform version
 *
 * Those are identity/provenance of a publication event,
 * not the recruiter-facing profile itself.
 */
export function createProfileVariantContentIdentityPayload(
  {
    targeting,
    content,
    assets,
  }
) {
  return {
    schemaId:
      PROFILE_VARIANT_SCHEMA_ID_V1,

    contentSchemaVersion:
      CURRENT_PROFILE_CONTENT_SCHEMA_VERSION,

    targeting:
      cloneJson(
        targeting
      ),

    content:
      cloneJson(
        content
      ),

    assets:
      normalizePublishedAssets(
        assets
      ).map(
        (asset) => ({
          id:
            asset.id,

          kind:
            asset.kind,

          sha256:
            asset.sha256,

          contentType:
            asset.contentType,
        })
      ),
  };
}


export async function computeProfileVariantContentHash(
  payload,
  hashOptions
) {
  return sha256Hex(
    canonicalJsonStringify(
      payload
    ),
    hashOptions
  );
}


/**
 * Converts a publish-ready mutable Draft into an immutable
 * Profile Variant document.
 *
 * This function performs no storage or network operation.
 */
export async function buildProfileVariantFromDraft(
  {
    draft,

    profileVariantId,

    assets = [],

    provenance = {},

    createdAt =
      new Date()
        .toISOString(),

    hashOptions,
  } = {}
) {
  const readiness =
    evaluateProfileDraftReadiness(
      draft
    );


  if (
    !readiness.valid
  ) {
    throw new Error(
      [
        "Cannot publish invalid Profile Draft.",
        ...readiness.errors,
      ].join(" ")
    );
  }


  if (
    !readiness.publishable
  ) {
    throw new Error(
      `Cannot publish Profile Draft: missing targeting metadata ${readiness.missingTargeting.join(
        ", "
      )}.`
    );
  }


  const normalizedAssets =
    normalizePublishedAssets(
      assets
    );


  const identityPayload =
    createProfileVariantContentIdentityPayload({
      targeting:
        draft.targeting,

      content:
        draft.content,

      assets:
        normalizedAssets,
    });


  const contentHash =
    await computeProfileVariantContentHash(
      identityPayload,
      hashOptions
    );


  const document =
    createProfileVariantDocument({
      profileVariantId,

      schemaId:
        PROFILE_VARIANT_SCHEMA_ID_V1,

      contentHash,

      contentSchemaVersion:
        CURRENT_PROFILE_CONTENT_SCHEMA_VERSION,

      createdAt,

      targeting:
        draft.targeting,

      provenance,

      content:
        draft.content,

      assets:
        normalizedAssets,
    });


  const validation =
    validateProfileVariantDocument(
      document
    );


  if (
    !validation.valid
  ) {
    throw new Error(
      [
        "Published Profile Variant is invalid.",
        ...validation.errors,
      ].join(" ")
    );
  }


  return document;
}