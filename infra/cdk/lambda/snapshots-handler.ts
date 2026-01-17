// infra/cdk/lambda/snapshots-handler.ts

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
  routeKey?: string;
  rawQueryString?: string;
  queryStringParameters?: Record<string, string>;
  headers?: Record<string, string>;
  body?: string | null;
};

const s3 = new S3Client({});

const BUCKET = process.env.SNAPSHOTS_BUCKET!;
const PREFIX = process.env.SNAPSHOTS_PREFIX || "snapshots/";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const OWNER_TOKEN = process.env.OWNER_TOKEN || "";

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": ALLOWED_ORIGIN,
      "access-control-allow-headers": "content-type,x-owner-token",
      "access-control-allow-methods": "GET,POST,OPTIONS",
    },
    body: JSON.stringify(body),
  };
}

function getHeader(headers: Record<string, string> | undefined, key: string) {
  if (!headers) return "";
  const found = Object.keys(headers).find(
    (h) => h.toLowerCase() === key.toLowerCase()
  );
  return found ? headers[found] : "";
}

function requireOwner(headers: Record<string, string> | undefined) {
  if (!OWNER_TOKEN) {
    return { ok: false as const, status: 500, msg: "OWNER_TOKEN not configured" };
  }

  const token = getHeader(headers, "x-owner-token");
  if (!token || token.trim() !== OWNER_TOKEN) {
    return { ok: false as const, status: 401, msg: "Unauthorized" };
  }

  // Optional: origin guard (browser calls)
  const origin = getHeader(headers, "origin");
  if (ALLOWED_ORIGIN !== "*" && origin && origin !== ALLOWED_ORIGIN) {
    return { ok: false as const, status: 403, msg: "Forbidden (origin)" };
  }

  return { ok: true as const };
}

function safeKeyPart(s: string) {
  return (s || "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .slice(0, 80);
}

function getPath(event: Event) {
  // HttpApi v2 uses rawPath; sometimes requestContext.http.path exists.
  return event.rawPath || event.requestContext?.http?.path || "";
}

function getMethod(event: Event) {
  return (event.requestContext?.http?.method || "").toUpperCase();
}

// ✅ MUST be a named export called "handler" for Lambda
export const handler = async (event: Event) => {
  const path = getPath(event);
  const method = getMethod(event);

  // Preflight (API Gateway should handle, but safe fallback)
  if (method === "OPTIONS") return json(200, { ok: true });

  const auth = requireOwner(event.headers);
  if (!auth.ok) return json(auth.status, { ok: false, error: auth.msg });

  // POST /snapshots/presign-put
  if (method === "POST" && path.endsWith("/snapshots/presign-put")) {
    let payload: any = {};
    try {
      payload = event.body ? JSON.parse(event.body) : {};
    } catch {
      return json(400, { ok: false, error: "Invalid JSON body" });
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
    return json(200, { ok: true, key, url });
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

    return json(200, { ok: true, items });
  }

  // GET /snapshots/presign-get?key=...
  if (method === "GET" && path.endsWith("/snapshots/presign-get")) {
    const key = event.queryStringParameters?.key || "";
    if (!key || !key.startsWith(PREFIX)) {
      return json(400, { ok: false, error: "Invalid key" });
    }

    const cmd = new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    });

    const url = await getSignedUrl(s3, cmd, { expiresIn: 60 });
    return json(200, { ok: true, key, url });
  }

  return json(404, { ok: false, error: "Not found" });
};
