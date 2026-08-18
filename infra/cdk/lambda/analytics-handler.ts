// lambda/analytics-handler.ts

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import {
  DynamoDBClient,
  UpdateItemCommand,
  GetItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import crypto from "crypto";

console.log("RAW EVENT:", JSON.stringify(event));

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
  const ts = typeof e?.ts === "number" ? e.ts : Date.now();
  return {
    type: safeStr(e?.type, 64),
    ts,
    sessionId: safeStr(e?.sessionId, 120),
    visitorId: safeStr(e?.visitorId, 120),
    tabId: safeStr(e?.tabId, 120) || null,
    profileVersionId: safeStr(e?.profileVersionId, 120) || "unknown",

    section: e?.section ? safeStr(e.section, 80) : null,
    ctaId: e?.ctaId ? safeStr(e.ctaId, 80) : null,
    projectId: e?.projectId ? safeStr(e.projectId, 120) : null,
    snippetId: e?.snippetId ? safeStr(e.snippetId, 160) : null,

    depthPct: typeof e?.depthPct === "number" ? Math.max(0, Math.min(100, e.depthPct)) : null,
    ms: typeof e?.ms === "number" ? Math.max(0, e.ms) : null,

    path: e?.path ? safeStr(e.path, 240) : null,
    hash: e?.hash ? safeStr(e.hash, 240) : null,
  };
}

type IncMap = Record<string, number>;
type AggDelta = {
  sessionCount: number;
  sectionViews: IncMap;
  sectionTimeMs: IncMap;
  ctaCounts: IncMap;
  funnelSteps: IncMap;
  countrySessions: IncMap;
  deepLinks: IncMap;
  projectOpens: IncMap;
  snippetViews: IncMap;
};

function emptyDelta(): AggDelta {
  return {
    sessionCount: 0,
    sectionViews: {},
    sectionTimeMs: {},
    ctaCounts: {},
    funnelSteps: {},
    countrySessions: {},
    deepLinks: {},
    projectOpens: {},
    snippetViews: {},
  };
}

function inc(map: IncMap, key: string, by = 1) {
  if (!key) return;
  map[key] = (map[key] || 0) + by;
}

function buildDelta(events: any[], countryCode: string | null) {
  const d = emptyDelta();

  // We only count a "session" once per sessionId per batch, when we see session_start.
  // (Client should send session_start once per session overall.)
  for (const e of events) {
    const t = e.type;

    if (t === "session_start") d.sessionCount += 1;

    if (t === "section_view" && e.section) inc(d.sectionViews, e.section, 1);

    if (t === "section_time" && e.section && typeof e.ms === "number") inc(d.sectionTimeMs, e.section, e.ms);

    if (t === "cta_click" && e.ctaId) inc(d.ctaCounts, e.ctaId, 1);

    if (t === "funnel_step" && e.section) inc(d.funnelSteps, e.section, 1);

    if (t === "deep_link" && (e.hash || e.path)) inc(d.deepLinks, e.hash || e.path, 1);

    if (t === "project_open" && e.projectId) inc(d.projectOpens, e.projectId, 1);

    if (t === "code_snippet_view" && e.snippetId) inc(d.snippetViews, e.snippetId, 1);
  }

  // Count country sessions based on session_start only (avoid inflation)
  if (countryCode) {
    // add once per session_start
    const starts = events.filter((e) => e.type === "session_start").length;
    if (starts > 0) inc(d.countrySessions, countryCode, starts);
  }

  return d;
}

