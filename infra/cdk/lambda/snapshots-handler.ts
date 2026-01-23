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
  return /^[a-f0-9]{7,40}$/i.test(s || "");
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
    geoHint,
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
            repoArtifactKey: m.repoartifactkey || "",
            repoArtifactSha256: m.repoartifactsha256 || "",
            remark: m.remark || "",
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
                    repoArtifactKey: metaFromHead.repoArtifactKey || derived.repoArtifactKey || "",
                    repoArtifactSha256: metaFromHead.repoArtifactSha256 || derived.repoArtifactSha256 || "",
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

        // ✅ NEW: meta for UI columns + badges
        meta,
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

        return json(200, { ok: true, history }, corsOrigin);
    } catch (e: any) {
        const name = e?.name || "";
        const msg = String(e?.message || e);

        if (name === "NoSuchKey" || msg.includes("NoSuchKey") || msg.includes("NotFound")) {
        return json(200, { ok: true, history: null }, corsOrigin);
        }

        return json(500, { ok: false, error: "Failed to read deploy history" }, corsOrigin);
    }
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
