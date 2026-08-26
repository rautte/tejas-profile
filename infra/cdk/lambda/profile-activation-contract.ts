// infra/cdk/lambda/profile-activation-contract.ts

export const PROFILE_ACTIVATION_DOCUMENT_SCHEMA =
  "tejas-profile.profile-activation";

export const ACTIVE_PROFILE_POINTER_DOCUMENT_SCHEMA =
  "tejas-profile.active-profile-pointer";

export const CURRENT_PROFILE_ACTIVATION_SCHEMA_VERSION =
  1;

export const CURRENT_ACTIVE_PROFILE_POINTER_SCHEMA_VERSION =
  1;

export const PROFILE_ACTIVATION_CONTROL_PK =
  "CONTROL";

export const PROFILE_ACTIVATION_ACTIVE_SK =
  "ACTIVE";

export const PROFILE_ACTIVATION_LEDGER_PK =
  "ACTIVATION";

export const PROFILE_ACTIVATION_VARIANT_INDEX_NAME =
  "ByProfileVariant";

export const PROFILE_ACTIVATION_VARIANT_INDEX_PK_PREFIX =
  "VARIANT#";

const ID_RE =
  /^[A-Za-z0-9._:-]+$/;

const SHA256_RE =
  /^[a-f0-9]{64}$/;

function cleanString(
  value: unknown
) {
  return String(
    value ?? ""
  ).trim();
}

function requireId(
  value: unknown,
  field: string
) {
  const normalized =
    cleanString(
      value
    );

  if (
    !normalized ||
    normalized.length > 160 ||
    !ID_RE.test(
      normalized
    )
  ) {
    throw new Error(
      `${field} is invalid.`
    );
  }

  return normalized;
}

function requireSha256(
  value: unknown,
  field: string
) {
  const normalized =
    cleanString(
      value
    ).toLowerCase();

  if (
    !SHA256_RE.test(
      normalized
    )
  ) {
    throw new Error(
      `${field} must be a 64-character lowercase hexadecimal digest.`
    );
  }

  return normalized;
}

function requireContentSchemaVersion(
  value: unknown
) {
  const version =
    Number(
      value
    );

  if (
    !Number.isInteger(
      version
    ) ||
    version <= 0
  ) {
    throw new Error(
      "contentSchemaVersion must be a positive integer."
    );
  }

  return version;
}

/**
 * Activation ordering depends on lexicographical timestamp order.
 *
 * Therefore we require canonical UTC ISO timestamps rather than
 * accepting arbitrary Date.parse()-compatible strings.
 */
function requireCanonicalTimestamp(
  value: unknown,
  field: string
) {
  const normalized =
    cleanString(
      value
    );

  if (!normalized) {
    throw new Error(
      `${field} is required.`
    );
  }

  const parsed =
    new Date(
      normalized
    );

  if (
    Number.isNaN(
      parsed.getTime()
    ) ||
    parsed.toISOString() !==
      normalized
  ) {
    throw new Error(
      `${field} must be a canonical UTC ISO timestamp.`
    );
  }

  return normalized;
}

function requireRevision(
  value: unknown
) {
  const revision =
    Number(
      value
    );

  if (
    !Number.isInteger(
      revision
    ) ||
    revision <= 0
  ) {
    throw new Error(
      "revision must be a positive integer."
    );
  }

  return revision;
}

export function createActivationLedgerSortKey(
  activatedAt: string,
  activationId: string
) {
  const timestamp =
    requireCanonicalTimestamp(
      activatedAt,
      "activatedAt"
    );

  const id =
    requireId(
      activationId,
      "activationId"
    );

  return (
    timestamp +
    "#" +
    id
  );
}

export function createActivationVariantIndexPk(
  profileVariantId: string
) {
  return (
    PROFILE_ACTIVATION_VARIANT_INDEX_PK_PREFIX +
    requireId(
      profileVariantId,
      "profileVariantId"
    )
  );
}

export function createActivationVariantIndexSk(
  activatedAt: string,
  activationId: string
) {
  return createActivationLedgerSortKey(
    activatedAt,
    activationId
  );
}

export function validateActiveProfilePointer(
  pointer: any
) {
  if (
    !pointer ||
    typeof pointer !==
      "object" ||
    Array.isArray(
      pointer
    )
  ) {
    throw new Error(
      "Active Profile pointer must be an object."
    );
  }

  if (
    pointer.pk !==
      PROFILE_ACTIVATION_CONTROL_PK ||
    pointer.sk !==
      PROFILE_ACTIVATION_ACTIVE_SK
  ) {
    throw new Error(
      "Active Profile pointer has invalid DynamoDB keys."
    );
  }

  if (
    pointer.schema !==
      ACTIVE_PROFILE_POINTER_DOCUMENT_SCHEMA
  ) {
    throw new Error(
      "Active Profile pointer schema is invalid."
    );
  }

  if (
    pointer.pointerSchemaVersion !==
      CURRENT_ACTIVE_PROFILE_POINTER_SCHEMA_VERSION
  ) {
    throw new Error(
      "Active Profile pointer schema version is unsupported."
    );
  }

  requireRevision(
    pointer.revision
  );

  requireId(
    pointer.activationId,
    "activationId"
  );

  requireId(
    pointer.profileVariantId,
    "profileVariantId"
  );

  requireCanonicalTimestamp(
    pointer.activatedAt,
    "activatedAt"
  );

  requireContentSchemaVersion(
    pointer.contentSchemaVersion
  );

  requireSha256(
    pointer.contentHash,
    "contentHash"
  );

  return true;
}

