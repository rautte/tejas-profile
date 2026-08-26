// infra/cdk/lambda/platform-release-contract.ts


export const PLATFORM_RELEASE_DOCUMENT_SCHEMA =
  "tejas-profile.platform-release";

export const PLATFORM_RELEASE_SCHEMA_ID_V1 =
  "tejas-profile.platform-release.v1";

export const PLATFORM_RELEASE_SCHEMA_ID_V2 =
  "tejas-profile.platform-release.v2";


const ID_RE =
  /^[A-Za-z0-9._:-]+$/;

const SHA256_RE =
  /^[a-f0-9]{64}$/;

const GIT_SHA_RE =
  /^[a-f0-9]{40}$/;


type PlainObject =
  Record<
    string,
    any
  >;


function cleanString(
  value: unknown
) {
  return String(
    value ?? ""
  ).trim();
}


function isPlainObject(
  value: unknown
): value is PlainObject {
  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(
      value
    )
  ) {
    return false;
  }


  const proto =
    Object.getPrototypeOf(
      value
    );


  return (
    proto ===
      Object.prototype ||
    proto === null
  );
}


function assertAllowedKeys(
  value: PlainObject,
  allowed:
    Set<string>,
  field:
    string
) {
  for (
    const key of
      Object.keys(
        value
      )
  ) {
    if (
      !allowed.has(
        key
      )
    ) {
      throw new Error(
        `${field}.${key} is not supported.`
      );
    }
  }
}


function requireString(
  value: unknown,
  field: string,
  maxLength = 240
) {
  const normalized =
    cleanString(
      value
    );


  if (!normalized) {
    throw new Error(
      `${field} is required.`
    );
  }


  if (
    normalized.length >
      maxLength
  ) {
    throw new Error(
      `${field} exceeds ${maxLength} characters.`
    );
  }


  return normalized;
}


function optionalString(
  value: unknown,
  field: string,
  maxLength = 240
) {
  const normalized =
    cleanString(
      value
    );


  if (!normalized) {
    return null;
  }


  if (
    normalized.length >
      maxLength
  ) {
    throw new Error(
      `${field} exceeds ${maxLength} characters.`
    );
  }


  return normalized;
}


function requireId(
  value: unknown,
  field: string
) {
  const normalized =
    requireString(
      value,
      field,
      160
    );


  if (
    !ID_RE.test(
      normalized
    )
  ) {
    throw new Error(
      `${field} is invalid.`
    );
  }


  return normalized;
}


function optionalId(
  value: unknown,
  field: string
) {
  const normalized =
    optionalString(
      value,
      field,
      160
    );


  if (
    normalized &&
    !ID_RE.test(
      normalized
    )
  ) {
    throw new Error(
      `${field} is invalid.`
    );
  }


  return normalized;
}


function requireSha256(
  value: unknown,
  field: string
) {
  const normalized =
    cleanString(
      value
    ).toLowerCase();


  if (
    !SHA256_RE.test(
      normalized
    )
  ) {
    throw new Error(
      `${field} must be a 64-character SHA-256 digest.`
    );
  }


  return normalized;
}


function optionalSha256(
  value: unknown,
  field: string
) {
  const normalized =
    cleanString(
      value
    ).toLowerCase();


  if (!normalized) {
    return null;
  }


  return requireSha256(
    normalized,
    field
  );
}


function requireGitSha(
  value: unknown
) {
  const normalized =
    cleanString(
      value
    ).toLowerCase();


  if (
    !GIT_SHA_RE.test(
      normalized
    )
  ) {
    throw new Error(
      "source.gitSha must be an exact 40-character Git SHA."
    );
  }


  return normalized;
}


function requireCanonicalTimestamp(
  value: unknown,
  field: string
) {
  const normalized =
    requireString(
      value,
      field,
      64
    );


  const parsed =
    new Date(
      normalized
    );


  if (
    Number.isNaN(
      parsed.getTime()
    ) ||
    parsed.toISOString() !==
      normalized
  ) {
    throw new Error(
      `${field} must be a canonical UTC ISO timestamp.`
    );
  }


  return normalized;
}


function requireStage(
  value: unknown
) {
  const normalized =
    cleanString(
      value
    );


  if (
    normalized !==
      "dev" &&
    normalized !==
      "prod"
  ) {
    throw new Error(
      'stage must be "dev" or "prod".'
    );
  }


  return normalized as
    | "dev"
    | "prod";
}


function requirePositiveInteger(
  value: unknown,
  field: string
) {
  if (
    !Number.isInteger(
      value
    ) ||
    Number(
      value
    ) <=
      0
  ) {
    throw new Error(
      `${field} must be a positive integer.`
    );
  }


  return Number(
    value
  );
}


function normalizeProfileRuntime(
  value: unknown
) {
  if (
    !isPlainObject(
      value
    )
  ) {
    throw new Error(
      "profileRuntime must be an object."
    );
  }


  assertAllowedKeys(
    value,
    new Set([
      "ppsVersion",
    ]),
    "profileRuntime"
  );


  return {
    ppsVersion:
      requirePositiveInteger(
        value.ppsVersion,
        "profileRuntime.ppsVersion"
      ),
  };
}


