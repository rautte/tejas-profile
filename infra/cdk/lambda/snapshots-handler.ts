// infra/cdk/lambda/snapshots-handler.ts


import {
  S3Client,
  ListObjectsV2Command,
  PutObjectCommand,
  GetObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
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
const SNAP_PREFIX = process.env.SNAPSHOTS_PREFIX || "snapshots/";
const TRASH_PREFIX = process.env.TRASH_PREFIX || "trash/";
const OWNER_TOKEN = process.env.OWNER_TOKEN || "";
const PROFILES_PREFIX = process.env.PROFILES_PREFIX || "profiles/";

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// -----------------------------
// helpers: headers / cors / auth
// -----------------------------
function getHeader(headers: Record<string, string> | undefined, key: string) {
  if (!headers) return "";
  const k = Object.keys(headers).find((h) => h.toLowerCase() === key.toLowerCase());
  return k ? headers[k] : "";
}

function pickCorsOrigin(headers: Record<string, string> | undefined) {
  const origin = getHeader(headers, "origin");
  if (!origin) return ""; // curl etc won't send origin
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

function requireOwner(headers: Record<string, string> | undefined) {
  if (!OWNER_TOKEN) return { ok: false, status: 500, msg: "OWNER_TOKEN not configured" };
  const token = getHeader(headers, "x-owner-token");
  if (!token || token.trim() !== OWNER_TOKEN) {
    return { ok: false, status: 401, msg: "Unauthorized" };
  }
  return { ok: true as const };
}

// -----------------------------
// helpers: key safety + moves
// -----------------------------
function safeKeyPart(s: string) {
  return (s || "").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
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
// NEW: parse metadata from key
// -----------------------------
type ParsedMeta = {
  name: string | null;
  from: string | null;
  to: string | null;
  createdAt: string | null; // still string; UI can format
};

function tryParseFromKey(key: string): ParsedMeta {
  // Works for both snapshots/... and trash/...
  // After removing prefix, expect:
  // name/from_FROM_to_TO/name__FROM__TO__CREATEDAT.json

  const k = normalizeKey(key);

  const stripPrefix = (full: string) => {
    if (full.startsWith(SNAP_PREFIX)) return { scope: "snapshots" as const, rest: full.slice(SNAP_PREFIX.length) };
    if (full.startsWith(TRASH_PREFIX)) return { scope: "trash" as const, rest: full.slice(TRASH_PREFIX.length) };
    return { scope: null, rest: full };
  };

  const { rest } = stripPrefix(k);
  // rest might be: analytics/from_2026-01-17_to_2026-01-17/analytics__2026-01-17__2026-01-17__2026-01-17T12_38_44.812Z.json

  const parts = rest.split("/").filter(Boolean);
  if (parts.length < 3) return { name: null, from: null, to: null, createdAt: null };

  const name = parts[0] || null;
  const rangePart = parts[1] || "";
  const file = parts[2] || "";

  // rangePart: from_X_to_Y
  let from: string | null = null;
  let to: string | null = null;
  {
    const m = /^from_(.+)_to_(.+)$/.exec(rangePart);
    if (m) {
      from = m[1] || null;
      to = m[2] || null;
    }
  }

  // file: name__from__to__createdAt.json
  let createdAt: string | null = null;
  {
    const base = file.endsWith(".json") ? file.slice(0, -5) : file;
    const prefix = `${name}__`;
    if (name && base.startsWith(prefix)) {
      const rest2 = base.slice(prefix.length); // from__to__createdAt
      const chunks = rest2.split("__");
      if (chunks.length >= 3) {
        // chunks[0]=from chunks[1]=to chunks[2..]=createdAt (in case createdAt contains __, rare but safe)
        createdAt = chunks.slice(2).join("__") || null;
        // if filename-derived from/to exists, prefer it if range parsing failed
        if (!from) from = chunks[0] || from;
        if (!to) to = chunks[1] || to;
      }
    }
  }

  return { name, from, to, createdAt };
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

  // Preflight
  if (method === "OPTIONS") return json(200, { ok: true }, corsOrigin);

  // Explicit CORS reject (only if a browser origin is present)
  const origin = getHeader(event.headers, "origin");
  if (origin && !corsOrigin) {
    return json(403, { ok: false, error: "CORS origin not allowed", origin }, "");
  }

  // Auth
  const auth = requireOwner(event.headers);
  if (!auth.ok) return json(auth.status, { ok: false, error: auth.msg }, corsOrigin);

  // -----------------------------
  // POST /snapshots/presign-put
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

    const cmd = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: "application/json",
    });

    const url = await getSignedUrl(s3, cmd, { expiresIn: 60 });
    return json(200, { ok: true, key, url }, corsOrigin);
  }

    // -----------------------------
    // POST /repo/presign-put
    // body: { profileVersion, checkpointTag, gitSha, contentType? }
    // returns: { key, url }
    // -----------------------------
    if (method === "POST" && path.endsWith("/repo/presign-put")) {
    let payload: any = {};
    try {
        payload = event.body ? JSON.parse(event.body) : {};
    } catch {
        return json(400, { ok: false, error: "Invalid JSON body" }, corsOrigin);
    }

    const profileVersion = safeKeyPart(payload.profileVersion || "unknown");
    const checkpointTag = safeKeyPart(payload.checkpointTag || "unknown");
    const gitSha = safeKeyPart(payload.gitSha || "unknown");
    const gitShaShort = gitSha ? gitSha.slice(0, 7) : "unknown";

    // enforce .zip
    const key = `${PROFILES_PREFIX}${profileVersion}/repo/${checkpointTag}__${gitShaShort}.zip`;

    const cmd = new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        ContentType: payload.contentType || "application/zip",
    });

    const url = await getSignedUrl(s3, cmd, { expiresIn: 120 });
    return json(200, { ok: true, key, url }, corsOrigin);
    }

  // -----------------------------
  // GET /snapshots/list?scope=trash
  // default scope = active snapshots
  // -----------------------------
  if (method === "GET" && path.endsWith("/snapshots/list")) {
    const scope = (event.queryStringParameters?.scope || "").toLowerCase();
    const prefix = scope === "trash" ? TRASH_PREFIX : SNAP_PREFIX;

    const cmd = new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix,
      MaxKeys: 200,
    });

    const res = await s3.send(cmd);

    const items =
      (res.Contents || [])
        .filter((o) => o.Key && o.Key.endsWith(".json"))
        .map((o) => {
          const key = o.Key!;
          const meta = tryParseFromKey(key);
          return {
            key,
            filename: basename(key),
            scope: scope === "trash" ? "trash" : "snapshots",
            name: meta.name,
            from: meta.from,
            to: meta.to,
            createdAt: meta.createdAt,
            size: o.Size ?? 0,
            lastModified: o.LastModified ? o.LastModified.toISOString() : null,
          };
        })
        .sort((a, b) => (b.lastModified || "").localeCompare(a.lastModified || ""));

    return json(200, { ok: true, items }, corsOrigin);
  }

  // -----------------------------
  // GET /snapshots/presign-get?key=...
  // allow BOTH snapshots/* and trash/*
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
      Bucket: BUCKET,
      Key: key,
    });

    const url = await getSignedUrl(s3, cmd, { expiresIn: 60 });
    return json(200, { ok: true, key, url }, corsOrigin);
  }

  // -----------------------------
  // POST /snapshots/delete  (soft delete)
  // body: { key: "snapshots/..." }
  // moves to trash/...
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

    await s3.send(
      new CopyObjectCommand({
        Bucket: BUCKET,
        CopySource: `${BUCKET}/${fromKey}`,
        Key: toKey,
        ContentType: "application/json",
        MetadataDirective: "COPY",
      })
    );

    await s3.send(
      new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: fromKey,
      })
    );

    return json(200, { ok: true, fromKey, toKey }, corsOrigin);
  }

  // -----------------------------
  // POST /snapshots/restore
  // body: { key: "trash/..." }
  // moves back to snapshots/...
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

    await s3.send(
      new CopyObjectCommand({
        Bucket: BUCKET,
        CopySource: `${BUCKET}/${fromKey}`,
        Key: toKey,
        ContentType: "application/json",
        MetadataDirective: "COPY",
      })
    );

    await s3.send(
      new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: fromKey,
      })
    );

    return json(200, { ok: true, fromKey, toKey }, corsOrigin);
  }

  return json(404, { ok: false, error: "Not found" }, corsOrigin);
}
