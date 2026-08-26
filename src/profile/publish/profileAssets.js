// src/profile/publish/profileAssets.js

import {
  PROFILE_ASSET_CATALOG,
} from "../../data/profileAssets";

import {
  PROFILE_VARIANT_ASSET_KINDS,
  cloneJson,
  sha256BytesHex,
} from "../../utils/profileVariant";

import {
  PROFILE_VARIANT_STORAGE_PREFIXES,
} from "./constants";


const SHA256_RE =
  /^[a-f0-9]{64}$/i;


function cleanString(
  value
) {
  return String(
    value || ""
  ).trim();
}


function isObject(
  value
) {
  return Boolean(
    value &&
    typeof value ===
      "object"
  );
}


function isAssetReferenceKey(
  key
) {
  const normalized =
    String(
      key || ""
    );

  return (
    normalized ===
      "assetId" ||
    normalized.endsWith(
      "AssetId"
    )
  );
}


/**
 * Recursively discovers semantic asset references from
 * ProfileContent.
 *
 * This deliberately avoids hardcoding:
 *
 * aboutMe.profilePhotoAssetId
 * resume.pdfAssetId
 * education[*].logoAssetId
 * ...
 *
 * Future schema fields following the AssetId convention are
 * automatically covered.
 */
export function collectProfileAssetIds(
  content
) {
  const ids =
    new Set();


  function visit(
    value
  ) {
    if (
      Array.isArray(
        value
      )
    ) {
      value.forEach(
        visit
      );

      return;
    }


    if (
      !isObject(
        value
      )
    ) {
      return;
    }


    for (
      const [
        key,
        child,
      ] of
        Object.entries(
          value
        )
    ) {
      if (
        isAssetReferenceKey(
          key
        )
      ) {
        if (
          child === null ||
          child === undefined ||
          child === ""
        ) {
          continue;
        }


        if (
          typeof child !==
            "string"
        ) {
          throw new Error(
            `Profile asset reference "${key}" must be a string.`
          );
        }


        const assetId =
          cleanString(
            child
          );


        if (assetId) {
          ids.add(
            assetId
          );
        }

        continue;
      }


      visit(
        child
      );
    }
  }


  visit(
    content
  );


  return Array.from(
    ids
  ).sort();
}


/**
 * Resolves every ProfileContent asset reference against the
 * authoring asset catalog.
 *
 * Missing definitions fail closed.
 */
export function resolveProfileAssetDefinitions(
  content,
  catalog =
    PROFILE_ASSET_CATALOG
) {
  const assetIds =
    collectProfileAssetIds(
      content
    );


  return assetIds.map(
    (assetId) => {
      const definition =
        catalog?.[
          assetId
        ];


      if (!definition) {
        throw new Error(
          `Profile asset "${assetId}" is referenced by ProfileContent but is missing from the asset catalog.`
        );
      }


      const kind =
        cleanString(
          definition.kind
        );

      const sourcePath =
        cleanString(
          definition
            .sourcePath
        );

      const contentType =
        cleanString(
          definition
            .contentType
        );


      if (
        !PROFILE_VARIANT_ASSET_KINDS
          .includes(
            kind
          )
      ) {
        throw new Error(
          `Profile asset "${assetId}" has unsupported kind "${kind}".`
        );
      }


      if (!sourcePath) {
        throw new Error(
          `Profile asset "${assetId}" is missing sourcePath.`
        );
      }


      if (!contentType) {
        throw new Error(
          `Profile asset "${assetId}" is missing contentType.`
        );
      }


      return {
        id:
          assetId,

        kind,

        sourcePath,

        contentType,
      };
    }
  );
}


function safeContentTypePart(
  contentType
) {
  return cleanString(
    contentType
  )
    .toLowerCase()
    .replace(
      /[^a-z0-9.+-]+/g,
      "_"
    )
    .slice(
      0,
      120
    );
}


/**
 * Assets are addressed by immutable bytes + content type,
 * not by profileVariantId.
 *
 * This permits safe reuse across variants.
 */
export function createContentAddressedProfileAssetObjectKey(
  {
    sha256,
    contentType,
  }
) {
  const normalizedHash =
    cleanString(
      sha256
    ).toLowerCase();


  if (
    !SHA256_RE.test(
      normalizedHash
    )
  ) {
    throw new Error(
      "Profile asset object key requires a valid SHA-256 digest."
    );
  }


  const typePart =
    safeContentTypePart(
      contentType
    );


  if (!typePart) {
    throw new Error(
      "Profile asset object key requires contentType."
    );
  }


  return (
    PROFILE_VARIANT_STORAGE_PREFIXES
      .assets +
    normalizedHash +
    "/" +
    typePart
  );
}


/**
 * Converts the asset references in ProfileContent into the
 * immutable published asset manifest expected by P2E.
 *
 * readAssetBytes is intentionally injected.
 *
 * Today:
 *   Jest → repository filesystem
 *
 * Future:
 *   Admin upload → ArrayBuffer/File
 *   backend → S3 draft upload
 */
export async function materializePublishedProfileAssets(
  {
    content,

    catalog =
      PROFILE_ASSET_CATALOG,

    readAssetBytes,

    hashOptions,
  } = {}
) {
  if (
    typeof readAssetBytes !==
      "function"
  ) {
    throw new Error(
      "readAssetBytes is required to materialize Profile assets."
    );
  }


  const definitions =
    resolveProfileAssetDefinitions(
      content,
      catalog
    );


  const assets = [];


  for (
    const definition of
      definitions
  ) {
    const bytes =
      await readAssetBytes(
        cloneJson(
          definition
        )
      );


    if (
      bytes === null ||
      bytes === undefined
    ) {
      throw new Error(
        `Profile asset reader returned no bytes for "${definition.id}".`
      );
    }


    const sha256 =
      await sha256BytesHex(
        bytes,
        hashOptions
      );


    const objectKey =
      createContentAddressedProfileAssetObjectKey({
        sha256,

        contentType:
          definition
            .contentType,
      });


    assets.push({
      id:
        definition.id,

      kind:
        definition.kind,

      objectKey,

      sha256,

      contentType:
        definition
          .contentType,

      sourcePath:
        definition
          .sourcePath,
    });
  }


  return assets.sort(
    (a, b) =>
      a.id.localeCompare(
        b.id
      )
  );
}