// infra/cdk/lambda/profile-variants-contract.ts

import * as crypto from "node:crypto";


export const PROFILE_VARIANT_DOCUMENT_SCHEMA =
  "tejas-profile.profile-variant";

export const PROFILE_VARIANT_SCHEMA_ID_V1 =
  "tejas-profile.profile-variant.v1";

export const CURRENT_PROFILE_CONTENT_SCHEMA_VERSION =
  1;

export const PROFILE_VARIANT_ASSET_PREFIX =
  "assets/sha256/";

export const PROFILE_VARIANT_MANIFEST_PREFIX =
  "variants/";


const SHA256_RE =
  /^[a-f0-9]{64}$/;

const ID_RE =
  /^[A-Za-z0-9._:-]+$/;


const PROFILE_CONTENT_FIELD_TYPES:
  Record<
    string,
    "object" | "array"
  > = {
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
  };


const PROFILE_VARIANT_ASSET_KINDS =
  new Set([
    "profile_photo",
    "resume_pdf",
    "education_image",
    "project_media",
    "attachment",
    "other",
  ]);


function cleanString(
  value: unknown
) {
  return String(
    value ?? ""
  ).trim();
}


function isPlainObject(
  value: unknown
): value is Record<
  string,
  any
> {
  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(
      value
    )
  ) {
    return false;
  }


  const proto =
    Object.getPrototypeOf(
      value
    );


  return (
    proto ===
      Object.prototype ||
    proto === null
  );
}


function validId(
  value: unknown
) {
  const normalized =
    cleanString(
      value
    );


  return (
    normalized.length >
      0 &&
    normalized.length <=
      160 &&
    ID_RE.test(
      normalized
    )
  );
}


function validTimestamp(
  value: unknown
) {
  const normalized =
    cleanString(
      value
    );


  return (
    Boolean(
      normalized
    ) &&
    !Number.isNaN(
      Date.parse(
        normalized
      )
    )
  );
}


function assertJsonCompatible(
  value: unknown,
  path =
    "$",
  seen =
    new Set<any>()
) {
  if (
    value === null
  ) {
    return;
  }


  const type =
    typeof value;


  if (
    type === "string" ||
    type === "boolean"
  ) {
    return;
  }


  if (
    type === "number"
  ) {
    if (
      !Number.isFinite(
        value as number
      )
    ) {
      throw new Error(
        `${path} contains a non-finite number.`
      );
    }

    return;
  }


  if (
    type === "undefined" ||
    type === "function" ||
    type === "symbol" ||
    type === "bigint"
  ) {
    throw new Error(
      `${path} is not JSON compatible.`
    );
  }


  if (
    seen.has(
      value
    )
  ) {
    throw new Error(
      `${path} contains a circular reference.`
    );
  }


  seen.add(
    value
  );


  if (
    Array.isArray(
      value
    )
  ) {
    value.forEach(
      (
        child,
        index
      ) =>
        assertJsonCompatible(
          child,
          `${path}[${index}]`,
          seen
        )
    );

    seen.delete(
      value
    );

    return;
  }


  if (
    !isPlainObject(
      value
    )
  ) {
    throw new Error(
      `${path} must contain only plain JSON objects.`
    );
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
    assertJsonCompatible(
      child,
      `${path}.${key}`,
      seen
    );
  }


  seen.delete(
    value
  );
}


function cloneJson<T>(
  value: T
): T {
  assertJsonCompatible(
    value
  );

  return JSON.parse(
    JSON.stringify(
      value
    )
  );
}


function canonicalize(
  value: any
): any {
  if (
    value === null ||
    typeof value !==
      "object"
  ) {
    return value;
  }


  if (
    Array.isArray(
      value
    )
  ) {
    return value.map(
      canonicalize
    );
  }


  const result:
    Record<
      string,
      any
    > = {};


  for (
    const key of
      Object.keys(
        value
      ).sort()
  ) {
    result[key] =
      canonicalize(
        value[key]
      );
  }


  return result;
}


export function canonicalJsonStringify(
  value: unknown
) {
  assertJsonCompatible(
    value
  );


  return JSON.stringify(
    canonicalize(
      value
    )
  );
}


