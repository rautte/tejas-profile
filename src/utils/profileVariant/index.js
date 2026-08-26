// src/utils/profileVariant/index.js

export {
  CURRENT_PROFILE_CONTENT_SCHEMA_VERSION,
  PROFILE_CONTENT_FIELDS,
  PROFILE_CONTENT_FIELD_TYPES,
  PROFILE_VARIANT_ASSET_KINDS,
  PROFILE_VARIANT_COMPATIBILITY,
  PROFILE_VARIANT_DOCUMENT_SCHEMA,
} from "./constants";

export {
  assertJsonCompatible,
  cloneJson,
} from "./json";

export {
  createEmptyProfileContent,
  createProfileContent,
  createProfileVariantDocument,
} from "./schema";

export {
  validateProfileContent,
  validateProfileVariantDocument,
} from "./validate";

export {
  PROFILE_VARIANT_MIGRATIONS,
  migrateProfileVariantToCurrent,
  runProfileVariantMigrations,
} from "./migrate";

export {
  PROFILE_VARIANT_SCHEMA_REGISTRY,
  assertCurrentProfileVariantSchemaRegistered,
  getProfileVariantSchema,
  hasProfileVariantSchema,
  listProfileVariantSchemaVersions,
} from "./schemaRegistry";

export {
  PROFILE_VARIANT_SCHEMA_ID_V1,
  PROFILE_VARIANT_SCHEMA_V1,
} from "./schemas/v1";

export {
  canonicalJsonStringify,
} from "./canonicalJson";

export {
  sha256BytesHex,
  sha256Hex,
} from "./sha256";