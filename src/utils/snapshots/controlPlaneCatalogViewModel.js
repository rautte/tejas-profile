// src/utils/snapshots/controlPlaneCatalogViewModel.js


function cleanString(
  value
) {
  return String(
    value ??
      ""
  ).trim();
}


function asArray(
  value
) {
  return Array.isArray(
    value
  )
    ? value
    : [];
}


function indexById(
  items,
  idField
) {
  const index =
    new Map();


  for (
    const item of
      asArray(
        items
      )
  ) {
    const id =
      cleanString(
        item
          ?.[
            idField
          ]
      );


    if (!id) {
      continue;
    }


    index.set(
      id,
      item
    );
  }


  return index;
}


function uniqueStrings(
  values
) {
  return Array.from(
    new Set(
      values
        .map(
          cleanString
        )
        .filter(
          Boolean
        )
    )
  );
}


// -----------------------------
// Top-level catalog rows
// -----------------------------

export function buildProfileVariantCatalogRows({
  variants = [],
  activeProfileVariantId =
    "",
} = {}) {
  const activeId =
    cleanString(
      activeProfileVariantId
    );


  return asArray(
    variants
  )
    .filter(
      (
        variant
      ) =>
        Boolean(
          cleanString(
            variant
              ?.profileVariantId
          )
        )
    )
    .map(
      (
        variant
      ) => {
        const profileVariantId =
          cleanString(
            variant
              .profileVariantId
          );


        return {
          ...variant,

          profileVariantId,

          isActive:
            Boolean(
              activeId &&
              profileVariantId ===
                activeId
            ),
        };
      }
    );
}


export function buildPlatformReleaseCatalogRows({
  releases = [],
  activePlatformReleaseId =
    "",
} = {}) {
  const activeId =
    cleanString(
      activePlatformReleaseId
    );


  return asArray(
    releases
  )
    .filter(
      (
        release
      ) =>
        Boolean(
          cleanString(
            release
              ?.platformReleaseId
          )
        )
    )
    .map(
      (
        release
      ) => {
        const platformReleaseId =
          cleanString(
            release
              .platformReleaseId
          );


        /**
         * Historical v1 releases remain intentionally unqualified.
         *
         * Never infer PPS1 from schema, Git SHA, deployment history,
         * or any other legacy evidence.
         */
        const ppsVersion =
          Number.isInteger(
            release
              ?.ppsVersion
          )
            ? release
                .ppsVersion
            : Number.isInteger(
                release
                  ?.profileRuntime
                  ?.ppsVersion
              )
            ? release
                .profileRuntime
                .ppsVersion
            : null;


        return {
          ...release,

          platformReleaseId,

          ppsVersion,

          isActive:
            Boolean(
              activeId &&
              platformReleaseId ===
                activeId
            ),
        };
      }
    );
}


// -----------------------------
// Profile Variant detail/history
// -----------------------------

export function buildProfileVariantHistoryModel({
  variant,

  activeProfileVariantId =
    "",

  activations = [],

  configurations = [],

  platformReleases = [],
} = {}) {
  const profileVariantId =
    cleanString(
      variant
        ?.profileVariantId
    );


  if (
    !profileVariantId
  ) {
    throw new Error(
      "Profile Variant history model requires profileVariantId."
    );
  }


  const platformById =
    indexById(
      platformReleases,
      "platformReleaseId"
    );


  const relatedActivations =
    asArray(
      activations
    ).filter(
      (
        activation
      ) =>
        cleanString(
          activation
            ?.profileVariantId
        ) ===
          profileVariantId
    );


  const relatedConfigurations =
    asArray(
      configurations
    )
      .filter(
        (
          configuration
        ) =>
          cleanString(
            configuration
              ?.profileVariantId
          ) ===
            profileVariantId
      )
      .map(
        (
          configuration
        ) => {
          const platformReleaseId =
            cleanString(
              configuration
                ?.platformReleaseId
            );


          return {
            ...configuration,

            platformRelease:
              platformById.get(
                platformReleaseId
              ) ||
              null,
          };
        }
      );


  const missingPlatformReleaseIds =
    uniqueStrings(
      relatedConfigurations
        .filter(
          (
            configuration
          ) =>
            configuration
              .platformRelease ===
            null
        )
        .map(
          (
            configuration
          ) =>
            configuration
              .platformReleaseId
        )
    );


  return {
    variant,

    profileVariantId,

    isActive:
      profileVariantId ===
      cleanString(
        activeProfileVariantId
      ),

    activations:
      relatedActivations,

    configurations:
      relatedConfigurations,

    missingPlatformReleaseIds,
  };
}


// -----------------------------
// Platform Release detail/history
// -----------------------------

export function buildPlatformReleaseHistoryModel({
  release,

  activePlatformReleaseId =
    "",

  deployments = [],

  configurations = [],

  profileVariants = [],
} = {}) {
  const platformReleaseId =
    cleanString(
      release
        ?.platformReleaseId
    );


  if (
    !platformReleaseId
  ) {
    throw new Error(
      "Platform Release history model requires platformReleaseId."
    );
  }


  const profileById =
    indexById(
      profileVariants,
      "profileVariantId"
    );


  const relatedDeployments =
    asArray(
      deployments
    ).filter(
      (
        deployment
      ) =>
        cleanString(
          deployment
            ?.platformReleaseId
        ) ===
          platformReleaseId
    );


  const relatedConfigurations =
    asArray(
      configurations
    )
      .filter(
        (
          configuration
        ) =>
          cleanString(
            configuration
              ?.platformReleaseId
          ) ===
            platformReleaseId
      )
      .map(
        (
          configuration
        ) => {
          const profileVariantId =
            cleanString(
              configuration
                ?.profileVariantId
            );


          return {
            ...configuration,

            profileVariant:
              profileById.get(
                profileVariantId
              ) ||
              null,
          };
        }
      );


  const missingProfileVariantIds =
    uniqueStrings(
      relatedConfigurations
        .filter(
          (
            configuration
          ) =>
            configuration
              .profileVariant ===
            null
        )
        .map(
          (
            configuration
          ) =>
            configuration
              .profileVariantId
        )
    );


  const ppsVersion =
    Number.isInteger(
      release
        ?.ppsVersion
    )
      ? release
          .ppsVersion
      : Number.isInteger(
          release
            ?.profileRuntime
            ?.ppsVersion
        )
      ? release
          .profileRuntime
          .ppsVersion
      : null;


  return {
    release,

    platformReleaseId,

    ppsVersion,

    isActive:
      platformReleaseId ===
      cleanString(
        activePlatformReleaseId
      ),

    deployments:
      relatedDeployments,

    configurations:
      relatedConfigurations,

    missingProfileVariantIds,
  };
}