export function validateProfileActivationRecord(
  record: any
) {
  if (
    !record ||
    typeof record !==
      "object" ||
    Array.isArray(
      record
    )
  ) {
    throw new Error(
      "Profile Activation record must be an object."
    );
  }

  if (
    record.pk !==
      PROFILE_ACTIVATION_LEDGER_PK
  ) {
    throw new Error(
      "Profile Activation record has invalid partition key."
    );
  }

  if (
    record.schema !==
      PROFILE_ACTIVATION_DOCUMENT_SCHEMA
  ) {
    throw new Error(
      "Profile Activation record schema is invalid."
    );
  }

  if (
    record.activationSchemaVersion !==
      CURRENT_PROFILE_ACTIVATION_SCHEMA_VERSION
  ) {
    throw new Error(
      "Profile Activation schema version is unsupported."
    );
  }

  const activationId =
    requireId(
      record.activationId,
      "activationId"
    );

  const profileVariantId =
    requireId(
      record.profileVariantId,
      "profileVariantId"
    );

  const activatedAt =
    requireCanonicalTimestamp(
      record.activatedAt,
      "activatedAt"
    );

  requireRevision(
    record.revision
  );

  requireContentSchemaVersion(
    record.contentSchemaVersion
  );

  requireSha256(
    record.contentHash,
    "contentHash"
  );

  if (
    record.sk !==
      createActivationLedgerSortKey(
        activatedAt,
        activationId
      )
  ) {
    throw new Error(
      "Profile Activation ledger sort key is invalid."
    );
  }

  if (
    record.gsi1pk !==
      createActivationVariantIndexPk(
        profileVariantId
      )
  ) {
    throw new Error(
      "Profile Activation variant index partition key is invalid."
    );
  }

  if (
    record.gsi1sk !==
      createActivationVariantIndexSk(
        activatedAt,
        activationId
      )
  ) {
    throw new Error(
      "Profile Activation variant index sort key is invalid."
    );
  }

  if (
    record.previousActivationId !==
      null
  ) {
    requireId(
      record.previousActivationId,
      "previousActivationId"
    );
  }

  if (
    record.previousProfileVariantId !==
      null
  ) {
    requireId(
      record.previousProfileVariantId,
      "previousProfileVariantId"
    );
  }

  return true;
}

/**
 * Produces the exact state transition that P3.2 will persist
 * atomically with TransactWriteItems.
 *
 * This function performs NO database access.
 */
export function buildProfileActivationTransition({
  currentPointer = null,

  activationId,

  profileVariantId,

  activatedAt,

  contentSchemaVersion,

  contentHash,
}: {
  currentPointer?: any | null;

  activationId: string;

  profileVariantId: string;

  activatedAt: string;

  contentSchemaVersion: number;

  contentHash: string;
}) {
  if (currentPointer) {
    validateActiveProfilePointer(
      currentPointer
    );
  }

  const normalizedActivationId =
    requireId(
      activationId,
      "activationId"
    );

  const normalizedProfileVariantId =
    requireId(
      profileVariantId,
      "profileVariantId"
    );

  const normalizedActivatedAt =
    requireCanonicalTimestamp(
      activatedAt,
      "activatedAt"
    );

  const normalizedContentSchemaVersion =
    requireContentSchemaVersion(
      contentSchemaVersion
    );

  const normalizedContentHash =
    requireSha256(
      contentHash,
      "contentHash"
    );

  const revision =
    currentPointer
      ? currentPointer.revision + 1
      : 1;

  const previousActivationId =
    currentPointer
      ? currentPointer.activationId
      : null;

  const previousProfileVariantId =
    currentPointer
      ? currentPointer.profileVariantId
      : null;

  const pointer = {
    pk:
      PROFILE_ACTIVATION_CONTROL_PK,

    sk:
      PROFILE_ACTIVATION_ACTIVE_SK,

    schema:
      ACTIVE_PROFILE_POINTER_DOCUMENT_SCHEMA,

    pointerSchemaVersion:
      CURRENT_ACTIVE_PROFILE_POINTER_SCHEMA_VERSION,

    revision,

    activationId:
      normalizedActivationId,

    profileVariantId:
      normalizedProfileVariantId,

    activatedAt:
      normalizedActivatedAt,

    contentSchemaVersion:
      normalizedContentSchemaVersion,

    contentHash:
      normalizedContentHash,
  };

  const ledger = {
    pk:
      PROFILE_ACTIVATION_LEDGER_PK,

    sk:
      createActivationLedgerSortKey(
        normalizedActivatedAt,
        normalizedActivationId
      ),

    gsi1pk:
      createActivationVariantIndexPk(
        normalizedProfileVariantId
      ),

    gsi1sk:
      createActivationVariantIndexSk(
        normalizedActivatedAt,
        normalizedActivationId
      ),

    schema:
      PROFILE_ACTIVATION_DOCUMENT_SCHEMA,

    activationSchemaVersion:
      CURRENT_PROFILE_ACTIVATION_SCHEMA_VERSION,

    revision,

    activationId:
      normalizedActivationId,

    profileVariantId:
      normalizedProfileVariantId,

    activatedAt:
      normalizedActivatedAt,

    previousActivationId,

    previousProfileVariantId,

    contentSchemaVersion:
      normalizedContentSchemaVersion,

    contentHash:
      normalizedContentHash,
  };

  validateActiveProfilePointer(
    pointer
  );

  validateProfileActivationRecord(
    ledger
  );

  return {
    expectedPreviousRevision:
      currentPointer
        ? currentPointer.revision
        : null,

    pointer,

    ledger,
  };
}