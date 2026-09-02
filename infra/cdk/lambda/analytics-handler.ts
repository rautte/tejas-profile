// lambda/analytics-handler.ts

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

import {
  DynamoDBClient,
  UpdateItemCommand,
  QueryCommand,
  BatchGetItemCommand,
  PutItemCommand,
  GetItemCommand,
} from "@aws-sdk/client-dynamodb";

import {
  marshall,
  unmarshall,
} from "@aws-sdk/util-dynamodb";


import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";


import * as crypto from "node:crypto";

import {
  verifyOwnerSessionToken,
} from "./owner-session-auth";

import {
  projectAnalyticsEventToUsageEpoch,
} from "./usage-epoch-analytics-projection";

import {
  ALLOWED_EVENT_TYPES,
  MAX_EVENT_AGE_MS,
  PUBLIC_SECTION_ORDER,
  PUBLIC_SECTIONS,
  canonicalizeDeepLinkValue,
} from "./analytics-domain";

import {
  ENGAGED_SESSION_ACTIVE_MS,
  ENGAGED_SESSION_EVENT_COUNT,
  MEANINGFUL_SESSION_ACTIVE_MS,
  computeOutreachScoreV1,
} from "./outreach-score-v1";

import {
  TRAFFIC_CLASSIFICATION,
  TRAFFIC_CLASSIFIER_VERSION,
  TRAFFIC_FILTER_ALL,
  classifyTrafficSession,
  deriveUserAgentTrafficEvidence,
  normalizeTrafficClassificationFilter,
  normalizeTrafficEvidence,
  trafficClassificationMatchesFilter,
} from "./traffic-classification";


type APIGatewayV2Event = any;

const s3 =
  new S3Client({});


const ddb =
  new DynamoDBClient({});


const secretsManager =
  new SecretsManagerClient({});

const {
  ANALYTICS_EVENTS_BUCKET =
    "",

  ANALYTICS_TABLE =
    "",

  USAGE_EPOCHS_TABLE =
    "",

  USAGE_EPOCH_ANALYTICS_TABLE =
    "",

  OWNER_TOKEN_SECRET_ID =
    "",

  OWNER_SESSION_SIGNING_KEY_SECRET_ID =
    "",

  ANALYTICS_EDGE_TOKEN_SECRET_ID =
    "",

  ALLOWED_ORIGINS =
    "",

  STAGE =
    "dev",
} = process.env;


// Existing Jest suites use deterministic in-process
// credentials. Production Lambda environments never
// receive these legacy plaintext variables after P10D2.
const TEST_OWNER_TOKEN =
  process.env.NODE_ENV === "test"
    ? String(
        process.env.OWNER_TOKEN ||
        ""
      ).trim()
    : "";


const TEST_OWNER_SESSION_SIGNING_KEY =
  process.env.NODE_ENV ===
    "test"
    ? String(
        process.env
          .OWNER_SESSION_SIGNING_KEY ||
        ""
      ).trim()
    : "";


const TEST_ANALYTICS_EDGE_TOKEN =
  process.env.NODE_ENV === "test"
    ? String(
        process.env
          .ANALYTICS_EDGE_TOKEN ||
        ""
      ).trim()
    : "";


const secretCache =
  new Map<
    string,
    string
  >();

const allowedOrigins = new Set(
  String(ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);

const MAX_EVENTS_PER_BATCH = 50;

const MAX_JOURNEY_EVENTS_PER_FRAGMENT = 100;

const MAX_FUTURE_SKEW_MS =
  5 * 60 * 1000;

const DAY_MS =
  24 * 60 * 60 * 1000;

const DEFAULT_QUERY_DAYS = 7;

// Exact daily-partition querying is excellent for our scale,
// but we intentionally prevent accidental multi-year runaway queries.
//
// Monthly historical rollups can be introduced later if we
// need an effectively-unbounded "All Time" view.
const MAX_QUERY_DAYS = 366;

const QUERY_CONCURRENCY = 10;

const MAX_RECENT_SESSIONS =
  50;

const MAX_RECENT_SESSION_JOURNEY_EVENTS =
  200;

const MAX_TOP_JOURNEY_TRANSITIONS =
  30;

const MAX_TOP_SECTION_PATHS =
  20;

const MAX_BATCH_GET_KEYS = 100;

const VISITOR_QUERY_CONCURRENCY = 8;

const VISITOR_BATCH_GET_RETRIES = 5;

const ANALYTICS_CONTROL_PK =
  "CONTROL#ANALYTICS";

const ANALYTICS_RELEASE_PREFIX =
  "RELEASE#";

const ANALYTICS_BOUNDARY_PREFIX =
  "BOUNDARY#";


const TRAFFIC_SESSION_STATE_SCHEMA_ID =
  "tejas-profile.analytics-traffic-session-state.v1";

const TRAFFIC_SESSION_PK_PREFIX =
  "TRAFFIC_SESSION#";

const TRAFFIC_SESSION_STATE_SK =
  "STATE#v1";


const CONTROL_ID_RE =
  /^[A-Za-z0-9._:-]+$/;


function identityHash(
  kind: "visitor" | "session",
  value: string
) {
  return sha256(`${kind}:${value}`).slice(0, 40);
}

function json(statusCode: number, body: any, extraHeaders: Record<string, string> = {}) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
}

