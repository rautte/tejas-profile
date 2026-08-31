// infra/cdk/lambda/effective-deployment-configuration-reader.ts

import {
  GetObjectCommand,
} from "@aws-sdk/client-s3";

import {
  readActivePlatformReleasePointer,
} from "./platform-deployment-store";

import {
  createPlatformReleaseObjectKey,
  normalizeAndValidatePlatformReleaseDocument,
} from "./platform-release-contract";

import {
  computeDeploymentConfigurationId,
  createDeploymentConfigurationObjectKey,
  normalizeAndValidateDeploymentConfigurationDocument,
} from "./deployment-configuration-contract";

import {
  base64Sha256ToHex,
  sha256Hex,
} from "./profile-variants-contract";

import {
  assertDeclaredProfilePlatformCompatible,
  requireDeclaredProfilePlatformSpecification,
} from "./profile-platform-specification";


type AwsSender = {
  send:
    (
      command:
        any
    ) => Promise<any>;
};


function requireStage(
  value:
    unknown
) {
  const stage =
    String(
      value ||
      ""
    ).trim();


  if (
    stage !==
      "dev" &&
    stage !==
      "prod"
  ) {
    throw new Error(
      'Effective Deployment Configuration stage must be "dev" or "prod".'
    );
  }


  return stage as
    | "dev"
    | "prod";
}


function requireStorageName(
  value:
    unknown,

  label:
    string
) {
  const normalized =
    String(
      value ||
      ""
    ).trim();


  if (
    !normalized
  ) {
    throw new Error(
      `${label} is required.`
    );
  }


  return normalized;
}


const RUNTIME_PROFILE_ID_RE =
  /^[A-Za-z0-9._:-]+$/;

const RUNTIME_PROFILE_SHA256_RE =
  /^[a-f0-9]{64}$/;


function requireRuntimeProfileId(
  value:
    unknown,

  field:
    string
) {
  if (
    typeof value !==
      "string" ||
    value !==
      value.trim() ||
    !value ||
    value.length >
      160 ||
    !RUNTIME_PROFILE_ID_RE.test(
      value
    )
  ) {
    throw new Error(
      `Active Profile runtime identity ${field} is invalid.`
    );
  }


  return value;
}


function requireRuntimeProfilePositiveInteger(
  value:
    unknown,

  field:
    string
) {
  if (
    typeof value !==
      "number" ||
    !Number.isInteger(
      value
    ) ||
    value <=
      0
  ) {
    throw new Error(
      `Active Profile runtime identity ${field} must be a positive integer.`
    );
  }


  return value;
}


function requireRuntimeProfileTimestamp(
  value:
    unknown,

  field:
    string
) {
  if (
    typeof value !==
      "string" ||
    value !==
      value.trim() ||
    !value
  ) {
    throw new Error(
      `Active Profile runtime identity ${field} is invalid.`
    );
  }


  const parsed =
    new Date(
      value
    );


  if (
    Number.isNaN(
      parsed.getTime()
    ) ||
    parsed.toISOString() !==
      value
  ) {
    throw new Error(
      `Active Profile runtime identity ${field} must be a canonical UTC ISO timestamp.`
    );
  }


  return value;
}


function requireRuntimeProfileSha256(
  value:
    unknown,

  field:
    string
) {
  if (
    typeof value !==
      "string" ||
    value !==
      value.trim() ||
    !RUNTIME_PROFILE_SHA256_RE.test(
      value
    )
  ) {
    throw new Error(
      `Active Profile runtime identity ${field} must be a 64-character lowercase SHA-256 digest.`
    );
  }


  return value;
}


/**
 * Validate the runtime-safe Active Profile identity produced by
 * readPublicActiveProfile().
 *
 * This is deliberately NOT the DynamoDB storage document.
 *
 * pk / sk / schema / pointerSchemaVersion remain internal
 * control-plane metadata and must not be required by this public
 * runtime boundary.
 *
 * The identity still fails closed on every field needed to bind the
 * effective immutable composition.
 */
function validateRuntimeActiveProfileIdentity(
  identity:
    any
) {
  if (
    !identity ||
    typeof identity !==
      "object" ||
    Array.isArray(
      identity
    )
  ) {
    throw new Error(
      "Active Profile runtime identity must be an object."
    );
  }


  requireRuntimeProfilePositiveInteger(
    identity.revision,
    "revision"
  );

  requireRuntimeProfileId(
    identity.activationId,
    "activationId"
  );

  requireRuntimeProfileId(
    identity.profileVariantId,
    "profileVariantId"
  );

  requireRuntimeProfileTimestamp(
    identity.activatedAt,
    "activatedAt"
  );

  requireRuntimeProfilePositiveInteger(
    identity.contentSchemaVersion,
    "contentSchemaVersion"
  );

  requireRuntimeProfileSha256(
    identity.contentHash,
    "contentHash"
  );


  return true;
}


