// scripts/lib/profile-owner-publication-api.cjs

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


function failureMessage(
  json,
  fallback
) {
  return (
    cleanString(
      json
        ?.error
    ) ||
    fallback
  );
}


/**
 * Node owner API adapter used by the formal Profile publication
 * transport.
 *
 * This adapter intentionally exposes ONLY the API surface needed to
 * publish/read immutable Profile Variants.
 *
 * It has no Profile activation method.
 */
function createProfileOwnerPublicationApi({
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
    async presignProfileVariantAssetPut({
      sha256,
      contentType,
    }) {
      const response =
        await fetchImpl(
          `${base}/profile-variants/assets/presign-put`,
          {
            method:
              "POST",

            headers:
              ownerHeaders(),

            body:
              JSON.stringify({
                sha256,
                contentType,
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
        !response.ok ||
        !json.ok
      ) {
        throw new Error(
          failureMessage(
            json,
            `Profile Variant asset presign failed (${response.status})`
          )
        );
      }


      return json;
    },


    async uploadProfileVariantAssetToS3({
      url,
      body,
      requiredHeaders,
    }) {
      const uploadUrl =
        requireValue(
          url,
          "Profile Variant asset upload URL"
        );


      if (
        body ===
          null ||
        body ===
          undefined
      ) {
        throw new Error(
          "Profile Variant asset upload body is required."
        );
      }


      const response =
        await fetchImpl(
          uploadUrl,
          {
            method:
              "PUT",

            headers: {
              ...(
                requiredHeaders &&
                typeof requiredHeaders ===
                  "object"
                  ? requiredHeaders
                  : {}
              ),
            },

            body,
          }
        );


      if (
        !response.ok
      ) {
        const detail =
          await response
            .text()
            .catch(
              () => ""
            );


        throw new Error(
          (
            `Profile Variant asset upload failed (${response.status}) ` +
            detail
          ).trim()
        );
      }


      return true;
    },


    async publishProfileVariant(
      variant
    ) {
      const response =
        await fetchImpl(
          `${base}/profile-variants/publish`,
          {
            method:
              "POST",

            headers:
              ownerHeaders(),

            body:
              JSON.stringify({
                variant,
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
        !response.ok ||
        !json.ok
      ) {
        throw new Error(
          failureMessage(
            json,
            `Profile Variant publication failed (${response.status})`
          )
        );
      }


      return json;
    },


    async getProfileVariant(
      profileVariantId
    ) {
      const id =
        requireValue(
          profileVariantId,
          "profileVariantId"
        );


      const query =
        new URLSearchParams({
          profileVariantId:
            id,
        });


      const response =
        await fetchImpl(
          (
            `${base}/profile-variants/get?` +
            query.toString()
          ),
          {
            method:
              "GET",

            headers:
              ownerHeaders(),

            cache:
              "no-store",
          }
        );


      const json =
        await readJson(
          response
        );


      if (
        !response.ok ||
        !json.ok
      ) {
        throw new Error(
          failureMessage(
            json,
            `Profile Variant read failed (${response.status})`
          )
        );
      }


      return json;
    },
  };
}


module.exports = {
  createProfileOwnerPublicationApi,
};
