// src/utils/analytics/runtimeIdentity.js

const PROFILE_VARIANT_ID_RE =
  /^[A-Za-z0-9._:-]+$/;

const MAX_ID_LENGTH =
  160;

const MAX_TARGETING_LENGTH =
  240;


function cleanOptionalString(
  value,
  maxLength
) {
  if (
    typeof value !==
      "string"
  ) {
    return null;
  }


  const normalized =
    value.trim();


  if (!normalized) {
    return null;
  }


  return normalized.slice(
    0,
    maxLength
  );
}


function normalizeProfileVariantId(
  value
) {
  const normalized =
    cleanOptionalString(
      value,
      MAX_ID_LENGTH
    );


  if (
    !normalized ||
    !PROFILE_VARIANT_ID_RE.test(
      normalized
    )
  ) {
    return null;
  }


  return normalized;
}


function normalizeContentSchemaVersion(
  value
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }


  const normalized =
    Number(value);


  return (
    Number.isInteger(
      normalized
    ) &&
    normalized > 0
  )
    ? normalized
    : null;
}


function createAnalyticsRuntimeIdentity({
  profileVariantId =
    null,

  contentSchemaVersion =
    null,

  targeting =
    null,

  platformReleaseId =
    null,

  deploymentConfigurationId =
    null,
} = {}) {
  const normalizedTargeting =
    Object.freeze({
      location:
        cleanOptionalString(
          targeting
            ?.location,
          MAX_TARGETING_LENGTH
        ),

      jobRole:
        cleanOptionalString(
          targeting
            ?.jobRole,
          MAX_TARGETING_LENGTH
        ),
    });


  return Object.freeze({
    profileVariantId:
      normalizeProfileVariantId(
        profileVariantId
      ),

    contentSchemaVersion:
      normalizeContentSchemaVersion(
        contentSchemaVersion
      ),

    targeting:
      normalizedTargeting,

    /**
     * P4 may transport these explicit identities,
     * but it MUST NOT derive them from gitSha or the
     * legacy profileVersionId.
     *
     * P5 will define their formal domain contracts.
     */
    platformReleaseId:
      cleanOptionalString(
        platformReleaseId,
        MAX_ID_LENGTH
      ),

    deploymentConfigurationId:
      cleanOptionalString(
        deploymentConfigurationId,
        MAX_ID_LENGTH
      ),
  });
}


let currentIdentity =
  createAnalyticsRuntimeIdentity();


export function setAnalyticsRuntimeIdentity(
  identity = {}
) {
  /**
   * Replacement semantics are intentional.
   *
   * If runtime moves from an ACTIVE Profile Variant
   * back to repository fallback, stale Variant or
   * targeting identity must disappear rather than
   * being merged forward.
   */
  currentIdentity =
    createAnalyticsRuntimeIdentity(
      identity
    );


  return currentIdentity;
}


export function readAnalyticsRuntimeIdentity() {
  return currentIdentity;
}


export function clearAnalyticsRuntimeIdentity() {
  currentIdentity =
    createAnalyticsRuntimeIdentity();


  return currentIdentity;
}