function isS3NotFound(
  error:
    any
) {
  const name =
    String(
      error?.name ||
      ""
    );

  const status =
    Number(
      error
        ?.$metadata
        ?.httpStatusCode ||
      0
    );


  return (
    name ===
      "NoSuchKey" ||
    name ===
      "NotFound" ||
    status ===
      404
  );
}


async function bodyToString(
  body:
    any
) {
  if (
    !body
  ) {
    return "";
  }


  if (
    typeof body
      .transformToString ===
      "function"
  ) {
    return body
      .transformToString(
        "utf-8"
      );
  }


  if (
    body instanceof
      Uint8Array
  ) {
    return Buffer
      .from(
        body
      )
      .toString(
        "utf-8"
      );
  }


  if (
    typeof body.on ===
      "function"
  ) {
    return new Promise<string>(
      (
        resolve,
        reject
      ) => {
        const chunks:
          any[] = [];


        body.on(
          "data",
          (
            chunk:
              any
          ) =>
            chunks.push(
              chunk
            )
        );

        body.on(
          "error",
          reject
        );

        body.on(
          "end",
          () =>
            resolve(
              Buffer
                .concat(
                  chunks
                )
                .toString(
                  "utf-8"
                )
            )
        );
      }
    );
  }


  throw new Error(
    "Unsupported immutable runtime document body."
  );
}


async function readImmutableJson({
  s3Client,

  bucket,

  key,

  label,
}: {
  s3Client:
    AwsSender;

  bucket:
    string;

  key:
    string;

  label:
    string;
}) {
  const out =
    await s3Client.send(
      new GetObjectCommand({
        Bucket:
          bucket,

        Key:
          key,

        ChecksumMode:
          "ENABLED",
      })
    );


  const body =
    await bodyToString(
      out.Body
    );


  if (
    !body
  ) {
    throw new Error(
      `${label} is empty.`
    );
  }


  const sha256 =
    sha256Hex(
      body
    );


  const storedChecksum =
    base64Sha256ToHex(
      String(
        out
          .ChecksumSHA256 ||
        ""
      )
    );


  if (
    storedChecksum &&
    storedChecksum !==
      sha256
  ) {
    throw new Error(
      `${label} checksum mismatch.`
    );
  }


  let parsed:
    any;


  try {
    parsed =
      JSON.parse(
        body
      );
  } catch {
    throw new Error(
      `${label} is invalid JSON.`
    );
  }


  return {
    parsed,

    sha256,
  };
}


/**
 * Resolve the software/content combination that is effectively live.
 *
 * IMPORTANT:
 *
 * - activeProfilePointer comes from the same Profile runtime read that
 *   loads/validates the active immutable Profile Variant.
 *
 * - Active Platform state is read strongly consistently here.
 *
 * - No identity is generated in the browser.
 *
 * - No Platform identity is inferred from Git SHA/profileVersionId.
 *
 * - Deployment Configuration must already exist as immutable truth.
 *
 * - A missing Active Platform pointer is a valid bootstrap/legacy state.
 */
