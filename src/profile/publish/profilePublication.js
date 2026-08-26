// src/profile/publish/profilePublication.js

import {
  canonicalJsonStringify,
  sha256Hex,
} from "../../utils/profileVariant";

import {
  buildProfileVariantFromDraft,
} from "../variant";

import {
  CURRENT_PROFILE_PUBLICATION_PACKAGE_VERSION,
  PROFILE_PUBLICATION_PACKAGE_SCHEMA,
  PROFILE_VARIANT_MANIFEST_CONTENT_TYPE,
  PROFILE_VARIANT_STORAGE_PREFIXES,
} from "./constants";

import {
  materializePublishedProfileAssets,
} from "./profileAssets";


function manifestObjectKey(
  profileVariantId
) {
  return (
    PROFILE_VARIANT_STORAGE_PREFIXES
      .variants +
    profileVariantId +
    "/manifest.json"
  );
}


/**
 * Builds the complete immutable publication package.
 *
 * No network.
 * No filesystem assumptions.
 * No AWS.
 *
 * The caller supplies asset bytes.
 */
export async function buildProfilePublicationPackage(
  {
    draft,

    profileVariantId,

    provenance = {},

    createdAt =
      new Date()
        .toISOString(),

    assetCatalog,

    readAssetBytes,

    hashOptions,
  } = {}
) {
  const assetUploads =
    await materializePublishedProfileAssets({
      content:
        draft?.content,

      catalog:
        assetCatalog,

      readAssetBytes,

      hashOptions,
    });


  const variant =
    await buildProfileVariantFromDraft({
      draft,

      profileVariantId,

      assets:
        assetUploads,

      provenance,

      createdAt,

      hashOptions,
    });


  /**
   * Use canonical JSON so the exact manifest bytes are
   * reproducible for the same immutable document.
   */
  const manifestBody =
    canonicalJsonStringify(
      variant
    );


  const manifestSha256 =
    await sha256Hex(
      manifestBody,
      hashOptions
    );


  const manifestUpload = {
    objectKey:
      manifestObjectKey(
        variant
          .profileVariantId
      ),

    contentType:
      PROFILE_VARIANT_MANIFEST_CONTENT_TYPE,

    sha256:
      manifestSha256,

    body:
      manifestBody,
  };


  return {
    schema:
      PROFILE_PUBLICATION_PACKAGE_SCHEMA,

    packageVersion:
      CURRENT_PROFILE_PUBLICATION_PACKAGE_VERSION,

    profileVariantId:
      variant
        .profileVariantId,

    contentHash:
      variant
        .contentHash,

    variant,

    manifestUpload,

    assetUploads,
  };
}