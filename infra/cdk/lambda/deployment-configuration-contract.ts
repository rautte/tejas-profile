// infra/cdk/lambda/deployment-configuration-contract.ts

import * as crypto from "node:crypto";

import {
  normalizeAndValidateProfileVariantDocument,
} from "./profile-variants-contract";

import {
  normalizeAndValidatePlatformReleaseDocument,
} from "./platform-release-contract";


export const DEPLOYMENT_CONFIGURATION_DOCUMENT_SCHEMA =
  "tejas-profile.deployment-configuration";

export const DEPLOYMENT_CONFIGURATION_SCHEMA_ID_V1 =
  "tejas-profile.deployment-configuration.v1";


const ID_RE =
  /^[A-Za-z0-9._:-]+$/;

const SHA256_RE =
  /^[a-f0-9]{64}$/;


type PlainObject =
  Record<
    string,
    any
  >;


function cleanString(
  value: unknown
) {
  return String(
    value ?? ""
  ).trim();
}


function isPlainObject(
  value: unknown
): value is PlainObject {
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


function assertAllowedKeys(
  value: PlainObject,
  allowed:
    Set<string>,
  field:
    string
) {
  for (
    const key of
      Object.keys(
        value
      )
  ) {
    if (
      !allowed.has(
        key
      )
    ) {
      throw new Error(
        `${field}.${key} is not supported.`
      );
    }
  }
}


function requireString(
  value: unknown,
  field: string,
  maxLength = 240
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


  if (
    normalized.length >
      maxLength
  ) {
    throw new Error(
      `${field} exceeds ${maxLength} characters.`
    );
  }


  return normalized;
}


function requireId(
  value: unknown,
  field: string
) {
  const normalized =
    requireString(
      value,
      field,
      160
    );


  if (
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
      `${field} must be a 64-character SHA-256 digest.`
    );
  }


  return normalized;
}


function requireStage(
  value: unknown
) {
  const normalized =
    cleanString(
      value
    );


  if (
    normalized !==
      "dev" &&
    normalized !==
      "prod"
  ) {
    throw new Error(
      'stage must be "dev" or "prod".'
    );
  }


  return normalized as
    | "dev"
    | "prod";
}


