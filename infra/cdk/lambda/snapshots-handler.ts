import {
  S3Client,
  ListObjectsV2Command,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

type Event = {
  requestContext?: { http?: { method?: string; path?: string } };
  rawPath?: string;
  rawQueryString?: string;
  queryStringParameters?: Record<string, string>;
  headers?: Record<string, string>;
  body?: string | null;
};

const s3 = new S3Client({});

const BUCKET = process.env.SNAPSHOTS_BUCKET!;
const PREFIX = process.env.SNAPSHOTS_PREFIX || "snapshots/";
const OWNER_TOKEN = process.env.OWNER_TOKEN || "";
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function getHeader(headers: Record<string, string> | undefined, key: string) {
  if (!headers) return "";
  const k = Object.keys(headers).find((h) => h.toLowerCase() === key.toLowerCase());
  return k ? headers[k] : "";
}

function pickCorsOrigin(headers: Record<string, string> | undefined) {
  const origin = getHeader(headers, "origin");
  if (!origin) return ""; // non-browser clients (curl) won’t send origin
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  return ""; // not allowed
}

function baseHeaders(corsOrigin: string) {
  // Echo Origin only if allowed; also add Vary: Origin for caches
  const h: Record<string, string> = {
    "content-type": "application/json",
    "access-control-allow-headers": "content-type,x-owner-token",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "vary": "Origin",
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

function requireOwner(headers: Record<string, string> | undefined) {
  if (!OWNER_TOKEN) return { ok: false, status: 500, msg: "OWNER_TOKEN not configured" };
  const token = getHeader(headers, "x-owner-token");
  if (!token || token.trim() !== OWNER_TOKEN) {
    return { ok: false, status: 401, msg: "Unauthorized" };
  }
  return { ok: true as const };
}

function safeKeyPart(s: string) {
  return (s || "").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
}

export async function handler(event: Event) {
  const path = event.rawPath || event.requestContext?.http?.path || "";
  const method = (event.requestContext?.http?.method || "").toUpperCase();

  const corsOrigin = pickCorsOrigin(event.headers);

  // Helpful logs for debugging “Failed to fetch”
  console.log("REQ", {
    method,
    path,
    origin: getHeader(event.headers, "origin"),
    hasOwnerHeader: Boolean(getHeader(event.headers, "x-owner-token")),
    corsAllowed: Boolean(corsOrigin),
  });

  // If browser is preflighting, reply safely.
  if (method === "OPTIONS") return json(200, { ok: true }, corsOrigin);

  // If origin is present but not allowed, return explicit 403 (so you SEE it in Network tab)
  const origin = getHeader(event.headers, "origin");
  if (origin && !corsOrigin) {
    return json(403, { ok: false, error: "CORS origin not allowed", origin }, "");
  }

  const auth = requireOwner(event.headers);
  if (!auth.ok) return json(auth.status, { ok: false, error: auth.msg }, corsOrigin);

  // POST /snapshots/presign-put
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
    const createdAt = safeKeyPart(payload.createdAt || new Date().toISOString());

    const key = `${PREFIX}${name}/from_${from}_to_${to}/${name}__${from}__${to}__${createdAt}.json`;

    const cmd = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: "application/json",
    });

    const url = await getSignedUrl(s3, cmd, { expiresIn: 60 });
    return json(200, { ok: true, key, url }, corsOrigin);
  }

  // GET /snapshots/list
  if (method === "GET" && path.endsWith("/snapshots/list")) {
    const cmd = new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: PREFIX,
      MaxKeys: 200,
    });

    const res = await s3.send(cmd);
    const items =
      (res.Contents || [])
        .filter((o) => o.Key && o.Key.endsWith(".json"))
        .map((o) => ({
          key: o.Key!,
          size: o.Size ?? 0,
          lastModified: o.LastModified ? o.LastModified.toISOString() : null,
        }))
        .sort((a, b) => (b.lastModified || "").localeCompare(a.lastModified || ""));

    return json(200, { ok: true, items }, corsOrigin);
  }

  // GET /snapshots/presign-get?key=...
  if (method === "GET" && path.endsWith("/snapshots/presign-get")) {
    const key = event.queryStringParameters?.key || "";
    if (!key || !key.startsWith(PREFIX)) {
      return json(400, { ok: false, error: "Invalid key" }, corsOrigin);
    }

    const cmd = new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    });

    const url = await getSignedUrl(s3, cmd, { expiresIn: 60 });
    return json(200, { ok: true, key, url }, corsOrigin);
  }

  return json(404, { ok: false, error: "Not found" }, corsOrigin);
}
