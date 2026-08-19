// lambda/analytics-handler.ts

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import {
  DynamoDBClient,
  UpdateItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import * as crypto from "node:crypto";


type APIGatewayV2Event = any;

const s3 = new S3Client({});
const ddb = new DynamoDBClient({});

const {
  ANALYTICS_EVENTS_BUCKET = "",
  ANALYTICS_TABLE = "",
  OWNER_TOKEN = "",
  ALLOWED_ORIGINS = "",
  STAGE = "dev",
} = process.env;

const allowedOrigins = new Set(
  String(ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);

const MAX_EVENTS_PER_BATCH = 50;

const MAX_EVENT_AGE_MS =
  24 * 60 * 60 * 1000;

const MAX_FUTURE_SKEW_MS =
  5 * 60 * 1000;

const DAY_MS =
  24 * 60 * 60 * 1000;

const DEFAULT_QUERY_DAYS = 7;

// Exact daily-partition querying is excellent for our scale,
// but we intentionally prevent accidental multi-year runaway queries.
//
// Phase 7 can introduce monthly historical rollups if we eventually
// want an effectively-unbounded "All Time" view.
const MAX_QUERY_DAYS = 366;

const QUERY_CONCURRENCY = 10;

const PUBLIC_SECTION_ORDER = [
  "About Me",
  "Experience",
  "Skills",
  "Education",
  "Resume",
  "Projects",
  "Code Lab",
  "Fun Zone",
  "Timeline",
] as const;

const PUBLIC_SECTIONS = new Set<string>(
  PUBLIC_SECTION_ORDER
);

const ALLOWED_EVENT_TYPES = new Set([
  "session_start",
  "section_view",
  "section_time",
  "scroll_depth",
  "cta_click",
  "deep_link",
  "project_open",
  "code_snippet_view",
]);

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

function isOwner(headers: Record<string, string>) {
  const token = String(headers["x-owner-token"] || headers["X-Owner-Token"] || "").trim();
  return Boolean(OWNER_TOKEN && token && token === OWNER_TOKEN);
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

function isBot(headers: Record<string, string>) {
  // lightweight bot filter (cheap + fast; you can expand later)
  const ua = String(headers["user-agent"] || headers["User-Agent"] || "").toLowerCase();
  if (!ua) return true;
  const bad = [
    "bot",
    "spider",
    "crawler",
    "headless",
    "lighthouse",
    "pingdom",
    "uptimerobot",
    "facebookexternalhit",
    "slackbot",
  ];
  return bad.some((b) => ua.includes(b));
}

function getClientIp(event: APIGatewayV2Event) {
  // HTTP API v2: requestContext.http.sourceIp
  const ip = event?.requestContext?.http?.sourceIp;
  return ip ? String(ip) : "";
}

function getGeoFromHeaders(headers: Record<string, string>) {
  // Prefer CloudFront headers if you later put API behind CloudFront
  // (or Cloudflare if you ever do)
  const country =
    headers["cloudfront-viewer-country"] ||
    headers["CloudFront-Viewer-Country"] ||
    headers["cf-ipcountry"] ||
    headers["CF-IPCountry"] ||
    "";

  // Region/city typically require paid geo DB or edge enrichment; keep null for now.
  return {
    countryCode: country ? String(country).slice(0, 2).toUpperCase() : null,
    region: null,
    city: null,
  };
}

function sha256(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
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
        ? safeStr(e.path, 240)
        : null,

    hash:
      e?.hash
        ? safeStr(e.hash, 240)
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

function buildSessionFragmentInit(
  event: NonNullable<
    ReturnType<typeof normalizeEvent>
  >,
  countryCode: string | null
) {
  const day = ymd(event.ts);

  const pk = `DAY#${day}`;

  const sk =
    `PV#${event.profileVersionId}` +
    `#SESSION#${event.sessionHash}`;

  const metrics = {
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
  };

  const values: Record<string, any> = {
    ":visitorHash": event.visitorHash,
    ":sessionHash": event.sessionHash,
    ":profileVersionId":
      event.profileVersionId,
    ":eventTs": event.ts,
    ":now": nowIso(),
    ":metrics": metrics,
  };

  const sets = [
    "#visitorHash = if_not_exists(#visitorHash, :visitorHash)",
    "#sessionHash = if_not_exists(#sessionHash, :sessionHash)",
    "#profileVersionId = if_not_exists(#profileVersionId, :profileVersionId)",
    "#firstEventAt = if_not_exists(#firstEventAt, :eventTs)",
    "#lastEventAt = if_not_exists(#lastEventAt, :eventTs)",
    "#updatedAt = if_not_exists(#updatedAt, :now)",
    "#metrics = if_not_exists(#metrics, :metrics)",
  ];

  if (countryCode) {
    names["#countryCode"] =
      "countryCode";

    values[":countryCode"] =
      countryCode;

    sets.push(
      "#countryCode = if_not_exists(#countryCode, :countryCode)"
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
    ReturnType<typeof normalizeEvent>
  >
) {
  const day = ymd(event.ts);

  const pk = `DAY#${day}`;

  const sk =
    `PV#${event.profileVersionId}` +
    `#SESSION#${event.sessionHash}`;

  const names: Record<string, string> = {
    "#processedEventIds": "processedEventIds",
    "#eventCount": "eventCount",
    "#lastEventAt": "lastEventAt",
    "#updatedAt": "updatedAt",
  };

  const values: Record<string, any> = {
    ":eventId": event.eventId,
    ":eventIds": new Set([event.eventId]),
    ":one": 1,
    ":eventTs": event.ts,
    ":now": nowIso(),
  };

  let metricsExpressionReady = false;

  function ensureMetricsExpression() {
    if (metricsExpressionReady) return;

    names["#metrics"] = "metrics";
    values[":zero"] = 0;

    metricsExpressionReady = true;
  }

  const sets: string[] = [
    "#lastEventAt = :eventTs",
    "#updatedAt = :now",
  ];

  const adds: string[] = [
    "#processedEventIds :eventIds",
    "#eventCount :one",
  ];

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
  }

  return {
    Key: marshall({ pk, sk }),

    ExpressionAttributeNames: names,

    ExpressionAttributeValues:
      marshall(values),

    ConditionExpression:
      "attribute_not_exists(#processedEventIds) " +
      "OR NOT contains(#processedEventIds, :eventId)",

    UpdateExpression:
      `SET ${sets.join(", ")} ` +
      `ADD ${adds.join(", ")}`,
  };
}

async function applyEventToSessionFragment(
  event: NonNullable<
    ReturnType<typeof normalizeEvent>
  >,
  countryCode: string | null
) {
  if (!ANALYTICS_TABLE) {
    return {
      accepted: false,
      duplicate: false,
    };
  }

  const init =
    buildSessionFragmentInit(
      event,
      countryCode
    );

  await ddb.send(
    new UpdateItemCommand({
      TableName:
        ANALYTICS_TABLE,
      ...init,
    })
  );

  const update =
    buildSessionEventUpdate(event);

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
    };
  } catch (e: any) {
    if (
      e?.name ===
      "ConditionalCheckFailedException"
    ) {
      return {
        accepted: false,
        duplicate: true,
      };
    }

    throw e;
  }
}


async function putRawBatchToS3(params: {
  day: string;
  profileVersionId: string;
  owner: boolean;
  ip?: string;
  geo?: any;
  headers?: any;
  events: any[];
}) {
  if (!ANALYTICS_EVENTS_BUCKET) return;

  const ts = Date.now();
  const key = [
    "analytics-events",
    `day=${params.day}`,
    `pv=${params.profileVersionId || "unknown"}`,
    `owner=${params.owner ? "1" : "0"}`,
    `${ts}-${crypto.randomBytes(6).toString("hex")}.json`,
  ].join("/");

  const body = JSON.stringify({
    schema: "tejas-profile.analytics.batch.v1",
    receivedAt: nowIso(),
    day: params.day,
    profileVersionId: params.profileVersionId,
    owner: params.owner,
    ip: params.ip || null,
    geo: params.geo || null,
    // keep a tiny header subset only
    ua: safeStr(params.headers?.["user-agent"] || params.headers?.["User-Agent"] || "", 400),
    events: params.events,
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

async function handleIngest(event: APIGatewayV2Event) {
  const origin = event.headers?.origin || event.headers?.Origin;
  const headers = event.headers || {};
  const cors = corsHeaders(origin);

  if (event.requestContext?.http?.method === "OPTIONS") {
    return { statusCode: 204, headers: cors, body: "" };
  }

  // basic bot filter (doesn’t have to be perfect)
  if (isBot(headers)) {
    return json(204, { ok: true, ignored: "bot" }, cors);
  }

  // Owner traffic is not analytics traffic.
  //
  // Client-side exclusion is the primary mechanism, but this is the
  // server-side safety net. Owner events are neither aggregated nor
  // written to raw analytics storage.
  if (isOwner(headers)) {
    return {
      statusCode: 204,
      headers: cors,
      body: "",
    };
  }

  const ip = getClientIp(event);
  const geo = getGeoFromHeaders(headers);

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

  // Normalize
  const events = rawEvents
    .map(normalizeEvent)
    .filter(
      (
        e: ReturnType<typeof normalizeEvent>
      ): e is NonNullable<
        ReturnType<typeof normalizeEvent>
      > => e !== null
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

  let acceptedCount = 0;
  let duplicateCount = 0;

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
    const result =
      await applyEventToSessionFragment(
        analyticsEvent,
        geo.countryCode
      );

    if (result.accepted) {
      acceptedCount += 1;
    }

    if (result.duplicate) {
      duplicateCount += 1;
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

        ip,

        geo: {
          ...geo,
          ip: ip || null,
        },

        headers,

        events: group.events,
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

      rawBatches,
    },
    cors
  );
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
  profileVersionId: string | null
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

      items.push(item);
    }

    lastEvaluatedKey =
      result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return items;
}

async function queryRangeSessionFragments(
  days: string[],
  profileVersionId: string | null
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
          profileVersionId
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

function aggregateSessionFragments(
  days: string[],
  byDay: Map<string, any[]>,
  profileVersionFilter:
    string | null
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
    sessionHash: string
  ) {
    for (
      const [key, amount]
      of Object.entries(
        numericMap(source)
      )
    ) {
      const counter =
        getInteractionCounter(
          target,
          key
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
        sessionHash
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
    }
  }

  // -----------------------------
  // Overall KPIs
  // -----------------------------

  const sessionCount =
    sessions.size;

  const uniqueVisitors =
    visitors.size;

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

  return {
    range: {
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
    },

    overview: {
      uniqueVisitors,

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
  if (!isOwner(headers)) {
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

  const range =
    resolveQueryRange(
      fromInput,
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
      profileVersionFilter
    );

  const analytics =
    aggregateSessionFragments(
      range.days,
      byDay,
      profileVersionFilter
    );

  return json(
    200,
    {
      ok: true,
      stage: STAGE,
      ...analytics,
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