function requireCanonicalTimestamp(
  value: unknown,
  field: string
) {
  const normalized =
    requireString(
      value,
      field,
      64
    );


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


function requirePositiveInteger(
  value: unknown,
  field: string
) {
  if (
    !Number.isInteger(
      value
    ) ||
    Number(
      value
    ) <=
      0
  ) {
    throw new Error(
      `${field} must be a positive integer.`
    );
  }


  return Number(
    value
  );
}


function normalizeTargeting(
  value: unknown
) {
  if (
    !isPlainObject(
      value
    )
  ) {
    throw new Error(
      "profile.targeting must be an object."
    );
  }


  assertAllowedKeys(
    value,
    new Set([
      "location",
      "jobRole",
    ]),
    "profile.targeting"
  );


  const location =
    requireString(
      value.location,
      "profile.targeting.location",
      240
    );

  const jobRole =
    requireString(
      value.jobRole,
      "profile.targeting.jobRole",
      240
    );


  if (
    location !==
      value.location
  ) {
    throw new Error(
      "profile.targeting.location must be trimmed."
    );
  }


  if (
    jobRole !==
      value.jobRole
  ) {
    throw new Error(
      "profile.targeting.jobRole must be trimmed."
    );
  }


  return {
    location,

    jobRole,
  };
}


export function computeDeploymentConfigurationId({
  stage,
  platformReleaseId,
  profileVariantId,
}: {
  stage:
    | "dev"
    | "prod";

  platformReleaseId:
    string;

  profileVariantId:
    string;
}) {
  const normalizedStage =
    requireStage(
      stage
    );

  const normalizedPlatformReleaseId =
    requireId(
      platformReleaseId,
      "platformReleaseId"
    );

  const normalizedProfileVariantId =
    requireId(
      profileVariantId,
      "profileVariantId"
    );


  /**
   * The composition identity intentionally contains ONLY
   * first-class immutable identities + stage.
   *
   * It intentionally does NOT contain:
   * - createdAt
   * - Git SHA
   * - legacy profileVersionId
   * - targeting
   * - content schema
   * - compatibility/PPS result
   * - activation state
   * - usage epoch
   *
   * Profile metadata is duplicated into the document as
   * self-describing historical evidence, but Profile Variant
   * immutability means it does not need to participate in the
   * configuration identity independently of profileVariantId.
   */
  const identityMaterial =
    [
      DEPLOYMENT_CONFIGURATION_SCHEMA_ID_V1,
      normalizedStage,
      normalizedPlatformReleaseId,
      normalizedProfileVariantId,
    ].join(
      "\n"
    );


  const digest =
    crypto
      .createHash(
        "sha256"
      )
      .update(
        identityMaterial,
        "utf8"
      )
      .digest(
        "hex"
      );


  return `cfg_${digest}`;
}


export function normalizeAndValidateDeploymentConfigurationDocument(
  input: unknown
) {
  if (
    !isPlainObject(
      input
    )
  ) {
    throw new Error(
      "Deployment Configuration must be an object."
    );
  }


  assertAllowedKeys(
    input,
    new Set([
      "schema",
      "schemaId",
      "deploymentConfigurationId",
      "stage",
      "createdAt",
      "platformReleaseId",
      "profileVariantId",
      "profile",
    ]),
    "Deployment Configuration"
  );


  if (
    input.schema !==
      DEPLOYMENT_CONFIGURATION_DOCUMENT_SCHEMA
  ) {
    throw new Error(
      `schema must be "${DEPLOYMENT_CONFIGURATION_DOCUMENT_SCHEMA}".`
    );
  }


  if (
    input.schemaId !==
      DEPLOYMENT_CONFIGURATION_SCHEMA_ID_V1
  ) {
    throw new Error(
      `schemaId must be "${DEPLOYMENT_CONFIGURATION_SCHEMA_ID_V1}".`
    );
  }


  const stage =
    requireStage(
      input.stage
    );

  const platformReleaseId =
    requireId(
      input.platformReleaseId,
      "platformReleaseId"
    );

  const profileVariantId =
    requireId(
      input.profileVariantId,
      "profileVariantId"
    );

  const deploymentConfigurationId =
    requireId(
      input.deploymentConfigurationId,
      "deploymentConfigurationId"
    );

  const expectedId =
    computeDeploymentConfigurationId({
      stage,

      platformReleaseId,

      profileVariantId,
    });


  if (
    deploymentConfigurationId !==
      expectedId
  ) {
    throw new Error(
      `deploymentConfigurationId must be "${expectedId}" for this immutable composition.`
    );
  }


  const createdAt =
    requireCanonicalTimestamp(
      input.createdAt,
      "createdAt"
    );


  if (
    !isPlainObject(
      input.profile
    )
  ) {
    throw new Error(
      "profile must be an object."
    );
  }


  assertAllowedKeys(
    input.profile,
    new Set([
      "contentSchemaVersion",
      "contentHash",
      "targeting",
    ]),
    "profile"
  );


  const profile = {
    contentSchemaVersion:
      requirePositiveInteger(
        input.profile
          .contentSchemaVersion,
        "profile.contentSchemaVersion"
      ),

    contentHash:
      requireSha256(
        input.profile
          .contentHash,
        "profile.contentHash"
      ),

    targeting:
      normalizeTargeting(
        input.profile
          .targeting
      ),
  };


  return {
    schema:
      DEPLOYMENT_CONFIGURATION_DOCUMENT_SCHEMA,

    schemaId:
      DEPLOYMENT_CONFIGURATION_SCHEMA_ID_V1,

    deploymentConfigurationId,

    stage,

    createdAt,

    platformReleaseId,

    profileVariantId,

    profile,
  };
}


export function createDeploymentConfigurationObjectKey(
  deploymentConfigurationId:
    unknown
) {
  const normalized =
    requireId(
      deploymentConfigurationId,
      "deploymentConfigurationId"
    );


  return (
    `configurations/${normalized}.json`
  );
}


export function createDeploymentConfigurationDocument({
  stage,
  createdAt,
  platformRelease,
  profileVariant,
}: {
  stage:
    | "dev"
    | "prod";

  createdAt:
    string;

  platformRelease:
    unknown;

  profileVariant:
    unknown;
}) {
  const normalizedStage =
    requireStage(
      stage
    );


  const release =
    normalizeAndValidatePlatformReleaseDocument(
      platformRelease
    );


  const variant =
    normalizeAndValidateProfileVariantDocument(
      profileVariant
    );


  if (
    release.stage !==
      normalizedStage
  ) {
    throw new Error(
      `Platform Release stage "${release.stage}" does not match Deployment Configuration stage "${normalizedStage}".`
    );
  }


  const deploymentConfigurationId =
    computeDeploymentConfigurationId({
      stage:
        normalizedStage,

      platformReleaseId:
        release
          .platformReleaseId,

      profileVariantId:
        variant
          .profileVariantId,
    });


  return normalizeAndValidateDeploymentConfigurationDocument({
    schema:
      DEPLOYMENT_CONFIGURATION_DOCUMENT_SCHEMA,

    schemaId:
      DEPLOYMENT_CONFIGURATION_SCHEMA_ID_V1,

    deploymentConfigurationId,

    stage:
      normalizedStage,

    createdAt,

    platformReleaseId:
      release
        .platformReleaseId,

    profileVariantId:
      variant
        .profileVariantId,

    profile: {
      contentSchemaVersion:
        variant
          .contentSchemaVersion,

      contentHash:
        variant
          .contentHash,

      targeting: {
        location:
          variant
            .targeting
            .location,

        jobRole:
          variant
            .targeting
            .jobRole,
      },
    },
  });
}