// src/utils/snapshots/controlPlaneCatalogApi.js

import {
  readOwnerSessionToken,
} from "../owner/ownerSession";


const API =
  process.env
    .REACT_APP_SNAPSHOTS_API ||
  "";


function mustHaveApi() {
  if (!API) {
    throw new Error(
      "Missing REACT_APP_SNAPSHOTS_API"
    );
  }


  return API.replace(
    /\/+$/,
    ""
  );
}


function ownerHeaders() {
  const result = {
    "content-type":
      "application/json",
  };


  const token =
    readOwnerSessionToken();


  if (token) {
    result[
      "x-owner-token"
    ] =
      token;
  }


  return result;
}


function cleanString(
  value
) {
  return String(
    value ??
      ""
  ).trim();
}


function requireId(
  value,
  field
) {
  const id =
    cleanString(
      value
    );


  if (!id) {
    throw new Error(
      `${field} is required.`
    );
  }


  return id;
}


function optionalToken(
  value
) {
  const token =
    cleanString(
      value
    );


  return token ||
    undefined;
}


function optionalLimit(
  value,
  {
    max,
  }
) {
  if (
    value ===
      undefined ||
    value ===
      null ||
    value ===
      ""
  ) {
    return undefined;
  }


  const parsed =
    Number(
      value
    );


  if (
    !Number.isInteger(
      parsed
    ) ||
    parsed <
      1 ||
    parsed >
      max
  ) {
    throw new Error(
      `limit must be an integer between 1 and ${max}.`
    );
  }


  return parsed;
}


function buildQuery(
  values
) {
  const query =
    new URLSearchParams();


  for (
    const [
      key,
      value,
    ] of
      Object.entries(
        values ||
        {}
      )
  ) {
    if (
      value ===
        undefined ||
      value ===
        null ||
      value ===
        ""
    ) {
      continue;
    }


    query.set(
      key,
      String(
        value
      )
    );
  }


  return query
    .toString();
}


async function ownerGet(
  path,
  {
    query = {},
    failureLabel,
  } = {}
) {
  const base =
    mustHaveApi();


  const queryString =
    buildQuery(
      query
    );


  const url =
    queryString
      ? `${base}${path}?${queryString}`
      : `${base}${path}`;


  const response =
    await fetch(
      url,
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
    await response
      .json()
      .catch(
        () => ({})
      );


  if (
    !response.ok ||
    !json.ok
  ) {
    const error =
      new Error(
        json.error ||
          `${failureLabel || "Control-plane request"} failed (${response.status}).`
      );


    error.status =
      response.status;


    throw error;
  }


  return json;
}


// -----------------------------
// Profile Variants
// -----------------------------

export async function listProfileVariants({
  limit,
  nextToken,
} = {}) {
  return ownerGet(
    "/profile-variants/list",
    {
      query: {
        limit:
          optionalLimit(
            limit,
            {
              max:
                50,
            }
          ),

        nextToken:
          optionalToken(
            nextToken
          ),
      },

      failureLabel:
        "Profile Variant catalog read",
    }
  );
}


export async function getProfileVariant(
  profileVariantId
) {
  const id =
    requireId(
      profileVariantId,
      "profileVariantId"
    );


  const result =
    await ownerGet(
      "/profile-variants/get",
      {
        query: {
          profileVariantId:
            id,
        },

        failureLabel:
          "Profile Variant read",
      }
    );


  if (
    cleanString(
      result
        ?.variant
        ?.profileVariantId
    ) !==
      id
  ) {
    throw new Error(
      "Profile Variant response identity does not match the requested ID."
    );
  }


  return result;
}


// -----------------------------
// Profile Activation history
// -----------------------------

export async function listProfileActivations({
  profileVariantId,
  limit,
  nextToken,
} = {}) {
  const id =
    cleanString(
      profileVariantId
    );


  return ownerGet(
    "/profile-activations/list",
    {
      query: {
        profileVariantId:
          id ||
          undefined,

        limit:
          optionalLimit(
            limit,
            {
              max:
                100,
            }
          ),

        nextToken:
          optionalToken(
            nextToken
          ),
      },

      failureLabel:
        "Profile Activation history read",
    }
  );
}


// -----------------------------
// Platform Releases
// -----------------------------

export async function listPlatformReleases({
  limit,
  nextToken,
} = {}) {
  return ownerGet(
    "/platform-releases/list",
    {
      query: {
        limit:
          optionalLimit(
            limit,
            {
              max:
                50,
            }
          ),

        nextToken:
          optionalToken(
            nextToken
          ),
      },

      failureLabel:
        "Platform Release catalog read",
    }
  );
}


export async function getPlatformRelease(
  platformReleaseId
) {
  const id =
    requireId(
      platformReleaseId,
      "platformReleaseId"
    );


  const result =
    await ownerGet(
      "/platform-releases/get",
      {
        query: {
          platformReleaseId:
            id,
        },

        failureLabel:
          "Platform Release read",
      }
    );


  if (
    cleanString(
      result
        ?.release
        ?.platformReleaseId
    ) !==
      id
  ) {
    throw new Error(
      "Platform Release response identity does not match the requested ID."
    );
  }


  return result;
}


// -----------------------------
// Platform Deployment history
// -----------------------------

export async function listPlatformDeployments({
  platformReleaseId,
  limit,
  nextToken,
} = {}) {
  const id =
    cleanString(
      platformReleaseId
    );


  return ownerGet(
    "/platform-deployments/list",
    {
      query: {
        platformReleaseId:
          id ||
          undefined,

        limit:
          optionalLimit(
            limit,
            {
              max:
                100,
            }
          ),

        nextToken:
          optionalToken(
            nextToken
          ),
      },

      failureLabel:
        "Platform Deployment history read",
    }
  );
}


// -----------------------------
// Deployment Configurations
// -----------------------------

export async function listDeploymentConfigurations({
  profileVariantId,
  platformReleaseId,
  limit,
  nextToken,
} = {}) {
  const profileId =
    cleanString(
      profileVariantId
    );

  const releaseId =
    cleanString(
      platformReleaseId
    );


  /**
   * Backend contract requires exactly one reverse-lookup selector.
   *
   * Keep that invariant at the frontend transport boundary too.
   */
  if (
    Boolean(
      profileId
    ) ===
    Boolean(
      releaseId
    )
  ) {
    throw new Error(
      "Exactly one of profileVariantId or platformReleaseId is required."
    );
  }


  return ownerGet(
    "/deployment-configurations/list",
    {
      query: {
        profileVariantId:
          profileId ||
          undefined,

        platformReleaseId:
          releaseId ||
          undefined,

        limit:
          optionalLimit(
            limit,
            {
              max:
                100,
            }
          ),

        nextToken:
          optionalToken(
            nextToken
          ),
      },

      failureLabel:
        "Deployment Configuration catalog read",
    }
  );
}


export async function getDeploymentConfiguration(
  deploymentConfigurationId
) {
  const id =
    requireId(
      deploymentConfigurationId,
      "deploymentConfigurationId"
    );


  const result =
    await ownerGet(
      "/deployment-configurations/get",
      {
        query: {
          deploymentConfigurationId:
            id,
        },

        failureLabel:
          "Deployment Configuration read",
      }
    );


  if (
    cleanString(
      result
        ?.configuration
        ?.deploymentConfigurationId
    ) !==
      id
  ) {
    throw new Error(
      "Deployment Configuration response identity does not match the requested ID."
    );
  }


  return result;
}