export async function readEffectiveDeploymentConfiguration({
  platformDeploymentClient,

  s3Client,

  platformDeploymentTableName,

  platformReleasesBucket,

  deploymentConfigurationsBucket,

  stage,

  activeProfilePointer,
}: {
  platformDeploymentClient:
    AwsSender;

  s3Client:
    AwsSender;

  platformDeploymentTableName:
    string;

  platformReleasesBucket:
    string;

  deploymentConfigurationsBucket:
    string;

  stage:
    string;

  activeProfilePointer:
    any;
}) {
  const normalizedStage =
    requireStage(
      stage
    );

  const deploymentTable =
    requireStorageName(
      platformDeploymentTableName,
      "Platform Deployment table name"
    );

  const releasesBucket =
    requireStorageName(
      platformReleasesBucket,
      "Platform Releases bucket"
    );

  const configurationsBucket =
    requireStorageName(
      deploymentConfigurationsBucket,
      "Deployment Configurations bucket"
    );


  /**
   * The Profile side has already been selected by the public runtime
   * request from one strongly-consistent control-plane read.
   *
   * readPublicActiveProfile() deliberately projects that validated
   * pointer into a runtime-safe identity before returning it. Do not
   * require DynamoDB storage keys here and do not independently
   * re-read Profile activation state.
   */
  validateRuntimeActiveProfileIdentity(
    activeProfilePointer
  );


  const activePlatform =
    await readActivePlatformReleasePointer({
      client:
        platformDeploymentClient,

      tableName:
        deploymentTable,
    });


  /**
   * Bootstrap/legacy state:
   *
   * Profile content may exist without a formal Platform Deployment
   * pointer, including environments originating before the formal
   * deployment control plane.
   *
   * Return no effective composition rather than inferring a Platform
   * Release from Git/profileVersion evidence.
   */
  if (
    !activePlatform
  ) {
    return null;
  }


  const releaseKey =
    createPlatformReleaseObjectKey(
      activePlatform
        .platformReleaseId
    );


  let storedRelease:
    Awaited<
      ReturnType<
        typeof readImmutableJson
      >
    >;


  try {
    storedRelease =
      await readImmutableJson({
        s3Client,

        bucket:
          releasesBucket,

        key:
          releaseKey,

        label:
          "Active Platform Release",
      });
  } catch (
    error:
      any
  ) {
    if (
      isS3NotFound(
        error
      )
    ) {
      throw new Error(
        "Active Platform Release document does not exist."
      );
    }


    throw error;
  }


  const release =
    normalizeAndValidatePlatformReleaseDocument(
      storedRelease
        .parsed
    );


  if (
    release
      .platformReleaseId !==
    activePlatform
      .platformReleaseId
  ) {
    throw new Error(
      "Active Platform Release ID does not match active pointer."
    );
  }


  if (
    release.stage !==
      normalizedStage
  ) {
    throw new Error(
      "Active Platform Release belongs to a different stage."
    );
  }


  if (
    storedRelease
      .sha256 !==
    activePlatform
      .platformReleaseSha256
  ) {
    throw new Error(
      "Active Platform Release digest does not match active pointer."
    );
  }

  /**
   * Defense-in-depth release qualification.
   *
   * Control-plane transitions already enforce this in P6D2, but the
   * public runtime must independently fail closed if historical,
   * manually-mutated or otherwise invalid active state is observed.
   *
   * Do not infer PPS from Git, legacy profileVersion or deployment
   * metadata. The immutable Platform Release must explicitly declare it.
   */
  requireDeclaredProfilePlatformSpecification(
    release
  );


  const deploymentConfigurationId =
    computeDeploymentConfigurationId({
      stage:
        normalizedStage,

      platformReleaseId:
        activePlatform
          .platformReleaseId,

      profileVariantId:
        activeProfilePointer
          .profileVariantId,
    });


  const configurationKey =
    createDeploymentConfigurationObjectKey(
      deploymentConfigurationId
    );


  let storedConfiguration:
    Awaited<
      ReturnType<
        typeof readImmutableJson
      >
    >;


  try {
    storedConfiguration =
      await readImmutableJson({
        s3Client,

        bucket:
          configurationsBucket,

        key:
          configurationKey,

        label:
          "Effective Deployment Configuration",
      });
  } catch (
    error:
      any
  ) {
    if (
      isS3NotFound(
        error
      )
    ) {
      throw new Error(
        `Effective Deployment Configuration "${deploymentConfigurationId}" does not exist.`
      );
    }


    throw error;
  }


  const configuration =
    normalizeAndValidateDeploymentConfigurationDocument(
      storedConfiguration
        .parsed
    );


  if (
    configuration
      .deploymentConfigurationId !==
    deploymentConfigurationId
  ) {
    throw new Error(
      "Effective Deployment Configuration ID does not match active composition."
    );
  }


  if (
    configuration.stage !==
      normalizedStage
  ) {
    throw new Error(
      "Effective Deployment Configuration belongs to a different stage."
    );
  }


  if (
    configuration
      .platformReleaseId !==
    activePlatform
      .platformReleaseId
  ) {
    throw new Error(
      "Effective Deployment Configuration Platform Release does not match active Platform."
    );
  }


  if (
    configuration
      .profileVariantId !==
    activeProfilePointer
      .profileVariantId
  ) {
    throw new Error(
      "Effective Deployment Configuration Profile Variant does not match active Profile."
    );
  }


  if (
    configuration
      .profile
      .contentSchemaVersion !==
    activeProfilePointer
      .contentSchemaVersion
  ) {
    throw new Error(
      "Effective Deployment Configuration content schema does not match active Profile."
    );
  }


  if (
    configuration
      .profile
      .contentHash !==
    activeProfilePointer
      .contentHash
  ) {
    throw new Error(
      "Effective Deployment Configuration contentHash does not match active Profile."
    );
  }

  /**
   * Final public-runtime compatibility boundary.
   *
   * All immutable composition integrity checks above must succeed
   * before compatibility is evaluated.
   *
   * Deployment Configuration remains compatibility-neutral; the PPS
   * result is policy over the verified immutable composition.
   */
  assertDeclaredProfilePlatformCompatible({
    platformRelease:
      release,

    deploymentConfiguration:
      configuration,
  });


  /**
   * Deliberately return runtime-safe control-plane identity only.
   *
   * Do NOT return Platform Release source/build/Git provenance here.
   */
  return {
    activePlatform: {
      revision:
        activePlatform
          .revision,

      deploymentId:
        activePlatform
          .deploymentId,

      platformReleaseId:
        activePlatform
          .platformReleaseId,

      deployedAt:
        activePlatform
          .deployedAt,
    },

    platformReleaseId:
      activePlatform
        .platformReleaseId,

    deploymentConfigurationId,

    platformReleaseSha256:
      storedRelease
        .sha256,

    configurationSha256:
      storedConfiguration
        .sha256,
  };
}