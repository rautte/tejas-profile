// infra/cdk/lambda/profile-platform-specification.ts

import * as crypto from "node:crypto";

import {
  normalizeAndValidateDeploymentConfigurationDocument,
} from "./deployment-configuration-contract";

import {
  normalizeAndValidatePlatformReleaseDocument,
  PLATFORM_RELEASE_SCHEMA_ID_V2,
} from "./platform-release-contract";


export const PROFILE_PLATFORM_SPECIFICATION_SCHEMA =
  "tejas-profile.profile-platform-specification";

export const PROFILE_PLATFORM_SPECIFICATION_SCHEMA_ID_V1 =
  "tejas-profile.profile-platform-specification.v1";

export const PROFILE_PLATFORM_SPECIFICATION_VERSION_V1 =
  1;


export const PROFILE_PLATFORM_COMPATIBILITY_SCHEMA =
  "tejas-profile.profile-platform-compatibility";

export const PROFILE_PLATFORM_COMPATIBILITY_SCHEMA_ID_V1 =
  "tejas-profile.profile-platform-compatibility.v1";


export const PPS_V1_SUPPORTED_PROFILE_CONTENT_SCHEMA_VERSIONS =
  [
    1,
  ] as const;


export const PROFILE_PLATFORM_COMPATIBILITY_REASON_CODES = {
  UNSUPPORTED_PROFILE_CONTENT_SCHEMA_VERSION:
    "UNSUPPORTED_PROFILE_CONTENT_SCHEMA_VERSION",
} as const;

export const PROFILE_PLATFORM_POLICY_ERROR_CODES = {
  DECLARATION_REQUIRED:
    "PPS_DECLARATION_REQUIRED",

  VERSION_UNSUPPORTED:
    "PPS_VERSION_UNSUPPORTED",
} as const;


function requireSupportedSpecificationVersion(
  value:
    unknown
) {
  if (
    value !==
      PROFILE_PLATFORM_SPECIFICATION_VERSION_V1
  ) {
    throw new Error(
      `Unsupported Profile Platform Specification version "${String(
        value
      )}".`
    );
  }


  return PROFILE_PLATFORM_SPECIFICATION_VERSION_V1;
}


