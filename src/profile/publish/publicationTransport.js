// src/profile/publish/publicationTransport.js

import {
  sha256BytesHex,
} from "../../utils/profileVariant";

import {
  getProfileVariant,
  presignProfileVariantAssetPut,
  publishProfileVariant,
  uploadProfileVariantAssetToS3,
} from "../../utils/snapshots/snapshotsApi";

import {
  CURRENT_PROFILE_PUBLICATION_PACKAGE_VERSION,
  PROFILE_PUBLICATION_PACKAGE_SCHEMA,
} from "./constants";


const DEFAULT_API = {
  getProfileVariant,

  presignProfileVariantAssetPut,

  publishProfileVariant,

  uploadProfileVariantAssetToS3,
};


function cleanString(
  value
) {
  return String(
    value || ""
  ).trim();
}


function requirePublication(
  publication
) {
  if (
    !publication ||
    typeof publication !==
      "object" ||
    Array.isArray(
      publication
    )
  ) {
    throw new Error(
      "Profile publication package is required."
    );
  }


  if (
    publication.schema !==
      PROFILE_PUBLICATION_PACKAGE_SCHEMA
  ) {
    throw new Error(
      `Profile publication package schema must be "${PROFILE_PUBLICATION_PACKAGE_SCHEMA}".`
    );
  }


  if (
    publication.packageVersion !==
      CURRENT_PROFILE_PUBLICATION_PACKAGE_VERSION
  ) {
    throw new Error(
      `Unsupported Profile publication package version "${publication.packageVersion}".`
    );
  }


  const profileVariantId =
    cleanString(
      publication
        .profileVariantId
    );

  const contentHash =
    cleanString(
      publication
        .contentHash
    );

  const manifestSha256 =
    cleanString(
      publication
        ?.manifestUpload
        ?.sha256
    );

  const manifestObjectKey =
    cleanString(
      publication
        ?.manifestUpload
        ?.objectKey
    );


  if (!profileVariantId) {
    throw new Error(
      "Profile publication package is missing profileVariantId."
    );
  }


  if (!contentHash) {
    throw new Error(
      "Profile publication package is missing contentHash."
    );
  }


  if (
    !publication.variant ||
    typeof publication.variant !==
      "object"
  ) {
    throw new Error(
      "Profile publication package is missing variant."
    );
  }


  if (
    publication
      .variant
      .profileVariantId !==
      profileVariantId
  ) {
    throw new Error(
      "Profile publication package profileVariantId does not match variant."
    );
  }


  if (
    publication
      .variant
      .contentHash !==
      contentHash
  ) {
    throw new Error(
      "Profile publication package contentHash does not match variant."
    );
  }


  if (!manifestSha256) {
    throw new Error(
      "Profile publication package is missing manifest checksum."
    );
  }


  if (!manifestObjectKey) {
    throw new Error(
      "Profile publication package is missing manifest object key."
    );
  }


  if (
    !Array.isArray(
      publication
        .assetUploads
    )
  ) {
    throw new Error(
      "Profile publication package assetUploads must be an array."
    );
  }


  return {
    profileVariantId,
    contentHash,
    manifestSha256,
    manifestObjectKey,
  };
}


function requireApi(
  api
) {
  const required = [
    "presignProfileVariantAssetPut",
    "uploadProfileVariantAssetToS3",
    "publishProfileVariant",
    "getProfileVariant",
  ];


  for (
    const name of
      required
  ) {
    if (
      typeof api?.[
        name
      ] !== "function"
    ) {
      throw new Error(
        `Profile publication transport requires api.${name}().`
      );
    }
  }


  return api;
}


/**
 * Uploads all immutable Profile Variant assets and commits
 * manifest.json through the owner backend.
 *
 * No Profile activation occurs here.
 */