function corsHeaders(origin?: string) {
  const o = origin || "";
  const allow = allowedOrigins.size === 0 || allowedOrigins.has(o) ? o : "";
  return {
    "access-control-allow-origin": allow || (allowedOrigins.size ? [...allowedOrigins][0] : "*"),
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,x-owner-token",
    "vary": "origin",
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


  const leftDigest =
    crypto
      .createHash(
        "sha256"
      )
      .update(
        left,
        "utf8"
      )
      .digest();


  const rightDigest =
    crypto
      .createHash(
        "sha256"
      )
      .update(
        right,
        "utf8"
      )
      .digest();


  return crypto
    .timingSafeEqual(
      leftDigest,
      rightDigest
    );
}


async function readSecretString(
  secretId:
    string,

  label:
    string
) {
  if (
    !secretId
  ) {
    throw new Error(
      `${label} secret id not configured`
    );
  }


  const cached =
    secretCache.get(
      secretId
    );


  if (
    cached
  ) {
    return cached;
  }


  const out =
    await secretsManager.send(
      new GetSecretValueCommand({
        SecretId:
          secretId,
      })
    );


  const value =
    String(
      out.SecretString ||
      ""
    ).trim();


  if (
    !value
  ) {
    throw new Error(
      `${label} secret is empty`
    );
  }


  secretCache.set(
    secretId,
    value
  );


  return value;
}


async function getOwnerToken() {
  if (
    TEST_OWNER_TOKEN
  ) {
    return TEST_OWNER_TOKEN;
  }


  return readSecretString(
    OWNER_TOKEN_SECRET_ID,
    "Owner token"
  );
}

async function getOwnerSessionSigningKey() {
  if (
    TEST_OWNER_SESSION_SIGNING_KEY
  ) {
    return TEST_OWNER_SESSION_SIGNING_KEY;
  }


  return readSecretString(
    OWNER_SESSION_SIGNING_KEY_SECRET_ID,
    "Owner session signing key"
  );
}

async function getAnalyticsEdgeToken() {
  if (
    TEST_ANALYTICS_EDGE_TOKEN
  ) {
    return TEST_ANALYTICS_EDGE_TOKEN;
  }


  return readSecretString(
    ANALYTICS_EDGE_TOKEN_SECRET_ID,
    "Analytics edge token"
  );
}


async function hasValidAnalyticsEdgeCredential(
  headers:
    Record<string, string>
) {
  const candidate =
    safeStr(
      headers[
        "x-analytics-edge-token"
      ] ||
      headers[
        "X-Analytics-Edge-Token"
      ],
      128
    );


  if (!candidate) {
    return false;
  }


  try {
    const expected =
      await getAnalyticsEdgeToken();


    return secretsMatch(
      candidate,
      expected
    );
  } catch (e: any) {
    // Analytics ingestion must fail closed when
    // the edge credential cannot be resolved.
    console.error(
      "Analytics edge authentication failed closed",
      {
        secretConfigured:
          Boolean(
            ANALYTICS_EDGE_TOKEN_SECRET_ID
          ),

        error:
          String(
            e?.message ||
            e
          ),
      }
    );


    return false;
  }
}


async function isOwner(
  headers:
    Record<string, string>
) {
  const candidate =
    String(
      headers[
        "x-owner-token"
      ] ||
      headers[
        "X-Owner-Token"
      ] ||
      ""
    ).trim();


  if (!candidate) {
    return false;
  }


  try {
    const expectedMaster =
      await getOwnerToken();


    // CI / machine callers retain the stage-specific
    // master credential contract.
    if (
      secretsMatch(
        candidate,
        expectedMaster
      )
    ) {
      return true;
    }


    const signingKey =
      await getOwnerSessionSigningKey();


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


    return session.ok;
  } catch (e: any) {
    // Authentication fails closed when runtime
    // credentials cannot be resolved.
    console.error(
      "Owner authentication failed closed",
      {
        ownerSecretConfigured:
          Boolean(
            OWNER_TOKEN_SECRET_ID
          ),

        sessionSecretConfigured:
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


    return false;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function ymd(ts: number) {
  const d = new Date(ts);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function safeStr(x: any, max = 200) {
  return String(x ?? "").trim().slice(0, max);
}

function decodeGeoHeader(
  value: any,
  max = 120
) {
  const raw =
    safeStr(
      value,
      max * 3
    );

  if (!raw) {
    return "";
  }

  try {
    return safeStr(
      decodeURIComponent(raw),
      max
    );
  } catch {
    return safeStr(
      raw,
      max
    );
  }
}

async function getGeoFromHeaders(
  headers:
    Record<string, string>
) {
  // Defense in depth:
  // geo headers are trusted only when the request
  // carries the independently verified CloudFront
  // Analytics edge credential.
  if (
    !(await hasValidAnalyticsEdgeCredential(
      headers
    ))
  ) {
    return {
      countryCode:
        null,

      regionCode:
        null,

      city:
        null,
    };
  }

  const country =
    safeStr(
      headers[
        "cloudfront-viewer-country"
      ] ||
      headers[
        "CloudFront-Viewer-Country"
      ],
      2
    ).toUpperCase();

  const region =
    safeStr(
      headers[
        "cloudfront-viewer-country-region"
      ] ||
      headers[
        "CloudFront-Viewer-Country-Region"
      ],
      8
    ).toUpperCase();

  const city =
    decodeGeoHeader(
      headers[
        "cloudfront-viewer-city"
      ] ||
      headers[
        "CloudFront-Viewer-City"
      ],
      120
    );

  return {
    countryCode:
      /^[A-Z]{2}$/.test(
        country
      )
        ? country
        : null,

    regionCode:
      region || null,

    city:
      city || null,
  };
}

function sha256(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function releaseControlSk(
  profileVersionId: string
) {
  return (
    ANALYTICS_RELEASE_PREFIX +
    sha256(
      profileVersionId
    ).slice(
      0,
      32
    )
  );
}

function boundaryControlSk(
  boundaryId: string
) {
  return (
    ANALYTICS_BOUNDARY_PREFIX +
    sha256(
      boundaryId
    ).slice(
      0,
      32
    )
  );
}

function normalizeControlTimestamp(
  value: any,
  {
    defaultNow = false,
  }: {
    defaultNow?: boolean;
  } = {}
) {
  const raw =
    value == null &&
    defaultNow
      ? Date.now()
      : Number(value);

  if (
    !Number.isFinite(raw) ||
    raw <= 0
  ) {
    return null;
  }

  const ts =
    Math.round(raw);

  if (
    ts >
    Date.now() +
      MAX_FUTURE_SKEW_MS
  ) {
    return null;
  }

  return ts;
}

type AnalyticsBoundaryRecord = {
  boundaryId: string;

  boundaryType:
    | "reset"
    | "deploy";

  effectiveAt: number;

  createdAt:
    string | null;

  profileVersionId:
    string | null;

  note:
    string | null;
};

function normalizeBoundaryRecord(
  item: any
): AnalyticsBoundaryRecord | null {
  const boundaryId =
    safeStr(
      item?.boundaryId,
      120
    );

  const boundaryType =
    safeStr(
      item?.boundaryType,
      20
    ).toLowerCase();

  const effectiveAt =
    Number(
      item?.effectiveAt
    );

  if (
    !boundaryId ||
    (
      boundaryType !== "reset" &&
      boundaryType !== "deploy"
    ) ||
    !Number.isFinite(
      effectiveAt
    )
  ) {
    return null;
  }

  return {
    boundaryId,

    boundaryType,

    effectiveAt,

    createdAt:
      safeStr(
        item?.createdAt,
        80
      ) || null,

    profileVersionId:
      safeStr(
        item?.profileVersionId,
        120
      ) || null,

    note:
      safeStr(
        item?.note,
        240
      ) || null,
  };
}

/**
 * Event schema (client sends batches):
 * {
 *   events: [{
 *     type: "session_start"|"section_view"|"section_time"|"cta_click"|"deep_link"|"project_open"|"code_snippet_view"|...,
 *     ts: number,
 *     sessionId: string,
 *     visitorId: string,
 *     tabId?: string,
 *     profileVersionId: string,
 *     trafficEvidence?: string[],
 *     section?: string,
 *     ctaId?: string,
 *     projectId?: string,
 *     snippetId?: string,
 *     depthPct?: number,
 *     ms?: number,
 *     path?: string,
 *     hash?: string
 *   }]
 * }
 */

async function ensureVisitorFirstSeen(
  event: NonNullable<
    ReturnType<typeof normalizeEvent>
  >
) {
  if (!ANALYTICS_TABLE) return;

  const key = {
    pk: `VISITOR#${event.visitorHash}`,
    sk: "META",
  };

  try {
    await ddb.send(
      new UpdateItemCommand({
        TableName: ANALYTICS_TABLE,

        Key: marshall(key),

        ExpressionAttributeNames: {
          "#visitorHash": "visitorHash",
          "#firstSeenAt": "firstSeenAt",
          "#updatedAt": "updatedAt",
        },

        ExpressionAttributeValues: marshall({
          ":visitorHash": event.visitorHash,
          ":eventTs": event.ts,
          ":now": nowIso(),
        }),

        // Important:
        // - creates firstSeenAt the first time
        // - corrects it if an older event arrives later
        // - does nothing for ordinary later events
        ConditionExpression:
          "attribute_not_exists(#firstSeenAt) " +
          "OR #firstSeenAt > :eventTs",

        UpdateExpression:
          "SET " +
          "#visitorHash = if_not_exists(#visitorHash, :visitorHash), " +
          "#firstSeenAt = :eventTs, " +
          "#updatedAt = :now",
      })
    );
  } catch (e: any) {
    // Normal case for every event after the visitor's earliest event.
    if (
      e?.name ===
      "ConditionalCheckFailedException"
    ) {
      return;
    }

    throw e;
  }
}

function normalizeEvent(e: any) {
  const type = safeStr(e?.type, 64);

  if (!ALLOWED_EVENT_TYPES.has(type)) {
    return null;
  }

  const ts =
    typeof e?.ts === "number"
      ? Math.round(e.ts)
      : Date.now();

  const now = Date.now();

  if (
    ts < now - MAX_EVENT_AGE_MS ||
    ts > now + MAX_FUTURE_SKEW_MS
  ) {
    return null;
  }

  const sessionId =
    safeStr(e?.sessionId, 120);

  const visitorId =
    safeStr(e?.visitorId, 120);

  if (!sessionId || !visitorId) {
    return null;
  }

  const rawProfileVariantId =
    safeStr(
      e?.profileVariantId,
      160
    );

  const profileVariantId =
    rawProfileVariantId &&
    /^[A-Za-z0-9._:-]+$/.test(
      rawProfileVariantId
    )
      ? rawProfileVariantId
      : null;


  const contentSchemaVersion =
    typeof e?.contentSchemaVersion ===
        "number" &&
    Number.isInteger(
      e.contentSchemaVersion
    ) &&
    e.contentSchemaVersion > 0
      ? e.contentSchemaVersion
      : null;


  const profileTargetingLocation =
    safeStr(
      e?.profileTargetingLocation,
      240
    ) || null;


  const profileTargetingJobRole =
    safeStr(
      e?.profileTargetingJobRole,
      240
    ) || null;


  /**
   * P5 will formalize these identity contracts.
   *
   * P4 accepts explicit values only.
   * Never derive either identity from profileVersionId
   * or any Git/build metadata.
   */
  const platformReleaseId =
    safeStr(
      e?.platformReleaseId,
      160
    ) || null;


  const deploymentConfigurationId =
    safeStr(
      e?.deploymentConfigurationId,
      160
    ) || null;


  /**
   * Client traffic evidence is accepted only through the
   * explicit privacy-safe vocabulary.
   *
   * Request-level User-Agent evidence is added later after
   * the trusted Analytics edge boundary has been verified.
   */
  const trafficEvidence =
    normalizeTrafficEvidence(
      e?.trafficEvidence
    );


  let section =
    e?.section
      ? safeStr(e.section, 80)
      : null;

  if (
    section &&
    !PUBLIC_SECTIONS.has(section)
  ) {
    section = null;
  }

  if (
    (
      type === "section_view" ||
      type === "section_time" ||
      type === "scroll_depth"
    ) &&
    !section
  ) {
    return null;
  }

  const normalized = {
    eventId: safeStr(e?.eventId, 160),

    type,
    ts,

    sessionId,
    visitorId,

    visitorHash:
      identityHash("visitor", visitorId),

    sessionHash:
      identityHash("session", sessionId),

    tabId:
      safeStr(e?.tabId, 120) || null,

    profileVersionId:
      safeStr(
        e?.profileVersionId,
        120
      ) || "unknown",


    /**
     * Runtime Profile identity.
     *
     * Optional for backward compatibility with historical
     * and pre-P4 clients.
     */
    profileVariantId,

    contentSchemaVersion,

    profileTargetingLocation,

    profileTargetingJobRole,


    /**
     * Future explicit deployment identities.
     *
     * They remain null until a caller provides a real
     * identity. No legacy derivation is allowed.
     */
    platformReleaseId,

    deploymentConfigurationId,

    trafficEvidence,


    section,

    ctaId:
      e?.ctaId
        ? safeStr(e.ctaId, 80)
        : null,

    projectId:
      e?.projectId
        ? safeStr(e.projectId, 120)
        : null,

    snippetId:
      e?.snippetId
        ? safeStr(e.snippetId, 160)
        : null,

    depthPct:
      typeof e?.depthPct === "number"
        ? Math.max(
            0,
            Math.min(
              100,
              Math.round(e.depthPct)
            )
          )
        : null,

    ms:
      typeof e?.ms === "number"
        ? Math.max(
            0,
            Math.min(
              2 * 60 * 60 * 1000,
              Math.round(e.ms)
            )
          )
        : null,

    path:
      e?.path
        ? (
            type === "deep_link"
              ? canonicalizeDeepLinkValue(
                  e.path
                )
              : safeStr(
                  e.path,
                  240
                )
          ) || null
        : null,

    hash:
      e?.hash
        ? (
            type === "deep_link"
              ? canonicalizeDeepLinkValue(
                  e.hash
                )
              : safeStr(
                  e.hash,
                  240
                )
          ) || null
        : null,
      };

  // Compatibility for a pre-eventId client.
  // Deterministic fingerprint means a retry gets the same ID.
  if (!normalized.eventId) {
    normalized.eventId =
      `legacy_${sha256(
        JSON.stringify([
          normalized.type,
          normalized.ts,
          normalized.sessionId,
          normalized.tabId,

          normalized.profileVersionId,

          normalized.profileVariantId,
          normalized.contentSchemaVersion,
          normalized.profileTargetingLocation,
          normalized.profileTargetingJobRole,
          normalized.platformReleaseId,
          normalized.deploymentConfigurationId,

          normalized.section,
          normalized.ctaId,
          normalized.projectId,
          normalized.snippetId,
          normalized.depthPct,
          normalized.ms,
          normalized.path,
          normalized.hash,
        ])
      ).slice(0, 40)}`;
  }

  return normalized;
}

function buildJourneyToken(
  event: NonNullable<
    ReturnType<
      typeof normalizeEvent
    >
  >
) {
  let kind = "";
  let value = "";

  switch (event.type) {
    case "section_view":
      if (!event.section) {
        return null;
      }

      kind = "section";
      value = event.section;
      break;

    case "cta_click":
      if (!event.ctaId) {
        return null;
      }

      kind = "cta";
      value = event.ctaId;
      break;

    case "project_open":
      if (!event.projectId) {
        return null;
      }

      kind = "project";
      value = event.projectId;
      break;

    case "code_snippet_view":
      if (!event.snippetId) {
        return null;
      }

      kind = "snippet";
      value = event.snippetId;
      break;

    case "deep_link":
      if (
        !event.hash &&
        !event.path
      ) {
        return null;
      }

      kind = "deep_link";

      value =
        event.hash ||
        event.path ||
        "";

      break;

    default:
      return null;
  }

  // StringSet order is intentionally irrelevant.
  //
  // Phase 6C.3 reconstructs chronological order using:
  //   ts ASC
  //   event fingerprint ASC
  //
  // We store only a fingerprint of eventId here to keep
  // each Dynamo value compact.
  const token:
    Record<string, any> = {
      t:
        event.ts,

      i:
        sha256(
          event.eventId
        ).slice(
          0,
          20
        ),

      k:
        kind,

      v:
        value,
    };

  /**
   * Profile Variant identity is optional so historical
   * journey tokens remain fully backward-compatible.
   */
  if (event.profileVariantId) {
    token.p =
      event.profileVariantId;
  }

  return JSON.stringify(
    token
  );
}

function sessionFragmentKey(
  event: NonNullable<
    ReturnType<
      typeof normalizeEvent
    >
  >,
  boundary:
    AnalyticsBoundaryRecord | null
) {
  const pk =
    `DAY#${ymd(
      event.ts
    )}`;

  let sk =
    `PV#${event.profileVersionId}` +
    `#SESSION#${event.sessionHash}`;

  if (boundary) {
    sk +=
      `#BOUNDARY#${boundary.boundaryId}`;
  }

  return {
    pk,
    sk,
  };
}

function trafficSessionStateKey(
  sessionHash:
    string
) {
  return {
    pk:
      `${TRAFFIC_SESSION_PK_PREFIX}${sessionHash}`,

    sk:
      TRAFFIC_SESSION_STATE_SK,
  };
}


function trafficEventFingerprint(
  eventId:
    string
) {
  return sha256(
    `traffic-session-event:${eventId}`
  ).slice(
    0,
    24
  );
}


function buildTrafficSessionStateUpdate(
  event:
    NonNullable<
      ReturnType<
        typeof normalizeEvent
      >
    >
) {
  const names:
    Record<string, string> = {
      "#schemaId":
        "schemaId",

      "#visitorHash":
        "visitorHash",

      "#sessionHash":
        "sessionHash",

      "#processedEventFingerprints":
        "processedEventFingerprints",

      "#eventCount":
        "eventCount",

      "#updatedAt":
        "updatedAt",
  };


  const fingerprint =
    trafficEventFingerprint(
      event.eventId
    );


  const values:
    Record<string, any> = {
      ":schemaId":
        TRAFFIC_SESSION_STATE_SCHEMA_ID,

      ":visitorHash":
        event.visitorHash,

      ":sessionHash":
        event.sessionHash,

      ":fingerprint":
        fingerprint,

      ":fingerprints":
        new Set([
          fingerprint,
        ]),

      ":one":
        1,

      ":now":
        nowIso(),
  };


  const sets = [
    "#schemaId = if_not_exists(#schemaId, :schemaId)",

    "#visitorHash = if_not_exists(#visitorHash, :visitorHash)",

    "#sessionHash = if_not_exists(#sessionHash, :sessionHash)",

    "#updatedAt = :now",
  ];


  const adds = [
    "#processedEventFingerprints :fingerprints",

    "#eventCount :one",
  ];


  if (
    event.type ===
      "section_time" &&
    typeof event.ms ===
      "number" &&
    event.ms >
      0
  ) {
    names[
      "#activeMs"
    ] =
      "activeMs";

    values[
      ":activeMs"
    ] =
      event.ms;

    adds.push(
      "#activeMs :activeMs"
    );
  }


  if (
    event.section
  ) {
    names[
      "#sectionsSeen"
    ] =
      "sectionsSeen";

    values[
      ":sectionsSeen"
    ] =
      new Set([
        event.section,
      ]);

    adds.push(
      "#sectionsSeen :sectionsSeen"
    );
  }


  if (
    buildJourneyToken(
      event
    )
  ) {
    names[
      "#journeyEventCount"
    ] =
      "journeyEventCount";

    adds.push(
      "#journeyEventCount :one"
    );
  }


  if (
    event
      .trafficEvidence
      .length >
    0
  ) {
    names[
      "#trafficEvidence"
    ] =
      "trafficEvidence";

    values[
      ":trafficEvidence"
    ] =
      new Set(
        event
          .trafficEvidence
      );

    adds.push(
      "#trafficEvidence :trafficEvidence"
    );
  }


  return {
    Key:
      marshall(
        trafficSessionStateKey(
          event.sessionHash
        )
      ),

    ExpressionAttributeNames:
      names,

    ExpressionAttributeValues:
      marshall(
        values
      ),

    ConditionExpression:
      "(" +
      "attribute_not_exists(#visitorHash) " +
      "OR #visitorHash = :visitorHash" +
      ") AND (" +
      "attribute_not_exists(#processedEventFingerprints) " +
      "OR NOT contains(" +
      "#processedEventFingerprints, " +
      ":fingerprint)" +
      ")",

    UpdateExpression:
      `SET ${sets.join(", ")} ` +
      `ADD ${adds.join(", ")}`,
  };
}


async function applyEventToTrafficSessionState(
  event:
    NonNullable<
      ReturnType<
        typeof normalizeEvent
      >
    >
) {
  if (
    !ANALYTICS_TABLE
  ) {
    return {
      accepted:
        false,

      duplicate:
        false,
    };
  }


  const update =
    buildTrafficSessionStateUpdate(
      event
    );


  try {
    await ddb.send(
      new UpdateItemCommand({
        TableName:
          ANALYTICS_TABLE,

        ...update,
      })
    );


    return {
      accepted:
        true,

      duplicate:
        false,
    };
  } catch (
    error: any
  ) {
    if (
      error?.name !==
        "ConditionalCheckFailedException"
    ) {
      throw error;
    }


    /**
     * A conditional failure can mean either:
     *
     * 1. normal event retry
     * 2. impossible sessionHash -> multiple visitor mapping
     *
     * Distinguish them explicitly and fail closed on #2.
     */
    const existing =
      await ddb.send(
        new GetItemCommand({
          TableName:
            ANALYTICS_TABLE,

          Key:
            marshall(
              trafficSessionStateKey(
                event.sessionHash
              )
            ),

          ConsistentRead:
            true,
        })
      );


    const item =
      existing.Item
        ? unmarshall(
            existing.Item
          )
        : null;


    if (
      item &&
      safeStr(
        item
          ?.visitorHash,
        80
      ) &&
      safeStr(
        item
          ?.visitorHash,
        80
      ) !==
        event.visitorHash
    ) {
      throw new Error(
        "Analytics logical session maps to multiple visitors."
      );
    }


    const fingerprint =
      trafficEventFingerprint(
        event.eventId
      );


    if (
      stringSetValues(
        item
          ?.processedEventFingerprints
      ).includes(
        fingerprint
      )
    ) {
      return {
        accepted:
          false,

        duplicate:
          true,
      };
    }


    throw new Error(
      "Canonical Analytics traffic session state rejected an event unexpectedly."
    );
  }
}


function buildSessionFragmentInit(
  event: NonNullable<
    ReturnType<
      typeof normalizeEvent
    >
  >,
  geo: {
    countryCode:
      string | null;

    regionCode:
      string | null;

    city:
      string | null;
  },
  boundary:
    AnalyticsBoundaryRecord | null
) {
  const {
    pk,
    sk,
  } =
    sessionFragmentKey(
      event,
      boundary
    );

  const metrics = {
    sectionVisits: {},
    sectionTimeMs: {},
    ctaCounts: {},
    projectOpens: {},
    snippetViews: {},
    deepLinks: {},
  };

  /**
   * Exact Profile Variant metric attribution.
   *
   * This is intentionally separate from the legacy
   * metrics map so historical fragments whose metrics
   * object already exists can be upgraded safely via
   * one top-level if_not_exists initialization.
   */
  const profileVariantMetrics = {
    eventCounts: {},
    activeMs: {},
    sectionVisits: {},
    sectionTimeMs: {},
    ctaCounts: {},
    projectOpens: {},
    snippetViews: {},
    deepLinks: {},
  };

  const names: Record<string, string> = {
    "#visitorHash": "visitorHash",
    "#sessionHash": "sessionHash",
    "#profileVersionId": "profileVersionId",
    "#firstEventAt": "firstEventAt",
    "#lastEventAt": "lastEventAt",
    "#updatedAt": "updatedAt",
    "#metrics": "metrics",
    "#profileVariantMetrics":
      "profileVariantMetrics",
  };

  const values: Record<string, any> = {
    ":visitorHash": event.visitorHash,
    ":sessionHash": event.sessionHash,
    ":profileVersionId":
      event.profileVersionId,
    ":eventTs": event.ts,
    ":now": nowIso(),
    ":metrics": metrics,
    ":profileVariantMetrics":
      profileVariantMetrics,
  };

  const sets = [
    "#visitorHash = if_not_exists(#visitorHash, :visitorHash)",
    "#sessionHash = if_not_exists(#sessionHash, :sessionHash)",
    "#profileVersionId = if_not_exists(#profileVersionId, :profileVersionId)",
    "#firstEventAt = if_not_exists(#firstEventAt, :eventTs)",
    "#lastEventAt = if_not_exists(#lastEventAt, :eventTs)",
    "#updatedAt = if_not_exists(#updatedAt, :now)",
    "#metrics = if_not_exists(#metrics, :metrics)",
    "#profileVariantMetrics = " +
      "if_not_exists(" +
      "#profileVariantMetrics, " +
      ":profileVariantMetrics)",
  ];

  if (geo.countryCode) {
    names["#countryCode"] =
      "countryCode";

    values[":countryCode"] =
      geo.countryCode;

    sets.push(
      "#countryCode = " +
      "if_not_exists(" +
      "#countryCode, :countryCode)"
    );
  }

  if (geo.regionCode) {
    names["#regionCode"] =
      "regionCode";

    values[":regionCode"] =
      geo.regionCode;

    sets.push(
      "#regionCode = " +
      "if_not_exists(" +
      "#regionCode, :regionCode)"
    );
  }

  if (geo.city) {
    names["#city"] =
      "city";

    values[":city"] =
      geo.city;

    sets.push(
      "#city = " +
      "if_not_exists(" +
      "#city, :city)"
    );
  }

  if (boundary) {
    names["#boundaryId"] =
      "boundaryId";

    names["#boundaryType"] =
      "boundaryType";

    names["#boundaryEffectiveAt"] =
      "boundaryEffectiveAt";

    values[":boundaryId"] =
      boundary.boundaryId;

    values[":boundaryType"] =
      boundary.boundaryType;

    values[":boundaryEffectiveAt"] =
      boundary.effectiveAt;

    sets.push(
      "#boundaryId = " +
        "if_not_exists(" +
        "#boundaryId, " +
        ":boundaryId)"
    );

    sets.push(
      "#boundaryType = " +
        "if_not_exists(" +
        "#boundaryType, " +
        ":boundaryType)"
    );

    sets.push(
      "#boundaryEffectiveAt = " +
        "if_not_exists(" +
        "#boundaryEffectiveAt, " +
        ":boundaryEffectiveAt)"
    );
  }

  return {
    Key: marshall({ pk, sk }),

    ExpressionAttributeNames: names,

    ExpressionAttributeValues:
      marshall(values),

    UpdateExpression:
      `SET ${sets.join(", ")}`,
  };
}

function buildSessionEventUpdate(
  event: NonNullable<
    ReturnType<
      typeof normalizeEvent
    >
  >,
  boundary:
    AnalyticsBoundaryRecord | null,
  {
    includeJourney = true,
    markJourneyTruncated = false,
  }: {
    includeJourney?: boolean;
    markJourneyTruncated?: boolean;
  } = {}
) {
  const {
    pk,
    sk,
  } =
    sessionFragmentKey(
      event,
      boundary
    );

  const names: Record<string, string> = {
    "#processedEventIds":
      "processedEventIds",

    "#eventCount":
      "eventCount",

    "#updatedAt":
      "updatedAt",
  };

  const values: Record<string, any> = {
    ":eventId":
      event.eventId,

    ":eventIds":
      new Set([
        event.eventId,
      ]),

    ":one":
      1,

    ":now":
      nowIso(),
  };

  let metricsExpressionReady = false;

  function ensureMetricsExpression() {
    if (metricsExpressionReady) return;

    names["#metrics"] = "metrics";
    values[":zero"] = 0;

    metricsExpressionReady = true;
  }

  const sets: string[] = [
    "#updatedAt = :now",
  ];

  if (markJourneyTruncated) {
    names["#journeyTruncated"] =
      "journeyTruncated";

    values[":journeyTruncated"] =
      true;

    sets.push(
      "#journeyTruncated = :journeyTruncated"
    );
  }

  const adds: string[] = [
    "#processedEventIds :eventIds",
    "#eventCount :one",
  ];


  /**
   * Traffic evidence is a monotonic session-fragment Set.
   *
   * The final classification happens only after all fragments
   * belonging to one logical session have been reconstructed.
   */
  if (
    event
      .trafficEvidence
      .length >
    0
  ) {
    names[
      "#trafficEvidence"
    ] =
      "trafficEvidence";

    values[
      ":trafficEvidence"
    ] =
      new Set(
        event
          .trafficEvidence
      );

    adds.push(
      "#trafficEvidence " +
      ":trafficEvidence"
    );
  }


  const conditions: string[] = [
    "attribute_not_exists(#processedEventIds) " +
    "OR NOT contains(#processedEventIds, :eventId)",
  ];

  const journeyToken =
    includeJourney
      ? buildJourneyToken(event)
      : null;

  if (journeyToken) {
    names["#journeyEvents"] =
      "journeyEvents";

    values[":journeyEvents"] =
      new Set([
        journeyToken,
      ]);

    values[":journeyLimit"] =
      MAX_JOURNEY_EVENTS_PER_FRAGMENT;

    adds.push(
      "#journeyEvents :journeyEvents"
    );

    conditions.push(
      "attribute_not_exists(#journeyEvents) " +
      "OR size(#journeyEvents) < :journeyLimit"
    );
  }

  // Any event with a public section proves this
  // session reached that section.
  if (event.section) {
    names["#sectionsSeen"] =
      "sectionsSeen";

    values[":sectionsSeen"] =
      new Set([event.section]);

    adds.push(
      "#sectionsSeen :sectionsSeen"
    );
  }

  /**
   * Exact section reach for the ACTIVE Profile Variant.
   *
   * JSON tuples avoid delimiter ambiguity while keeping
   * the legacy sectionsSeen set untouched.
   */
  if (
    event.section &&
    event.profileVariantId
  ) {
    names[
      "#profileVariantSectionsSeen"
    ] =
      "profileVariantSectionsSeen";

    values[
      ":profileVariantSectionsSeen"
    ] =
      new Set([
        JSON.stringify([
          event.profileVariantId,
          event.section,
        ]),
      ]);

    adds.push(
      "#profileVariantSectionsSeen " +
      ":profileVariantSectionsSeen"
    );
  }

  /**
   * One logical Analytics session may span multiple
   * ACTIVE Profile Variants.
   *
   * Store identity dimensions as sets rather than
   * scalar session attributes so a mid-session Profile
   * activation never overwrites historical context.
   */
  if (event.profileVariantId) {
    names["#profileVariantIds"] =
      "profileVariantIds";

    values[":profileVariantIds"] =
      new Set([
        event.profileVariantId,
      ]);

    adds.push(
      "#profileVariantIds :profileVariantIds"
    );
  }


  if (
    typeof event.contentSchemaVersion ===
      "number"
  ) {
    names["#contentSchemaVersions"] =
      "contentSchemaVersions";

    values[":contentSchemaVersions"] =
      new Set([
        event.contentSchemaVersion,
      ]);

    adds.push(
      "#contentSchemaVersions :contentSchemaVersions"
    );
  }


  if (
    event.profileTargetingLocation
  ) {
    names["#profileTargetingLocations"] =
      "profileTargetingLocations";

    values[":profileTargetingLocations"] =
      new Set([
        event.profileTargetingLocation,
      ]);

    adds.push(
      "#profileTargetingLocations :profileTargetingLocations"
    );
  }


  if (
    event.profileTargetingJobRole
  ) {
    names["#profileTargetingJobRoles"] =
      "profileTargetingJobRoles";

    values[":profileTargetingJobRoles"] =
      new Set([
        event.profileTargetingJobRole,
      ]);

    adds.push(
      "#profileTargetingJobRoles :profileTargetingJobRoles"
    );
  }


  if (
    event.platformReleaseId
  ) {
    names["#platformReleaseIds"] =
      "platformReleaseIds";

    values[":platformReleaseIds"] =
      new Set([
        event.platformReleaseId,
      ]);

    adds.push(
      "#platformReleaseIds :platformReleaseIds"
    );
  }


  if (
    event.deploymentConfigurationId
  ) {
    names["#deploymentConfigurationIds"] =
      "deploymentConfigurationIds";

    values[":deploymentConfigurationIds"] =
      new Set([
        event.deploymentConfigurationId,
      ]);

    adds.push(
      "#deploymentConfigurationIds :deploymentConfigurationIds"
    );
  }

  /**
   * Preserve the exact association between one ACTIVE
   * Profile Variant and the runtime identity context
   * carried by the same Analytics event.
   *
   * Independent identity sets above remain useful for
   * membership queries, while this tuple prevents
   * cross-product ambiguity when a session fragment
   * contains multiple Profile Variants.
   */
  if (event.profileVariantId) {
    names[
      "#profileVariantContexts"
    ] =
      "profileVariantContexts";

    values[
      ":profileVariantContexts"
    ] =
      new Set([
        JSON.stringify([
          event.profileVariantId,

          event.contentSchemaVersion,

          event.profileTargetingLocation,

          event.profileTargetingJobRole,

          event.platformReleaseId,

          event.deploymentConfigurationId,
        ]),
      ]);

    adds.push(
      "#profileVariantContexts " +
      ":profileVariantContexts"
    );
  }

  function addMetric(
    mapName: string,
    prefix: string,
    key: string,
    amount: number
  ) {
    ensureMetricsExpression();

    const mapAlias =
      `#map_${prefix}`;

    const keyHash =
      sha256(key).slice(0, 12);

    const keyAlias =
      `#key_${prefix}_${keyHash}`;

    const valueAlias =
      `:value_${prefix}_${keyHash}`;

    names[mapAlias] =
      mapName;

    names[keyAlias] =
      key;

    values[valueAlias] =
      amount;

    sets.push(
      `#metrics.${mapAlias}.${keyAlias} = ` +
      `if_not_exists(` +
      `#metrics.${mapAlias}.${keyAlias}, ` +
      `:zero) + ${valueAlias}`
    );
  }

  /**
   * Increment one exact metric bucket for the ACTIVE
   * Profile Variant carried by this event.
   *
   * This participates in the same conditioned
   * UpdateItem as processedEventIds, so legacy and
   * Profile Variant metrics remain atomically
   * idempotent.
   */
  function addProfileVariantMetric(
    mapName: string,
    prefix: string,
    key: string,
    amount: number
  ) {
    if (!event.profileVariantId) {
      return;
    }

    names["#profileVariantMetrics"] =
      "profileVariantMetrics";

    if (
      values[":zero"] ===
      undefined
    ) {
      values[":zero"] =
        0;
    }

    const mapAlias =
      `#pvmap_${prefix}`;

    const keyHash =
      sha256(key).slice(
        0,
        12
      );

    const keyAlias =
      `#pvkey_${prefix}_${keyHash}`;

    const valueAlias =
      `:pvvalue_${prefix}_${keyHash}`;

    names[mapAlias] =
      mapName;

    names[keyAlias] =
      key;

    values[valueAlias] =
      amount;

    sets.push(
      `#profileVariantMetrics.${mapAlias}.${keyAlias} = ` +
      `if_not_exists(` +
      `#profileVariantMetrics.${mapAlias}.${keyAlias}, ` +
      `:zero) + ${valueAlias}`
    );
  }


  function profileVariantDimensionKey(
    value: string
  ) {
    return JSON.stringify([
      event.profileVariantId,
      value,
    ]);
  }


  if (event.profileVariantId) {
    addProfileVariantMetric(
      "eventCounts",
      "event",
      event.profileVariantId,
      1
    );
  }

  if (
    event.type === "section_view" &&
    event.section
  ) {
    addMetric(
      "sectionVisits",
      "sv",
      event.section,
      1
    );

    if (event.profileVariantId) {
      addProfileVariantMetric(
        "sectionVisits",
        "section_view",
        profileVariantDimensionKey(
          event.section
        ),
        1
      );
    }
  }

  if (
    event.type === "section_time" &&
    event.section &&
    typeof event.ms === "number" &&
    event.ms > 0
  ) {
    addMetric(
      "sectionTimeMs",
      "stm",
      event.section,
      event.ms
    );

    names["#activeMs"] =
      "activeMs";

    values[":activeMs"] =
      event.ms;

    adds.push(
      "#activeMs :activeMs"
    );

    if (event.profileVariantId) {
      addProfileVariantMetric(
        "sectionTimeMs",
        "section_time",
        profileVariantDimensionKey(
          event.section
        ),
        event.ms
      );

      addProfileVariantMetric(
        "activeMs",
        "active",
        event.profileVariantId,
        event.ms
      );
    }
  }

  if (
    event.type === "cta_click" &&
    event.ctaId
  ) {
    addMetric(
      "ctaCounts",
      "cta",
      event.ctaId,
      1
    );

    if (event.profileVariantId) {
      addProfileVariantMetric(
        "ctaCounts",
        "cta",
        profileVariantDimensionKey(
          event.ctaId
        ),
        1
      );
    }
  }

  if (
    event.type === "project_open" &&
    event.projectId
  ) {
    addMetric(
      "projectOpens",
      "proj",
      event.projectId,
      1
    );

    if (event.profileVariantId) {
      addProfileVariantMetric(
        "projectOpens",
        "project",
        profileVariantDimensionKey(
          event.projectId
        ),
        1
      );
    }
  }

  if (
    event.type === "code_snippet_view" &&
    event.snippetId
  ) {
    addMetric(
      "snippetViews",
      "snip",
      event.snippetId,
      1
    );

    if (event.profileVariantId) {
      addProfileVariantMetric(
        "snippetViews",
        "snippet",
        profileVariantDimensionKey(
          event.snippetId
        ),
        1
      );
    }
  }

  if (
    event.type === "deep_link" &&
    (event.hash || event.path)
  ) {
    addMetric(
      "deepLinks",
      "dl",
      event.hash || event.path || "",
      1
    );

    if (event.profileVariantId) {
      addProfileVariantMetric(
        "deepLinks",
        "deep_link",
        profileVariantDimensionKey(
          event.hash ||
          event.path ||
          ""
        ),
        1
      );
    }
  }

  if (
    event.type === "scroll_depth" &&
    event.section &&
    typeof event.depthPct === "number"
  ) {
    names["#depthMilestones"] =
      "depthMilestones";

    const token =
      `${event.section}|${event.depthPct}`;

    values[":depthMilestones"] =
      new Set([token]);

    adds.push(
      "#depthMilestones :depthMilestones"
    );


    if (event.profileVariantId) {
      names[
        "#profileVariantDepthMilestones"
      ] =
        "profileVariantDepthMilestones";

      values[
        ":profileVariantDepthMilestones"
      ] =
        new Set([
          JSON.stringify([
            event.profileVariantId,
            event.section,
            event.depthPct,
          ]),
        ]);

      adds.push(
        "#profileVariantDepthMilestones " +
        ":profileVariantDepthMilestones"
      );
    }
  }

  return {
    Key: marshall({ pk, sk }),

    ExpressionAttributeNames: names,

    ExpressionAttributeValues:
      marshall(values),

    ConditionExpression:
      conditions
        .map(
          (condition) =>
            `(${condition})`
        )
        .join(" AND "),

    UpdateExpression:
      `SET ${sets.join(", ")} ` +
      `ADD ${adds.join(", ")}`,
  };
}

async function updateSessionTimestampBounds(
  event: NonNullable<
    ReturnType<
      typeof normalizeEvent
    >
  >,
  boundary:
    AnalyticsBoundaryRecord | null,
  minTs: number,
  maxTs: number
) {
  if (!ANALYTICS_TABLE) {
    return;
  }

  const key =
    sessionFragmentKey(
      event,
      boundary
    );

  // -------------------------
  // Exact firstEventAt = MIN
  // -------------------------

  try {
    await ddb.send(
      new UpdateItemCommand({
        TableName:
          ANALYTICS_TABLE,

        Key:
          marshall(key),

        ExpressionAttributeNames: {
          "#firstEventAt":
            "firstEventAt",

          "#updatedAt":
            "updatedAt",
        },

        ExpressionAttributeValues:
          marshall({
            ":minTs":
              minTs,

            ":now":
              nowIso(),
          }),

        ConditionExpression:
          "attribute_not_exists(#firstEventAt) " +
          "OR #firstEventAt > :minTs",

        UpdateExpression:
          "SET " +
          "#firstEventAt = :minTs, " +
          "#updatedAt = :now",
      })
    );
  } catch (e: any) {
    if (
      e?.name !==
      "ConditionalCheckFailedException"
    ) {
      throw e;
    }
  }

  // -------------------------
  // Exact lastEventAt = MAX
  // -------------------------

  try {
    await ddb.send(
      new UpdateItemCommand({
        TableName:
          ANALYTICS_TABLE,

        Key:
          marshall(key),

        ExpressionAttributeNames: {
          "#lastEventAt":
            "lastEventAt",

          "#updatedAt":
            "updatedAt",
        },

        ExpressionAttributeValues:
          marshall({
            ":maxTs":
              maxTs,

            ":now":
              nowIso(),
          }),

        ConditionExpression:
          "attribute_not_exists(#lastEventAt) " +
          "OR #lastEventAt < :maxTs",

        UpdateExpression:
          "SET " +
          "#lastEventAt = :maxTs, " +
          "#updatedAt = :now",
      })
    );
  } catch (e: any) {
    if (
      e?.name !==
      "ConditionalCheckFailedException"
    ) {
      throw e;
    }
  }
}

async function applyEventToSessionFragment(
  event: NonNullable<
    ReturnType<
      typeof normalizeEvent
    >
  >,
  geo: {
    countryCode:
      string | null;

    regionCode:
      string | null;

    city:
      string | null;
  },
  boundary:
    AnalyticsBoundaryRecord | null
) {
  if (!ANALYTICS_TABLE) {
    return {
      accepted: false,
      duplicate: false,

      journeyRecorded:
        false,

      journeyTruncated:
        false,
    };
  }

  const init =
    buildSessionFragmentInit(
      event,
      geo,
      boundary
    );

  await ddb.send(
    new UpdateItemCommand({
      TableName:
        ANALYTICS_TABLE,
      ...init,
    })
  );

  const journeyToken =
    buildJourneyToken(event);

  const update =
    buildSessionEventUpdate(
      event,
      boundary,
      {
        includeJourney:
          Boolean(
            journeyToken
          ),
      }
    );

  try {
    await ddb.send(
      new UpdateItemCommand({
        TableName:
          ANALYTICS_TABLE,
        ...update,
      })
    );

    return {
      accepted: true,
      duplicate: false,

      journeyRecorded:
        Boolean(
          journeyToken
        ),

      journeyTruncated:
        false,
    };
  } catch (e: any) {
    if (
      e?.name !==
      "ConditionalCheckFailedException"
    ) {
      throw e;
    }

    // For non-journey events, the only relevant conditional
    // failure is normal event-id deduplication.
    if (!journeyToken) {
      return {
        accepted: false,
        duplicate: true,

        journeyRecorded:
          false,

        journeyTruncated:
          false,
      };
    }

    // A journey event can fail the first update for two reasons:
    //
    // 1. event is a duplicate
    // 2. journeyEvents already reached its bounded capacity
    //
    // Retry the SAME event update without the journey token.
    //
    // - duplicate -> dedupe condition fails again
    // - journey full -> metrics/event write succeeds
    //
    // This avoids an extra read while preserving exact
    // event idempotency.
    const fallback =
      buildSessionEventUpdate(
        event,
        boundary,
        {
          includeJourney:
            false,

          markJourneyTruncated:
            true,
        }
      );

    try {
      await ddb.send(
        new UpdateItemCommand({
          TableName:
            ANALYTICS_TABLE,
          ...fallback,
        })
      );

      return {
        accepted: true,
        duplicate: false,

        journeyRecorded:
          false,

        journeyTruncated:
          true,
      };
    } catch (
      fallbackError: any
    ) {
      if (
        fallbackError?.name ===
        "ConditionalCheckFailedException"
      ) {
        return {
          accepted: false,
          duplicate: true,

          journeyRecorded:
            false,

          journeyTruncated:
            false,
        };
      }

      throw fallbackError;
    }
  }
}


async function putRawBatchToS3(
  params: {
    day: string;
    profileVersionId: string;
    owner: boolean;
    geo?: any;
    events: any[];
  }
) {
  if (!ANALYTICS_EVENTS_BUCKET) return;

  const ts = Date.now();
  const key = [
    "analytics-events",
    `day=${params.day}`,
    `pv=${params.profileVersionId || "unknown"}`,
    `owner=${params.owner ? "1" : "0"}`,
    `${ts}-${crypto.randomBytes(6).toString("hex")}.json`,
  ].join("/");

  const body =
    JSON.stringify({
      schema:
        "tejas-profile.analytics.batch.v2",

      receivedAt:
        nowIso(),

      day:
        params.day,

      profileVersionId:
        params.profileVersionId,

      owner:
        params.owner,

      geo:
        params.geo || null,

      events:
        params.events,
    });

  await s3.send(
    new PutObjectCommand({
      Bucket: ANALYTICS_EVENTS_BUCKET,
      Key: key,
      Body: body,
      ContentType: "application/json",
    })
  );

  return key;
}

async function upsertReleaseRecord(
  params: {
    profileVersionId:
      string;

    releasedAt:
      number;

    gitSha?:
      string | null;

    buildTime?:
      string | null;

    note?:
      string | null;

    source?:
      string | null;
  }
) {
  if (!ANALYTICS_TABLE) {
    throw new Error(
      "ANALYTICS_TABLE not configured"
    );
  }

  const profileVersionId =
    safeStr(
      params.profileVersionId,
      120
    );

  if (!profileVersionId) {
    throw new Error(
      "profileVersionId is required"
    );
  }

  const key = {
    pk:
      ANALYTICS_CONTROL_PK,

    sk:
      releaseControlSk(
        profileVersionId
      ),
  };

  const names:
    Record<string, string> = {
      "#kind":
        "kind",

      "#profileVersionId":
        "profileVersionId",

      "#releasedAt":
        "releasedAt",

      "#registeredAt":
        "registeredAt",

      "#updatedAt":
        "updatedAt",

      "#stage":
        "stage",
    };

  const values:
    Record<string, any> = {
      ":kind":
        "release",

      ":profileVersionId":
        profileVersionId,

      ":releasedAt":
        params.releasedAt,

      ":registeredAt":
        nowIso(),

      ":updatedAt":
        nowIso(),

      ":stage":
        STAGE,
    };

  const sets = [
    "#kind = if_not_exists(#kind, :kind)",

    "#profileVersionId = " +
      "if_not_exists(" +
      "#profileVersionId, " +
      ":profileVersionId)",

    "#releasedAt = " +
      "if_not_exists(" +
      "#releasedAt, " +
      ":releasedAt)",

    "#registeredAt = " +
      "if_not_exists(" +
      "#registeredAt, " +
      ":registeredAt)",

    "#updatedAt = :updatedAt",

    "#stage = if_not_exists(" +
      "#stage, :stage)",
  ];

  const gitSha =
    safeStr(
      params.gitSha,
      80
    );

  if (gitSha) {
    names["#gitSha"] =
      "gitSha";

    values[":gitSha"] =
      gitSha;

    sets.push(
      "#gitSha = :gitSha"
    );
  }

  const buildTime =
    safeStr(
      params.buildTime,
      80
    );

  if (buildTime) {
    names["#buildTime"] =
      "buildTime";

    values[":buildTime"] =
      buildTime;

    sets.push(
      "#buildTime = :buildTime"
    );
  }

  const note =
    safeStr(
      params.note,
      240
    );

  if (note) {
    names["#note"] =
      "note";

    values[":note"] =
      note;

    sets.push(
      "#note = :note"
    );
  }

  const source =
    safeStr(
      params.source,
      40
    );

  if (source) {
    names["#source"] =
      "source";

    values[":source"] =
      source;

    sets.push(
      "#source = :source"
    );
  }

  const result =
    await ddb.send(
      new UpdateItemCommand({
        TableName:
          ANALYTICS_TABLE,

        Key:
          marshall(key),

        ExpressionAttributeNames:
          names,

        ExpressionAttributeValues:
          marshall(values),

        UpdateExpression:
          `SET ${sets.join(
            ", "
          )}`,

        ReturnValues:
          "ALL_NEW",
      })
    );

  return result.Attributes
    ? unmarshall(
        result.Attributes
      )
    : null;
}

async function queryAnalyticsControlItems(
  prefix: string
) {
  if (!ANALYTICS_TABLE) {
    throw new Error(
      "ANALYTICS_TABLE not configured"
    );
  }

  const items:
    any[] = [];

  let lastEvaluatedKey:
    | Record<string, any>
    | undefined;

  do {
    const response =
      await ddb.send(
        new QueryCommand({
          TableName:
            ANALYTICS_TABLE,

          KeyConditionExpression:
            "#pk = :pk " +
            "AND begins_with(" +
            "#sk, :prefix)",

          ExpressionAttributeNames: {
            "#pk":
              "pk",

            "#sk":
              "sk",
          },

          ExpressionAttributeValues:
            marshall({
              ":pk":
                ANALYTICS_CONTROL_PK,

              ":prefix":
                prefix,
            }),

          ExclusiveStartKey:
            lastEvaluatedKey,

          ConsistentRead:
            true,
        })
      );

    for (
      const raw of
        response.Items || []
    ) {
      items.push(
        unmarshall(raw)
      );
    }

    lastEvaluatedKey =
      response.LastEvaluatedKey;
  } while (
    lastEvaluatedKey
  );

  return items;
}

async function loadAnalyticsBoundaries() {
  const items =
    await queryAnalyticsControlItems(
      ANALYTICS_BOUNDARY_PREFIX
    );

  return items
    .map(
      normalizeBoundaryRecord
    )
    .filter(
      (
        boundary
      ): boundary is AnalyticsBoundaryRecord =>
        boundary !== null
    );
}

function resolveBoundaryForTimestamp(
  boundaries:
    AnalyticsBoundaryRecord[],
  ts: number
) {
  let best:
    AnalyticsBoundaryRecord | null =
      null;

  for (
    const boundary of
      boundaries
  ) {
    if (
      boundary.effectiveAt >
      ts
    ) {
      continue;
    }

    if (
      !best ||
      boundary.effectiveAt >
        best.effectiveAt ||
      (
        boundary.effectiveAt ===
          best.effectiveAt &&
        boundary.boundaryId.localeCompare(
          best.boundaryId
        ) < 0
      )
    ) {
      best =
        boundary;
    }
  }

  return best;
}

async function getAnalyticsBoundaryById(
  boundaryId: string
) {
  if (!ANALYTICS_TABLE) {
    throw new Error(
      "ANALYTICS_TABLE not configured"
    );
  }

  const cleanId =
    safeStr(
      boundaryId,
      120
    );

  if (!cleanId) {
    return null;
  }

  const result =
    await ddb.send(
      new GetItemCommand({
        TableName:
          ANALYTICS_TABLE,

        Key:
          marshall({
            pk:
              ANALYTICS_CONTROL_PK,

            sk:
              boundaryControlSk(
                cleanId
              ),
          }),

        ConsistentRead:
          true,
      })
    );

  if (!result.Item) {
    return null;
  }

  const boundary =
    normalizeBoundaryRecord(
      unmarshall(
        result.Item
      )
    );

  if (
    !boundary ||
    boundary.boundaryId !==
      cleanId
  ) {
    return null;
  }

  return boundary;
}

function releaseForResponse(
  item: any
) {
  return {
    profileVersionId:
      safeStr(
        item?.profileVersionId,
        120
      ),

    releasedAt:
      Number(
        item?.releasedAt
      ) || null,

    registeredAt:
      safeStr(
        item?.registeredAt,
        80
      ) || null,

    updatedAt:
      safeStr(
        item?.updatedAt,
        80
      ) || null,

    gitSha:
      safeStr(
        item?.gitSha,
        80
      ) || null,

    buildTime:
      safeStr(
        item?.buildTime,
        80
      ) || null,

    note:
      safeStr(
        item?.note,
        240
      ) || null,

    source:
      safeStr(
        item?.source,
        40
      ) || null,
  };
}

function boundaryForResponse(
  item: any
) {
  return {
    boundaryId:
      safeStr(
        item?.boundaryId,
        120
      ),

    type:
      safeStr(
        item?.boundaryType,
        20
      ),

    effectiveAt:
      Number(
        item?.effectiveAt
      ) || null,

    createdAt:
      safeStr(
        item?.createdAt,
        80
      ) || null,

    profileVersionId:
      safeStr(
        item?.profileVersionId,
        120
      ) || null,

    note:
      safeStr(
        item?.note,
        240
      ) || null,
  };
}

async function handleAnalyticsMeta(
  event:
    APIGatewayV2Event
) {
  const origin =
    event.headers?.origin ||
    event.headers?.Origin;

  const headers =
    event.headers || {};

  const cors =
    corsHeaders(origin);

  if (!(await isOwner(headers))) {
    return json(
      401,
      {
        error:
          "Unauthorized",
      },
      cors
    );
  }

  const [
    releaseItems,
    boundaryItems,
  ] =
    await Promise.all([
      queryAnalyticsControlItems(
        ANALYTICS_RELEASE_PREFIX
      ),

      queryAnalyticsControlItems(
        ANALYTICS_BOUNDARY_PREFIX
      ),
    ]);

  const releases =
    releaseItems
      .map(
        releaseForResponse
      )
      .filter(
        (release) =>
          Boolean(
            release
              .profileVersionId
          )
      )
      .sort(
        (a, b) =>
          Number(
            b.releasedAt ||
              0
          ) -
            Number(
              a.releasedAt ||
                0
            ) ||
          a.profileVersionId
            .localeCompare(
              b.profileVersionId
            )
      );

  const boundaries =
    boundaryItems
      .map(
        boundaryForResponse
      )
      .filter(
        (boundary) =>
          Boolean(
            boundary
              .boundaryId
          ) &&
          Number.isFinite(
            boundary
              .effectiveAt
          )
      )
      .sort(
        (a, b) =>
          Number(
            b.effectiveAt ||
              0
          ) -
            Number(
              a.effectiveAt ||
                0
            ) ||
          a.boundaryId
            .localeCompare(
              b.boundaryId
            )
      );

  const now =
    Date.now();

  const currentBoundary =
    boundaries.find(
      (boundary) =>
        Number(
          boundary
            .effectiveAt ||
            0
        ) <= now
    ) || null;

  return json(
    200,
    {
      ok: true,

      schema:
        "tejas-profile.analytics.meta.v1",

      stage:
        STAGE,

      releases,

      boundaries,

      currentBoundary,
    },
    cors
  );
}

async function handleRegisterRelease(
  event:
    APIGatewayV2Event
) {
  const origin =
    event.headers?.origin ||
    event.headers?.Origin;

  const headers =
    event.headers || {};

  const cors =
    corsHeaders(origin);

  if (!(await isOwner(headers))) {
    return json(
      401,
      {
        error:
          "Unauthorized",
      },
      cors
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
        error:
          "Invalid JSON",
      },
      cors
    );
  }

  const profileVersionId =
    safeStr(
      payload
        ?.profileVersionId,
      120
    );

  if (!profileVersionId) {
    return json(
      400,
      {
        error:
          "profileVersionId is required",
      },
      cors
    );
  }

  const releasedAt =
    normalizeControlTimestamp(
      payload
        ?.releasedAt,
      {
        defaultNow:
          true,
      }
    );

  if (
    releasedAt === null
  ) {
    return json(
      400,
      {
        error:
          "Invalid releasedAt timestamp",
      },
      cors
    );
  }

  const item =
    await upsertReleaseRecord(
      {
        profileVersionId,

        releasedAt,

        gitSha:
          safeStr(
            payload
              ?.gitSha,
            80
          ) || null,

        buildTime:
          safeStr(
            payload
              ?.buildTime,
            80
          ) || null,

        note:
          safeStr(
            payload
              ?.note,
            240
          ) || null,

        source:
          safeStr(
            payload
              ?.source,
            40
          ) ||
          "manual",
      }
    );

  return json(
    200,
    {
      ok: true,

      release:
        releaseForResponse(
          item
        ),
    },
    cors
  );
}

async function handleCreateBoundary(
  event:
    APIGatewayV2Event
) {
  const origin =
    event.headers?.origin ||
    event.headers?.Origin;

  const headers =
    event.headers || {};

  const cors =
    corsHeaders(origin);

  if (!(await isOwner(headers))) {
    return json(
      401,
      {
        error:
          "Unauthorized",
      },
      cors
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
        error:
          "Invalid JSON",
      },
      cors
    );
  }

  const boundaryId =
    safeStr(
      payload
        ?.boundaryId,
      120
    );

  if (
    !boundaryId ||
    !CONTROL_ID_RE.test(
      boundaryId
    )
  ) {
    return json(
      400,
      {
        error:
          "boundaryId is required and may contain only letters, numbers, '.', '_', ':', or '-'.",
      },
      cors
    );
  }

  const boundaryType =
    safeStr(
      payload?.type,
      20
    ).toLowerCase();

  if (
    boundaryType !==
      "reset" &&
    boundaryType !==
      "deploy"
  ) {
    return json(
      400,
      {
        error:
          "Boundary type must be 'reset' or 'deploy'.",
      },
      cors
    );
  }

  // Boundaries require an explicit timestamp.
  //
  // This is deliberate: the caller keeps the same timestamp
  // when retrying the same boundary request.
  const effectiveAt =
    normalizeControlTimestamp(
      payload
        ?.effectiveAt
    );

  if (
    effectiveAt === null
  ) {
    return json(
      400,
      {
        error:
          "A valid effectiveAt timestamp is required.",
      },
      cors
    );
  }

  const profileVersionId =
    safeStr(
      payload
        ?.profileVersionId,
      120
    );

  if (
    boundaryType ===
      "deploy" &&
    !profileVersionId
  ) {
    return json(
      400,
      {
        error:
          "profileVersionId is required for a deploy boundary.",
      },
      cors
    );
  }

  const note =
    safeStr(
      payload?.note,
      240
    );

  const key = {
    pk:
      ANALYTICS_CONTROL_PK,

    sk:
      boundaryControlSk(
        boundaryId
      ),
  };

  const boundaryItem = {
    ...key,

    kind:
      "boundary",

    boundaryId,

    boundaryType,

    effectiveAt,

    createdAt:
      nowIso(),

    stage:
      STAGE,

    profileVersionId:
      profileVersionId ||
      null,

    note:
      note ||
      null,
  };

  let created =
    false;

  let storedBoundary:
    any = null;

  try {
    await ddb.send(
      new PutItemCommand({
        TableName:
          ANALYTICS_TABLE,

        Item:
          marshall(
            boundaryItem
          ),

        ExpressionAttributeNames: {
          "#pk":
            "pk",

          "#sk":
            "sk",
        },

        ConditionExpression:
          "attribute_not_exists(#pk) " +
          "AND attribute_not_exists(#sk)",
      })
    );

    created =
      true;

    storedBoundary =
      boundaryItem;
  } catch (e: any) {
    if (
      e?.name !==
      "ConditionalCheckFailedException"
    ) {
      throw e;
    }

    const existingResult =
      await ddb.send(
        new GetItemCommand({
          TableName:
            ANALYTICS_TABLE,

          Key:
            marshall(
              key
            ),

          ConsistentRead:
            true,
        })
      );

    const existing =
      existingResult.Item
        ? unmarshall(
            existingResult.Item
          )
        : null;

    const sameBoundary =
      existing &&
      safeStr(
        existing
          ?.boundaryId,
        120
      ) ===
        boundaryId &&
      safeStr(
        existing
          ?.boundaryType,
        20
      ) ===
        boundaryType &&
      Number(
        existing
          ?.effectiveAt
      ) ===
        effectiveAt &&
      (
        safeStr(
          existing
            ?.profileVersionId,
          120
        ) ||
        ""
      ) ===
        profileVersionId &&
      (
        safeStr(
          existing
            ?.note,
          240
        ) ||
        ""
      ) ===
        note;

    if (!sameBoundary) {
      return json(
        409,
        {
          error:
            "Boundary key already exists with different metadata.",
        },
        cors
      );
    }

    storedBoundary =
      existing;
  }

  // A deploy boundary also establishes its release in the
  // trusted global release catalogue.
  //
  // This happens after boundary idempotency has been resolved.
  // If this write transiently fails, retrying the same boundary
  // safely completes release registration.
  if (
    boundaryType ===
      "deploy"
  ) {
    await upsertReleaseRecord(
      {
        profileVersionId,

        releasedAt:
          effectiveAt,

        gitSha:
          safeStr(
            payload
              ?.gitSha,
            80
          ) || null,

        buildTime:
          safeStr(
            payload
              ?.buildTime,
            80
          ) || null,

        note:
          note ||
          null,

        source:
          "deploy",
      }
    );
  }

  return json(
    created
      ? 201
      : 200,
    {
      ok: true,

      created,

      boundary:
        boundaryForResponse(
          storedBoundary
        ),
    },
    cors
  );
}

async function handleIngest(event: APIGatewayV2Event) {
  const origin = event.headers?.origin || event.headers?.Origin;
  const headers = event.headers || {};
  const cors = corsHeaders(origin);

  if (event.requestContext?.http?.method === "OPTIONS") {
    return { statusCode: 204, headers: cors, body: "" };
  }

  // Public analytics ingestion is edge-only.
  //
  // Browsers send Analytics to CloudFront. CloudFront
  // injects the stage-specific origin credential.
  // Direct API Gateway callers must never bypass this
  // boundary, even when they provide plausible
  // CloudFront geo headers.
  if (
    !(await hasValidAnalyticsEdgeCredential(
      headers
    ))
  ) {
    return json(
      401,
      {
        error:
          "Unauthorized",
      },
      cors
    );
  }

  // Owner traffic is not analytics traffic.
  //
  // Client-side exclusion is the primary mechanism, but this is the
  // server-side safety net. Owner events are neither aggregated nor
  // written to raw analytics storage.
  if (await isOwner(headers)) {
    return {
      statusCode: 204,
      headers: cors,
      body: "",
    };
  }


  /**
   * Reduce User-Agent immediately to coarse evidence.
   *
   * Raw User-Agent is never added to Analytics persistence.
   * Known automation is retained for classification instead
   * of being discarded.
   */
  const requestTrafficEvidence =
    deriveUserAgentTrafficEvidence(
      headers[
        "user-agent"
      ] ||
      headers[
        "User-Agent"
      ]
    );


  const geo =
    await getGeoFromHeaders(
      headers
    );

  let payload: any = {};
  try {
    payload = event.body ? JSON.parse(event.body) : {};
  } catch {
    return json(400, { error: "Invalid JSON" }, cors);
  }

  const rawEvents =
    Array.isArray(payload?.events)
      ? payload.events
      : [];

  if (!rawEvents.length) {
    return json(
      200,
      {
        ok: true,
        accepted: 0,
        duplicates: 0,
      },
      cors
    );
  }

  if (
    rawEvents.length >
    MAX_EVENTS_PER_BATCH
  ) {
    return json(
      400,
      {
        error:
          `Too many events. Max ${MAX_EVENTS_PER_BATCH}.`,
      },
      cors
    );
  }

  // Normalize.
  //
  // Browser evidence and request-level User-Agent evidence
  // are combined only after the trusted edge credential has
  // already been verified.
  const events =
    rawEvents
      .map(
        normalizeEvent
      )
      .filter(
        (
          e:
            ReturnType<
              typeof normalizeEvent
            >
        ): e is NonNullable<
          ReturnType<
            typeof normalizeEvent
          >
        > =>
          e !==
          null
      )
      .map(
        (
          normalizedEvent:
            NonNullable<
              ReturnType<
                typeof normalizeEvent
              >
            >
        ) => ({
          ...normalizedEvent,

          trafficEvidence:
            normalizeTrafficEvidence([
              ...normalizedEvent
                .trafficEvidence,

              ...requestTrafficEvidence,
            ]),
        })
      );

  const rejectedCount =
    rawEvents.length - events.length;

  if (!events.length) {
    return json(
      200,
      {
        ok: true,
        accepted: 0,
        duplicates: 0,
        rejected: rejectedCount,
        rawBatches: [],
      },
      cors
    );
  }

  const boundaries =
    await loadAnalyticsBoundaries();

  let acceptedCount = 0;
  let duplicateCount = 0;

  let journeyRecordedCount = 0;
  let journeyTruncatedCount = 0;

  const fragmentBounds =
    new Map<
      string,
      {
        event:
          NonNullable<
            ReturnType<
              typeof normalizeEvent
            >
          >;

        boundary:
          AnalyticsBoundaryRecord | null;

        minTs:
          number;

        maxTs:
          number;
      }
    >();

  for (
    const analyticsEvent of
      events
  ) {
    const day =
      ymd(
        analyticsEvent.ts
      );

    const boundary =
      resolveBoundaryForTimestamp(
        boundaries,
        analyticsEvent.ts
      );

    const key =
    `${day}::` +
    `${analyticsEvent.profileVersionId}::` +
    `${analyticsEvent.sessionHash}::` +
    `${boundary?.boundaryId || "legacy"}`;

    const existing =
      fragmentBounds.get(
        key
      );

    if (!existing) {
      fragmentBounds.set(
        key,
        {
          event:
            analyticsEvent,

          boundary,

          minTs:
            analyticsEvent.ts,

          maxTs:
            analyticsEvent.ts,
        }
      );

      continue;
    }

    existing.minTs =
      Math.min(
        existing.minTs,
        analyticsEvent.ts
      );

    existing.maxTs =
      Math.max(
        existing.maxTs,
        analyticsEvent.ts
      );
  }

  // One incoming batch normally belongs to a single browser visitor,
  // but the API contract does not rely on that assumption.
  //
  // Keep only the earliest event for each visitor in this batch.
  // Across different batches, ensureVisitorFirstSeen() still uses
  // the atomic "earliest timestamp wins" condition, so delayed or
  // out-of-order batches remain correct.
  const earliestEventByVisitor =
    new Map<
      string,
      NonNullable<
        ReturnType<typeof normalizeEvent>
      >
    >();

  for (const analyticsEvent of events) {
    const existing =
      earliestEventByVisitor.get(
        analyticsEvent.visitorHash
      );

    if (
      !existing ||
      analyticsEvent.ts < existing.ts
    ) {
      earliestEventByVisitor.set(
        analyticsEvent.visitorHash,
        analyticsEvent
      );
    }
  }

  for (
    const visitorEvent of
      earliestEventByVisitor.values()
  ) {
    await ensureVisitorFirstSeen(
      visitorEvent
    );
  }

  // Raw S3 objects are grouped by BOTH day and profile version.
  //
  // Normally a client batch contains one profile version, but grouping
  // correctly here prevents a deploy boundary / queued retry from
  // accidentally putting events under the wrong pv prefix.
  const rawGroups = new Map<
    string,
    {
      day: string;
      profileVersionId: string;
      events: Array<
        NonNullable<
          ReturnType<typeof normalizeEvent>
        >
      >;
    }
  >();

  for (const analyticsEvent of events) {

    const boundary =
      resolveBoundaryForTimestamp(
        boundaries,
        analyticsEvent.ts
      );

    const result =
      await applyEventToSessionFragment(
        analyticsEvent,
        geo,
        boundary
      );


    /**
     * Canonical logical-session traffic state.
     *
     * This is deliberately independent from result.accepted.
     *
     * If the physical fragment succeeded but this write failed,
     * the request retry sees a duplicate fragment while this
     * idempotent state update still gets another chance.
     */
    await applyEventToTrafficSessionState(
      analyticsEvent
    );


    /**
     * Automatic historical archive projection.
     *
     * This is intentionally independent from result.accepted:
     *
     * live write succeeded + projection failed
     *   -> request retries
     *   -> live write becomes duplicate
     *   -> projection still gets another chance
     *
     * Legacy events without complete formal runtime identity continue
     * through the live Analytics path but are not fabricated into a
     * Usage Epoch.
     */
    await projectAnalyticsEventToUsageEpoch({
      client:
        ddb,

      usageEpochTableName:
        USAGE_EPOCHS_TABLE,

      projectionTableName:
        USAGE_EPOCH_ANALYTICS_TABLE,

      stage:
        STAGE,

      event:
        analyticsEvent,

      geo,
    });

    if (result.accepted) {
      acceptedCount += 1;
    }

    if (result.duplicate) {
      duplicateCount += 1;
    }

    if (
      result.journeyRecorded
    ) {
      journeyRecordedCount +=
        1;
    }

    if (
      result.journeyTruncated
    ) {
      journeyTruncatedCount +=
        1;
    }

    const day =
      ymd(analyticsEvent.ts);

    const profileVersionId =
      analyticsEvent.profileVersionId ||
      "unknown";

    const groupKey =
      `${day}::${profileVersionId}`;

    let group =
      rawGroups.get(groupKey);

    if (!group) {
      group = {
        day,
        profileVersionId,
        events: [],
      };

      rawGroups.set(
        groupKey,
        group
      );
    }

    group.events.push(
      analyticsEvent
    );
  }

  for (
    const bounds of
      fragmentBounds.values()
  ) {
    await updateSessionTimestampBounds(
      bounds.event,
      bounds.boundary,
      bounds.minTs,
      bounds.maxTs
    );
  }

  // Raw events are retained for only 30 days and are diagnostic,
  // not the dashboard source of truth.
  //
  // A network retry may create another raw S3 object, which is fine:
  // DynamoDB idempotency prevents those retries from inflating metrics.
  const rawBatches: Array<{
    day: string;
    profileVersionId: string;
    count: number;
    rawKey: string | null;
  }> = [];

  for (const group of rawGroups.values()) {
    const rawKey =
      await putRawBatchToS3({
        day: group.day,

        profileVersionId:
          group.profileVersionId,

        owner: false,

        geo,

        events:
          group.events.map(
            rawEventForStorage
          ),
      });

    rawBatches.push({
      day: group.day,

      profileVersionId:
        group.profileVersionId,

      count:
        group.events.length,

      rawKey:
        rawKey || null,
    });
  }

  return json(
    200,
    {
      ok: true,

      accepted:
        acceptedCount,

      duplicates:
        duplicateCount,

      rejected:
        rejectedCount,

      journeyRecorded:
        journeyRecordedCount,

      journeyTruncated:
        journeyTruncatedCount,

      rawBatches,
    },
    cors
  );
}

function rawEventForStorage(
  event: NonNullable<
    ReturnType<
      typeof normalizeEvent
    >
  >
) {
  return {
    eventId:
      event.eventId,

    type:
      event.type,

    ts:
      event.ts,

    visitorHash:
      event.visitorHash,

    sessionHash:
      event.sessionHash,

    profileVersionId:
      event.profileVersionId,


    /**
     * Runtime Profile identity.
     *
     * These are already normalized by normalizeEvent()
     * before reaching raw storage.
     */
    profileVariantId:
      event.profileVariantId,

    contentSchemaVersion:
      event.contentSchemaVersion,

    profileTargetingLocation:
      event.profileTargetingLocation,

    profileTargetingJobRole:
      event.profileTargetingJobRole,


    /**
     * Future deployment identities are persisted only
     * when explicitly supplied.
     *
     * They are never derived from profileVersionId
     * or Git/build metadata.
     */
    platformReleaseId:
      event.platformReleaseId,

    deploymentConfigurationId:
      event.deploymentConfigurationId,

    /**
     * Privacy-safe classification evidence only.
     * Raw User-Agent and browser identifiers are not persisted.
     */
    trafficEvidence:
      event.trafficEvidence,


    section:
      event.section,

    ctaId:
      event.ctaId,

    projectId:
      event.projectId,

    snippetId:
      event.snippetId,

    depthPct:
      event.depthPct,

    ms:
      event.ms,

    path:
      event.path,

    hash:
      event.hash,
  };
}

function isValidUtcDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const ts =
    Date.parse(`${value}T00:00:00Z`);

  if (!Number.isFinite(ts)) {
    return false;
  }

  return ymd(ts) === value;
}

function shiftUtcDay(
  day: string,
  amount: number
) {
  const ts =
    Date.parse(`${day}T00:00:00Z`);

  return ymd(
    ts + amount * DAY_MS
  );
}

function resolveQueryRange(
  fromInput: string,
  toInput: string
) {
  const today = ymd(Date.now());

  const to =
    toInput || today;

  if (!isValidUtcDay(to)) {
    return {
      ok: false as const,
      error:
        "Invalid 'to' date. Expected YYYY-MM-DD.",
    };
  }

  const from =
    fromInput ||
    shiftUtcDay(
      to,
      -(DEFAULT_QUERY_DAYS - 1)
    );

  if (!isValidUtcDay(from)) {
    return {
      ok: false as const,
      error:
        "Invalid 'from' date. Expected YYYY-MM-DD.",
    };
  }

  const startTs =
    Date.parse(`${from}T00:00:00Z`);

  const endTs =
    Date.parse(`${to}T00:00:00Z`);

  if (startTs > endTs) {
    return {
      ok: false as const,
      error:
        "'from' must be on or before 'to'.",
    };
  }

  const dayCount =
    Math.floor(
      (endTs - startTs) /
        DAY_MS
    ) + 1;

  if (
    dayCount >
    MAX_QUERY_DAYS
  ) {
    return {
      ok: false as const,
      error:
        `Date range too large. Maximum ${MAX_QUERY_DAYS} days.`,
    };
  }

  const days: string[] = [];

  for (
    let ts = startTs;
    ts <= endTs;
    ts += DAY_MS
  ) {
    days.push(ymd(ts));
  }

  return {
    ok: true as const,
    from,
    to,
    days,
  };
}

async function queryDaySessionFragments(
  day: string,
  profileVersionId:
    string | null,
  boundaryFrom:
    AnalyticsBoundaryRecord | null
) {
  if (!ANALYTICS_TABLE) {
    throw new Error(
      "ANALYTICS_TABLE not configured"
    );
  }

  const items: any[] = [];

  let lastEvaluatedKey:
    | Record<string, any>
    | undefined;

  do {
    const names:
      Record<string, string> = {
        "#pk": "pk",
      };

    const values:
      Record<string, any> = {
        ":pk": `DAY#${day}`,
      };

    let keyCondition =
      "#pk = :pk";

    // Specific release.
    //
    // The #SESSION# suffix deliberately excludes the
    // pre-Phase-3 legacy DAY/PV aggregate items.
    if (profileVersionId) {
      names["#sk"] = "sk";

      values[":skPrefix"] =
        `PV#${profileVersionId}` +
        `#SESSION#`;

      keyCondition +=
        " AND begins_with(#sk, :skPrefix)";
    }

    const result =
      await ddb.send(
        new QueryCommand({
          TableName:
            ANALYTICS_TABLE,

          KeyConditionExpression:
            keyCondition,

          ExpressionAttributeNames:
            names,

          ExpressionAttributeValues:
            marshall(values),

          ExclusiveStartKey:
            lastEvaluatedKey,

          // Admin analytics refreshes should immediately reflect
          // successfully written events.
          ConsistentRead: true,
        })
      );

    for (
      const raw of
        result.Items || []
    ) {
      const item =
        unmarshall(raw);

      const sk =
        String(
          item?.sk || ""
        );

      // In "All Releases" mode the partition may still
      // contain legacy DAY/PV rows from earlier development.
      // Only canonical Phase-3 session fragments count.
      if (
        !sk.includes(
          "#SESSION#"
        )
      ) {
        continue;
      }

      if (
        !item?.visitorHash ||
        !item?.sessionHash
      ) {
        continue;
      }

      if (boundaryFrom) {
        const itemBoundaryAt =
          Number(
            item
              ?.boundaryEffectiveAt
          );

        if (
          !Number.isFinite(
            itemBoundaryAt
          ) ||
          itemBoundaryAt <
            boundaryFrom.effectiveAt
        ) {
          continue;
        }
      }

      items.push(item);
    }

    lastEvaluatedKey =
      result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return items;
}

async function queryRangeSessionFragments(
  days: string[],
  profileVersionId: string | null,
  boundaryFrom:
    AnalyticsBoundaryRecord | null
) {
  const byDay =
    new Map<string, any[]>();

  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index =
        nextIndex++;

      if (
        index >= days.length
      ) {
        return;
      }

      const day =
        days[index];

      const items =
        await queryDaySessionFragments(
          day,
          profileVersionId,
          boundaryFrom
        );

      byDay.set(
        day,
        items
      );
    }
  }

  const workerCount =
    Math.min(
      QUERY_CONCURRENCY,
      days.length
    );

  await Promise.all(
    Array.from(
      {
        length:
          workerCount,
      },
      () => worker()
    )
  );

  return byDay;
}

function sleep(ms: number) {
  return new Promise<void>(
    (resolve) =>
      setTimeout(resolve, ms)
  );
}

function collectVisitorHashes(
  byDay: Map<string, any[]>
) {
  const hashes =
    new Set<string>();

  for (
    const items of
      byDay.values()
  ) {
    for (
      const item of items
    ) {
      const visitorHash =
        safeStr(
          item?.visitorHash,
          80
        );

      if (visitorHash) {
        hashes.add(
          visitorHash
        );
      }
    }
  }

  return [...hashes];
}

async function batchGetVisitorFirstSeen(
  visitorHashes: string[]
) {
  const result =
    new Map<string, number>();

  if (
    !ANALYTICS_TABLE ||
    visitorHashes.length === 0
  ) {
    return result;
  }

  let pendingKeys =
    visitorHashes.map(
      (visitorHash) =>
        marshall({
          pk:
            `VISITOR#${visitorHash}`,
          sk: "META",
        })
    );

  for (
    let attempt = 0;
    attempt <
      VISITOR_BATCH_GET_RETRIES &&
    pendingKeys.length > 0;
    attempt += 1
  ) {
    const response =
      await ddb.send(
        new BatchGetItemCommand({
          RequestItems: {
            [ANALYTICS_TABLE]: {
              Keys:
                pendingKeys,

              ConsistentRead:
                true,

              ProjectionExpression:
                "#visitorHash, #firstSeenAt",

              ExpressionAttributeNames:
                {
                  "#visitorHash":
                    "visitorHash",

                  "#firstSeenAt":
                    "firstSeenAt",
                },
            },
          },
        })
      );

    const rawItems =
      response.Responses?.[
        ANALYTICS_TABLE
      ] || [];

    for (
      const raw of rawItems
    ) {
      const item =
        unmarshall(raw);

      const visitorHash =
        safeStr(
          item?.visitorHash,
          80
        );

      const firstSeenAt =
        Number(
          item?.firstSeenAt
        );

      if (
        visitorHash &&
        Number.isFinite(
          firstSeenAt
        )
      ) {
        result.set(
          visitorHash,
          firstSeenAt
        );
      }
    }

    pendingKeys =
      response.UnprocessedKeys?.[
        ANALYTICS_TABLE
      ]?.Keys || [];

    if (
      pendingKeys.length > 0
    ) {
      await sleep(
        25 *
          Math.pow(
            2,
            attempt
          )
      );
    }
  }

  // Do not silently classify visitors incorrectly if Dynamo
  // failed to return metadata after retries.
  if (
    pendingKeys.length > 0
  ) {
    throw new Error(
      "Unable to load all visitor metadata after retries."
    );
  }

  return result;
}

async function queryVisitorFirstSeen(
  visitorHashes: string[]
) {
  const combined =
    new Map<string, number>();

  if (
    visitorHashes.length === 0
  ) {
    return combined;
  }

  const chunks:
    string[][] = [];

  for (
    let i = 0;
    i <
      visitorHashes.length;
    i += MAX_BATCH_GET_KEYS
  ) {
    chunks.push(
      visitorHashes.slice(
        i,
        i +
          MAX_BATCH_GET_KEYS
      )
    );
  }

  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index =
        nextIndex++;

      if (
        index >=
        chunks.length
      ) {
        return;
      }

      const values =
        await batchGetVisitorFirstSeen(
          chunks[index]
        );

      for (
        const [
          visitorHash,
          firstSeenAt,
        ] of values.entries()
      ) {
        combined.set(
          visitorHash,
          firstSeenAt
        );
      }
    }
  }

  const workerCount =
    Math.min(
      VISITOR_QUERY_CONCURRENCY,
      chunks.length
    );

  await Promise.all(
    Array.from(
      {
        length:
          workerCount,
      },
      () => worker()
    )
  );

  return combined;
}

async function queryTrafficSessionStates(
  sessionHashes:
    string[]
) {
  const output =
    new Map<
      string,
      any
    >();


  if (
    !ANALYTICS_TABLE ||
    sessionHashes.length ===
      0
  ) {
    return output;
  }


  const chunks:
    string[][] = [];


  for (
    let index = 0;
    index <
      sessionHashes.length;
    index +=
      MAX_BATCH_GET_KEYS
  ) {
    chunks.push(
      sessionHashes.slice(
        index,
        index +
          MAX_BATCH_GET_KEYS
      )
    );
  }


  for (
    const chunk of
      chunks
  ) {
    let pendingKeys =
      chunk.map(
        (
          sessionHash
        ) =>
          marshall(
            trafficSessionStateKey(
              sessionHash
            )
          )
      );


    for (
      let attempt = 0;
      attempt <
        VISITOR_BATCH_GET_RETRIES &&
      pendingKeys.length >
        0;
      attempt +=
        1
    ) {
      const response =
        await ddb.send(
          new BatchGetItemCommand({
            RequestItems: {
              [ANALYTICS_TABLE]: {
                Keys:
                  pendingKeys,

                ConsistentRead:
                  true,

                ProjectionExpression:
                  "#schemaId, " +
                  "#sessionHash, " +
                  "#visitorHash, " +
                  "#eventCount, " +
                  "#activeMs, " +
                  "#sectionsSeen, " +
                  "#journeyEventCount, " +
                  "#trafficEvidence",

                ExpressionAttributeNames: {
                  "#schemaId":
                    "schemaId",

                  "#sessionHash":
                    "sessionHash",

                  "#visitorHash":
                    "visitorHash",

                  "#eventCount":
                    "eventCount",

                  "#activeMs":
                    "activeMs",

                  "#sectionsSeen":
                    "sectionsSeen",

                  "#journeyEventCount":
                    "journeyEventCount",

                  "#trafficEvidence":
                    "trafficEvidence",
                },
              },
            },
          })
        );


      for (
        const raw of
          response
            .Responses?.[
              ANALYTICS_TABLE
            ] ||
          []
      ) {
        const item =
          unmarshall(
            raw
          );


        const sessionHash =
          safeStr(
            item
              ?.sessionHash,
            80
          );


        if (
          sessionHash &&
          safeStr(
            item
              ?.schemaId,
            120
          ) ===
            TRAFFIC_SESSION_STATE_SCHEMA_ID
        ) {
          output.set(
            sessionHash,
            item
          );
        }
      }


      pendingKeys =
        response
          .UnprocessedKeys?.[
            ANALYTICS_TABLE
          ]?.Keys ||
        [];


      if (
        pendingKeys.length >
          0
      ) {
        await sleep(
          25 *
          Math.pow(
            2,
            attempt
          )
        );
      }
    }


    if (
      pendingKeys.length >
        0
    ) {
      throw new Error(
        "Unable to load all canonical traffic session states after retries."
      );
    }
  }


  return output;
}


function numericValue(value: any) {
  const n =
    Number(value || 0);

  if (
    !Number.isFinite(n) ||
    n < 0
  ) {
    return 0;
  }

  return n;
}

function stringSetValues(
  value: any
): string[] {
  if (
    value instanceof Set
  ) {
    return [...value]
      .map(String)
      .filter(Boolean);
  }

  if (
    Array.isArray(value)
  ) {
    return value
      .map(String)
      .filter(Boolean);
  }

  return [];
}

function positiveIntegerSetValues(
  value: any
): number[] {
  const values =
    value instanceof Set
      ? [...value]
      : Array.isArray(value)
        ? value
        : [];

  const normalized =
    new Set<number>();

  for (const raw of values) {
    const value =
      Number(raw);

    if (
      Number.isInteger(value) &&
      value > 0
    ) {
      normalized.add(value);
    }
  }

  return [
    ...normalized,
  ];
}

type TrafficClassificationIndexEntry =
  ReturnType<
    typeof classifyTrafficSession
  > & {
    sessionHash:
      string;

    visitorHash:
      string;
  };


type TrafficClassificationIndex =
  Map<
    string,
    TrafficClassificationIndexEntry
  >;


/**
 * Builds one deterministic classification for each logical
 * Analytics session represented in the supplied fragments.
 *
 * Physical DAY / release / boundary fragmentation must never
 * create separate traffic classifications.
 */
async function buildTrafficClassificationIndex(
  byDay:
    Map<string, any[]>
) {
  const identities =
    new Map<
      string,
      string
    >();


  for (
    const items of
      byDay.values()
  ) {
    for (
      const item of
        items
    ) {
      const sessionHash =
        safeStr(
          item
            ?.sessionHash,
          80
        );

      const visitorHash =
        safeStr(
          item
            ?.visitorHash,
          80
        );


      if (
        !sessionHash ||
        !visitorHash
      ) {
        continue;
      }


      const existingVisitor =
        identities.get(
          sessionHash
        );


      if (
        existingVisitor &&
        existingVisitor !==
          visitorHash
      ) {
        throw new Error(
          "Analytics logical session maps to multiple visitors."
        );
      }


      identities.set(
        sessionHash,
        visitorHash
      );
    }
  }


  const canonicalStates =
    await queryTrafficSessionStates(
      [
        ...identities.keys(),
      ]
    );


  const index:
    TrafficClassificationIndex =
      new Map();


  for (
    const [
      sessionHash,
      visitorHash,
    ] of
      identities.entries()
  ) {
    const state =
      canonicalStates.get(
        sessionHash
      );


    /**
     * Pre-P12 historical sessions do not have canonical state.
     *
     * Never rebuild them from the caller's date window because
     * doing so would make the same session change classification
     * between 1-day and wider queries.
     *
     * Conservative legacy behavior is stable uncertainty.
     */
    if (
      !state
    ) {
      index.set(
        sessionHash,
        {
          sessionHash,

          visitorHash,

          ...classifyTrafficSession(
            {}
          ),
        }
      );

      continue;
    }


    const canonicalVisitorHash =
      safeStr(
        state
          ?.visitorHash,
        80
      );


    if (
      !canonicalVisitorHash ||
      canonicalVisitorHash !==
        visitorHash
    ) {
      throw new Error(
        "Canonical Analytics traffic session visitor does not match fragment evidence."
      );
    }


    const sections =
      new Set(
        stringSetValues(
          state
            ?.sectionsSeen
        ).filter(
          (
            section
          ) =>
            PUBLIC_SECTIONS.has(
              section
            )
        )
      );


    const classification =
      classifyTrafficSession({
        evidence:
          normalizeTrafficEvidence(
            state
              ?.trafficEvidence
          ),

        eventCount:
          numericValue(
            state
              ?.eventCount
          ),

        activeMs:
          numericValue(
            state
              ?.activeMs
          ),

        sectionCount:
          sections.size,

        journeyEventCount:
          numericValue(
            state
              ?.journeyEventCount
          ),
      });


    index.set(
      sessionHash,
      {
        sessionHash,

        visitorHash,

        ...classification,
      }
    );
  }


  return index;
}


/**
 * Traffic classification is a logical-session filter.
 *
 * The original fragment payload remains untouched so the existing
 * exact Profile Variant metric projection continues to work.
 */
function filterSessionFragmentsByTraffic(
  byDay:
    Map<string, any[]>,

  classificationIndex:
    TrafficClassificationIndex,

  trafficFilter:
    string
) {
  if (
    trafficFilter ===
      TRAFFIC_FILTER_ALL
  ) {
    return byDay;
  }


  const filtered =
    new Map<
      string,
      any[]
    >();


  for (
    const [
      day,
      items,
    ] of byDay.entries()
  ) {
    filtered.set(
      day,

      items.filter(
        (
          item
        ) => {
          const sessionHash =
            safeStr(
              item?.sessionHash,
              80
            );


          if (!sessionHash) {
            return false;
          }


          const classification =
            classificationIndex.get(
              sessionHash
            );


          if (!classification) {
            return false;
          }


          return trafficClassificationMatchesFilter(
            classification
              .classification,

            trafficFilter
          );
        }
      )
    );
  }


  return filtered;
}


function buildTrafficClassificationSummary(
  byDay:
    Map<string, any[]>,

  classificationIndex:
    TrafficClassificationIndex
) {
  type Bucket = {
    visitors:
      Set<string>;

    sessions:
      Set<string>;

    eventCount:
      number;

    activeMs:
      number;
  };


  function bucket():
    Bucket {
    return {
      visitors:
        new Set<string>(),

      sessions:
        new Set<string>(),

      eventCount:
        0,

      activeMs:
        0,
    };
  }


  const buckets =
    new Map<
      string,
      Bucket
    >([
      [
        TRAFFIC_FILTER_ALL,
        bucket(),
      ],

      [
        TRAFFIC_CLASSIFICATION
          .LIKELY_HUMAN,
        bucket(),
      ],

      [
        TRAFFIC_CLASSIFICATION
          .LIKELY_AUTOMATED,
        bucket(),
      ],

      [
        TRAFFIC_CLASSIFICATION
          .UNCERTAIN,
        bucket(),
      ],
    ]);


  for (
    const items of
      byDay.values()
  ) {
    for (
      const item of items
    ) {
      const sessionHash =
        safeStr(
          item?.sessionHash,
          80
        );

      const visitorHash =
        safeStr(
          item?.visitorHash,
          80
        );


      if (
        !sessionHash ||
        !visitorHash
      ) {
        continue;
      }


      const classification =
        classificationIndex.get(
          sessionHash
        );


      if (!classification) {
        throw new Error(
          "Analytics traffic classification is missing for a logical session."
        );
      }


      const classificationBucket =
        buckets.get(
          classification
            .classification
        );


      const allBucket =
        buckets.get(
          TRAFFIC_FILTER_ALL
        );


      if (
        !classificationBucket ||
        !allBucket
      ) {
        throw new Error(
          "Analytics traffic classification bucket is invalid."
        );
      }


      for (
        const target of [
          allBucket,
          classificationBucket,
        ]
      ) {
        target
          .visitors
          .add(
            visitorHash
          );

        target
          .sessions
          .add(
            sessionHash
          );

        target.eventCount +=
          numericValue(
            item?.eventCount
          );

        target.activeMs +=
          numericValue(
            item?.activeMs
          );
      }
    }
  }


  function output(
    key:
      string
  ) {
    const value =
      buckets.get(
        key
      )!;


    return {
      uniqueVisitors:
        value
          .visitors
          .size,

      sessions:
        value
          .sessions
          .size,

      eventCount:
        value
          .eventCount,

      activeMs:
        value
          .activeMs,
    };
  }


  return {
    classifierVersion:
      TRAFFIC_CLASSIFIER_VERSION,

    byClassification: {
      all:
        output(
          TRAFFIC_FILTER_ALL
        ),

      likely_human:
        output(
          TRAFFIC_CLASSIFICATION
            .LIKELY_HUMAN
        ),

      likely_automated:
        output(
          TRAFFIC_CLASSIFICATION
            .LIKELY_AUTOMATED
        ),

      uncertain:
        output(
          TRAFFIC_CLASSIFICATION
            .UNCERTAIN
        ),
    },
  };
}


type ParsedJourneyEvent = {
  ts: number;
  fingerprint: string;
  type: string;
  value: string;

  profileVariantId:
    string | null;
};

const JOURNEY_KINDS =
  new Set([
    "section",
    "cta",
    "project",
    "snippet",
    "deep_link",
  ]);

function parseJourneyToken(
  token: string
): ParsedJourneyEvent | null {
  try {
    const parsed =
      JSON.parse(token);

    const ts =
      Number(parsed?.t);

    const fingerprint =
      safeStr(
        parsed?.i,
        40
      );

    const type =
      safeStr(
        parsed?.k,
        32
      );

    const rawValue =
      safeStr(
        parsed?.v,
        240
      );

    const value =
      type === "deep_link"
        ? canonicalizeDeepLinkValue(
            rawValue
          )
        : rawValue;

    const rawProfileVariantId =
      safeStr(
        parsed?.p,
        160
      );

    const profileVariantId =
      rawProfileVariantId &&
      /^[A-Za-z0-9._:-]+$/.test(
        rawProfileVariantId
      )
        ? rawProfileVariantId
        : null;

    if (
      !Number.isFinite(ts) ||
      !fingerprint ||
      !JOURNEY_KINDS.has(type) ||
      !value
    ) {
      return null;
    }

    return {
      ts,
      fingerprint,
      type,
      value,

      profileVariantId,
    };
  } catch {
    return null;
  }
}

function numericMap(
  value: any
): Record<string, number> {
  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(value) ||
    value instanceof Set
  ) {
    return {};
  }

  const out:
    Record<string, number> =
      {};

  for (
    const [key, raw]
    of Object.entries(value)
  ) {
    const amount =
      numericValue(raw);

    if (amount > 0) {
      out[key] = amount;
    }
  }

  return out;
}