function computeCompatibilityId({
  specificationVersion,

  platformReleaseSchemaId,

  stage,

  deploymentConfigurationId,

  platformReleaseId,

  profileVariantId,

  contentSchemaVersion,

  contentHash,
}: {
  specificationVersion:
    number;

  platformReleaseSchemaId:
    string;

  stage:
    string;

  deploymentConfigurationId:
    string;

  platformReleaseId:
    string;

  profileVariantId:
    string;

  contentSchemaVersion:
    number;

  contentHash:
    string;
}) {
  /**
   * Compatibility identity contains exactly the immutable evidence
   * that can affect a PPS v1 decision.
   *
   * It intentionally does NOT contain:
   * - timestamps
   * - Git SHA
   * - legacy profileVersionId
   * - activation state
   * - deployment occurrence
   * - targeting
   *
   * A future PPS version may use different compatibility evidence
   * and therefore has its own specificationVersion.
   */
  const identityMaterial =
    [
      PROFILE_PLATFORM_COMPATIBILITY_SCHEMA_ID_V1,
      String(
        specificationVersion
      ),
      platformReleaseSchemaId,
      stage,
      deploymentConfigurationId,
      platformReleaseId,
      profileVariantId,
      String(
        contentSchemaVersion
      ),
      contentHash,
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


  return `ppsc_${digest}`;
}


/**
 * PPS v1
 *
 * Current compatibility rule:
 *
 * - the immutable Deployment Configuration must belong to the
 *   supplied authoritative Platform Release
 * - stage must match
 * - Profile content schema version must be supported by PPS v1
 *
 * Composition mismatches are integrity errors, NOT compatibility
 * failures. They therefore throw rather than returning compatible=false.
 */
export function evaluateProfilePlatformCompatibility({
  specificationVersion,

  platformRelease,

  deploymentConfiguration,
}: {
  specificationVersion:
    number;

  platformRelease:
    unknown;

  deploymentConfiguration:
    unknown;
}) {
  const normalizedSpecificationVersion =
    requireSupportedSpecificationVersion(
      specificationVersion
    );


  const release =
    normalizeAndValidatePlatformReleaseDocument(
      platformRelease
    );


  const configuration =
    normalizeAndValidateDeploymentConfigurationDocument(
      deploymentConfiguration
    );


  /**
   * These are immutable-composition integrity checks.
   *
   * A configuration referring to another release/stage is not merely
   * "incompatible"; it is the wrong input pair.
   */
  if (
    configuration
      .platformReleaseId !==
    release
      .platformReleaseId
  ) {
    throw new Error(
      "Deployment Configuration Platform Release does not match the authoritative Platform Release."
    );
  }


  if (
    configuration.stage !==
    release.stage
  ) {
    throw new Error(
      "Deployment Configuration stage does not match the authoritative Platform Release."
    );
  }


  const contentSchemaVersion =
    configuration
      .profile
      .contentSchemaVersion;


  const supportedContentSchemaVersions =
    [
      ...PPS_V1_SUPPORTED_PROFILE_CONTENT_SCHEMA_VERSIONS,
    ];


  const compatible =
    supportedContentSchemaVersions.includes(
      contentSchemaVersion as 1
    );


  const reasons =
    compatible
      ? []
      : [
          {
            code:
              PROFILE_PLATFORM_COMPATIBILITY_REASON_CODES
                .UNSUPPORTED_PROFILE_CONTENT_SCHEMA_VERSION,

            actualContentSchemaVersion:
              contentSchemaVersion,

            supportedContentSchemaVersions,
          },
        ];


  const compatibilityId =
    computeCompatibilityId({
      specificationVersion:
        normalizedSpecificationVersion,

      platformReleaseSchemaId:
        release.schemaId,

      stage:
        configuration.stage,

      deploymentConfigurationId:
        configuration
          .deploymentConfigurationId,

      platformReleaseId:
        configuration
          .platformReleaseId,

      profileVariantId:
        configuration
          .profileVariantId,

      contentSchemaVersion,

      contentHash:
        configuration
          .profile
          .contentHash,
    });


  return {
    schema:
      PROFILE_PLATFORM_COMPATIBILITY_SCHEMA,

    schemaId:
      PROFILE_PLATFORM_COMPATIBILITY_SCHEMA_ID_V1,

    compatibilityId,

    specification: {
      schema:
        PROFILE_PLATFORM_SPECIFICATION_SCHEMA,

      schemaId:
        PROFILE_PLATFORM_SPECIFICATION_SCHEMA_ID_V1,

      version:
        normalizedSpecificationVersion,
    },

    deploymentConfigurationId:
      configuration
        .deploymentConfigurationId,

    platformReleaseId:
      configuration
        .platformReleaseId,

    profileVariantId:
      configuration
        .profileVariantId,

    compatible,

    reasons,

    evidence: {
      stage:
        configuration.stage,

      platformReleaseSchemaId:
        release.schemaId,

      deploymentConfigurationSchemaId:
        configuration.schemaId,

      contentSchemaVersion,

      contentHash:
        configuration
          .profile
          .contentHash,
    },
  };
}


export function assertProfilePlatformCompatible(
  input: {
    specificationVersion:
      number;

    platformRelease:
      unknown;

    deploymentConfiguration:
      unknown;
  }
) {
  const result =
    evaluateProfilePlatformCompatibility(
      input
    );


  if (
    !result.compatible
  ) {
    const error:
      any =
        new Error(
          `Deployment Configuration "${result.deploymentConfigurationId}" is not compatible with PPS v${result.specification.version}.`
        );


    error.name =
      "ProfilePlatformCompatibilityError";

    error.code =
      "PPS_INCOMPATIBLE";

    error.compatibility =
      result;


    throw error;
  }


  return result;
}


function createProfilePlatformPolicyError({
  code,

  message,

  platformReleaseId,

  declaredPpsVersion,
}: {
  code:
    string;

  message:
    string;

  platformReleaseId:
    string;

  declaredPpsVersion:
    number | null;
}) {
  const error:
    any =
      new Error(
        message
      );


  error.name =
    "ProfilePlatformPolicyError";

  error.code =
    code;

  error.platformReleaseId =
    platformReleaseId;

  error.declaredPpsVersion =
    declaredPpsVersion;


  return error;
}


/**
 * Operational PPS policy.
 *
 * The raw evaluator above can evaluate an explicitly supplied PPS
 * version against immutable evidence.
 *
 * Operational callers must NOT choose that version themselves.
 * The authoritative Platform Release must explicitly declare it.
 *
 * Therefore:
 *
 * - Platform Release v1 remains valid historical metadata, but is not
 *   eligible for new PPS-governed operational use.
 *
 * - Platform Release v2 must explicitly declare profileRuntime.ppsVersion.
 *
 * - A structurally valid future PPS declaration fails closed until this
 *   application knows how to evaluate that PPS version.
 */

export function requireDeclaredProfilePlatformSpecification(
  platformRelease:
    unknown
) {
  const release =
    normalizeAndValidatePlatformReleaseDocument(
      platformRelease
    );


  if (
    release.schemaId !==
      PLATFORM_RELEASE_SCHEMA_ID_V2
  ) {
    throw createProfilePlatformPolicyError({
      code:
        PROFILE_PLATFORM_POLICY_ERROR_CODES
          .DECLARATION_REQUIRED,

      message:
        `Platform Release "${release.platformReleaseId}" does not explicitly declare a Profile Platform Specification.`,

      platformReleaseId:
        release.platformReleaseId,

      declaredPpsVersion:
        null,
    });
  }


  const declaredPpsVersion =
    release
      .profileRuntime
      .ppsVersion;


  if (
    declaredPpsVersion !==
      PROFILE_PLATFORM_SPECIFICATION_VERSION_V1
  ) {
    throw createProfilePlatformPolicyError({
      code:
        PROFILE_PLATFORM_POLICY_ERROR_CODES
          .VERSION_UNSUPPORTED,

      message:
        `Platform Release "${release.platformReleaseId}" declares unsupported PPS v${declaredPpsVersion}.`,

      platformReleaseId:
        release.platformReleaseId,

      declaredPpsVersion,
    });
  }


  return {
    platformRelease:
      release,

    specificationVersion:
      declaredPpsVersion,
  };
}

export function assertDeclaredProfilePlatformCompatible({
  platformRelease,

  deploymentConfiguration,
}: {
  platformRelease:
    unknown;

  deploymentConfiguration:
    unknown;
}) {
  const {
    platformRelease:
      release,

    specificationVersion,
  } =
    requireDeclaredProfilePlatformSpecification(
      platformRelease
    );


  return assertProfilePlatformCompatible({
    specificationVersion,

    platformRelease:
      release,

    deploymentConfiguration,
  });
}


export function isProfilePlatformPolicyError(
  error:
    any
) {
  return (
    error?.name ===
      "ProfilePlatformPolicyError" &&
    (
      error?.code ===
        PROFILE_PLATFORM_POLICY_ERROR_CODES
          .DECLARATION_REQUIRED ||
      error?.code ===
        PROFILE_PLATFORM_POLICY_ERROR_CODES
          .VERSION_UNSUPPORTED
    )
  );
}


export function isProfilePlatformCompatibilityGateError(
  error:
    any
) {
  return (
    isProfilePlatformPolicyError(
      error
    ) ||
    isProfilePlatformCompatibilityError(
      error
    )
  );
}


export function isProfilePlatformCompatibilityError(
  error:
    any
) {
  return (
    error?.name ===
      "ProfilePlatformCompatibilityError" &&
    error?.code ===
      "PPS_INCOMPATIBLE"
  );
}