function normalizePathList(
  value: unknown,
  field: string
) {
  if (
    !Array.isArray(
      value
    )
  ) {
    throw new Error(
      `${field} must be an array.`
    );
  }


  return [
    ...new Set(
      value.map(
        (
          item,
          index
        ) =>
          requireString(
            item,
            `${field}[${index}]`,
            900
          )
      )
    ),
  ].sort();
}


function normalizeDiffFiles(
  value: unknown
) {
  if (
    !isPlainObject(
      value
    )
  ) {
    throw new Error(
      "build.diffFiles must be an object."
    );
  }


  assertAllowedKeys(
    value,
    new Set([
      "infra",
      "data",
      "uiux",
      "githubWorkflow",
    ]),
    "build.diffFiles"
  );


  return {
    infra:
      normalizePathList(
        value.infra,
        "build.diffFiles.infra"
      ),

    data:
      normalizePathList(
        value.data,
        "build.diffFiles.data"
      ),

    uiux:
      normalizePathList(
        value.uiux,
        "build.diffFiles.uiux"
      ),

    githubWorkflow:
      normalizePathList(
        value.githubWorkflow,
        "build.diffFiles.githubWorkflow"
      ),
  };
}


function expectedDiffTagValue(
  diffFiles: {
    infra: string[];
    data: string[];
    uiux: string[];
    githubWorkflow: string[];
  }
) {
  const parts: string[] =
    [];


  if (
    diffFiles.infra.length
  ) {
    parts.push(
      "infra"
    );
  }


  if (
    diffFiles.data.length
  ) {
    parts.push(
      "data"
    );
  }


  if (
    diffFiles.uiux.length
  ) {
    parts.push(
      "uiux"
    );
  }


  if (
    diffFiles
      .githubWorkflow
      .length
  ) {
    parts.push(
      "githubWorkflow"
    );
  }


  return parts.length
    ? parts.join(
        "_"
      )
    : "none";
}


export function normalizeAndValidatePlatformReleaseDocument(
  input: unknown
) {
  if (
    !isPlainObject(
      input
    )
  ) {
    throw new Error(
      "Platform Release must be an object."
    );
  }


  if (
    input.schema !==
      PLATFORM_RELEASE_DOCUMENT_SCHEMA
  ) {
    throw new Error(
      `schema must be "${PLATFORM_RELEASE_DOCUMENT_SCHEMA}".`
    );
  }


  const schemaId =
    input.schemaId;


  if (
    schemaId !==
      PLATFORM_RELEASE_SCHEMA_ID_V1 &&
    schemaId !==
      PLATFORM_RELEASE_SCHEMA_ID_V2
  ) {
    throw new Error(
      `schemaId must be "${PLATFORM_RELEASE_SCHEMA_ID_V1}" or "${PLATFORM_RELEASE_SCHEMA_ID_V2}".`
    );
  }


  const allowedKeys =
    new Set([
      "schema",
      "schemaId",
      "platformReleaseId",
      "stage",
      "createdAt",
      "source",
      "build",
      "legacy",
    ]);


  if (
    schemaId ===
      PLATFORM_RELEASE_SCHEMA_ID_V2
  ) {
    allowedKeys.add(
      "profileRuntime"
    );
  }


  assertAllowedKeys(
    input,
    allowedKeys,
    "Platform Release"
  );


  const profileRuntime =
    schemaId ===
      PLATFORM_RELEASE_SCHEMA_ID_V2
      ? normalizeProfileRuntime(
          input.profileRuntime
        )
      : null;


  const platformReleaseId =
    requireId(
      input.platformReleaseId,
      "platformReleaseId"
    );


  const stage =
    requireStage(
      input.stage
    );


  const createdAt =
    requireCanonicalTimestamp(
      input.createdAt,
      "createdAt"
    );


  if (
    !isPlainObject(
      input.source
    )
  ) {
    throw new Error(
      "source must be an object."
    );
  }


  assertAllowedKeys(
    input.source,
    new Set([
      "repository",
      "gitSha",
      "gitRef",
      "checkpointTag",
    ]),
    "source"
  );


  const source = {
    repository:
      requireString(
        input.source.repository,
        "source.repository",
        500
      ),

    gitSha:
      requireGitSha(
        input.source.gitSha
      ),

    gitRef:
      requireString(
        input.source.gitRef,
        "source.gitRef",
        240
      ),

    checkpointTag:
      optionalString(
        input.source
          .checkpointTag,
        "source.checkpointTag",
        240
      ),
  };


  if (
    !isPlainObject(
      input.build
    )
  ) {
    throw new Error(
      "build must be an object."
    );
  }


  assertAllowedKeys(
    input.build,
    new Set([
      "buildTime",
      "frontendArtifactSha256",
      "githubRunId",
      "repoArtifactKey",
      "repoArtifactSha256",
      "diffFiles",
      "diffTagValue",
    ]),
    "build"
  );


  const diffFiles =
    normalizeDiffFiles(
      input.build.diffFiles
    );


  const diffTagValue =
    requireString(
      input.build.diffTagValue,
      "build.diffTagValue",
      120
    );


  const expectedTag =
    expectedDiffTagValue(
      diffFiles
    );


  if (
    diffTagValue !==
      expectedTag
  ) {
    throw new Error(
      `build.diffTagValue must be "${expectedTag}" for the supplied diffFiles.`
    );
  }


  const repoArtifactKey =
    optionalString(
      input.build
        .repoArtifactKey,
      "build.repoArtifactKey",
      900
    );


  const repoArtifactSha256 =
    optionalSha256(
      input.build
        .repoArtifactSha256,
      "build.repoArtifactSha256"
    );


  if (
    Boolean(
      repoArtifactKey
    ) !==
    Boolean(
      repoArtifactSha256
    )
  ) {
    throw new Error(
      "build.repoArtifactKey and build.repoArtifactSha256 must be provided together."
    );
  }


  const build = {
    buildTime:
      requireCanonicalTimestamp(
        input.build.buildTime,
        "build.buildTime"
      ),

    frontendArtifactSha256:
      requireSha256(
        input.build
          .frontendArtifactSha256,
        "build.frontendArtifactSha256"
      ),

    githubRunId:
      optionalString(
        input.build.githubRunId,
        "build.githubRunId",
        120
      ),

    repoArtifactKey,

    repoArtifactSha256,

    diffFiles,

    diffTagValue,
  };


  const legacyInput =
    input.legacy ===
      undefined ||
    input.legacy ===
      null
      ? {}
      : input.legacy;


  if (
    !isPlainObject(
      legacyInput
    )
  ) {
    throw new Error(
      "legacy must be an object when provided."
    );
  }


  assertAllowedKeys(
    legacyInput,
    new Set([
      "profileVersionId",
    ]),
    "legacy"
  );


  const legacy = {
    profileVersionId:
      optionalId(
        legacyInput
          .profileVersionId,
        "legacy.profileVersionId"
      ),
  };


  const base = {
    schema:
      PLATFORM_RELEASE_DOCUMENT_SCHEMA,

    platformReleaseId,

    stage,

    createdAt,

    source,

    build,

    legacy,
  };


  /**
   * Keep schemaId literal in each return branch.
   *
   * This gives TypeScript a proper discriminated union:
   *
   *   v1 -> no profileRuntime
   *   v2 -> profileRuntime required
   *
   * It also preserves historical v1 canonical shape exactly.
   */
  if (
    schemaId ===
      PLATFORM_RELEASE_SCHEMA_ID_V1
  ) {
    return {
      ...base,

      schemaId:
        PLATFORM_RELEASE_SCHEMA_ID_V1 as
          typeof PLATFORM_RELEASE_SCHEMA_ID_V1,
    };
  }


  return {
    ...base,

    schemaId:
      PLATFORM_RELEASE_SCHEMA_ID_V2 as
        typeof PLATFORM_RELEASE_SCHEMA_ID_V2,

    profileRuntime:
      profileRuntime!,
  };
}


