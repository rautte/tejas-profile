// scripts/formal-profile-control.cjs

const fs =
  require(
    "node:fs"
  );

const path =
  require(
    "node:path"
  );

const {
  webcrypto,
} =
  require(
    "node:crypto"
  );

const {
  TextEncoder,
} =
  require(
    "node:util"
  );

const {
  loadProfileDomain,
} =
  require(
    "./lib/profile-domain-runtime.cjs"
  );

const {
  createProfileOwnerPublicationApi,
} =
  require(
    "./lib/profile-owner-publication-api.cjs"
  );


const SHA40_RE =
  /^[a-f0-9]{40}$/i;


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


function requireGitSha(
  value
) {
  const gitSha =
    requireValue(
      value,
      "GIT_SHA"
    );


  if (
    !SHA40_RE.test(
      gitSha
    )
  ) {
    throw new Error(
      "GIT_SHA must be an exact 40-character hexadecimal commit SHA."
    );
  }


  return gitSha
    .toLowerCase();
}


function requireTimestamp(
  value,
  name
) {
  const timestamp =
    requireValue(
      value,
      name
    );


  if (
    Number.isNaN(
      Date.parse(
        timestamp
      )
    )
  ) {
    throw new Error(
      `${name} must be a valid timestamp.`
    );
  }


  return timestamp;
}


function defaultDraftId(
  profileVariantId
) {
  return (
    `draft_${profileVariantId}`
  );
}


function createRepoAssetReader(
  root
) {
  const resolvedRoot =
    path.resolve(
      root
    );


  return async function readRepoAssetBytes(
    definition
  ) {
    const sourcePath =
      requireValue(
        definition
          ?.sourcePath,
        "Profile asset sourcePath"
      );


    const absolutePath =
      path.resolve(
        resolvedRoot,
        sourcePath
      );


    const relative =
      path.relative(
        resolvedRoot,
        absolutePath
      );


    if (
      relative.startsWith(
        ".."
      ) ||
      path.isAbsolute(
        relative
      )
    ) {
      throw new Error(
        `Profile asset escapes repository root: ${sourcePath}`
      );
    }


    return fs.promises
      .readFile(
        absolutePath
      );
  };
}


const HASH_OPTIONS = {
  subtle:
    webcrypto.subtle,

  TextEncoderImpl:
    TextEncoder,
};


/**
 * Builds the immutable publication package for current repository
 * Profile content.
 *
 * This function performs zero network/AWS mutation.
 */
async function buildFormalProfilePublication({
  root =
    process.cwd(),

  profileVariantId,

  targetingLocation,

  targetingJobRole,

  gitSha,

  checkpointTag,

  createdAt,

  draftId,
} = {}) {
  const id =
    requireValue(
      profileVariantId,
      "PROFILE_VARIANT_ID"
    );

  const location =
    requireValue(
      targetingLocation,
      "PROFILE_TARGETING_LOCATION"
    );

  const jobRole =
    requireValue(
      targetingJobRole,
      "PROFILE_TARGETING_JOB_ROLE"
    );

  const exactGitSha =
    requireGitSha(
      gitSha
    );

  const exactCheckpointTag =
    requireValue(
      checkpointTag,
      "CHECKPOINT_TAG"
    );

  const exactCreatedAt =
    requireTimestamp(
      createdAt,
      "PROFILE_VARIANT_CREATED_AT"
    );


  const {
    buildProfileContent,
    createProfileDraft,
    buildProfilePublicationPackage,
    publishProfilePublication,
  } =
    loadProfileDomain({
      root,
    });


  const content =
    buildProfileContent();


  const draft =
    createProfileDraft({
      draftId:
        cleanString(
          draftId
        ) ||
        defaultDraftId(
          id
        ),

      targeting: {
        location,
        jobRole,
      },

      content,

      createdAt:
        exactCreatedAt,
    });


  const readAssetBytes =
    createRepoAssetReader(
      root
    );


  const publication =
    await buildProfilePublicationPackage({
      draft,

      profileVariantId:
        id,

      provenance: {
        gitSha:
          exactGitSha,

        checkpointTag:
          exactCheckpointTag,
      },

      createdAt:
        exactCreatedAt,

      readAssetBytes,

      hashOptions:
        HASH_OPTIONS,
    });


  return {
    publication,
    readAssetBytes,
    publishProfilePublication,
    hashOptions:
      HASH_OPTIONS,
  };
}