type ExactInteractionCounter = {
  count: number;
  visitors: Set<string>;
  sessions: Set<string>;
};

function getInteractionCounter(
  map: Map<
    string,
    ExactInteractionCounter
  >,
  key: string
) {
  let value =
    map.get(key);

  if (!value) {
    value = {
      count: 0,
      visitors:
        new Set<string>(),
      sessions:
        new Set<string>(),
    };

    map.set(key, value);
  }

  return value;
}

type IdentityMembershipCounter = {
  visitors:
    Set<string>;

  sessions:
    Set<string>;

  fragments:
    number;
};


function touchIdentityMembership(
  map: Map<
    string,
    IdentityMembershipCounter
  >,
  identity: string,
  visitorHash: string,
  sessionHash: string
) {
  let state =
    map.get(identity);

  if (!state) {
    state = {
      visitors:
        new Set<string>(),

      sessions:
        new Set<string>(),

      fragments:
        0,
    };

    map.set(
      identity,
      state
    );
  }

  state.visitors.add(
    visitorHash
  );

  state.sessions.add(
    sessionHash
  );

  state.fragments +=
    1;
}

type RuntimeProfileFilter = {
  profileVariantId:
    string | null;

  profileTargetingLocation:
    string | null;

  profileTargetingJobRole:
    string | null;
};


