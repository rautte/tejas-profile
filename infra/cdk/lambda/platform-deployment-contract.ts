// infra/cdk/lambda/platform-deployment-contract.ts

export const PLATFORM_DEPLOYMENT_DOCUMENT_SCHEMA =
  "tejas-profile.platform-deployment";

export const ACTIVE_PLATFORM_RELEASE_POINTER_DOCUMENT_SCHEMA =
  "tejas-profile.active-platform-release-pointer";

export const CURRENT_PLATFORM_DEPLOYMENT_SCHEMA_VERSION =
  1;

export const CURRENT_ACTIVE_PLATFORM_RELEASE_POINTER_SCHEMA_VERSION =
  1;

export const PLATFORM_DEPLOYMENT_CONTROL_PK =
  "CONTROL";

export const PLATFORM_DEPLOYMENT_ACTIVE_SK =
  "ACTIVE";

export const PLATFORM_DEPLOYMENT_LEDGER_PK =
  "DEPLOYMENT";

export const PLATFORM_DEPLOYMENT_RELEASE_INDEX_NAME =
  "ByPlatformRelease";

export const PLATFORM_DEPLOYMENT_RELEASE_INDEX_PK_PREFIX =
  "RELEASE#";


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
    normalized.length >
      160 ||
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
    revision <=
      0
  ) {
    throw new Error(
      "revision must be a positive integer."
    );
  }


  return revision;
}


export function createPlatformDeploymentLedgerSortKey(
  deployedAt: string,
  deploymentId: string
) {
  const timestamp =
    requireCanonicalTimestamp(
      deployedAt,
      "deployedAt"
    );

  const id =
    requireId(
      deploymentId,
      "deploymentId"
    );


  return (
    timestamp +
    "#" +
    id
  );
}


export function createPlatformDeploymentReleaseIndexPk(
  platformReleaseId:
    string
) {
  return (
    PLATFORM_DEPLOYMENT_RELEASE_INDEX_PK_PREFIX +
    requireId(
      platformReleaseId,
      "platformReleaseId"
    )
  );
}


export function createPlatformDeploymentReleaseIndexSk(
  deployedAt: string,
  deploymentId: string
) {
  return createPlatformDeploymentLedgerSortKey(
    deployedAt,
    deploymentId
  );
}


export function validateActivePlatformReleasePointer(
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
      "Active Platform Release pointer must be an object."
    );
  }


  if (
    pointer.pk !==
      PLATFORM_DEPLOYMENT_CONTROL_PK ||
    pointer.sk !==
      PLATFORM_DEPLOYMENT_ACTIVE_SK
  ) {
    throw new Error(
      "Active Platform Release pointer has invalid DynamoDB keys."
    );
  }


  if (
    pointer.schema !==
      ACTIVE_PLATFORM_RELEASE_POINTER_DOCUMENT_SCHEMA
  ) {
    throw new Error(
      "Active Platform Release pointer schema is invalid."
    );
  }


  if (
    pointer.pointerSchemaVersion !==
      CURRENT_ACTIVE_PLATFORM_RELEASE_POINTER_SCHEMA_VERSION
  ) {
    throw new Error(
      "Active Platform Release pointer schema version is unsupported."
    );
  }


  requireRevision(
    pointer.revision
  );

  requireId(
    pointer.deploymentId,
    "deploymentId"
  );

  requireId(
    pointer.platformReleaseId,
    "platformReleaseId"
  );

  requireCanonicalTimestamp(
    pointer.deployedAt,
    "deployedAt"
  );

  requireSha256(
    pointer.platformReleaseSha256,
    "platformReleaseSha256"
  );


  return true;
}


