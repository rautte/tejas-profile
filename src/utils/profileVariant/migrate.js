// src/utils/profileVariant/migrate.js

import {
  CURRENT_PROFILE_CONTENT_SCHEMA_VERSION,
} from "./constants";

import {
  cloneJson,
} from "./json";

import {
  validateProfileVariantDocument,
} from "./validate";


/**
 * Registry:
 *
 * key   = source schema version
 * value = migration from N → N+1
 *
 * Example in the future:
 *
 * 1: migrateV1ToV2
 * 2: migrateV2ToV3
 */
export const PROFILE_VARIANT_MIGRATIONS =
  Object.freeze({});


function readVersion(
  document
) {
  const version =
    Number(
      document
        ?.contentSchemaVersion
    );

  if (
    !Number.isInteger(
      version
    ) ||
    version < 1
  ) {
    throw new Error(
      "Profile Variant has an invalid contentSchemaVersion."
    );
  }

  return version;
}


/**
 * Generic deterministic migration runner.
 *
 * `migrations` is injectable so the migration engine itself
 * can be unit tested before real v2 migrations exist.
 */
export function runProfileVariantMigrations(
  document,
  {
    targetVersion =
      CURRENT_PROFILE_CONTENT_SCHEMA_VERSION,

    migrations =
      PROFILE_VARIANT_MIGRATIONS,
  } = {}
) {
  const target =
    Number(
      targetVersion
    );

  if (
    !Number.isInteger(
      target
    ) ||
    target < 1
  ) {
    throw new Error(
      "targetVersion must be a positive integer."
    );
  }

  let current =
    cloneJson(
      document
    );

  let version =
    readVersion(
      current
    );

  if (
    version > target
  ) {
    throw new Error(
      `Cannot migrate Profile Variant backwards from schema v${version} to v${target}.`
    );
  }

  while (
    version < target
  ) {
    const migrate =
      migrations[
        version
      ];

    if (
      typeof migrate !==
        "function"
    ) {
      throw new Error(
        `Missing Profile Variant migration v${version} → v${version + 1}.`
      );
    }

    const migrated =
      migrate(
        cloneJson(
          current
        )
      );

    const migratedVersion =
      readVersion(
        migrated
      );

    if (
      migratedVersion !==
        version + 1
    ) {
      throw new Error(
        `Profile Variant migration v${version} → v${version + 1} returned schema v${migratedVersion}.`
      );
    }

    current =
      cloneJson(
        migrated
      );

    version =
      migratedVersion;
  }

  return current;
}


/**
 * Converts any supported historical Profile Variant into
 * the current platform content schema.
 */
export function migrateProfileVariantToCurrent(
  document
) {
  const migrated =
    runProfileVariantMigrations(
      document
    );

  const validation =
    validateProfileVariantDocument(
      migrated
    );

  if (
    !validation.valid
  ) {
    throw new Error(
      [
        "Migrated Profile Variant is invalid.",
        ...validation.errors,
      ].join(" ")
    );
  }

  return migrated;
}