type ParsedProfileVariantContext = {
  rawToken: string;

  profileVariantId:
    string;

  contentSchemaVersion:
    number | null;

  profileTargetingLocation:
    string | null;

  profileTargetingJobRole:
    string | null;

  platformReleaseId:
    string | null;

  deploymentConfigurationId:
    string | null;
};


function hasRuntimeProfileFilter(
  filter:
    RuntimeProfileFilter
) {
  return Boolean(
    filter.profileVariantId ||
    filter.profileTargetingLocation ||
    filter.profileTargetingJobRole
  );
}


function parseProfileVariantContextToken(
  token: string
): ParsedProfileVariantContext | null {
  try {
    const parsed =
      JSON.parse(token);

    if (
      !Array.isArray(parsed) ||
      parsed.length < 6
    ) {
      return null;
    }

    const profileVariantId =
      safeStr(
        parsed[0],
        160
      );

    if (
      !profileVariantId ||
      !/^[A-Za-z0-9._:-]+$/.test(
        profileVariantId
      )
    ) {
      return null;
    }

    const schemaValue =
      Number(
        parsed[1]
      );

    const contentSchemaVersion =
      Number.isInteger(
        schemaValue
      ) &&
      schemaValue > 0
        ? schemaValue
        : null;

    const profileTargetingLocation =
      parsed[2] == null
        ? null
        : (
            safeStr(
              parsed[2],
              240
            ) || null
          );

    const profileTargetingJobRole =
      parsed[3] == null
        ? null
        : (
            safeStr(
              parsed[3],
              240
            ) || null
          );

    const platformReleaseId =
      parsed[4] == null
        ? null
        : (
            safeStr(
              parsed[4],
              160
            ) || null
          );

    const deploymentConfigurationId =
      parsed[5] == null
        ? null
        : (
            safeStr(
              parsed[5],
              160
            ) || null
          );

    return {
      rawToken:
        token,

      profileVariantId,

      contentSchemaVersion,

      profileTargetingLocation,

      profileTargetingJobRole,

      platformReleaseId,

      deploymentConfigurationId,
    };
  } catch {
    return null;
  }
}