export function sha256Hex(
  value:
    | string
    | Buffer
    | Uint8Array
) {
  return crypto
    .createHash(
      "sha256"
    )
    .update(
      value
    )
    .digest(
      "hex"
    );
}


export function hexSha256ToBase64(
  sha256: string
) {
  const normalized =
    cleanString(
      sha256
    ).toLowerCase();


  if (
    !SHA256_RE.test(
      normalized
    )
  ) {
    throw new Error(
      "Invalid SHA-256 digest."
    );
  }


  return Buffer
    .from(
      normalized,
      "hex"
    )
    .toString(
      "base64"
    );
}


export function base64Sha256ToHex(
  value: string
) {
  const normalized =
    cleanString(
      value
    );


  if (!normalized) {
    return "";
  }


  const bytes =
    Buffer.from(
      normalized,
      "base64"
    );


  if (
    bytes.length !==
      32
  ) {
    return "";
  }


  return bytes.toString(
    "hex"
  );
}


function safeContentTypePart(
  contentType: string
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


export function createProfileVariantAssetObjectKey(
  {
    sha256,
    contentType,
  }: {
    sha256: string;
    contentType: string;
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
    PROFILE_VARIANT_ASSET_PREFIX +
    normalizedHash +
    "/" +
    typePart
  );
}


export function createProfileVariantManifestKey(
  profileVariantId: string
) {
  if (
    !validId(
      profileVariantId
    )
  ) {
    throw new Error(
      "Invalid profileVariantId."
    );
  }


  return (
    PROFILE_VARIANT_MANIFEST_PREFIX +
    profileVariantId +
    "/manifest.json"
  );
}


function isAssetReferenceKey(
  key: string
) {
  return (
    key ===
      "assetId" ||
    key.endsWith(
      "AssetId"
    )
  );
}


export function collectProfileAssetIds(
  content: unknown
) {
  const ids =
    new Set<string>();


  function visit(
    value: any
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
      !isPlainObject(
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


function validateContent(
  content: any,
  errors: string[]
) {
  if (
    !isPlainObject(
      content
    )
  ) {
    errors.push(
      "content must be an object."
    );

    return;
  }


  const expectedFields =
    Object.keys(
      PROFILE_CONTENT_FIELD_TYPES
    );


  for (
    const field of
      expectedFields
  ) {
    if (
      !Object.prototype
        .hasOwnProperty
        .call(
          content,
          field
        )
    ) {
      errors.push(
        `content.${field} is required.`
      );

      continue;
    }


    const expectedType =
      PROFILE_CONTENT_FIELD_TYPES[
        field
      ];

    const value =
      content[
        field
      ];


    if (
      expectedType ===
        "array" &&
      !Array.isArray(
        value
      )
    ) {
      errors.push(
        `content.${field} must be an array.`
      );
    }


    if (
      expectedType ===
        "object" &&
      !isPlainObject(
        value
      )
    ) {
      errors.push(
        `content.${field} must be an object.`
      );
    }
  }


  for (
    const key of
      Object.keys(
        content
      )
  ) {
    if (
      !expectedFields.includes(
        key
      )
    ) {
      errors.push(
        `content.${key} is not supported by schema v1.`
      );
    }
  }
}


function normalizeAsset(
  asset: any,
  path: string,
  errors: string[]
) {
  if (
    !isPlainObject(
      asset
    )
  ) {
    errors.push(
      `${path} must be an object.`
    );

    return null;
  }


  const allowedFields =
    new Set([
      "id",
      "kind",
      "objectKey",
      "sha256",
      "contentType",
      "sourcePath",
    ]);


  for (
    const key of
      Object.keys(
        asset
      )
  ) {
    if (
      !allowedFields.has(
        key
      )
    ) {
      errors.push(
        `${path}.${key} is not supported.`
      );
    }
  }


  const id =
    cleanString(
      asset.id
    );

  const kind =
    cleanString(
      asset.kind
    );

  const objectKey =
    cleanString(
      asset.objectKey
    );

  const sha256 =
    cleanString(
      asset.sha256
    ).toLowerCase();

  const contentType =
    cleanString(
      asset.contentType
    );


  if (
    !validId(
      id
    )
  ) {
    errors.push(
      `${path}.id is invalid.`
    );
  }


  if (
    !PROFILE_VARIANT_ASSET_KINDS
      .has(
        kind
      )
  ) {
    errors.push(
      `${path}.kind "${kind}" is unsupported.`
    );
  }


  if (
    !SHA256_RE.test(
      sha256
    )
  ) {
    errors.push(
      `${path}.sha256 must be a 64-character lowercase hexadecimal digest.`
    );
  }


  if (!contentType) {
    errors.push(
      `${path}.contentType is required.`
    );
  }


  let expectedObjectKey =
    "";


  if (
    SHA256_RE.test(
      sha256
    ) &&
    contentType
  ) {
    expectedObjectKey =
      createProfileVariantAssetObjectKey({
        sha256,
        contentType,
      });


    if (
      objectKey !==
        expectedObjectKey
    ) {
      errors.push(
        `${path}.objectKey must be "${expectedObjectKey}".`
      );
    }
  }


  const normalized:
    Record<
      string,
      any
    > = {
      id,
      kind,
      objectKey,
      sha256,
      contentType,
    };


  const sourcePath =
    cleanString(
      asset.sourcePath
    );


  if (sourcePath) {
    normalized.sourcePath =
      sourcePath;
  }


  return normalized;
}


export function createProfileVariantContentIdentityPayload(
  variant: any
) {
  const assets =
    Array.isArray(
      variant.assets
    )
      ? variant.assets
          .map(
            (asset: any) => ({
              id:
                asset.id,

              kind:
                asset.kind,

              sha256:
                asset.sha256,

              contentType:
                asset.contentType,
            })
          )
          .sort(
            (
              a: any,
              b: any
            ) =>
              String(
                a.id
              ).localeCompare(
                String(
                  b.id
                )
              )
          )
      : [];


  return {
    schemaId:
      PROFILE_VARIANT_SCHEMA_ID_V1,

    contentSchemaVersion:
      CURRENT_PROFILE_CONTENT_SCHEMA_VERSION,

    targeting:
      cloneJson(
        variant.targeting
      ),

    content:
      cloneJson(
        variant.content
      ),

    assets,
  };
}


export function computeProfileVariantContentHash(
  variant: any
) {
  return sha256Hex(
    canonicalJsonStringify(
      createProfileVariantContentIdentityPayload(
        variant
      )
    )
  );
}


export function normalizeAndValidateProfileVariantDocument(
  input: any
) {
  const errors:
    string[] = [];


  try {
    assertJsonCompatible(
      input
    );
  } catch (
    error: any
  ) {
    errors.push(
      String(
        error?.message ||
        error
      )
    );
  }


  if (
    !isPlainObject(
      input
    )
  ) {
    throw new Error(
      "Profile Variant must be an object."
    );
  }


  const allowedTopLevel =
    new Set([
      "schema",
      "schemaId",
      "contentSchemaVersion",
      "profileVariantId",
      "contentHash",
      "createdAt",
      "targeting",
      "provenance",
      "content",
      "assets",
    ]);


  for (
    const key of
      Object.keys(
        input
      )
  ) {
    if (
      !allowedTopLevel.has(
        key
      )
    ) {
      errors.push(
        `${key} is not a supported Profile Variant field.`
      );
    }
  }


  if (
    input.schema !==
      PROFILE_VARIANT_DOCUMENT_SCHEMA
  ) {
    errors.push(
      `schema must be "${PROFILE_VARIANT_DOCUMENT_SCHEMA}".`
    );
  }


  if (
    input.schemaId !==
      PROFILE_VARIANT_SCHEMA_ID_V1
  ) {
    errors.push(
      `schemaId must be "${PROFILE_VARIANT_SCHEMA_ID_V1}".`
    );
  }


  if (
    input.contentSchemaVersion !==
      CURRENT_PROFILE_CONTENT_SCHEMA_VERSION
  ) {
    errors.push(
      `contentSchemaVersion must be ${CURRENT_PROFILE_CONTENT_SCHEMA_VERSION}.`
    );
  }


  const profileVariantId =
    cleanString(
      input.profileVariantId
    );


  if (
    !validId(
      profileVariantId
    )
  ) {
    errors.push(
      "profileVariantId is invalid."
    );
  }


  const contentHash =
    cleanString(
      input.contentHash
    ).toLowerCase();


  if (
    !SHA256_RE.test(
      contentHash
    )
  ) {
    errors.push(
      "contentHash must be a 64-character lowercase hexadecimal digest."
    );
  }


  const createdAt =
    cleanString(
      input.createdAt
    );


  if (
    !validTimestamp(
      createdAt
    )
  ) {
    errors.push(
      "createdAt must be a valid timestamp."
    );
  }


  if (
    !isPlainObject(
      input.targeting
    )
  ) {
    errors.push(
      "targeting must be an object."
    );
  } else {
    const targetingKeys =
      Object.keys(
        input.targeting
      );


    for (
      const key of
        targetingKeys
    ) {
      if (
        key !==
          "location" &&
        key !==
          "jobRole"
      ) {
        errors.push(
          `targeting.${key} is not supported.`
        );
      }
    }


    const location =
      cleanString(
        input
          .targeting
          .location
      );

    const jobRole =
      cleanString(
        input
          .targeting
          .jobRole
      );


    if (!location) {
      errors.push(
        "targeting.location is required."
      );
    }


    if (!jobRole) {
      errors.push(
        "targeting.jobRole is required."
      );
    }


    if (
      typeof input
        .targeting
        .location !==
        "string" ||
      input
        .targeting
        .location !==
        location
    ) {
      errors.push(
        "targeting.location must be a trimmed string."
      );
    }


    if (
      typeof input
        .targeting
        .jobRole !==
        "string" ||
      input
        .targeting
        .jobRole !==
        jobRole
    ) {
      errors.push(
        "targeting.jobRole must be a trimmed string."
      );
    }
  }


  if (
    !isPlainObject(
      input.provenance
    )
  ) {
    errors.push(
      "provenance must be an object."
    );
  }


  validateContent(
    input.content,
    errors
  );


  if (
    !Array.isArray(
      input.assets
    )
  ) {
    errors.push(
      "assets must be an array."
    );
  }


  const normalizedAssets =
    Array.isArray(
      input.assets
    )
      ? input.assets
          .map(
            (
              asset: any,
              index: number
            ) =>
              normalizeAsset(
                asset,
                `assets[${index}]`,
                errors
              )
          )
          .filter(
            (
                asset
            ): asset is Record<string, any> =>
                asset !== null
            )
          .sort(
            (
              a: any,
              b: any
            ) =>
              a.id.localeCompare(
                b.id
              )
          )
      : [];


  const seenAssetIds =
    new Set<string>();


  for (
    const asset of
      normalizedAssets
  ) {
    if (
      seenAssetIds.has(
        asset.id
      )
    ) {
      errors.push(
        `Duplicate Profile Variant asset ID "${asset.id}".`
      );
    }

    seenAssetIds.add(
      asset.id
    );
  }


  try {
    const referencedIds =
      collectProfileAssetIds(
        input.content
      );


    const manifestIds =
      normalizedAssets
        .map(
          (asset: any) =>
            asset.id
        )
        .sort();


    if (
      JSON.stringify(
        referencedIds
      ) !==
      JSON.stringify(
        manifestIds
      )
    ) {
      errors.push(
        "Profile Variant assets must exactly match asset references in content."
      );
    }
  } catch (
    error: any
  ) {
    errors.push(
      String(
        error?.message ||
        error
      )
    );
  }


  const normalized = {
    schema:
      PROFILE_VARIANT_DOCUMENT_SCHEMA,

    schemaId:
      PROFILE_VARIANT_SCHEMA_ID_V1,

    contentSchemaVersion:
      CURRENT_PROFILE_CONTENT_SCHEMA_VERSION,

    profileVariantId,

    contentHash,

    createdAt,

    targeting:
      cloneJson(
        input.targeting
      ),

    provenance:
      cloneJson(
        input.provenance
      ),

    content:
      cloneJson(
        input.content
      ),

    assets:
      normalizedAssets,
  };


  if (
    errors.length ===
      0
  ) {
    const expectedHash =
      computeProfileVariantContentHash(
        normalized
      );


    if (
      expectedHash !==
        contentHash
    ) {
      errors.push(
        `contentHash mismatch: expected ${expectedHash}.`
      );
    }
  }


  if (
    errors.length >
      0
  ) {
    throw new Error(
      errors.join(
        " "
      )
    );
  }


  return normalized;
}