export async function publishProfilePublication({
  publication,

  readAssetBytes,

  api =
    DEFAULT_API,

  hashOptions,
} = {}) {
  const identity =
    requirePublication(
      publication
    );


  if (
    typeof readAssetBytes !==
      "function"
  ) {
    throw new Error(
      "readAssetBytes is required to publish Profile assets."
    );
  }


  const client =
    requireApi(
      api
    );


  const uploadedAssets = [];


  for (
    const asset of
      publication
        .assetUploads
  ) {
    const assetId =
      cleanString(
        asset?.id
      );

    const sha256 =
      cleanString(
        asset?.sha256
      ).toLowerCase();

    const contentType =
      cleanString(
        asset?.contentType
      );

    const expectedObjectKey =
      cleanString(
        asset?.objectKey
      );


    if (
      !assetId ||
      !sha256 ||
      !contentType ||
      !expectedObjectKey
    ) {
      throw new Error(
        "Profile publication contains an incomplete asset upload descriptor."
      );
    }


    const presign =
      await client
        .presignProfileVariantAssetPut({
          sha256,
          contentType,
        });


    if (
      cleanString(
        presign?.key
      ) !==
        expectedObjectKey
    ) {
      throw new Error(
        `Profile asset "${assetId}" presign key does not match publication package.`
      );
    }


    if (
      presign
        ?.alreadyExists ===
        true
    ) {
      uploadedAssets.push({
        assetId,

        objectKey:
          expectedObjectKey,

        uploaded:
          false,

        alreadyExists:
          true,
      });

      continue;
    }


    const url =
      cleanString(
        presign?.url
      );


    if (!url) {
      throw new Error(
        `Profile asset "${assetId}" presign response is missing upload URL.`
      );
    }


    const bytes =
      await readAssetBytes(
        asset
      );


    if (
      bytes === null ||
      bytes === undefined
    ) {
      throw new Error(
        `Profile asset reader returned no bytes for "${assetId}".`
      );
    }


    /**
     * Re-hash immediately before network upload.
     *
     * This protects against the source changing between
     * buildProfilePublicationPackage() and actual publication.
     */
    const actualSha256 =
      await sha256BytesHex(
        bytes,
        hashOptions
      );


    if (
      actualSha256 !==
        sha256
    ) {
      throw new Error(
        `Profile asset "${assetId}" bytes changed after publication package creation.`
      );
    }


    await client
      .uploadProfileVariantAssetToS3({
        url,

        body:
          bytes,

        requiredHeaders:
          presign
            .requiredHeaders ||
          {},
      });


    uploadedAssets.push({
      assetId,

      objectKey:
        expectedObjectKey,

      uploaded:
        true,

      alreadyExists:
        false,
    });
  }


  /**
   * Manifest publication is the commit point.
   */
  const publishResult =
    await client
      .publishProfileVariant(
        publication
          .variant
      );


  if (
    cleanString(
      publishResult
        ?.profileVariantId
    ) !==
      identity
        .profileVariantId
  ) {
    throw new Error(
      "Published Profile Variant ID does not match the publication package."
    );
  }


  if (
    cleanString(
      publishResult
        ?.contentHash
    ) !==
      identity
        .contentHash
  ) {
    throw new Error(
      "Published Profile Variant contentHash does not match the publication package."
    );
  }


  if (
    cleanString(
      publishResult
        ?.key
    ) !==
      identity
        .manifestObjectKey
  ) {
    throw new Error(
      "Published Profile Variant manifest key does not match the publication package."
    );
  }


  if (
    cleanString(
      publishResult
        ?.manifestSha256
    ) !==
      identity
        .manifestSha256
  ) {
    throw new Error(
      "Published Profile Variant manifest checksum does not match the publication package."
    );
  }


  /**
   * Read-after-write verification.
   *
   * Publication is only reported successful after the stored
   * immutable manifest can be retrieved and independently
   * identified.
   */
  const stored =
    await client
      .getProfileVariant(
        identity
          .profileVariantId
      );


  if (
    cleanString(
      stored
        ?.variant
        ?.profileVariantId
    ) !==
      identity
        .profileVariantId
  ) {
    throw new Error(
      "Stored Profile Variant ID failed read-after-write verification."
    );
  }


  if (
    cleanString(
      stored
        ?.variant
        ?.contentHash
    ) !==
      identity
        .contentHash
  ) {
    throw new Error(
      "Stored Profile Variant contentHash failed read-after-write verification."
    );
  }


  if (
    cleanString(
      stored
        ?.manifestSha256
    ) !==
      identity
        .manifestSha256
  ) {
    throw new Error(
      "Stored Profile Variant manifest checksum failed read-after-write verification."
    );
  }


  if (
    cleanString(
      stored
        ?.key
    ) !==
      identity
        .manifestObjectKey
  ) {
    throw new Error(
      "Stored Profile Variant manifest key failed read-after-write verification."
    );
  }


  return {
    ok:
      true,

    profileVariantId:
      identity
        .profileVariantId,

    contentHash:
      identity
        .contentHash,

    manifestSha256:
      identity
        .manifestSha256,

    manifestObjectKey:
      identity
        .manifestObjectKey,

    alreadyPublished:
      Boolean(
        publishResult
          ?.alreadyPublished
      ),

    assets:
      uploadedAssets,

    publishResult,

    stored:
      stored.variant,
  };
}