function parseProfileVariantDimensionKey(
  key: string
): {
  profileVariantId: string;
  value: string;
} | null {
  try {
    const parsed =
      JSON.parse(key);

    if (
      !Array.isArray(parsed) ||
      parsed.length !== 2
    ) {
      return null;
    }

    const profileVariantId =
      safeStr(
        parsed[0],
        160
      );

    const value =
      typeof parsed[1] ===
        "string"
        ? parsed[1]
        : "";

    if (
      !profileVariantId ||
      !/^[A-Za-z0-9._:-]+$/.test(
        profileVariantId
      ) ||
      !value
    ) {
      return null;
    }

    return {
      profileVariantId,
      value,
    };
  } catch {
    return null;
  }
}


function selectedProfileVariantMetricTotal(
  source: any,
  selectedProfileVariantIds:
    Set<string>
) {
  let total = 0;

  const values =
    numericMap(source);

  for (
    const profileVariantId of
      selectedProfileVariantIds
  ) {
    total +=
      numericValue(
        values[
          profileVariantId
        ]
      );
  }

  return total;
}


function selectedProfileVariantDimensionMetrics(
  source: any,
  selectedProfileVariantIds:
    Set<string>
) {
  const output:
    Record<string, number> =
      {};

  for (
    const [
      encodedKey,
      amount,
    ] of Object.entries(
      numericMap(source)
    )
  ) {
    const parsed =
      parseProfileVariantDimensionKey(
        encodedKey
      );

    if (
      !parsed ||
      !selectedProfileVariantIds
        .has(
          parsed.profileVariantId
        )
    ) {
      continue;
    }

    output[
      parsed.value
    ] =
      (
        output[
          parsed.value
        ] || 0
      ) +
      amount;
  }

  return output;
}


