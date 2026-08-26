// src/utils/profileVariant/schemaRegistry.js

import {
  CURRENT_PROFILE_CONTENT_SCHEMA_VERSION,
} from "./constants";

import {
  PROFILE_VARIANT_SCHEMA_V1,
} from "./schemas/v1";


/**
 * Immutable registry of every Profile Variant schema understood
 * by this platform codebase.
 *
 * Never replace an old schema definition with a newer structure.
 *
 * Future evolution:
 *
 *   1 -> PROFILE_VARIANT_SCHEMA_V1
 *   2 -> PROFILE_VARIANT_SCHEMA_V2
 *   3 -> PROFILE_VARIANT_SCHEMA_V3
 *
 * Old schema contracts remain available so historical Profile
 * Variants can be validated before migration.
 */
export const PROFILE_VARIANT_SCHEMA_REGISTRY =
  Object.freeze({
    1:
      PROFILE_VARIANT_SCHEMA_V1,
  });


export function getProfileVariantSchema(
  version
) {
  const normalized =
    Number(
      version
    );

  if (
    !Number.isInteger(
      normalized
    ) ||
    normalized < 1
  ) {
    return null;
  }

  return (
    PROFILE_VARIANT_SCHEMA_REGISTRY[
      normalized
    ] ||
    null
  );
}


export function hasProfileVariantSchema(
  version
) {
  return Boolean(
    getProfileVariantSchema(
      version
    )
  );
}


export function listProfileVariantSchemaVersions() {
  return Object.keys(
    PROFILE_VARIANT_SCHEMA_REGISTRY
  )
    .map(Number)
    .filter(
      Number.isInteger
    )
    .sort(
      (a, b) =>
        a - b
    );
}


/**
 * Fail fast if someone increments
 * CURRENT_PROFILE_CONTENT_SCHEMA_VERSION
 * but forgets to register the corresponding schema.
 */
export function assertCurrentProfileVariantSchemaRegistered() {
  const schema =
    getProfileVariantSchema(
      CURRENT_PROFILE_CONTENT_SCHEMA_VERSION
    );

  if (!schema) {
    throw new Error(
      `Profile Variant schema v${CURRENT_PROFILE_CONTENT_SCHEMA_VERSION} is not registered.`
    );
  }

  return schema;
}