// src/utils/profileVariant/validate.js

import {
  CURRENT_PROFILE_CONTENT_SCHEMA_VERSION,
  PROFILE_CONTENT_FIELD_TYPES,
  PROFILE_CONTENT_FIELDS,
  PROFILE_VARIANT_ASSET_KINDS,
  PROFILE_VARIANT_COMPATIBILITY,
  PROFILE_VARIANT_DOCUMENT_SCHEMA,
} from "./constants";

import {
  assertJsonCompatible,
} from "./json";

import {
  getProfileVariantSchema,
} from "./schemaRegistry";

import {
  PROFILE_VARIANT_SCHEMA_ID_V1,
} from "./schemas/v1";


const ID_RE =
  /^[A-Za-z0-9._:-]+$/;

const SHA256_RE =
  /^[a-f0-9]{64}$/i;


function isPlainObject(
  value
) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return false;
  }

  const proto =
    Object.getPrototypeOf(
      value
    );

  return (
    proto === Object.prototype ||
    proto === null
  );
}


function nonEmpty(
  value
) {
  return Boolean(
    String(
      value || ""
    ).trim()
  );
}


function unknownKeys(
  object,
  allowed
) {
  if (
    !isPlainObject(
      object
    )
  ) {
    return [];
  }

  const allowedSet =
    new Set(
      allowed
    );

  return Object.keys(
    object
  ).filter(
    (key) =>
      !allowedSet.has(
        key
      )
  );
}


function validateAsset(
  asset,
  index,
  errors
) {
  const path =
    `assets[${index}]`;

  if (
    !isPlainObject(
      asset
    )
  ) {
    errors.push(
      `${path} must be an object.`
    );

    return;
  }

  const allowedFields = [
    "id",
    "kind",
    "sourcePath",
    "objectKey",
    "sha256",
    "contentType",
  ];

  for (
    const key of
      unknownKeys(
        asset,
        allowedFields
      )
  ) {
    errors.push(
      `${path}.${key} is not supported by content schema v1.`
    );
  }

  if (
    !nonEmpty(
      asset.id
    )
  ) {
    errors.push(
      `${path}.id is required.`
    );
  }

  if (
    !PROFILE_VARIANT_ASSET_KINDS.includes(
      String(
        asset.kind || ""
      )
    )
  ) {
    errors.push(
      `${path}.kind is invalid.`
    );
  }

  if (
    !nonEmpty(
        asset.objectKey
    )
    ) {
    errors.push(
        `${path}.objectKey is required.`
    );
    }


    if (
    !nonEmpty(
        asset.sha256
    )
    ) {
    errors.push(
        `${path}.sha256 is required.`
    );
    }


    if (
    !nonEmpty(
        asset.contentType
    )
    ) {
    errors.push(
        `${path}.contentType is required.`
    );
  }

  if (
    asset.sha256 != null &&
    nonEmpty(
      asset.sha256
    ) &&
    !SHA256_RE.test(
      String(
        asset.sha256
      )
    )
  ) {
    errors.push(
      `${path}.sha256 must be a 64-character hexadecimal SHA-256 digest.`
    );
  }
}


function validateCurrentContent(
  content,
  errors
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

  for (
    const key of
      unknownKeys(
        content,
        PROFILE_CONTENT_FIELDS
      )
  ) {
    errors.push(
      `content.${key} is not supported by content schema v1.`
    );
  }

  for (
    const field of
      PROFILE_CONTENT_FIELDS
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

    const expected =
      PROFILE_CONTENT_FIELD_TYPES[
        field
      ];

    const value =
      content[field];

    if (
      expected === "array" &&
      !Array.isArray(
        value
      )
    ) {
      errors.push(
        `content.${field} must be an array.`
      );
    }

    if (
      expected === "object" &&
      !isPlainObject(
        value
      )
    ) {
      errors.push(
        `content.${field} must be an object.`
      );
    }
  }
}

/**
 * Validates a standalone canonical ProfileContent DTO.
 *
 * This is intentionally independent from ProfileVariant validation.
 *
 * Future consumers:
 * - repo authoring adapter
 * - Profile Draft
 * - Admin → Data
 * - migration tools
 * - publisher
 */
export function validateProfileContent(
  content
) {
  const errors = [];
  const warnings = [];

  try {
    assertJsonCompatible(
      content
    );
  } catch (error) {
    errors.push(
      String(
        error?.message ||
        error
      )
    );
  }

  validateCurrentContent(
    content,
    errors
  );

  return {
    valid:
      errors.length === 0,

    errors,

    warnings,
  };
}


/**
 * Structural validation is deliberately distinct from
 * publication readiness.
 *
 * Historical variants may be structurally valid while still
 * requiring owner-supplied targeting metadata.
 */