function profileVariantContextsForItem(
  item: any
) {
  const contexts:
    ParsedProfileVariantContext[] =
      [];

  for (
    const token of
      stringSetValues(
        item?.profileVariantContexts
      )
  ) {
    const context =
      parseProfileVariantContextToken(
        token
      );

    if (context) {
      contexts.push(
        context
      );
    }
  }

  return contexts;
}


function selectedProfileVariantIdsForItem(
  item: any,
  filter:
    RuntimeProfileFilter
) {
  const eventCounts =
    numericMap(
      item
        ?.profileVariantMetrics
        ?.eventCounts
    );

  let selected =
    new Set<string>(
      Object.entries(
        eventCounts
      )
        .filter(
          ([
            profileVariantId,
            amount,
          ]) =>
            Boolean(
              profileVariantId &&
              /^[A-Za-z0-9._:-]+$/.test(
                profileVariantId
              ) &&
              amount > 0
            )
        )
        .map(
          ([
            profileVariantId,
          ]) =>
            profileVariantId
        )
    );


  if (
    filter.profileVariantId
  ) {
    selected =
      selected.has(
        filter.profileVariantId
      )
        ? new Set([
            filter.profileVariantId,
          ])
        : new Set<string>();
  }


  if (
    filter.profileTargetingLocation ||
    filter.profileTargetingJobRole
  ) {
    const matchingContextIds =
      new Set<string>();

    for (
      const context of
        profileVariantContextsForItem(
          item
        )
    ) {
      if (
        filter.profileVariantId &&
        context.profileVariantId !==
          filter.profileVariantId
      ) {
        continue;
      }

      if (
        filter.profileTargetingLocation &&
        context
          .profileTargetingLocation !==
          filter.profileTargetingLocation
      ) {
        continue;
      }

      if (
        filter.profileTargetingJobRole &&
        context
          .profileTargetingJobRole !==
          filter.profileTargetingJobRole
      ) {
        continue;
      }

      matchingContextIds.add(
        context.profileVariantId
      );
    }

    selected =
      new Set(
        [
          ...selected,
        ].filter(
          (profileVariantId) =>
            matchingContextIds.has(
              profileVariantId
            )
        )
      );
  }

  return selected;
}


function projectRuntimeProfileFilteredFragments(
  byDay:
    Map<string, any[]>,
  filter:
    RuntimeProfileFilter
) {
  if (
    !hasRuntimeProfileFilter(
      filter
    )
  ) {
    return byDay;
  }

  const projectedByDay =
    new Map<
      string,
      any[]
    >();

  for (
    const [
      day,
      items,
    ] of byDay.entries()
  ) {
    const projectedItems:
      any[] = [];

    for (
      const item of items
    ) {
      const selectedProfileVariantIds =
        selectedProfileVariantIdsForItem(
          item,
          filter
        );

      if (
        selectedProfileVariantIds
          .size === 0
      ) {
        continue;
      }

      const variantMetrics =
        item?.profileVariantMetrics ||
        {};

      const eventCount =
        selectedProfileVariantMetricTotal(
          variantMetrics
            .eventCounts,
          selectedProfileVariantIds
        );

      if (eventCount <= 0) {
        continue;
      }

      const activeMs =
        selectedProfileVariantMetricTotal(
          variantMetrics
            .activeMs,
          selectedProfileVariantIds
        );


      const sectionsSeen =
        new Set<string>();

      for (
        const token of
          stringSetValues(
            item
              ?.profileVariantSectionsSeen
          )
      ) {
        try {
          const parsed =
            JSON.parse(token);

          if (
            !Array.isArray(parsed) ||
            parsed.length !== 2
          ) {
            continue;
          }

          const profileVariantId =
            safeStr(
              parsed[0],
              160
            );

          const section =
            safeStr(
              parsed[1],
              80
            );

          if (
            selectedProfileVariantIds
              .has(
                profileVariantId
              ) &&
            PUBLIC_SECTIONS.has(
              section
            )
          ) {
            sectionsSeen.add(
              section
            );
          }
        } catch {
          continue;
        }
      }


      const depthMilestones =
        new Set<string>();

      for (
        const token of
          stringSetValues(
            item
              ?.profileVariantDepthMilestones
          )
      ) {
        try {
          const parsed =
            JSON.parse(token);

          if (
            !Array.isArray(parsed) ||
            parsed.length !== 3
          ) {
            continue;
          }

          const profileVariantId =
            safeStr(
              parsed[0],
              160
            );

          const section =
            safeStr(
              parsed[1],
              80
            );

          const depthPct =
            Number(
              parsed[2]
            );

          if (
            selectedProfileVariantIds
              .has(
                profileVariantId
              ) &&
            PUBLIC_SECTIONS.has(
              section
            ) &&
            [25, 50, 75, 100]
              .includes(
                depthPct
              )
          ) {
            depthMilestones.add(
              `${section}|${depthPct}`
            );
          }
        } catch {
          continue;
        }
      }


      const journeyEvents =
        new Set<string>();

      for (
        const token of
          stringSetValues(
            item?.journeyEvents
          )
      ) {
        const parsed =
          parseJourneyToken(
            token
          );

        if (
          parsed
            ?.profileVariantId &&
          selectedProfileVariantIds
            .has(
              parsed
                .profileVariantId
            )
        ) {
          journeyEvents.add(
            token
          );
        }
      }


      const relevantContexts =
        profileVariantContextsForItem(
          item
        ).filter(
          (context) => {
            if (
              !selectedProfileVariantIds
                .has(
                  context
                    .profileVariantId
                )
            ) {
              return false;
            }

            if (
              filter
                .profileTargetingLocation &&
              context
                .profileTargetingLocation !==
                filter
                  .profileTargetingLocation
            ) {
              return false;
            }

            if (
              filter
                .profileTargetingJobRole &&
              context
                .profileTargetingJobRole !==
                filter
                  .profileTargetingJobRole
            ) {
              return false;
            }

            return true;
          }
        );


      const contentSchemaVersions =
        new Set<number>();

      const profileTargetingLocations =
        new Set<string>();

      const profileTargetingJobRoles =
        new Set<string>();

      const platformReleaseIds =
        new Set<string>();

      const deploymentConfigurationIds =
        new Set<string>();


      for (
        const context of
          relevantContexts
      ) {
        if (
          context
            .contentSchemaVersion !==
          null
        ) {
          contentSchemaVersions.add(
            context
              .contentSchemaVersion
          );
        }

        if (
          context
            .profileTargetingLocation
        ) {
          profileTargetingLocations
            .add(
              context
                .profileTargetingLocation
            );
        }

        if (
          context
            .profileTargetingJobRole
        ) {
          profileTargetingJobRoles
            .add(
              context
                .profileTargetingJobRole
            );
        }

        if (
          context
            .platformReleaseId
        ) {
          platformReleaseIds.add(
            context
              .platformReleaseId
          );
        }

        if (
          context
            .deploymentConfigurationId
        ) {
          deploymentConfigurationIds
            .add(
              context
                .deploymentConfigurationId
            );
        }
      }


      projectedItems.push({
        ...item,

        eventCount,

        activeMs,

        sectionsSeen,

        depthMilestones,

        journeyEvents,

        profileVariantIds:
          new Set(
            selectedProfileVariantIds
          ),

        contentSchemaVersions,

        profileTargetingLocations,

        profileTargetingJobRoles,

        platformReleaseIds,

        deploymentConfigurationIds,

        profileVariantContexts:
          new Set(
            relevantContexts.map(
              (context) =>
                context.rawToken
            )
          ),

        metrics: {
          sectionVisits:
            selectedProfileVariantDimensionMetrics(
              variantMetrics
                .sectionVisits,
              selectedProfileVariantIds
            ),

          sectionTimeMs:
            selectedProfileVariantDimensionMetrics(
              variantMetrics
                .sectionTimeMs,
              selectedProfileVariantIds
            ),

          ctaCounts:
            selectedProfileVariantDimensionMetrics(
              variantMetrics
                .ctaCounts,
              selectedProfileVariantIds
            ),

          projectOpens:
            selectedProfileVariantDimensionMetrics(
              variantMetrics
                .projectOpens,
              selectedProfileVariantIds
            ),

          snippetViews:
            selectedProfileVariantDimensionMetrics(
              variantMetrics
                .snippetViews,
              selectedProfileVariantIds
            ),

          deepLinks:
            selectedProfileVariantDimensionMetrics(
              variantMetrics
                .deepLinks,
              selectedProfileVariantIds
            ),
        },
      });
    }

    projectedByDay.set(
      day,
      projectedItems
    );
  }

  return projectedByDay;
}