export function validatePlatformDeploymentRecord(
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
      "Platform Deployment record must be an object."
    );
  }


  if (
    record.pk !==
      PLATFORM_DEPLOYMENT_LEDGER_PK
  ) {
    throw new Error(
      "Platform Deployment record has invalid partition key."
    );
  }


  if (
    record.schema !==
      PLATFORM_DEPLOYMENT_DOCUMENT_SCHEMA
  ) {
    throw new Error(
      "Platform Deployment record schema is invalid."
    );
  }


  if (
    record.deploymentSchemaVersion !==
      CURRENT_PLATFORM_DEPLOYMENT_SCHEMA_VERSION
  ) {
    throw new Error(
      "Platform Deployment schema version is unsupported."
    );
  }


  const revision =
    requireRevision(
      record.revision
    );

  const deploymentId =
    requireId(
      record.deploymentId,
      "deploymentId"
    );

  const platformReleaseId =
    requireId(
      record.platformReleaseId,
      "platformReleaseId"
    );

  const deployedAt =
    requireCanonicalTimestamp(
      record.deployedAt,
      "deployedAt"
    );


  requireSha256(
    record.platformReleaseSha256,
    "platformReleaseSha256"
  );


  if (
    record.sk !==
      createPlatformDeploymentLedgerSortKey(
        deployedAt,
        deploymentId
      )
  ) {
    throw new Error(
      "Platform Deployment ledger sort key is invalid."
    );
  }


  if (
    record.gsi1pk !==
      createPlatformDeploymentReleaseIndexPk(
        platformReleaseId
      )
  ) {
    throw new Error(
      "Platform Deployment release index partition key is invalid."
    );
  }


  if (
    record.gsi1sk !==
      createPlatformDeploymentReleaseIndexSk(
        deployedAt,
        deploymentId
      )
  ) {
    throw new Error(
      "Platform Deployment release index sort key is invalid."
    );
  }


  const hasPreviousDeployment =
    record.previousDeploymentId !==
      null;

  const hasPreviousRelease =
    record.previousPlatformReleaseId !==
      null;


  if (
    hasPreviousDeployment !==
      hasPreviousRelease
  ) {
    throw new Error(
      "Platform Deployment previous deployment/release identity must be provided together."
    );
  }


  if (
    revision ===
      1 &&
    hasPreviousDeployment
  ) {
    throw new Error(
      "First Platform Deployment cannot have previous deployment state."
    );
  }


  if (
    revision >
      1 &&
    !hasPreviousDeployment
  ) {
    throw new Error(
      "Subsequent Platform Deployment must include previous deployment state."
    );
  }


  if (
    hasPreviousDeployment
  ) {
    requireId(
      record.previousDeploymentId,
      "previousDeploymentId"
    );

    requireId(
      record.previousPlatformReleaseId,
      "previousPlatformReleaseId"
    );
  }


  return true;
}


/**
 * Builds one atomic Platform deployment state transition.
 *
 * This performs NO database access.
 *
 * Registration != deployment:
 *
 * a Platform Release may exist forever without ever becoming ACTIVE.
 */
export function buildPlatformDeploymentTransition({
  currentPointer =
    null,

  deploymentId,

  platformReleaseId,

  deployedAt,

  platformReleaseSha256,
}: {
  currentPointer?:
    any |
    null;

  deploymentId:
    string;

  platformReleaseId:
    string;

  deployedAt:
    string;

  platformReleaseSha256:
    string;
}) {
  if (
    currentPointer
  ) {
    validateActivePlatformReleasePointer(
      currentPointer
    );
  }


  const normalizedDeploymentId =
    requireId(
      deploymentId,
      "deploymentId"
    );

  const normalizedPlatformReleaseId =
    requireId(
      platformReleaseId,
      "platformReleaseId"
    );

  const normalizedDeployedAt =
    requireCanonicalTimestamp(
      deployedAt,
      "deployedAt"
    );

  const normalizedReleaseSha256 =
    requireSha256(
      platformReleaseSha256,
      "platformReleaseSha256"
    );


  const revision =
    currentPointer
      ? currentPointer.revision +
        1
      : 1;


  const previousDeploymentId =
    currentPointer
      ? currentPointer
          .deploymentId
      : null;

  const previousPlatformReleaseId =
    currentPointer
      ? currentPointer
          .platformReleaseId
      : null;


  const pointer = {
    pk:
      PLATFORM_DEPLOYMENT_CONTROL_PK,

    sk:
      PLATFORM_DEPLOYMENT_ACTIVE_SK,

    schema:
      ACTIVE_PLATFORM_RELEASE_POINTER_DOCUMENT_SCHEMA,

    pointerSchemaVersion:
      CURRENT_ACTIVE_PLATFORM_RELEASE_POINTER_SCHEMA_VERSION,

    revision,

    deploymentId:
      normalizedDeploymentId,

    platformReleaseId:
      normalizedPlatformReleaseId,

    deployedAt:
      normalizedDeployedAt,

    platformReleaseSha256:
      normalizedReleaseSha256,
  };


  const ledger = {
    pk:
      PLATFORM_DEPLOYMENT_LEDGER_PK,

    sk:
      createPlatformDeploymentLedgerSortKey(
        normalizedDeployedAt,
        normalizedDeploymentId
      ),

    gsi1pk:
      createPlatformDeploymentReleaseIndexPk(
        normalizedPlatformReleaseId
      ),

    gsi1sk:
      createPlatformDeploymentReleaseIndexSk(
        normalizedDeployedAt,
        normalizedDeploymentId
      ),

    schema:
      PLATFORM_DEPLOYMENT_DOCUMENT_SCHEMA,

    deploymentSchemaVersion:
      CURRENT_PLATFORM_DEPLOYMENT_SCHEMA_VERSION,

    revision,

    deploymentId:
      normalizedDeploymentId,

    platformReleaseId:
      normalizedPlatformReleaseId,

    deployedAt:
      normalizedDeployedAt,

    platformReleaseSha256:
      normalizedReleaseSha256,

    previousDeploymentId,

    previousPlatformReleaseId,
  };


  validateActivePlatformReleasePointer(
    pointer
  );

  validatePlatformDeploymentRecord(
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