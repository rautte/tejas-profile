// src/utils/snapshots/snapshotsApi.js

import { OWNER_SESSION_KEY, OWNER_TOKEN_KEY } from "../../config/owner";

const API = process.env.REACT_APP_SNAPSHOTS_API || "";

function mustHaveApi() {
  if (!API) throw new Error("Missing REACT_APP_SNAPSHOTS_API");
  return API.replace(/\/$/, "");
}

function isOwnerEnabled() {
  try {
    return sessionStorage.getItem(OWNER_SESSION_KEY) === "1";
  } catch {}
  return false;
}

function ownerToken() {
  try {
    return sessionStorage.getItem(OWNER_TOKEN_KEY) || "";
  } catch {}
  return "";
}

function headers() {
  const h = { "content-type": "application/json" };

  // only attach token if owner mode enabled
  if (isOwnerEnabled()) {
    const t = ownerToken();
    if (t) h["x-owner-token"] = t;
  }

  return h;
}

// -----------------------------
// Snapshots (JSON)
// -----------------------------
export async function presignPutSnapshot({
  from,
  to,
  name = "analytics",
  createdAt,
  category,
  tagKey,
  tagValue,
  profileVersionId,
  gitSha,
  checkpointTag,
  repoArtifactKey,
  repoArtifactSha256,
  remark,
  geoHint,
  geoJson, // ✅ Phase-3: structured geo JSON (string or object)
}) {
  const base = mustHaveApi();

  const res = await fetch(`${base}/snapshots/presign-put`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      from,
      to,
      name,
      createdAt,
      category,
      tagKey,
      tagValue,
      profileVersionId,
      gitSha,
      checkpointTag,
      repoArtifactKey,
      repoArtifactSha256,
      remark,
      geoHint,

      // ✅ Phase-3: send geoJson too (backend can persist this as metadata)
      // allow either object or string
      geoJson:
        geoJson && typeof geoJson === "object"
          ? JSON.stringify(geoJson)
          : geoJson || "",
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) throw new Error(json.error || "presign-put failed");
  return json;
}

/**
 * NOTE:
 * This assumes you have a backend route:
 *   POST {API}/snapshots/commit-meta
 * If you don't yet, this will 404 until you add it in snapshots-handler.ts + stack routes.
 */
export async function commitSnapshotMeta({ key, meta }) {
  if (!key) throw new Error("commitSnapshotMeta: key is required");
  if (!meta || typeof meta !== "object")
    throw new Error("commitSnapshotMeta: meta is required");

  const base = mustHaveApi();

  const res = await fetch(`${base}/snapshots/commit-meta`, {
    method: "POST",
    headers: headers(), // ✅ keep owner auth consistent
    body: JSON.stringify({ key, meta }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) {
    throw new Error(json.error || `commitSnapshotMeta failed (${res.status})`);
  }

  return json;
}

export async function updateSnapshotRemark({ key, remark }) {
  const base = mustHaveApi();

  const res = await fetch(`${base}/snapshots/remark`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ key, remark }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) throw new Error(json.error || "update remark failed");
  return json;
}

export async function uploadSnapshotToS3(url, snapshotObject) {
  const body = JSON.stringify(snapshotObject, null, 2);

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
    },
    body,
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Upload failed (${res.status}) ${t || ""}`.trim());
  }
}

export async function listSnapshots({ name } = {}) {
  const base = mustHaveApi();

  const qs = new URLSearchParams();
  if (name) qs.set("name", name);

  const url = qs.toString()
    ? `${base}/snapshots/list?${qs.toString()}`
    : `${base}/snapshots/list`;

  const res = await fetch(url, { headers: headers() });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) throw new Error(json.error || "list failed");
  return json.items;
}

export async function listTrashSnapshots({ name } = {}) {
  const base = mustHaveApi();

  const qs = new URLSearchParams({ scope: "trash" });
  if (name) qs.set("name", name);

  const res = await fetch(`${base}/snapshots/list?${qs.toString()}`, {
    headers: headers(),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) throw new Error(json.error || "list trash failed");
  return json.items;
}

export async function presignGetSnapshot(key) {
  const base = mustHaveApi();

  const qs = new URLSearchParams({ key });
  const res = await fetch(`${base}/snapshots/presign-get?${qs.toString()}`, {
    headers: headers(),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) throw new Error(json.error || "presign-get failed");
  return json.url;
}

export async function fetchSnapshotJson(key) {
  const url = await presignGetSnapshot(key);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch snapshot failed: ${res.status}`);
  return res.json();
}

export async function deleteSnapshot(key) {
  const base = mustHaveApi();

  const res = await fetch(`${base}/snapshots/delete`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ key }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) throw new Error(json.error || "delete failed");
  return json;
}

export async function restoreSnapshot(key) {
  const base = mustHaveApi();

  const res = await fetch(`${base}/snapshots/restore`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ key }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) throw new Error(json.error || "restore failed");
  return json;
}

// -----------------------------
// Repo ZIP (binary) - Option 2
// -----------------------------
// Lambda route: POST /repo/presign-put
// body: { profileVersion, checkpointTag, gitSha, contentType? }
// returns: { key, url }

export async function presignPutRepoZip({
  profileVersion,
  checkpointTag,
  gitSha,
  // contentType removed on purpose (backend enforces zip)
}) {
  const base = mustHaveApi();

  const res = await fetch(`${base}/repo/presign-put`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ profileVersion, checkpointTag, gitSha }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok)
    throw new Error(json.error || "repo presign-put failed");
  return json; // { key, url, contentType }
}

// Upload file/blob to presigned S3 url
export async function uploadRepoZipToS3(
  url,
  fileOrBlob,
  contentType = "application/zip"
) {
  const res = await fetch(url, {
    method: "PUT",
    headers: { "content-type": contentType },
    body: fileOrBlob,
  });
  if (!res.ok) throw new Error(`Repo zip upload failed: ${res.status}`);
}

// -----------------------------
// Deploy trigger (owner-only)
// -----------------------------
// Lambda route: POST /deploy/trigger
// body: { gitSha, checkpointTag?, profileVersion?, reason?, sourceSnapshotKey? }
// returns: { ok, runUrl?, message? }
export async function triggerDeploy({
  gitSha,
  checkpointTag,
  profileVersion,
  reason,
  sourceSnapshotKey,
}) {
  const base = mustHaveApi();

  const res = await fetch(`${base}/deploy/trigger`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      gitSha,
      checkpointTag,
      profileVersion,
      reason,
      sourceSnapshotKey,
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) throw new Error(json.error || "deploy trigger failed");
  return json; // { ok, message, runUrl? }
}

export async function getDeployHistory() {
  const base = mustHaveApi();
  const res = await fetch(`${base}/deploy/history`, { headers: headers() });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) throw new Error(json.error || "deploy history failed");
  return json.history; // may be null
}

export async function purgeSnapshot(key) {
  const base = mustHaveApi();

  const res = await fetch(`${base}/snapshots/purge`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ key }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) throw new Error(json.error || "purge failed");
  return json; // { ok:true, key, deleted }
}