function aggregateSessionFragments(
  days: string[],
  byDay:
    Map<string, any[]>,
  profileVersionFilter:
    string | null,
  runtimeProfileFilter:
    RuntimeProfileFilter,

  trafficClassificationFilter:
    string,

  visitorFirstSeenByHash:
    Map<string, number>,
  effectiveRangeStartTs:
    number | null,
  boundaryFilter:
    AnalyticsBoundaryRecord | null
) {
  const visitors =
    new Set<string>();

  const sessions =
    new Set<string>();

  const sessionSections =
    new Map<
      string,
      Set<string>
    >();

  // Per-session totals, for Outreach Score's engaged-session
  // rate and consistency components.
  const sessionActiveMs =
    new Map<
      string,
      number
    >();

  const sessionEventCount =
    new Map<
      string,
      number
    >();

  let totalActiveMs = 0;
  let totalEventCount = 0;
  let fragmentCount = 0;

  type SectionState = {
    visits: number;
    activeMs: number;
    visitors: Set<string>;
    sessions: Set<string>;
  };

  const sections =
    new Map<
      string,
      SectionState
    >();

  for (
    const section of
      PUBLIC_SECTION_ORDER
  ) {
    sections.set(section, {
      visits: 0,
      activeMs: 0,
      visitors:
        new Set<string>(),
      sessions:
        new Set<string>(),
    });
  }

  const ctas =
    new Map<
      string,
      ExactInteractionCounter
    >();

  const projects =
    new Map<
      string,
      ExactInteractionCounter
    >();

  const snippets =
    new Map<
      string,
      ExactInteractionCounter
    >();

  const deepLinks =
    new Map<
      string,
      ExactInteractionCounter
    >();

  const depth =
    new Map<
      string,
      {
        section: string;
        depthPct: number;
        visitors:
          Set<string>;
        sessions:
          Set<string>;
      }
    >();

  const countries =
    new Map<
      string,
      {
        visitors:
          Set<string>;
        sessions:
          Set<string>;
        activeMs: number;
      }
    >();


  const cities =
    new Map<
      string,
      {
        city: string;
        countryCode:
          string | null;
        regionCode:
          string | null;

        visitors:
          Set<string>;

        sessions:
          Set<string>;

        activeMs:
          number;
      }
    >();


  const profileVersions =
    new Map<
      string,
      {
        visitors:
          Set<string>;
        sessions:
          Set<string>;
        eventCount: number;
        activeMs: number;
      }
    >();

  /**
   * Runtime identity membership statistics.
   *
   * These counters intentionally expose visitors,
   * sessions, and fragment membership only.
   *
   * Fragment-level eventCount/activeMs cannot be
   * attributed exactly when one fragment contains
   * multiple runtime identities.
   */
  const profileVariants =
    new Map<
      string,
      IdentityMembershipCounter
    >();


  const contentSchemas =
    new Map<
      string,
      IdentityMembershipCounter
    >();


  const targetingLocations =
    new Map<
      string,
      IdentityMembershipCounter
    >();


  const targetingJobRoles =
    new Map<
      string,
      IdentityMembershipCounter
    >();


  const platformReleases =
    new Map<
      string,
      IdentityMembershipCounter
    >();


  const deploymentConfigurations =
    new Map<
      string,
      IdentityMembershipCounter
    >();


  const daily = days.map(
    (day) => ({
      day,

      visitors:
        new Set<string>(),

      sessions:
        new Set<string>(),

      activeMs: 0,

      eventCount: 0,

      fragmentCount: 0,
    })
  );


  const dailyByDay =
    new Map(
      daily.map(
        (entry) => [
          entry.day,
          entry,
        ]
      )
    );

  function touchSection(
    section: string,
    visitorHash: string,
    sessionHash: string
  ) {
    if (
      !PUBLIC_SECTIONS.has(
        section
      )
    ) {
      return;
    }

    const state =
      sections.get(section);

    if (!state) return;

    state.visitors.add(
      visitorHash
    );

    state.sessions.add(
      sessionHash
    );

    let reached =
      sessionSections.get(
        sessionHash
      );

    if (!reached) {
      reached =
        new Set<string>();

      sessionSections.set(
        sessionHash,
        reached
      );
    }

    reached.add(section);
  }

  function accumulateInteraction(
    target: Map<
      string,
      ExactInteractionCounter
    >,
    source: any,
    visitorHash: string,
    sessionHash: string,
    normalizeKey:
      (
        key: string
      ) => string =
        (key) => key
  ) {
    for (
      const [key, amount]
      of Object.entries(
        numericMap(source)
      )
    ) {
      const normalizedKey =
        normalizeKey(key);

      if (!normalizedKey) {
        continue;
      }

      const counter =
        getInteractionCounter(
          target,
          normalizedKey
        );

      counter.count +=
        amount;

      counter.visitors.add(
        visitorHash
      );

      counter.sessions.add(
        sessionHash
      );
    }
  }

  for (const day of days) {
    const items =
      byDay.get(day) || [];

    const dailyState =
      dailyByDay.get(day)!;

    for (
      const item of items
    ) {
      const visitorHash =
        safeStr(
          item?.visitorHash,
          80
        );

      const sessionHash =
        safeStr(
          item?.sessionHash,
          80
        );

      if (
        !visitorHash ||
        !sessionHash
      ) {
        continue;
      }

      fragmentCount += 1;

      visitors.add(
        visitorHash
      );

      sessions.add(
        sessionHash
      );

      dailyState.visitors.add(
        visitorHash
      );

      dailyState.sessions.add(
        sessionHash
      );

      dailyState.fragmentCount +=
        1;

      const itemActiveMs =
        numericValue(
          item?.activeMs
        );

      const itemEventCount =
        numericValue(
          item?.eventCount
        );

      totalActiveMs +=
        itemActiveMs;

      totalEventCount +=
        itemEventCount;

      sessionActiveMs.set(
        sessionHash,
        (sessionActiveMs.get(
          sessionHash
        ) || 0) +
          itemActiveMs
      );

      sessionEventCount.set(
        sessionHash,
        (sessionEventCount.get(
          sessionHash
        ) || 0) +
          itemEventCount
      );

      dailyState.activeMs +=
        itemActiveMs;

      dailyState.eventCount +=
        itemEventCount;

      // -------------------------
      // Release-level exact stats
      // -------------------------

      const pv =
        safeStr(
          item?.profileVersionId,
          120
        ) ||
        "unknown";

      let pvState =
        profileVersions.get(pv);

      if (!pvState) {
        pvState = {
          visitors:
            new Set<string>(),
          sessions:
            new Set<string>(),
          eventCount: 0,
          activeMs: 0,
        };

        profileVersions.set(
          pv,
          pvState
        );
      }

      pvState.visitors.add(
        visitorHash
      );

      pvState.sessions.add(
        sessionHash
      );

      pvState.eventCount +=
        itemEventCount;

      pvState.activeMs +=
        itemActiveMs;

      // -------------------------
      // Section reach
      // -------------------------

      for (
        const section of
          stringSetValues(
            item?.sectionsSeen
          )
      ) {
        touchSection(
          section,
          visitorHash,
          sessionHash
        );
      }

      // -------------------------
      // Runtime identity membership
      // -------------------------

      for (
        const rawProfileVariantId of
          stringSetValues(
            item?.profileVariantIds
          )
      ) {
        const profileVariantId =
          safeStr(
            rawProfileVariantId,
            160
          );

        if (
          profileVariantId &&
          /^[A-Za-z0-9._:-]+$/.test(
            profileVariantId
          )
        ) {
          touchIdentityMembership(
            profileVariants,
            profileVariantId,
            visitorHash,
            sessionHash
          );
        }
      }


      for (
        const contentSchemaVersion of
          positiveIntegerSetValues(
            item?.contentSchemaVersions
          )
      ) {
        touchIdentityMembership(
          contentSchemas,
          String(
            contentSchemaVersion
          ),
          visitorHash,
          sessionHash
        );
      }


      for (
        const rawLocation of
          stringSetValues(
            item
              ?.profileTargetingLocations
          )
      ) {
        const location =
          safeStr(
            rawLocation,
            240
          );

        if (location) {
          touchIdentityMembership(
            targetingLocations,
            location,
            visitorHash,
            sessionHash
          );
        }
      }


      for (
        const rawJobRole of
          stringSetValues(
            item
              ?.profileTargetingJobRoles
          )
      ) {
        const jobRole =
          safeStr(
            rawJobRole,
            240
          );

        if (jobRole) {
          touchIdentityMembership(
            targetingJobRoles,
            jobRole,
            visitorHash,
            sessionHash
          );
        }
      }


      for (
        const rawPlatformReleaseId of
          stringSetValues(
            item?.platformReleaseIds
          )
      ) {
        const platformReleaseId =
          safeStr(
            rawPlatformReleaseId,
            160
          );

        if (platformReleaseId) {
          touchIdentityMembership(
            platformReleases,
            platformReleaseId,
            visitorHash,
            sessionHash
          );
        }
      }


      for (
        const rawDeploymentConfigurationId of
          stringSetValues(
            item
              ?.deploymentConfigurationIds
          )
      ) {
        const deploymentConfigurationId =
          safeStr(
            rawDeploymentConfigurationId,
            160
          );

        if (
          deploymentConfigurationId
        ) {
          touchIdentityMembership(
            deploymentConfigurations,
            deploymentConfigurationId,
            visitorHash,
            sessionHash
          );
        }
      }

      // -------------------------
      // Section metrics
      // -------------------------

      const metrics =
        item?.metrics || {};

      const sectionVisits =
        numericMap(
          metrics.sectionVisits
        );

      for (
        const [
          section,
          amount,
        ] of Object.entries(
          sectionVisits
        )
      ) {
        if (
          !PUBLIC_SECTIONS.has(
            section
          )
        ) {
          continue;
        }

        const state =
          sections.get(section)!;

        state.visits +=
          amount;

        touchSection(
          section,
          visitorHash,
          sessionHash
        );
      }

      const sectionTimeMs =
        numericMap(
          metrics.sectionTimeMs
        );

      for (
        const [
          section,
          amount,
        ] of Object.entries(
          sectionTimeMs
        )
      ) {
        if (
          !PUBLIC_SECTIONS.has(
            section
          )
        ) {
          continue;
        }

        const state =
          sections.get(section)!;

        state.activeMs +=
          amount;

        touchSection(
          section,
          visitorHash,
          sessionHash
        );
      }

      // -------------------------
      // Interactions
      // -------------------------

      accumulateInteraction(
        ctas,
        metrics.ctaCounts,
        visitorHash,
        sessionHash
      );

      accumulateInteraction(
        projects,
        metrics.projectOpens,
        visitorHash,
        sessionHash
      );

      accumulateInteraction(
        snippets,
        metrics.snippetViews,
        visitorHash,
        sessionHash
      );

      accumulateInteraction(
        deepLinks,
        metrics.deepLinks,
        visitorHash,
        sessionHash,
        canonicalizeDeepLinkValue
      );

      // -------------------------
      // Scroll milestone reach
      // -------------------------

      for (
        const token of
          stringSetValues(
            item?.depthMilestones
          )
      ) {
        const splitAt =
          token.lastIndexOf("|");

        if (splitAt <= 0) {
          continue;
        }

        const section =
          token.slice(
            0,
            splitAt
          );

        const depthPct =
          Number(
            token.slice(
              splitAt + 1
            )
          );

        if (
          !PUBLIC_SECTIONS.has(
            section
          ) ||
          ![25, 50, 75, 100]
            .includes(depthPct)
        ) {
          continue;
        }

        const key =
          `${section}|${depthPct}`;

        let depthState =
          depth.get(key);

        if (!depthState) {
          depthState = {
            section,
            depthPct,

            visitors:
              new Set<string>(),

            sessions:
              new Set<string>(),
          };

          depth.set(
            key,
            depthState
          );
        }

        depthState.visitors.add(
          visitorHash
        );

        depthState.sessions.add(
          sessionHash
        );
      }

      // -------------------------
      // Country
      // -------------------------

      const countryCode =
        safeStr(
          item?.countryCode,
          2
        ).toUpperCase();

      if (
        /^[A-Z]{2}$/.test(
          countryCode
        )
      ) {
        let country =
          countries.get(
            countryCode
          );

        if (!country) {
          country = {
            visitors:
              new Set<string>(),

            sessions:
              new Set<string>(),

            activeMs: 0,
          };

          countries.set(
            countryCode,
            country
          );
        }

        country.visitors.add(
          visitorHash
        );

        country.sessions.add(
          sessionHash
        );

        country.activeMs +=
          itemActiveMs;
      }

      // -------------------------
      // City / region
      // -------------------------

      const regionCode =
        safeStr(
          item?.regionCode,
          8
        ).toUpperCase();

      const cityName =
        safeStr(
          item?.city,
          120
        );

      if (cityName) {
        const cityKey =
          JSON.stringify([
            countryCode || null,
            regionCode || null,
            cityName,
          ]);

        let city =
          cities.get(
            cityKey
          );

        if (!city) {
          city = {
            city:
              cityName,

            countryCode:
              countryCode ||
              null,

            regionCode:
              regionCode ||
              null,

            visitors:
              new Set<string>(),

            sessions:
              new Set<string>(),

            activeMs:
              0,
          };

          cities.set(
            cityKey,
            city
          );
        }

        city.visitors.add(
          visitorHash
        );

        city.sessions.add(
          sessionHash
        );

        city.activeMs +=
          itemActiveMs;
      }
    }
  }

  // -----------------------------
  // Overall KPIs
  // -----------------------------

  const sessionCount =
    sessions.size;

  const uniqueVisitors =
    visitors.size;

  const dayRangeStartTs =
    days.length
      ? Date.parse(
          `${days[0]}T00:00:00Z`
        )
      : NaN;

  const rangeStartTs =
    Number.isFinite(
      effectiveRangeStartTs
    )
      ? Math.max(
          dayRangeStartTs,
          effectiveRangeStartTs!
        )
      : dayRangeStartTs;

  const rangeEndExclusiveTs =
    days.length
      ? Date.parse(
          `${shiftUtcDay(
            days[
              days.length - 1
            ],
            1
          )}T00:00:00Z`
        )
      : NaN;

  let newVisitors = 0;
  let returningVisitors = 0;
  let unclassifiedVisitors = 0;

  for (
    const visitorHash of
      visitors
  ) {
    const firstSeenAt =
      visitorFirstSeenByHash.get(
        visitorHash
      );

    // Historical DEV fragments created before Phase 6A do not
    // have visitor registry records. Keep them explicitly
    // unclassified rather than lying about new/returning status.
    if (
      !Number.isFinite(
        firstSeenAt
      ) ||
      !Number.isFinite(
        rangeStartTs
      ) ||
      !Number.isFinite(
        rangeEndExclusiveTs
      ) ||
      firstSeenAt! >=
        rangeEndExclusiveTs
    ) {
      unclassifiedVisitors += 1;
      continue;
    }

    if (
      firstSeenAt! <
      rangeStartTs
    ) {
      returningVisitors += 1;
    } else {
      newVisitors += 1;
    }
  }

  const classifiedVisitors =
    newVisitors +
    returningVisitors;

  const returningVisitorPct =
    classifiedVisitors
      ? Number(
          (
            (returningVisitors /
              classifiedVisitors) *
            100
          ).toFixed(1)
        )
      : 0;

  const avgActiveMsPerSession =
    sessionCount
      ? Math.round(
          totalActiveMs /
            sessionCount
        )
      : 0;

  const totalUniqueSections =
    [
      ...sessionSections.values(),
    ].reduce(
      (sum, set) =>
        sum + set.size,
      0
    );

  const avgSectionsPerSession =
    sessionCount
      ? totalUniqueSections /
        sessionCount
      : 0;

  // -----------------------------
  // Outreach Score engagement inputs
  // -----------------------------

  let meaningfulSessionCount = 0;
  let engagedSessionCount = 0;
  let topSessionActiveMs = 0;

  for (
    const sessionHash of
      sessions
  ) {
    const ms =
      sessionActiveMs.get(
        sessionHash
      ) || 0;

    const events =
      sessionEventCount.get(
        sessionHash
      ) || 0;

    if (
      ms >=
      MEANINGFUL_SESSION_ACTIVE_MS
    ) {
      meaningfulSessionCount += 1;
    }

    if (
      ms >=
        ENGAGED_SESSION_ACTIVE_MS ||
      events >=
        ENGAGED_SESSION_EVENT_COUNT
    ) {
      engagedSessionCount += 1;
    }

    if (
      ms >
      topSessionActiveMs
    ) {
      topSessionActiveMs = ms;
    }
  }

  const topSessionActiveMsShare =
    totalActiveMs > 0
      ? topSessionActiveMs /
        totalActiveMs
      : 0;

  // -----------------------------
  // Section response
  // -----------------------------

  const sectionOutput =
    PUBLIC_SECTION_ORDER.map(
      (section) => {
        const value =
          sections.get(section)!;

        return {
          section,

          visits:
            value.visits,

          visitors:
            value.visitors.size,

          sessions:
            value.sessions.size,

          activeMs:
            value.activeMs,

          visitorReachPct:
            uniqueVisitors
              ? Number(
                  (
                    (value.visitors
                      .size /
                      uniqueVisitors) *
                    100
                  ).toFixed(1)
                )
              : 0,

          sessionReachPct:
            sessionCount
              ? Number(
                  (
                    (value.sessions
                      .size /
                      sessionCount) *
                    100
                  ).toFixed(1)
                )
              : 0,
        };
      }
    );

  const topSection =
    [...sectionOutput]
      .sort(
        (a, b) =>
          b.visits -
            a.visits ||
          b.visitors -
            a.visitors ||
          b.activeMs -
            a.activeMs
      )[0];

  function interactionOutput(
    source: Map<
      string,
      ExactInteractionCounter
    >,
    idField: string
  ) {
    return [
      ...source.entries(),
    ]
      .map(
        ([id, value]) => ({
          [idField]: id,

          count:
            value.count,

          visitors:
            value.visitors.size,

          sessions:
            value.sessions.size,
        })
      )
      .sort(
        (a, b) =>
          Number(b.count) -
          Number(a.count)
      );
  }

  function identityMembershipOutput(
    source:
      Map<
        string,
        IdentityMembershipCounter
      >,
    idField:
      string
  ) {
    return [
      ...source.entries(),
    ]
      .map(
        ([
          id,
          value,
        ]) => ({
          [idField]:
            id,

          visitors:
            value.visitors.size,

          sessions:
            value.sessions.size,

          fragments:
            value.fragments,
        })
      )
      .sort(
        (a, b) =>
          b.sessions -
            a.sessions ||
          b.visitors -
            a.visitors ||
          String(
            a[idField]
          ).localeCompare(
            String(
              b[idField]
            )
          )
      );
  }

  return {
    range: {

      effectiveFromTs:
        Number.isFinite(
          rangeStartTs
        )
          ? rangeStartTs
          : null,

      from:
        days[0] || null,

      to:
        days.length
          ? days[
              days.length - 1
            ]
          : null,

      dayCount:
        days.length,
    },

    filter: {
      profileVersionId:
        profileVersionFilter ||
        "all",

      profileVariantId:
        runtimeProfileFilter
          .profileVariantId ||
        "all",

      profileTargetingLocation:
        runtimeProfileFilter
          .profileTargetingLocation ||
        "all",

      profileTargetingJobRole:
        runtimeProfileFilter
          .profileTargetingJobRole ||
        "all",

      trafficClassification:
        trafficClassificationFilter,

      boundaryId:
        boundaryFilter
          ?.boundaryId ||
        null,

      boundaryEffectiveAt:
        boundaryFilter
          ?.effectiveAt ||
        null,
    },

    overview: {
      uniqueVisitors,

      newVisitors,

      returningVisitors,

      classifiedVisitors,

      unclassifiedVisitors,

      returningVisitorPct,

      sessions:
        sessionCount,

      activeMs:
        totalActiveMs,

      avgActiveMsPerSession,

      avgSectionsPerSession:
        Number(
          avgSectionsPerSession
            .toFixed(2)
        ),

      eventCount:
        totalEventCount,

      topSection:
        topSection &&
        (
          topSection.visits > 0 ||
          topSection.visitors > 0
        )
          ? topSection.section
          : null,

      fragments:
        fragmentCount,
    },

    sections:
      sectionOutput,

    ctas:
      interactionOutput(
        ctas,
        "ctaId"
      ),

    projects:
      interactionOutput(
        projects,
        "projectId"
      ),

    snippets:
      interactionOutput(
        snippets,
        "snippetId"
      ),

    deepLinks:
      interactionOutput(
        deepLinks,
        "path"
      ),

    depthMilestones:
      [...depth.values()]
        .map(
          (value) => ({
            section:
              value.section,

            depthPct:
              value.depthPct,

            visitors:
              value.visitors.size,

            sessions:
              value.sessions.size,
          })
        )
        .sort((a, b) => {
          const sectionA =
            PUBLIC_SECTION_ORDER
              .indexOf(
                a.section as any
              );

          const sectionB =
            PUBLIC_SECTION_ORDER
              .indexOf(
                b.section as any
              );

          return (
            sectionA -
              sectionB ||
            a.depthPct -
              b.depthPct
          );
        }),

    countries:
      [
        ...countries.entries(),
      ]
        .map(
          ([
            countryCode,
            value,
          ]) => ({
            countryCode,

            visitors:
              value.visitors.size,

            sessions:
              value.sessions.size,

            activeMs:
              value.activeMs,
          })
        )
        .sort(
          (a, b) =>
            b.visitors -
              a.visitors ||
            b.sessions -
              a.sessions
        ),

    cities:
      [...cities.values()]
        .map(
          (value) => ({
            city:
              value.city,

            countryCode:
              value.countryCode,

            regionCode:
              value.regionCode,

            visitors:
              value.visitors.size,

            sessions:
              value.sessions.size,

            activeMs:
              value.activeMs,
          })
        )
        .sort(
          (a, b) =>
            b.visitors -
              a.visitors ||
            b.sessions -
              a.sessions
        ),

    profileVersions:
      [
        ...profileVersions.entries(),
      ]
        .map(
          ([
            profileVersionId,
            value,
          ]) => ({
            profileVersionId,

            visitors:
              value.visitors.size,

            sessions:
              value.sessions.size,

            eventCount:
              value.eventCount,

            activeMs:
              value.activeMs,
          })
        )
        .sort(
          (a, b) =>
            b.eventCount -
            a.eventCount
        ),

    profileVariants:
      identityMembershipOutput(
        profileVariants,
        "profileVariantId"
      ),


    contentSchemaVersions:
      identityMembershipOutput(
        contentSchemas,
        "contentSchemaVersion"
      ).map(
        (row) => ({
          ...row,

          contentSchemaVersion:
            Number(
              row.contentSchemaVersion
            ),
        })
      ),


    profileTargetingLocations:
      identityMembershipOutput(
        targetingLocations,
        "profileTargetingLocation"
      ),


    profileTargetingJobRoles:
      identityMembershipOutput(
        targetingJobRoles,
        "profileTargetingJobRole"
      ),


    platformReleases:
      identityMembershipOutput(
        platformReleases,
        "platformReleaseId"
      ),


    deploymentConfigurations:
      identityMembershipOutput(
        deploymentConfigurations,
        "deploymentConfigurationId"
      ),

    daily:
      daily.map(
        (value) => ({
          day:
            value.day,

          uniqueVisitors:
            value.visitors.size,

          sessions:
            value.sessions.size,

          activeMs:
            value.activeMs,

          avgActiveMsPerSession:
            value.sessions.size
              ? Math.round(
                  value.activeMs /
                    value.sessions
                      .size
                )
              : 0,

          eventCount:
            value.eventCount,

          fragments:
            value.fragmentCount,
        })
      ),

    engagement: {
      meaningfulSessionCount,

      engagedSessionCount,

      topSessionActiveMsShare:
        Number(
          topSessionActiveMsShare.toFixed(
            4
          )
        ),
    },
  };
}

