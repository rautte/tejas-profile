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

const SNAPSHOTS_BUCKET = process.env.SNAPSHOTS_BUCKET!;
const REPO_BUCKET = process.env.REPO_BUCKET || SNAPSHOTS_BUCKET; // Option 2 sets this to a different bucket
const SNAP_PREFIX = process.env.SNAPSHOTS_PREFIX || "snapshots/";
const TRASH_PREFIX = process.env.TRASH_PREFIX || "trash/";
const OWNER_TOKEN = process.env.OWNER_TOKEN || "";
const PROFILES_PREFIX = process.env.PROFILES_PREFIX || "profiles/";

const GITHUB_REPO = process.env.GITHUB_REPO || ""; // "rautte/tejas-profile"
const GITHUB_WORKFLOW_FILE = process.env.GITHUB_WORKFLOW_FILE || "redeploy.yml";
const GITHUB_REF = process.env.GITHUB_REF || "main";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || ""; // PAT or GitHub App token (secret!)

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

function requireOwner(headers: Record<string, string> | undefined) {
  if (!OWNER_TOKEN) return { ok: false, status: 500, msg: "OWNER_TOKEN not configured" };
  const token = getHeader(headers, "x-owner-token");
  if (!token || token.trim() !== OWNER_TOKEN) {
    return { ok: false, status: 401, msg: "Unauthorized" };
  }
  return { ok: true as const };
}

function requireGithubConfig() {
  if (!GITHUB_REPO) return { ok: false, status: 500, msg: "GITHUB_REPO not configured" };
  if (!GITHUB_WORKFLOW_FILE) return { ok: false, status: 500, msg: "GITHUB_WORKFLOW_FILE not configured" };
  if (!GITHUB_TOKEN) return { ok: false, status: 500, msg: "GITHUB_TOKEN not configured" };
  return { ok: true as const };
}

function isLikelyGitSha(s: string) {
  return /^[a-f0-9]{7,40}$/i.test(s || "");
}

async function dispatchGithubWorkflow(inputs: Record<string, string>) {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/${GITHUB_WORKFLOW_FILE}/dispatches`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${GITHUB_TOKEN}`,
      "user-agent": "tejas-profile-snapshots-handler",
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
    },
    body: JSON.stringify({
      ref: GITHUB_REF,
      inputs,
    }),
  });

  // GitHub returns 204 No Content on success
  if (res.status === 204) return { ok: true as const };

  const txt = await res.text().catch(() => "");
  return { ok: false as const, status: res.status, error: txt || "dispatch failed" };
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

  const auth = requireOwner(event.headers);
  if (!auth.ok) return json(auth.status, { ok: false, error: auth.msg }, corsOrigin);

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

    const cmd = new PutObjectCommand({
      Bucket: SNAPSHOTS_BUCKET,
      Key: key,
      ContentType: "application/json",
    });

    const url = await getSignedUrl(s3, cmd, { expiresIn: 60 });
    return json(200, { ok: true, key, url }, corsOrigin);
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

    const profileVersion = safeKeyPart(payload.profileVersion || "unknown");
    if (!profileVersion || profileVersion === "unknown") {
      return json(400, { ok: false, error: "profileVersion required" }, corsOrigin);
    }

    const checkpointTag = safeKeyPart(payload.checkpointTag || "unknown");
    const gitSha = safeKeyPart(payload.gitSha || "unknown");
    const gitShaShort = gitSha ? gitSha.slice(0, 7) : "unknown";

    const key = `${PROFILES_PREFIX}${profileVersion}/repo/${checkpointTag}__${gitShaShort}.zip`;

    const cmd = new PutObjectCommand({
      Bucket: REPO_BUCKET,
      Key: key,
      ContentType: payload.contentType || "application/zip",
    });

    const url = await getSignedUrl(s3, cmd, { expiresIn: 600 }); // 10 min
    return json(200, { ok: true, bucket: REPO_BUCKET, key, url }, corsOrigin);
  }

  // -----------------------------
  // GET /snapshots/list?scope=trash  (SNAPSHOTS BUCKET)
  // -----------------------------
  if (method === "GET" && path.endsWith("/snapshots/list")) {
    const scope = (event.queryStringParameters?.scope || "").toLowerCase();
    const prefix = scope === "trash" ? TRASH_PREFIX : SNAP_PREFIX;

    const cmd = new ListObjectsV2Command({
      Bucket: SNAPSHOTS_BUCKET,
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

    await s3.send(
      new CopyObjectCommand({
        Bucket: SNAPSHOTS_BUCKET,
        CopySource: `${SNAPSHOTS_BUCKET}/${encodeURIComponent(fromKey)}`,
        Key: toKey,
        ContentType: "application/json",
        MetadataDirective: "COPY",
      })
    );

    await s3.send(new DeleteObjectCommand({ Bucket: SNAPSHOTS_BUCKET, Key: fromKey }));

    return json(200, { ok: true, fromKey, toKey }, corsOrigin);
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

    await s3.send(
      new CopyObjectCommand({
        Bucket: SNAPSHOTS_BUCKET,
        CopySource: `${SNAPSHOTS_BUCKET}/${encodeURIComponent(fromKey)}`,
        Key: toKey,
        ContentType: "application/json",
        MetadataDirective: "COPY",
      })
    );

    await s3.send(new DeleteObjectCommand({ Bucket: SNAPSHOTS_BUCKET, Key: fromKey }));

    return json(200, { ok: true, fromKey, toKey }, corsOrigin);
  }

  // -----------------------------
  // POST /deploy/trigger (owner-only)
  // body: { gitSha, checkpointTag?, profileVersion?, reason?, sourceSnapshotKey? }
  // triggers GitHub Actions workflow_dispatch
  // -----------------------------
  if (method === "POST" && path.endsWith("/deploy/trigger")) {
    const cfg = requireGithubConfig();
    if (!cfg.ok) return json(cfg.status, { ok: false, error: cfg.msg }, corsOrigin);

    let payload: any = {};
    try {
      payload = event.body ? JSON.parse(event.body) : {};
    } catch {
      return json(400, { ok: false, error: "Invalid JSON body" }, corsOrigin);
    }

    const gitSha = String(payload.gitSha || "").trim();
    if (!isLikelyGitSha(gitSha)) {
      return json(400, { ok: false, error: "gitSha is required (7-40 hex chars)" }, corsOrigin);
    }

    const checkpointTag = safeKeyPart(payload.checkpointTag || "");
    const profileVersion = safeKeyPart(payload.profileVersion || "");
    const sourceSnapshotKey = safeKeyPart(payload.sourceSnapshotKey || "");
    const reason = safeKeyPart(payload.reason || "owner trigger");

    const inputs: Record<string, string> = {
      gitSha,
      checkpointTag: checkpointTag || "unknown",
      profileVersion: profileVersion || "unknown",
      sourceSnapshotKey: sourceSnapshotKey || "unknown",
      reason,
    };

    const out = await dispatchGithubWorkflow(inputs);
    if (!out.ok) {
      return json(
        502,
        { ok: false, error: `GitHub dispatch failed (${out.status})`, details: out.error },
        corsOrigin
      );
    }

    return json(200, { ok: true, message: "Deploy triggered" }, corsOrigin);
  }

  return json(404, { ok: false, error: "Not found" }, corsOrigin);
}
