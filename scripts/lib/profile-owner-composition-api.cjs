// scripts/lib/profile-owner-composition-api.cjs

function cleanString(
  value
) {
  return String(
    value ||
    ""
  ).trim();
}


function requireValue(
  value,
  name
) {
  const normalized =
    cleanString(
      value
    );

  if (!normalized) {
    throw new Error(
      `${name} is required.`
    );
  }

  return normalized;
}


function requireExpectedRevision(
  value
) {
  if (
    typeof value ===
      "number"
  ) {
    if (
      !Number.isSafeInteger(
        value
      ) ||
      value < 0
    ) {
      throw new Error(
        "expectedRevision must be a non-negative integer."
      );
    }

    return value;
  }


  const normalized =
    requireValue(
      value,
      "PROFILE_EXPECTED_REVISION"
    );


  if (
    !/^(0|[1-9]\d*)$/
      .test(
        normalized
      )
  ) {
    throw new Error(
      "PROFILE_EXPECTED_REVISION must be a non-negative integer."
    );
  }


  const parsed =
    Number(
      normalized
    );


  if (
    !Number.isSafeInteger(
      parsed
    )
  ) {
    throw new Error(
      "PROFILE_EXPECTED_REVISION must be a safe non-negative integer."
    );
  }


  return parsed;
}


function normalizeBaseUrl(
  value
) {
  return requireValue(
    value,
    "Snapshots API URL"
  ).replace(
    /\/+$/,
    ""
  );
}


async function readJson(
  response
) {
  return response
    .json()
    .catch(
      () => ({})
    );
}


function createApiError({
  response,
  json,
  fallback,
}) {
  const message =
    cleanString(
      json
        ?.error
    ) ||
    fallback;


  const error =
    new Error(
      message
    );


  error.status =
    response
      ?.status;


  const code =
    cleanString(
      json
        ?.code
    );


  if (code) {
    error.code =
      code;
  }


  return error;
}


/**
 * Node owner API adapter for formal Profile composition transitions.
 *
 * This surface intentionally owns only:
 *
 * - Deployment Configuration creation
 * - Profile activation
 *
 * It has no Profile Variant publication methods.
 */
function createProfileOwnerCompositionApi({
  snapshotsApiUrl,
  ownerToken,
  fetchImpl =
    globalThis.fetch,
} = {}) {
  const base =
    normalizeBaseUrl(
      snapshotsApiUrl
    );

  const token =
    requireValue(
      ownerToken,
      "Owner token"
    );


  if (
    typeof fetchImpl !==
    "function"
  ) {
    throw new Error(
      "A fetch implementation is required."
    );
  }


  function ownerHeaders() {
    return {
      "content-type":
        "application/json",

      "x-owner-token":
        token,
    };
  }


  return {
    async createDeploymentConfiguration({
      platformReleaseId,
      profileVariantId,
    } = {}) {
      const releaseId =
        requireValue(
          platformReleaseId,
          "platformReleaseId"
        );

      const variantId =
        requireValue(
          profileVariantId,
          "profileVariantId"
        );


      const response =
        await fetchImpl(
          `${base}/deployment-configurations/create`,
          {
            method:
              "POST",

            headers:
              ownerHeaders(),

            body:
              JSON.stringify({
                platformReleaseId:
                  releaseId,

                profileVariantId:
                  variantId,
              }),

            cache:
              "no-store",
          }
        );


      const json =
        await readJson(
          response
        );


      if (
        (
          response.status !==
            200 &&
          response.status !==
            201
        ) ||
        !response.ok ||
        !json.ok
      ) {
        throw createApiError({
          response,
          json,

          fallback:
            `Deployment Configuration creation failed (${response.status}).`,
        });
      }


      const configurationId =
        cleanString(
          json
            ?.deploymentConfigurationId
        );


      if (!configurationId) {
        throw new Error(
          "Deployment Configuration response is missing deploymentConfigurationId."
        );
      }


      if (
        json
          ?.configuration
          ?.platformReleaseId !==
        releaseId
      ) {
        throw new Error(
          "Deployment Configuration Platform Release mismatch."
        );
      }


      if (
        json
          ?.configuration
          ?.profileVariantId !==
        variantId
      ) {
        throw new Error(
          "Deployment Configuration Profile Variant mismatch."
        );
      }


      return json;
    },


    async activateProfileVariant({
      profileVariantId,
      expectedRevision,
    } = {}) {
      const variantId =
        requireValue(
          profileVariantId,
          "profileVariantId"
        );

      const revision =
        requireExpectedRevision(
          expectedRevision
        );


      const response =
        await fetchImpl(
          `${base}/profile-variants/activate`,
          {
            method:
              "POST",

            headers:
              ownerHeaders(),

            body:
              JSON.stringify({
                profileVariantId:
                  variantId,

                expectedRevision:
                  revision,
              }),

            cache:
              "no-store",
          }
        );


      const json =
        await readJson(
          response
        );


      if (
        response.status ===
          409
      ) {
        const error =
          createApiError({
            response,
            json,

            fallback:
              "Profile activation conflict.",
          });


        error.code =
          cleanString(
            error.code
          ) ||
          "PROFILE_ACTIVATION_CONFLICT";


        throw error;
      }


      if (
        !response.ok ||
        !json.ok
      ) {
        throw createApiError({
          response,
          json,

          fallback:
            `Profile activation failed (${response.status}).`,
        });
      }


      if (
        json
          ?.active
          ?.profileVariantId !==
        variantId
      ) {
        throw new Error(
          "Profile activation response Profile Variant mismatch."
        );
      }


      const activeRevision =
        Number(
          json
            ?.active
            ?.revision
        );


      if (
        !Number.isSafeInteger(
          activeRevision
        ) ||
        activeRevision < 1
      ) {
        throw new Error(
          "Profile activation response is missing a valid active revision."
        );
      }


      return json;
    },
  };
}


module.exports = {
  createProfileOwnerCompositionApi,
  requireExpectedRevision,
};