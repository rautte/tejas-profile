// src/profile/runtime/runtimeProfile.js

import {
  buildProfileContent,
} from "../content";

import {
  CURRENT_PROFILE_CONTENT_SCHEMA_VERSION,
  createProfileContent,
  validateProfileContent,
} from "../../utils/profileVariant";

import {
  getRepositoryProfileAssetUrl,
} from "./repositoryProfileAssets";


export const PROFILE_RUNTIME_SOURCE =
  Object.freeze({
    REPOSITORY:
      "repository",

    ACTIVE:
      "active",
  });


function requireObject(
  value,
  label
) {
  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(
      value
    )
  ) {
    throw new Error(
      `${label} must be an object.`
    );
  }


  return value;
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
  deployment
) {
  if (
    deployment === null ||
    deployment === undefined
  ) {
    return {
      platformReleaseId:
        null,

      deploymentConfigurationId:
        null,
    };
  }


  requireObject(
    deployment,
    "Active deployment identity"
  );


  return {
    platformReleaseId:
      requireRuntimeId(
        deployment
          .platformReleaseId,
        "platformReleaseId"
      ),

    deploymentConfigurationId:
      requireRuntimeId(
        deployment
          .deploymentConfigurationId,
        "deploymentConfigurationId"
      ),
  };
}


function normalizeActiveAssets(
  assets
) {
  if (
    !Array.isArray(
      assets
    )
  ) {
    throw new Error(
      "Active Profile assets must be an array."
    );
  }


  const urls =
    {};


  for (
    const asset of
      assets
  ) {
    requireObject(
      asset,
      "Active Profile asset"
    );


    const id =
      String(
        asset.id || ""
      ).trim();

    const url =
      String(
        asset.url || ""
      ).trim();


    if (!id) {
      throw new Error(
        "Active Profile asset ID is required."
      );
    }


    if (!url) {
      throw new Error(
        `Active Profile asset "${id}" has no runtime URL.`
      );
    }


    if (
      Object.prototype
        .hasOwnProperty
        .call(
          urls,
          id
        )
    ) {
      throw new Error(
        `Active Profile asset "${id}" is duplicated.`
      );
    }


    urls[id] =
      url;
  }


  return Object.freeze(
    urls
  );
}


export function createRepositoryRuntimeProfile() {
  return {
    source:
      PROFILE_RUNTIME_SOURCE
        .REPOSITORY,

    content:
      buildProfileContent(),

    active:
      null,

    profileVariantId:
      null,

    platformReleaseId:
      null,

    deploymentConfigurationId:
      null,

    targeting:
      null,

    assetUrls:
      Object.freeze({}),
  };
}


export function createActiveRuntimeProfile(
  response
) {
  const active =
    requireObject(
      response?.active,
      "Active Profile pointer"
    );

  const variant =
    requireObject(
      response?.variant,
      "Active Profile Variant"
    );

  const deploymentIdentity =
    normalizeDeploymentIdentity(
      response
        ?.deployment
    );

  const activeSchemaVersion =
    Number(
      active
        .contentSchemaVersion
    );

  const variantSchemaVersion =
    Number(
      variant
        .contentSchemaVersion
    );


  if (
    activeSchemaVersion !==
      CURRENT_PROFILE_CONTENT_SCHEMA_VERSION ||
    variantSchemaVersion !==
      CURRENT_PROFILE_CONTENT_SCHEMA_VERSION
  ) {
    throw new Error(
      `Active Profile schema is not compatible with current platform schema v${CURRENT_PROFILE_CONTENT_SCHEMA_VERSION}.`
    );
  }


  if (
    String(
      active
        .profileVariantId ||
      ""
    ) !==
    String(
      variant
        .profileVariantId ||
      ""
    )
  ) {
    throw new Error(
      "Active Profile Variant ID does not match active pointer."
    );
  }


  if (
    String(
      active
        .contentHash ||
      ""
    ) !==
    String(
      variant
        .contentHash ||
      ""
    )
  ) {
    throw new Error(
      "Active Profile contentHash does not match active pointer."
    );
  }


  const content =
    createProfileContent(
      variant.content
    );


  const validation =
    validateProfileContent(
      content
    );


  if (
    !validation.valid
  ) {
    throw new Error(
      [
        "Active Profile Content is invalid.",
        ...validation.errors,
      ].join(
        " "
      )
    );
  }


  return {
    source:
      PROFILE_RUNTIME_SOURCE
        .ACTIVE,

    content,

    active,

    profileVariantId:
      variant
        .profileVariantId,

    platformReleaseId:
      deploymentIdentity
        .platformReleaseId,

    deploymentConfigurationId:
      deploymentIdentity
        .deploymentConfigurationId,

    targeting:
      variant
        .targeting ||
      null,

    assetUrls:
      normalizeActiveAssets(
        variant.assets
      ),
  };
}


/**
 * Important correctness rule:
 *
 * Repository runtime:
 *   use repository-local asset mapping.
 *
 * Active historical variant:
 *   ONLY use URLs supplied by that immutable variant.
 *
 * We intentionally do not silently fall back to today's profile
 * photo/resume when an historical variant asset is missing.
 */
export function resolveRuntimeProfileAsset(
  runtimeProfile,
  assetId
) {
  const id =
    String(
      assetId || ""
    ).trim();


  if (!id) {
    return null;
  }


  if (
    runtimeProfile?.source ===
      PROFILE_RUNTIME_SOURCE
        .ACTIVE
  ) {
    return (
      runtimeProfile
        ?.assetUrls
        ?.[id] ||
      null
    );
  }


  return getRepositoryProfileAssetUrl(
    id
  );
}