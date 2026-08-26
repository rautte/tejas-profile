// src/profile/runtime/activeProfileApi.js

function cleanUrl(
  value
) {
  return String(
    value || ""
  )
    .trim()
    .replace(
      /\/+$/,
      ""
    );
}


/**
 * Preferred contract:
 *
 * REACT_APP_ACTIVE_PROFILE_API
 *   = full public endpoint
 *   = https://.../profile/active
 *
 * Transitional fallback:
 *
 * REACT_APP_SNAPSHOTS_API
 *   = shared HTTP API base
 *
 * This lets the current deployment continue working while
 * P3.4F later wires the dedicated CloudFormation output.
 */
export function resolveActiveProfileApiUrl(
  env =
    process.env
) {
  const explicit =
    cleanUrl(
      env
        ?.REACT_APP_ACTIVE_PROFILE_API
    );


  if (explicit) {
    return explicit;
  }


  const apiBase =
    cleanUrl(
      env
        ?.REACT_APP_SNAPSHOTS_API
    );


  return apiBase
    ? `${apiBase}/profile/active`
    : "";
}


function getDefaultFetch() {
  if (
    typeof window ===
      "undefined" ||
    typeof window.fetch !==
      "function"
  ) {
    return undefined;
  }


  return window.fetch.bind(
    window
  );
}


async function readJson(
  response
) {
  const text =
    await response
      .text()
      .catch(
        () => ""
      );


  if (!text) {
    return {};
  }


  try {
    return JSON.parse(
      text
    );
  } catch {
    throw new Error(
      "Active Profile API returned invalid JSON."
    );
  }
}

const RUNTIME_ID_RE =
  /^[A-Za-z0-9._:-]+$/;

const MAX_RUNTIME_ID_LENGTH =
  160;


function requireRuntimeId(
  value,
  label
) {
  const normalized =
    String(
      value ?? ""
    ).trim();


  if (
    !normalized ||
    normalized.length >
      MAX_RUNTIME_ID_LENGTH ||
    !RUNTIME_ID_RE.test(
      normalized
    )
  ) {
    throw new Error(
      `${label} is invalid.`
    );
  }


  return normalized;
}


function normalizeDeploymentIdentity(
  value
) {
  /**
   * Valid bootstrap/legacy state when no formal
   * Platform Deployment pointer exists yet.
   *
   * Never infer Platform identity from Git SHA or
   * legacy profileVersion metadata.
   */
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }


  if (
    typeof value !==
      "object" ||
    Array.isArray(
      value
    )
  ) {
    throw new Error(
      "Active Profile API deployment identity must be an object or null."
    );
  }


  const platformReleaseId =
    requireRuntimeId(
      value
        .platformReleaseId,
      "platformReleaseId"
    );

  const deploymentConfigurationId =
    requireRuntimeId(
      value
        .deploymentConfigurationId,
      "deploymentConfigurationId"
    );


  return {
    platformReleaseId,

    deploymentConfigurationId,
  };
}


/**
 * Public runtime request.
 *
 * Important:
 * - NO owner token
 * - NO owner session dependency
 * - NO arbitrary profileVariantId
 */
export async function fetchActiveProfile({
  fetchImpl =
    getDefaultFetch(),

  apiUrl =
    resolveActiveProfileApiUrl(),

  signal,
} = {}) {
  const url =
    cleanUrl(
      apiUrl
    );


  if (!url) {
    return {
      configured:
        false,

      active:
        null,

      variant:
        null,

      deployment:
        null,
    };
  }


  if (
    typeof fetchImpl !==
      "function"
  ) {
    throw new Error(
      "Active Profile fetch implementation is unavailable."
    );
  }


  const response =
    await fetchImpl(
      url,
      {
        method:
          "GET",

        headers: {
          accept:
            "application/json",
        },

        cache:
          "no-store",

        signal,
      }
    );


  const body =
    await readJson(
      response
    );


  if (
    !response.ok ||
    body?.ok !==
      true
  ) {
    throw new Error(
      body?.error ||
        `Active Profile request failed (${response.status}).`
    );
  }


  const active =
    body
      ?.active ??
    null;

  const variant =
    body
      ?.variant ??
    null;

  const deployment =
    normalizeDeploymentIdentity(
      body
        ?.deployment
    );


  if (
    active === null &&
    variant === null
  ) {
    if (
      deployment !==
        null
    ) {
      throw new Error(
        "Active Profile API returned deployment identity without an active Profile."
      );
    }


    return {
      configured:
        true,

      active:
        null,

      variant:
        null,

      deployment:
        null,
    };
  }


  if (
    !active ||
    !variant ||
    typeof active !==
      "object" ||
    typeof variant !==
      "object"
  ) {
    throw new Error(
      "Active Profile API returned inconsistent active state."
    );
  }


  return {
    configured:
      true,

    active,

    variant,

    deployment,

    manifestSha256:
      body
        ?.manifestSha256 ||
      null,
  };
}