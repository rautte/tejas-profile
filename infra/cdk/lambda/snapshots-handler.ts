// infra/cdk/lambda/snapshots-handler.ts

import {
  S3Client,
  ListObjectsV2Command,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
  ListObjectVersionsCommand,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";

import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import {
  buildLegacySnapshotHistoricalTruth,
  enrichLegacyDeployHistory,
} from "./legacy-history-read-model";

import {
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";

import {
  unmarshall,
} from "@aws-sdk/util-dynamodb";

import {
  createHash,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

import {
  createOwnerSessionToken,
  verifyOwnerSessionToken,
} from "./owner-session-auth";

import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

import {
  base64Sha256ToHex,
  canonicalJsonStringify,
  createProfileVariantAssetObjectKey,
  createProfileVariantManifestKey,
  hexSha256ToBase64,
  normalizeAndValidateProfileVariantDocument,
  sha256Hex,
} from "./profile-variants-contract";

import {
  createPlatformReleaseObjectKey,
  normalizeAndValidatePlatformReleaseDocument,
} from "./platform-release-contract";

import {
  computeDeploymentConfigurationId,
  createDeploymentConfigurationDocument,
  createDeploymentConfigurationObjectKey,
  normalizeAndValidateDeploymentConfigurationDocument,
} from "./deployment-configuration-contract";

import {
  assertDeclaredProfilePlatformCompatible,
  isProfilePlatformCompatibilityGateError,
  requireDeclaredProfilePlatformSpecification,
} from "./profile-platform-specification";

import {
  PROFILE_ACTIVATION_LEDGER_PK,
  PROFILE_ACTIVATION_VARIANT_INDEX_NAME,
  buildProfileActivationTransition,
  createActivationVariantIndexPk,
  validateProfileActivationRecord,
} from "./profile-activation-contract";

import {
  commitProfileActivationTransition,
  isProfileActivationConflict,
  readActiveProfilePointer,
} from "./profile-activation-store";

import {
  PLATFORM_DEPLOYMENT_LEDGER_PK,
  PLATFORM_DEPLOYMENT_RELEASE_INDEX_NAME,
  buildPlatformDeploymentTransition,
  createPlatformDeploymentReleaseIndexPk,
  validatePlatformDeploymentRecord,
} from "./platform-deployment-contract";

import {
  commitPlatformDeploymentTransition,
  isPlatformDeploymentConflict,
  readActivePlatformReleasePointer,
} from "./platform-deployment-store";

import {
  USAGE_EPOCH_STATE,
  USAGE_EPOCH_TRANSITION_KIND,
  normalizeAndValidateUsageEpochDocument,
} from "./usage-epoch-contract";

import {
  createUsageEpochConfigurationIndexPk,
  createUsageEpochStateIndexPk,
  prepareUsageEpochLifecycle,
  readUsageEpochRecord,
  validateUsageEpochStorageRecord,
} from "./usage-epoch-store";

import {
  readConfigurationAnalyticsReport,
} from "./configuration-analytics-report-store";

type Event = {
  requestContext?: { http?: { method?: string; path?: string } };
  rawPath?: string;
  rawQueryString?: string;
  queryStringParameters?: Record<string, string>;
  headers?: Record<string, string>;
  body?: string | null;
};

const s3 =
  new S3Client({});

const dynamodb =
  new DynamoDBClient({});

const secretsManager =
  new SecretsManagerClient({});

const SNAPSHOTS_BUCKET =
  process.env.SNAPSHOTS_BUCKET!;

const REPO_BUCKET =
  process.env.REPO_BUCKET ||
  SNAPSHOTS_BUCKET;

const PROFILE_VARIANTS_BUCKET =
  process.env.PROFILE_VARIANTS_BUCKET ||
  "";

const PLATFORM_RELEASES_BUCKET =
  process.env.PLATFORM_RELEASES_BUCKET ||
  "";

const DEPLOYMENT_CONFIGURATIONS_BUCKET =
  process.env.DEPLOYMENT_CONFIGURATIONS_BUCKET ||
  "";

const DEPLOYMENT_CONFIGURATIONS_TABLE =
  process.env.DEPLOYMENT_CONFIGURATIONS_TABLE ||
  "";

const PROFILE_ACTIVATION_TABLE =
  process.env.PROFILE_ACTIVATION_TABLE ||
  "";

const PLATFORM_DEPLOYMENT_TABLE =
  process.env.PLATFORM_DEPLOYMENT_TABLE ||
  "";

const USAGE_EPOCHS_TABLE =
  process.env.USAGE_EPOCHS_TABLE ||
  "";

const CONFIGURATION_ANALYTICS_REPORTS_BUCKET =
  process.env.CONFIGURATION_ANALYTICS_REPORTS_BUCKET ||
  "";

const STAGE =
  String(
    process.env.STAGE ||
      ""
  ).trim();

const SNAP_PREFIX =
  process.env.SNAPSHOTS_PREFIX ||
  "snapshots/";

const TRASH_PREFIX =
  process.env.TRASH_PREFIX ||
  "trash/";


const OWNER_TOKEN_SECRET_ID =
  process.env.OWNER_TOKEN_SECRET_ID ||
  "";

const OWNER_SESSION_SIGNING_KEY_SECRET_ID =
  process.env
    .OWNER_SESSION_SIGNING_KEY_SECRET_ID ||
  "";


const TEST_OWNER_SESSION_SIGNING_KEY =
  process.env.NODE_ENV ===
    "test"
    ? String(
        process.env
          .OWNER_SESSION_SIGNING_KEY ||
        ""
      ).trim()
    : "";


// Existing handler unit tests intentionally use an
// in-process credential. Production Lambda deployments
// never receive OWNER_TOKEN after P10D2.
const TEST_OWNER_TOKEN =
  process.env.NODE_ENV === "test"
    ? String(
        process.env.OWNER_TOKEN ||
        ""
      ).trim()
    : "";


const PROFILES_PREFIX =
  process.env.PROFILES_PREFIX ||
  "profiles/";


let cachedOwnerToken:
  string |
  null =
  null;

let cachedOwnerSessionSigningKey:
  string |
  null =
  null;

const DEPLOY_HISTORY_KEY = process.env.DEPLOY_HISTORY_KEY || "deploy/history.json";

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// -----------------------------
// helpers: git sha + basic checks
// -----------------------------
function requireNonEmpty(value: any, field: string) {
  const v = String(value || "").trim();
  if (!v) return { ok: false as const, status: 400, msg: `${field} required` };
  return { ok: true as const, value: v };
}

function isLikelyGitSha(s: string) {
  return /^[a-f0-9]{7,40}$/i.test(
    s || ""
  );
}

function requireControlPlaneId(
  value:
    unknown,

  field:
    string
) {
  const normalized =
    String(
      value ??
      ""
    ).trim();


  if (
    !normalized ||
    normalized.length >
      160 ||
    !/^[A-Za-z0-9._:-]+$/.test(
      normalized
    )
  ) {
    throw new Error(
      `${field} is invalid.`
    );
  }


  return normalized;
}

function profilePlatformGateFailureBody({
  error,

  platformReleaseId,

  profileVariantId =
    null,

  deploymentConfigurationId =
    null,
}: {
  error:
    any;

  platformReleaseId:
    string;

  profileVariantId?:
    string |
    null;

  deploymentConfigurationId?:
    string |
    null;
}) {
  const body:
    any = {
      ok:
        false,

      error:
        String(
          error?.message ||
          error
        ),

      code:
        String(
          error?.code ||
          "PPS_COMPATIBILITY_REJECTED"
        ),

      platformReleaseId,
    };


  if (
    profileVariantId
  ) {
    body.profileVariantId =
      profileVariantId;
  }


  if (
    deploymentConfigurationId
  ) {
    body.deploymentConfigurationId =
      deploymentConfigurationId;
  }


  if (
    error?.compatibility
  ) {
    body.compatibility =
      error.compatibility;
  }


  return body;
}

// -----------------------------
// helpers: headers / cors / auth
// -----------------------------
function getHeader(headers: Record<string, string> | undefined, key: string) {
  if (!headers) return "";
  const k = Object.keys(headers).find((h) => h.toLowerCase() === key.toLowerCase());
  return k ? headers[k] : "";
}

function encodeCopySource(bucket: string, key: string) {
  // encode each path segment but keep '/'
  return `${bucket}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

function pickCorsOrigin(headers: Record<string, string> | undefined) {
  const origin = getHeader(headers, "origin");
  if (!origin) return "";
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  return "";
}

function baseHeaders(corsOrigin: string) {
  const h: Record<string, string> = {
    "content-type": "application/json",
    "access-control-allow-headers": "content-type,x-owner-token",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    vary: "Origin",
  };
  if (corsOrigin) h["access-control-allow-origin"] = corsOrigin;
  return h;
}

function json(statusCode: number, body: unknown, corsOrigin: string) {
  return {
    statusCode,
    headers: baseHeaders(corsOrigin),
    body: JSON.stringify(body),
  };
}

function secretsMatch(
  candidate:
    string,

  expected:
    string
) {
  const left =
    String(
      candidate ||
      ""
    ).trim();

  const right =
    String(
      expected ||
      ""
    ).trim();


  if (
    !left ||
    !right
  ) {
    return false;
  }


  // Hash first so timingSafeEqual always compares
  // fixed-length buffers.
  const leftDigest =
    createHash(
      "sha256"
    )
      .update(
        left,
        "utf8"
      )
      .digest();


  const rightDigest =
    createHash(
      "sha256"
    )
      .update(
        right,
        "utf8"
      )
      .digest();


  return timingSafeEqual(
    leftDigest,
    rightDigest
  );
}


async function getOwnerToken() {
  if (
    TEST_OWNER_TOKEN
  ) {
    return TEST_OWNER_TOKEN;
  }


  if (
    cachedOwnerToken
  ) {
    return cachedOwnerToken;
  }


  if (
    !OWNER_TOKEN_SECRET_ID
  ) {
    throw new Error(
      "OWNER_TOKEN_SECRET_ID not configured"
    );
  }


  const out =
    await secretsManager.send(
      new GetSecretValueCommand({
        SecretId:
          OWNER_TOKEN_SECRET_ID,
      })
    );


  const token =
    String(
      out.SecretString ||
      ""
    ).trim();


  if (
    !token
  ) {
    throw new Error(
      "Owner token secret is empty"
    );
  }


  cachedOwnerToken =
    token;


  return token;
}


async function getOwnerSessionSigningKey() {
  if (
    TEST_OWNER_SESSION_SIGNING_KEY
  ) {
    return TEST_OWNER_SESSION_SIGNING_KEY;
  }


  if (
    cachedOwnerSessionSigningKey
  ) {
    return cachedOwnerSessionSigningKey;
  }


  if (
    !OWNER_SESSION_SIGNING_KEY_SECRET_ID
  ) {
    throw new Error(
      "OWNER_SESSION_SIGNING_KEY_SECRET_ID not configured"
    );
  }


  const out =
    await secretsManager.send(
      new GetSecretValueCommand({
        SecretId:
          OWNER_SESSION_SIGNING_KEY_SECRET_ID,
      })
    );


  const key =
    String(
      out.SecretString ||
      ""
    ).trim();


  if (!key) {
    throw new Error(
      "Owner session signing key secret is empty"
    );
  }


  cachedOwnerSessionSigningKey =
    key;


  return key;
}


async function requireOwner(
  headers:
    Record<string, string> |
    undefined
) {
  const candidate =
    getHeader(
      headers,
      "x-owner-token"
    );


  if (!candidate) {
    return {
      ok:
        false as const,

      status:
        401,

      msg:
        "Unauthorized",
    };
  }


  let expectedMaster:
    string;


  try {
    expectedMaster =
      await getOwnerToken();
  } catch (e: any) {
    console.error(
      "Owner credential load failed",
      {
        secretConfigured:
          Boolean(
            OWNER_TOKEN_SECRET_ID
          ),

        error:
          String(
            e?.message ||
            e
          ),
      }
    );


    return {
      ok:
        false as const,

      status:
        500,

      msg:
        "Owner credential unavailable",
    };
  }


  // Machine-to-machine compatibility.
  //
  // CI and deployment workflows may continue using the
  // stage-specific master credential.
  if (
    secretsMatch(
      candidate,
      expectedMaster
    )
  ) {
    return {
      ok:
        true as const,

      credentialKind:
        "master" as const,
    };
  }


  let signingKey:
    string;


  try {
    signingKey =
      await getOwnerSessionSigningKey();
  } catch (e: any) {
    console.error(
      "Owner session signing credential load failed",
      {
        secretConfigured:
          Boolean(
            OWNER_SESSION_SIGNING_KEY_SECRET_ID
          ),

        error:
          String(
            e?.message ||
            e
          ),
      }
    );


    return {
      ok:
        false as const,

      status:
        500,

      msg:
        "Owner session authentication unavailable",
    };
  }


  const session =
    verifyOwnerSessionToken({
      token:
        candidate,

      stage:
        STAGE as
          "dev" |
          "prod",

      signingKey,
    });


  if (!session.ok) {
    return {
      ok:
        false as const,

      status:
        401,

      msg:
        "Unauthorized",
    };
  }


  return {
    ok:
      true as const,

    credentialKind:
      "session" as const,

    session:
      session.payload,
  };
}


// -----------------------------
// helpers: key safety + moves
// -----------------------------
function safeKeyPart(s: string) {
  return (s || "").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
}

function safeS3Key(s: string) {
  // keep slashes for paths; sanitize other weird characters safely
  return (s || "")
    .trim()
    .replace(/^\/+/, "")            // no leading slash
    .replace(/[^a-zA-Z0-9\/._-]+/g, "_")  // allow /
    .slice(0, 900);                // metadata value limit safety (keep below 2KB total)
}

function safeMetaValue(s: any, maxLen = 180) {
  // Keep it human readable; remove control chars; keep ASCII-ish to avoid header weirdness.
  return String(s || "")
    .trim()
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[^\x20-\x7E]+/g, "") // strip non-printable / non-ascii
    .slice(0, maxLen);
}

function ensurePrefix(key: string, prefix: string) {
  return key.startsWith(prefix);
}

function normalizeKey(key: string) {
  return (key || "").replace(/^\/+/, "");
}

function moveKey(fromKey: string, fromPrefix: string, toPrefix: string) {
  if (!fromKey.startsWith(fromPrefix)) return "";
  return toPrefix + fromKey.slice(fromPrefix.length);
}

function basename(key: string) {
  const parts = (key || "").split("/");
  return parts[parts.length - 1] || key;
}

// -----------------------------
// helpers: repo artifact lifecycle (repo bucket)
// -----------------------------
const REPO_TRASH_PREFIX = TRASH_PREFIX; // use same "trash/" prefix in repo bucket too

function toRepoTrashKey(repoKey: string) {
  const k = normalizeKey(repoKey);
  if (!k.startsWith(PROFILES_PREFIX)) return "";
  return `${REPO_TRASH_PREFIX}${k}`; // trash/profiles/...
}

async function moveRepoArtifactToTrash(repoKeyRaw: string) {
  const repoKey = normalizeKey(String(repoKeyRaw || ""));
  if (!repoKey) return;

  const trashKey = toRepoTrashKey(repoKey);
  if (!trashKey) return;

  // Copy repo zip -> trash/
  await s3.send(
    new CopyObjectCommand({
      Bucket: REPO_BUCKET,
      Key: trashKey,
      CopySource: encodeCopySource(REPO_BUCKET, repoKey),
      MetadataDirective: "COPY",
    })
  );

  // Delete original
  await s3.send(new DeleteObjectCommand({ Bucket: REPO_BUCKET, Key: repoKey }));
}

async function restoreRepoArtifactFromTrash(repoKeyRaw: string) {
  const repoKey = normalizeKey(String(repoKeyRaw || ""));
  if (!repoKey) return;

  const trashKey = toRepoTrashKey(repoKey);
  if (!trashKey) return;

  // Copy repo zip from trash/ -> live
  await s3.send(
    new CopyObjectCommand({
      Bucket: REPO_BUCKET,
      Key: repoKey,
      CopySource: encodeCopySource(REPO_BUCKET, trashKey),
      MetadataDirective: "COPY",
    })
  );

  // Delete trash copy (keeps versioned history if bucket versioning is on)
  await s3.send(new DeleteObjectCommand({ Bucket: REPO_BUCKET, Key: trashKey }));
}

async function purgeRepoArtifactForever(repoKeyRaw: string) {
  const repoKey = normalizeKey(String(repoKeyRaw || ""));
  if (!repoKey) return;

  const trashKey = toRepoTrashKey(repoKey);
  if (!trashKey) return;

  // Versioned bucket: delete ALL versions + delete markers for trashKey
  const versionsOut = await s3.send(
    new ListObjectVersionsCommand({
      Bucket: REPO_BUCKET,
      Prefix: trashKey,
    })
  );

  const versions = (versionsOut.Versions || [])
    .filter((v) => v.Key === trashKey && v.VersionId)
    .map((v) => ({ Key: trashKey, VersionId: v.VersionId! }));

  const markers = (versionsOut.DeleteMarkers || [])
    .filter((m) => m.Key === trashKey && m.VersionId)
    .map((m) => ({ Key: trashKey, VersionId: m.VersionId! }));

  const objects = [...versions, ...markers];
  if (!objects.length) return;

  for (let i = 0; i < objects.length; i += 1000) {
    const chunk = objects.slice(i, i + 1000);
    await s3.send(
      new DeleteObjectsCommand({
        Bucket: REPO_BUCKET,
        Delete: { Objects: chunk, Quiet: true },
      })
    );
  }
}


// -----------------------------
// parse metadata from key
// -----------------------------
type ParsedMeta = {
  name: string | null;
  from: string | null;
  to: string | null;
  createdAt: string | null;
};

function tryParseFromKey(key: string): ParsedMeta {
  const k = normalizeKey(key);

  const stripPrefix = (full: string) => {
    if (full.startsWith(SNAP_PREFIX)) return { rest: full.slice(SNAP_PREFIX.length) };
    if (full.startsWith(TRASH_PREFIX)) return { rest: full.slice(TRASH_PREFIX.length) };
    return { rest: full };
  };

  const { rest } = stripPrefix(k);
  const parts = rest.split("/").filter(Boolean);
  if (parts.length < 3) return { name: null, from: null, to: null, createdAt: null };

  const name = parts[0] || null;
  const rangePart = parts[1] || "";
  const file = parts[2] || "";

  let from: string | null = null;
  let to: string | null = null;

  const m = /^from_(.+)_to_(.+)$/.exec(rangePart);
  if (m) {
    from = m[1] || null;
    to = m[2] || null;
  }

  let createdAt: string | null = null;
  const base = file.endsWith(".json") ? file.slice(0, -5) : file;
  const prefix = `${name}__`;
  if (name && base.startsWith(prefix)) {
    const rest2 = base.slice(prefix.length);
    const chunks = rest2.split("__");
    if (chunks.length >= 3) {
      createdAt = chunks.slice(2).join("__") || null;
      if (!from) from = chunks[0] || from;
      if (!to) to = chunks[1] || to;
    }
  }

  return { name, from, to, createdAt };
}

function isProfileSnapshotKey(key: string) {
  const meta = tryParseFromKey(key);
  // Profile tab uses name "ci_deploy"
  return meta?.name === "ci_deploy";
}


async function streamToString(body: any): Promise<string> {
  if (!body) return "";
  // AWS SDK v3 returns a Readable stream in Node
  return await new Promise((resolve, reject) => {
    const chunks: any[] = [];
    body.on("data", (chunk: any) => chunks.push(chunk));
    body.on("error", reject);
    body.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
  });
}

function extractMetaFromSnapshotJson(doc: any) {
  const category =
    String(doc?.category || "").trim() ||
    // common fallback for profile snapshots
    (String(doc?.schema || "").toLowerCase().includes("profile") ? "Profile" : "");

  // tags can be:
  // 1) tags: { k: v }
  // 2) tagKey/tagValue
  // 3) tag: { key, value }
  let tagKey = "";
  let tagValue = "";

  const tagsObj = doc?.tags && typeof doc.tags === "object" ? doc.tags : null;
  if (tagsObj && Object.keys(tagsObj).length) {
    tagKey = String(Object.keys(tagsObj)[0] || "").trim();
    tagValue = String(tagsObj[tagKey] || "").trim();
  } else if (doc?.tagKey || doc?.tagValue) {
    tagKey = String(doc?.tagKey || "").trim();
    tagValue = String(doc?.tagValue || "").trim();
  } else if (doc?.tag?.key || doc?.tag?.value) {
    tagKey = String(doc?.tag?.key || "").trim();
    tagValue = String(doc?.tag?.value || "").trim();
  }

  const pv = doc?.profileVersion || {};
  const profileVersionId = String(pv?.id || "").trim();

  const repo = pv?.repo || {};
  const gitSha =
    String(pv?.gitSha || "").trim() ||
    String(repo?.commit || "").trim() ||
    String(doc?.gitSha || "").trim();

  const checkpointTag =
    String(repo?.checkpointTag || "").trim() ||
    String(doc?.checkpointTag || "").trim();

  // Repo artifact key can exist in multiple places depending on your producer:
  // - profileVersion.repo.artifactKey  (most likely for Profile snapshots)
  // - profileVersion.repo.artifact.key (alternate)
  // - repoArtifactKey (your analytics/meta naming)
  const repoArtifactKey =
    String(repo?.artifactKey || "").trim() ||
    String(repo?.artifact?.key || "").trim() ||
    String(doc?.repoArtifactKey || "").trim() ||
    String(doc?.repo?.artifactKey || "").trim();

  const repoArtifactSha256 =
    String(repo?.artifactSha256 || "").trim() ||
    String(repo?.artifact?.sha256 || "").trim() ||
    String(doc?.repoArtifactSha256 || "").trim();

  const formalLinks =
    doc?.formalLinks &&
    typeof doc.formalLinks ===
      "object"
      ? doc.formalLinks
      : {};


  const platformReleaseId =
    String(
      formalLinks
        ?.platformReleaseId ||
      ""
    ).trim();


  const platformDeploymentId =
    String(
      formalLinks
        ?.platformDeploymentId ||
      ""
    ).trim();

  const geoHint =
    String(doc?.geo?.hint || "").trim() ||
    String(doc?.geoHint || "").trim();

  return {
    category,
    tagKey,
    tagValue,
    profileVersionId,
    gitSha,
    checkpointTag,
    repoArtifactKey,
    repoArtifactSha256,

    platformReleaseId,
    platformDeploymentId,

    geoHint,
  };
}


function isS3NotFound(
  error: any
) {
  const name =
    String(
      error?.name || ""
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
      "NotFound" ||
    name ===
      "NoSuchKey" ||
    status ===
      404
  );
}


function isS3PreconditionFailed(
  error: any
) {
  const name =
    String(
      error?.name || ""
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
      "PreconditionFailed" ||
    status ===
      412
  );
}


function requireProfileVariantStorage() {
  if (
    !PROFILE_VARIANTS_BUCKET
  ) {
    return {
      ok:
        false as const,

      status:
        500,

      msg:
        "PROFILE_VARIANTS_BUCKET not configured",
    };
  }


  return {
    ok:
      true as const,
  };
}


function requirePlatformReleaseStorage() {
  if (
    !PLATFORM_RELEASES_BUCKET
  ) {
    return {
      ok:
        false as const,

      status:
        500,

      msg:
        "PLATFORM_RELEASES_BUCKET not configured",
    };
  }


  if (
    STAGE !==
      "dev" &&
    STAGE !==
      "prod"
  ) {
    return {
      ok:
        false as const,

      status:
        500,

      msg:
        "STAGE not configured for Platform Release storage",
    };
  }


  return {
    ok:
      true as const,
  };
}


function requireDeploymentConfigurationStorage() {
  if (
    !DEPLOYMENT_CONFIGURATIONS_BUCKET
  ) {
    return {
      ok:
        false as const,

      status:
        500,

      msg:
        "DEPLOYMENT_CONFIGURATIONS_BUCKET not configured",
    };
  }


  if (
    !DEPLOYMENT_CONFIGURATIONS_TABLE
  ) {
    return {
      ok:
        false as const,

      status:
        500,

      msg:
        "DEPLOYMENT_CONFIGURATIONS_TABLE not configured",
    };
  }


  if (
    STAGE !==
      "dev" &&
    STAGE !==
      "prod"
  ) {
    return {
      ok:
        false as const,

      status:
        500,

      msg:
        "STAGE not configured for Deployment Configuration storage",
    };
  }


  return {
    ok:
      true as const,
  };
}


function requireProfileActivationStorage() {
  if (
    !PROFILE_ACTIVATION_TABLE
  ) {
    return {
      ok:
        false as const,

      status:
        500,

      msg:
        "PROFILE_ACTIVATION_TABLE not configured",
    };
  }


  return {
    ok:
      true as const,
  };
}

function requirePlatformDeploymentStorage() {
  if (
    !PLATFORM_DEPLOYMENT_TABLE
  ) {
    return {
      ok:
        false as const,

      status:
        500,

      msg:
        "PLATFORM_DEPLOYMENT_TABLE not configured",
    };
  }


  return {
    ok:
      true as const,
  };
}

function requireUsageEpochStorage() {
  if (
    !USAGE_EPOCHS_TABLE
  ) {
    return {
      ok:
        false as const,

      status:
        500,

      msg:
        "USAGE_EPOCHS_TABLE not configured",
    };
  }


  if (
    STAGE !==
      "dev" &&
    STAGE !==
      "prod"
  ) {
    return {
      ok:
        false as const,

      status:
        500,

      msg:
        "STAGE not configured for Usage Epoch storage",
    };
  }


  return {
    ok:
      true as const,
  };
}


async function readPublishedProfileVariant(
  key: string
) {
  const out =
    await s3.send(
      new GetObjectCommand({
        Bucket:
          PROFILE_VARIANTS_BUCKET,

        Key:
          key,

        ChecksumMode:
          "ENABLED",
      })
    );


  const body =
    await streamToString(
      out.Body
    );


  return {
    body,

    checksumSha256:
      String(
        out.ChecksumSHA256 ||
        ""
      ),

    contentType:
      String(
        out.ContentType ||
        ""
      ),
  };
}

async function readStoredPlatformRelease(
  key: string
) {
  const out =
    await s3.send(
      new GetObjectCommand({
        Bucket:
          PLATFORM_RELEASES_BUCKET,

        Key:
          key,

        ChecksumMode:
          "ENABLED",
      })
    );


  const body =
    await streamToString(
      out.Body
    );


  return {
    body,

    checksumSha256:
      String(
        out.ChecksumSHA256 ||
        ""
      ),

    contentType:
      String(
        out.ContentType ||
        ""
      ),
  };
}


async function readStoredDeploymentConfiguration(
  key: string
) {
  const out =
    await s3.send(
      new GetObjectCommand({
        Bucket:
          DEPLOYMENT_CONFIGURATIONS_BUCKET,

        Key:
          key,

        ChecksumMode:
          "ENABLED",
      })
    );


  const body =
    await streamToString(
      out.Body
    );


  return {
    body,

    checksumSha256:
      String(
        out.ChecksumSHA256 ||
        ""
      ),

    contentType:
      String(
        out.ContentType ||
        ""
      ),
  };
}


function validateStoredBodyChecksum({
  body,
  checksumSha256,
  label,
}: {
  body:
    string;

  checksumSha256:
    string;

  label:
    string;
}) {
  const bodySha256 =
    sha256Hex(
      body
    );


  const storedChecksum =
    base64Sha256ToHex(
      checksumSha256
    );


  if (
    storedChecksum &&
    storedChecksum !==
      bodySha256
  ) {
    throw new Error(
      `${label} checksum verification failed.`
    );
  }


  return bodySha256;
}


async function loadAuthoritativePlatformReleaseRecord(
  platformReleaseId:
    string
) {
  const key =
    createPlatformReleaseObjectKey(
      platformReleaseId
    );


  const stored =
    await readStoredPlatformRelease(
      key
    );


  let parsed:
    any;


  try {
    parsed =
      JSON.parse(
        stored.body
      );
  } catch {
    throw new Error(
      "Stored Platform Release is corrupt."
    );
  }


  const release =
    normalizeAndValidatePlatformReleaseDocument(
      parsed
    );

  if (
    release
      .platformReleaseId !==
    platformReleaseId
  ) {
    throw new Error(
      "Stored Platform Release identity does not match object key."
    );
  }


  if (
    release.stage !==
      STAGE
  ) {
    throw new Error(
      "Stored Platform Release belongs to a different stage."
    );
  }


  const releaseSha256 =
    validateStoredBodyChecksum({
      body:
        stored.body,

      checksumSha256:
        stored.checksumSha256,

      label:
        "Stored Platform Release",
    });


  return {
    release,

    key,

    releaseSha256,
  };
}


async function loadAuthoritativePlatformRelease(
  platformReleaseId:
    string
) {
  const stored =
    await loadAuthoritativePlatformReleaseRecord(
      platformReleaseId
    );


  return stored.release;
}


async function loadAuthoritativeProfileVariantRecord(
  profileVariantId:
    string
) {
  const key =
    createProfileVariantManifestKey(
      profileVariantId
    );


  const stored =
    await readPublishedProfileVariant(
      key
    );


  let parsed:
    any;


  try {
    parsed =
      JSON.parse(
        stored.body
      );
  } catch {
    throw new Error(
      "Stored Profile Variant manifest is corrupt."
    );
  }


  const variant =
    normalizeAndValidateProfileVariantDocument(
      parsed
    );


  if (
    variant
      .profileVariantId !==
    profileVariantId
  ) {
    throw new Error(
      "Stored Profile Variant identity does not match manifest key."
    );
  }


  const manifestSha256 =
    validateStoredBodyChecksum({
      body:
        stored.body,

      checksumSha256:
        stored.checksumSha256,

      label:
        "Stored Profile Variant",
    });


  return {
    variant,

    key,

    manifestSha256,
  };
}


async function loadAuthoritativeProfileVariant(
  profileVariantId:
    string
) {
  const stored =
    await loadAuthoritativeProfileVariantRecord(
      profileVariantId
    );


  return stored.variant;
}


async function loadStoredDeploymentConfiguration(
  deploymentConfigurationId:
    string
) {
  const key =
    createDeploymentConfigurationObjectKey(
      deploymentConfigurationId
    );


  const stored =
    await readStoredDeploymentConfiguration(
      key
    );


  let parsed:
    any;


  try {
    parsed =
      JSON.parse(
        stored.body
      );
  } catch {
    throw new Error(
      "Stored Deployment Configuration is corrupt."
    );
  }


  const configuration =
    normalizeAndValidateDeploymentConfigurationDocument(
      parsed
    );


  if (
    configuration.stage !==
      STAGE
  ) {
    throw new Error(
      "Stored Deployment Configuration belongs to a different stage."
    );
  }


  const configurationSha256 =
    validateStoredBodyChecksum({
      body:
        stored.body,

      checksumSha256:
        stored.checksumSha256,

      label:
        "Stored Deployment Configuration",
    });


  return {
    configuration,

    key,

    configurationSha256,
  };
}

async function loadDeploymentConfigurationForComposition({
  platformReleaseId,
  profileVariantId,
  contentSchemaVersion,
  contentHash,
}: {
  platformReleaseId:
    string;

  profileVariantId:
    string;

  contentSchemaVersion:
    number;

  contentHash:
    string;
}) {
  const deploymentConfigurationId =
    computeDeploymentConfigurationId({
      stage:
        STAGE as
          | "dev"
          | "prod",

      platformReleaseId,

      profileVariantId,
    });


  const stored =
    await loadStoredDeploymentConfiguration(
      deploymentConfigurationId
    );


  const configuration =
    stored.configuration;


  if (
    configuration
      .deploymentConfigurationId !==
      deploymentConfigurationId ||
    configuration
      .platformReleaseId !==
      platformReleaseId ||
    configuration
      .profileVariantId !==
      profileVariantId
  ) {
    throw new Error(
      "Stored Deployment Configuration composition identity mismatch."
    );
  }


  if (
    configuration
      .profile
      .contentSchemaVersion !==
      contentSchemaVersion ||
    configuration
      .profile
      .contentHash !==
      contentHash
  ) {
    throw new Error(
      "Stored Deployment Configuration Profile evidence mismatch."
    );
  }


  return stored;
}


function deploymentConfigurationCatalogItem({
  configuration,
  key,
  configurationSha256,
}: {
  configuration:
    any;

  key:
    string;

  configurationSha256:
    string;
}) {
  const id =
    configuration
      .deploymentConfigurationId;

  const createdAt =
    configuration
      .createdAt;


  return {
    pk: {
      S:
        `CONFIG#${id}`,
    },

    sk: {
      S:
        "CONFIG",
    },

    deploymentConfigurationId: {
      S:
        id,
    },

    stage: {
      S:
        configuration
          .stage,
    },

    createdAt: {
      S:
        createdAt,
    },

    platformReleaseId: {
      S:
        configuration
          .platformReleaseId,
    },

    profileVariantId: {
      S:
        configuration
          .profileVariantId,
    },

    contentSchemaVersion: {
      N:
        String(
          configuration
            .profile
            .contentSchemaVersion
        ),
    },

    contentHash: {
      S:
        configuration
          .profile
          .contentHash,
    },

    profileTargetingLocation: {
      S:
        configuration
          .profile
          .targeting
          .location,
    },

    profileTargetingJobRole: {
      S:
        configuration
          .profile
          .targeting
          .jobRole,
    },

    objectKey: {
      S:
        key,
    },

    configurationSha256: {
      S:
        configurationSha256,
    },

    gsi1pk: {
      S:
        `PROFILE#${configuration.profileVariantId}`,
    },

    gsi1sk: {
      S:
        `CREATED#${createdAt}#CONFIG#${id}`,
    },

    gsi2pk: {
      S:
        `PLATFORM#${configuration.platformReleaseId}`,
    },

    gsi2sk: {
      S:
        `CREATED#${createdAt}#CONFIG#${id}`,
    },
  };
}


async function ensureDeploymentConfigurationCatalogEntry({
  configuration,
  key,
  configurationSha256,
}: {
  configuration:
    any;

  key:
    string;

  configurationSha256:
    string;
}) {
  /**
   * DynamoDB is a derived searchable catalog.
   *
   * S3 remains authoritative.
   *
   * Rewriting this exact projection is intentionally allowed so
   * retries can repair a missing/stale catalog entry without ever
   * mutating the immutable S3 document.
   */
  await dynamodb.send(
    new PutItemCommand({
      TableName:
        DEPLOYMENT_CONFIGURATIONS_TABLE,

      Item:
        deploymentConfigurationCatalogItem({
          configuration,

          key,

          configurationSha256,
        }),
    })
  );
}


function deploymentConfigurationCatalogSummary(
  item: any
) {
  return {
    deploymentConfigurationId:
      String(
        item
          ?.deploymentConfigurationId
          ?.S ||
        ""
      ),

    stage:
      String(
        item
          ?.stage
          ?.S ||
        ""
      ),

    createdAt:
      String(
        item
          ?.createdAt
          ?.S ||
        ""
      ),

    platformReleaseId:
      String(
        item
          ?.platformReleaseId
          ?.S ||
        ""
      ),

    profileVariantId:
      String(
        item
          ?.profileVariantId
          ?.S ||
        ""
      ),

    contentSchemaVersion:
      Number(
        item
          ?.contentSchemaVersion
          ?.N ||
        0
      ),

    contentHash:
      String(
        item
          ?.contentHash
          ?.S ||
        ""
      ),

    targeting: {
      location:
        String(
          item
            ?.profileTargetingLocation
            ?.S ||
          ""
        ),

      jobRole:
        String(
          item
            ?.profileTargetingJobRole
            ?.S ||
          ""
        ),
    },

    objectKey:
      String(
        item
          ?.objectKey
          ?.S ||
        ""
      ),

    configurationSha256:
      String(
        item
          ?.configurationSha256
          ?.S ||
        ""
      ),
  };
}


function encodeDeploymentConfigurationNextToken(
  key: any
) {
  if (!key) {
    return null;
  }


  return Buffer
    .from(
      JSON.stringify(
        key
      ),
      "utf8"
    )
    .toString(
      "base64url"
    );
}


function decodeDeploymentConfigurationNextToken(
  value: unknown
) {
  const token =
    String(
      value ||
      ""
    ).trim();


  if (!token) {
    return undefined;
  }


  if (
    token.length >
      4096
  ) {
    throw new Error(
      "Invalid Deployment Configuration nextToken."
    );
  }


  try {
    const parsed =
      JSON.parse(
        Buffer
          .from(
            token,
            "base64url"
          )
          .toString(
            "utf8"
          )
      );


    if (
      !parsed ||
      typeof parsed !==
        "object" ||
      Array.isArray(
        parsed
      )
    ) {
      throw new Error(
        "invalid"
      );
    }


    return parsed;
  } catch {
    throw new Error(
      "Invalid Deployment Configuration nextToken."
    );
  }
}

function encodeControlPlaneHistoryNextToken(
  scope:
    string,

  key:
    any
) {
  if (
    !key
  ) {
    return null;
  }


  return Buffer
    .from(
      JSON.stringify({
        scope,

        key,
      }),
      "utf8"
    )
    .toString(
      "base64url"
    );
}


function decodeControlPlaneHistoryNextToken(
  value:
    unknown,

  scope:
    string,

  label:
    string
) {
  const token =
    String(
      value ||
      ""
    ).trim();


  if (
    !token
  ) {
    return undefined;
  }


  if (
    token.length >
      4096
  ) {
    throw new Error(
      `Invalid ${label} nextToken.`
    );
  }


  try {
    const parsed =
      JSON.parse(
        Buffer
          .from(
            token,
            "base64url"
          )
          .toString(
            "utf8"
          )
      );


    if (
      !parsed ||
      typeof parsed !==
        "object" ||
      Array.isArray(
        parsed
      ) ||
      parsed.scope !==
        scope ||
      !parsed.key ||
      typeof parsed.key !==
        "object" ||
      Array.isArray(
        parsed.key
      )
    ) {
      throw new Error(
        "invalid"
      );
    }


    return parsed.key;
  } catch {
    throw new Error(
      `Invalid ${label} nextToken.`
    );
  }
}


function parseControlPlaneHistoryLimit(
  value:
    unknown
) {
  const raw =
    String(
      value ||
      ""
    ).trim();


  if (
    !raw
  ) {
    return 50;
  }


  const limit =
    Number(
      raw
    );


  if (
    !Number.isInteger(
      limit
    ) ||
    limit <
      1 ||
    limit >
      100
  ) {
    throw new Error(
      "limit must be an integer between 1 and 100."
    );
  }


  return limit;
}


function profileActivationHistorySummary(
  item:
    any
) {
  const record =
    unmarshall(
      item
    );


  validateProfileActivationRecord(
    record
  );


  return {
    activationId:
      record.activationId,

    profileVariantId:
      record.profileVariantId,

    activatedAt:
      record.activatedAt,

    revision:
      record.revision,

    previousActivationId:
      record.previousActivationId,

    previousProfileVariantId:
      record.previousProfileVariantId,

    contentSchemaVersion:
      record.contentSchemaVersion,

    contentHash:
      record.contentHash,
  };
}


function platformDeploymentHistorySummary(
  item:
    any
) {
  const record =
    unmarshall(
      item
    );


  validatePlatformDeploymentRecord(
    record
  );


  return {
    deploymentId:
      record.deploymentId,

    platformReleaseId:
      record.platformReleaseId,

    deployedAt:
      record.deployedAt,

    revision:
      record.revision,

    platformReleaseSha256:
      record.platformReleaseSha256,

    previousDeploymentId:
      record.previousDeploymentId,

    previousPlatformReleaseId:
      record.previousPlatformReleaseId,
  };
}

function usageEpochDocumentSummary(
  input:
    unknown
) {
  const epoch =
    normalizeAndValidateUsageEpochDocument(
      input
    );


  if (
    epoch.stage !==
      STAGE
  ) {
    throw new Error(
      "Stored Usage Epoch belongs to a different stage."
    );
  }


  return {
    usageEpochId:
      epoch.usageEpochId,

    stage:
      epoch.stage,

    deploymentConfigurationId:
      epoch
        .deploymentConfigurationId,

    platformReleaseId:
      epoch.platformReleaseId,

    profileVariantId:
      epoch.profileVariantId,

    state:
      epoch.state,

    startedAt:
      epoch.startedAt,

    endedAt:
      epoch.endedAt ??
      null,

    openedBy:
      epoch.openedBy,

    closedBy:
      epoch.closedBy ??
      null,

    report:
      epoch.report ??
      null,
  };
}


function usageEpochHistorySummary(
  item:
    any
) {
  const storageRecord =
    unmarshall(
      item
    );


  validateUsageEpochStorageRecord(
    storageRecord
  );


  /**
   * DynamoDB index attributes are persistence mechanics.
   * They are deliberately not part of the owner API contract.
   */
  const document:
    any = {
      ...storageRecord,
    };


  delete document.pk;
  delete document.sk;
  delete document.gsi1pk;
  delete document.gsi1sk;
  delete document.gsi2pk;
  delete document.gsi2sk;


  return usageEpochDocumentSummary(
    document
  );
}


function isUsageEpochRecordMissing(
  error:
    any
) {
  return String(
    error?.message ||
    error ||
    ""
  ).includes(
    "Usage Epoch record does not exist."
  );
}


function assertReportMatchesUsageEpoch({
  epoch:
    inputEpoch,

  stored,
}: {
  epoch:
    unknown;

  stored:
    any;
}) {
  const epoch =
    normalizeAndValidateUsageEpochDocument(
      inputEpoch
    );


  if (
    epoch.state !==
      USAGE_EPOCH_STATE.CLOSED ||
    !epoch.report
  ) {
    throw new Error(
      "Usage Epoch does not contain finalized report evidence."
    );
  }


  const report =
    stored?.report;


  const matches =
    Boolean(
      report &&
      stored.reportSha256 ===
        epoch.report
          .reportSha256 &&
      report.reportId ===
        epoch.report
          .reportId &&
      report.usageEpochId ===
        epoch.usageEpochId &&
      report.stage ===
        epoch.stage &&
      report.deploymentConfigurationId ===
        epoch.deploymentConfigurationId &&
      report.platformReleaseId ===
        epoch.platformReleaseId &&
      report.profileVariantId ===
        epoch.profileVariantId &&
      report.interval
        ?.startedAt ===
        epoch.startedAt &&
      report.interval
        ?.endedAt ===
        epoch.endedAt &&
      canonicalJsonStringify(
        report.openedBy
      ) ===
        canonicalJsonStringify(
          epoch.openedBy
        ) &&
      canonicalJsonStringify(
        report.closedBy
      ) ===
        canonicalJsonStringify(
          epoch.closedBy
        )
    );


  if (
    !matches
  ) {
    throw new Error(
      "Stored Configuration Analytics Report does not match finalized Usage Epoch evidence."
    );
  }
}


function encodeImmutableCatalogNextToken(
  scope:
    string,

  continuationToken:
    unknown
) {
  const token =
    String(
      continuationToken ||
      ""
    ).trim();


  if (
    !token
  ) {
    return null;
  }


  return Buffer
    .from(
      JSON.stringify({
        scope,

        continuationToken:
          token,
      }),
      "utf8"
    )
    .toString(
      "base64url"
    );
}


function decodeImmutableCatalogNextToken(
  value:
    unknown,

  scope:
    string,

  label:
    string
) {
  const token =
    String(
      value ||
      ""
    ).trim();


  if (
    !token
  ) {
    return undefined;
  }


  if (
    token.length >
      4096
  ) {
    throw new Error(
      `Invalid ${label} nextToken.`
    );
  }


  try {
    const parsed =
      JSON.parse(
        Buffer
          .from(
            token,
            "base64url"
          )
          .toString(
            "utf8"
          )
      );


    if (
      !parsed ||
      typeof parsed !==
        "object" ||
      Array.isArray(
        parsed
      ) ||
      parsed.scope !==
        scope ||
      typeof parsed
        .continuationToken !==
        "string" ||
      !parsed
        .continuationToken
        .trim()
    ) {
      throw new Error(
        "invalid"
      );
    }


    return parsed
      .continuationToken
      .trim();
  } catch {
    throw new Error(
      `Invalid ${label} nextToken.`
    );
  }
}


function parseImmutableCatalogLimit(
  value:
    unknown
) {
  const raw =
    String(
      value ||
      ""
    ).trim();


  if (
    !raw
  ) {
    return 25;
  }


  const limit =
    Number(
      raw
    );


  if (
    !Number.isInteger(
      limit
    ) ||
    limit <
      1 ||
    limit >
      50
  ) {
    throw new Error(
      "limit must be an integer between 1 and 50."
    );
  }


  return limit;
}


function profileVariantCatalogSummary({
  variant,
  key,
  manifestSha256,
}: {
  variant:
    any;

  key:
    string;

  manifestSha256:
    string;
}) {
  return {
    profileVariantId:
      variant
        .profileVariantId,

    schemaId:
      variant
        .schemaId,

    createdAt:
      variant
        .createdAt,

    contentSchemaVersion:
      variant
        .contentSchemaVersion,

    contentHash:
      variant
        .contentHash,

    targeting:
      variant
        .targeting,

    key,

    manifestSha256,
  };
}


function platformReleaseCatalogSummary({
  release,
  key,
  releaseSha256,
}: {
  release:
    any;

  key:
    string;

  releaseSha256:
    string;
}) {
  return {
    platformReleaseId:
      release
        .platformReleaseId,

    schemaId:
      release
        .schemaId,

    stage:
      release
        .stage,

    createdAt:
      release
        .createdAt,

    ppsVersion:
      release
        .profileRuntime
        ?.ppsVersion ??
      null,

    source: {
      repository:
        release
          .source
          .repository,

      gitSha:
        release
          .source
          .gitSha,

      gitRef:
        release
          .source
          .gitRef,

      checkpointTag:
        release
          .source
          .checkpointTag,
    },

    buildTime:
      release
        .build
        .buildTime,

    frontendArtifactSha256:
      release
        .build
        .frontendArtifactSha256,

    key,

    releaseSha256,
  };
}


export async function handler(event: Event) {
  const path = event.rawPath || event.requestContext?.http?.path || "";
  const method = (event.requestContext?.http?.method || "").toUpperCase();

  const corsOrigin = pickCorsOrigin(event.headers);

  console.log("REQ", {
    method,
    path,
    origin: getHeader(event.headers, "origin"),
    hasOwnerHeader: Boolean(getHeader(event.headers, "x-owner-token")),
    corsAllowed: Boolean(corsOrigin),
    qs: event.queryStringParameters || {},
  });

  if (method === "OPTIONS") return json(200, { ok: true }, corsOrigin);

  const origin = getHeader(event.headers, "origin");
  if (origin && !corsOrigin) {
    return json(403, { ok: false, error: "CORS origin not allowed", origin }, "");
  }

  // -----------------------------
  // POST /owner/session
  //
  // Browser-only authentication exchange.
  //
  // The master passcode is verified once and is never
  // returned to or persisted by the server.
  //
  // Normal owner API calls use the returned short-lived,
  // stage-bound HMAC session credential.
  //
  // Existing CI/machine callers may continue using the
  // master credential directly.
  // -----------------------------
  if (
    method === "POST" &&
    path.endsWith(
      "/owner/session"
    )
  ) {
    let payload:
      any = {};


    try {
      payload =
        event.body
          ? JSON.parse(
              event.body
            )
          : {};
    } catch {
      return json(
        400,
        {
          ok:
            false,

          error:
            "Invalid JSON body",
        },
        corsOrigin
      );
    }


    const passcode =
      String(
        payload.passcode ||
        ""
      ).trim();


    if (!passcode) {
      return json(
        400,
        {
          ok:
            false,

          error:
            "Passcode required",
        },
        corsOrigin
      );
    }


    let expectedMaster:
      string;


    try {
      expectedMaster =
        await getOwnerToken();
    } catch (e: any) {
      console.error(
        "Owner session master credential load failed",
        {
          secretConfigured:
            Boolean(
              OWNER_TOKEN_SECRET_ID
            ),

          error:
            String(
              e?.message ||
              e
            ),
        }
      );


      return json(
        500,
        {
          ok:
            false,

          error:
            "Owner authentication unavailable",
        },
        corsOrigin
      );
    }


    if (
      !secretsMatch(
        passcode,
        expectedMaster
      )
    ) {
      return json(
        401,
        {
          ok:
            false,

          error:
            "Unauthorized",
        },
        corsOrigin
      );
    }


    let signingKey:
      string;


    try {
      signingKey =
        await getOwnerSessionSigningKey();
    } catch (e: any) {
      console.error(
        "Owner session signing credential load failed",
        {
          secretConfigured:
            Boolean(
              OWNER_SESSION_SIGNING_KEY_SECRET_ID
            ),

          error:
            String(
              e?.message ||
              e
            ),
        }
      );


      return json(
        500,
        {
          ok:
            false,

          error:
            "Owner session unavailable",
        },
        corsOrigin
      );
    }


    let created;


    try {
      created =
        createOwnerSessionToken({
          stage:
            STAGE as
              "dev" |
              "prod",

          signingKey,
        });
    } catch (e: any) {
      console.error(
        "Owner session issuance failed",
        {
          stage:
            STAGE,

          error:
            String(
              e?.message ||
              e
            ),
        }
      );


      return json(
        500,
        {
          ok:
            false,

          error:
            "Owner session unavailable",
        },
        corsOrigin
      );
    }


    return json(
      200,
      {
        ok:
          true,

        sessionToken:
          created.token,

        expiresAt:
          created.expiresAt,

        expiresInSeconds:
          created.expiresInSeconds,
      },
      corsOrigin
    );
  }

  const auth =
    await requireOwner(
      event.headers
    );


  if (
    !auth.ok
  ) {
    return json(
      auth.status,
      {
        ok:
          false,

        error:
          auth.msg,
      },
      corsOrigin
    );
  }


  // -----------------------------
  // POST /profile-variants/assets/presign-put
  //
  // body:
  // {
  //   sha256,
  //   contentType
  // }
  //
  // Asset object keys are computed server-side from immutable
  // bytes identity. The client cannot choose arbitrary S3 keys.
  // -----------------------------
  if (
    method === "POST" &&
    path.endsWith(
      "/profile-variants/assets/presign-put"
    )
  ) {
    const storage =
      requireProfileVariantStorage();

    if (!storage.ok) {
      return json(
        storage.status,
        {
          ok: false,
          error:
            storage.msg,
        },
        corsOrigin
      );
    }


    let payload: any = {};

    try {
      payload =
        event.body
          ? JSON.parse(
              event.body
            )
          : {};
    } catch {
      return json(
        400,
        {
          ok: false,
          error:
            "Invalid JSON body",
        },
        corsOrigin
      );
    }


    const sha256 =
      String(
        payload.sha256 ||
        ""
      )
        .trim()
        .toLowerCase();

    const contentType =
      String(
        payload.contentType ||
        ""
      ).trim();


    let key: string;

    let checksumBase64:
      string;


    try {
      key =
        createProfileVariantAssetObjectKey({
          sha256,
          contentType,
        });

      checksumBase64 =
        hexSha256ToBase64(
          sha256
        );
    } catch (
      error: any
    ) {
      return json(
        400,
        {
          ok: false,
          error:
            String(
              error?.message ||
              error
            ),
        },
        corsOrigin
      );
    }


    /**
     * Content-addressed object already present:
     * skip upload only if S3 confirms exact bytes + type.
     */
    try {
      const existing =
        await s3.send(
          new HeadObjectCommand({
            Bucket:
              PROFILE_VARIANTS_BUCKET,

            Key:
              key,

            ChecksumMode:
              "ENABLED",
          })
        );


      const existingHash =
        base64Sha256ToHex(
          String(
            existing.ChecksumSHA256 ||
            ""
          )
        );


      if (
        existingHash !==
          sha256 ||
        String(
          existing.ContentType ||
          ""
        ) !==
          contentType
      ) {
        return json(
          409,
          {
            ok: false,
            error:
              "Content-addressed asset key already exists with incompatible metadata.",
            key,
          },
          corsOrigin
        );
      }


      return json(
        200,
        {
          ok:
            true,

          key,

          alreadyExists:
            true,
        },
        corsOrigin
      );
    } catch (
      error: any
    ) {
      if (
        !isS3NotFound(
          error
        )
      ) {
        console.error(
          "Profile asset HEAD failed",
          {
            key,
            error:
              String(
                error?.message ||
                error
              ),
          }
        );


        return json(
          500,
          {
            ok: false,
            error:
              "Failed to inspect Profile Variant asset.",
          },
          corsOrigin
        );
      }
    }


    const cmd =
      new PutObjectCommand({
        Bucket:
          PROFILE_VARIANTS_BUCKET,

        Key:
          key,

        ContentType:
          contentType,

        ChecksumSHA256:
          checksumBase64,

        IfNoneMatch:
          "*",
      });


    const url =
      await getSignedUrl(
        s3,
        cmd,
        {
          expiresIn:
            600,
        }
      );


    return json(
      200,
      {
        ok:
          true,

        key,

        alreadyExists:
          false,

        url,

        requiredHeaders: {
          "content-type":
            contentType,

          "x-amz-checksum-sha256":
            checksumBase64,

          "if-none-match":
            "*",
        },
      },
      corsOrigin
    );
  }


  // -----------------------------
  // POST /profile-variants/publish
  //
  // body:
  // {
  //   variant: <ProfileVariant>
  // }
  //
  // COMMIT RULE:
  // manifest.json is written only after every immutable asset
  // exists in S3 and its checksum/content-type are verified.
  // -----------------------------
  if (
    method === "POST" &&
    path.endsWith(
      "/profile-variants/publish"
    )
  ) {
    const storage =
      requireProfileVariantStorage();

    if (!storage.ok) {
      return json(
        storage.status,
        {
          ok: false,
          error:
            storage.msg,
        },
        corsOrigin
      );
    }


    let payload: any = {};

    try {
      payload =
        event.body
          ? JSON.parse(
              event.body
            )
          : {};
    } catch {
      return json(
        400,
        {
          ok: false,
          error:
            "Invalid JSON body",
        },
        corsOrigin
      );
    }


    let variant: any;

    try {
      variant =
        normalizeAndValidateProfileVariantDocument(
          payload.variant
        );
    } catch (
      error: any
    ) {
      return json(
        400,
        {
          ok: false,
          error:
            String(
              error?.message ||
              error
            ),
        },
        corsOrigin
      );
    }


    /**
     * Verify every referenced immutable asset.
     *
     * Nothing is trusted merely because the client says it was
     * uploaded successfully.
     */
    for (
      const asset of
        variant.assets
    ) {
      let head: any;

      try {
        head =
          await s3.send(
            new HeadObjectCommand({
              Bucket:
                PROFILE_VARIANTS_BUCKET,

              Key:
                asset.objectKey,

              ChecksumMode:
                "ENABLED",
            })
          );
      } catch (
        error: any
      ) {
        if (
          isS3NotFound(
            error
          )
        ) {
          return json(
            409,
            {
              ok: false,
              error:
                `Profile Variant asset "${asset.id}" has not been uploaded.`,
              assetId:
                asset.id,
              key:
                asset.objectKey,
            },
            corsOrigin
          );
        }


        console.error(
          "Profile asset verification failed",
          {
            assetId:
              asset.id,

            key:
              asset.objectKey,

            error:
              String(
                error?.message ||
                error
              ),
          }
        );


        return json(
          500,
          {
            ok: false,
            error:
              "Failed to verify Profile Variant assets.",
          },
          corsOrigin
        );
      }


      const actualSha256 =
        base64Sha256ToHex(
          String(
            head.ChecksumSHA256 ||
            ""
          )
        );


      if (
        actualSha256 !==
          asset.sha256
      ) {
        return json(
          409,
          {
            ok: false,
            error:
              `Checksum mismatch for Profile Variant asset "${asset.id}".`,
          },
          corsOrigin
        );
      }


      if (
        String(
          head.ContentType ||
          ""
        ) !==
          asset.contentType
      ) {
        return json(
          409,
          {
            ok: false,
            error:
              `Content-Type mismatch for Profile Variant asset "${asset.id}".`,
          },
          corsOrigin
        );
      }
    }


    let manifestKey:
      string;


    try {
      manifestKey =
        createProfileVariantManifestKey(
          variant.profileVariantId
        );
    } catch (
      error: any
    ) {
      return json(
        400,
        {
          ok: false,
          error:
            String(
              error?.message ||
              error
            ),
        },
        corsOrigin
      );
    }


    const manifestBody =
      canonicalJsonStringify(
        variant
      );


    const manifestSha256 =
      sha256Hex(
        manifestBody
      );


    const manifestChecksumBase64 =
      hexSha256ToBase64(
        manifestSha256
      );


    /**
     * First-write-only immutable Profile Variant manifest commit.
     *
     * The conditional PUT is the authoritative existence/race gate.
     * We deliberately do not pre-read the manifest.
     */
    try {
      await s3.send(
        new PutObjectCommand({
          Bucket:
            PROFILE_VARIANTS_BUCKET,

          Key:
            manifestKey,

          Body:
            manifestBody,

          ContentType:
            "application/json",

          ChecksumSHA256:
            manifestChecksumBase64,

          IfNoneMatch:
            "*",
        })
      );
    } catch (
      error: any
    ) {
      /**
       * Existing immutable content or a concurrent first writer
       * produces a conditional failure.
       *
       * Read the winner only after that authoritative S3 signal.
       */
      if (
        isS3PreconditionFailed(
          error
        )
      ) {
        try {
          const existing =
            await readPublishedProfileVariant(
              manifestKey
            );


          if (
            existing.body ===
              manifestBody
          ) {
            return json(
              200,
              {
                ok:
                  true,

                alreadyPublished:
                  true,

                profileVariantId:
                  variant
                    .profileVariantId,

                contentHash:
                  variant
                    .contentHash,

                key:
                  manifestKey,

                manifestSha256,
              },
              corsOrigin
            );
          }


          return json(
            409,
            {
              ok:
                false,

              error:
                "profileVariantId already exists with different immutable content.",

              profileVariantId:
                variant
                  .profileVariantId,
            },
            corsOrigin
          );
        } catch (
          winnerError: any
        ) {
          console.error(
            "Profile Variant conflict inspection failed",
            {
              manifestKey,

              error:
                String(
                  winnerError
                    ?.message ||
                  winnerError
                ),
            }
          );


          return json(
            500,
            {
              ok:
                false,

              error:
                "Failed to inspect existing Profile Variant after conditional conflict.",
            },
            corsOrigin
          );
        }
      }


      console.error(
        "Profile Variant manifest commit failed",
        {
          manifestKey,

          error:
            String(
              error?.message ||
              error
            ),
        }
      );


      return json(
        500,
        {
          ok:
            false,

          error:
            "Failed to publish Profile Variant.",
        },
        corsOrigin
      );
    }


    return json(
      201,
      {
        ok:
          true,

        alreadyPublished:
          false,

        profileVariantId:
          variant
            .profileVariantId,

        contentHash:
          variant
            .contentHash,

        key:
          manifestKey,

        manifestSha256,
      },
      corsOrigin
    );
  }


  // -----------------------------
  // GET /profile-variants/get?profileVariantId=...
  //
  // Owner-only retrieval of immutable published manifest.
  // Public active-profile delivery belongs to P3, not here.
  // -----------------------------
  if (
    method === "GET" &&
    path.endsWith(
      "/profile-variants/get"
    )
  ) {
    const storage =
      requireProfileVariantStorage();

    if (!storage.ok) {
      return json(
        storage.status,
        {
          ok: false,
          error:
            storage.msg,
        },
        corsOrigin
      );
    }


    const profileVariantId =
      String(
        event
          .queryStringParameters
          ?.profileVariantId ||
        ""
      ).trim();


    let key:
      string;


    try {
      key =
        createProfileVariantManifestKey(
          profileVariantId
        );
    } catch (
      error: any
    ) {
      return json(
        400,
        {
          ok: false,
          error:
            String(
              error?.message ||
              error
            ),
        },
        corsOrigin
      );
    }


    try {
      const stored =
        await readPublishedProfileVariant(
          key
        );


      let parsed: any;

      try {
        parsed =
          JSON.parse(
            stored.body
          );
      } catch {
        return json(
          500,
          {
            ok: false,
            error:
              "Stored Profile Variant manifest is corrupt.",
          },
          corsOrigin
        );
      }


      let variant: any;

      try {
        variant =
          normalizeAndValidateProfileVariantDocument(
            parsed
          );
      } catch (
        error: any
      ) {
        console.error(
          "Stored Profile Variant validation failed",
          {
            key,

            error:
              String(
                error?.message ||
                error
              ),
          }
        );


        return json(
          500,
          {
            ok: false,
            error:
              "Stored Profile Variant failed validation.",
          },
          corsOrigin
        );
      }


      const manifestSha256 =
        sha256Hex(
          stored.body
        );


      const storedChecksum =
        base64Sha256ToHex(
          stored
            .checksumSha256
        );


      if (
        storedChecksum &&
        storedChecksum !==
          manifestSha256
      ) {
        return json(
          500,
          {
            ok: false,
            error:
              "Stored Profile Variant checksum verification failed.",
          },
          corsOrigin
        );
      }


      return json(
        200,
        {
          ok:
            true,

          key,

          manifestSha256,

          variant,
        },
        corsOrigin
      );
    } catch (
      error: any
    ) {
      if (
        isS3NotFound(
          error
        )
      ) {
        return json(
          404,
          {
            ok: false,
            error:
              "Profile Variant not found.",
          },
          corsOrigin
        );
      }


      console.error(
        "Profile Variant read failed",
        {
          key,

          error:
            String(
              error?.message ||
              error
            ),
        }
      );


      return json(
        500,
        {
          ok: false,
          error:
            "Failed to read Profile Variant.",
        },
        corsOrigin
      );
    }
  }


  // -----------------------------
  // GET /profile-variants/list
  //
  // Owner-only enumeration of authoritative immutable Profile
  // Variant manifests.
  //
  // Optional:
  //   limit=1..50
  //   nextToken=...
  //
  // S3 key order is the stable pagination order.
  // createdAt is evidence, not the pagination cursor.
  //
  // assets/sha256/* is never enumerated.
  // -----------------------------
  if (
    method ===
      "GET" &&
    path.endsWith(
      "/profile-variants/list"
    )
  ) {
    const storage =
      requireProfileVariantStorage();


    if (
      !storage.ok
    ) {
      return json(
        storage.status,
        {
          ok:
            false,

          error:
            storage.msg,
        },
        corsOrigin
      );
    }


    let limit:
      number;

    let continuationToken:
      string |
      undefined;


    try {
      limit =
        parseImmutableCatalogLimit(
          event
            .queryStringParameters
            ?.limit
        );

      continuationToken =
        decodeImmutableCatalogNextToken(
          event
            .queryStringParameters
            ?.nextToken,

          "profile-variants",

          "Profile Variant catalog"
        );
    } catch (
      error: any
    ) {
      return json(
        400,
        {
          ok:
            false,

          error:
            String(
              error?.message ||
              error
            ),
        },
        corsOrigin
      );
    }


    try {
      const out =
        await s3.send(
          new ListObjectsV2Command({
            Bucket:
              PROFILE_VARIANTS_BUCKET,

            Prefix:
              "variants/",

            Delimiter:
              "/",

            MaxKeys:
              limit,

            ContinuationToken:
              continuationToken,
          })
        );


      /**
       * There should be no direct immutable objects under variants/.
       *
       * Canonical layout:
       *
       *   variants/<profileVariantId>/manifest.json
       *
       * A console-style variants/ directory marker is harmless.
       */
      const unexpectedRootObjects =
        (
          out.Contents ||
          []
        )
          .map(
            (item) =>
              String(
                item.Key ||
                ""
              )
          )
          .filter(
            (key) =>
              key &&
              key !==
                "variants/"
          );


      if (
        unexpectedRootObjects.length
      ) {
        throw new Error(
          "Profile Variant catalog contains a non-canonical root object."
        );
      }


      const variants =
        await Promise.all(
          (
            out.CommonPrefixes ||
            []
          ).map(
            async (
              entry
            ) => {
              const prefix =
                String(
                  entry.Prefix ||
                  ""
                );


              const match =
                /^variants\/([^/]+)\/$/
                  .exec(
                    prefix
                  );


              if (
                !match
              ) {
                throw new Error(
                  "Profile Variant catalog contains an invalid prefix."
                );
              }


              const profileVariantId =
                match[1];


              const expectedKey =
                createProfileVariantManifestKey(
                  profileVariantId
                );


              if (
                expectedKey !==
                  `${prefix}manifest.json`
              ) {
                throw new Error(
                  "Profile Variant catalog prefix is not canonical."
                );
              }


              const stored =
                await loadAuthoritativeProfileVariantRecord(
                  profileVariantId
                );


              return profileVariantCatalogSummary({
                variant:
                  stored.variant,

                key:
                  stored.key,

                manifestSha256:
                  stored
                    .manifestSha256,
              });
            }
          )
        );


      return json(
        200,
        {
          ok:
            true,

          order:
            "objectKeyAscending",

          variants,

          nextToken:
            encodeImmutableCatalogNextToken(
              "profile-variants",

              out
                .NextContinuationToken
            ),
        },
        corsOrigin
      );
    } catch (
      error: any
    ) {
      console.error(
        "Profile Variant catalog enumeration failed",
        {
          error:
            String(
              error?.message ||
              error
            ),
        }
      );


      return json(
        500,
        {
          ok:
            false,

          error:
            "Failed to enumerate Profile Variant catalog.",
        },
        corsOrigin
      );
    }
  }


  // -----------------------------
  // POST /platform-releases/register
  //
  // Owner-only registration of one immutable application/software
  // release.
  //
  // body:
  // {
  //   release: <PlatformRelease>
  // }
  //
  // Registration != deployment.
  // Registration != Profile activation.
  //
  // The same ID + identical canonical document is idempotent.
  // The same ID + different immutable content is a conflict.
  // -----------------------------
  if (
    method === "POST" &&
    path.endsWith(
      "/platform-releases/register"
    )
  ) {
    const storage =
      requirePlatformReleaseStorage();


    if (
      !storage.ok
    ) {
      return json(
        storage.status,
        {
          ok:
            false,

          error:
            storage.msg,
        },
        corsOrigin
      );
    }


    let payload: any =
      {};


    try {
      payload =
        event.body
          ? JSON.parse(
              event.body
            )
          : {};
    } catch {
      return json(
        400,
        {
          ok:
            false,

          error:
            "Invalid JSON body",
        },
        corsOrigin
      );
    }


    let release:
      any;


    try {
      release =
        normalizeAndValidatePlatformReleaseDocument(
          payload.release
        );
    } catch (
      error: any
    ) {
      return json(
        400,
        {
          ok:
            false,

          error:
            String(
              error?.message ||
              error
            ),
        },
        corsOrigin
      );
    }


    if (
      release.stage !==
        STAGE
    ) {
      return json(
        409,
        {
          ok:
            false,

          error:
            `Platform Release stage "${release.stage}" does not match API stage "${STAGE}".`,
        },
        corsOrigin
      );
    }


    let key:
      string;


    try {
      key =
        createPlatformReleaseObjectKey(
          release
            .platformReleaseId
        );
    } catch (
      error: any
    ) {
      return json(
        400,
        {
          ok:
            false,

          error:
            String(
              error?.message ||
              error
            ),
        },
        corsOrigin
      );
    }


    const releaseBody =
      canonicalJsonStringify(
        release
      );


    const releaseSha256 =
      sha256Hex(
        releaseBody
      );


    const checksumBase64 =
      hexSha256ToBase64(
        releaseSha256
      );


    /**
     * First-write-only immutable Platform Release commit.
     *
     * IMPORTANT:
     *
     * Do not GET the would-be object before creating it.
     *
     * A missing S3 object may surface as AccessDenied rather than
     * NoSuchKey when the caller intentionally does not have broad
     * ListBucket authority.
     *
     * IfNoneMatch:"*" is therefore the authoritative existence and
     * concurrency gate for immutable creation.
     */
    try {
      await s3.send(
        new PutObjectCommand({
          Bucket:
            PLATFORM_RELEASES_BUCKET,

          Key:
            key,

          Body:
            releaseBody,

          ContentType:
            "application/json",

          ChecksumSHA256:
            checksumBase64,

          IfNoneMatch:
            "*",
        })
      );
    } catch (
      error: any
    ) {
      /**
       * 412 means the immutable key already exists, including the
       * case where another writer won a concurrent first-write race.
       *
       * Only now do we read the winner and compare canonical bytes.
       */
      if (
        isS3PreconditionFailed(
          error
        )
      ) {
        try {
          const existing =
            await readStoredPlatformRelease(
              key
            );


          if (
            existing.body ===
              releaseBody
          ) {
            return json(
              200,
              {
                ok:
                  true,

                alreadyRegistered:
                  true,

                platformReleaseId:
                  release
                    .platformReleaseId,

                key,

                releaseSha256,
              },
              corsOrigin
            );
          }


          return json(
            409,
            {
              ok:
                false,

              error:
                "platformReleaseId already exists with different immutable content.",

              platformReleaseId:
                release
                  .platformReleaseId,
            },
            corsOrigin
          );
        } catch (
          winnerError: any
        ) {
          console.error(
            "Platform Release conflict inspection failed",
            {
              key,

              error:
                String(
                  winnerError
                    ?.message ||
                  winnerError
                ),
            }
          );


          return json(
            500,
            {
              ok:
                false,

              error:
                "Failed to inspect existing Platform Release after conditional conflict.",
            },
            corsOrigin
          );
        }
      }


      console.error(
        "Platform Release registration failed",
        {
          key,

          error:
            String(
              error?.message ||
              error
            ),
        }
      );


      return json(
        500,
        {
          ok:
            false,

          error:
            "Failed to register Platform Release.",
        },
        corsOrigin
      );
    }


    return json(
      201,
      {
        ok:
          true,

        alreadyRegistered:
          false,

        platformReleaseId:
          release
            .platformReleaseId,

        key,

        releaseSha256,
      },
      corsOrigin
    );
  }


  // -----------------------------
  // GET /platform-releases/get?platformReleaseId=...
  //
  // Owner-only retrieval of one immutable software release.
  // -----------------------------
  if (
    method === "GET" &&
    path.endsWith(
      "/platform-releases/get"
    )
  ) {
    const storage =
      requirePlatformReleaseStorage();


    if (
      !storage.ok
    ) {
      return json(
        storage.status,
        {
          ok:
            false,

          error:
            storage.msg,
        },
        corsOrigin
      );
    }


    const platformReleaseId =
      String(
        event
          .queryStringParameters
          ?.platformReleaseId ||
        ""
      ).trim();


    let key:
      string;


    try {
      key =
        createPlatformReleaseObjectKey(
          platformReleaseId
        );
    } catch (
      error: any
    ) {
      return json(
        400,
        {
          ok:
            false,

          error:
            String(
              error?.message ||
              error
            ),
        },
        corsOrigin
      );
    }


    try {
      const stored =
        await readStoredPlatformRelease(
          key
        );


      let parsed:
        any;


      try {
        parsed =
          JSON.parse(
            stored.body
          );
      } catch {
        return json(
          500,
          {
            ok:
              false,

            error:
              "Stored Platform Release is corrupt.",
          },
          corsOrigin
        );
      }


      let release:
        any;


      try {
        release =
          normalizeAndValidatePlatformReleaseDocument(
            parsed
          );
      } catch (
        error: any
      ) {
        console.error(
          "Stored Platform Release validation failed",
          {
            key,

            error:
              String(
                error?.message ||
                error
              ),
          }
        );


        return json(
          500,
          {
            ok:
              false,

            error:
              "Stored Platform Release failed validation.",
          },
          corsOrigin
        );
      }


      if (
        release.stage !==
          STAGE
      ) {
        return json(
          500,
          {
            ok:
              false,

            error:
              "Stored Platform Release belongs to a different stage.",
          },
          corsOrigin
        );
      }


      const releaseSha256 =
        sha256Hex(
          stored.body
        );


      const storedChecksum =
        base64Sha256ToHex(
          stored
            .checksumSha256
        );


      if (
        storedChecksum &&
        storedChecksum !==
          releaseSha256
      ) {
        return json(
          500,
          {
            ok:
              false,

            error:
              "Stored Platform Release checksum verification failed.",
          },
          corsOrigin
        );
      }


      return json(
        200,
        {
          ok:
            true,

          platformReleaseId:
            release
              .platformReleaseId,

          key,

          releaseSha256,

          release,
        },
        corsOrigin
      );
    } catch (
      error: any
    ) {
      if (
        isS3NotFound(
          error
        )
      ) {
        return json(
          404,
          {
            ok:
              false,

            error:
              "Platform Release not found.",
          },
          corsOrigin
        );
      }


      console.error(
        "Platform Release read failed",
        {
          key,

          error:
            String(
              error?.message ||
              error
            ),
        }
      );


      return json(
        500,
        {
          ok:
            false,

          error:
            "Failed to read Platform Release.",
        },
        corsOrigin
      );
    }
  }

  // -----------------------------
  // GET /platform-releases/list
  //
  // Owner-only enumeration of authoritative immutable Platform
  // Releases.
  //
  // Optional:
  //   limit=1..50
  //   nextToken=...
  //
  // Both historical v1 and PPS-qualified v2 releases are readable.
  // v1 is returned truthfully with ppsVersion: null.
  // -----------------------------
  if (
    method ===
      "GET" &&
    path.endsWith(
      "/platform-releases/list"
    )
  ) {
    const storage =
      requirePlatformReleaseStorage();


    if (
      !storage.ok
    ) {
      return json(
        storage.status,
        {
          ok:
            false,

          error:
            storage.msg,
        },
        corsOrigin
      );
    }


    let limit:
      number;

    let continuationToken:
      string |
      undefined;


    try {
      limit =
        parseImmutableCatalogLimit(
          event
            .queryStringParameters
            ?.limit
        );

      continuationToken =
        decodeImmutableCatalogNextToken(
          event
            .queryStringParameters
            ?.nextToken,

          "platform-releases",

          "Platform Release catalog"
        );
    } catch (
      error: any
    ) {
      return json(
        400,
        {
          ok:
            false,

          error:
            String(
              error?.message ||
              error
            ),
        },
        corsOrigin
      );
    }


    try {
      const out =
        await s3.send(
          new ListObjectsV2Command({
            Bucket:
              PLATFORM_RELEASES_BUCKET,

            Prefix:
              "releases/",

            MaxKeys:
              limit,

            ContinuationToken:
              continuationToken,
          })
        );


      const releaseKeys:
        string[] = [];


      for (
        const entry of
          out.Contents ||
          []
      ) {
        const key =
          String(
            entry.Key ||
            ""
          );


        if (
          !key
        ) {
          throw new Error(
            "Platform Release catalog contains an object without a key."
          );
        }


        /**
         * Harmless console-style directory marker.
         */
        if (
          key ===
            "releases/"
        ) {
          continue;
        }


        const match =
          /^releases\/([^/]+)\.json$/
            .exec(
              key
            );


        if (
          !match
        ) {
          throw new Error(
            "Platform Release catalog contains a non-canonical object key."
          );
        }


        const platformReleaseId =
          match[1];


        const expectedKey =
          createPlatformReleaseObjectKey(
            platformReleaseId
          );


        if (
          expectedKey !==
            key
        ) {
          throw new Error(
            "Platform Release catalog object key is not canonical."
          );
        }


        releaseKeys.push(
          key
        );
      }


      const releases =
        await Promise.all(
          releaseKeys.map(
            async (
              key
            ) => {
              const platformReleaseId =
                key
                  .slice(
                    "releases/".length,
                    -".json".length
                  );


              const stored =
                await loadAuthoritativePlatformReleaseRecord(
                  platformReleaseId
                );


              return platformReleaseCatalogSummary({
                release:
                  stored.release,

                key:
                  stored.key,

                releaseSha256:
                  stored
                    .releaseSha256,
              });
            }
          )
        );


      return json(
        200,
        {
          ok:
            true,

          order:
            "objectKeyAscending",

          releases,

          nextToken:
            encodeImmutableCatalogNextToken(
              "platform-releases",

              out
                .NextContinuationToken
            ),
        },
        corsOrigin
      );
    } catch (
      error: any
    ) {
      console.error(
        "Platform Release catalog enumeration failed",
        {
          error:
            String(
              error?.message ||
              error
            ),
        }
      );


      return json(
        500,
        {
          ok:
            false,

          error:
            "Failed to enumerate Platform Release catalog.",
        },
        corsOrigin
      );
    }
  }


  // -----------------------------
  // POST /deployment-configurations/create
  //
  // body:
  // {
  //   platformReleaseId,
  //   profileVariantId
  // }
  //
  // IMPORTANT:
  // Client supplies identities only.
  //
  // Profile schema/hash/targeting are derived from the authoritative
  // immutable Profile Variant.
  //
  // createdAt is assigned only on first creation.
  //
  // Re-selecting the same composition returns the already-existing
  // immutable Deployment Configuration.
  //
  // PPS compatibility is enforced before a configuration may be
  // created, reused or returned from concurrent-create recovery.
  // -----------------------------
  if (
    method === "POST" &&
    path.endsWith(
      "/deployment-configurations/create"
    )
  ) {
    const storage =
      requireDeploymentConfigurationStorage();


    if (
      !storage.ok
    ) {
      return json(
        storage.status,
        {
          ok:
            false,

          error:
            storage.msg,
        },
        corsOrigin
      );
    }


    let payload:
      any = {};


    try {
      payload =
        event.body
          ? JSON.parse(
              event.body
            )
          : {};
    } catch {
      return json(
        400,
        {
          ok:
            false,

          error:
            "Invalid JSON body",
        },
        corsOrigin
      );
    }


    if (
      !payload ||
      typeof payload !==
        "object" ||
      Array.isArray(
        payload
      )
    ) {
      return json(
        400,
        {
          ok:
            false,

          error:
            "Deployment Configuration create body must be an object.",
        },
        corsOrigin
      );
    }


    const allowedKeys =
      new Set([
        "platformReleaseId",
        "profileVariantId",
      ]);


    for (
      const key of
        Object.keys(
          payload
        )
    ) {
      if (
        !allowedKeys.has(
          key
        )
      ) {
        return json(
          400,
          {
            ok:
              false,

            error:
              `Deployment Configuration create body.${key} is not supported.`,
          },
          corsOrigin
        );
      }
    }


    const platformReleaseId =
      String(
        payload
          .platformReleaseId ||
        ""
      ).trim();

    const profileVariantId =
      String(
        payload
          .profileVariantId ||
        ""
      ).trim();


    try {
      createPlatformReleaseObjectKey(
        platformReleaseId
      );

      createProfileVariantManifestKey(
        profileVariantId
      );
    } catch (
      error: any
    ) {
      return json(
        400,
        {
          ok:
            false,

          error:
            String(
              error?.message ||
              error
            ),
        },
        corsOrigin
      );
    }


    let deploymentConfigurationId:
      string;


    try {
      deploymentConfigurationId =
        computeDeploymentConfigurationId({
          stage:
            STAGE as
              | "dev"
              | "prod",

          platformReleaseId,

          profileVariantId,
        });
    } catch (
      error: any
    ) {
      return json(
        400,
        {
          ok:
            false,

          error:
            String(
              error?.message ||
              error
            ),
        },
        corsOrigin
      );
    }


    const configurationKey =
      createDeploymentConfigurationObjectKey(
        deploymentConfigurationId
      );


    let platformRelease:
      any;


    try {
      platformRelease =
        await loadAuthoritativePlatformRelease(
          platformReleaseId
        );
    } catch (
      error: any
    ) {
      if (
        isS3NotFound(
          error
        )
      ) {
        return json(
          404,
          {
            ok:
              false,

            error:
              "Platform Release not found.",
          },
          corsOrigin
        );
      }


      console.error(
        "Deployment Configuration Platform Release load failed",
        {
          platformReleaseId,

          error:
            String(
              error?.message ||
              error
            ),
        }
      );


      return json(
        500,
        {
          ok:
            false,

          error:
            "Failed to load authoritative Platform Release.",
        },
        corsOrigin
      );
    }

     /**
     * A new Deployment Configuration may only be composed from a
     * Platform Release that explicitly declares a PPS understood by
     * this control plane.
     *
     * Fail here before reading the Profile Variant. This keeps an
     * unqualified or unsupported Platform Release from progressing
     * further into composition resolution.
     *
     * Full Platform/Profile compatibility is still evaluated later,
     * after the authoritative Profile Variant has been loaded and the
     * candidate Deployment Configuration has been constructed.
     */
    try {
      requireDeclaredProfilePlatformSpecification(
        platformRelease
      );
    } catch (
      error: any
    ) {
      if (
        isProfilePlatformCompatibilityGateError(
          error
        )
      ) {
        return json(
          409,
          profilePlatformGateFailureBody({
            error,

            platformReleaseId,

            profileVariantId,

            deploymentConfigurationId,
          }),
          corsOrigin
        );
      }


      console.error(
        "Deployment Configuration Platform Release PPS declaration verification failed",
        {
          platformReleaseId,

          profileVariantId,

          deploymentConfigurationId,

          error:
            String(
              error?.message ||
              error
            ),
        }
      );


      return json(
        500,
        {
          ok:
            false,

          error:
            "Failed to verify Platform Release PPS declaration.",
        },
        corsOrigin
      );
    }


    let profileVariant:
      any;


    try {
      profileVariant =
        await loadAuthoritativeProfileVariant(
          profileVariantId
        );
    } catch (
      error: any
    ) {
      if (
        isS3NotFound(
          error
        )
      ) {
        return json(
          404,
          {
            ok:
              false,

            error:
              "Profile Variant not found.",
          },
          corsOrigin
        );
      }


      console.error(
        "Deployment Configuration Profile Variant load failed",
        {
          profileVariantId,

          error:
            String(
              error?.message ||
              error
            ),
        }
      );


      return json(
        500,
        {
          ok:
            false,

          error:
            "Failed to load authoritative Profile Variant.",
        },
        corsOrigin
      );
    }


    let configuration:
      any;


    try {
      configuration =
        createDeploymentConfigurationDocument({
          stage:
            STAGE as
              | "dev"
              | "prod",

          createdAt:
            new Date()
              .toISOString(),

          platformRelease,

          profileVariant,
        });
    } catch (
      error: any
    ) {
      return json(
        500,
        {
          ok:
            false,

          error:
            String(
              error?.message ||
              error
            ),
        },
        corsOrigin
      );
    }


    if (
      configuration
        .deploymentConfigurationId !==
      deploymentConfigurationId
    ) {
      return json(
        500,
        {
          ok:
            false,

          error:
            "Deployment Configuration identity mismatch.",
        },
        corsOrigin
      );
    }


    /**
     * Compatibility is operational policy, not immutable
     * Deployment Configuration content.
     *
     * Evaluate before writing. The configuration document itself
     * remains compatibility-neutral.
     */
    try {
      assertDeclaredProfilePlatformCompatible({
        platformRelease,

        deploymentConfiguration:
          configuration,
      });
    } catch (
      error: any
    ) {
      if (
        isProfilePlatformCompatibilityGateError(
          error
        )
      ) {
        return json(
          409,
          profilePlatformGateFailureBody({
            error,

            platformReleaseId,

            profileVariantId,

            deploymentConfigurationId,
          }),
          corsOrigin
        );
      }


      console.error(
        "Deployment Configuration PPS verification failed",
        {
          deploymentConfigurationId,

          platformReleaseId,

          profileVariantId,

          error:
            String(
              error?.message ||
              error
            ),
        }
      );


      return json(
        500,
        {
          ok:
            false,

          error:
            "Failed to verify Deployment Configuration compatibility.",
        },
        corsOrigin
      );
    }

    const configurationBody =
      canonicalJsonStringify(
        configuration
      );

    const configurationSha256 =
      sha256Hex(
        configurationBody
      );

    const checksumBase64 =
      hexSha256ToBase64(
        configurationSha256
      );


    try {
      await s3.send(
        new PutObjectCommand({
          Bucket:
            DEPLOYMENT_CONFIGURATIONS_BUCKET,

          Key:
            configurationKey,

          Body:
            configurationBody,

          ContentType:
            "application/json",

          ChecksumSHA256:
            checksumBase64,

          IfNoneMatch:
            "*",
        })
      );
    } catch (
      error: any
    ) {
      /**
       * Concurrent creator won the same deterministic identity.
       *
       * Do not compare createdAt/body. The authoritative winner is
       * the immutable configuration for this composition.
       */
      if (
        isS3PreconditionFailed(
          error
        )
      ) {
        try {
          const winner =
            await loadStoredDeploymentConfiguration(
              deploymentConfigurationId
            );

          assertDeclaredProfilePlatformCompatible({
            platformRelease,

            deploymentConfiguration:
              winner.configuration,
          });


          await ensureDeploymentConfigurationCatalogEntry({
            configuration:
              winner.configuration,

            key:
              winner.key,

            configurationSha256:
              winner
                .configurationSha256,
          });


          return json(
            200,
            {
              ok:
                true,

              alreadyCreated:
                true,

              deploymentConfigurationId,

              key:
                winner.key,

              configurationSha256:
                winner
                  .configurationSha256,

              configuration:
                winner
                  .configuration,
            },
            corsOrigin
          );
        } catch (
          winnerError: any
        ) {
          if (
            isProfilePlatformCompatibilityGateError(
              winnerError
            )
          ) {
            return json(
              409,
              profilePlatformGateFailureBody({
                error:
                  winnerError,

                platformReleaseId,

                profileVariantId,

                deploymentConfigurationId,
              }),
              corsOrigin
            );
          }

          console.error(
            "Deployment Configuration race recovery failed",
            {
              deploymentConfigurationId,

              error:
                String(
                  winnerError
                    ?.message ||
                  winnerError
                ),
            }
          );


          return json(
            500,
            {
              ok:
                false,

              error:
                "Failed to resolve concurrent Deployment Configuration creation.",
            },
            corsOrigin
          );
        }
      }


      console.error(
        "Deployment Configuration immutable write failed",
        {
          deploymentConfigurationId,

          error:
            String(
              error?.message ||
              error
            ),
        }
      );


      return json(
        500,
        {
          ok:
            false,

          error:
            "Failed to create Deployment Configuration.",
        },
        corsOrigin
      );
    }


    try {
      await ensureDeploymentConfigurationCatalogEntry({
        configuration,

        key:
          configurationKey,

        configurationSha256,
      });
    } catch (
      error: any
    ) {
      /**
       * S3 is already committed and remains authoritative.
       *
       * Return failure so a retry can repair the derived catalog.
       */
      console.error(
        "Deployment Configuration catalog write failed",
        {
          deploymentConfigurationId,

          error:
            String(
              error?.message ||
              error
            ),
        }
      );


      return json(
        500,
        {
          ok:
            false,

          error:
            "Deployment Configuration was created but catalog indexing failed. Retry the same request to repair the catalog.",
        },
        corsOrigin
      );
    }


    return json(
      201,
      {
        ok:
          true,

        alreadyCreated:
          false,

        deploymentConfigurationId,

        key:
          configurationKey,

        configurationSha256,

        configuration,
      },
      corsOrigin
    );
  }


  // -----------------------------
  // GET /deployment-configurations/get
  //     ?deploymentConfigurationId=...
  // -----------------------------
  if (
    method === "GET" &&
    path.endsWith(
      "/deployment-configurations/get"
    )
  ) {
    const storage =
      requireDeploymentConfigurationStorage();


    if (
      !storage.ok
    ) {
      return json(
        storage.status,
        {
          ok:
            false,

          error:
            storage.msg,
        },
        corsOrigin
      );
    }


    const deploymentConfigurationId =
      String(
        event
          .queryStringParameters
          ?.deploymentConfigurationId ||
        ""
      ).trim();


    try {
      createDeploymentConfigurationObjectKey(
        deploymentConfigurationId
      );
    } catch (
      error: any
    ) {
      return json(
        400,
        {
          ok:
            false,

          error:
            String(
              error?.message ||
              error
            ),
        },
        corsOrigin
      );
    }


    try {
      const stored =
        await loadStoredDeploymentConfiguration(
          deploymentConfigurationId
        );


      return json(
        200,
        {
          ok:
            true,

          deploymentConfigurationId,

          key:
            stored.key,

          configurationSha256:
            stored
              .configurationSha256,

          configuration:
            stored
              .configuration,
        },
        corsOrigin
      );
    } catch (
      error: any
    ) {
      if (
        isS3NotFound(
          error
        )
      ) {
        return json(
          404,
          {
            ok:
              false,

            error:
              "Deployment Configuration not found.",
          },
          corsOrigin
        );
      }


      console.error(
        "Deployment Configuration read failed",
        {
          deploymentConfigurationId,

          error:
            String(
              error?.message ||
              error
            ),
        }
      );


      return json(
        500,
        {
          ok:
            false,

          error:
            "Failed to read Deployment Configuration.",
        },
        corsOrigin
      );
    }
  }


  // -----------------------------
  // GET /deployment-configurations/list
  //
  // Exactly one reverse-lookup selector is required:
  //
  //   ?profileVariantId=...
  //
  // OR
  //
  //   ?platformReleaseId=...
  //
  // Optional:
  //   limit=1..100
  //   nextToken=...
  // -----------------------------
  if (
    method === "GET" &&
    path.endsWith(
      "/deployment-configurations/list"
    )
  ) {
    const storage =
      requireDeploymentConfigurationStorage();


    if (
      !storage.ok
    ) {
      return json(
        storage.status,
        {
          ok:
            false,

          error:
            storage.msg,
        },
        corsOrigin
      );
    }


    const profileVariantId =
      String(
        event
          .queryStringParameters
          ?.profileVariantId ||
        ""
      ).trim();

    const platformReleaseId =
      String(
        event
          .queryStringParameters
          ?.platformReleaseId ||
        ""
      ).trim();


    if (
      Boolean(
        profileVariantId
      ) ===
      Boolean(
        platformReleaseId
      )
    ) {
      return json(
        400,
        {
          ok:
            false,

          error:
            "Exactly one of profileVariantId or platformReleaseId is required.",
        },
        corsOrigin
      );
    }


    try {
      if (
        profileVariantId
      ) {
        createProfileVariantManifestKey(
          profileVariantId
        );
      } else {
        createPlatformReleaseObjectKey(
          platformReleaseId
        );
      }
    } catch (
      error: any
    ) {
      return json(
        400,
        {
          ok:
            false,

          error:
            String(
              error?.message ||
              error
            ),
        },
        corsOrigin
      );
    }


    const rawLimit =
      String(
        event
          .queryStringParameters
          ?.limit ||
        ""
      ).trim();


    let limit =
      50;


    if (
      rawLimit
    ) {
      const parsedLimit =
        Number(
          rawLimit
        );


      if (
        !Number.isInteger(
          parsedLimit
        ) ||
        parsedLimit <
          1 ||
        parsedLimit >
          100
      ) {
        return json(
          400,
          {
            ok:
              false,

            error:
              "limit must be an integer between 1 and 100.",
          },
          corsOrigin
        );
      }


      limit =
        parsedLimit;
    }


    let exclusiveStartKey:
      any;


    try {
      exclusiveStartKey =
        decodeDeploymentConfigurationNextToken(
          event
            .queryStringParameters
            ?.nextToken
        );
    } catch (
      error: any
    ) {
      return json(
        400,
        {
          ok:
            false,

          error:
            String(
              error?.message ||
              error
            ),
        },
        corsOrigin
      );
    }


    const byProfile =
      Boolean(
        profileVariantId
      );

    const indexName =
      byProfile
        ? "ByProfileVariant"
        : "ByPlatformRelease";

    const indexPartitionKey =
      byProfile
        ? "gsi1pk"
        : "gsi2pk";

    const indexPartitionValue =
      byProfile
        ? `PROFILE#${profileVariantId}`
        : `PLATFORM#${platformReleaseId}`;


    try {
      const out =
        await dynamodb.send(
          new QueryCommand({
            TableName:
              DEPLOYMENT_CONFIGURATIONS_TABLE,

            IndexName:
              indexName,

            KeyConditionExpression:
              "#indexPk = :indexPk",

            ExpressionAttributeNames: {
              "#indexPk":
                indexPartitionKey,
            },

            ExpressionAttributeValues: {
              ":indexPk": {
                S:
                  indexPartitionValue,
              },
            },

            Limit:
              limit,

            ExclusiveStartKey:
              exclusiveStartKey,

            ScanIndexForward:
              false,
          })
        );


      return json(
        200,
        {
          ok:
            true,

          filter:
            byProfile
              ? {
                  profileVariantId,
                  platformReleaseId:
                    null,
                }
              : {
                  profileVariantId:
                    null,
                  platformReleaseId,
                },

          configurations:
            (
              out.Items ||
              []
            ).map(
              deploymentConfigurationCatalogSummary
            ),

          nextToken:
            encodeDeploymentConfigurationNextToken(
              out
                .LastEvaluatedKey
            ),
        },
        corsOrigin
      );
    } catch (
      error: any
    ) {
      console.error(
        "Deployment Configuration catalog query failed",
        {
          indexName,

          error:
            String(
              error?.message ||
              error
            ),
        }
      );


      return json(
        500,
        {
          ok:
            false,

          error:
            "Failed to query Deployment Configuration catalog.",
        },
        corsOrigin
      );
    }
  }

  // -----------------------------
  // GET /profile-activations/list
  //
  // Owner-only append-only activation history.
  //
  // Optional:
  //   profileVariantId=...
  //   limit=1..100
  //   nextToken=...
  //
  // Without profileVariantId the ACTIVATION ledger partition is read.
  // With profileVariantId the existing ByProfileVariant GSI is used.
  // -----------------------------
  if (
    method ===
      "GET" &&
    path.endsWith(
      "/profile-activations/list"
    )
  ) {
    const storage =
      requireProfileActivationStorage();


    if (
      !storage.ok
    ) {
      return json(
        storage.status,
        {
          ok:
            false,

          error:
            storage.msg,
        },
        corsOrigin
      );
    }


    const profileVariantId =
      String(
        event
          .queryStringParameters
          ?.profileVariantId ||
        ""
      ).trim();


    let variantIndexPk =
      "";


    if (
      profileVariantId
    ) {
      try {
        variantIndexPk =
          createActivationVariantIndexPk(
            profileVariantId
          );
      } catch (
        error: any
      ) {
        return json(
          400,
          {
            ok:
              false,

            error:
              String(
                error?.message ||
                error
              ),
          },
          corsOrigin
        );
      }
    }


    let limit:
      number;


    try {
      limit =
        parseControlPlaneHistoryLimit(
          event
            .queryStringParameters
            ?.limit
        );
    } catch (
      error: any
    ) {
      return json(
        400,
        {
          ok:
            false,

          error:
            String(
              error?.message ||
                error
            ),
        },
        corsOrigin
      );
    }


    const scope =
      profileVariantId
        ? `profile-activations:${profileVariantId}`
        : "profile-activations:all";


    let exclusiveStartKey:
      any;


    try {
      exclusiveStartKey =
        decodeControlPlaneHistoryNextToken(
          event
            .queryStringParameters
            ?.nextToken,

          scope,

          "Profile Activation"
        );
    } catch (
      error: any
    ) {
      return json(
        400,
        {
          ok:
            false,

          error:
            String(
              error?.message ||
                error
            ),
        },
        corsOrigin
      );
    }


    const byProfile =
      Boolean(
        profileVariantId
      );


    try {
      const out =
        await dynamodb.send(
          new QueryCommand({
            TableName:
              PROFILE_ACTIVATION_TABLE,

            ...(
              byProfile
                ? {
                    IndexName:
                      PROFILE_ACTIVATION_VARIANT_INDEX_NAME,

                    KeyConditionExpression:
                      "#indexPk = :indexPk",

                    ExpressionAttributeNames: {
                      "#indexPk":
                        "gsi1pk",
                    },

                    ExpressionAttributeValues: {
                      ":indexPk": {
                        S:
                          variantIndexPk,
                      },
                    },
                  }
                : {
                    KeyConditionExpression:
                      "#pk = :pk",

                    ExpressionAttributeNames: {
                      "#pk":
                        "pk",
                    },

                    ExpressionAttributeValues: {
                      ":pk": {
                        S:
                          PROFILE_ACTIVATION_LEDGER_PK,
                      },
                    },
                  }
            ),

            Limit:
              limit,

            ExclusiveStartKey:
              exclusiveStartKey,

            ScanIndexForward:
              false,
          })
        );


      const activations =
        (
          out.Items ||
          []
        ).map(
          profileActivationHistorySummary
        );


      return json(
        200,
        {
          ok:
            true,

          filter: {
            profileVariantId:
              profileVariantId ||
              null,
          },

          activations,

          nextToken:
            encodeControlPlaneHistoryNextToken(
              scope,

              out
                .LastEvaluatedKey
            ),
        },
        corsOrigin
      );
    } catch (
      error: any
    ) {
      console.error(
        "Profile Activation history query failed",
        {
          profileVariantId:
            profileVariantId ||
            null,

          error:
            String(
              error?.message ||
                error
            ),
        }
      );


      return json(
        500,
        {
          ok:
            false,

          error:
            "Failed to query Profile Activation history.",
        },
        corsOrigin
      );
    }
  }

  // -----------------------------
  // GET /platform-deployments/list
  //
  // Owner-only append-only Platform deployment history.
  //
  // Optional:
  //   platformReleaseId=...
  //   limit=1..100
  //   nextToken=...
  //
  // Without platformReleaseId the DEPLOYMENT ledger partition is read.
  // With platformReleaseId the existing ByPlatformRelease GSI is used.
  // -----------------------------
  if (
    method ===
      "GET" &&
    path.endsWith(
      "/platform-deployments/list"
    )
  ) {
    const storage =
      requirePlatformDeploymentStorage();


    if (
      !storage.ok
    ) {
      return json(
        storage.status,
        {
          ok:
            false,

          error:
            storage.msg,
        },
        corsOrigin
      );
    }


    const platformReleaseId =
      String(
        event
          .queryStringParameters
          ?.platformReleaseId ||
        ""
      ).trim();


    let releaseIndexPk =
      "";


    if (
      platformReleaseId
    ) {
      try {
        releaseIndexPk =
          createPlatformDeploymentReleaseIndexPk(
            platformReleaseId
          );
      } catch (
        error: any
      ) {
        return json(
          400,
          {
            ok:
              false,

            error:
              String(
                error?.message ||
                  error
              ),
          },
          corsOrigin
        );
      }
    }


    let limit:
      number;


    try {
      limit =
        parseControlPlaneHistoryLimit(
          event
            .queryStringParameters
            ?.limit
        );
    } catch (
      error: any
    ) {
      return json(
        400,
        {
          ok:
            false,

          error:
            String(
              error?.message ||
                error
            ),
        },
        corsOrigin
      );
    }


    const scope =
      platformReleaseId
        ? `platform-deployments:${platformReleaseId}`
        : "platform-deployments:all";


    let exclusiveStartKey:
      any;


    try {
      exclusiveStartKey =
        decodeControlPlaneHistoryNextToken(
          event
            .queryStringParameters
            ?.nextToken,

          scope,

          "Platform Deployment"
        );
    } catch (
      error: any
    ) {
      return json(
        400,
        {
          ok:
            false,

          error:
            String(
              error?.message ||
                error
            ),
        },
        corsOrigin
      );
    }


    const byRelease =
      Boolean(
        platformReleaseId
      );


    try {
      const out =
        await dynamodb.send(
          new QueryCommand({
            TableName:
              PLATFORM_DEPLOYMENT_TABLE,

            ...(
              byRelease
                ? {
                    IndexName:
                      PLATFORM_DEPLOYMENT_RELEASE_INDEX_NAME,

                    KeyConditionExpression:
                      "#indexPk = :indexPk",

                    ExpressionAttributeNames: {
                      "#indexPk":
                        "gsi1pk",
                    },

                    ExpressionAttributeValues: {
                      ":indexPk": {
                        S:
                          releaseIndexPk,
                      },
                    },
                  }
                : {
                    KeyConditionExpression:
                      "#pk = :pk",

                    ExpressionAttributeNames: {
                      "#pk":
                        "pk",
                    },

                    ExpressionAttributeValues: {
                      ":pk": {
                        S:
                          PLATFORM_DEPLOYMENT_LEDGER_PK,
                      },
                    },
                  }
            ),

            Limit:
              limit,

            ExclusiveStartKey:
              exclusiveStartKey,

            ScanIndexForward:
              false,
          })
        );


      const deployments =
        (
          out.Items ||
          []
        ).map(
          platformDeploymentHistorySummary
        );


      return json(
        200,
        {
          ok:
            true,

          filter: {
            platformReleaseId:
              platformReleaseId ||
              null,
          },

          deployments,

          nextToken:
            encodeControlPlaneHistoryNextToken(
              scope,

              out
                .LastEvaluatedKey
            ),
        },
        corsOrigin
      );
    } catch (
      error: any
    ) {
      console.error(
        "Platform Deployment history query failed",
        {
          platformReleaseId:
            platformReleaseId ||
            null,

          error:
            String(
              error?.message ||
                error
            ),
        }
      );


      return json(
        500,
        {
          ok:
            false,

          error:
            "Failed to query Platform Deployment history.",
        },
        corsOrigin
      );
    }
  }

  // -----------------------------
  // GET /usage-epochs/list
  //
  // Owner-only Usage Epoch history.
  //
  // Efficient selectors only:
  //
  //   ?deploymentConfigurationId=...
  //
  // OR
  //
  //   ?state=OPEN|CLOSING|CLOSED
  //
  // When neither selector is supplied, CLOSED is the default.
  //
  // deploymentConfigurationId + state together is intentionally
  // rejected rather than introducing FilterExpression pagination
  // semantics or a table Scan.
  //
  // Optional:
  //   limit=1..100
  //   nextToken=...
  // -----------------------------
  if (
    method ===
      "GET" &&
    path.endsWith(
      "/usage-epochs/list"
    )
  ) {
    const storage =
      requireUsageEpochStorage();


    if (
      !storage.ok
    ) {
      return json(
        storage.status,
        {
          ok:
            false,

          error:
            storage.msg,
        },
        corsOrigin
      );
    }


    let deploymentConfigurationId =
      String(
        event
          .queryStringParameters
          ?.deploymentConfigurationId ||
        ""
      ).trim();

    const requestedState =
      String(
        event
          .queryStringParameters
          ?.state ||
        ""
      )
        .trim()
        .toUpperCase();


    if (
      deploymentConfigurationId &&
      requestedState
    ) {
      return json(
        400,
        {
          ok:
            false,

          error:
            "deploymentConfigurationId and state cannot be combined.",
        },
        corsOrigin
      );
    }


    if (
      deploymentConfigurationId
    ) {
      try {
        deploymentConfigurationId =
          requireControlPlaneId(
            deploymentConfigurationId,
            "deploymentConfigurationId"
          );
      } catch (
        error:
          any
      ) {
        return json(
          400,
          {
            ok:
              false,

            error:
              String(
                error?.message ||
                error
              ),
          },
          corsOrigin
        );
      }
    }


    let state:
      string |
      null =
        null;


    if (
      !deploymentConfigurationId
    ) {
      state =
        requestedState ||
        USAGE_EPOCH_STATE
          .CLOSED;


      if (
        state !==
          USAGE_EPOCH_STATE.OPEN &&
        state !==
          USAGE_EPOCH_STATE.CLOSING &&
        state !==
          USAGE_EPOCH_STATE.CLOSED
      ) {
        return json(
          400,
          {
            ok:
              false,

            error:
              "state must be OPEN, CLOSING, or CLOSED.",
          },
          corsOrigin
        );
      }
    }


    let limit:
      number;


    try {
      limit =
        parseControlPlaneHistoryLimit(
          event
            .queryStringParameters
            ?.limit
        );
    } catch (
      error:
        any
    ) {
      return json(
        400,
        {
          ok:
            false,

          error:
            String(
              error?.message ||
              error
            ),
        },
        corsOrigin
      );
    }


    const byConfiguration =
      Boolean(
        deploymentConfigurationId
      );


    const scope =
      byConfiguration
        ? `usage-epochs:configuration:${deploymentConfigurationId}`
        : `usage-epochs:state:${state}`;


    let exclusiveStartKey:
      any;


    try {
      exclusiveStartKey =
        decodeControlPlaneHistoryNextToken(
          event
            .queryStringParameters
            ?.nextToken,

          scope,

          "Usage Epoch"
        );
    } catch (
      error:
        any
    ) {
      return json(
        400,
        {
          ok:
            false,

          error:
            String(
              error?.message ||
              error
            ),
        },
        corsOrigin
      );
    }


    const indexName =
      byConfiguration
        ? "ByDeploymentConfiguration"
        : "ByState";

    const indexPartitionKey =
      byConfiguration
        ? "gsi1pk"
        : "gsi2pk";

    const indexPartitionValue =
      byConfiguration
        ? createUsageEpochConfigurationIndexPk(
            deploymentConfigurationId
          )
        : createUsageEpochStateIndexPk(
            state!
          );


    try {
      const out =
        await dynamodb.send(
          new QueryCommand({
            TableName:
              USAGE_EPOCHS_TABLE,

            IndexName:
              indexName,

            KeyConditionExpression:
              "#indexPk = :indexPk",

            ExpressionAttributeNames: {
              "#indexPk":
                indexPartitionKey,
            },

            ExpressionAttributeValues: {
              ":indexPk": {
                S:
                  indexPartitionValue,
              },
            },

            Limit:
              limit,

            ExclusiveStartKey:
              exclusiveStartKey,

            ScanIndexForward:
              false,
          })
        );


      const epochs =
        (
          out.Items ||
          []
        ).map(
          usageEpochHistorySummary
        );


      return json(
        200,
        {
          ok:
            true,

          filter: {
            deploymentConfigurationId:
              deploymentConfigurationId ||
              null,

            state:
              state ||
              null,
          },

          order:
            byConfiguration
              ? "startedAtDescending"
              : "stateTimestampDescending",

          epochs,

          nextToken:
            encodeControlPlaneHistoryNextToken(
              scope,

              out
                .LastEvaluatedKey
            ),
        },
        corsOrigin
      );
    } catch (
      error:
        any
    ) {
      console.error(
        "Usage Epoch history query failed",
        {
          deploymentConfigurationId:
            deploymentConfigurationId ||
            null,

          state,

          error:
            String(
              error?.message ||
              error
            ),
        }
      );


      return json(
        500,
        {
          ok:
            false,

          error:
            "Failed to query Usage Epoch history.",
        },
        corsOrigin
      );
    }
  }


  // -----------------------------
  // GET /configuration-analytics-reports/get
  //     ?usageEpochId=...
  //
  // Owner-only immutable historical Analytics report retrieval.
  //
  // Usage Epoch is authoritative:
  //
  //   usageEpochId
  //      -> strong Usage Epoch read
  //      -> verify CLOSED report evidence
  //      -> immutable S3 read
  //      -> verify exact identity/hash/interval binding
  //
  // S3 is never enumerated as a catalog.
  // -----------------------------
  if (
    method ===
      "GET" &&
    path.endsWith(
      "/configuration-analytics-reports/get"
    )
  ) {
    const storage =
      requireUsageEpochStorage();


    if (
      !storage.ok
    ) {
      return json(
        storage.status,
        {
          ok:
            false,

          error:
            storage.msg,
        },
        corsOrigin
      );
    }


    if (
      !CONFIGURATION_ANALYTICS_REPORTS_BUCKET
    ) {
      return json(
        500,
        {
          ok:
            false,

          error:
            "Configuration Analytics Report storage is not configured.",
        },
        corsOrigin
      );
    }


    let usageEpochId:
      string;


    try {
      usageEpochId =
        requireControlPlaneId(
          event
            .queryStringParameters
            ?.usageEpochId,
          "usageEpochId"
        );
    } catch (
      error:
        any
    ) {
      return json(
        400,
        {
          ok:
            false,

          error:
            String(
              error?.message ||
              error
            ),
        },
        corsOrigin
      );
    }


    let epoch:
      any;


    try {
      epoch =
        await readUsageEpochRecord({
          client:
            dynamodb,

          tableName:
            USAGE_EPOCHS_TABLE,

          usageEpochId,
        });
    } catch (
      error:
        any
    ) {
      if (
        isUsageEpochRecordMissing(
          error
        )
      ) {
        return json(
          404,
          {
            ok:
              false,

            error:
              "Usage Epoch not found.",

            usageEpochId,
          },
          corsOrigin
        );
      }


      console.error(
        "Configuration Analytics Report Usage Epoch read failed",
        {
          usageEpochId,

          error:
            String(
              error?.message ||
              error
            ),
        }
      );


      return json(
        500,
        {
          ok:
            false,

          error:
            "Failed to read Usage Epoch.",
        },
        corsOrigin
      );
    }


    if (
      epoch.stage !==
        STAGE
    ) {
      return json(
        500,
        {
          ok:
            false,

          error:
            "Stored Usage Epoch belongs to a different stage.",
        },
        corsOrigin
      );
    }


    if (
      epoch.state !==
        USAGE_EPOCH_STATE
          .CLOSED ||
      !epoch.report
    ) {
      return json(
        409,
        {
          ok:
            false,

          error:
            "Usage Epoch Analytics report is not finalized.",

          usageEpochId,

          state:
            epoch.state,
        },
        corsOrigin
      );
    }


    try {
      const stored =
        await readConfigurationAnalyticsReport({
          client:
            s3,

          bucketName:
            CONFIGURATION_ANALYTICS_REPORTS_BUCKET,

          reportId:
            epoch.report
              .reportId,
        });


      /**
       * CLOSED Usage Epoch metadata is a durable pointer to a report.
       * A missing object is therefore an integrity failure, not a
       * normal user-facing 404.
       */
      if (
        !stored
      ) {
        throw new Error(
          "Finalized Configuration Analytics Report object does not exist."
        );
      }


      assertReportMatchesUsageEpoch({
        epoch,

        stored,
      });


      return json(
        200,
        {
          ok:
            true,

          usageEpoch:
            usageEpochDocumentSummary(
              epoch
            ),

          key:
            stored.key,

          reportSha256:
            stored
              .reportSha256,

          report:
            stored.report,
        },
        corsOrigin
      );
    } catch (
      error:
        any
    ) {
      console.error(
        "Configuration Analytics Report read failed",
        {
          usageEpochId,

          reportId:
            epoch.report
              ?.reportId ||
            null,

          error:
            String(
              error?.message ||
              error
            ),
        }
      );


      return json(
        500,
        {
          ok:
            false,

          error:
            "Failed to read finalized Configuration Analytics Report.",
        },
        corsOrigin
      );
    }
  }


  // -----------------------------
  // POST /platform-deployments/commit
  //
  // Owner-only.
  //
  // body:
  // {
  //   deploymentId,
  //   platformReleaseId,
  //   expectedRevision?   // 0 means "expect no active Platform pointer"
  // }
  //
  // Registration != deployment.
  // Deployment != Profile activation.
  //
  // If an active Profile exists, the immutable Deployment
  // Configuration for the exact Platform/Profile pair must already
  // exist before ACTIVE Platform state can advance.
  // -----------------------------
  if (
    method === "POST" &&
    path.endsWith(
      "/platform-deployments/commit"
    )
  ) {
    const releaseStorage =
      requirePlatformReleaseStorage();


    if (
      !releaseStorage.ok
    ) {
      return json(
        releaseStorage.status,
        {
          ok:
            false,

          error:
            releaseStorage.msg,
        },
        corsOrigin
      );
    }


    const deploymentStorage =
      requirePlatformDeploymentStorage();


    if (
      !deploymentStorage.ok
    ) {
      return json(
        deploymentStorage.status,
        {
          ok:
            false,

          error:
            deploymentStorage.msg,
        },
        corsOrigin
      );
    }


    const profileActivationStorage =
      requireProfileActivationStorage();


    if (
      !profileActivationStorage.ok
    ) {
      return json(
        profileActivationStorage.status,
        {
          ok:
            false,

          error:
            profileActivationStorage.msg,
        },
        corsOrigin
      );
    }

    const usageEpochStorage =
      requireUsageEpochStorage();


    if (
      !usageEpochStorage.ok
    ) {
      return json(
        usageEpochStorage.status,
        {
          ok:
            false,

          error:
            usageEpochStorage.msg,
        },
        corsOrigin
      );
    }


    let payload:
      any = {};


    try {
      payload =
        event.body
          ? JSON.parse(
              event.body
            )
          : {};
    } catch {
      return json(
        400,
        {
          ok:
            false,

          error:
            "Invalid JSON body",
        },
        corsOrigin
      );
    }


    if (
      !payload ||
      typeof payload !==
        "object" ||
      Array.isArray(
        payload
      )
    ) {
      return json(
        400,
        {
          ok:
            false,

          error:
            "Platform Deployment commit body must be an object.",
        },
        corsOrigin
      );
    }


    const allowedKeys =
      new Set([
        "deploymentId",
        "platformReleaseId",
        "expectedRevision",
      ]);


    for (
      const key of
        Object.keys(
          payload
        )
    ) {
      if (
        !allowedKeys.has(
          key
        )
      ) {
        return json(
          400,
          {
            ok:
              false,

            error:
              `Platform Deployment commit body.${key} is not supported.`,
          },
          corsOrigin
        );
      }
    }


    let deploymentId:
      string;

    let platformReleaseId:
      string;


    try {
      deploymentId =
        requireControlPlaneId(
          payload.deploymentId,
          "deploymentId"
        );

      platformReleaseId =
        requireControlPlaneId(
          payload.platformReleaseId,
          "platformReleaseId"
        );

      createPlatformReleaseObjectKey(
        platformReleaseId
      );
    } catch (
      error: any
    ) {
      return json(
        400,
        {
          ok:
            false,

          error:
            String(
              error?.message ||
              error
            ),
        },
        corsOrigin
      );
    }


    let expectedRevision:
      number |
      null =
        null;


    if (
      payload.expectedRevision !==
        undefined &&
      payload.expectedRevision !==
        null
    ) {
      if (
        typeof payload
          .expectedRevision !==
          "number" ||
        !Number.isInteger(
          payload
            .expectedRevision
        ) ||
        payload
          .expectedRevision <
          0
      ) {
        return json(
          400,
          {
            ok:
              false,

            error:
              "expectedRevision must be a non-negative integer.",
          },
          corsOrigin
        );
      }


      expectedRevision =
        payload
          .expectedRevision;
    }


    let releaseRecord:
      Awaited<
        ReturnType<
          typeof loadAuthoritativePlatformReleaseRecord
        >
      >;


    try {
      releaseRecord =
        await loadAuthoritativePlatformReleaseRecord(
          platformReleaseId
        );
    } catch (
      error: any
    ) {
      if (
        isS3NotFound(
          error
        )
      ) {
        return json(
          404,
          {
            ok:
              false,

            error:
              "Platform Release not found.",

            platformReleaseId,
          },
          corsOrigin
        );
      }


      console.error(
        "Platform Deployment release load failed",
        {
          platformReleaseId,

          error:
            String(
              error?.message ||
              error
            ),
        }
      );


      return json(
        500,
        {
          ok:
            false,

          error:
            "Failed to load authoritative Platform Release.",
        },
        corsOrigin
      );
    }


    let currentPlatformPointer:
      any |
      null;


    try {
      currentPlatformPointer =
        await readActivePlatformReleasePointer({
          client:
            dynamodb,

          tableName:
            PLATFORM_DEPLOYMENT_TABLE,
        });
    } catch (
      error: any
    ) {
      console.error(
        "Active Platform pointer read failed",
        {
          error:
            String(
              error?.message ||
              error
            ),
        }
      );


      return json(
        500,
        {
          ok:
            false,

          error:
            "Failed to read active Platform state.",
        },
        corsOrigin
      );
    }


    /**
     * Retry safety for the same deployment occurrence.
     *
     * A workflow retry must not create another deployment occurrence
     * if this exact deploymentId is already the current ACTIVE state.
     */
    if (
      currentPlatformPointer
        ?.deploymentId ===
      deploymentId
    ) {
      if (
        currentPlatformPointer
          .platformReleaseId !==
          platformReleaseId ||
        currentPlatformPointer
          .platformReleaseSha256 !==
          releaseRecord
            .releaseSha256
      ) {
        return json(
          409,
          {
            ok:
              false,

            error:
              "deploymentId already identifies different active Platform state.",
          },
          corsOrigin
        );
      }


      return json(
        200,
        {
          ok:
            true,

          alreadyCommitted:
            true,

          active:
            currentPlatformPointer,
        },
        corsOrigin
      );
    }


    const currentRevision =
      currentPlatformPointer
        ?.revision ??
      0;


    if (
      expectedRevision !==
        null &&
      expectedRevision !==
        currentRevision
    ) {
      return json(
        409,
        {
          ok:
            false,

          error:
            "Platform deployment revision conflict. Refresh active Platform state and retry.",

          expectedRevision,

          currentRevision,
        },
        corsOrigin
      );
    }

    /**
     * A new formal Platform Deployment may only activate a Platform
     * Release that explicitly declares a PPS understood by this
     * control plane.
     *
     * This check intentionally happens AFTER same-deploymentId
     * idempotency handling. Historical already-committed v1
     * occurrences remain safely retryable because no state transition
     * occurs on that path.
     */
    try {
      requireDeclaredProfilePlatformSpecification(
        releaseRecord.release
      );
    } catch (
      error: any
    ) {
      if (
        isProfilePlatformCompatibilityGateError(
          error
        )
      ) {
        return json(
          409,
          profilePlatformGateFailureBody({
            error,

            platformReleaseId,
          }),
          corsOrigin
        );
      }


      console.error(
        "Platform Deployment PPS declaration verification failed",
        {
          platformReleaseId,

          error:
            String(
              error?.message ||
              error
            ),
        }
      );


      return json(
        500,
        {
          ok:
            false,

          error:
            "Failed to verify Platform Release PPS declaration.",
        },
        corsOrigin
      );
    }

    /**
     * Read the exact opposite control-plane pointer that will later
     * be condition-checked inside the Platform deployment transaction.
     */
    let activeProfilePointer:
      any |
      null;


    try {
      activeProfilePointer =
        await readActiveProfilePointer({
          client:
            dynamodb,

          tableName:
            PROFILE_ACTIVATION_TABLE,
        });
    } catch (
      error: any
    ) {
      console.error(
        "Active Profile pointer read for Platform deployment failed",
        {
          error:
            String(
              error?.message ||
              error
            ),
        }
      );


      return json(
        500,
        {
          ok:
            false,

          error:
            "Failed to read active Profile state for Platform deployment.",
        },
        corsOrigin
      );
    }


    let deploymentConfiguration:
      any |
      null =
        null;

    let deploymentConfigurationId:
      string |
      null =
        null;


    if (
      activeProfilePointer
    ) {
      const configurationStorage =
        requireDeploymentConfigurationStorage();


      if (
        !configurationStorage.ok
      ) {
        return json(
          configurationStorage.status,
          {
            ok:
              false,

            error:
              configurationStorage.msg,
          },
          corsOrigin
        );
      }


      try {
        const storedConfiguration =
          await loadDeploymentConfigurationForComposition({
            platformReleaseId,

            profileVariantId:
              activeProfilePointer
                .profileVariantId,

            contentSchemaVersion:
              activeProfilePointer
                .contentSchemaVersion,

            contentHash:
              activeProfilePointer
                .contentHash,
          });

        assertDeclaredProfilePlatformCompatible({
          platformRelease:
            releaseRecord.release,

          deploymentConfiguration:
            storedConfiguration
              .configuration,
        });


        deploymentConfiguration =
          storedConfiguration
            .configuration;

        deploymentConfigurationId =
          deploymentConfiguration
            .deploymentConfigurationId;

      } catch (
        error: any
      ) {
        if (
          isS3NotFound(
            error
          )
        ) {
          return json(
            409,
            {
              ok:
                false,

              error:
                "Deployment Configuration for the requested Platform Release and active Profile does not exist.",

              platformReleaseId,

              profileVariantId:
                activeProfilePointer
                  .profileVariantId,
            },
            corsOrigin
          );
        }

        if (
          isProfilePlatformCompatibilityGateError(
            error
          )
        ) {
          return json(
            409,
            profilePlatformGateFailureBody({
              error,

              platformReleaseId,

              profileVariantId:
                activeProfilePointer
                  .profileVariantId,

              deploymentConfigurationId:
                computeDeploymentConfigurationId({
                  stage:
                    STAGE as
                      | "dev"
                      | "prod",

                  platformReleaseId,

                  profileVariantId:
                    activeProfilePointer
                      .profileVariantId,
                }),
            }),
            corsOrigin
          );
        }


        console.error(
          "Platform Deployment configuration verification failed",
          {
            platformReleaseId,

            profileVariantId:
              activeProfilePointer
                .profileVariantId,

            error:
              String(
                error?.message ||
                error
              ),
          }
        );


        return json(
          500,
          {
            ok:
              false,

            error:
              "Failed to verify Deployment Configuration for Platform deployment.",
          },
          corsOrigin
        );
      }
    }


    const deployedAt =
      new Date()
        .toISOString();


    let transition:
      ReturnType<
        typeof buildPlatformDeploymentTransition
      >;


    try {
      transition =
        buildPlatformDeploymentTransition({
          currentPointer:
            currentPlatformPointer,

          deploymentId,

          platformReleaseId:
            releaseRecord
              .release
              .platformReleaseId,

          deployedAt,

          platformReleaseSha256:
            releaseRecord
              .releaseSha256,
        });
    } catch (
      error: any
    ) {
      return json(
        400,
        {
          ok:
            false,

          error:
            String(
              error?.message ||
              error
            ),
        },
        corsOrigin
      );
    }


    const currentDeploymentConfigurationId =
      currentPlatformPointer &&
      activeProfilePointer
        ? computeDeploymentConfigurationId({
            stage:
              STAGE as
                | "dev"
                | "prod",

            platformReleaseId:
              currentPlatformPointer
                .platformReleaseId,

            profileVariantId:
              activeProfilePointer
                .profileVariantId,
          })
        : null;


    let usageEpochLifecycle:
      Awaited<
        ReturnType<
          typeof prepareUsageEpochLifecycle
        >
      >;


    try {
      usageEpochLifecycle =
        await prepareUsageEpochLifecycle({
          client:
            dynamodb,

          tableName:
            USAGE_EPOCHS_TABLE,

          stage:
            STAGE as
              | "dev"
              | "prod",

          currentDeploymentConfigurationId,

          targetDeploymentConfiguration:
            deploymentConfiguration,

          transitionAt:
            deployedAt,

          transition: {
            kind:
              USAGE_EPOCH_TRANSITION_KIND
                .PLATFORM_DEPLOYMENT,

            occurrenceId:
              deploymentId,
          },
        });
    } catch (
      error: any
    ) {
      console.error(
        "Usage Epoch preparation for Platform deployment failed",
        {
          deploymentId,

          platformReleaseId,

          error:
            String(
              error?.message ||
              error
            ),
        }
      );


      return json(
        500,
        {
          ok:
            false,

          error:
            "Failed to prepare Usage Epoch lifecycle for Platform deployment.",
        },
        corsOrigin
      );
    }


    try {
      await commitPlatformDeploymentTransition({
        client:
          dynamodb,

        tableName:
          PLATFORM_DEPLOYMENT_TABLE,

        transition,

        profileGuard: {
          tableName:
            PROFILE_ACTIVATION_TABLE,

          pointer:
            activeProfilePointer,
        },

        usageEpochLifecycle: {
          tableName:
            USAGE_EPOCHS_TABLE,

          plan:
            usageEpochLifecycle,
        },

      });
    } catch (
      error: any
    ) {
      if (
        isPlatformDeploymentConflict(
          error
        )
      ) {
        return json(
          409,
          {
            ok:
              false,

            error:
              "Platform deployment conflict. Platform, Profile, or Usage Epoch control-plane state changed before commit; refresh and retry.",
          },
          corsOrigin
        );
      }


      console.error(
        "Platform Deployment transaction failed",
        {
          deploymentId,

          platformReleaseId,

          error:
            String(
              error?.message ||
              error
            ),
        }
      );


      return json(
        500,
        {
          ok:
            false,

          error:
            "Failed to commit Platform Deployment.",
        },
        corsOrigin
      );
    }


    return json(
      201,
      {
        ok:
          true,

        alreadyCommitted:
          false,

        deployment:
          transition
            .ledger,

        active:
          transition
            .pointer,

        deploymentConfigurationId,
      },
      corsOrigin
    );
  }


  // -----------------------------
  // POST /profile-variants/activate
  //
  // Owner-only.
  //
  // body:
  // {
  //   profileVariantId,
  //   expectedRevision?   // 0 means "expect no active pointer"
  // }
  //
  // Publish != Activate.
  //
  // Activation never checks out historical code and never
  // redeploys React/CDK. It only atomically changes control-plane
  // state to point at an already-published immutable variant.
  // -----------------------------
  if (
    method === "POST" &&
    path.endsWith(
      "/profile-variants/activate"
    )
  ) {
    const variantStorage =
      requireProfileVariantStorage();

    if (
      !variantStorage.ok
    ) {
      return json(
        variantStorage.status,
        {
          ok:
            false,

          error:
            variantStorage.msg,
        },
        corsOrigin
      );
    }


    const activationStorage =
      requireProfileActivationStorage();

    if (
      !activationStorage.ok
    ) {
      return json(
        activationStorage.status,
        {
          ok:
            false,

          error:
            activationStorage.msg,
        },
        corsOrigin
      );
    }


    const platformDeploymentStorage =
      requirePlatformDeploymentStorage();


    if (
      !platformDeploymentStorage.ok
    ) {
      return json(
        platformDeploymentStorage.status,
        {
          ok:
            false,

          error:
            platformDeploymentStorage.msg,
        },
        corsOrigin
      );
    }

    const usageEpochStorage =
      requireUsageEpochStorage();


    if (
      !usageEpochStorage.ok
    ) {
      return json(
        usageEpochStorage.status,
        {
          ok:
            false,

          error:
            usageEpochStorage.msg,
        },
        corsOrigin
      );
    }


    let payload:
      any = {};


    try {
      payload =
        event.body
          ? JSON.parse(
              event.body
            )
          : {};
    } catch {
      return json(
        400,
        {
          ok:
            false,

          error:
            "Invalid JSON body",
        },
        corsOrigin
      );
    }


    const profileVariantId =
      String(
        payload
          .profileVariantId ||
        ""
      ).trim();


    let manifestKey:
      string;


    try {
      manifestKey =
        createProfileVariantManifestKey(
          profileVariantId
        );
    } catch (
      error: any
    ) {
      return json(
        400,
        {
          ok:
            false,

          error:
            String(
              error?.message ||
              error
            ),
        },
        corsOrigin
      );
    }


    /**
     * Optional owner-side optimistic concurrency token.
     *
     * 0 = caller expects there to be no ACTIVE pointer yet.
     */
    let expectedRevision:
      number | null =
        null;


    if (
      payload.expectedRevision !==
        undefined &&
      payload.expectedRevision !==
        null
    ) {
      if (
        typeof payload
          .expectedRevision !==
          "number" ||
        !Number.isInteger(
          payload
            .expectedRevision
        ) ||
        payload
          .expectedRevision <
          0
      ) {
        return json(
          400,
          {
            ok:
              false,

            error:
              "expectedRevision must be a non-negative integer.",
          },
          corsOrigin
        );
      }


      expectedRevision =
        payload
          .expectedRevision;
    }


    /**
     * The target must already exist as a published immutable
     * Profile Variant.
     */
    let stored:
      Awaited<
        ReturnType<
          typeof readPublishedProfileVariant
        >
      >;


    try {
      stored =
        await readPublishedProfileVariant(
          manifestKey
        );
    } catch (
      error: any
    ) {
      if (
        isS3NotFound(
          error
        )
      ) {
        return json(
          404,
          {
            ok:
              false,

            error:
              "Profile Variant not found.",

            profileVariantId,
          },
          corsOrigin
        );
      }


      console.error(
        "Profile Variant activation read failed",
        {
          profileVariantId,

          manifestKey,

          error:
            String(
              error?.message ||
              error
            ),
        }
      );


      return json(
        500,
        {
          ok:
            false,

          error:
            "Failed to read Profile Variant for activation.",
        },
        corsOrigin
      );
    }


    let parsed:
      any;


    try {
      parsed =
        JSON.parse(
          stored.body
        );
    } catch {
      return json(
        500,
        {
          ok:
            false,

          error:
            "Stored Profile Variant manifest is corrupt.",
        },
        corsOrigin
      );
    }


    let variant:
      any;


    try {
      variant =
        normalizeAndValidateProfileVariantDocument(
          parsed
        );
    } catch (
      error: any
    ) {
      console.error(
        "Profile Variant activation validation failed",
        {
          profileVariantId,

          error:
            String(
              error?.message ||
              error
            ),
        }
      );


      return json(
        500,
        {
          ok:
            false,

          error:
            "Stored Profile Variant failed activation validation.",
        },
        corsOrigin
      );
    }


    /**
     * Verify the exact immutable manifest bytes when S3 exposes
     * its checksum.
     */
    const manifestSha256 =
      sha256Hex(
        stored.body
      );


    const storedManifestSha256 =
      base64Sha256ToHex(
        stored
          .checksumSha256
      );


    if (
      storedManifestSha256 &&
      storedManifestSha256 !==
        manifestSha256
    ) {
      return json(
        500,
        {
          ok:
            false,

          error:
            "Stored Profile Variant checksum verification failed.",
        },
        corsOrigin
      );
    }


    /**
     * Read the opposite Platform control-plane pointer first.
     *
     * The exact state observed here will be condition-checked inside
     * the Profile activation transaction.
     */
    let activePlatformPointer:
      any |
      null;


    try {
      activePlatformPointer =
        await readActivePlatformReleasePointer({
          client:
            dynamodb,

          tableName:
            PLATFORM_DEPLOYMENT_TABLE,
        });
    } catch (
      error: any
    ) {
      console.error(
        "Active Platform pointer read for Profile activation failed",
        {
          error:
            String(
              error?.message ||
              error
            ),
        }
      );


      return json(
        500,
        {
          ok:
            false,

          error:
            "Failed to read active Platform state for Profile activation.",
        },
        corsOrigin
      );
    }

    let deploymentConfiguration:
      any |
      null =
        null;


    if (
      activePlatformPointer
    ) {
      const releaseStorage =
        requirePlatformReleaseStorage();


      if (
        !releaseStorage.ok
      ) {
        return json(
          releaseStorage.status,
          {
            ok:
              false,

            error:
              releaseStorage.msg,
          },
          corsOrigin
        );
      }

      const configurationStorage =
        requireDeploymentConfigurationStorage();


      if (
        !configurationStorage.ok
      ) {
        return json(
          configurationStorage.status,
          {
            ok:
              false,

            error:
              configurationStorage.msg,
          },
          corsOrigin
        );
      }

      let activeReleaseRecord:
        Awaited<
          ReturnType<
            typeof loadAuthoritativePlatformReleaseRecord
          >
        >;


      try {
        activeReleaseRecord =
          await loadAuthoritativePlatformReleaseRecord(
            activePlatformPointer
              .platformReleaseId
          );
      } catch (
        error: any
      ) {
        console.error(
          "Profile activation active Platform Release verification failed",
          {
            platformReleaseId:
              activePlatformPointer
                .platformReleaseId,

            error:
              String(
                error?.message ||
                error
              ),
          }
        );


        return json(
          500,
          {
            ok:
              false,

            error:
              "Failed to verify active Platform Release for Profile activation.",
          },
          corsOrigin
        );
      }


      /**
       * The ACTIVE Platform pointer is bound to exact immutable
       * Platform Release bytes.
       *
       * The later transaction guards this exact pointer. Verify those
       * bytes now before evaluating compatibility.
       */
      if (
        activeReleaseRecord
          .releaseSha256 !==
        activePlatformPointer
          .platformReleaseSha256
      ) {
        return json(
          500,
          {
            ok:
              false,

            error:
              "Active Platform Release checksum does not match the active Platform pointer.",
          },
          corsOrigin
        );
      }


      try {
        requireDeclaredProfilePlatformSpecification(
          activeReleaseRecord.release
        );
      } catch (
        error: any
      ) {
        if (
          isProfilePlatformCompatibilityGateError(
            error
          )
        ) {
          return json(
            409,
            profilePlatformGateFailureBody({
              error,

              platformReleaseId:
                activePlatformPointer
                  .platformReleaseId,

              profileVariantId:
                variant
                  .profileVariantId,
            }),
            corsOrigin
          );
        }


        console.error(
          "Profile activation PPS declaration verification failed",
          {
            platformReleaseId:
              activePlatformPointer
                .platformReleaseId,

            profileVariantId:
              variant
                .profileVariantId,

            error:
              String(
                error?.message ||
                error
              ),
          }
        );


        return json(
          500,
          {
            ok:
              false,

            error:
              "Failed to verify active Platform PPS declaration.",
          },
          corsOrigin
        );
      }


      try {
        const storedConfiguration =
          await loadDeploymentConfigurationForComposition({
            platformReleaseId:
              activePlatformPointer
                .platformReleaseId,

            profileVariantId:
              variant
                .profileVariantId,

            contentSchemaVersion:
              variant
                .contentSchemaVersion,

            contentHash:
              variant
                .contentHash,
          });

        assertDeclaredProfilePlatformCompatible({
          platformRelease:
            activeReleaseRecord.release,

          deploymentConfiguration:
            storedConfiguration
              .configuration,
        });

        deploymentConfiguration =
          storedConfiguration
            .configuration;

      } catch (
        error: any
      ) {
        if (
          isS3NotFound(
            error
          )
        ) {
          return json(
            409,
            {
              ok:
                false,

              error:
                "Deployment Configuration for the active Platform Release and requested Profile Variant does not exist.",

              platformReleaseId:
                activePlatformPointer
                  .platformReleaseId,

              profileVariantId:
                variant
                  .profileVariantId,
            },
            corsOrigin
          );
        }

        if (
          isProfilePlatformCompatibilityGateError(
            error
          )
        ) {
          return json(
            409,
            profilePlatformGateFailureBody({
              error,

              platformReleaseId:
                activePlatformPointer
                  .platformReleaseId,

              profileVariantId:
                variant
                  .profileVariantId,

              deploymentConfigurationId:
                computeDeploymentConfigurationId({
                  stage:
                    STAGE as
                      | "dev"
                      | "prod",

                  platformReleaseId:
                    activePlatformPointer
                      .platformReleaseId,

                  profileVariantId:
                    variant
                      .profileVariantId,
                }),
            }),
            corsOrigin
          );
        }


        console.error(
          "Profile activation configuration verification failed",
          {
            platformReleaseId:
              activePlatformPointer
                .platformReleaseId,

            profileVariantId:
              variant
                .profileVariantId,

            error:
              String(
                error?.message ||
                error
              ),
          }
        );


        return json(
          500,
          {
            ok:
              false,

            error:
              "Failed to verify Deployment Configuration for Profile activation.",
          },
          corsOrigin
        );
      }
    }


    /**
     * Strongly consistent control-plane read.
     */
    let currentPointer:
      any | null;


    try {
      currentPointer =
        await readActiveProfilePointer({
          client:
            dynamodb,

          tableName:
            PROFILE_ACTIVATION_TABLE,
        });
    } catch (
      error: any
    ) {
      console.error(
        "Active Profile pointer read failed",
        {
          error:
            String(
              error?.message ||
              error
            ),
        }
      );


      return json(
        500,
        {
          ok:
            false,

          error:
            "Failed to read active Profile state.",
        },
        corsOrigin
      );
    }


    const currentRevision =
      currentPointer
        ?.revision ??
      0;


    if (
      expectedRevision !==
        null &&
      expectedRevision !==
        currentRevision
    ) {
      return json(
        409,
        {
          ok:
            false,

          error:
            "Profile activation revision conflict. Refresh active Profile state and retry.",

          expectedRevision,

          currentRevision,
        },
        corsOrigin
      );
    }


    /**
     * 4 chars + 32 UUID hex chars = 36 chars.
     *
     * Stable safe ID format:
     * act_0123456789abcdef...
     */
    const activationId =
      `act_${randomUUID()
        .replace(
          /-/g,
          ""
        )}`;


    const activatedAt =
      new Date()
        .toISOString();


    const transition =
      buildProfileActivationTransition({
        currentPointer,

        activationId,

        profileVariantId:
          variant
            .profileVariantId,

        activatedAt,

        contentSchemaVersion:
          variant
            .contentSchemaVersion,

        contentHash:
          variant
            .contentHash,
      });

    const currentDeploymentConfigurationId =
      currentPointer &&
      activePlatformPointer
        ? computeDeploymentConfigurationId({
            stage:
              STAGE as
                | "dev"
                | "prod",

            platformReleaseId:
              activePlatformPointer
                .platformReleaseId,

            profileVariantId:
              currentPointer
                .profileVariantId,
          })
        : null;


    let usageEpochLifecycle:
      Awaited<
        ReturnType<
          typeof prepareUsageEpochLifecycle
        >
      >;


    try {
      usageEpochLifecycle =
        await prepareUsageEpochLifecycle({
          client:
            dynamodb,

          tableName:
            USAGE_EPOCHS_TABLE,

          stage:
            STAGE as
              | "dev"
              | "prod",

          currentDeploymentConfigurationId,

          targetDeploymentConfiguration:
            deploymentConfiguration,

          transitionAt:
            activatedAt,

          transition: {
            kind:
              USAGE_EPOCH_TRANSITION_KIND
                .PROFILE_ACTIVATION,

            occurrenceId:
              activationId,
          },
        });
    } catch (
      error: any
    ) {
      console.error(
        "Usage Epoch preparation for Profile activation failed",
        {
          activationId,

          profileVariantId,

          error:
            String(
              error?.message ||
              error
            ),
        }
      );


      return json(
        500,
        {
          ok:
            false,

          error:
            "Failed to prepare Usage Epoch lifecycle for Profile activation.",
        },
        corsOrigin
      );
    }


    /**
     * Atomic commit:
     *
     * 1. condition-check the exact opposite Platform pointer
     * 2. append immutable activation ledger row
     * 3. replace Profile CONTROL / ACTIVE only if the previously-read
     *    Profile revision/identity still matches
     *
     * If either control-plane state changed, none of the writes commit.
     */
    try {
      await commitProfileActivationTransition({
        client:
          dynamodb,

        tableName:
          PROFILE_ACTIVATION_TABLE,

        transition,

        platformGuard: {
          tableName:
            PLATFORM_DEPLOYMENT_TABLE,

          pointer:
            activePlatformPointer,
        },

        usageEpochLifecycle: {
          tableName:
            USAGE_EPOCHS_TABLE,

          plan:
            usageEpochLifecycle,
        },

      });
    } catch (
      error: any
    ) {
      if (
        isProfileActivationConflict(
          error
        )
      ) {
        return json(
          409,
          {
            ok:
              false,

            error:
              "Profile activation conflict. Profile, Platform, or Usage Epoch control-plane state changed before commit; refresh and retry."
          },
          corsOrigin
        );
      }


      console.error(
        "Profile activation transaction failed",
        {
          profileVariantId,

          activationId,

          error:
            String(
              error?.message ||
              error
            ),
        }
      );


      return json(
        500,
        {
          ok:
            false,

          error:
            "Failed to activate Profile Variant.",
        },
        corsOrigin
      );
    }


    return json(
      201,
      {
        ok:
          true,

        activation:
          transition
            .ledger,

        active:
          transition
            .pointer,

        manifestKey,

        manifestSha256,
      },
      corsOrigin
    );
  }


  // -----------------------------
  // POST /snapshots/presign-put  (SNAPSHOTS BUCKET)
  // -----------------------------
  if (method === "POST" && path.endsWith("/snapshots/presign-put")) {
    let payload: any = {};
    try {
      payload = event.body ? JSON.parse(event.body) : {};
    } catch {
      return json(400, { ok: false, error: "Invalid JSON body" }, corsOrigin);
    }

    const from = safeKeyPart(payload.from || "unknown");
    const to = safeKeyPart(payload.to || "unknown");
    const name = safeKeyPart(payload.name || "analytics");

    const createdAtRaw = String(payload.createdAt || new Date().toISOString());
    const createdAt = safeKeyPart(createdAtRaw).replace(/:/g, "_");

    const key = `${SNAP_PREFIX}${name}/from_${from}_to_${to}/${name}__${from}__${to}__${createdAt}.json`;

    // ✅ extract deploy/meta fields (safe + optional)
    const category = safeKeyPart(payload.category || "");
    const tagKey = safeKeyPart(payload.tagKey || "");
    const tagValue = safeKeyPart(payload.tagValue || "");

    const profileVersionIdRaw = String(payload.profileVersionId || payload.profileVersion || "").trim();
    const gitShaRaw = String(payload.gitSha || "").trim();
    const checkpointTagRaw = String(payload.checkpointTag || "").trim();

    const profileVersionId = safeKeyPart(profileVersionIdRaw || "unknown");
    const gitSha = safeKeyPart(gitShaRaw || "");
    const checkpointTag = safeKeyPart(checkpointTagRaw || "");

    // ✅ repo artifact metadata (Profile tab)
    const repoArtifactKey = safeS3Key(String(payload.repoArtifactKey || "").trim());
    const repoArtifactSha256 = safeKeyPart(String(payload.repoArtifactSha256 || "").trim());

    const geoHint = safeMetaValue(String(payload.geoHint || "").trim(), 180);
    const remark = safeMetaValue(String(payload.remark || "").trim(), 180);

    // ✅ build metadata ONLY with non-empty values
    const metadata: Record<string, string> = {};

    if (category) metadata.category = category;
    if (tagKey) metadata.tagkey = tagKey;
    if (tagValue) metadata.tagvalue = tagValue;

    if (profileVersionId) metadata.profileversionid = profileVersionId;
    if (gitSha) metadata.gitsha = gitSha;
    if (checkpointTag) metadata.checkpointtag = checkpointTag;

    if (repoArtifactKey) metadata.repoartifactkey = repoArtifactKey;
    if (repoArtifactSha256) metadata.repoartifactsha256 = repoArtifactSha256;

    if (geoHint) metadata.geohint = geoHint;
    if (remark) metadata.remark = remark;

    const cmd = new PutObjectCommand({
    Bucket: SNAPSHOTS_BUCKET,
    Key: key,
    ContentType: "application/json",
    Metadata: metadata,
    });

    const url = await getSignedUrl(s3, cmd, { expiresIn: 60 });

    // ✅ REQUIRED HEADERS that MUST be sent by the client
    const requiredHeaders: Record<string, string> = {
    "content-type": "application/json",
    };
    for (const [k, v] of Object.entries(metadata)) {
    requiredHeaders[`x-amz-meta-${k.toLowerCase()}`] = v;
    }

    return json(200, { ok: true, key, url, requiredHeaders }, corsOrigin);

  }

    // -----------------------------
    // POST /snapshots/commit-meta  (SNAPSHOTS BUCKET)
    // body: { key, meta: { ... } }
    // - Sets x-amz-meta-* server-side (avoids presigned header signing problems)
    // - Only allowed for snapshots/* (not trash/*)
    // -----------------------------
    if (method === "POST" && path.endsWith("/snapshots/commit-meta")) {
        let payload: any = {};
        try {
            payload = event.body ? JSON.parse(event.body) : {};
        } catch {
            return json(400, { ok: false, error: "Invalid JSON body" }, corsOrigin);
        }

        const key = normalizeKey(String(payload.key || ""));
        const metaIn = payload.meta || {};

        if (!key) return json(400, { ok: false, error: "key required" }, corsOrigin);
        if (key.startsWith(TRASH_PREFIX)) {
            return json(400, { ok: false, error: "Cannot commit meta in trash. Restore first." }, corsOrigin);
        }
        if (!key.startsWith(SNAP_PREFIX)) {
            return json(400, { ok: false, error: "Invalid key (must start with snapshots/)" }, corsOrigin);
        }

        // Read existing object headers
        let head;
        try {
            head = await s3.send(new HeadObjectCommand({ Bucket: SNAPSHOTS_BUCKET, Key: key }));
        } catch {
            return json(404, { ok: false, error: "Snapshot not found" }, corsOrigin);
        }

        // Existing meta
        const existingMeta = head.Metadata || {};
        const nextMeta: Record<string, string> = { ...existingMeta };

        // Sanitize + apply allowed fields
        const category = safeKeyPart(metaIn.category || "");
        const tagKey = safeKeyPart(metaIn.tagKey || "");
        const tagValue = safeKeyPart(metaIn.tagValue || "");
        const profileVersionId = safeKeyPart(metaIn.profileVersionId || "unknown");

        const platformReleaseId =
          safeKeyPart(
            metaIn
              .platformReleaseId ||
            ""
          );


        const platformDeploymentId =
          safeKeyPart(
            metaIn
              .platformDeploymentId ||
            ""
          );

        const gitSha = safeKeyPart(metaIn.gitSha || "");
        const checkpointTag = safeKeyPart(metaIn.checkpointTag || "");
        const geoHint = safeMetaValue(metaIn.geoHint || "", 180);
        const remark = safeMetaValue(metaIn.remark || "", 500);

        const repoArtifactKey = safeS3Key(metaIn.repoArtifactKey || "");
        const repoArtifactSha256 = safeKeyPart(metaIn.repoArtifactSha256 || "");

        if (category) nextMeta.category = category;
        if (tagKey) nextMeta.tagkey = tagKey;
        if (tagValue) nextMeta.tagvalue = tagValue;

        if (profileVersionId) nextMeta.profileversionid = profileVersionId;

        if (
          platformReleaseId
        ) {
          nextMeta
            .platformreleaseid =
            platformReleaseId;
        }


        if (
          platformDeploymentId
        ) {
          nextMeta
            .platformdeploymentid =
            platformDeploymentId;
        }

        if (gitSha) nextMeta.gitsha = gitSha;
        if (checkpointTag) nextMeta.checkpointtag = checkpointTag;

        if (repoArtifactKey) nextMeta.repoartifactkey = repoArtifactKey;
        if (repoArtifactSha256) nextMeta.repoartifactsha256 = repoArtifactSha256;

        if (geoHint) nextMeta.geohint = geoHint;
        else delete nextMeta.geohint;

        if (remark) nextMeta.remark = remark;
        else delete nextMeta.remark;

        // Copy object onto itself, replacing metadata
        await s3.send(
            new CopyObjectCommand({
            Bucket: SNAPSHOTS_BUCKET,
            Key: key,
            CopySource: encodeCopySource(SNAPSHOTS_BUCKET, key),
            MetadataDirective: "REPLACE",
            Metadata: nextMeta,
            ContentType: head.ContentType || "application/json",
            CacheControl: head.CacheControl,
            ContentDisposition: head.ContentDisposition,
            ContentEncoding: head.ContentEncoding,
            ContentLanguage: head.ContentLanguage,
            Expires: head.Expires,
            })
        );

        return json(200, { ok: true, key, meta: nextMeta }, corsOrigin);
    }


  // -----------------------------
  // POST /repo/presign-put  (REPO BUCKET)
  // -----------------------------
  if (method === "POST" && path.endsWith("/repo/presign-put")) {
    let payload: any = {};
    try {
      payload = event.body ? JSON.parse(event.body) : {};
    } catch {
      return json(400, { ok: false, error: "Invalid JSON body" }, corsOrigin);
    }

    // ✅ profileVersion is required (no "unknown" allowed)
    const pv = requireNonEmpty(payload.profileVersion, "profileVersion");
    if (!pv.ok) return json(pv.status, { ok: false, error: pv.msg }, corsOrigin);

    const profileVersion = safeKeyPart(pv.value);
    if (!profileVersion || profileVersion.toLowerCase() === "unknown") {
      return json(400, { ok: false, error: "profileVersion required" }, corsOrigin);
    }

    // ✅ checkpointTag required (prevents "unknown__..." collisions)
    const ct = requireNonEmpty(payload.checkpointTag, "checkpointTag");
    if (!ct.ok) return json(ct.status, { ok: false, error: ct.msg }, corsOrigin);
    const checkpointTag = safeKeyPart(ct.value);
    if (!checkpointTag || checkpointTag.toLowerCase() === "unknown") {
      return json(400, { ok: false, error: "checkpointTag required" }, corsOrigin);
    }

    // ✅ gitSha required + validate
    const gs = requireNonEmpty(payload.gitSha, "gitSha");
    if (!gs.ok) return json(gs.status, { ok: false, error: gs.msg }, corsOrigin);

    const gitShaRaw = gs.value;
    if (!isLikelyGitSha(gitShaRaw)) {
      return json(400, { ok: false, error: "gitSha is required (7-40 hex chars)" }, corsOrigin);
    }

    const gitSha = safeKeyPart(gitShaRaw);
    const gitShaShort = gitSha.slice(0, 7);

    const key = `${PROFILES_PREFIX}${profileVersion}/repo/${checkpointTag}__${gitShaShort}.zip`;

    // ✅ FORCE content-type (avoid presign/header mismatch)
    const contentType = "application/zip";

    const cmd = new PutObjectCommand({
      Bucket: REPO_BUCKET,
      Key: key,
      ContentType: contentType,
    });

    const url = await getSignedUrl(s3, cmd, { expiresIn: 600 }); // 10 min
    return json(200, { ok: true, bucket: REPO_BUCKET, key, url, contentType }, corsOrigin);
  }

    // -----------------------------
    // GET /repo/presign-get?key=...  (REPO BUCKET)
    // - Allows downloading repo zip via presigned GET
    // - Only for profiles/* or trash/profiles/*
    // -----------------------------
    if (method === "GET" && path.endsWith("/repo/presign-get")) {
    const keyRaw = event.queryStringParameters?.key || "";
    const key = normalizeKey(keyRaw);

    const ok =
        (key && key.startsWith(PROFILES_PREFIX)) ||
        (key && key.startsWith(`trash/${PROFILES_PREFIX}`));

    if (!ok) {
        return json(400, { ok: false, error: "Invalid key (must start with profiles/ or trash/profiles/)" }, corsOrigin);
    }

    const cmd = new GetObjectCommand({
        Bucket: REPO_BUCKET,
        Key: key,
        // optional: forces browser download behavior
        ResponseContentDisposition: `attachment; filename="${basename(key) || "repo.zip"}"`,
        ResponseContentType: "application/zip",
    });

    const url = await getSignedUrl(s3, cmd, { expiresIn: 60 });
    return json(200, { ok: true, bucket: REPO_BUCKET, key, url }, corsOrigin);
    }

  // -----------------------------
  // GET /snapshots/list?scope=trash  (SNAPSHOTS BUCKET)
  // -----------------------------
  if (method === "GET" && path.endsWith("/snapshots/list")) {
    const scope = (event.queryStringParameters?.scope || "").toLowerCase();
    const name = safeKeyPart((event.queryStringParameters?.name || "").trim()); // ci_deploy | analytics
    const basePrefix = scope === "trash" ? TRASH_PREFIX : SNAP_PREFIX;

    const prefix = name ? `${basePrefix}${name}/` : basePrefix;


    const cmd = new ListObjectsV2Command({
      Bucket: SNAPSHOTS_BUCKET,
      Prefix: prefix,
      MaxKeys: 200,
    });

    const res = await s3.send(cmd);

    const contents = (res.Contents || []).filter((o) => o.Key && o.Key.endsWith(".json"));

    // ✅ fetch per-object metadata (headObject)
    const MAX_JSON_BYTES_FOR_FALLBACK = 250_000; // safe guard

    const metaPairs = await Promise.all(
        contents.map(async (o) => {
            const key = o.Key!;
            let head: any = null;

            // 1) HEAD metadata first (fast path)
            try {
            head = await s3.send(new HeadObjectCommand({ Bucket: SNAPSHOTS_BUCKET, Key: key }));
            } catch {
            return [key, null] as const;
            }

            const m = head?.Metadata || {};

            // Build meta from headers first
            const metaFromHead = {
            category: m.category || "",
            tagKey: m.tagkey || "",
            tagValue: m.tagvalue || "",
            geoHint: m.geohint || "",
            profileVersionId: m.profileversionid || "",
            gitSha: m.gitsha || "",
            checkpointTag: m.checkpointtag || "",
            repoArtifactKey:
              m.repoartifactkey ||
              "",

            repoArtifactSha256:
              m.repoartifactsha256 ||
              "",

            platformReleaseId:
              m.platformreleaseid ||
              "",

            platformDeploymentId:
              m.platformdeploymentid ||
              "",

            remark:
              m.remark ||
              "",
            };

            // 2) If important fields missing, fallback to JSON parse (backward compatible)
            const missingImportant =
                !metaFromHead.profileVersionId ||
                metaFromHead.profileVersionId === "unknown" ||
                !metaFromHead.gitSha ||
                !metaFromHead.category ||
                !metaFromHead.checkpointTag ||
                (!metaFromHead.tagKey && !metaFromHead.tagValue) ||
                !metaFromHead.repoArtifactKey;

            const size = o.Size ?? 0;

            if (missingImportant && size > 0 && size <= MAX_JSON_BYTES_FOR_FALLBACK) {
            try {
                const out = await s3.send(
                new GetObjectCommand({ Bucket: SNAPSHOTS_BUCKET, Key: key })
                );
                const body = await streamToString(out.Body);
                const doc = body ? JSON.parse(body) : null;

                if (doc) {
                const derived = extractMetaFromSnapshotJson(doc);

                return [
                    key,
                    {
                    ...metaFromHead,

                    // only fill gaps, don’t overwrite good metadata
                    category: metaFromHead.category || derived.category || "",
                    tagKey: metaFromHead.tagKey || derived.tagKey || "",
                    tagValue: metaFromHead.tagValue || derived.tagValue || "",
                    geoHint: metaFromHead.geoHint || derived.geoHint || "",
                    profileVersionId:
                        metaFromHead.profileVersionId && metaFromHead.profileVersionId !== "unknown"
                        ? metaFromHead.profileVersionId
                        : derived.profileVersionId || metaFromHead.profileVersionId || "",
                    gitSha: metaFromHead.gitSha || derived.gitSha || "",
                    checkpointTag: metaFromHead.checkpointTag || derived.checkpointTag || "",
                    repoArtifactKey:
                      metaFromHead.repoArtifactKey ||
                      derived.repoArtifactKey ||
                      "",

                    repoArtifactSha256:
                      metaFromHead.repoArtifactSha256 ||
                      derived.repoArtifactSha256 ||
                      "",

                    platformReleaseId:
                      metaFromHead.platformReleaseId ||
                      derived.platformReleaseId ||
                      "",

                    platformDeploymentId:
                      metaFromHead.platformDeploymentId ||
                      derived.platformDeploymentId ||
                      "",
                    },
                ] as const;
                }
            } catch {
                // ignore fallback failure; use head meta
            }
            }

            return [key, metaFromHead] as const;
        })
    );

    const metaByKey = new Map(metaPairs);

    const items = contents
    .map((o) => {
        const key = o.Key!;
        const kmeta = tryParseFromKey(key);
        const meta = metaByKey.get(key) || null;

        return {
        key,
        filename: basename(key),
        scope: scope === "trash" ? "trash" : "snapshots",
        name: kmeta.name,
        from: kmeta.from,
        to: kmeta.to,
        createdAt: kmeta.createdAt,
        size: o.Size ?? 0,
        lastModified: o.LastModified ? o.LastModified.toISOString() : null,

        // Existing legacy metadata consumed by the Snapshot UI.
        meta,

        /**
         * P9C:
         *
         * Additive read-only historical classification.
         *
         * Snapshot metadata contains legacy evidence only. No formal
         * identity is inferred from Git SHA/profileVersionId.
         */
        historicalTruth:
          buildLegacySnapshotHistoricalTruth({
            snapshotKey:
              key,

            createdAt:
              kmeta.createdAt,

            meta,
          }),
        };
    })
    .sort((a, b) => (b.lastModified || "").localeCompare(a.lastModified || ""));

    return json(200, { ok: true, items }, corsOrigin);
  }

  // -----------------------------
  // GET /snapshots/presign-get?key=...  (SNAPSHOTS BUCKET)
  // -----------------------------
  if (method === "GET" && path.endsWith("/snapshots/presign-get")) {
    const keyRaw = event.queryStringParameters?.key || "";
    const key = normalizeKey(keyRaw);

    const ok =
      (key && ensurePrefix(key, SNAP_PREFIX)) || (key && ensurePrefix(key, TRASH_PREFIX));

    if (!ok) {
      return json(400, { ok: false, error: "Invalid key" }, corsOrigin);
    }

    const cmd = new GetObjectCommand({
      Bucket: SNAPSHOTS_BUCKET,
      Key: key,
    });

    const url = await getSignedUrl(s3, cmd, { expiresIn: 60 });
    return json(200, { ok: true, key, url }, corsOrigin);
  }

  // -----------------------------
  // POST /snapshots/remark  (SNAPSHOTS BUCKET)
  // body: { key, remark }
  // - Updates x-amz-meta-remark while preserving existing metadata
  // - Only allowed for snapshots/* (not trash/*)
  // -----------------------------
  if (method === "POST" && path.endsWith("/snapshots/remark")) {
    let payload: any = {};
    try {
      payload = event.body ? JSON.parse(event.body) : {};
    } catch {
      return json(400, { ok: false, error: "Invalid JSON body" }, corsOrigin);
    }

    const key = normalizeKey(String(payload.key || ""));
    const remarkRaw = String(payload.remark ?? "");
    const remark = remarkRaw.trim().slice(0, 500);

    // ✅ Explicitly block trash, explicitly allow snapshots
    if (!key) {
      return json(400, { ok: false, error: "key required" }, corsOrigin);
    }
    if (key.startsWith(TRASH_PREFIX)) {
      return json(400, { ok: false, error: "Remark is locked in trash. Restore first." }, corsOrigin);
    }
    if (!key.startsWith(SNAP_PREFIX)) {
      return json(400, { ok: false, error: "Invalid key (must start with snapshots/)" }, corsOrigin);
    }

    let head;
    try {
      head = await s3.send(new HeadObjectCommand({ Bucket: SNAPSHOTS_BUCKET, Key: key }));
    } catch {
      return json(404, { ok: false, error: "Snapshot not found" }, corsOrigin);
    }

    const existingMeta = head.Metadata || {};
    const nextMeta: Record<string, string> = { ...existingMeta };

    if (remark) nextMeta.remark = remark;
    else delete nextMeta.remark;

    await s3.send(
      new CopyObjectCommand({
        Bucket: SNAPSHOTS_BUCKET,
        Key: key,
        CopySource: encodeCopySource(SNAPSHOTS_BUCKET, key),
        MetadataDirective: "REPLACE",
        Metadata: nextMeta,
        ContentType: head.ContentType || "application/json",
        CacheControl: head.CacheControl,
        ContentDisposition: head.ContentDisposition,
        ContentEncoding: head.ContentEncoding,
        ContentLanguage: head.ContentLanguage,
        Expires: head.Expires,
      })
    );

    return json(200, { ok: true, key, remark }, corsOrigin);
  }

  // -----------------------------
  // POST /snapshots/delete (soft delete)  (SNAPSHOTS BUCKET)
  // -----------------------------
  if (method === "POST" && path.endsWith("/snapshots/delete")) {
    let payload: any = {};
    try {
      payload = event.body ? JSON.parse(event.body) : {};
    } catch {
      return json(400, { ok: false, error: "Invalid JSON body" }, corsOrigin);
    }

    const fromKey = normalizeKey(String(payload.key || ""));
    if (!fromKey || !fromKey.startsWith(SNAP_PREFIX)) {
      return json(400, { ok: false, error: "Invalid key (must start with snapshots/)" }, corsOrigin);
    }

    const toKey = moveKey(fromKey, SNAP_PREFIX, TRASH_PREFIX);
    if (!toKey) {
      return json(400, { ok: false, error: "Could not compute trash key" }, corsOrigin);
    }

    // ✅ Read snapshot metadata first (to fetch repoartifactkey)
    let repoArtifactKey = "";
    try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: SNAPSHOTS_BUCKET, Key: fromKey }));
    repoArtifactKey = String(head?.Metadata?.repoartifactkey || "").trim();
    } catch {
    // ignore: snapshot may not exist; copy below will fail anyway and surface error
    }

    // 1) Move snapshot JSON -> trash/
    await s3.send(
    new CopyObjectCommand({
        Bucket: SNAPSHOTS_BUCKET,
        CopySource: encodeCopySource(SNAPSHOTS_BUCKET, fromKey),
        Key: toKey,
        ContentType: "application/json",
        MetadataDirective: "COPY",
    })
    );

    await s3.send(new DeleteObjectCommand({ Bucket: SNAPSHOTS_BUCKET, Key: fromKey }));

    // 2) Move repo artifact zip -> trash/ (best-effort; don't block JSON move)
    // ✅ Only Profile tab deletions should affect repo artifacts
    if (isProfileSnapshotKey(fromKey) && repoArtifactKey) {
    try {
        await moveRepoArtifactToTrash(repoArtifactKey);
    } catch (e) {
        console.log("WARN moveRepoArtifactToTrash failed", {
        fromKey,
        repoArtifactKey,
        err: String((e as any)?.message || e),
        });
    }
    }

    return json(200, { ok: true, fromKey, toKey, repoArtifactKey: repoArtifactKey || null }, corsOrigin);

  }

  // -----------------------------
  // POST /snapshots/restore  (SNAPSHOTS BUCKET)
  // -----------------------------
  if (method === "POST" && path.endsWith("/snapshots/restore")) {
    let payload: any = {};
    try {
      payload = event.body ? JSON.parse(event.body) : {};
    } catch {
      return json(400, { ok: false, error: "Invalid JSON body" }, corsOrigin);
    }

    const fromKey = normalizeKey(String(payload.key || ""));
    if (!fromKey || !fromKey.startsWith(TRASH_PREFIX)) {
      return json(400, { ok: false, error: "Invalid key (must start with trash/)" }, corsOrigin);
    }

    const toKey = moveKey(fromKey, TRASH_PREFIX, SNAP_PREFIX);
    if (!toKey) {
      return json(400, { ok: false, error: "Could not compute restore key" }, corsOrigin);
    }

    // ✅ Read trash snapshot metadata first (to fetch repoartifactkey)
    let repoArtifactKey = "";
    try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: SNAPSHOTS_BUCKET, Key: fromKey }));
    repoArtifactKey = String(head?.Metadata?.repoartifactkey || "").trim();
    } catch {
    // ignore
    }

    // 1) Restore snapshot JSON trash/ -> snapshots/
    await s3.send(
    new CopyObjectCommand({
        Bucket: SNAPSHOTS_BUCKET,
        CopySource: encodeCopySource(SNAPSHOTS_BUCKET, fromKey),
        Key: toKey,
        MetadataDirective: "COPY",
    })
    );

    await s3.send(new DeleteObjectCommand({ Bucket: SNAPSHOTS_BUCKET, Key: fromKey }));

    // 2) Restore repo artifact zip trash/ -> live (best-effort)
    // ✅ Only Profile tab restores should affect repo artifacts
    if (isProfileSnapshotKey(toKey) && repoArtifactKey) {
    try {
        await restoreRepoArtifactFromTrash(repoArtifactKey);
    } catch (e) {
        console.log("WARN restoreRepoArtifactFromTrash failed", {
        toKey,
        repoArtifactKey,
        err: String((e as any)?.message || e),
        });
    }
    }

    return json(200, { ok: true, fromKey, toKey, repoArtifactKey: repoArtifactKey || null }, corsOrigin);

  }

  // -----------------------------
  // POST /snapshots/purge (PERMANENT DELETE)  (SNAPSHOTS BUCKET)
  // - Only allowed for trash/*
  // - Deletes ALL versions + delete markers (bucket is versioned)
  // -----------------------------
  if (method === "POST" && path.endsWith("/snapshots/purge")) {
    let payload: any = {};
    try {
      payload = event.body ? JSON.parse(event.body) : {};
    } catch {
      return json(400, { ok: false, error: "Invalid JSON body" }, corsOrigin);
    }

    const key = normalizeKey(String(payload.key || ""));
    if (!key || !key.startsWith(TRASH_PREFIX)) {
      return json(400, { ok: false, error: "Invalid key (must start with trash/)" }, corsOrigin);
    }

    // ✅ Read trash snapshot metadata first (repoartifactkey) so we can purge the repo zip too
    let repoArtifactKey = "";
    try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: SNAPSHOTS_BUCKET, Key: key }));
    repoArtifactKey = String(head?.Metadata?.repoartifactkey || "").trim();
    } catch {
    // ignore: if snapshot already missing, your purge may return deleted=0 later
    }


    // list all versions + delete markers for this exact key
    const versionsOut = await s3.send(
      new ListObjectVersionsCommand({
        Bucket: SNAPSHOTS_BUCKET,
        Prefix: key,
      })
    );

    const versions = (versionsOut.Versions || [])
      .filter((v) => v.Key === key && v.VersionId)
      .map((v) => ({ Key: key, VersionId: v.VersionId! }));

    const markers = (versionsOut.DeleteMarkers || [])
      .filter((m) => m.Key === key && m.VersionId)
      .map((m) => ({ Key: key, VersionId: m.VersionId! }));

    const objects = [...versions, ...markers];

    if (!objects.length) {
      // already deleted
      return json(200, { ok: true, key, deleted: 0 }, corsOrigin);
    }

    // delete in chunks (S3 limit: 1000)
    let deleted = 0;
    for (let i = 0; i < objects.length; i += 1000) {
      const chunk = objects.slice(i, i + 1000);

      await s3.send(
        new DeleteObjectsCommand({
          Bucket: SNAPSHOTS_BUCKET,
          Delete: { Objects: chunk, Quiet: true },
        })
      );

      deleted += chunk.length;
    }

    // ✅ Purge repo artifact (trash/profiles/...) forever too (best-effort)
    // ✅ Only Profile tab purges should affect repo artifacts
    if (isProfileSnapshotKey(key) && repoArtifactKey) {
    try {
        await purgeRepoArtifactForever(repoArtifactKey);
    } catch (e) {
        console.log("WARN purgeRepoArtifactForever failed", {
        key,
        repoArtifactKey,
        err: String((e as any)?.message || e),
        });
    }
    }

    return json(200, { ok: true, key, deleted, repoArtifactKey: repoArtifactKey || null }, corsOrigin);

  }

    // -----------------------------
    // GET /deploy/history (owner-only)
    // reads s3://SNAPSHOTS_BUCKET/deploy/history.json
    // -----------------------------
    if (method === "GET" && path.endsWith("/deploy/history")) {
    const key = DEPLOY_HISTORY_KEY;

    try {
        const out = await s3.send(
        new GetObjectCommand({
            Bucket: SNAPSHOTS_BUCKET,
            Key: key,
        })
        );

        const body = await streamToString(out.Body);
        const history = body ? JSON.parse(body) : null;

        /**
         * P9C:
         *
         * deploy/history.json remains legacy compatibility storage.
         *
         * We enrich only the in-memory response. The S3 object is
         * never rewritten.
         */
        const enrichedHistory =
          enrichLegacyDeployHistory(
            history
          );

        return json(
          200,
          {
            ok:
              true,

            history:
              enrichedHistory,
          },
          corsOrigin
        );
    } catch (e: any) {
        const name = e?.name || "";
        const msg = String(e?.message || e);

        if (name === "NoSuchKey" || msg.includes("NoSuchKey") || msg.includes("NotFound")) {
        return json(200, { ok: true, history: null }, corsOrigin);
        }

        return json(500, { ok: false, error: "Failed to read deploy history" }, corsOrigin);
    }
    }

  return json(
    404,
    {
      ok:
        false,

      error:
        "Not found",
    },
    corsOrigin
  );
}