export function createPlatformReleaseObjectKey(
  platformReleaseId: unknown
) {
  const normalized =
    requireId(
      platformReleaseId,
      "platformReleaseId"
    );


  return (
    `releases/${normalized}.json`
  );
}


export function createPlatformReleaseDocument({
  platformReleaseId,
  stage,
  createdAt,
  source,
  build,
  legacy = {},
}: {
  platformReleaseId: string;

  stage:
    | "dev"
    | "prod";

  createdAt:
    string;

  source:
    PlainObject;

  build:
    PlainObject;

  legacy?:
    PlainObject;
}) {
  return normalizeAndValidatePlatformReleaseDocument({
    schema:
      PLATFORM_RELEASE_DOCUMENT_SCHEMA,

    schemaId:
      PLATFORM_RELEASE_SCHEMA_ID_V1,

    platformReleaseId,

    stage,

    createdAt,

    source,

    build,

    legacy,
  });
}

export function createPlatformReleaseDocumentV2({
  platformReleaseId,
  stage,
  createdAt,
  source,
  build,
  profileRuntime,
  legacy = {},
}: {
  platformReleaseId:
    string;

  stage:
    | "dev"
    | "prod";

  createdAt:
    string;

  source:
    PlainObject;

  build:
    PlainObject;

  profileRuntime: {
    ppsVersion:
      number;
  };

  legacy?:
    PlainObject;
}) {
  const release =
    normalizeAndValidatePlatformReleaseDocument({
      schema:
        PLATFORM_RELEASE_DOCUMENT_SCHEMA,

      schemaId:
        PLATFORM_RELEASE_SCHEMA_ID_V2,

      platformReleaseId,

      stage,

      createdAt,

      source,

      build,

      profileRuntime,

      legacy,
    });


  /**
   * Defensive invariant + TypeScript narrowing.
   *
   * This creator can only ever produce Platform Release v2.
   */
  if (
    release.schemaId !==
      PLATFORM_RELEASE_SCHEMA_ID_V2
  ) {
    throw new Error(
      "Platform Release v2 normalization produced the wrong schema version."
    );
  }


  return release;
}