function buildUpdateExpression(dayKey: string, pvKey: string, delta: AggDelta) {
  // DynamoDB item:
  // pk = DAY#YYYY-MM-DD
  // sk = PV#<profileVersionId>
  // metrics.* are maps
  const exprNames: Record<string, string> = {
    "#pk": "pk",
    "#sk": "sk",
    "#updatedAt": "updatedAt",
    "#metrics": "metrics",
  };

  const exprValues: Record<string, any> = {
    ":zero": 0,
    ":now": nowIso(),
  };

  const sets: string[] = [];
  const adds: string[] = [];

  sets.push("#updatedAt = :now");

  // numeric top-level sessionCount
  if (delta.sessionCount) {
    exprNames["#sessionCount"] = "sessionCount";
    exprValues[":sc"] = delta.sessionCount;
    adds.push("#sessionCount :sc");
  }

  function mapAdds(mapName: string, map: IncMap, prefix: string) {
    if (!Object.keys(map).length) return;

    exprNames[`#${prefix}`] = mapName;
    // ensure metrics exists
    // We store these maps under metrics.<mapName>
    for (const [k, v] of Object.entries(map)) {
      const nk = `#${prefix}_${sha256(k).slice(0, 10)}`; // stable safe name
      const vk = `:${prefix}_${sha256(k).slice(0, 10)}`;

      exprNames[nk] = k;
      exprValues[vk] = v;

      // ADD on map keys is not supported directly.
      // We do SET metrics.map.key = if_not_exists(...,0) + :inc
      sets.push(
        `#metrics.#${prefix}.${nk} = if_not_exists(#metrics.#${prefix}.${nk}, :zero) + ${vk}`
      );
    }
  }

  mapAdds("sectionViews", delta.sectionViews, "sv");
  mapAdds("sectionTimeMs", delta.sectionTimeMs, "stm");
  mapAdds("ctaCounts", delta.ctaCounts, "cta");
  mapAdds("funnelSteps", delta.funnelSteps, "fnl");
  mapAdds("countrySessions", delta.countrySessions, "cty");
  mapAdds("deepLinks", delta.deepLinks, "dl");
  mapAdds("projectOpens", delta.projectOpens, "proj");
  mapAdds("snippetViews", delta.snippetViews, "snip");

  // Ensure metrics map exists
  exprValues[":emptyMap"] = {};
  sets.unshift("#metrics = if_not_exists(#metrics, :emptyMap)");

  const updateExpressionParts: string[] = [];
  if (sets.length) updateExpressionParts.push(`SET ${sets.join(", ")}`);
  if (adds.length) updateExpressionParts.push(`ADD ${adds.join(", ")}`);

  return {
    Key: marshall({ pk: dayKey, sk: pvKey }),
    ExpressionAttributeNames: exprNames,
    ExpressionAttributeValues: marshall(exprValues),
    UpdateExpression: updateExpressionParts.join(" "),
  };
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

  const owner = isOwner(headers);
  const ip = getClientIp(event);
  const geo = getGeoFromHeaders(headers);

  let payload: any = {};
  try {
    payload = event.body ? JSON.parse(event.body) : {};
  } catch {
    return json(400, { error: "Invalid JSON" }, cors);
  }

  const rawEvents = Array.isArray(payload?.events) ? payload.events : [];
  if (!rawEvents.length) {
    return json(200, { ok: true, accepted: 0 }, cors);
  }

  // Normalize
  const events = rawEvents
    .map(normalizeEvent)
    .filter((e: ReturnType<typeof normalizeEvent>) => Boolean(e.type && e.sessionId && e.visitorId));

  // If owner: we accept but mark owner=true.
  // Dashboard will exclude owner by default.
  const pv = safeStr(events[0]?.profileVersionId || payload?.profileVersionId || "unknown", 120);

  // We aggregate per day (UTC) based on event.ts
  // If batch spans days, we split.
  const byDay = new Map<string, any[]>();
  for (const e of events) {
    const day = ymd(e.ts);
    const arr = byDay.get(day) || [];
    arr.push(e);
    byDay.set(day, arr);
  }

  const accepted: any[] = [];
  for (const [day, dayEvents] of byDay.entries()) {
    const dayKey = `DAY#${day}`;
    const pvKey = `PV#${pv}`;

    // build delta from this day's events
    const delta = buildDelta(dayEvents, geo.countryCode);

    // Write aggregate to DynamoDB
    if (ANALYTICS_TABLE) {
      const update = buildUpdateExpression(dayKey, pvKey, delta);

      await ddb.send(
        new UpdateItemCommand({
          TableName: ANALYTICS_TABLE,
          ...update,
        })
      );
    }

    // Store raw batch in S3 for 30 days retention (cheap + useful for debugging)
    const rawKey = await putRawBatchToS3({
      day,
      profileVersionId: pv,
      owner,
      ip,
      geo: { ...geo, ip: ip || null }, // you asked: OK to store IP; kept in raw only
      headers,
      events: dayEvents,
    });

    accepted.push({ day, pv, count: dayEvents.length, rawKey: rawKey || null });
  }

  return json(200, { ok: true, accepted }, cors);
}

async function handleQuery(event: APIGatewayV2Event) {
  const origin = event.headers?.origin || event.headers?.Origin;
  const headers = event.headers || {};
  const cors = corsHeaders(origin);

  // owner-only
  if (!isOwner(headers)) {
    return json(401, { error: "Unauthorized" }, cors);
  }

  const qs = event.queryStringParameters || {};
  const pv = safeStr(qs.profileVersionId || "unknown", 120);
  const from = safeStr(qs.from || "", 32); // YYYY-MM-DD
  const to = safeStr(qs.to || "", 32);

  // Default: last 7 days (UTC)
  const end = to ? new Date(`${to}T00:00:00Z`).getTime() : Date.now();
  const start = from
    ? new Date(`${from}T00:00:00Z`).getTime()
    : end - 7 * 24 * 3600 * 1000;

  const days: string[] = [];
  for (let t = start; t <= end; t += 24 * 3600 * 1000) {
    days.push(ymd(t));
  }

  const items: any[] = [];
  for (const day of days) {
    const pk = `DAY#${day}`;
    const sk = `PV#${pv}`;

    const res = await ddb.send(
      new GetItemCommand({
        TableName: ANALYTICS_TABLE,
        Key: marshall({ pk, sk }),
      })
    );

    if (res.Item) {
      items.push(unmarshall(res.Item));
    } else {
      items.push({
        pk,
        sk,
        sessionCount: 0,
        metrics: {},
        updatedAt: null,
      });
    }
  }

  // Shape response for dashboard
  const out = items.map((it) => {
    const day = String(it.pk || "").replace("DAY#", "");
    return {
      day,
      profileVersionId: pv,
      sessionCount: it.sessionCount || 0,
      metrics: it.metrics || {},
      updatedAt: it.updatedAt || null,
    };
  });

  return json(200, { ok: true, pv, from: days[0], to: days.at(-1), days: out }, cors);
}

export async function handler(event: APIGatewayV2Event) {
  try {
    const path = String(event.rawPath || event.path || "");
    const method = String(event.requestContext?.http?.method || event.httpMethod || "GET").toUpperCase();

    // OPTIONS for CORS
    if (method === "OPTIONS") {
      const origin = event.headers?.origin || event.headers?.Origin;
      return { statusCode: 204, headers: corsHeaders(origin), body: "" };
    }

    if (path.endsWith("/analytics/ingest")) return await handleIngest(event);
    if (path.endsWith("/analytics/query")) return await handleQuery(event);

    return json(404, { error: "Not found", path }, corsHeaders(event.headers?.origin));
  } catch (e: any) {
    return json(500, { error: String(e?.message || e) }, corsHeaders());
  }
}