export function validateProfileVariantDocument(
  document
) {
  const errors = [];
  const warnings = [];

  try {
    assertJsonCompatible(
      document
    );
  } catch (error) {
    errors.push(
      String(
        error?.message ||
        error
      )
    );
  }

  if (
    !isPlainObject(
      document
    )
  ) {
    errors.push(
      "Profile Variant document must be an object."
    );

    return {
      valid: false,

      publishable: false,

      compatibility:
        PROFILE_VARIANT_COMPATIBILITY
          .INCOMPATIBLE,

      requiresMigration:
        false,

      missingTargeting:
        [],

      errors,

      warnings,
    };
  }

  const allowedTopLevel = [
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
    ];

  for (
    const key of
      unknownKeys(
        document,
        allowedTopLevel
      )
  ) {
    errors.push(
      `${key} is not a supported Profile Variant field.`
    );
  }

  if (
    document.schema !==
      PROFILE_VARIANT_DOCUMENT_SCHEMA
  ) {
    errors.push(
      `schema must be "${PROFILE_VARIANT_DOCUMENT_SCHEMA}".`
    );
  }

  if (
    document.schemaId !==
        PROFILE_VARIANT_SCHEMA_ID_V1
    ) {
    errors.push(
        `schemaId must be "${PROFILE_VARIANT_SCHEMA_ID_V1}".`
    );
    }

  const schemaVersion =
    Number(
      document
        .contentSchemaVersion
    );

  if (
    !Number.isInteger(
      schemaVersion
    ) ||
    schemaVersion < 1
  ) {
    errors.push(
      "contentSchemaVersion must be a positive integer."
    );
  }

  const registeredSchema =
    Number.isInteger(
        schemaVersion
    ) &&
    schemaVersion >= 1
        ? getProfileVariantSchema(
            schemaVersion
        )
        : null;

  const futureSchema =
    Number.isInteger(
      schemaVersion
    ) &&
    schemaVersion >
      CURRENT_PROFILE_CONTENT_SCHEMA_VERSION;

  if (futureSchema) {
    errors.push(
      `content schema v${schemaVersion} is newer than the current platform schema v${CURRENT_PROFILE_CONTENT_SCHEMA_VERSION}.`
    );
  }

  if (
    Number.isInteger(
        schemaVersion
    ) &&
    schemaVersion >= 1 &&
    schemaVersion <=
        CURRENT_PROFILE_CONTENT_SCHEMA_VERSION &&
    !registeredSchema
    ) {
    errors.push(
        `content schema v${schemaVersion} is not registered by the current platform.`
    );
    }

  const requiresMigration =
    Number.isInteger(
      schemaVersion
    ) &&
    schemaVersion >= 1 &&
    schemaVersion <
      CURRENT_PROFILE_CONTENT_SCHEMA_VERSION;

  if (
    !nonEmpty(
      document
        .profileVariantId
    )
  ) {
    errors.push(
      "profileVariantId is required."
    );
  } else if (
    String(
      document
        .profileVariantId
    ).length > 160 ||
    !ID_RE.test(
      String(
        document
          .profileVariantId
      )
    )
  ) {
    errors.push(
      "profileVariantId may contain only letters, numbers, '.', '_', ':', or '-' and must be at most 160 characters."
    );
  }

  if (
    !SHA256_RE.test(
        String(
        document
            .contentHash ||
        ""
        )
    )
    ) {
    errors.push(
        "contentHash must be a 64-character hexadecimal SHA-256 digest."
    );
    }

  if (
    !nonEmpty(
      document
        .createdAt
    ) ||
    Number.isNaN(
      Date.parse(
        document
          .createdAt
      )
    )
  ) {
    errors.push(
      "createdAt must be a valid timestamp."
    );
  }

  if (
    !isPlainObject(
      document
        .targeting
    )
  ) {
    errors.push(
      "targeting must be an object."
    );
  } else {
    for (
      const key of
        unknownKeys(
          document.targeting,
          [
            "location",
            "jobRole",
          ]
        )
    ) {
      errors.push(
        `targeting.${key} is not supported by content schema v1.`
      );
    }
  }

  if (
    !isPlainObject(
      document
        .provenance
    )
  ) {
    errors.push(
      "provenance must be an object."
    );
  } else {
    const provenanceFields = [
      "legacyProfileVersionId",
      "platformVersionId",
      "gitSha",
      "checkpointTag",
      "sourceSnapshotKey",
    ];

    for (
      const key of
        unknownKeys(
          document.provenance,
          provenanceFields
        )
    ) {
      errors.push(
        `provenance.${key} is not supported by content schema v1.`
      );
    }
  }

  if (
    !Array.isArray(
      document.assets
    )
  ) {
    errors.push(
      "assets must be an array."
    );
  } else {
    document.assets.forEach(
      (
        asset,
        index
      ) => {
        validateAsset(
          asset,
          index,
          errors
        );
      }
    );
  }

  /**
   * Only validate the current content shape here.
   *
   * Older schemas must first run through migrations;
   * future schemas are rejected above.
   */
  if (
    schemaVersion ===
        CURRENT_PROFILE_CONTENT_SCHEMA_VERSION
    ) {
    const contentValidation =
        validateProfileContent(
        document.content
        );

    errors.push(
        ...contentValidation.errors
    );

    warnings.push(
        ...contentValidation.warnings
    );
    }

  const missingTargeting =
    [];

  if (
    !nonEmpty(
      document
        ?.targeting
        ?.location
    )
  ) {
    missingTargeting.push(
      "location"
    );
  }

  if (
    !nonEmpty(
      document
        ?.targeting
        ?.jobRole
    )
  ) {
    missingTargeting.push(
      "jobRole"
    );
  }

  if (
    missingTargeting.length
  ) {
    warnings.push(
      `Targeting metadata is incomplete: ${missingTargeting.join(
        ", "
      )}.`
    );
  }

  const valid =
    errors.length === 0;

  const publishable =
    valid &&
    !requiresMigration &&
    missingTargeting.length ===
      0;

  let compatibility =
    PROFILE_VARIANT_COMPATIBILITY
      .READY;

  if (!valid) {
    compatibility =
      PROFILE_VARIANT_COMPATIBILITY
        .INCOMPATIBLE;
  } else if (
    missingTargeting.length
  ) {
    compatibility =
      PROFILE_VARIANT_COMPATIBILITY
        .NEEDS_METADATA;
  } else if (
    requiresMigration
  ) {
    compatibility =
      PROFILE_VARIANT_COMPATIBILITY
        .MIGRATION_REQUIRED;
  }

  return {
    valid,

    publishable,

    compatibility,

    requiresMigration,

    missingTargeting,

    errors,

    warnings,
  };
}