/**
 * Publishes an already-built immutable Profile package.
 *
 * Publication is explicitly separate from Profile activation.
 */
async function publishFormalProfilePublication({
  build,
  api,
} = {}) {
  if (
    !build ||
    typeof build !==
      "object"
  ) {
    throw new Error(
      "A formal Profile publication build is required."
    );
  }


  return build
    .publishProfilePublication({
      publication:
        build.publication,

      readAssetBytes:
        build.readAssetBytes,

      api,

      hashOptions:
        build.hashOptions,
    });
}


function publicationSummary(
  publication
) {
  return {
    schema:
      publication
        .schema,

    packageVersion:
      publication
        .packageVersion,

    profileVariantId:
      publication
        .profileVariantId,

    contentHash:
      publication
        .contentHash,

    manifestObjectKey:
      publication
        .manifestUpload
        .objectKey,

    manifestSha256:
      publication
        .manifestUpload
        .sha256,

    targeting:
      publication
        .variant
        .targeting,

    contentSchemaVersion:
      publication
        .variant
        .contentSchemaVersion,

    assetCount:
      publication
        .assetUploads
        .length,

    assets:
      publication
        .assetUploads
        .map(
          (
            asset
          ) => ({
            id:
              asset.id,

            kind:
              asset.kind,

            sourcePath:
              asset.sourcePath,

            objectKey:
              asset.objectKey,

            sha256:
              asset.sha256,

            contentType:
              asset.contentType,
          })
        ),
  };
}


async function buildFromEnvironment() {
  return buildFormalProfilePublication({
    root:
      process.cwd(),

    profileVariantId:
      process.env
        .PROFILE_VARIANT_ID,

    targetingLocation:
      process.env
        .PROFILE_TARGETING_LOCATION,

    targetingJobRole:
      process.env
        .PROFILE_TARGETING_JOB_ROLE,

    gitSha:
      process.env
        .GIT_SHA,

    checkpointTag:
      process.env
        .CHECKPOINT_TAG,

    createdAt:
      process.env
        .PROFILE_VARIANT_CREATED_AT,

    draftId:
      process.env
        .PROFILE_DRAFT_ID,
  });
}


async function main() {
  const command =
    cleanString(
      process.argv[2]
    );


  if (
    command !==
      "build" &&
    command !==
      "publish"
  ) {
    throw new Error(
      "Usage: node scripts/formal-profile-control.cjs <build|publish>"
    );
  }


  const build =
    await buildFromEnvironment();


  console.log(
    JSON.stringify(
      publicationSummary(
        build.publication
      ),
      null,
      2
    )
  );


  if (
    command ===
      "build"
  ) {
    console.log(
      "Formal Profile publication package built. No publication or activation performed."
    );

    return;
  }


  const api =
    createProfileOwnerPublicationApi({
      snapshotsApiUrl:
        process.env
          .SNAPSHOTS_API_URL,

      ownerToken:
        process.env
          .OWNER_TOKEN,
    });


  const result =
    await publishFormalProfilePublication({
      build,
      api,
    });


  console.log(
    JSON.stringify(
      {
        ok:
          result
            .ok,

        profileVariantId:
          result
            .profileVariantId,

        contentHash:
          result
            .contentHash,

        manifestSha256:
          result
            .manifestSha256,

        manifestObjectKey:
          result
            .manifestObjectKey,

        uploadedAssets:
          result
            .uploadedAssets,
      },
      null,
      2
    )
  );


  console.log(
    "Formal Profile Variant publication complete. No Profile activation performed."
  );
}


if (
  require.main ===
    module
) {
  main()
    .catch(
      (
        error
      ) => {
        console.error(
          error
            ?.stack ||
          error
        );

        process.exit(
          1
        );
      }
    );
}


module.exports = {
  buildFormalProfilePublication,
  buildFromEnvironment,
  createRepoAssetReader,
  publicationSummary,
  publishFormalProfilePublication,
};