function buildSessionIntelligence(
  days: string[],

  byDay:
    Map<string, any[]>,

  trafficClassificationBySessionHash:
    TrafficClassificationIndex =
      new Map()
) {
  type LogicalSessionState = {
    sessionHash: string;
    visitorHash: string;

    firstEventAt:
      number | null;

    lastEventAt:
      number | null;

    activeMs:
      number;

    eventCount:
      number;

    fragmentCount:
      number;

    sections:
      Set<string>;

    /**
     * Legacy deployment/content identity.
     *
     * We retain first-fragment timestamps here because the
     * existing response orders profileVersionIds
     * chronologically.
     */
    profileVersions:
      Map<string, number>;


    /**
     * Runtime Profile identity.
     *
     * These sets represent identities observed anywhere
     * across all DynamoDB fragments belonging to this
     * logical session.
     */
    profileVariantIds:
      Set<string>;

    contentSchemaVersions:
      Set<number>;

    profileTargetingLocations:
      Set<string>;

    profileTargetingJobRoles:
      Set<string>;

    platformReleaseIds:
      Set<string>;

    deploymentConfigurationIds:
      Set<string>;


    journey:
      Map<
        string,
        ParsedJourneyEvent
      >;

    journeyTruncated:
      boolean;

    geo:
      {
        firstSeenAt: number;

        countryCode:
          string | null;

        regionCode:
          string | null;

        city:
          string | null;
      } | null;
  };

  const sessions =
    new Map<
      string,
      LogicalSessionState
    >();

  for (const day of days) {
    const items =
      byDay.get(day) || [];

    for (const item of items) {
      const sessionHash =
        safeStr(
          item?.sessionHash,
          80
        );

      const visitorHash =
        safeStr(
          item?.visitorHash,
          80
        );

      if (
        !sessionHash ||
        !visitorHash
      ) {
        continue;
      }

      let state =
        sessions.get(
          sessionHash
        );

      if (!state) {
        state = {
          sessionHash,
          visitorHash,

          firstEventAt:
            null,

          lastEventAt:
            null,

          activeMs:
            0,

          eventCount:
            0,

          fragmentCount:
            0,

          sections:
            new Set<string>(),

          profileVersions:
            new Map<
              string,
              number
            >(),


          profileVariantIds:
            new Set<string>(),

          contentSchemaVersions:
            new Set<number>(),

          profileTargetingLocations:
            new Set<string>(),

          profileTargetingJobRoles:
            new Set<string>(),

          platformReleaseIds:
            new Set<string>(),

          deploymentConfigurationIds:
            new Set<string>(),


          journey:
            new Map<
              string,
              ParsedJourneyEvent
            >(),

          journeyTruncated:
            false,

          geo:
            null,
        };

        sessions.set(
          sessionHash,
          state
        );
      }

      state.fragmentCount +=
        1;

      state.activeMs +=
        numericValue(
          item?.activeMs
        );

      state.eventCount +=
        numericValue(
          item?.eventCount
        );

      const firstEventAt =
        Number(
          item?.firstEventAt
        );

      const lastEventAt =
        Number(
          item?.lastEventAt
        );

      if (
        Number.isFinite(
          firstEventAt
        )
      ) {
        if (
          state.firstEventAt ===
            null ||
          firstEventAt <
            state.firstEventAt
        ) {
          state.firstEventAt =
            firstEventAt;
        }
      }

      if (
        Number.isFinite(
          lastEventAt
        )
      ) {
        if (
          state.lastEventAt ===
            null ||
          lastEventAt >
            state.lastEventAt
        ) {
          state.lastEventAt =
            lastEventAt;
        }
      }

      for (
        const section of
          stringSetValues(
            item?.sectionsSeen
          )
      ) {
        if (
          PUBLIC_SECTIONS.has(
            section
          )
        ) {
          state.sections.add(
            section
          );
        }
      }

      const profileVersionId =
        safeStr(
          item?.profileVersionId,
          120
        ) ||
        "unknown";

      const existingPvTs =
        state.profileVersions.get(
          profileVersionId
        );

      const pvTs =
        Number.isFinite(
          firstEventAt
        )
          ? firstEventAt
          : Number.MAX_SAFE_INTEGER;

      if (
        existingPvTs ===
          undefined ||
        pvTs <
          existingPvTs
      ) {
        state.profileVersions.set(
          profileVersionId,
          pvTs
        );
      }

      /**
       * A logical Analytics session may span multiple
       * DynamoDB boundary fragments and multiple ACTIVE
       * Profile Variants.
       *
       * Union runtime identity across every fragment.
       */
      for (
        const rawProfileVariantId of
          stringSetValues(
            item?.profileVariantIds
          )
      ) {
        const profileVariantId =
          safeStr(
            rawProfileVariantId,
            160
          );

        if (profileVariantId) {
          state
            .profileVariantIds
            .add(
              profileVariantId
            );
        }
      }


      for (
        const contentSchemaVersion of
          positiveIntegerSetValues(
            item?.contentSchemaVersions
          )
      ) {
        state
          .contentSchemaVersions
          .add(
            contentSchemaVersion
          );
      }


      for (
        const rawLocation of
          stringSetValues(
            item
              ?.profileTargetingLocations
          )
      ) {
        const location =
          safeStr(
            rawLocation,
            240
          );

        if (location) {
          state
            .profileTargetingLocations
            .add(location);
        }
      }


      for (
        const rawJobRole of
          stringSetValues(
            item
              ?.profileTargetingJobRoles
          )
      ) {
        const jobRole =
          safeStr(
            rawJobRole,
            240
          );

        if (jobRole) {
          state
            .profileTargetingJobRoles
            .add(jobRole);
        }
      }


      for (
        const rawPlatformReleaseId of
          stringSetValues(
            item?.platformReleaseIds
          )
      ) {
        const platformReleaseId =
          safeStr(
            rawPlatformReleaseId,
            160
          );

        if (platformReleaseId) {
          state
            .platformReleaseIds
            .add(
              platformReleaseId
            );
        }
      }


      for (
        const rawDeploymentConfigurationId of
          stringSetValues(
            item
              ?.deploymentConfigurationIds
          )
      ) {
        const deploymentConfigurationId =
          safeStr(
            rawDeploymentConfigurationId,
            160
          );

        if (
          deploymentConfigurationId
        ) {
          state
            .deploymentConfigurationIds
            .add(
              deploymentConfigurationId
            );
        }
      }

      for (
        const rawToken of
          stringSetValues(
            item?.journeyEvents
          )
      ) {
        const parsed =
          parseJourneyToken(
            rawToken
          );

        if (!parsed) {
          continue;
        }

        const existing =
          state.journey.get(
            parsed.fingerprint
          );

        if (
          !existing ||
          parsed.ts <
            existing.ts
        ) {
          state.journey.set(
            parsed.fingerprint,
            parsed
          );
        }
      }

      if (
        item?.journeyTruncated ===
        true
      ) {
        state.journeyTruncated =
          true;
      }

      const countryCode =
        safeStr(
          item?.countryCode,
          2
        ).toUpperCase();

      const regionCode =
        safeStr(
          item?.regionCode,
          8
        ).toUpperCase();

      const city =
        safeStr(
          item?.city,
          120
        );

      const hasGeo =
        Boolean(
          countryCode ||
          regionCode ||
          city
        );

      if (hasGeo) {
        const geoTs =
          Number.isFinite(
            firstEventAt
          )
            ? firstEventAt
            : Number.MAX_SAFE_INTEGER;

        if (
          !state.geo ||
          geoTs <
            state.geo.firstSeenAt
        ) {
          state.geo = {
            firstSeenAt:
              geoTs,

            countryCode:
              /^[A-Z]{2}$/.test(
                countryCode
              )
                ? countryCode
                : null,

            regionCode:
              regionCode ||
              null,

            city:
              city ||
              null,
          };
        }
      }
    }
  }

  function orderedJourney(
    state:
      LogicalSessionState
  ) {
    return [
      ...state.journey.values(),
    ].sort(
      (a, b) =>
        a.ts -
          b.ts ||
        a.fingerprint.localeCompare(
          b.fingerprint
        )
    );
  }

  function semanticNodeKey(
    event:
      ParsedJourneyEvent
  ) {
    return JSON.stringify([
      event.type,
      event.value,
    ]);
  }

  function collapseConsecutive(
    journey:
      ParsedJourneyEvent[]
  ) {
    const out:
      ParsedJourneyEvent[] =
        [];

    let previousKey =
      "";

    for (
      const event of journey
    ) {
      const key =
        semanticNodeKey(
          event
        );

      if (
        key ===
        previousKey
      ) {
        continue;
      }

      previousKey =
        key;

      out.push(event);
    }

    return out;
  }

  type TransitionState = {
    fromType: string;
    fromValue: string;

    toType: string;
    toValue: string;

    count: number;

    visitors:
      Set<string>;

    sessions:
      Set<string>;
  };

  const transitions =
    new Map<
      string,
      TransitionState
    >();

  type PathState = {
    path:
      string[];

    visitors:
      Set<string>;

    sessions:
      Set<string>;
  };

  const sectionPaths =
    new Map<
      string,
      PathState
    >();

  let sessionsWithJourney =
    0;

  let sessionsWithoutJourney =
    0;

  let journeyTruncatedSessions =
    0;

  for (
    const state of
      sessions.values()
  ) {
    const journey =
      orderedJourney(state);

    if (journey.length) {
      sessionsWithJourney +=
        1;
    } else {
      sessionsWithoutJourney +=
        1;
    }

    if (
      state.journeyTruncated
    ) {
      journeyTruncatedSessions +=
        1;
    }

    const semanticJourney =
      collapseConsecutive(
        journey
      );

    for (
      let i = 0;
      i <
        semanticJourney.length -
          1;
      i += 1
    ) {
      const from =
        semanticJourney[i];

      const to =
        semanticJourney[
          i + 1
        ];

      const key =
        JSON.stringify([
          from.type,
          from.value,
          to.type,
          to.value,
        ]);

      let transition =
        transitions.get(key);

      if (!transition) {
        transition = {
          fromType:
            from.type,

          fromValue:
            from.value,

          toType:
            to.type,

          toValue:
            to.value,

          count:
            0,

          visitors:
            new Set<string>(),

          sessions:
            new Set<string>(),
        };

        transitions.set(
          key,
          transition
        );
      }

      transition.count +=
        1;

      transition.visitors.add(
        state.visitorHash
      );

      transition.sessions.add(
        state.sessionHash
      );
    }

    const sectionPath:
      string[] = [];

    for (
      const event of
        semanticJourney
    ) {
      if (
        event.type !==
          "section" ||
        !PUBLIC_SECTIONS.has(
          event.value
        )
      ) {
        continue;
      }

      sectionPath.push(
        event.value
      );
    }

    if (
      sectionPath.length >= 2
    ) {
      const pathKey =
        JSON.stringify(
          sectionPath
        );

      let pathState =
        sectionPaths.get(
          pathKey
        );

      if (!pathState) {
        pathState = {
          path:
            sectionPath,

          visitors:
            new Set<string>(),

          sessions:
            new Set<string>(),
        };

        sectionPaths.set(
          pathKey,
          pathState
        );
      }

      pathState.visitors.add(
        state.visitorHash
      );

      pathState.sessions.add(
        state.sessionHash
      );
    }
  }

  const recentSessions =
    [
      ...sessions.values(),
    ]
      .sort(
        (a, b) =>
          (
            b.lastEventAt ||
            0
          ) -
            (
              a.lastEventAt ||
              0
            ) ||
          (
            b.firstEventAt ||
            0
          ) -
            (
              a.firstEventAt ||
              0
            )
      )
      .slice(
        0,
        MAX_RECENT_SESSIONS
      )
      .map((state) => {
        const fullJourney =
          orderedJourney(state);

        const journeyOutputTruncated =
          fullJourney.length >
          MAX_RECENT_SESSION_JOURNEY_EVENTS;

        const journey =
          fullJourney
            .slice(
              0,
              MAX_RECENT_SESSION_JOURNEY_EVENTS
            )
            .map(
              (event) => ({
                ts:
                  event.ts,

                type:
                  event.type,

                value:
                  event.value,

                profileVariantId:
                  event.profileVariantId,
              })
            );

        const chronologicalSections:
          string[] = [];

        const sectionSet =
          new Set<string>();

        for (
          const event of
            fullJourney
        ) {
          if (
            event.type !==
              "section" ||
            !PUBLIC_SECTIONS.has(
              event.value
            ) ||
            sectionSet.has(
              event.value
            )
          ) {
            continue;
          }

          sectionSet.add(
            event.value
          );

          chronologicalSections.push(
            event.value
          );
        }

        for (
          const section of
            PUBLIC_SECTION_ORDER
        ) {
          if (
            state.sections.has(
              section
            ) &&
            !sectionSet.has(
              section
            )
          ) {
            chronologicalSections.push(
              section
            );
          }
        }

        const startedAt =
          state.firstEventAt;

        const lastEventAt =
          state.lastEventAt;

        const durationMs =
          startedAt !== null &&
          lastEventAt !== null
            ? Math.max(
                0,
                lastEventAt -
                  startedAt
              )
            : null;

        const profileVersionIds =
          [
            ...state
              .profileVersions
              .entries(),
          ]
            .sort(
              (a, b) =>
                a[1] -
                  b[1] ||
                a[0].localeCompare(
                  b[0]
                )
            )
            .map(
              ([id]) =>
                id
            );

        /**
         * Runtime identity sets do not contain transition
         * timestamps, so expose deterministic set order.
         *
         * Event-time transition history remains available
         * in raw Analytics events.
         */
        const profileVariantIds =
          [
            ...state
              .profileVariantIds,
          ].sort(
            (a, b) =>
              a.localeCompare(b)
          );


        const contentSchemaVersions =
          [
            ...state
              .contentSchemaVersions,
          ].sort(
            (a, b) =>
              a - b
          );


        const profileTargetingLocations =
          [
            ...state
              .profileTargetingLocations,
          ].sort(
            (a, b) =>
              a.localeCompare(b)
          );


        const profileTargetingJobRoles =
          [
            ...state
              .profileTargetingJobRoles,
          ].sort(
            (a, b) =>
              a.localeCompare(b)
          );


        const platformReleaseIds =
          [
            ...state
              .platformReleaseIds,
          ].sort(
            (a, b) =>
              a.localeCompare(b)
          );


        const deploymentConfigurationIds =
          [
            ...state
              .deploymentConfigurationIds,
          ].sort(
            (a, b) =>
              a.localeCompare(b)
          );

        const trafficClassification =
          trafficClassificationBySessionHash
            .get(
              state.sessionHash
            ) ||
          {
            ...classifyTrafficSession({
              eventCount:
                state.eventCount,

              activeMs:
                state.activeMs,

              sectionCount:
                state.sections.size,

              journeyEventCount:
                fullJourney.length,
            }),

            sessionHash:
              state.sessionHash,

            visitorHash:
              state.visitorHash,
          };


        return {
          sessionId:
            `s_${sha256(
              `analytics-session:${state.sessionHash}`
            ).slice(
              0,
              16
            )}`,

          trafficClassifierVersion:
            trafficClassification
              .classifierVersion,

          trafficClassification:
            trafficClassification
              .classification,

          trafficConfidence:
            trafficClassification
              .confidence,

          trafficReasonCodes:
            trafficClassification
              .reasonCodes,

          startedAt,

          lastEventAt,

          durationMs,

          activeMs:
            state.activeMs,

          eventCount:
            state.eventCount,

          fragmentCount:
            state.fragmentCount,

          sections:
            chronologicalSections,

          sectionCount:
            chronologicalSections
              .length,

          profileVersionIds,

          profileVariantIds,

          contentSchemaVersions,

          profileTargetingLocations,

          profileTargetingJobRoles,

          platformReleaseIds,

          deploymentConfigurationIds,

          countryCode:
            state.geo
              ?.countryCode ||
            null,

          regionCode:
            state.geo
              ?.regionCode ||
            null,

          city:
            state.geo
              ?.city ||
            null,

          journeyEventCount:
            fullJourney.length,

          journeyTruncated:
            state
              .journeyTruncated ||
            journeyOutputTruncated,

          journey,
        };
      });

  const topTransitions =
    [
      ...transitions.values(),
    ]
      .map(
        (value) => ({
          from: {
            type:
              value.fromType,

            value:
              value.fromValue,
          },

          to: {
            type:
              value.toType,

            value:
              value.toValue,
          },

          count:
            value.count,

          sessions:
            value.sessions.size,

          visitors:
            value.visitors.size,
        })
      )
      .sort(
        (a, b) =>
          b.count -
            a.count ||
          b.sessions -
            a.sessions ||
          b.visitors -
            a.visitors
      )
      .slice(
        0,
        MAX_TOP_JOURNEY_TRANSITIONS
      );

  const topSectionPaths =
    [
      ...sectionPaths.values(),
    ]
      .map(
        (value) => ({
          path:
            value.path,

          sessions:
            value.sessions.size,

          visitors:
            value.visitors.size,
        })
      )
      .sort(
        (a, b) =>
          b.sessions -
            a.sessions ||
          b.visitors -
            a.visitors
      )
      .slice(
        0,
        MAX_TOP_SECTION_PATHS
      );

  return {
    coverage: {
      logicalSessions:
        sessions.size,

      sessionsWithJourney,

      sessionsWithoutJourney,

      journeyTruncatedSessions,

      recentSessionLimit:
        MAX_RECENT_SESSIONS,
    },

    recentSessions,

    topTransitions,

    topSectionPaths,
  };
}

async function handleQuery(
  event: APIGatewayV2Event
) {
  const origin =
    event.headers?.origin ||
    event.headers?.Origin;

  const headers =
    event.headers || {};

  const cors =
    corsHeaders(origin);

  // Owner-only dashboard.
  if (!(await isOwner(headers))) {
    return json(
      401,
      {
        error:
          "Unauthorized",
      },
      cors
    );
  }

  if (!ANALYTICS_TABLE) {
    return json(
      500,
      {
        error:
          "ANALYTICS_TABLE not configured",
      },
      cors
    );
  }

  const qs =
    event.queryStringParameters ||
    {};

  const fromInput =
    safeStr(
      qs.from || "",
      32
    );

  const toInput =
    safeStr(
      qs.to || "",
      32
    );

  const rawProfileVersion =
    safeStr(
      qs.profileVersionId || "",
      120
    );

  // Missing or "all" means all releases.
  const profileVersionFilter =
    !rawProfileVersion ||
    rawProfileVersion.toLowerCase() ===
      "all"
      ? null
      : rawProfileVersion;

    const rawProfileVariant =
    typeof qs.profileVariantId ===
      "string"
      ? qs.profileVariantId
          .trim()
      : "";

  let profileVariantFilter:
    string | null =
      null;

  if (
    rawProfileVariant &&
    rawProfileVariant
      .toLowerCase() !==
      "all"
  ) {
    if (
      rawProfileVariant.length >
        160 ||
      !/^[A-Za-z0-9._:-]+$/.test(
        rawProfileVariant
      )
    ) {
      return json(
        400,
        {
          error:
            "Invalid 'profileVariantId' filter.",
        },
        cors
      );
    }

    profileVariantFilter =
      rawProfileVariant;
  }


  const rawTargetingLocation =
    typeof qs
      .profileTargetingLocation ===
      "string"
      ? qs
          .profileTargetingLocation
          .trim()
      : "";

  let profileTargetingLocationFilter:
    string | null =
      null;

  if (
    rawTargetingLocation &&
    rawTargetingLocation
      .toLowerCase() !==
      "all"
  ) {
    if (
      rawTargetingLocation.length >
      240
    ) {
      return json(
        400,
        {
          error:
            "Invalid 'profileTargetingLocation' filter.",
        },
        cors
      );
    }

    profileTargetingLocationFilter =
      rawTargetingLocation;
  }


  const rawTargetingJobRole =
    typeof qs
      .profileTargetingJobRole ===
      "string"
      ? qs
          .profileTargetingJobRole
          .trim()
      : "";

  let profileTargetingJobRoleFilter:
    string | null =
      null;

  if (
    rawTargetingJobRole &&
    rawTargetingJobRole
      .toLowerCase() !==
      "all"
  ) {
    if (
      rawTargetingJobRole.length >
      240
    ) {
      return json(
        400,
        {
          error:
            "Invalid 'profileTargetingJobRole' filter.",
        },
        cors
      );
    }

    profileTargetingJobRoleFilter =
      rawTargetingJobRole;
  }


  const runtimeProfileFilter:
    RuntimeProfileFilter = {
      profileVariantId:
        profileVariantFilter,

      profileTargetingLocation:
        profileTargetingLocationFilter,

      profileTargetingJobRole:
        profileTargetingJobRoleFilter,
    };

  const rawTrafficClassification =
    safeStr(
      qs
        .trafficClassification ||
        "",
      40
    );


  const trafficClassificationFilter =
    normalizeTrafficClassificationFilter(
      rawTrafficClassification
    );


  if (
    trafficClassificationFilter ===
      null
  ) {
    return json(
      400,
      {
        error:
          "Invalid 'trafficClassification' filter.",
      },
      cors
    );
  }


  const rawBoundaryId =
    safeStr(
      qs.boundaryId || "",
      120
    );

  const boundaryId =
    !rawBoundaryId ||
    rawBoundaryId
      .toLowerCase() === "all"
      ? ""
      : rawBoundaryId;

  let boundaryFilter:
    AnalyticsBoundaryRecord | null =
      null;

  if (boundaryId) {
    boundaryFilter =
      await getAnalyticsBoundaryById(
        boundaryId
      );

    if (!boundaryFilter) {
      return json(
        404,
        {
          error:
            "Analytics boundary not found.",
        },
        cors
      );
    }
  }

  const resolvedFromInput =
    fromInput ||
    (
      boundaryFilter
        ? ymd(
            boundaryFilter
              .effectiveAt
          )
        : ""
    );

  const range =
    resolveQueryRange(
      resolvedFromInput,
      toInput
    );

  if (!range.ok) {
    return json(
      400,
      {
        error:
          range.error,
      },
      cors
    );
  }

  const byDay =
    await queryRangeSessionFragments(
      range.days,
      profileVersionFilter,
      boundaryFilter
    );


  /**
   * Classification comes from one canonical logical-session
   * state independent of the requested date/release/boundary/
   * Profile scope.
   *
   * The query window controls which metrics are counted, not
   * how the logical session itself is classified.
   */
  const trafficClassificationIndex =
    await buildTrafficClassificationIndex(
      byDay
    );


  const analyticsByDay =
    projectRuntimeProfileFilteredFragments(
      byDay,
      runtimeProfileFilter
    );


  /**
   * Composition remains visible even while one classification
   * is selected. This summary is scoped by the other Analytics
   * filters, but intentionally precedes the Traffic filter.
   */
  const trafficClassification =
    buildTrafficClassificationSummary(
      analyticsByDay,

      trafficClassificationIndex
    );


  const trafficFilteredAnalyticsByDay =
    filterSessionFragmentsByTraffic(
      analyticsByDay,

      trafficClassificationIndex,

      trafficClassificationFilter
    );


  const visitorHashes =
    collectVisitorHashes(
      trafficFilteredAnalyticsByDay
    );

  const visitorFirstSeenByHash =
    await queryVisitorFirstSeen(
      visitorHashes
    );

  const dayStartTs =
    Date.parse(
      `${range.from}T00:00:00Z`
    );

  const effectiveRangeStartTs =
    boundaryFilter
      ? Math.max(
          dayStartTs,
          boundaryFilter
            .effectiveAt
        )
      : dayStartTs;

  const analytics =
    aggregateSessionFragments(
      range.days,

      trafficFilteredAnalyticsByDay,

      profileVersionFilter,

      runtimeProfileFilter,

      trafficClassificationFilter,

      visitorFirstSeenByHash,

      effectiveRangeStartTs,

      boundaryFilter
    );


  const sessionIntelligence =
    buildSessionIntelligence(
      range.days,

      trafficFilteredAnalyticsByDay,

      trafficClassificationIndex
    );

  /**
   * Computed from the same already-filtered aggregate every other
   * field in this response comes from, so it automatically respects
   * every active filter, including traffic classification.
   */
  const outreachScore =
    computeOutreachScoreV1({
      overview:
        analytics.overview,

      sections:
        analytics.sections,

      ctas:
        analytics.ctas,

      projects:
        analytics.projects,

      deepLinks:
        analytics.deepLinks,

      engagement:
        analytics.engagement,

      totalSectionCount:
        PUBLIC_SECTION_ORDER.length,
    });

  return json(
    200,
    {
      ok: true,
      stage: STAGE,

      ...analytics,

      trafficClassification,

      sessionIntelligence,

      outreachScore,
    },
    cors
  );
}

export async function handler(
  event: APIGatewayV2Event
) {
  try {
    const path = String(
      event.rawPath ||
        event.path ||
        ""
    );

    const method = String(
      event.requestContext?.http?.method ||
        event.httpMethod ||
        "GET"
    ).toUpperCase();

    // OPTIONS for CORS
    if (method === "OPTIONS") {
      const origin =
        event.headers?.origin ||
        event.headers?.Origin;

      return {
        statusCode: 204,
        headers:
          corsHeaders(origin),
        body: "",
      };
    }

    if (
      path.endsWith(
        "/analytics/ingest"
      )
    ) {
      return await handleIngest(
        event
      );
    }

    if (
      path.endsWith(
        "/analytics/query"
      )
    ) {
      return await handleQuery(
        event
      );
    }

    if (
      path.endsWith(
        "/analytics/meta"
      ) &&
      method === "GET"
    ) {
      return await handleAnalyticsMeta(
        event
      );
    }

    if (
      path.endsWith(
        "/analytics/releases"
      ) &&
      method === "POST"
    ) {
      return await handleRegisterRelease(
        event
      );
    }

    if (
      path.endsWith(
        "/analytics/boundaries"
      ) &&
      method === "POST"
    ) {
      return await handleCreateBoundary(
        event
      );
    }

    return json(
      404,
      {
        error: "Not found",
        path,
      },
      corsHeaders(
        event.headers?.origin
      )
    );
  } catch (e: any) {
    // Do not log event payloads because analytics requests
    // may contain identifiers / diagnostic metadata.
    console.error(
      "Analytics handler failed",
      {
        error: String(
          e?.message || e
        ),
        name:
          String(e?.name || ""),
      }
    );

    return json(
      500,
      {
        error: String(
          e?.message || e
        ),
      },
      corsHeaders()
    );
  }
}
